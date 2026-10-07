import { useMemo, useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import { api } from '@/lib/api';
import { brl, dataHora, numeroCalculo } from '@/lib/formato';
import { NOME_TIPO, abrirOrcamento, mesAtual, useCalculos } from '@/hooks/useCalculos';
import { Aviso, Botao } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

export default function Historico() {
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState<'' | 'site' | 'whatsapp'>('');
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const { dados, erro: erroLista } = useCalculos(mes);

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (dados ?? []).filter((c) =>
      (!origem || c.origem === origem)
      && (!b || `${NOME_TIPO[c.tipo]} ${c.descricao ?? ''} ${numeroCalculo(c.seq)}`.toLowerCase().includes(b)));
  }, [dados, busca, origem]);

  async function exportar() {
    setExportando(true); setErro(null);
    try {
      const { url, quantidade } = await api<{ url: string; quantidade: number }>(`/api/exportar?mes=${mes}`);
      if (!quantidade) setErro('Nenhum orçamento nesse mês para exportar.');
      else window.location.href = url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setExportando(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="rotulo-secao">Histórico</span>
          <h1 className="text-[28px] font-bold leading-[34px]">Seus orçamentos</h1>
          <p className="text-suave">Feitos no site e pelo WhatsApp, num lugar só.</p>
        </div>
        <Botao onClick={exportar} disabled={exportando}><Download className="size-5" aria-hidden="true" />{exportando ? 'Gerando…' : 'Exportar planilha do mês'}</Botao>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 font-semibold">Buscar
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Endereço, cliente ou número" className="h-12 rounded-[10px] border border-borda bg-white px-3" />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">Mês
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3" />
        </label>
        <div role="group" aria-label="Origem" className="flex gap-1 rounded-xl bg-cinza p-1">
          {([['', 'Todos'], ['whatsapp', 'WhatsApp'], ['site', 'Site']] as const).map(([v, r]) => (
            <button key={v} type="button" aria-pressed={origem === v} onClick={() => setOrigem(v)}
              className={cn('min-h-10 rounded-lg px-3.5 font-bold', origem === v ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>{r}</button>
          ))}
        </div>
      </div>

      {(erro || erroLista) && <Aviso tom="vermelho">{erro ?? erroLista}</Aviso>}

      <section aria-label="Lista de orçamentos" className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
        {!dados && !erroLista && <p className="py-6 text-suave">Carregando…</p>}
        {dados && filtrados.length === 0 && <p className="py-6 text-suave">Nenhum orçamento encontrado com esses filtros.</p>}
        {filtrados.length > 0 && (
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-left text-xs text-suave">
                <th scope="col" className="py-3 pr-2 font-semibold">Nº</th>
                <th scope="col" className="p-2 font-semibold">Data</th>
                <th scope="col" className="p-2 font-semibold">Orçamento</th>
                <th scope="col" className="p-2 font-semibold">Origem</th>
                <th scope="col" className="p-2 text-right font-semibold">Total</th>
                <th scope="col" className="py-3 pl-2 text-right font-semibold">Orçamento</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t border-linha">
                  <td className="py-3.5 pr-2 text-suave">{numeroCalculo(c.seq)}</td>
                  <td className="p-2">{dataHora(c.created_at)}</td>
                  <td className="p-2"><span className="flex flex-col"><span className="font-bold">{NOME_TIPO[c.tipo] ?? c.tipo}</span>{c.descricao && <span className="text-xs text-suave">{c.descricao}</span>}</span></td>
                  <td className="p-2"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', c.origem === 'whatsapp' ? 'bg-acao-claro text-acao' : 'bg-cinza text-suave')}>{c.origem === 'whatsapp' ? 'WhatsApp' : 'Site'}</span></td>
                  <td className="numero p-2 text-right font-bold">{brl(Number(c.total))}</td>
                  <td className="py-3.5 pl-2 text-right">
                    <button type="button" onClick={() => abrirOrcamento(c.seq).catch((e) => setErro(e.message))} className="inline-flex min-h-10 items-center gap-1 font-bold text-acao" aria-label={`Baixar o orçamento ${numeroCalculo(c.seq)}`}>
                      <FileDown className="size-4" aria-hidden="true" />Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {dados && <p className="text-sm text-suave">{filtrados.length} de {dados.length} orçamentos no mês.</p>}
    </div>
  );
}
