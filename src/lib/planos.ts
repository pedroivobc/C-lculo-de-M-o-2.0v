/**
 * Planos e preços. Fonte única para o site, o servidor e (quando entrar) a cobrança no gateway.
 * O preço base é mensal; a cobrança é trimestral (sem desconto), semestral (10%) ou anual (20%).
 */
export type Nivel = 'usuario' | 'pro';
export type Periodo = 'trimestral' | 'semestral' | 'anual';

export const PLANOS: Record<Nivel, { nome: string; mensalCentavos: number; resumo: string }> = {
  usuario: { nome: 'Essencial', mensalCentavos: 2990, resumo: 'Orçamento em PDF com a marca Orçaí' },
  pro: { nome: 'Pró', mensalCentavos: 3990, resumo: 'Orçamento com a sua logo, as suas cores e o seu contato' },
};

export const PERIODOS: Record<Periodo, { nome: string; meses: number; desconto: number; cobranca: string }> = {
  trimestral: { nome: 'Trimestral', meses: 3, desconto: 0, cobranca: 'a cada 3 meses' },
  semestral: { nome: 'Semestral', meses: 6, desconto: 0.1, cobranca: 'a cada 6 meses' },
  anual: { nome: 'Anual', meses: 12, desconto: 0.2, cobranca: 'por ano' },
};
export const ORDEM_PERIODOS: Periodo[] = ['trimestral', 'semestral', 'anual'];

const brl = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Preço de um plano num período: total cobrado e quanto sai por mês. Em centavos e já formatado. */
export function preco(nivel: Nivel, periodo: Periodo) {
  const { meses, desconto } = PERIODOS[periodo];
  const total = Math.round(PLANOS[nivel].mensalCentavos * meses * (1 - desconto));
  const porMes = Math.round(total / meses);
  return { total, porMes, totalTexto: brl(total), porMesTexto: brl(porMes), descontoTexto: desconto ? `${Math.round(desconto * 100)}% off` : '' };
}

/** Período válido vindo de URL ou banco; o padrão é o anual. */
export const lerPeriodo = (v?: string | null): Periodo => (v === 'trimestral' || v === 'semestral' || v === 'anual' ? v : 'anual');

/** Menor preço por mês (Essencial no anual), para as chamadas "a partir de". */
export const A_PARTIR_DE = preco('usuario', 'anual').porMesTexto;
