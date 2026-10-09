/**
 * Planos e preços. Fonte única para o site, o servidor e a cobrança na Stripe.
 * Não existe plano mensal: os planos são trimestral (preço cheio), semestral (10% off) e anual (20% off).
 * No cartão, todo plano é cobrado mês a mês, com fidelidade do período; depois renova no mesmo plano.
 * No Pix, só o anual, pago de uma vez.
 */
export type Nivel = 'usuario' | 'pro';
export type Periodo = 'trimestral' | 'semestral' | 'anual';
export type Forma = 'cartao' | 'pix';

export const PLANOS: Record<Nivel, { nome: string; mensalCentavos: number; resumo: string }> = {
  usuario: { nome: 'Starter', mensalCentavos: 2990, resumo: 'Orçamento em PDF com a marca Orça.ai, só no site' },
  pro: { nome: 'Pró', mensalCentavos: 3990, resumo: 'Orçamento com a sua logo, as suas cores e o seu contato' },
};

export const PERIODOS: Record<Periodo, { nome: string; meses: number; desconto: number; cobranca: string }> = {
  trimestral: { nome: 'Trimestral', meses: 3, desconto: 0, cobranca: 'fidelidade de 3 meses' },
  semestral: { nome: 'Semestral', meses: 6, desconto: 0.1, cobranca: 'fidelidade de 6 meses' },
  anual: { nome: 'Anual', meses: 12, desconto: 0.2, cobranca: 'fidelidade de 12 meses' },
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

/**
 * Plano Fundador (oferta de lançamento): Pró anual a R$ 9,90/mês, só para os primeiros corretores.
 * Teste de 3 dias com o cartão já cadastrado (a Stripe cobra no 4º dia) e fidelidade de 12 meses.
 * A renovação depois do 1º ano ainda não foi definida: não prometer preço no site.
 */
export const OFERTA_LANCAMENTO = {
  nome: 'Plano Fundador',
  nivel: 'pro' as Nivel,
  mensalCentavos: 990,
  vagas: 20,
  diasTeste: 3,
  fidelidadeMeses: 12,
};

/** Direito de arrependimento (CDC, art. 49): nos 7 primeiros dias o cancelamento é imediato e o valor pago volta. */
export const DIAS_ARREPENDIMENTO = 7;
export const LANCAMENTO_TEXTO = brl(OFERTA_LANCAMENTO.mensalCentavos);

/** Formas aceitas em cada período: Pix só no anual. */
export const formasDoPeriodo = (periodo: Periodo): Forma[] => (periodo === 'anual' ? ['cartao', 'pix'] : ['cartao']);

/**
 * O que a Stripe cobra: no cartão, a parcela mensal (preço por mês do período) durante a fidelidade;
 * no Pix, o total do ano de uma vez. Em centavos.
 */
export function cobranca(nivel: Nivel, periodo: Periodo, forma: Forma) {
  if (forma === 'pix' && periodo !== 'anual') throw new Error('O Pix vale só para o plano anual.');
  const p = preco(nivel, periodo);
  return forma === 'pix'
    ? { centavos: p.total, texto: `${p.totalTexto} à vista no Pix`, recorrente: false as const }
    : { centavos: p.porMes, texto: `${p.porMesTexto}/mês no cartão, ${PERIODOS[periodo].cobranca}`, recorrente: true as const };
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

/**
 * Valor de uma equipe com `usuarios` ativos. Como nos planos individuais, o preço base é por mês e a cobrança
 * é trimestral, semestral (10% off) ou anual (20% off): não existe plano mensal. Clemente Team não é cobrada.
 */
export function precoEquipe(usuarios: number, assentosBase: number = EQUIPE.assentosBase) {
  const adicionais = Math.max(0, usuarios - assentosBase);
  const mensal = EQUIPE.fixoMensalCentavos + adicionais * EQUIPE.adicionalMensalCentavos;
  const periodos = Object.fromEntries(ORDEM_PERIODOS.map((p) => {
    const total = Math.round(mensal * PERIODOS[p].meses * (1 - PERIODOS[p].desconto));
    return [p, { total, totalTexto: brl(total) }];
  })) as Record<Periodo, { total: number; totalTexto: string }>;
  return {
    adicionais, mensal, mensalTexto: brl(mensal), periodos,
    fixoTexto: brl(EQUIPE.fixoMensalCentavos), adicionalTexto: brl(EQUIPE.adicionalMensalCentavos),
  };
}

/** Plano interno do administrador: acesso completo a tudo, sem cobrança e sem data para acabar (não está à venda). */
export const UNLIMITED = { nome: 'Unlimited', resumo: 'Acesso completo a tudo, sem cobrança e sem data para acabar' };

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
