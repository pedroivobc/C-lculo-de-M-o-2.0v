import { getNotaryFee } from '../../data/notaryFees';

/**
 * Regras estaduais de MG (emolumentos e ITCD). Valem para todos os municípios.
 * Valores copiados das telas atuais; a seção 3.4 do plano lista o que precisa ser conferido.
 */
export const MG = {
  lavratura: getNotaryFee,
  precoFolha: 13.91,
  prenotacao: 66.67,
  adicionalRegistroFinanciamento: 247.48,
  itcd: { limiteFaixaReduzida: 440000, aliquotaReduzida: 0.025, aliquotaCheia: 0.05 },
  /** Escrituras.tsx usa 496,74 / 248,37; Doacao.tsx usa 335,52 / 168,26. */
  registroEscritura: { base: 496.74, reduzido: 248.37 },
  registroDoacao: { base: 335.52, reduzido: 168.26 },
  registroRenunciaUsufruto: 500,
};

export function aliquotaItcd(base: number) {
  return base <= MG.itcd.limiteFaixaReduzida ? MG.itcd.aliquotaReduzida : MG.itcd.aliquotaCheia;
}
