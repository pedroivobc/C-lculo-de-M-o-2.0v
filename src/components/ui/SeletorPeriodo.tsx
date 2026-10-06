import { ORDEM_PERIODOS, PERIODOS, type Periodo } from '@/lib/config';
import { cn } from '@/lib/utils';

/** Trimestral, semestral (10% off) ou anual (20% off). */
export function SeletorPeriodo({ periodo, onChange, className }: { periodo: Periodo; onChange: (p: Periodo) => void; className?: string }) {
  return (
    <div role="group" aria-label="Período" className={cn('grid grid-cols-3 gap-1 rounded-xl bg-cinza p-1', className)}>
      {ORDEM_PERIODOS.map((p) => (
        <button key={p} type="button" aria-pressed={periodo === p} onClick={() => onChange(p)}
          className={cn('flex min-h-12 flex-col items-center justify-center rounded-[9px] px-1 font-bold leading-tight', periodo === p ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>
          {PERIODOS[p].nome}
          {PERIODOS[p].desconto > 0 && <span className="text-[11px] font-extrabold text-ok">{Math.round(PERIODOS[p].desconto * 100)}% off</span>}
        </button>
      ))}
    </div>
  );
}
