import { useState } from 'react';
import { PaginaCalculadora, Grade } from '@/components/calc/PaginaCalculadora';
import { Alternar, CampoMoeda, CampoNumero, Opcoes } from '@/components/ui/Campos';

const R = (c: number) => c / 100;

function useValores() {
  const [declarado, setDeclarado] = useState(0);
  const [venal, setVenal] = useState(0);
  const [financiado, setFinanciado] = useState(0);
  const [primeiro, setPrimeiro] = useState(false);
  const [certidoes, setCertidoes] = useState(26007);
  return { declarado, setDeclarado, venal, setVenal, financiado, setFinanciado, primeiro, setPrimeiro, certidoes, setCertidoes };
}

function CamposCompra({ s }: { s: ReturnType<typeof useValores> }) {
  return (
    <>
      <Grade>
        <CampoMoeda rotulo="Valor declarado" centavos={s.declarado} onChange={s.setDeclarado} />
        <CampoMoeda rotulo="Valor venal corrigido" centavos={s.venal} onChange={s.setVenal} />
        <CampoMoeda rotulo="Valor financiado" centavos={s.financiado} onChange={s.setFinanciado} />
        <CampoMoeda rotulo="Certidões" centavos={s.certidoes} onChange={s.setCertidoes} />
      </Grade>
    </>
  );
}

type Modalidade = 'SBPE' | 'MCMV' | 'SFI' | 'EGI' | 'FGTS';

export function FinanciamentoCaixa() {
  const s = useValores();
  const [modalidade, setModalidade] = useState<Modalidade>('SBPE');
  const [taxa, setTaxa] = useState(1.5);
  const [honorarios, setHonorarios] = useState<number | null>(null);
  const honorariosPadrao = modalidade === 'FGTS' ? 120000 : 70000;
  const sfh = modalidade === 'SBPE' || modalidade === 'MCMV';

  return (
    <PaginaCalculadora
      tipo="financiamento_caixa"
      entrada={{ modalidade, valorDeclarado: R(s.declarado), valorVenal: R(s.venal), valorFinanciado: R(s.financiado), primeiroImovel: s.primeiro, taxaPercent: taxa, certidoes: R(s.certidoes), honorarios: R(honorarios ?? honorariosPadrao) }}
      rotulo="Financiamento Caixa"
      titulo="Custos do financiamento pela Caixa"
      descricao="Taxa da Caixa, ITBI (com a regra do SFH quando couber), prenotação e registro do contrato."
      tituloOrcamento={`Caixa ${modalidade}`}
      opcoes={<Opcoes rotulo="Modalidade" valor={modalidade} onChange={(m) => { setModalidade(m); setHonorarios(null); }}
        opcoes={[{ valor: 'SBPE', rotulo: 'SBPE' }, { valor: 'MCMV', rotulo: 'MCMV' }, { valor: 'SFI', rotulo: 'SFI' }, { valor: 'EGI', rotulo: 'EGI' }, { valor: 'FGTS', rotulo: 'FGTS total' }]} />}
    >
      <CamposCompra s={s} />
      <Grade>
        <CampoNumero rotulo="Taxa Caixa" sufixo="%" passo={0.1} valor={taxa} onChange={setTaxa} />
        <CampoMoeda rotulo="Honorários" centavos={honorarios ?? honorariosPadrao} onChange={setHonorarios} />
      </Grade>
      {sfh && <Alternar rotulo="Primeiro imóvel do comprador" dica="Registro com redução de 50% (média das lavraturas)" ligado={s.primeiro} onChange={s.setPrimeiro} />}
    </PaginaCalculadora>
  );
}

type Banco = 'itau' | 'bradesco' | 'santander';
const NOME_BANCO: Record<Banco, string> = { itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander' };

export function BancoPrivado() {
  const s = useValores();
  const [banco, setBanco] = useState<Banco>('itau');
  const [modalidade, setModalidade] = useState<'SBPE' | 'SFI'>('SBPE');
  const [honorarios, setHonorarios] = useState(70000);

  return (
    <PaginaCalculadora
      tipo="banco_privado"
      entrada={{ banco, modalidade, valorDeclarado: R(s.declarado), valorVenal: R(s.venal), valorFinanciado: R(s.financiado), primeiroImovel: s.primeiro, certidoes: R(s.certidoes), honorarios: R(honorarios) }}
      rotulo="Banco privado"
      titulo="Custos do financiamento em banco privado"
      descricao="Tarifa de contrato do banco, ITBI, prenotação e registro da alienação fiduciária."
      tituloOrcamento={`${NOME_BANCO[banco]} ${modalidade}`}
      opcoes={
        <div className="flex flex-col gap-3">
          <Opcoes rotulo="Banco" valor={banco} onChange={setBanco} opcoes={(Object.keys(NOME_BANCO) as Banco[]).map((b) => ({ valor: b, rotulo: NOME_BANCO[b] }))} />
          <Opcoes rotulo="Modalidade" valor={modalidade} onChange={setModalidade} opcoes={[{ valor: 'SBPE', rotulo: 'SBPE' }, { valor: 'SFI', rotulo: 'SFI' }]} />
        </div>
      }
    >
      <CamposCompra s={s} />
      <CampoMoeda rotulo="Honorários" centavos={honorarios} onChange={setHonorarios} />
      {modalidade === 'SBPE' && <Alternar rotulo="Primeiro imóvel do comprador" dica="Desmarcado: o registro soma as duas lavraturas" ligado={s.primeiro} onChange={s.setPrimeiro} />}
    </PaginaCalculadora>
  );
}
