/** Configurações públicas do front (VITE_*). */
export const MARCA = 'Orça.ai Imob';

/** Número do agente no WhatsApp, só dígitos com DDI (ex.: 5532988887777). */
export const AGENTE_WHATSAPP = (import.meta.env.VITE_AGENTE_WHATSAPP ?? '').replace(/\D/g, '');

/**
 * Enquanto o pagamento online não existe, o app não bloqueia quem não tem assinatura ativa
 * (só mostra um aviso). Defina VITE_EXIGIR_ASSINATURA=true quando o pagamento entrar.
 */
export const EXIGIR_ASSINATURA = import.meta.env.VITE_EXIGIR_ASSINATURA === 'true';

export { A_PARTIR_DE, DIAS_ARREPENDIMENTO, EQUIPE, LANCAMENTO_TEXTO, NOME_PAPEL, OFERTA_LANCAMENTO, ORDEM_PERIODOS, PERIODOS, PLANOS, UNLIMITED, cobranca, formasDoPeriodo, lerPeriodo, preco, precoEquipe, usaWhatsapp, type Forma, type Nivel, type Papel, type Periodo } from './planos';

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
