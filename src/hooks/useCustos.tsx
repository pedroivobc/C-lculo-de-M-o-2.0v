import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Wand2 } from 'lucide-react';
import { custosDoCalculo, lerCustosPadrao, type GrupoCustos } from '@/lib/calc';
import { brl } from '@/lib/formato';
import { useConta } from './useConta';

/**
 * Certidões e honorários de uma calculadora, em centavos. Começam com os valores padrão do assinante
 * (definidos em "Seu orçamento") e podem ser trocados; `preencher` volta aos valores padrão.
 */
export function useCustos(grupo: GrupoCustos, opcoes: { fgts?: boolean } = {}) {
  const { perfil } = useConta();
  const salvo = lerCustosPadrao(perfil?.custos_padrao);
  const tipo = grupo === 'escritura' ? 'escritura' : 'financiamento_caixa';
  const reais = custosDoCalculo(tipo, salvo, { modalidade: opcoes.fgts ? 'FGTS' : undefined })!;
  const padrao = { certidoes: Math.round(reais.certidoes * 100), honorarios: Math.round(reais.honorarios * 100) };

  const [certidoes, setCertidoes] = useState(padrao.certidoes);
  const [honorarios, setHonorarios] = useState(padrao.honorarios);
  const mexeu = useRef(false);

  // O perfil chega depois da primeira tela (e o FGTS muda o sugerido): preenche enquanto a pessoa não mexeu.
  useEffect(() => {
    if (mexeu.current) return;
    setCertidoes(padrao.certidoes);
    setHonorarios(padrao.honorarios);
  }, [padrao.certidoes, padrao.honorarios]);

  return {
    certidoes, honorarios, padrao, temPadraoProprio: !!salvo,
    setCertidoes: (c: number) => { mexeu.current = true; setCertidoes(c); },
    setHonorarios: (c: number) => { mexeu.current = true; setHonorarios(c); },
    preencher: () => { mexeu.current = false; setCertidoes(padrao.certidoes); setHonorarios(padrao.honorarios); },
  };
}

/** Botão que preenche certidões e honorários com os valores padrão do assinante. */
export function BotaoCustos({ c }: { c: ReturnType<typeof useCustos> }) {
  const iguais = c.certidoes === c.padrao.certidoes && c.honorarios === c.padrao.honorarios;
  const valores = `Certidões ${brl(c.padrao.certidoes / 100)} · Honorários ${brl(c.padrao.honorarios / 100)}`;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {iguais ? (
        <span className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-suave">
          <Check className="size-4 text-ok" aria-hidden="true" />
          {c.temPadraoProprio ? 'Usando os seus valores padrão' : 'Usando os valores sugeridos'}
        </span>
      ) : (
        <button type="button" onClick={c.preencher}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border-[1.5px] border-borda bg-white px-4 font-bold text-tinta hover:border-tinta">
          <Wand2 className="size-4" aria-hidden="true" />Preencher com meus valores
        </button>
      )}
      <span className="text-xs text-suave">{valores}{!c.temPadraoProprio && <> · <Link to="/app/conta" className="font-bold text-acao">definir os meus</Link></>}</span>
    </div>
  );
}
