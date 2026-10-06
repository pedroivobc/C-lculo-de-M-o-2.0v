import { z } from 'zod';
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
    /** Regra do SFH: parte financiada com alíquota reduzida até o limiar. Sem ela, vale a alíquota cheia. */
    sfh?: { limiar: number; fixoNoLimiar: number; aliquotaFinanciado: number };
  };
  /** true quando a alíquota do ITBI foi informada pelo assinante (cidade ainda sem regra cadastrada). */
  itbiDoUsuario?: boolean;
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
/** Cidade de MG ainda sem regra cadastrada: o assinante informa o nome e a alíquota do ITBI. */
export const MUNICIPIO_OUTRA = 'mg-outra';

/** Campos de localidade aceitos por todas as calculadoras de ITBI. */
export const camposLocalidade = {
  municipio: z.string().default(MUNICIPIO_PADRAO),
  /** Nome da cidade quando municipio = 'mg-outra'. */
  cidade: z.string().trim().max(80).optional(),
  /** Alíquota do ITBI em % (ex.: 2 = 2%). Obrigatória em 'mg-outra'; nas cidades cadastradas, substitui a da prefeitura. */
  itbiPercentual: z.coerce.number().min(0).max(10).optional(),
};

export function obterMunicipio(id: string = MUNICIPIO_PADRAO, ajuste: { cidade?: string; itbiPercentual?: number } = {}): Municipio {
  const m = MUNICIPIOS[id];
  const pct = ajuste.itbiPercentual;
  if (m) {
    if (pct === undefined || pct / 100 === m.itbi.aliquota) return m;
    return { ...m, itbi: { ...m.itbi, aliquota: pct / 100 }, itbiDoUsuario: true };
  }
  if (id !== MUNICIPIO_OUTRA) throw new Error(`Município ainda não atendido: ${id}`);
  if (pct === undefined) throw new Error('Informe a alíquota do ITBI da sua cidade (em Conta → Orçamentos).');
  return { id, nome: ajuste.cidade || 'Outra cidade de MG', uf: 'MG', itbi: { aliquota: pct / 100 }, itbiDoUsuario: true };
}

/** Texto da alíquota para a nota do orçamento: "2%", "2,5%". */
export const percentual = (aliquota: number) => `${(aliquota * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** ITBI com a regra do SFH (financiamento habitacional). */
export function itbiSfh(m: Municipio, base: number, financiado: number): number {
  if (!m.itbi.sfh) return base * m.itbi.aliquota;
  const { limiar, fixoNoLimiar, aliquotaFinanciado } = m.itbi.sfh;
  if (financiado < limiar) {
    return (base - financiado) * m.itbi.aliquota + financiado * aliquotaFinanciado;
  }
  return (base - limiar) * m.itbi.aliquota + fixoNoLimiar;
}
