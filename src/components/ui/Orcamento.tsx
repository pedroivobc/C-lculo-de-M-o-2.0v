import type { ReactNode } from 'react';
import type { Linha, Origem, Resultado } from '@/lib/calc';
import { brl } from '@/lib/formato';
import { MUNICIPIOS } from '@/lib/calc';
import { cn } from '@/lib/utils';

const ORIGEM: Record<Origem, { rotulo: (m: string) => string; classe: string }> = {
  municipio: { rotulo: (m) => m.toUpperCase(), classe: 'bg-minas-claro text-minas-texto' },
  uf: { rotulo: () => 'MG', classe: 'bg-acao-claro text-acao-escuro' },
  banco: { rotulo: () => 'BANCO', classe: 'bg-cinza text-texto' },
  usuario: { rotulo: () => 'VOCÊ', classe: 'bg-amarelo-claro text-amarelo-texto' },
};

export function EtiquetaOrigem({ origem, municipio, curta = false }: { origem: Origem; municipio?: string; curta?: boolean }) {
  const nome = MUNICIPIOS[municipio ?? '']?.nome ?? 'Município';
  const texto = curta && origem === 'municipio' ? 'JF' : ORIGEM[origem].rotulo(nome);
  return (
    <span className={cn('shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-extrabold leading-[14px] tracking-[0.04em]', ORIGEM[origem].classe)}>
      {texto}
    </span>
  );
}

/**
 * O orçamento picotado: peça-assinatura da identidade.
 * Cada linha mostra de onde vem o valor (município, MG, banco ou você).
 */
export function Orcamento({ titulo, resultado, rotuloTotal = 'Total estimado', carimbo = true, compacto = false, children }: {
  titulo: string;
  resultado: Resultado | null;
  rotuloTotal?: string;
  carimbo?: boolean;
  compacto?: boolean;
  children?: ReactNode;
}) {
  const municipio = resultado?.municipio && MUNICIPIOS[resultado.municipio] ? MUNICIPIOS[resultado.municipio] : null;
  return (
    <div className="relative">
      <div className={cn('rounded-t-md border border-b-0 border-linha bg-white shadow-[0_12px_32px_rgba(16,24,40,.10)]', compacto ? 'px-4 pt-4 pb-3' : 'px-6 pt-6 pb-4')}>
        <div className={cn('mb-1 flex flex-col gap-0.5 border-b-[1.5px] border-dashed border-borda pb-3', carimbo && (compacto ? 'pr-24' : 'pr-32'))}>
          <h2 className={cn('font-extrabold', compacto ? 'text-base' : 'text-lg')}>Orçamento · {titulo}</h2>
          <span className="numero text-[13px] text-suave">
            {resultado?.bases.length ? `Base de cálculo ${resultado.bases.map(brl).join(' + ')}` : 'Preencha os valores ao lado'}
          </span>
        </div>
        {resultado ? (
          <ul>
            {resultado.linhas.map((l: Linha, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-[#eef0f4] py-2.5">
                <span className="flex min-w-0 items-center gap-2">
                  <EtiquetaOrigem origem={l.origem} municipio={resultado.municipio} curta={compacto} />
                  <span className="flex flex-col">
                    <span>{l.rotulo}</span>
                    {l.nota && !compacto && <span className="text-xs text-suave">{l.nota}</span>}
                  </span>
                </span>
                <span className="numero whitespace-nowrap font-bold">{brl(l.valor)}</span>
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
          {(municipio?.nome ?? 'Minas Gerais').toUpperCase()}<br />MG · {new Date().getFullYear()}
        </div>
      )}
      {children && <div className="mt-4 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
