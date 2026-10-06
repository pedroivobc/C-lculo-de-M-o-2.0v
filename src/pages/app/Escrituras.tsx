import { useState } from 'react';
import { PaginaCalculadora, Grade } from '@/components/calc/PaginaCalculadora';
import { CampoMoeda, CampoNumero, Opcoes } from '@/components/ui/Campos';
import { ROTULO_SUBTIPO_ESCRITURA } from '@/lib/calc';

type Subtipo = keyof typeof ROTULO_SUBTIPO_ESCRITURA;
const R = (c: number) => c / 100;

export default function Escrituras() {
  const [subtipo, setSubtipo] = useState<Subtipo>('compra_venda_simples');
  const [v, setV] = useState<Record<string, number>>({ certidoes: 40000, honorarios: 70000 });
  const [folhas, setFolhas] = useState(25);
  const campo = (nome: string) => ({ centavos: v[nome] ?? 0, onChange: (c: number) => setV((s) => ({ ...s, [nome]: c })) });

  const comum = { folhas, certidoes: R(v.certidoes ?? 0), honorarios: R(v.honorarios ?? 0) };
  const entrada =
    subtipo === 'compra_venda_simples' ? { subtipo, valorDeclarado: R(v.valorDeclarado ?? 0), ...comum }
    : subtipo === 'interveniencia' ? { subtipo, valorDeclarado1: R(v.valorDeclarado1 ?? 0), valorDeclarado2: R(v.valorDeclarado2 ?? 0), ...comum }
    : subtipo === 'compra_vinculo' ? { subtipo, valorDeclaradoCompra: R(v.valorDeclaradoCompra ?? 0), valorVinculo: R(v.valorVinculo ?? 0), ...comum }
    : { subtipo, valorAtribuido: R(v.valorAtribuido ?? 0), avaliacaoFazenda: R(v.avaliacaoFazenda ?? 0), ...comum };

  return (
    <PaginaCalculadora
      tipo="escritura"
      entrada={entrada}
      rotulo="Escrituras"
      titulo="Calcular custos da escritura"
      descricao="A base de cálculo é o valor declarado do imóvel."
      tituloOrcamento={ROTULO_SUBTIPO_ESCRITURA[subtipo].toLowerCase()}
      opcoes={<Opcoes rotulo="Tipo de escritura" valor={subtipo} onChange={setSubtipo}
        opcoes={(Object.keys(ROTULO_SUBTIPO_ESCRITURA) as Subtipo[]).map((s) => ({ valor: s, rotulo: ROTULO_SUBTIPO_ESCRITURA[s] }))} />}
    >
      {subtipo === 'compra_venda_simples' && (
        <Grade>
          <CampoMoeda rotulo="Valor declarado" {...campo('valorDeclarado')} />
        </Grade>
      )}
      {subtipo === 'interveniencia' && (
        <>
          <Grade>
            <CampoMoeda rotulo="1º ato · valor declarado" {...campo('valorDeclarado1')} />
          </Grade>
          <Grade>
            <CampoMoeda rotulo="2º ato · valor declarado" {...campo('valorDeclarado2')} />
          </Grade>
        </>
      )}
      {subtipo === 'compra_vinculo' && (
        <Grade>
          <CampoMoeda rotulo="Compra · valor declarado" {...campo('valorDeclaradoCompra')} />
          <CampoMoeda rotulo="Valor do vínculo" {...campo('valorVinculo')} />
        </Grade>
      )}
      {(subtipo === 'doacao_simples' || subtipo === 'doacao_usufruto' || subtipo === 'renuncia_usufruto') && (
        <Grade>
          <CampoMoeda rotulo="Valor atribuído" {...campo('valorAtribuido')} />
          <CampoMoeda rotulo="Avaliação da Fazenda" {...campo('avaliacaoFazenda')} />
        </Grade>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoNumero rotulo="Folhas" valor={folhas} onChange={setFolhas} />
        <CampoMoeda rotulo="Certidões" {...campo('certidoes')} />
        <CampoMoeda rotulo="Honorários" {...campo('honorarios')} />
      </div>
    </PaginaCalculadora>
  );
}
