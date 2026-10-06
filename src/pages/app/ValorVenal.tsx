import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { PaginaCalculadora, Grade } from '@/components/calc/PaginaCalculadora';
import { Aviso, Botao, CampoNumero } from '@/components/ui/Campos';
import { extractDataFromPDF, type ExtractedData } from '@/services/geminiService';

const TIPOS = ['APTO', 'CASA', 'SALA', 'LOJA', 'TELHEIRO', 'GALPAO'] as const;
const PADROES = ['OTIMO', 'BOM', 'REGULAR', 'BAIXO', 'POPULAR'] as const;
const NOME_TIPO: Record<string, string> = { APTO: 'Apartamento', CASA: 'Casa', SALA: 'Sala', LOJA: 'Loja', TELHEIRO: 'Telheiro', GALPAO: 'Galpão' };
const NOME_PADRAO: Record<string, string> = { OTIMO: 'Ótimo', BOM: 'Bom', REGULAR: 'Regular', BAIXO: 'Baixo', POPULAR: 'Popular' };

function lerArquivo(f: File) {
  return new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1] ?? '');
    r.onerror = () => erro(new Error('Não foi possível ler o arquivo.'));
    r.readAsDataURL(f);
  });
}

export default function ValorVenal() {
  const arquivo = useRef<HTMLInputElement>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<ExtractedData | null>(null);
  const [d, setD] = useState({
    areaIsotima: '', tipo: 'APTO' as string, padrao: 'BOM' as string,
    terrenoValorVenal: 0, terrenoValorM2: 0, edificacaoValorVenal: 0, edificacaoValorM2: 0,
  });
  const muda = (k: keyof typeof d) => (v: number | string) => setD((s) => ({ ...s, [k]: v }));

  async function enviar(f: File) {
    setLendo(true); setErro(null); setNomeArquivo(f.name);
    try {
      const dados = await extractDataFromPDF(await lerArquivo(f), f.type || 'application/pdf');
      setLido(dados);
      setD({
        areaIsotima: dados.terreno.areaIsotima ?? '',
        tipo: dados.edificacao.tipo ?? 'APTO',
        padrao: dados.edificacao.padrao ?? 'BOM',
        terrenoValorVenal: dados.terreno.valorVenal ?? 0,
        terrenoValorM2: dados.terreno.valorM2 ?? 0,
        edificacaoValorVenal: dados.edificacao.valorVenal ?? 0,
        edificacaoValorM2: dados.edificacao.valorM2 ?? 0,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setLendo(false); }
  }

  return (
    <PaginaCalculadora
      tipo="valor_venal"
      entrada={d}
      rotulo="Valor venal"
      titulo="Calcular valor venal corrigido"
      descricao="Envie o espelho do IPTU da Prefeitura de Juiz de Fora. A leitura preenche os campos e você confere."
      tituloOrcamento="valor venal"
      rotuloTotal="Valor venal"
    >
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-acao-claro p-4">
        <FileUp className="size-6 text-acao" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold">{nomeArquivo ?? 'Espelho do IPTU (PDF ou foto)'}</span>
          <span className="text-xs text-acao-escuro">{lendo ? 'Lendo o arquivo…' : lido ? 'Lido · confira os campos abaixo' : 'Ou preencha à mão'}</span>
        </span>
        <input ref={arquivo} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} />
        <Botao variante="secundario" onClick={() => arquivo.current?.click()} disabled={lendo}>
          {lendo ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}{nomeArquivo ? 'Trocar arquivo' : 'Enviar espelho'}
        </Botao>
      </div>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {lido && (lido.inscricao || lido.endereco) && (
        <dl className="grid gap-3 rounded-xl bg-nevoa p-4 sm:grid-cols-2">
          <div><dt className="text-xs text-suave">Inscrição</dt><dd className="font-bold">{lido.inscricao ?? '—'}</dd></div>
          <div><dt className="text-xs text-suave">Endereço</dt><dd className="font-bold">{lido.endereco ?? '—'}</dd></div>
        </dl>
      )}
      <Grade>
        <label className="flex flex-col gap-1.5 font-semibold">Área isótima
          <input value={d.areaIsotima} onChange={(e) => muda('areaIsotima')(e.target.value.toUpperCase())} placeholder="Ex.: RE227" className="h-12 rounded-[10px] border border-borda bg-white px-3 font-semibold uppercase" />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">Tipo
          <select value={d.tipo} onChange={(e) => muda('tipo')(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3 font-semibold">
            {TIPOS.map((t) => <option key={t} value={t}>{NOME_TIPO[t]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">Padrão
          <select value={d.padrao} onChange={(e) => muda('padrao')(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3 font-semibold">
            {PADROES.map((p) => <option key={p} value={p}>{NOME_PADRAO[p]}</option>)}
          </select>
        </label>
      </Grade>
      <span className="font-bold">Valores do espelho</span>
      <Grade>
        <CampoNumero rotulo="Terreno · valor venal (R$)" valor={d.terrenoValorVenal} onChange={muda('terrenoValorVenal')} passo={0.01} />
        <CampoNumero rotulo="Terreno · valor do m² (R$)" valor={d.terrenoValorM2} onChange={muda('terrenoValorM2')} passo={0.01} />
        <CampoNumero rotulo="Edificação · valor venal (R$)" valor={d.edificacaoValorVenal} onChange={muda('edificacaoValorVenal')} passo={0.01} />
        <CampoNumero rotulo="Edificação · valor do m² (R$)" valor={d.edificacaoValorM2} onChange={muda('edificacaoValorM2')} passo={0.01} />
      </Grade>
      <p className="text-sm text-suave">As áreas saem da divisão valor venal ÷ valor do m² do espelho; o m² corrigido e o fator de comercialização vêm das tabelas da PJF.</p>
    </PaginaCalculadora>
  );
}
