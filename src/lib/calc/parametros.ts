/**
 * Valores que mudam todo ano: tabela de emolumentos de MG (TJMG), índices do INCC (correção contratual)
 * e a base do desconto de ITBI de Juiz de Fora no SFH.
 *
 * Os valores de 2026 abaixo são o padrão. O administrador publica as tabelas dos anos seguintes por
 * planilha (tela Admin → Tabelas anuais); o servidor e o site carregam a versão vigente e chamam
 * `definirParametros`. Todos os cálculos leem daqui, então não há número de tabela espalhado pelo código.
 */

export interface Ato { codigo: string; bruto: number; tfj: number }
export interface Faixa extends Ato { ate: number }

export interface TabelaEmolumentos {
  ano: number;
  /** Tabela 4, 5-e (registro) — mesmos valores da Tabela 1, 4-b (escritura). Faixas por "até", em ordem. */
  faixas: Faixa[];
  /** Acima da última faixa: a cada `aCada` reais (ou fração) soma um ato, até `maxFaixas`. */
  excedente: Ato & { aCada: number; maxFaixas: number };
  /** Tabela 4, 1-g: averbação de cancelamento de direito real (a última faixa vale para "acima"). */
  cancelamento: Faixa[];
  atos: { prenotacao: Ato; averbacao: Ato; certidaoInteiroTeor: Ato; arquivamentoFolha: Ato };
}

export interface TabelaIncc { anoBase: number; indices: Record<number, number> }

export interface ItbiJuizDeFora { ano: number; limiarSfh: number; aliquotaFinanciado: number }

export interface Parametros { emolumentos: TabelaEmolumentos; incc: TabelaIncc; itbiJf: ItbiJuizDeFora }
export type TipoTabela = keyof Parametros;

export const PARAMETROS_2026: Parametros = {
  emolumentos: {
    ano: 2026,
    faixas: [
      { ate: 1400, codigo: '4508', bruto: 159.20, tfj: 61.35 },
      { ate: 2720, codigo: '4509', bruto: 259.68, tfj: 100.08 },
      { ate: 5440, codigo: '4510', bruto: 376.34, tfj: 145.01 },
      { ate: 7000, codigo: '4511', bruto: 520.99, tfj: 200.76 },
      { ate: 14000, codigo: '4512', bruto: 694.78, tfj: 267.69 },
      { ate: 28000, codigo: '4513', bruto: 897.58, tfj: 345.89 },
      { ate: 42000, codigo: '4514', bruto: 1129.02, tfj: 435.05 },
      { ate: 56000, codigo: '4515', bruto: 1389.81, tfj: 535.50 },
      { ate: 70000, codigo: '4516', bruto: 1679.40, tfj: 647.11 },
      { ate: 105000, codigo: '4517', bruto: 2113.64, tfj: 814.42 },
      { ate: 140000, codigo: '4540', bruto: 2540.87, tfj: 1180.65 },
      { ate: 175000, codigo: '4541', bruto: 2717.08, tfj: 1262.61 },
      { ate: 210000, codigo: '4542', bruto: 2893.66, tfj: 1344.66 },
      { ate: 280000, codigo: '4543', bruto: 3070.72, tfj: 1701.35 },
      { ate: 350000, codigo: '4544', bruto: 3155.22, tfj: 1748.31 },
      { ate: 420000, codigo: '4545', bruto: 3240.20, tfj: 1795.39 },
      { ate: 560000, codigo: '4546', bruto: 3325.70, tfj: 2197.44 },
      { ate: 700000, codigo: '4547', bruto: 3508.36, tfj: 2318.34 },
      { ate: 840000, codigo: '4548', bruto: 3691.51, tfj: 2439.36 },
      { ate: 1120000, codigo: '4549', bruto: 3875.31, tfj: 2991.22 },
      { ate: 1400000, codigo: '4550', bruto: 4197.56, tfj: 3240.08 },
      { ate: 1680000, codigo: '4551', bruto: 4520.42, tfj: 3489.30 },
      { ate: 3200000, codigo: '4522', bruto: 4844.02, tfj: 3738.95 },
      { ate: 3700000, codigo: '4523', bruto: 8133.92, tfj: 4673.83 },
    ],
    excedente: { codigo: '4552', bruto: 2193.27, tfj: 0, aCada: 500000, maxFaixas: 100 },
    cancelamento: [
      { ate: 1400, codigo: '4137', bruto: 27.67, tfj: 8.60 },
      { ate: 5000, codigo: '4138', bruto: 33.20, tfj: 10.35 },
      { ate: 20000, codigo: '4139', bruto: 66.45, tfj: 20.69 },
      { ate: Infinity, codigo: '4140', bruto: 110.78, tfj: 34.47 },
    ],
    atos: {
      prenotacao: { codigo: '4701', bruto: 53.11, tfj: 10.72 },
      averbacao: { codigo: '4134', bruto: 27.60, tfj: 8.67 },
      certidaoInteiroTeor: { codigo: '8401', bruto: 30.36, tfj: 10.72 },
      arquivamentoFolha: { codigo: '8101', bruto: 10.22, tfj: 3.21 },
    },
  },
  incc: {
    anoBase: 2026,
    indices: {
      1997: 30.25, 1998: 31.92, 1999: 32.45, 2000: 35.14,
      2001: 37.45, 2002: 40.30, 2003: 44.71, 2004: 49.64,
      2005: 53.23, 2006: 56.54, 2007: 58.25, 2008: 60.69,
      2009: 64.57, 2010: 67.29, 2011: 71.08, 2012: 75.80,
      2013: 79.99, 2014: 84.61, 2015: 90.16, 2016: 99.61,
      2017: 106.57, 2018: 109.55, 2019: 113.99, 2020: 117.72,
      2021: 122.79, 2022: 135.98, 2023: 144.00, 2024: 150.74,
      2025: 157.40, 2026: 165.54,
    },
  },
  itbiJf: { ano: 2026, limiarSfh: 107603.17, aliquotaFinanciado: 0.005 },
};

let atuais: Parametros = PARAMETROS_2026;

/** Tabelas em vigor para os cálculos. */
export const parametros = (): Parametros => atuais;

/** Troca as tabelas em vigor (o servidor e o site chamam ao carregar a versão publicada pelo admin). */
export function definirParametros(novos: Partial<Parametros>) {
  atuais = { ...atuais, ...novos };
}

/** JSON não guarda Infinity: a última faixa de cancelamento volta como "acima de". */
export function normalizarParametros(p: Partial<Parametros>): Partial<Parametros> {
  if (!p.emolumentos) return p;
  const canc = p.emolumentos.cancelamento.map((f, i, todas) => ({ ...f, ate: i === todas.length - 1 ? Infinity : Number(f.ate) }));
  return { ...p, emolumentos: { ...p.emolumentos, cancelamento: canc } };
}
