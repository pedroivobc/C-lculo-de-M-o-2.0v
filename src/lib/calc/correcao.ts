import { z } from 'zod';
import { Resultado } from './tipos';

/** INCC médio anual, igual a src/components/CorrecaoContratual.tsx. */
export const INCC: Record<number, number> = {
  1997: 30.25, 1998: 31.92, 1999: 32.45, 2000: 35.14,
  2001: 37.45, 2002: 40.30, 2003: 44.71, 2004: 49.64,
  2005: 53.23, 2006: 56.54, 2007: 58.25, 2008: 60.69,
  2009: 64.57, 2010: 67.29, 2011: 71.08, 2012: 75.80,
  2013: 79.99, 2014: 84.61, 2015: 90.16, 2016: 99.61,
  2017: 106.57, 2018: 109.55, 2019: 113.99, 2020: 117.72,
  2021: 122.79, 2022: 135.98, 2023: 144.00, 2024: 150.74,
  2025: 157.40, 2026: 165.54,
};
export const ANO_BASE_INCC = 2026;

export const entradaCorrecao = z.object({
  valorOriginal: z.coerce.number().positive(),
  anoContrato: z.coerce.number().int().refine((a) => a in INCC, 'Ano sem índice INCC cadastrado (1997 a 2026)'),
});
export type EntradaCorrecao = z.infer<typeof entradaCorrecao>;

export function calcularCorrecao(dados: EntradaCorrecao): Resultado {
  const e = entradaCorrecao.parse(dados);
  const indiceAno = INCC[e.anoContrato];
  const indiceBase = INCC[ANO_BASE_INCC];
  const corrigido = e.anoContrato === ANO_BASE_INCC ? e.valorOriginal : (e.valorOriginal / indiceAno) * indiceBase;
  const total = Math.round(corrigido * 100) / 100;
  return {
    tipo: 'correcao',
    subtipo: 'incc',
    municipio: 'n/a',
    bases: [e.valorOriginal],
    linhas: [{ rotulo: `Valor corrigido (INCC ${e.anoContrato} a ${ANO_BASE_INCC})`, valor: total, origem: 'uf' }],
    total,
    detalhes: { indiceAno, indiceBase, variacaoPercent: Math.round(((corrigido - e.valorOriginal) / e.valorOriginal) * 10000) / 100 },
  };
}
