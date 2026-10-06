import { useState } from 'react';
import { PaginaCalculadora, Grade } from '@/components/calc/PaginaCalculadora';
import { CampoMoeda, CampoNumero, Opcoes } from '@/components/ui/Campos';

type Subtipo = 'doacao_simples' | 'doacao_usufruto' | 'renuncia_usufruto';
const ROTULOS: Record<Subtipo, string> = { doacao_simples: 'Doação simples', doacao_usufruto: 'Doação com usufruto', renuncia_usufruto: 'Renúncia de usufruto' };

export default function Doacao() {
  const [subtipo, setSubtipo] = useState<Subtipo>('doacao_simples');
  const [atribuido, setAtribuido] = useState(0);
  const [fazenda, setFazenda] = useState(0);
  const [folhas, setFolhas] = useState(25);
  const [certidoes, setCertidoes] = useState(40000);
  const [honorarios, setHonorarios] = useState(70000);

  return (
    <PaginaCalculadora
      tipo="doacao"
      entrada={{ subtipo, valorAtribuido: atribuido / 100, avaliacaoFazenda: fazenda / 100, folhas, certidoes: certidoes / 100, honorarios: honorarios / 100 }}
      rotulo="Doação"
      titulo="Custos da doação de imóvel"
      descricao="ITCD de Minas Gerais, lavratura, registro e arquivamento."
      tituloOrcamento={ROTULOS[subtipo].toLowerCase()}
      opcoes={<Opcoes rotulo="Tipo de doação" valor={subtipo} onChange={setSubtipo} opcoes={(Object.keys(ROTULOS) as Subtipo[]).map((s) => ({ valor: s, rotulo: ROTULOS[s] }))} />}
      avisoFormulario={<p className="rounded-xl bg-amarelo-claro px-4 py-3 text-amarelo-texto">ITCD de 2,5% até R$ 440.000,00 de base; acima disso, 5%. Na doação com usufruto, 5%.</p>}
    >
      <Grade>
        <CampoMoeda rotulo="Valor atribuído" centavos={atribuido} onChange={setAtribuido} />
        <CampoMoeda rotulo="Avaliação da Fazenda" centavos={fazenda} onChange={setFazenda} />
      </Grade>
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoNumero rotulo="Folhas" valor={folhas} onChange={setFolhas} />
        <CampoMoeda rotulo="Certidões" centavos={certidoes} onChange={setCertidoes} />
        <CampoMoeda rotulo="Honorários" centavos={honorarios} onChange={setHonorarios} />
      </div>
    </PaginaCalculadora>
  );
}
