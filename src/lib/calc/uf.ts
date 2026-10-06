/**
 * ITCD de MG. Vale para todos os municípios.
 */
export const MG = {
  itcd: { limiteFaixaReduzida: 440000, aliquotaReduzida: 0.025, aliquotaCheia: 0.05 },
};
// Emolumentos: tabelionato de notas em ./notas.ts, Registro de Imóveis em ./registro.ts.

export function aliquotaItcd(base: number) {
  return base <= MG.itcd.limiteFaixaReduzida ? MG.itcd.aliquotaReduzida : MG.itcd.aliquotaCheia;
}
