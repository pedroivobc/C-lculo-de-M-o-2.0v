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

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Valor final ao usuário de um ato: emolumentos + TFJ + ISSQN do município. */
export function valorDoAto(a: Ato, iss = ISS_PADRAO) {
  return centavos(a.bruto + a.tfj + centavos(a.bruto * iss));
}

/** Ato de registro com valor declarado (compra e venda, doação, alienação fiduciária…). */
export function atoDeRegistro(base: number, iss = ISS_PADRAO): { codigo: string; valor: number } {
  const { faixas, excedente } = tabela();
  const faixa = faixas.find((f) => base <= f.ate);
  if (faixa) return { codigo: faixa.codigo, valor: valorDoAto(faixa, iss) };
  const ultima = faixas[faixas.length - 1];
  const excedentes = Math.min(excedente.maxFaixas, Math.ceil((base - ultima.ate) / excedente.aCada));
  return { codigo: `${ultima.codigo} + ${excedentes}× ${excedente.codigo}`, valor: centavos(valorDoAto(ultima, iss) + excedentes * valorDoAto(excedente, iss)) };
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

/**
 * Linha "Registro" com o detalhamento usado pelo cartório:
 * ato(s) de registro + prenotação + certidão de inteiro teor + averbação de inscrição municipal + averbação de dados pessoais.
 */
export function atoDeCancelamento(base: number, iss = ISS_PADRAO): { codigo: string; valor: number } {
  const lista = tabela().cancelamento;
  const ato = lista.find((f) => base <= f.ate) ?? lista[lista.length - 1];
  return { codigo: ato.codigo, valor: valorDoAto(ato, iss) };
}

export function linhaRegistro(
  atos: { rotulo: string; base: number; reducao?: number; cancelamento?: boolean }[],
  opcoes: { iss?: number; rotulo?: string; notaReducao?: string } = {},
): Linha {
  const iss = opcoes.iss ?? ISS_PADRAO;
  const detalhes: Detalhe[] = atos.map((a) => {
    const r = a.cancelamento ? atoDeCancelamento(a.base, iss) : atoDeRegistro(a.base, iss);
    const valor = a.reducao ? centavos(r.valor * (1 - a.reducao)) : r.valor;
    return {
      rotulo: a.rotulo,
      valor,
      nota: `Cód. ${r.codigo} · base ${brl(a.base)}${a.reducao ? ` · ${opcoes.notaReducao ?? `redução de ${a.reducao * 100}%`}` : ''}`,
    };
  });
  const fixos = tabela().atos;
  const fixo = (rotulo: string, k: keyof typeof fixos) => ({ rotulo, valor: valorDoAto(fixos[k], iss), nota: `Cód. ${fixos[k].codigo}` });
  detalhes.push(
    fixo('Prenotação', 'prenotacao'),
    fixo('Certidão de inteiro teor', 'certidaoInteiroTeor'),
    fixo('Averbação de inscrição municipal', 'averbacao'),
    fixo('Averbação de dados pessoais', 'averbacao'),
  );
  return {
    rotulo: opcoes.rotulo ?? 'Registro',
    valor: centavos(detalhes.reduce((s, d) => s + d.valor, 0)),
    origem: 'uf',
    nota: `Registro de Imóveis · Tabela 4 de MG (${tabela().ano}) · ISS ${Math.round(iss * 100)}%`,
    detalhes,
  };
}
