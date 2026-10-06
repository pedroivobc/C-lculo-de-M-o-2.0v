import { getNotaryFee } from '../../data/notaryFees';

/**
 * Regras estaduais de MG (emolumentos e ITCD). Valem para todos os municípios.
 * Lavratura (tabelionato de notas) e arquivamento; ITCD.
 */
export const MG = {
  lavratura: getNotaryFee,
  precoFolha: 13.91,
  itcd: { limiteFaixaReduzida: 440000, aliquotaReduzida: 0.025, aliquotaCheia: 0.05 },
};
// Os atos do Registro de Imóveis (Tabela 4) ficam em ./registro.ts.

export function aliquotaItcd(base: number) {
  return base <= MG.itcd.limiteFaixaReduzida ? MG.itcd.aliquotaReduzida : MG.itcd.aliquotaCheia;
}
