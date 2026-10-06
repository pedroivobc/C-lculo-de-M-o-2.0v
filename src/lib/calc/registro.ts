import type { Detalhe, Linha } from './tipos';

/**
 * Emolumentos do Registro de Imóveis de MG — Tabela 4 de 2026 (Lei estadual 15.424/2004),
 * conferida contra o relatório final do 3º Registro de Imóveis de Juiz de Fora (protocolo 229.352).
 *
 * Cada ato custa: emolumentos brutos (líquidos + Recompe + fundos) + Taxa de Fiscalização Judiciária
 * + ISSQN do município sobre os emolumentos brutos (Juiz de Fora: 5%).
 */
interface Ato { bruto: number; tfj: number }

/** 5 - e) Escritura pública, instrumento particular ou título judicial com conteúdo financeiro. [teto da faixa, código, ato] */
const REGISTRO_COM_VALOR: [number, string, Ato][] = [
  [1400, '4508', { bruto: 159.20, tfj: 61.35 }],
  [2720, '4509', { bruto: 259.68, tfj: 100.08 }],
  [5440, '4510', { bruto: 376.34, tfj: 145.01 }],
  [7000, '4511', { bruto: 520.99, tfj: 200.76 }],
  [14000, '4512', { bruto: 694.78, tfj: 267.69 }],
  [28000, '4513', { bruto: 897.58, tfj: 345.89 }],
  [42000, '4514', { bruto: 1129.02, tfj: 435.05 }],
  [56000, '4515', { bruto: 1389.81, tfj: 535.50 }],
  [70000, '4516', { bruto: 1679.40, tfj: 647.11 }],
  [105000, '4517', { bruto: 2113.64, tfj: 814.42 }],
  [140000, '4540', { bruto: 2540.87, tfj: 1180.65 }],
  [175000, '4541', { bruto: 2717.08, tfj: 1262.61 }],
  [210000, '4542', { bruto: 2893.66, tfj: 1344.66 }],
  [280000, '4543', { bruto: 3070.72, tfj: 1701.35 }],
  [350000, '4544', { bruto: 3155.22, tfj: 1748.31 }],
  [420000, '4545', { bruto: 3240.20, tfj: 1795.39 }],
  [560000, '4546', { bruto: 3325.70, tfj: 2197.44 }],
  [700000, '4547', { bruto: 3508.36, tfj: 2318.34 }],
  [840000, '4548', { bruto: 3691.51, tfj: 2439.36 }],
  [1120000, '4549', { bruto: 3875.31, tfj: 2991.22 }],
  [1400000, '4550', { bruto: 4197.56, tfj: 3240.08 }],
  [1680000, '4551', { bruto: 4520.42, tfj: 3489.30 }],
  [3200000, '4522', { bruto: 4844.02, tfj: 3738.95 }],
  [3700000, '4523', { bruto: 8133.92, tfj: 4673.83 }],
];
/** Acima de R$ 3,7 milhões: código 4552 a cada R$ 500 mil ou fração, até cem faixas (Nota XVII). */
const FAIXA_EXCEDENTE: Ato = { bruto: 2193.27, tfj: 0 };

/** 1 - g) Averbação de cancelamento de ônus e direitos reais (ex.: renúncia de usufruto), pelo valor do direito. */
const CANCELAMENTO_DIREITO_REAL: [number, string, Ato][] = [
  [1400, '4137', { bruto: 27.67, tfj: 8.60 }],
  [5000, '4138', { bruto: 33.20, tfj: 10.35 }],
  [20000, '4139', { bruto: 66.45, tfj: 20.69 }],
  [Infinity, '4140', { bruto: 110.78, tfj: 34.47 }],
];

/** Atos sem valor declarado usados em toda escritura registrada. */
export const ATOS_FIXOS = {
  prenotacao: { codigo: '4701', ato: { bruto: 53.11, tfj: 10.72 } },
  /** 1 - d) averbação que altera o registro quanto a pessoa ou dado (inscrição municipal, dados pessoais). */
  averbacao: { codigo: '4134', ato: { bruto: 27.60, tfj: 8.67 } },
  /** Tabela 8: certidão de inteiro teor da matrícula. */
  certidaoInteiroTeor: { codigo: '8401', ato: { bruto: 30.36, tfj: 10.72 } },
} as const;

export const ISS_PADRAO = 0.05;

const centavos = (n: number) => Math.round(n * 100) / 100;

/** Valor final ao usuário de um ato: emolumentos + TFJ + ISSQN do município. */
export function valorDoAto(a: Ato, iss = ISS_PADRAO) {
  return centavos(a.bruto + a.tfj + centavos(a.bruto * iss));
}

/** Ato de registro com valor declarado (compra e venda, doação, alienação fiduciária…). */
export function atoDeRegistro(base: number, iss = ISS_PADRAO): { codigo: string; valor: number } {
  const faixa = REGISTRO_COM_VALOR.find(([teto]) => base <= teto);
  if (faixa) return { codigo: faixa[1], valor: valorDoAto(faixa[2], iss) };
  const [, codigo, ultima] = REGISTRO_COM_VALOR[REGISTRO_COM_VALOR.length - 1];
  const excedentes = Math.min(100, Math.ceil((base - 3700000) / 500000));
  return { codigo: `${codigo} + ${excedentes}× 4552`, valor: centavos(valorDoAto(ultima, iss) + excedentes * valorDoAto(FAIXA_EXCEDENTE, iss)) };
}

/**
 * Emolumentos brutos e TFJ de um ato com conteúdo financeiro pela base, somando as faixas excedentes acima de R$ 3,7 mi.
 * As faixas da Tabela 1 (escritura, 4-b) têm os mesmos valores das da Tabela 4 (registro, 5-e).
 */
export function faixaComValor(base: number): { bruto: number; tfj: number } {
  const faixa = REGISTRO_COM_VALOR.find(([teto]) => base <= teto);
  if (faixa) return faixa[2];
  const ultima = REGISTRO_COM_VALOR[REGISTRO_COM_VALOR.length - 1][2];
  const excedentes = Math.min(100, Math.ceil((base - 3700000) / 500000));
  return { bruto: centavos(ultima.bruto + excedentes * FAIXA_EXCEDENTE.bruto), tfj: ultima.tfj };
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Linha "Registro" com o detalhamento usado pelo cartório:
 * ato(s) de registro + prenotação + certidão de inteiro teor + averbação de inscrição municipal + averbação de dados pessoais.
 */
export function atoDeCancelamento(base: number, iss = ISS_PADRAO): { codigo: string; valor: number } {
  const [, codigo, ato] = CANCELAMENTO_DIREITO_REAL.find(([teto]) => base <= teto)!;
  return { codigo, valor: valorDoAto(ato, iss) };
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
  const fixo = (rotulo: string, k: keyof typeof ATOS_FIXOS) =>
    ({ rotulo, valor: valorDoAto(ATOS_FIXOS[k].ato, iss), nota: `Cód. ${ATOS_FIXOS[k].codigo}` });
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
    nota: `Registro de Imóveis · Tabela 4 de MG · ISS ${Math.round(iss * 100)}%`,
    detalhes,
  };
}
