import { MessageCircle } from 'lucide-react';
import { AGENTE_WHATSAPP } from '@/lib/config';

/** Número do agente caso VITE_AGENTE_WHATSAPP não venha no build: (32) 3197-0173. */
const NUMERO_PADRAO = '553231970173';
/** O agente reconhece o código e libera o teste grátis; "site-inicio" marca a origem. */
const MENSAGEM = 'Quero testar o Orça.ai grátis! Código: site-inicio';

/** Botão flutuante das páginas públicas que abre a conversa com o agente no WhatsApp. */
export function BotaoWhatsapp() {
  const numero = AGENTE_WHATSAPP || NUMERO_PADRAO;
  return (
    <a
      href={`https://wa.me/${numero}?text=${encodeURIComponent(MENSAGEM)}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-4 right-4 z-50 inline-flex min-h-14 items-center gap-2 rounded-full bg-[#25d366] px-4 font-bold text-white no-underline shadow-lg transition hover:bg-[#1ebe5b] sm:bottom-6 sm:right-6 sm:px-5"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </a>
  );
}
