import { MessageCircle } from 'lucide-react';
import { AGENTE_WHATSAPP } from '@/lib/config';

/** Número do agente caso VITE_AGENTE_WHATSAPP não venha no build: (32) 3197-0173. */
const NUMERO_PADRAO = '553231970173';

/** Link que abre a conversa com o agente real. O agente lê o "Código" para liberar o teste grátis e marcar a origem. */
export function linkTesteWhatsapp(origem: string) {
  const mensagem = `Quero testar o Orça.ai grátis! Código: ${origem}`;
  return `https://wa.me/${AGENTE_WHATSAPP || NUMERO_PADRAO}?text=${encodeURIComponent(mensagem)}`;
}

/** Botão flutuante das páginas públicas que abre a conversa com o agente no WhatsApp. */
export function BotaoWhatsapp() {
  return (
    <a
      href={linkTesteWhatsapp('site-inicio')}
      target="_blank"
      rel="noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed right-4 bottom-4 z-50 inline-flex min-h-14 items-center gap-2 rounded-full bg-[#25d366] px-4 font-bold text-white no-underline shadow-lg transition hover:bg-[#1ebe5b] sm:right-6 sm:bottom-6 sm:px-5 print:hidden"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </a>
  );
}
