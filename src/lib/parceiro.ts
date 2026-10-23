/** Corretor parceiro sem imobiliária: fica gravado com este nome no lugar da imobiliária (filtros e planilha juntam certo). */
export const AUTONOMO = 'Autônomo';

/** "autônomo", "Autonomo", "corretor autônomo"... na planilha ou no formulário. */
export const ehAutonomo = (imobiliaria: string | null | undefined) =>
  /^(corretor\s+)?autonom[oa]$/.test((imobiliaria ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase());
