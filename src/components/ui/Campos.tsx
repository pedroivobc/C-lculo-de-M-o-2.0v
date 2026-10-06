import { useEffect, useId, useState, type ReactNode, type InputHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { centavosParaTexto, mascararDigitando, textoParaCentavos } from '@/lib/formato';
import { cn } from '@/lib/utils';

const baseCampo = 'h-12 w-full min-w-0 rounded-[10px] border border-borda bg-white px-3 font-semibold text-tinta outline-none focus:border-acao focus:ring-2 focus:ring-acao/20';

export function Campo({ rotulo, dica, className, ...props }: { rotulo: string; dica?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex flex-col gap-1.5 font-semibold', className)}>
      {rotulo}
      <input id={id} className={baseCampo} {...props} />
      {dica && <span className="text-xs font-medium text-suave">{dica}</span>}
    </label>
  );
}

/**
 * Entrada de dinheiro (R$ 000.000,00): a pessoa digita reais ("350000" vira 350.000) e, ao sair do campo,
 * o valor fica completo com os centavos ("350.000,00"). O estado de quem usa é em centavos.
 */
export function EntradaMoeda({ centavos, onChange, className, ...resto }: {
  centavos: number; onChange: (c: number) => void; className?: string; id?: string; 'aria-describedby'?: string; 'aria-label'?: string;
}) {
  const [texto, setTexto] = useState(centavos ? centavosParaTexto(centavos) : '');
  // Valor mudado por fora (ex.: limpar o formulário): mostra o novo valor.
  useEffect(() => {
    if (textoParaCentavos(texto) !== centavos) setTexto(centavos ? centavosParaTexto(centavos) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centavos]);
  return (
    <input
      {...resto}
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={texto}
      placeholder="0,00"
      onChange={(e) => { const t = mascararDigitando(e.target.value); setTexto(t); onChange(textoParaCentavos(t)); }}
      // Ao voltar ao campo, some o ",00" para dar para continuar digitando os reais.
      onFocus={() => { if (centavos && centavos % 100 === 0) setTexto(mascararDigitando(String(centavos / 100))); }}
      onBlur={() => setTexto(centavos ? centavosParaTexto(centavos) : '')}
    />
  );
}

/** Campo de dinheiro com rótulo e máscara: o valor de estado é em centavos. */
export function CampoMoeda({ rotulo, centavos, onChange, dica, className }: {
  rotulo: string; centavos: number; onChange: (c: number) => void; dica?: ReactNode; className?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex flex-col gap-1.5 font-semibold', className)}>
      {rotulo}
      <span className="flex h-12 items-center gap-2 rounded-[10px] border border-borda bg-white px-3 focus-within:border-acao focus-within:ring-2 focus-within:ring-acao/20">
        <span className="font-medium text-suave">R$</span>
        <EntradaMoeda id={id} centavos={centavos} onChange={onChange} className="numero w-full min-w-0 bg-transparent font-bold outline-none" />
      </span>
      {dica && <span className="text-xs font-medium text-suave">{dica}</span>}
    </label>
  );
}

export function CampoNumero({ rotulo, valor, onChange, sufixo, className, passo = 1 }: {
  rotulo: string; valor: number; onChange: (n: number) => void; sufixo?: string; className?: string; passo?: number;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex flex-col gap-1.5 font-semibold', className)}>
      {rotulo}
      <span className="flex h-12 items-center gap-2 rounded-[10px] border border-borda bg-white px-3 focus-within:border-acao focus-within:ring-2 focus-within:ring-acao/20">
        <input
          id={id}
          type="number"
          step={passo}
          min={0}
          className="numero w-full min-w-0 bg-transparent font-bold outline-none"
          value={Number.isFinite(valor) ? valor : ''}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {sufixo && <span className="font-medium text-suave">{sufixo}</span>}
      </span>
    </label>
  );
}

/** Grupo de opções em pílulas (uma escolhida). */
export function Opcoes<T extends string>({ rotulo, opcoes, valor, onChange }: {
  rotulo: string; opcoes: { valor: T; rotulo: string }[]; valor: T; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            'min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 font-bold transition-colors',
            o.valor === valor ? 'border-tinta bg-tinta text-white' : 'border-linha bg-white text-tinta hover:border-borda',
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Alternar({ rotulo, dica, ligado, onChange }: { rotulo: string; dica?: string; ligado: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] bg-nevoa px-3.5 py-2.5 font-semibold">
      <input id={id} type="checkbox" checked={ligado} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-acao" />
      <span className="flex flex-col">
        {rotulo}
        {dica && <span className="text-xs font-medium text-suave">{dica}</span>}
      </span>
    </label>
  );
}

type Variante = 'primario' | 'secundario' | 'escuro' | 'claro' | 'perigo';
const variantes: Record<Variante, string> = {
  primario: 'bg-acao text-white hover:bg-acao-escuro',
  secundario: 'border-[1.5px] border-borda bg-white text-tinta hover:border-tinta',
  escuro: 'bg-tinta text-white hover:bg-[#1f2b44]',
  claro: 'bg-white text-tinta hover:bg-nevoa',
  perigo: 'border border-linha bg-white text-minas-texto hover:border-minas',
};
const baseBotao = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export function Botao({ variante = 'primario', className, ...props }: { variante?: Variante } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn(baseBotao, variantes[variante], className)} {...props} />;
}

export function BotaoLink({ variante = 'primario', className, ...props }: { variante?: Variante } & LinkProps) {
  return <Link className={cn(baseBotao, 'no-underline', variantes[variante], className)} {...props} />;
}

export function Cartao({ className, children, titulo, acao }: { className?: string; children: ReactNode; titulo?: string; acao?: ReactNode }) {
  return (
    <section className={cn('rounded-2xl border border-linha bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,.04),0_4px_16px_rgba(16,24,40,.05)] sm:p-6', className)}>
      {(titulo || acao) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          {titulo && <h2 className="text-lg font-bold">{titulo}</h2>}
          {acao && <span className="shrink-0 whitespace-nowrap">{acao}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Aviso({ tom = 'amarelo', children }: { tom?: 'amarelo' | 'azul' | 'vermelho' | 'verde'; children: ReactNode }) {
  const tons = {
    amarelo: 'bg-amarelo-claro text-amarelo-texto',
    azul: 'bg-acao-claro text-acao-escuro',
    vermelho: 'bg-minas-claro text-minas-texto',
    verde: 'bg-ok-claro text-ok',
  };
  return <div role="status" className={cn('rounded-xl px-4 py-3 font-medium', tons[tom])}>{children}</div>;
}
