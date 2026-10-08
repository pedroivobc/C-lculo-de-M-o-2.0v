import { cn } from '@/lib/utils';

/** Símbolo Orçaí: recibo picotado com o total marcado em amarelo. */
export function Simbolo({ tamanho = 36, invertido = false, redondo = false, detalhado = true, className }: {
  tamanho?: number; invertido?: boolean; redondo?: boolean; detalhado?: boolean; className?: string;
}) {
  const fundo = invertido ? '#ffffff' : '#2342d6';
  const papel = invertido ? '#2342d6' : '#ffffff';
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 64 64" aria-hidden="true" className={cn('shrink-0', className)}>
      {redondo ? <circle cx="32" cy="32" r="32" fill={fundo} /> : <rect width="64" height="64" rx="15" fill={fundo} />}
      <path d="M18 11H46V51L42 47L38 51L34 47L30 51L26 47L22 51L18 47Z" fill={papel} />
      {detalhado && tamanho >= 32 && (
        <>
          <rect x="23" y="18" width="18" height="3" rx="1.5" fill={invertido ? '#8a9cf0' : '#afc0f5'} />
          <rect x="23" y="24" width="12" height="3" rx="1.5" fill={invertido ? '#8a9cf0' : '#afc0f5'} />
        </>
      )}
      <rect x="21" y="32" width="22" height="9" rx="2" fill="#ffd24a" />
      <rect x="24" y="35" width="16" height="3" rx="1.5" fill="#101828" />
    </svg>
  );
}

/** Assinatura "orçaí" + etiqueta da vertical. */
export function Lockup({ tamanho = 24, escuro = false, vertical = 'IMOB', comSimbolo = true }: {
  tamanho?: number; escuro?: boolean; vertical?: string | null; comSimbolo?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label={vertical ? `Orça.ai ${vertical}` : 'Orça.ai'} role="img">
      {comSimbolo && <Simbolo tamanho={Math.round(tamanho * 1.45)} invertido={escuro} />}
      <span className="inline-flex items-center gap-[0.3em]" aria-hidden="true">
        <span
          className={cn('display font-black leading-none', escuro ? 'text-white' : 'text-tinta')}
          style={{ fontSize: tamanho, letterSpacing: '-0.05em' }}
        >
          orça<span className={escuro ? 'text-marca-texto' : 'text-acao'}>.ai</span>
        </span>
        {vertical && (
          <span
            className={cn('display font-extrabold leading-none tracking-[0.1em] rounded-[5px]', escuro ? 'bg-marca-texto text-tinta' : 'bg-tinta text-white')}
            style={{ fontSize: Math.max(9, Math.round(tamanho * 0.45)), padding: '0.35em 0.5em 0.28em' }}
          >
            {vertical}
          </span>
        )}
      </span>
    </span>
  );
}
