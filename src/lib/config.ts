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
  usuario: { nome: 'Essencial', mensal: 'R$ 9,90', anual: 'R$ 99,00', anualPorMes: 'R$ 8,25', resumo: 'Orçamento em PDF com a marca Orçaí' },
  pro: { nome: 'Pró', mensal: 'R$ 19,90', anual: 'R$ 199,00', anualPorMes: 'R$ 16,58', resumo: 'Orçamento em PDF com a sua logo e as suas cores' },
};

/** Preço de entrada (Essencial), usado nas chamadas "a partir de". */
export const PRECO = PLANOS.usuario;
