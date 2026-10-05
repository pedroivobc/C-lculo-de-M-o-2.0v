import type { FunctionDeclaration } from '@google/genai';
import { brl, calcular, type Resultado, type TipoCalculo } from '../../src/lib/calc';
import { buscarPorSeq, intervaloDoMes, linkDoPdf, listarCalculos, numeroCalculo, salvarCalculo } from '../historico';
import { gerarCsv } from '../exportar';
import { salvarArquivo, supabaseAdmin, urlAssinada } from '../supabase';

/** O que o n8n deve mandar de volta pelo WhatsApp. */
export type Resposta =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'documento'; url: string; nomeArquivo: string; mimetype: string; legenda?: string };

export interface Contexto {
  userId: string;
  telefone: string;
  municipio: string;
  cabecalhoPdf?: string | null;
  anexos: Resposta[];
}

const num = { type: 'number' };
const custos = {
  certidoes: { ...num, description: 'Certidões em reais. Omitir para usar o padrão.' },
  honorarios: { ...num, description: 'Honorários em reais. Omitir para usar o padrão.' },
  descricao: { type: 'string', description: 'Endereço ou nome do cliente, se o usuário informar.' },
};

export const DECLARACOES: FunctionDeclaration[] = [
  {
    name: 'calcular_escritura',
    description: 'Custos de escritura: ITBI, lavratura, registro, arquivamento, certidões e honorários. Salva no histórico e gera o PDF.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        subtipo: { type: 'string', enum: ['compra_venda_simples', 'interveniencia', 'compra_vinculo', 'doacao_simples', 'doacao_usufruto', 'renuncia_usufruto'] },
        valorDeclarado: num, valorVenal: num,
        valorDeclarado1: num, valorVenal1: num, valorDeclarado2: num, valorVenal2: num,
        valorDeclaradoCompra: num, valorVenalCompra: num, valorVinculo: num,
        valorAtribuido: num, avaliacaoFazenda: num,
        folhas: { type: 'integer', description: 'Folhas da escritura (padrão 25).' },
        ...custos,
      },
      required: ['subtipo'],
    },
  },
  {
    name: 'calcular_financiamento_caixa',
    description: 'Custos de financiamento pela Caixa: taxa Caixa, ITBI (regra do SFH quando couber), prenotação e registro.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        modalidade: { type: 'string', enum: ['SBPE', 'MCMV', 'SFI', 'EGI', 'FGTS'] },
        valorDeclarado: num, valorVenal: num, valorFinanciado: num,
        primeiroImovel: { type: 'boolean' },
        taxaPercent: { ...num, description: 'Taxa Caixa em %, padrão 1,5' },
        ...custos,
      },
      required: ['modalidade', 'valorDeclarado', 'valorVenal', 'valorFinanciado'],
    },
  },
  {
    name: 'calcular_banco_privado',
    description: 'Custos de financiamento em banco privado (Itaú, Bradesco, Santander).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        banco: { type: 'string', enum: ['itau', 'bradesco', 'santander'] },
        modalidade: { type: 'string', enum: ['SBPE', 'SFI'] },
        valorDeclarado: num, valorVenal: num, valorFinanciado: num,
        primeiroImovel: { type: 'boolean' },
        ...custos,
      },
      required: ['banco', 'modalidade', 'valorDeclarado', 'valorVenal', 'valorFinanciado'],
    },
  },
  {
    name: 'calcular_doacao',
    description: 'Custos de doação (ITCD de MG, lavratura, registro).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        subtipo: { type: 'string', enum: ['doacao_simples', 'doacao_usufruto', 'renuncia_usufruto'] },
        valorAtribuido: num, avaliacaoFazenda: num,
        folhas: { type: 'integer' },
        ...custos,
      },
      required: ['subtipo', 'valorAtribuido', 'avaliacaoFazenda'],
    },
  },
  {
    name: 'corrigir_contrato',
    description: 'Corrige um valor de contrato antigo pelo INCC até 2026.',
    parametersJsonSchema: {
      type: 'object',
      properties: { valorOriginal: num, anoContrato: { type: 'integer' }, descricao: custos.descricao },
      required: ['valorOriginal', 'anoContrato'],
    },
  },
  {
    name: 'reenviar_calculo',
    description: 'Reenvia o PDF de um cálculo do histórico pelo número (ex.: 142 para #0142).',
    parametersJsonSchema: { type: 'object', properties: { numero: { type: 'integer' } }, required: ['numero'] },
  },
  {
    name: 'exportar_periodo',
    description: 'Gera a planilha (CSV, abre no Excel) com todos os cálculos de um mês.',
    parametersJsonSchema: { type: 'object', properties: { mes: { type: 'string', description: 'Formato AAAA-MM' } }, required: ['mes'] },
  },
  {
    name: 'pedir_cidade',
    description: 'Registra o pedido de um município ainda não atendido.',
    parametersJsonSchema: { type: 'object', properties: { cidade: { type: 'string' }, uf: { type: 'string' } }, required: ['cidade'] },
  },
];

const TIPO_POR_FERRAMENTA: Record<string, TipoCalculo> = {
  calcular_escritura: 'escritura',
  calcular_financiamento_caixa: 'financiamento_caixa',
  calcular_banco_privado: 'banco_privado',
  calcular_doacao: 'doacao',
  corrigir_contrato: 'correcao',
};

const resumo = (r: Resultado, seq: number) => ({
  numero: numeroCalculo(seq),
  bases: r.bases.map(brl),
  itens: r.linhas.map((l) => ({ item: l.rotulo, valor: brl(l.valor), nota: l.nota })),
  total: brl(r.total),
  detalhes: r.detalhes,
});

/** Executa uma ferramenta e devolve o resultado que volta para o modelo. Arquivos vão para ctx.anexos. */
export async function executar(nome: string, args: Record<string, unknown>, ctx: Contexto): Promise<Record<string, unknown>> {
  try {
    const tipo = TIPO_POR_FERRAMENTA[nome];
    if (tipo) {
      const { descricao, ...entrada } = args as Record<string, unknown> & { descricao?: string };
      const dados = tipo === 'correcao' ? entrada : { municipio: ctx.municipio, ...entrada };
      const resultado = calcular(tipo, dados);
      const salvo = await salvarCalculo({ userId: ctx.userId, resultado, entrada: dados, origem: 'whatsapp', descricao });
      const pdf = await linkDoPdf(salvo, ctx.cabecalhoPdf);
      ctx.anexos.push({ tipo: 'documento', mimetype: 'application/pdf', ...pdf, legenda: `Orçamento ${numeroCalculo(salvo.seq)}` });
      return { ok: true, ...resumo(resultado, salvo.seq), pdf: 'enviado' };
    }

    if (nome === 'reenviar_calculo') {
      const salvo = await buscarPorSeq(ctx.userId, Number(args.numero));
      if (!salvo) return { ok: false, erro: `Não encontrei o cálculo ${numeroCalculo(Number(args.numero))} na sua conta.` };
      const pdf = await linkDoPdf(salvo, ctx.cabecalhoPdf);
      ctx.anexos.push({ tipo: 'documento', mimetype: 'application/pdf', ...pdf, legenda: `Orçamento ${numeroCalculo(salvo.seq)}` });
      return { ok: true, ...resumo(salvo.resultado, salvo.seq), pdf: 'enviado' };
    }

    if (nome === 'exportar_periodo') {
      const mes = String(args.mes);
      const calculos = await listarCalculos(ctx.userId, intervaloDoMes(mes));
      if (!calculos.length) return { ok: true, quantidade: 0, aviso: 'Nenhum cálculo nesse mês.' };
      const nomeArquivo = `calculos-${mes}.csv`;
      const caminho = await salvarArquivo(`${ctx.userId}/exportacoes/${nomeArquivo}`, gerarCsv(calculos), 'text/csv');
      ctx.anexos.push({ tipo: 'documento', mimetype: 'text/csv', nomeArquivo, url: await urlAssinada(caminho, 600, nomeArquivo), legenda: `${calculos.length} cálculos de ${mes}` });
      return { ok: true, quantidade: calculos.length, arquivo: 'enviado' };
    }

    if (nome === 'pedir_cidade') {
      await supabaseAdmin().from('pedidos_cidade').insert({
        cidade: String(args.cidade), uf: String(args.uf ?? 'MG').toUpperCase().slice(0, 2), whatsapp_e164: ctx.telefone, user_id: ctx.userId,
      });
      return { ok: true, registrado: true };
    }

    return { ok: false, erro: `Ferramenta desconhecida: ${nome}` };
  } catch (e) {
    // Erros de validação (zod) e de regra voltam ao modelo para ele pedir o dado que falta.
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
