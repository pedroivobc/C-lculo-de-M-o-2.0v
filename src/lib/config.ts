/** Configurações públicas do front (VITE_*). */
export const MARCA = 'Orçaí Imob';

/** Número do agente no WhatsApp, só dígitos com DDI (ex.: 5532988887777). */
export const AGENTE_WHATSAPP = (import.meta.env.VITE_AGENTE_WHATSAPP ?? '').replace(/\D/g, '');

/**
 * Enquanto o pagamento online não existe, o app não bloqueia quem não tem assinatura ativa
 * (só mostra um aviso). Defina VITE_EXIGIR_ASSINATURA=true quando o pagamento entrar.
 */
export const EXIGIR_ASSINATURA = import.meta.env.VITE_EXIGIR_ASSINATURA === 'true';

export type Nivel = 'usuario' | 'pro';

/** Preços de vitrine. O anual vale 10 mensalidades (2 meses grátis). */
export const PLANOS: Record<Nivel, { nome: string; mensal: string; anual: string; anualPorMes: string; resumo: string }> = {
  usuario: { nome: 'Essencial', mensal: 'R$ 29,90', anual: 'R$ 299,00', anualPorMes: 'R$ 24,92', resumo: 'Orçamento em PDF com a marca Orçaí' },
  pro: { nome: 'Pró', mensal: 'R$ 39,90', anual: 'R$ 399,00', anualPorMes: 'R$ 33,25', resumo: 'Orçamento em PDF com a sua logo e as suas cores' },
};

/** Preço de entrada (Essencial), usado nas chamadas "a partir de". */
export const PRECO = PLANOS.usuario;

/** Teste grátis: 3 dias; com cupom de indicação, 5. Depois, o acesso bloqueia até assinar. */
export const DIAS_TESTE = 3;
export const DIAS_TESTE_INDICACAO = 5;

/** Quem opera o serviço (controlador na LGPD). CNPJ e e-mail vêm do ambiente para não ficarem fixos no código. */
export const EMPRESA = {
  nome: 'Clemente Assessoria',
  cnpj: import.meta.env.VITE_EMPRESA_CNPJ ?? '',
  emailPrivacidade: import.meta.env.VITE_EMAIL_PRIVACIDADE ?? '',
  cidade: 'Juiz de Fora, MG',
};
