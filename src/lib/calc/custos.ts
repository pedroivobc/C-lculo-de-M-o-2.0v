import type { TipoCalculo } from './tipos';

/**
 * Certidões e honorários: valores do próprio assinante, definidos no cadastro (etapa "Seu orçamento").
 * Um par para escrituras e doações, outro para financiamentos, porque costumam ser diferentes.
 */
export type GrupoCustos = 'escritura' | 'financiamento';
export interface Custos { certidoes: number; honorarios: number }
export type CustosPadrao = Record<GrupoCustos, Custos>;

/** Valores sugeridos pelo sistema, usados enquanto o assinante não define os seus. */
export const CUSTOS_SISTEMA: CustosPadrao = {
  escritura: { certidoes: 400, honorarios: 700 },
  financiamento: { certidoes: 260.07, honorarios: 700 },
};
/** Financiamento só com FGTS: honorários sugeridos maiores. */
export const HONORARIOS_FGTS = 1200;

export const ROTULO_GRUPO: Record<GrupoCustos, string> = { escritura: 'Escritura e doação', financiamento: 'Financiamento' };

export function grupoDoCalculo(tipo: TipoCalculo | string): GrupoCustos | null {
  if (tipo === 'escritura' || tipo === 'doacao') return 'escritura';
  if (tipo === 'financiamento_caixa' || tipo === 'banco_privado') return 'financiamento';
  return null;
}

const valorValido = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);

/** Lê o que está salvo no perfil (jsonb) e completa o que faltar com os valores do sistema. */
export function lerCustosPadrao(salvo: unknown): CustosPadrao | null {
  if (!salvo || typeof salvo !== 'object') return null;
  const s = salvo as Partial<Record<GrupoCustos, Partial<Custos>>>;
  const grupo = (g: GrupoCustos): Custos => ({
    certidoes: valorValido(s[g]?.certidoes) ?? CUSTOS_SISTEMA[g].certidoes,
    honorarios: valorValido(s[g]?.honorarios) ?? CUSTOS_SISTEMA[g].honorarios,
  });
  return { escritura: grupo('escritura'), financiamento: grupo('financiamento') };
}

/** Custos que valem para um cálculo: os do assinante ou, sem eles, os do sistema. */
export function custosDoCalculo(tipo: TipoCalculo | string, padrao: CustosPadrao | null, dados: Record<string, unknown> = {}): Custos | null {
  const g = grupoDoCalculo(tipo);
  if (!g) return null;
  if (padrao) return padrao[g];
  const fgts = tipo === 'financiamento_caixa' && dados.modalidade === 'FGTS';
  return { ...CUSTOS_SISTEMA[g], ...(fgts ? { honorarios: HONORARIOS_FGTS } : {}) };
}

/** Completa certidões e honorários que não vieram na entrada com os valores padrão do assinante. */
export function comCustos<T extends Record<string, unknown>>(tipo: TipoCalculo | string, dados: T, padrao: CustosPadrao | null): T {
  const c = custosDoCalculo(tipo, padrao, dados);
  if (!c || !padrao) return dados; // sem padrão salvo, as calculadoras usam os próprios valores sugeridos
  const informados = Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== undefined && v !== null));
  return { certidoes: c.certidoes, honorarios: c.honorarios, ...informados } as unknown as T;
}
