import { z } from 'zod';
import { Resultado } from './tipos';
import { parametros } from './parametros';

/** INCC médio anual e ano-base: tabela vigente (./parametros.ts), atualizada pelo admin todo ano. */
export const indicesIncc = () => parametros().incc.indices;
export const anoBaseIncc = () => parametros().incc.anoBase;

export const entradaCorrecao = z.object({
  valorOriginal: z.coerce.number().positive(),
  anoContrato: z.coerce.number().int().refine((a) => a in indicesIncc(), () => ({ message: `Ano sem índice INCC cadastrado (até ${anoBaseIncc()})` })),
});
export type EntradaCorrecao = z.infer<typeof entradaCorrecao>;

export function calcularCorrecao(dados: EntradaCorrecao): Resultado {
  const e = entradaCorrecao.parse(dados);
  const INCC = indicesIncc();
  const ANO_BASE_INCC = anoBaseIncc();
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
