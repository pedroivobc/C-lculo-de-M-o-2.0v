/**
 * Planos e preços. Fonte única para o site, o servidor e (quando entrar) a cobrança no gateway.
 * O preço base é mensal; a cobrança é trimestral (sem desconto), semestral (10%) ou anual (20%).
 */
export type Nivel = 'usuario' | 'pro';
export type Periodo = 'trimestral' | 'semestral' | 'anual';

export const PLANOS: Record<Nivel, { nome: string; mensalCentavos: number; resumo: string }> = {
  usuario: { nome: 'Starter', mensalCentavos: 2990, resumo: 'Orçamento em PDF com a marca Orça.ai, só no site' },
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

/** Menor preço por mês (Starter no anual), para as chamadas "a partir de". */
export const A_PARTIR_DE = preco('usuario', 'anual').porMesTexto;

/**
 * Plano de equipe (imobiliárias): fee fixo mensal por um pacote de usuários e um valor por usuário a mais.
 * VALORES PROVISÓRIOS: trocar quando os produtos forem criados no Stripe.
 */
export const EQUIPE = {
  nome: 'Teams',
  assentosBase: 5,
  fixoMensalCentavos: 14990,
  adicionalMensalCentavos: 2490,
  resumo: 'Para imobiliárias: todos com recursos do Pro, a logo e as cores da imobiliária',
};

/** Mensalidade de uma equipe com `usuarios` ativos. Clemente Team não é cobrada. */
export function precoEquipe(usuarios: number, assentosBase: number = EQUIPE.assentosBase) {
  const adicionais = Math.max(0, usuarios - assentosBase);
  const mensal = EQUIPE.fixoMensalCentavos + adicionais * EQUIPE.adicionalMensalCentavos;
  return {
    adicionais, mensal, mensalTexto: brl(mensal),
    fixoTexto: brl(EQUIPE.fixoMensalCentavos), adicionalTexto: brl(EQUIPE.adicionalMensalCentavos),
  };
}

/** Os seis perfis de usuário. `usuario` é o Starter (nome antigo no banco). */
export type Papel = 'admin' | 'teams' | 'usuario' | 'pro' | 'trial' | 'clemente';
export const NOME_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  teams: 'Teams',
  usuario: 'Starter',
  pro: 'Pró',
  trial: 'Trial',
  clemente: 'Clemente Team',
};

/** Starter não usa o agente do WhatsApp; os demais perfis usam. */
export const usaWhatsapp = (papel?: Papel | null) => papel !== 'usuario';
