import type { FunctionDeclaration } from '@google/genai';
import { brl, calcular, type Resultado, type TipoCalculo } from '../../src/lib/calc';
import { arquivoDoOrcamento, buscarPorSeq, intervaloDoMes, listarCalculos, numeroCalculo, salvarCalculo } from '../historico';
import { comLocalidade, type Configuracao } from '../estilo';
import { gerarCsv } from '../exportar';
import { salvarArquivo, supabaseAdmin, urlAssinada } from '../supabase';

/** O que o n8n deve mandar de volta pelo WhatsApp. */
export type Resposta =
  /** `opcoes` acompanha os menus: hoje vira texto numerado; na API oficial pode virar botões. */
  | { tipo: 'texto'; texto: string; opcoes?: { id: string; titulo: string }[] }
  | { tipo: 'documento'; url: string; nomeArquivo: string; mimetype: string; legenda?: string };
// Imagens (JPEG) também vão como 'documento' na resposta; o n8n escolhe mediatype 'image' pelo mimetype.

export interface Contexto {
  userId: string;
  telefone: string;
  /** Estilo do orçamento e localidade padrão do assinante. */
  configuracao: Configuracao;
  anexos: Resposta[];
}

const num = { type: 'number' };
const custos = {
  certidoes: { ...num, description: 'Certidões em reais. Omitir para usar o padrão.' },
  honorarios: { ...num, description: 'Honorários em reais. Omitir para usar o padrão.' },
  descricao: { type: 'string', description: 'Referência curta do imóvel (ex.: bairro ou "apto Centro"), se o usuário informar. Nunca nome, CPF, telefone ou e-mail de pessoas.' },
  municipio: { type: 'string', enum: ['mg-juiz-de-fora', 'mg-belo-horizonte', 'mg-outra'], description: 'Omitir para usar a cidade do assinante. "mg-outra" = cidade de MG sem regra cadastrada (exige cidade e itbiPercentual).' },
  cidade: { type: 'string', description: 'Nome da cidade quando municipio = "mg-outra".' },
  itbiPercentual: { type: 'number', description: 'Alíquota do ITBI em % (ex.: 2.5). Só quando o usuário informar.' },
};

export const DECLARACOES: FunctionDeclaration[] = [
  {
    name: 'calcular_escritura',
    description: 'Custos de escritura: ITBI, escritura (lavratura + arquivamento), registro (ato de registro, prenotação, certidão de inteiro teor e averbações), certidões e honorários. Salva no histórico e gera o orçamento.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        subtipo: { type: 'string', enum: ['compra_venda_simples', 'interveniencia', 'compra_vinculo', 'doacao_simples', 'doacao_usufruto', 'renuncia_usufruto'] },
        valorDeclarado: num,
        valorDeclarado1: num, valorDeclarado2: num,
        valorDeclaradoCompra: num, valorVinculo: num,
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
        valorDeclarado: num, valorFinanciado: num,
        primeiroImovel: { type: 'boolean' },
        taxaPercent: { ...num, description: 'Taxa Caixa em %, padrão 1,5' },
        ...custos,
      },
      required: ['modalidade', 'valorDeclarado', 'valorFinanciado'],
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
        valorDeclarado: num, valorFinanciado: num,
        primeiroImovel: { type: 'boolean' },
        ...custos,
      },
      required: ['banco', 'modalidade', 'valorDeclarado', 'valorFinanciado'],
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
    description: 'Reenvia o orçamento de um cálculo do histórico pelo número (ex.: 142 para #0142). Por padrão no formato escolhido pelo assinante; use formato se ele pedir PDF ou imagem.',
    parametersJsonSchema: { type: 'object', properties: { numero: { type: 'integer' }, formato: { type: 'string', enum: ['pdf', 'jpeg'] } }, required: ['numero'] },
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
  itens: r.linhas.map((l) => ({ item: l.rotulo, valor: brl(l.valor), nota: l.nota, detalhes: l.detalhes?.map((d) => `${d.rotulo}: ${brl(d.valor)}`) })),
  total: brl(r.total),
  detalhes: r.detalhes,
});

/** Anexa o orçamento no formato escolhido pelo assinante (PDF ou imagem JPEG). */
async function anexar(ctx: Contexto, salvo: Parameters<typeof arquivoDoOrcamento>[0], formato?: 'pdf' | 'jpeg') {
  const arquivo = await arquivoDoOrcamento(salvo, ctx.configuracao.estilo, formato);
  ctx.anexos.push({ tipo: 'documento', ...arquivo, legenda: `Orçamento ${numeroCalculo(salvo.seq)}` });
}

/** Executa uma ferramenta e devolve o resultado que volta para o modelo. Arquivos vão para ctx.anexos. */
export async function executar(nome: string, args: Record<string, unknown>, ctx: Contexto): Promise<Record<string, unknown>> {
  try {
    const tipo = TIPO_POR_FERRAMENTA[nome];
    if (tipo) {
      const { descricao, ...entrada } = args as Record<string, unknown> & { descricao?: string };
      const dados = tipo === 'correcao' ? entrada : comLocalidade(entrada, ctx.configuracao.localidade);
      const resultado = calcular(tipo, dados);
      const salvo = await salvarCalculo({ userId: ctx.userId, resultado, entrada: dados, origem: 'whatsapp', descricao });
      await anexar(ctx, salvo);
      return { ok: true, ...resumo(resultado, salvo.seq), arquivo: 'enviado' };
    }

    if (nome === 'reenviar_calculo') {
      const salvo = await buscarPorSeq(ctx.userId, Number(args.numero));
      if (!salvo) return { ok: false, erro: `Não encontrei o cálculo ${numeroCalculo(Number(args.numero))} na sua conta.` };
      const formato = args.formato === 'pdf' || args.formato === 'jpeg' ? args.formato : undefined;
      await anexar(ctx, salvo, formato);
      return { ok: true, ...resumo(salvo.resultado, salvo.seq), arquivo: 'enviado' };
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
