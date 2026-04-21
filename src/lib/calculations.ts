export const LIMIAR_ITBI_SFH = 107603.17;
export const ITBI_FIXO_LIMIAR = 538.02;

export const calcularITBI_SFH = (base: number, financiado: number): number => {
  if (financiado < LIMIAR_ITBI_SFH) {
    return (base - financiado) * 0.02 + financiado * 0.005;
  } else {
    return (base - LIMIAR_ITBI_SFH) * 0.02 + ITBI_FIXO_LIMIAR;
  }
};
