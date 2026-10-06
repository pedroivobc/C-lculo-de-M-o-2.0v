import { useId, useState } from 'react';
import { PaginaCalculadora, useResultado } from '@/components/calc/PaginaCalculadora';
import { CampoMoeda } from '@/components/ui/Campos';
import { INCC, ANO_BASE_INCC } from '@/lib/calc/correcao';

const ANOS = Object.keys(INCC).map(Number).sort((a, b) => b - a);
const MAX = INCC[ANO_BASE_INCC];

export default function Correcao() {
  const [valor, setValor] = useState(0);
  const [ano, setAno] = useState(2015);
  const id = useId();
  const entrada = { valorOriginal: valor / 100, anoContrato: ano };
  const r = useResultado('correcao', entrada);

  return (
    <PaginaCalculadora
      tipo="correcao"
      entrada={entrada}
      rotulo="Correção contratual"
      titulo="Corrigir valor de contrato pelo INCC"
      descricao={`Atualize o valor de compra de um contrato antigo até o índice de ${ANO_BASE_INCC}.`}
      tituloOrcamento="correção INCC"
      rotuloTotal="Valor corrigido"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoMoeda rotulo="Valor de compra original" centavos={valor} onChange={setValor} />
        <label htmlFor={id} className="flex flex-col gap-1.5 font-semibold">
          Ano do contrato
          <select id={id} value={ano} onChange={(e) => setAno(Number(e.target.value))} className="h-12 rounded-[10px] border border-borda bg-white px-3 font-semibold">
            {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-bold">INCC do ano escolhido e de {ANO_BASE_INCC}</span>
        {[ano, ANO_BASE_INCC].map((a, i) => (
          <div key={a + '-' + i} className="flex items-center gap-3">
            <span className="w-10 text-suave">{a}</span>
            <span className="h-2.5 rounded-full bg-acao" style={{ width: `calc((100% - 110px) * ${INCC[a] / MAX})` }} />
            <span className="numero font-semibold">{INCC[a].toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
        ))}
        {r?.detalhes && <span className="mt-1 font-bold text-ok">Variação no período: +{Number(r.detalhes.variacaoPercent).toLocaleString('pt-BR')}%</span>}
      </div>
    </PaginaCalculadora>
  );
}
