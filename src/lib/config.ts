/** Configurações públicas do front (VITE_*). */
export const MARCA = 'Orçaí Imob';

/** Número do agente no WhatsApp, só dígitos com DDI (ex.: 5532988887777). */
export const AGENTE_WHATSAPP = (import.meta.env.VITE_AGENTE_WHATSAPP ?? '').replace(/\D/g, '');

/**
 * Enquanto o pagamento online não existe, o app não bloqueia quem não tem assinatura ativa
 * (só mostra um aviso). Defina VITE_EXIGIR_ASSINATURA=true quando o pagamento entrar.
 */
export const EXIGIR_ASSINATURA = import.meta.env.VITE_EXIGIR_ASSINATURA === 'true';

export const PRECO = { mensal: 'R$ 9,90', anual: 'R$ 99,00', anualPorMes: 'R$ 8,25' };
