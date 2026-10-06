import type { Detalhe, Linha } from './tipos';
import { parametros } from './parametros';

/**
 * Emolumentos do Registro de Imóveis de MG — Tabela 4 de 2026 (Lei estadual 15.424/2004),
 * conferida contra o relatório final do 3º Registro de Imóveis de Juiz de Fora (protocolo 229.352).
 *
 * Cada ato custa: emolumentos brutos (líquidos + Recompe + fundos) + Taxa de Fiscalização Judiciária
 * + ISSQN do município sobre os emolumentos brutos (Juiz de Fora: 5%).
 */
type Ato = { bruto: number; tfj: number };

// Faixas, excedente, cancelamento e atos fixos vêm das tabelas vigentes (./parametros.ts), que o admin atualiza todo ano.
const tabela = () => parametros().emolumentos;

export const ISS_PADRAO = 0.05;

// toFixed antes de arredondar: 1748,31 / 2 = 874,155 vira 874,16 (como no recibo), e não 874,15 por erro de ponto flutuante.
const centavos = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

/**
 * Valor final ao usuário de um ato: emolumentos + TFJ + ISSQN do município sobre os emolumentos.
 * `reducao` (ex.: 0,5 no 1º imóvel pelo SFH) vale sobre emolumentos e TFJ, cada um arredondado, como nos recibos.
 */
export function valorDoAto(a: Ato, iss = ISS_PADRAO, reducao = 0) {
  const bruto = centavos(a.bruto * (1 - reducao));
  const tfj = centavos(a.tfj * (1 - reducao));
  return centavos(bruto + tfj + centavos(bruto * iss));
}

/** Ato de registro com valor declarado (compra e venda, doação, alienação fiduciária…). */
export function atoDeRegistro(base: number, iss = ISS_PADRAO, reducao = 0): { codigo: string; valor: number } {
  const { faixas, excedente } = tabela();
  const faixa = faixas.find((f) => base <= f.ate);
  if (faixa) return { codigo: faixa.codigo, valor: valorDoAto(faixa, iss, reducao) };
  const ultima = faixas[faixas.length - 1];
  const excedentes = Math.min(excedente.maxFaixas, Math.ceil((base - ultima.ate) / excedente.aCada));
  return {
    codigo: `${ultima.codigo} + ${excedentes}× ${excedente.codigo}`,
    valor: centavos(valorDoAto(ultima, iss, reducao) + excedentes * valorDoAto(excedente, iss, reducao)),
  };
}

/**
 * Emolumentos brutos e TFJ de um ato com conteúdo financeiro pela base, somando as faixas excedentes acima de R$ 3,7 mi.
 * As faixas da Tabela 1 (escritura, 4-b) têm os mesmos valores das da Tabela 4 (registro, 5-e).
 */
export function faixaComValor(base: number): { bruto: number; tfj: number } {
  const { faixas, excedente } = tabela();
  const faixa = faixas.find((f) => base <= f.ate);
  if (faixa) return faixa;
  const ultima = faixas[faixas.length - 1];
  const excedentes = Math.min(excedente.maxFaixas, Math.ceil((base - ultima.ate) / excedente.aCada));
  return { bruto: centavos(ultima.bruto + excedentes * excedente.bruto), tfj: ultima.tfj };
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function atoDeCancelamento(base: number, iss = ISS_PADRAO): { codigo: string; valor: number } {
  const lista = tabela().cancelamento;
  const ato = lista.find((f) => base <= f.ate) ?? lista[lista.length - 1];
  return { codigo: ato.codigo, valor: valorDoAto(ato, iss) };
}

/** Folhas de um contrato de financiamento (instrumento particular), quando o usuário não informa. */
export const FOLHAS_CONTRATO = 16;

/**
 * Linha "Registro" com o detalhamento usado pelo cartório:
 * ato(s) de registro + prenotação + certidão de inteiro teor + averbação de inscrição municipal + averbação de dados pessoais,
 * e o arquivamento das folhas quando o título é instrumento particular (contrato de financiamento).
 *
 * `reducao` (1º imóvel no SFH) vale para todos os atos do título, menos a averbação de dados pessoais,
 * que o cartório cobra cheia (recibos do 1º RGI de Juiz de Fora, protocolos 263.001 e 264.014).
 */
export function linhaRegistro(
  atos: { rotulo: string; base: number; cancelamento?: boolean }[],
  opcoes: { iss?: number; rotulo?: string; reducao?: number; notaReducao?: string; folhas?: number } = {},
): Linha {
  const iss = opcoes.iss ?? ISS_PADRAO;
  const reducao = opcoes.reducao ?? 0;
  const sufixo = reducao ? ` · ${opcoes.notaReducao ?? `redução de ${reducao * 100}%`}` : '';
  const detalhes: Detalhe[] = atos.map((a) => {
    const r = a.cancelamento ? atoDeCancelamento(a.base, iss) : atoDeRegistro(a.base, iss, reducao);
    return { rotulo: a.rotulo, valor: r.valor, nota: `Cód. ${r.codigo} · base ${brl(a.base)}${a.cancelamento ? '' : sufixo}` };
  });
  const fixos = tabela().atos;
  const fixo = (rotulo: string, k: keyof typeof fixos, red = reducao) =>
    ({ rotulo, valor: valorDoAto(fixos[k], iss, red), nota: `Cód. ${fixos[k].codigo}${red ? sufixo : ''}` });
  detalhes.push(fixo('Prenotação', 'prenotacao'));
  if (opcoes.folhas) {
    const folha = valorDoAto(fixos.arquivamentoFolha, iss, reducao);
    detalhes.push({
      rotulo: 'Arquivamento do contrato',
      valor: centavos(folha * opcoes.folhas),
      nota: `Cód. ${fixos.arquivamentoFolha.codigo} · ${opcoes.folhas} folhas × ${brl(folha)}${sufixo}`,
    });
  }
  detalhes.push(
    fixo('Certidão de inteiro teor', 'certidaoInteiroTeor'),
    fixo('Averbação de inscrição municipal', 'averbacao'),
    fixo('Averbação de dados pessoais', 'averbacao', 0),
  );
  return {
    rotulo: opcoes.rotulo ?? 'Registro',
    valor: centavos(detalhes.reduce((s, d) => s + d.valor, 0)),
    origem: 'uf',
    nota: `Registro de Imóveis · Tabela 4 de MG (${tabela().ano}) · ISS ${Math.round(iss * 100)}%`,
    detalhes,
  };
}
