import { Fragment, useEffect, useState, type ChangeEvent } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useConta } from '@/hooks/useConta';
import { Aviso, Botao, Campo, Cartao } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

type Tipo = 'emolumentos' | 'incc' | 'itbiJf';
interface Versao { id: string; tipo: Tipo; ano: number; vigencia_inicio: string; created_at: string; emVigor: boolean; futura: boolean }
interface Estado {
  tipos: Record<Tipo, { nome: string }>;
  vigentes: Record<Tipo, { ano: number; vigenciaInicio: string | null }>;
  versoes: Versao[];
}
interface Previa {
  linhas: { item: string; antes: string; depois: string; variacao: number }[];
  avisos: string[];
  variacao: { minima: number; maxima: number; media: number } | null;
}

const PASSOS: Record<Tipo, string> = {
  emolumentos: 'Saiu a portaria do TJMG com a tabela nova: baixe a planilha, troque emolumento bruto e TFJ de cada faixa e dos atos fixos e envie.',
  incc: 'Saiu o INCC do ano: baixe a planilha, acrescente a linha do ano novo com o índice e envie.',
  itbiJf: 'A Prefeitura de Juiz de Fora atualizou o limite do SFH: baixe a planilha, troque o valor e envie.',
};

const dataBr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR');
const pctTexto = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

/** Lê o arquivo escolhido como base64 (sem o prefixo data:). */
const paraBase64 = (f: File) => new Promise<string>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] ?? '');
  r.onerror = () => erro(new Error('Não foi possível ler o arquivo.'));
  r.readAsDataURL(f);
});

/** Admin → Tabelas anuais: atualizar emolumentos, INCC e ITBI de JF por planilha, com prévia antes de publicar. */
export default function AdminTabelas() {
  const { perfil } = useConta();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => { api<Estado>('/api/admin/tabelas').then(setEstado).catch((e) => setErro(e.message)); }, []);

  if (perfil && perfil.papel !== 'admin') return <Aviso tom="vermelho">Área restrita ao administrador.</Aviso>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Administrador</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Tabelas anuais</h1>
        <p className="max-w-[720px] text-suave">
          Todo ano: baixe a planilha da tabela em vigor, troque os valores, envie como a do ano novo e escolha a data em que passa a valer.
          Antes de publicar, o sistema confere a planilha e mostra quanto cada valor mudou. Os cálculos do site e do WhatsApp passam a usar a tabela nova na data escolhida, sozinhos.
        </p>
      </header>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {!estado ? <span className="text-suave">Carregando…</span> : (
        (Object.keys(estado.tipos) as Tipo[]).map((tipo) => (
          <Fragment key={tipo}><CartaoTabela tipo={tipo} estado={estado} aoMudar={setEstado} /></Fragment>
        ))
      )}
    </div>
  );
}

function CartaoTabela({ tipo, estado, aoMudar }: { tipo: Tipo; estado: Estado; aoMudar: (e: Estado) => void }) {
  const vigente = estado.vigentes[tipo];
  const proximoAno = Math.max(vigente.ano, ...estado.versoes.filter((v) => v.tipo === tipo).map((v) => v.ano)) + 1;
  const [ano, setAno] = useState(String(proximoAno));
  const [vigencia, setVigencia] = useState(`${proximoAno}-01-01`);
  const [arquivo, setArquivo] = useState<{ nome: string; base64: string } | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);
  const versoes = estado.versoes.filter((v) => v.tipo === tipo);

  async function baixar() {
    setOcupado('baixar'); setAviso(null);
    try {
      const { data } = await supabase.auth.getSession();
      const r = await fetch(`/api/admin/tabelas/${tipo}/planilha`, { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro ?? 'Não foi possível baixar.');
      const nome = /filename="([^"]+)"/.exec(r.headers.get('content-disposition') ?? '')?.[1] ?? `${tipo}.xlsx`;
      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: nome });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(null); }
  }

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setPrevia(null); setAviso(null);
    if (!/\.xlsx$/i.test(f.name)) return setAviso({ tom: 'vermelho', texto: 'Envie a planilha em .xlsx (no Google Planilhas: Arquivo → Fazer download → .xlsx).' });
    const base64 = await paraBase64(f);
    setArquivo({ nome: f.name, base64 });
    await conferir(base64);
  }

  const corpo = (base64: string) => ({ arquivo: base64, ano: Number(ano), vigenciaInicio: vigencia });

  async function conferir(base64 = arquivo?.base64) {
    if (!base64) return;
    setOcupado('previa'); setAviso(null); setPrevia(null);
    try { setPrevia(await api<Previa>(`/api/admin/tabelas/${tipo}/previa`, { corpo: corpo(base64) })); }
    catch (e) { setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(null); }
  }

  async function publicar() {
    if (!arquivo) return;
    setOcupado('publicar'); setAviso(null);
    try {
      const r = await api<Pick<Estado, 'vigentes' | 'versoes'>>(`/api/admin/tabelas/${tipo}/publicar`, { corpo: corpo(arquivo.base64) });
      aoMudar({ ...estado, ...r });
      setArquivo(null); setPrevia(null);
      setAviso({ tom: 'verde', texto: `Tabela de ${ano} publicada. Passa a valer em ${dataBr(vigencia)}.` });
    } catch (e) { setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(null); }
  }

  async function remover(v: Versao) {
    if (!window.confirm(`Remover a tabela de ${v.ano} (vigência ${dataBr(v.vigencia_inicio)})? Os cálculos voltam para a versão anterior.`)) return;
    setOcupado('remover'); setAviso(null);
    try { aoMudar({ ...estado, ...(await api<Pick<Estado, 'vigentes' | 'versoes'>>(`/api/admin/tabelas/versao/${v.id}`, { metodo: 'DELETE' })) }); }
    catch (e) { setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) }); }
    finally { setOcupado(null); }
  }

  return (
    <Cartao titulo={estado.tipos[tipo].nome}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">
            Em vigor: <strong>{vigente.ano}</strong>{vigente.vigenciaInicio ? ` · desde ${dataBr(vigente.vigenciaInicio)}` : ' · tabela original do sistema'}
          </span>
          <Botao variante="secundario" onClick={baixar} disabled={!!ocupado}><Download className="size-5" aria-hidden="true" />{ocupado === 'baixar' ? 'Baixando…' : `Baixar planilha de ${vigente.ano}`}</Botao>
        </div>
        <p className="text-sm text-suave">{PASSOS[tipo]}</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Ano da tabela nova" inputMode="numeric" value={ano} maxLength={4}
            onChange={(e) => { const a = e.target.value.replace(/\D/g, ''); setAno(a); if (a.length === 4) setVigencia(`${a}-01-01`); setPrevia(null); }} />
          <Campo rotulo="Passa a valer em" type="date" value={vigencia} onChange={(e) => { setVigencia(e.target.value); setPrevia(null); }} />
          <label className="flex flex-col gap-1.5 font-semibold">
            Planilha preenchida
            <span className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-borda bg-white px-3 text-sm font-bold hover:border-tinta">
              <Upload className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{arquivo?.nome ?? 'Escolher .xlsx'}</span>
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={escolher} />
            </span>
          </label>
        </div>
        {arquivo && !previa && !ocupado && <Botao variante="secundario" onClick={() => conferir()}>Conferir de novo</Botao>}
        {ocupado === 'previa' && <span className="text-suave">Conferindo a planilha…</span>}

        {previa && (
          <div className="flex flex-col gap-3 rounded-2xl border border-linha p-4">
            <span className="font-bold">
              Prévia: {previa.linhas.length} {previa.linhas.length === 1 ? 'item' : 'itens'}
              {previa.variacao && ` · variação média ${pctTexto(previa.variacao.media)} (de ${pctTexto(previa.variacao.minima)} a ${pctTexto(previa.variacao.maxima)})`}
            </span>
            {previa.avisos.map((a) => <Fragment key={a}><Aviso tom="vermelho">{a}</Aviso></Fragment>)}
            <div className="max-h-72 overflow-auto rounded-xl border border-linha">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-nevoa text-left text-xs uppercase tracking-[0.08em] text-suave">
                  <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2 text-right">Antes</th><th className="px-3 py-2 text-right">Depois</th><th className="px-3 py-2 text-right">Variação</th></tr>
                </thead>
                <tbody className="divide-y divide-linha">
                  {previa.linhas.map((l) => (
                    <tr key={l.item}>
                      <td className="px-3 py-1.5">{l.item}</td>
                      <td className="numero px-3 py-1.5 text-right text-suave">{l.antes}</td>
                      <td className="numero px-3 py-1.5 text-right font-semibold">{l.depois}</td>
                      <td className={cn('numero px-3 py-1.5 text-right', l.variacao < -1 || l.variacao > 25 ? 'font-bold text-minas-texto' : 'text-suave')}>{l.antes === '—' ? 'novo' : pctTexto(l.variacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Botao onClick={publicar} disabled={!!ocupado}>{ocupado === 'publicar' ? 'Publicando…' : `Publicar tabela de ${ano} a partir de ${vigencia ? dataBr(vigencia) : '—'}`}</Botao>
          </div>
        )}
        {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}

        {versoes.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-suave">Versões publicadas</span>
            <ul className="flex flex-col divide-y divide-linha rounded-xl border border-linha text-sm">
              {versoes.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span><strong>{v.ano}</strong> · vale desde {dataBr(v.vigencia_inicio)}{v.emVigor ? ' · em vigor' : v.futura ? ' · agendada' : ''}</span>
                  <button type="button" onClick={() => remover(v)} disabled={!!ocupado} aria-label={`Remover tabela de ${v.ano}`}
                    className="inline-flex min-h-9 items-center gap-1 font-bold text-minas-texto disabled:opacity-50"><Trash2 className="size-4" aria-hidden="true" />Remover</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Cartao>
  );
}
