import { z } from 'zod';
import { parametros } from './parametros';
import type { UfPiloto } from './cartorios';

const centavos = (n: number) => Math.round(Number((n * 100).toFixed(6))) / 100;

/**
 * Regras que pertencem à prefeitura. Para abrir uma cidade nova de MG,
 * basta cadastrar uma entrada aqui (e, no banco, na tabela `municipios`).
 * Fora de MG, o estado também precisa da tabela de cartório em ./cartorios.ts.
 */
export interface Municipio {
  id: string;
  nome: string;
  uf: 'MG' | UfPiloto;
  /** Cidade em teste piloto: aparece marcada no site, no orçamento e no WhatsApp. */
  piloto?: boolean;
  itbi: {
    aliquota: number;
    /** Regra do SFH: parte financiada com alíquota reduzida até o limiar. Sem ela, vale a alíquota cheia. */
    sfh?: { limiar: number; fixoNoLimiar: number; aliquotaFinanciado: number };
    /** Regra própria do financiamento habitacional (no lugar de `sfh`), com o texto da nota. */
    financiamento?: (base: number, financiado: number) => { valor: number; regra: string };
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
      // Base do desconto do SFH: tabela vigente (./parametros.ts), atualizada pelo admin todo ano.
      get sfh() {
        const { limiarSfh, aliquotaFinanciado } = parametros().itbiJf;
        return { limiar: limiarSfh, fixoNoLimiar: Math.round(limiarSfh * aliquotaFinanciado * 100) / 100, aliquotaFinanciado };
      },
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
    // ISS de cartório em BH: 2% (Lei 8.725/2003, art. 14, § 11, incluído pela Lei 9.677/2008).
    issCartorio: 0.02,
  },

  // ---------- Piloto fora de MG (out/2026). Fontes em docs/piloto-capitais/README.md. ----------
  // São Paulo: 3%; no SFH, 0,5% sobre a parte financiada até R$ 120.968,00, para imóvel de até R$ 725.808,00 (valores de 2026).
  // A isenção da 1ª aquisição até R$ 245.527,77 depende de requerimento e não entra no cálculo automático.
  'sp-sao-paulo': {
    id: 'sp-sao-paulo',
    nome: 'São Paulo',
    uf: 'SP',
    piloto: true,
    itbi: {
      aliquota: 0.03,
      financiamento: (base, fin) => {
        if (base > 725808) return { valor: base * 0.03, regra: '3% (imóvel acima de R$ 725.808,00, sem a faixa do SFH)' };
        const faixa = Math.min(fin, 120968, base);
        return { valor: centavos(faixa * 0.005 + (base - faixa) * 0.03), regra: '0,5% sobre o financiado até R$ 120.968,00 e 3% no restante' };
      },
    },
    // ISS de 2% (Lei municipal 15.406/2011), cobrado por dentro, como nas tabelas da capital.
    issCartorio: 0.02,
  },
  // Rio de Janeiro: 3% (Lei 6.250/2017), sem redução no financiamento. ISS dos cartórios: 5% (alíquota geral, Lei 691/1984).
  'rj-rio-de-janeiro': {
    id: 'rj-rio-de-janeiro',
    nome: 'Rio de Janeiro',
    uf: 'RJ',
    piloto: true,
    itbi: { aliquota: 0.03 },
    issCartorio: 0.05,
  },
  // Brasília: 2% (Lei distrital 7.635/2024). O 1% da 1ª transmissão de imóvel novo depende de enquadramento e não entra.
  'df-brasilia': {
    id: 'df-brasilia',
    nome: 'Brasília',
    uf: 'DF',
    piloto: true,
    itbi: { aliquota: 0.02 },
    // ISS de 5% sobre o total, como na tabela 2026 da ANOREG-DF.
    issCartorio: 0.05,
  },
  // Curitiba: 2,7% (LC 40/2001). No financiamento habitacional (imóvel residencial edificado, prazo de 10 anos ou mais,
  // com alienação fiduciária ou hipoteca), a alíquota sai pelo valor do imóvel e vale sobre a base inteira (LC 148/2025).
  'pr-curitiba': {
    id: 'pr-curitiba',
    nome: 'Curitiba',
    uf: 'PR',
    piloto: true,
    itbi: {
      aliquota: 0.027,
      financiamento: (base) => {
        const a = base <= 176000 ? 0 : base <= 205000 ? 0.005 : base <= 220000 ? 0.016 : 0.027;
        return { valor: base * a, regra: `${percentual(a)} sobre o valor inteiro (faixa do financiamento habitacional)` };
      },
    },
    issCartorio: 0.04,
  },
  // Porto Alegre: 3%; no SFH, 0,5% sobre o financiado até 68.000 UFM (R$ 410.794,80 com a UFM de 2026, R$ 6,0411)
  // e 3% no restante (LC 197/1989, art. 16, redação da LC 607/2008).
  'rs-porto-alegre': {
    id: 'rs-porto-alegre',
    nome: 'Porto Alegre',
    uf: 'RS',
    piloto: true,
    itbi: {
      aliquota: 0.03,
      financiamento: (base, fin) => {
        const faixa = Math.min(fin, 410794.8, base);
        return { valor: centavos(faixa * 0.005 + (base - faixa) * 0.03), regra: '0,5% sobre o financiado até R$ 410.794,80 e 3% no restante' };
      },
    },
    // ISS de cartório não confirmado na lei municipal: usamos 5%, o teto da LC 116/2003.
    issCartorio: 0.05,
  },
  // Balneário Camboriú: 3%; no SFH, 1% sobre a parte financiada e 3% no restante (Lei municipal 4.994/2025).
  'sc-balneario-camboriu': {
    id: 'sc-balneario-camboriu',
    nome: 'Balneário Camboriú',
    uf: 'SC',
    piloto: true,
    itbi: {
      aliquota: 0.03,
      financiamento: (base, fin) => {
        const faixa = Math.min(fin, base);
        return { valor: centavos(faixa * 0.01 + (base - faixa) * 0.03), regra: '1% sobre o financiado e 3% no restante' };
      },
    },
    // ISS de 2,5% sobre os emolumentos, como na tabela 2026 do 1º Tabelionato de Balneário Camboriú.
    issCartorio: 0.025,
  },
};

/** Estados atendidos (MG inteiro e os estados das cidades do piloto). */
export const UFS_ATENDIDAS = [...new Set(Object.values(MUNICIPIOS).map((m) => m.uf))];

/** Estado do imóvel de um orçamento (orçamentos antigos não guardam o campo e são de MG). */
export const ufDoResultado = (r: { uf?: string; municipio?: string }) => r.uf ?? MUNICIPIOS[r.municipio ?? '']?.uf ?? 'MG';
export const pilotoDoResultado = (r: { piloto?: boolean; municipio?: string }) => r.piloto ?? !!MUNICIPIOS[r.municipio ?? '']?.piloto;
/** "Juiz de Fora (MG)", "São Paulo (SP) · piloto". */
export const cidadeDoResultado = (r: { municipioNome?: string; municipio?: string; uf?: string; piloto?: boolean }) =>
  `${r.municipioNome ?? MUNICIPIOS[r.municipio ?? '']?.nome ?? ''} (${ufDoResultado(r)})${pilotoDoResultado(r) ? ' · piloto' : ''}`;
/** Frase do rodapé do orçamento. */
export const avisoDasTabelas = (r: { uf?: string; municipio?: string; piloto?: boolean }) =>
  `Valores estimados com as tabelas vigentes de ${ufDoResultado(r)}${pilotoDoResultado(r) ? ' (cidade em teste piloto)' : ''}.`;

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
  if (m.itbi.financiamento && !m.itbiDoUsuario) return m.itbi.financiamento(base, financiado).valor;
  if (!m.itbi.sfh) return base * m.itbi.aliquota;
  const { limiar, fixoNoLimiar, aliquotaFinanciado } = m.itbi.sfh;
  if (financiado < limiar) {
    return (base - financiado) * m.itbi.aliquota + financiado * aliquotaFinanciado;
  }
  return (base - limiar) * m.itbi.aliquota + fixoNoLimiar;
}
