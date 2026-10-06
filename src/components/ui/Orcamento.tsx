import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Linha, Resultado } from '@/lib/calc';
import { brl } from '@/lib/formato';
import { MUNICIPIOS } from '@/lib/calc';
import { cn } from '@/lib/utils';

/**
 * O orçamento picotado: peça-assinatura da identidade.
 */
export function Orcamento({ titulo, resultado, rotuloTotal = 'Total estimado', carimbo = true, compacto = false, children }: {
  titulo: string;
  resultado: Resultado | null;
  rotuloTotal?: string;
  carimbo?: boolean;
  compacto?: boolean;
  children?: ReactNode;
}) {
  const [detalhar, setDetalhar] = useState(false);
  const temDetalhes = !!resultado?.linhas.some((l) => l.detalhes?.length);
  const nomeCidade = resultado?.municipioNome ?? (resultado?.municipio ? MUNICIPIOS[resultado.municipio]?.nome : undefined);
  return (
    <div className="relative">
      <div className={cn('rounded-t-md border border-b-0 border-linha bg-white shadow-[0_12px_32px_rgba(16,24,40,.10)]', compacto ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4')}>
        <div className={cn('mb-1 flex flex-col gap-0.5 border-b-[1.5px] border-dashed border-borda pb-3', carimbo && (compacto ? 'pr-24' : 'pr-32'))}>
          <h2 className={cn('font-extrabold', compacto ? 'text-base' : 'text-lg')}>Orçamento · {titulo}</h2>
          <span className="numero text-[13px] text-suave">
            {resultado?.bases.length ? `Base de cálculo ${resultado.bases.map(brl).join(' + ')}` : 'Preencha os valores ao lado'}
          </span>
        </div>
        {temDetalhes && (
          <button type="button" aria-expanded={detalhar} onClick={() => setDetalhar((d) => !d)}
            className="my-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-bold text-acao hover:text-acao-escuro">
            <ChevronDown className={cn('size-4 transition-transform', detalhar && 'rotate-180')} aria-hidden="true" />
            {detalhar ? 'Ocultar detalhes' : 'Detalhar valores'}
          </button>
        )}
        {resultado ? (
          <ul>
            {resultado.linhas.map((l: Linha, i) => (
              <li key={i} className="border-b border-[#eef0f4] py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex flex-col">
                      <span>{l.rotulo}</span>
                      {l.nota && !compacto && !(detalhar && l.detalhes) && <span className="text-xs text-suave">{l.nota}</span>}
                    </span>
                  </span>
                  <span className="numero whitespace-nowrap font-bold">{brl(l.valor)}</span>
                </div>
                {detalhar && l.detalhes && (
                  <ul className="mt-2 ml-3 flex flex-col gap-1.5 border-l-2 border-linha pl-3">
                    {l.detalhes.map((d, j) => (
                      <li key={j} className="flex items-start justify-between gap-3 text-sm">
                        <span className="flex min-w-0 flex-col">
                          <span className="text-texto">{d.rotulo}</span>
                          {d.nota && !compacto && <span className="text-xs text-suave">{d.nota}</span>}
                        </span>
                        <span className="numero whitespace-nowrap font-semibold text-texto">{brl(d.valor)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-suave">Os valores aparecem aqui enquanto você digita.</p>
        )}
        <div className="flex items-baseline justify-between gap-3 pt-3.5">
          <span className="font-bold">{rotuloTotal}</span>
          <span className={cn('numero marca-texto font-black', compacto ? 'text-2xl' : 'text-[32px] leading-[38px]')}>
            {resultado ? brl(resultado.total) : 'R$ 0,00'}
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="picote" />
      {carimbo && (
        <div
          aria-hidden="true"
          className={cn(
            'display absolute rotate-[-9deg] rounded-lg border-[2.5px] border-minas text-center font-black tracking-[0.08em] text-minas opacity-90',
            compacto ? 'top-3 right-3 px-2 py-1 text-[9px] leading-[11px]' : 'top-4 right-4 px-2.5 py-1.5 text-[11px] leading-[13px]',
          )}
          style={{ fontStretch: '125%' }}
        >
          {(nomeCidade ?? 'Minas Gerais').toUpperCase()}<br />MG · {new Date().getFullYear()}
        </div>
      )}
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
