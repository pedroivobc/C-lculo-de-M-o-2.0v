import { z } from 'zod';

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
  /** ISSQN do município sobre os emolumentos do cartório (Juiz de Fora: 5%). */
  issCartorio: number;
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
    issCartorio: 0.05,
  },
  // Lei 6.492/1993 (3% desde 01/05/2014), conferida na base de pesquisa 2026 (docs/base-2026).
  // Sem regra de SFH confirmada: financiamento paga 3% sobre o valor inteiro. As isenções do MCMV
  // têm limites e condições próprios e não entram no cálculo automático.
  'mg-belo-horizonte': {
    id: 'mg-belo-horizonte',
    nome: 'Belo Horizonte',
    uf: 'MG',
    itbi: { aliquota: 0.03 },
    // A base de NFS-e não traz registro ativo de BH para o serviço 21.01: 5% até confirmar com um recibo.
    issCartorio: 0.05,
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
  // ISS dos cartórios: 5% como em Juiz de Fora até a cidade ter regra própria cadastrada.
  return { id, nome: ajuste.cidade || 'Outra cidade de MG', uf: 'MG', itbi: { aliquota: pct / 100 }, itbiDoUsuario: true, issCartorio: 0.05 };
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
