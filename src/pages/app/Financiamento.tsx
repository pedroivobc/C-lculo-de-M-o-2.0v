import { useEffect, useId, useState } from 'react';
import { PaginaCalculadora, Grade } from '@/components/calc/PaginaCalculadora';
import { Alternar, CampoMoeda, CampoNumero, EntradaMoeda, Opcoes } from '@/components/ui/Campos';
import { brl } from '@/lib/formato';
import { cn } from '@/lib/utils';
import { BotaoCustos, useCustos } from '@/hooks/useCustos';
import { FOLHAS_CONTRATO } from '@/lib/calc';

const R = (c: number) => c / 100;

function useValores() {
  const [declarado, setDeclarado] = useState(0);
  const [financiado, setFinanciado] = useState(0);
  const [primeiro, setPrimeiro] = useState(false);
  const [folhas, setFolhas] = useState(FOLHAS_CONTRATO);
  return { declarado, setDeclarado, financiado, setFinanciado, primeiro, setPrimeiro, folhas, setFolhas };
}

const pctTexto = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/**
 * Valor financiado em reais ou como cota do valor declarado (80% de R$ 125.000,00 = R$ 100.000,00).
 * O estado continua em centavos; na cota, o valor acompanha o valor declarado.
 */
export function CampoFinanciado({ declarado, financiado, onChange }: { declarado: number; financiado: number; onChange: (c: number) => void }) {
  const id = useId();
  const [modo, setModo] = useState<'valor' | 'cota'>('valor');
  const [cota, setCota] = useState('');
  const pct = Math.min(100, Number(cota.replace(',', '.')) || 0);

  useEffect(() => {
    if (modo === 'cota') onChange(Math.round((declarado * pct) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, pct, declarado]);

  const trocar = (m: 'valor' | 'cota') => {
    if (m === 'cota' && declarado && financiado) setCota(pctTexto(Math.round((financiado / declarado) * 10000) / 100));
    setModo(m);
  };
  const acima = declarado > 0 && financiado > declarado;

  return (
    <div className="flex flex-col gap-1.5 font-semibold">
      <span className="flex items-center justify-between gap-2">
        <label htmlFor={id}>Valor financiado</label>
        <span role="group" aria-label="Informar o financiamento em" className="flex rounded-full border border-linha p-0.5 text-xs">
          {([['valor', 'R$'], ['cota', '%']] as const).map(([m, r]) => (
            <button key={m} type="button" aria-pressed={modo === m} onClick={() => trocar(m)}
              className={cn('min-h-7 min-w-9 rounded-full px-2.5 font-bold', modo === m ? 'bg-tinta text-white' : 'text-suave')}>{r}</button>
          ))}
        </span>
      </span>
      <span className="flex h-12 items-center gap-2 rounded-[10px] border border-borda bg-white px-3 focus-within:border-acao focus-within:ring-2 focus-within:ring-acao/20">
        {modo === 'valor' ? (
          <>
            <span className="font-medium text-suave">R$</span>
            <EntradaMoeda id={id} centavos={financiado} onChange={onChange} className="numero w-full min-w-0 bg-transparent font-bold outline-none" />
          </>
        ) : (
          <>
            <input id={id} inputMode="decimal" autoComplete="off" placeholder="80" value={cota}
              onChange={(e) => setCota(e.target.value.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, ''))}
              className="numero w-full min-w-0 bg-transparent font-bold outline-none" />
            <span className="font-medium text-suave">%</span>
          </>
        )}
      </span>
      <span className={cn('text-xs font-medium', acima ? 'text-minas-texto' : 'text-suave')}>
        {acima ? 'O financiado não pode passar do valor declarado.'
          : modo === 'cota' ? (declarado ? `= ${brl(financiado / 100)} (${pctTexto(pct)}% de ${brl(declarado / 100)})` : 'Preencha o valor declarado para calcular a cota.')
          : declarado && financiado ? `${pctTexto(Math.round((financiado / declarado) * 10000) / 100)}% do valor declarado` : 'Ou toque em % para informar a cota (ex.: 80%).'}
      </span>
    </div>
  );
}

function CamposCompra({ s }: { s: ReturnType<typeof useValores> }) {
  return (
    <>
      <Grade>
        <CampoMoeda rotulo="Valor declarado" centavos={s.declarado} onChange={s.setDeclarado} />
        <CampoFinanciado declarado={s.declarado} financiado={s.financiado} onChange={s.setFinanciado} />
        <CampoNumero rotulo="Folhas do contrato" valor={s.folhas} onChange={(n) => s.setFolhas(Math.round(n))} />
      </Grade>
    </>
  );
}

type Modalidade = 'SBPE' | 'MCMV' | 'SFI' | 'EGI' | 'FGTS';

export function FinanciamentoCaixa() {
  const s = useValores();
  const [modalidade, setModalidade] = useState<Modalidade>('SBPE');
  const [taxa, setTaxa] = useState(1.5);
  const c = useCustos('financiamento', { fgts: modalidade === 'FGTS' });
  const sfh = modalidade === 'SBPE' || modalidade === 'MCMV';

  return (
    <PaginaCalculadora
      tipo="financiamento_caixa"
      entrada={{ modalidade, valorDeclarado: R(s.declarado), valorFinanciado: R(s.financiado), primeiroImovel: s.primeiro, folhasContrato: s.folhas || FOLHAS_CONTRATO, taxaPercent: taxa, certidoes: R(c.certidoes), honorarios: R(c.honorarios) }}
      rotulo="Financiamento Caixa"
      titulo="Custos do financiamento pela Caixa"
      descricao="Taxa da Caixa, ITBI (com a regra do SFH quando couber), prenotação, registro e arquivamento do contrato."
      tituloOrcamento={`Caixa ${modalidade}`}
      opcoes={<Opcoes rotulo="Modalidade" valor={modalidade} onChange={setModalidade}
        opcoes={[{ valor: 'SBPE', rotulo: 'SBPE' }, { valor: 'MCMV', rotulo: 'MCMV' }, { valor: 'SFI', rotulo: 'SFI' }, { valor: 'EGI', rotulo: 'EGI' }, { valor: 'FGTS', rotulo: 'FGTS total' }]} />}
    >
      <CamposCompra s={s} />
      <Grade>
        <CampoNumero rotulo="Taxa Caixa" sufixo="%" passo={0.1} valor={taxa} onChange={setTaxa} />
        <CampoMoeda rotulo="Certidões" centavos={c.certidoes} onChange={c.setCertidoes} />
        <CampoMoeda rotulo="Honorários" centavos={c.honorarios} onChange={c.setHonorarios} />
      </Grade>
      <BotaoCustos c={c} />
      {sfh && <Alternar rotulo="Primeiro imóvel do comprador" dica="50% de redução nos atos do Registro de Imóveis (SFH)" ligado={s.primeiro} onChange={s.setPrimeiro} />}
    </PaginaCalculadora>
  );
}

type Banco = 'itau' | 'bradesco' | 'santander';
const NOME_BANCO: Record<Banco, string> = { itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander' };

export function BancoPrivado() {
  const s = useValores();
  const [banco, setBanco] = useState<Banco>('itau');
  const [modalidade, setModalidade] = useState<'SBPE' | 'SFI'>('SBPE');
  const c = useCustos('financiamento');

  return (
    <PaginaCalculadora
      tipo="banco_privado"
      entrada={{ banco, modalidade, valorDeclarado: R(s.declarado), valorFinanciado: R(s.financiado), primeiroImovel: s.primeiro, folhasContrato: s.folhas || FOLHAS_CONTRATO, certidoes: R(c.certidoes), honorarios: R(c.honorarios) }}
      rotulo="Banco privado"
      titulo="Custos do financiamento em banco privado"
      descricao="Tarifa de contrato do banco, ITBI, prenotação, registro e arquivamento do contrato."
      tituloOrcamento={`${NOME_BANCO[banco]} ${modalidade}`}
      opcoes={
        <div className="flex flex-col gap-3">
          <Opcoes rotulo="Banco" valor={banco} onChange={setBanco} opcoes={(Object.keys(NOME_BANCO) as Banco[]).map((b) => ({ valor: b, rotulo: NOME_BANCO[b] }))} />
          <Opcoes rotulo="Modalidade" valor={modalidade} onChange={setModalidade} opcoes={[{ valor: 'SBPE', rotulo: 'SBPE' }, { valor: 'SFI', rotulo: 'SFI' }]} />
        </div>
      }
    >
      <CamposCompra s={s} />
      <Grade>
        <CampoMoeda rotulo="Certidões" centavos={c.certidoes} onChange={c.setCertidoes} />
        <CampoMoeda rotulo="Honorários" centavos={c.honorarios} onChange={c.setHonorarios} />
      </Grade>
      <BotaoCustos c={c} />
      {modalidade === 'SBPE' && <Alternar rotulo="Primeiro imóvel do comprador" dica="50% de redução nos atos do Registro de Imóveis (SFH)" ligado={s.primeiro} onChange={s.setPrimeiro} />}
    </PaginaCalculadora>
  );
}
