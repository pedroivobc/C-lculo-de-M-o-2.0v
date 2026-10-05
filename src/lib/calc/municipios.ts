import { LAND_VALUES } from '../../data/landValues';
import { CONSTRUCTION_PRICES, COMMERCIALIZATION_FACTORS } from '../../data/factors';

/**
 * Regras que pertencem à prefeitura. Para abrir uma cidade nova de MG,
 * basta cadastrar uma entrada aqui (e, no banco, na tabela `municipios`).
 */
export interface Municipio {
  id: string;
  nome: string;
  uf: 'MG';
  itbi: {
    aliquota: number;
    /** Regra do SFH: parte financiada com alíquota reduzida até o limiar. */
    sfh: { limiar: number; fixoNoLimiar: number; aliquotaFinanciado: number };
  };
  valorVenal?: {
    valorM2Terreno: Record<string, number>;
    valorM2Edificacao: Record<string, Record<string, number>>;
    fatorComercializacao: Record<string, Record<string, number>>;
  };
}

export const MUNICIPIOS: Record<string, Municipio> = {
  'mg-juiz-de-fora': {
    id: 'mg-juiz-de-fora',
    nome: 'Juiz de Fora',
    uf: 'MG',
    itbi: {
      aliquota: 0.02,
      sfh: { limiar: 107603.17, fixoNoLimiar: 538.02, aliquotaFinanciado: 0.005 },
    },
    valorVenal: {
      valorM2Terreno: LAND_VALUES,
      valorM2Edificacao: CONSTRUCTION_PRICES,
      fatorComercializacao: COMMERCIALIZATION_FACTORS,
    },
  },
};

export const MUNICIPIO_PADRAO = 'mg-juiz-de-fora';

export function obterMunicipio(id: string = MUNICIPIO_PADRAO): Municipio {
  const m = MUNICIPIOS[id];
  if (!m) throw new Error(`Município ainda não atendido: ${id}`);
  return m;
}

/** ITBI com a regra do SFH (financiamento habitacional). */
export function itbiSfh(m: Municipio, base: number, financiado: number): number {
  const { limiar, fixoNoLimiar, aliquotaFinanciado } = m.itbi.sfh;
  if (financiado < limiar) {
    return (base - financiado) * m.itbi.aliquota + financiado * aliquotaFinanciado;
  }
  return (base - limiar) * m.itbi.aliquota + fixoNoLimiar;
}
