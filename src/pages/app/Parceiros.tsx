import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { Download, FileDown, FileSpreadsheet, Pencil, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { NOME_TIPO, abrirLink } from '@/hooks/useCalculos';
import { useConta } from '@/hooks/useConta';
import { brl, dataHora, numeroCalculo, telefoneBonito } from '@/lib/formato';
import { Alternar, Aviso, Botao, Campo, CampoMoeda, Cartao } from '@/components/ui/Campos';
import { AUTONOMO } from '@/lib/parceiro';
import { cn } from '@/lib/utils';

interface Parceiro {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  imobiliaria: string | null;
  situacao: 'ativo' | 'aguardando_cadastro';
  orcamentos: number;
  ultimoOrcamento: string | null;
  desde: string;
}
interface Lista { organizacao: { id: string; nome: string }; parceiros: Parceiro[]; imobiliarias: string[] }
interface Linha {
  id: string; seq: number; created_at: string; tipo: string; subtipo: string | null; municipio: string | null;
  origem: 'site' | 'whatsapp'; descricao: string | null; total: number; valorTransacionado: number;
  parceiroId: string; parceiro: string; imobiliaria: string | null;
}
interface Controle {
  orcamentos: Linha[];
  totais: { orcamentos: number; valorTransacionado: number; totalOrcado: number; site: number; whatsapp: number; parceiros: number };
  truncado: boolean;
}

type Aba = 'controle' | 'parceiros';
const ABAS: [Aba, string][] = [['controle', 'Controle de orçamentos'], ['parceiros', 'Parceiros']];

/** Hoje e o 1º dia do mês, em 'AAAA-MM-DD' no horário de Brasília. */
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const FILTRO_INICIAL = { de: `${hoje().slice(0, 8)}01`, ate: hoje(), nome: '', imobiliaria: '', tipo: '', origem: '', valorMin: 0, valorMax: 0 };
type Filtro = typeof FILTRO_INICIAL;

/** Monta a consulta da API: valores em reais e só os filtros preenchidos. */
function consulta(f: Filtro) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (k === 'valorMin' || k === 'valorMax') { if (v) p.set(k, String(Number(v) / 100)); }
    else if (String(v).trim()) p.set(k, String(v).trim());
  }
  return p.toString();
}

/**
 * Corretores parceiros da Clemente Assessoria: o time cadastra os parceiros (não pagam; os orçamentos saem com a logo
 * da Clemente) e acompanha cada orçamento feito por eles no site e no WhatsApp.
 */
export default function Parceiros() {
  const { perfil, equipe } = useConta();
  const [aba, setAba] = useState<Aba>('controle');
  const [lista, setLista] = useState<Lista | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const time = perfil?.papel === 'admin' || (equipe?.tipo === 'clemente' && equipe.funcao !== 'parceiro');

  const carregar = useCallback(() => {
    api<Lista>('/api/parceiros').then(setLista).catch((e) => setErro(e.message));
  }, []);
  useEffect(() => { if (time) carregar(); }, [carregar, time]);

  if (!time) return <Aviso tom="vermelho">Área restrita ao time da Clemente Assessoria.</Aviso>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Clemente Assessoria</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Corretores parceiros</h1>
        <p className="text-suave">Parceiros não pagam: orçam no site e no WhatsApp, e todos os orçamentos saem com a logo da Clemente. Aqui o time cadastra os parceiros e acompanha cada orçamento.</p>
      </header>

      {erro && <Aviso tom="vermelho">{erro}</Aviso>}

      <div role="tablist" aria-label="Seções" className="flex gap-1 self-start rounded-xl bg-cinza p-1">
        {ABAS.map(([v, r]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)}
            className={cn('min-h-10 rounded-lg px-4 font-bold', aba === v ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>{r}</button>
        ))}
      </div>

      {aba === 'controle' && <ControleOrcamentos lista={lista} />}
      {aba === 'parceiros' && lista && <CadastroParceiros lista={lista} aoMudar={carregar} />}
    </div>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-linha bg-white p-5">
      <span className="text-sm font-semibold text-suave">{rotulo}</span>
      <span className="numero text-[26px] font-black leading-8 [overflow-wrap:anywhere]">{valor}</span>
      {nota && <span className="text-xs text-suave">{nota}</span>}
    </div>
  );
}

const seletor = 'h-12 w-full rounded-[10px] border border-borda bg-white px-3 font-semibold';

function ControleOrcamentos({ lista }: { lista: Lista | null }) {
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_INICIAL);
  const [dados, setDados] = useState<Controle | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);
  const q = consulta(filtro);

  // Espera a pessoa parar de digitar antes de consultar.
  useEffect(() => {
    let ativo = true;
    setErro(null);
    const t = setTimeout(() => {
      api<Controle>(`/api/parceiros/orcamentos?${q}`).then((d) => ativo && setDados(d)).catch((e) => ativo && setErro(e.message));
    }, 350);
    return () => { ativo = false; clearTimeout(t); };
  }, [q]);

  const mudar = <K extends keyof Filtro>(k: K, v: Filtro[K]) => setFiltro((f) => ({ ...f, [k]: v }));

  async function exportar() {
    setExportando(true); setErro(null);
    try {
      const { url, quantidade } = await api<{ url: string; quantidade: number }>(`/api/parceiros/exportar?${q}`);
      if (!quantidade) setErro('Nenhum orçamento com esses filtros para exportar.');
      else window.location.href = url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setExportando(false); }
  }

  const t = dados?.totais;
  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Filtros" className="grid gap-4 rounded-2xl border border-linha bg-white p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
        <Campo rotulo="De" type="date" value={filtro.de} max={filtro.ate || undefined} onChange={(e) => mudar('de', e.target.value)} />
        <Campo rotulo="Até" type="date" value={filtro.ate} min={filtro.de || undefined} onChange={(e) => mudar('ate', e.target.value)} />
        <Campo rotulo="Nome do parceiro" value={filtro.nome} onChange={(e) => mudar('nome', e.target.value)} list="parceiros-nomes" autoComplete="off" placeholder="Todos" />
        <Campo rotulo="Imobiliária" value={filtro.imobiliaria} onChange={(e) => mudar('imobiliaria', e.target.value)} list="parceiros-imobiliarias" autoComplete="off" placeholder="Todas" />
        <label className="flex flex-col gap-1.5 font-semibold">Modalidade
          <select value={filtro.tipo} onChange={(e) => mudar('tipo', e.target.value)} className={seletor}>
            <option value="">Todas</option>
            {Object.entries(NOME_TIPO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">Tipo de envio
          <select value={filtro.origem} onChange={(e) => mudar('origem', e.target.value)} className={seletor}>
            <option value="">Site e WhatsApp</option>
            <option value="site">Site</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </label>
        <CampoMoeda rotulo="Valor transacionado de" centavos={filtro.valorMin} onChange={(c) => mudar('valorMin', c)} />
        <CampoMoeda rotulo="Valor transacionado até" centavos={filtro.valorMax} onChange={(c) => mudar('valorMax', c)} />
        <datalist id="parceiros-nomes">{lista?.parceiros.map((p) => <option key={p.id} value={p.nome} />)}</datalist>
        <datalist id="parceiros-imobiliarias">{lista?.imobiliarias.map((i) => <option key={i} value={i} />)}</datalist>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
          <Botao variante="secundario" onClick={() => setFiltro(FILTRO_INICIAL)}><X className="size-5" aria-hidden="true" />Limpar filtros</Botao>
          <Botao onClick={exportar} disabled={exportando}><Download className="size-5" aria-hidden="true" />{exportando ? 'Gerando…' : 'Exportar planilha'}</Botao>
        </div>
      </section>

      {erro && <Aviso tom="vermelho">{erro}</Aviso>}

      {t && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Orçamentos" valor={String(t.orcamentos)} nota={`${t.site} no site · ${t.whatsapp} no WhatsApp`} />
          <Numero rotulo="Valor transacionado" valor={brl(t.valorTransacionado)} nota="soma dos imóveis orçados" />
          <Numero rotulo="Total orçado" valor={brl(t.totalOrcado)} nota="soma dos orçamentos" />
          <Numero rotulo="Parceiros que orçaram" valor={String(t.parceiros)} nota={lista ? `de ${lista.parceiros.length} cadastrados` : undefined} />
        </div>
      )}
      {dados?.truncado && <Aviso tom="azul">Mostrando os 2.000 orçamentos mais recentes. Diminua o período para ver todos.</Aviso>}

      <section aria-label="Orçamentos dos parceiros" className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
        {!dados && !erro && <p className="py-6 text-suave">Carregando…</p>}
        {dados && dados.orcamentos.length === 0 && <p className="py-6 text-suave">Nenhum orçamento de parceiro com esses filtros.</p>}
        {dados && dados.orcamentos.length > 0 && (
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="text-left text-xs text-suave">
                <th scope="col" className="py-3 pr-2 font-semibold">Nº</th>
                <th scope="col" className="p-2 font-semibold">Data</th>
                <th scope="col" className="p-2 font-semibold">Parceiro</th>
                <th scope="col" className="p-2 font-semibold">Imobiliária</th>
                <th scope="col" className="p-2 font-semibold">Modalidade</th>
                <th scope="col" className="p-2 font-semibold">Envio</th>
                <th scope="col" className="p-2 text-right font-semibold">Valor transacionado</th>
                <th scope="col" className="p-2 text-right font-semibold">Total orçado</th>
                <th scope="col" className="py-3 pl-2 text-right font-semibold"><span className="sr-only">Baixar</span></th>
              </tr>
            </thead>
            <tbody>
              {dados.orcamentos.map((c) => (
                <tr key={c.id} className="border-t border-linha">
                  <td className="py-3.5 pr-2 text-suave">{numeroCalculo(c.seq)}</td>
                  <td className="whitespace-nowrap p-2">{dataHora(c.created_at)}</td>
                  <td className="p-2 font-semibold">{c.parceiro}</td>
                  <td className="p-2">{c.imobiliaria ?? '—'}</td>
                  <td className="p-2"><span className="flex flex-col"><span className="font-bold">{NOME_TIPO[c.tipo] ?? c.tipo}</span>{c.descricao && <span className="text-xs text-suave">{c.descricao}</span>}</span></td>
                  <td className="p-2"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', c.origem === 'whatsapp' ? 'bg-acao-claro text-acao' : 'bg-cinza text-suave')}>{c.origem === 'whatsapp' ? 'WhatsApp' : 'Site'}</span></td>
                  <td className="numero whitespace-nowrap p-2 text-right">{brl(c.valorTransacionado)}</td>
                  <td className="numero whitespace-nowrap p-2 text-right font-bold">{brl(c.total)}</td>
                  <td className="py-3.5 pl-2 text-right">
                    <button type="button" onClick={() => abrirLink(`/api/parceiros/orcamentos/${c.id}/arquivo`).catch((e) => setErro(e.message))}
                      className="inline-flex min-h-10 items-center gap-1 font-bold text-acao" aria-label={`Baixar o orçamento ${numeroCalculo(c.seq)}`}>
                      <FileDown className="size-4" aria-hidden="true" />Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

const VAZIO = { nome: '', telefone: '', email: '', imobiliaria: '' };

function CadastroParceiros({ lista, aoMudar }: { lista: Lista; aoMudar: () => void }) {
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho' | 'azul'; texto: string } | null>(null);
  const autonomo = form.imobiliaria === AUTONOMO;

  // O que ainda impede o cadastro (o botão fica desligado e a lista aparece embaixo dele).
  const faltando = [
    form.nome.trim().length < 2 && 'nome',
    form.imobiliaria.trim().length < 2 && 'imobiliária (ou marque Corretor autônomo)',
    form.telefone.replace(/\D/g, '').length < 10 && 'telefone com DDD',
  ].filter((f): f is string => !!f);

  async function salvar() {
    setOcupado(true); setAviso(null);
    try {
      if (editando) {
        await api(`/api/parceiros/${editando}`, { metodo: 'PUT', corpo: form });
        setAviso({ tom: 'verde', texto: 'Parceiro alterado.' });
      } else {
        const r = await api<{ entrega: 'ligado' | 'convite_email' | 'aguardando_cadastro'; aviso?: string }>('/api/parceiros', { corpo: form });
        setAviso(r.aviso ? { tom: 'azul', texto: r.aviso } : {
          tom: 'verde',
          texto: r.entrega === 'ligado' ? `${form.nome} já tinha conta e virou corretor parceiro.`
            : r.entrega === 'convite_email' ? `Pronto! ${form.nome} já pode usar o agente pelo WhatsApp ${form.telefone}. Também mandamos um convite para ${form.email} para entrar no site (se não chegar, peça para olhar no spam).`
            : `Pronto! É só ${form.nome} mandar uma mensagem para o agente do WhatsApp pelo número ${form.telefone}: ele já é atendido como parceiro.`,
        });
      }
      setForm(VAZIO); setEditando(null);
      aoMudar();
    } catch (e) {
      setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    } finally { setOcupado(false); }
  }

  async function remover(p: Parceiro) {
    if (!window.confirm(`Remover ${p.nome} dos parceiros? Os orçamentos que ${p.nome} já fez continuam no controle.`)) return;
    try {
      await api(`/api/parceiros/${p.id}`, { metodo: 'DELETE' });
      setAviso({ tom: 'verde', texto: `${p.nome} não é mais parceiro.` });
      aoMudar();
    } catch (e) {
      setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section aria-label="Parceiros cadastrados" className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
        {lista.parceiros.length === 0 ? <p className="py-6 text-suave">Nenhum parceiro cadastrado ainda.</p> : (
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-left text-xs text-suave">
                <th scope="col" className="py-3 pr-2 font-semibold">Parceiro</th>
                <th scope="col" className="p-2 font-semibold">Imobiliária</th>
                <th scope="col" className="p-2 font-semibold">Telefone</th>
                <th scope="col" className="p-2 font-semibold">Situação</th>
                <th scope="col" className="p-2 text-right font-semibold">Orçamentos</th>
                <th scope="col" className="py-3 pl-2 text-right font-semibold"><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {lista.parceiros.map((p) => (
                <tr key={p.id} className="border-t border-linha">
                  <td className="py-3.5 pr-2">
                    <span className="flex flex-col">
                      <span className="font-bold">{p.nome}</span>
                      {p.email && <span className="text-xs text-suave">{p.email}</span>}
                    </span>
                  </td>
                  <td className="p-2">{p.imobiliaria ?? '—'}</td>
                  <td className="whitespace-nowrap p-2">{telefoneBonito(p.telefone)}</td>
                  <td className="p-2">
                    <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', p.situacao === 'ativo' ? 'bg-ok-claro text-ok' : 'bg-amarelo-claro text-amarelo-texto')}>
                      {p.situacao === 'ativo' ? 'Ativo' : 'Ainda não usou'}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <span className="flex flex-col items-end">
                      <span className="numero font-bold">{p.orcamentos}</span>
                      {p.ultimoOrcamento && <span className="text-xs text-suave">último {dataHora(p.ultimoOrcamento)}</span>}
                    </span>
                  </td>
                  <td className="py-3.5 pl-2 text-right">
                    <span className="inline-flex gap-1">
                      <button type="button" aria-label={`Alterar ${p.nome}`} onClick={() => { setEditando(p.id); setForm({ nome: p.nome, telefone: telefoneBonito(p.telefone), email: p.email ?? '', imobiliaria: p.imobiliaria ?? '' }); setAviso(null); }}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-acao hover:bg-nevoa"><Pencil className="size-4" aria-hidden="true" /></button>
                      <button type="button" aria-label={`Remover ${p.nome}`} onClick={() => remover(p)}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-minas-texto hover:bg-minas-claro"><Trash2 className="size-4" aria-hidden="true" /></button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <Cartao titulo={editando ? 'Alterar parceiro' : 'Cadastrar parceiro'}>
          <div className="flex flex-col gap-4">
            <Campo rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoComplete="off" maxLength={120} />
            <Alternar rotulo="Corretor autônomo" dica="Não trabalha em imobiliária. No controle, aparece como Autônomo." ligado={autonomo}
              onChange={(v) => setForm({ ...form, imobiliaria: v ? AUTONOMO : '' })} />
            {!autonomo && (
              <>
                <Campo rotulo="Imobiliária" value={form.imobiliaria} onChange={(e) => setForm({ ...form, imobiliaria: e.target.value })} list="cadastro-imobiliarias" autoComplete="off" maxLength={120} />
                <datalist id="cadastro-imobiliarias">{lista.imobiliarias.filter((i) => i !== AUTONOMO).map((i) => <option key={i} value={i} />)}</datalist>
              </>
            )}
            <Campo rotulo="Telefone (WhatsApp)" type="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(32) 99999-0000"
              dica="É por este número que o agente reconhece o parceiro. Ele já pode orçar pelo WhatsApp." />
            <Campo rotulo="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@imobiliaria.com.br"
              dica="Com e-mail, mandamos um convite para ele usar também o site." />
            {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
            <div className="flex flex-wrap gap-2">
              <Botao onClick={salvar} disabled={ocupado || faltando.length > 0}>
                {!editando && <UserPlus className="size-5" aria-hidden="true" />}{ocupado ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar parceiro'}
              </Botao>
              {editando && <Botao variante="secundario" onClick={() => { setEditando(null); setForm(VAZIO); setAviso(null); }}>Cancelar</Botao>}
            </div>
            {faltando.length > 0 && (form.nome || form.imobiliaria || form.telefone) && (
              <p className="text-sm font-semibold text-amarelo-texto">Para cadastrar, falta preencher: {faltando.join(', ')}.</p>
            )}
          </div>
        </Cartao>
        <ImportarPlanilha aoMudar={aoMudar} />
        <Cartao titulo="Como funciona">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-suave">
            <li>O parceiro não paga nada e não passa pelo teste grátis.</li>
            <li>Todo orçamento sai com a logo, a cor e o cabeçalho da Clemente (os definidos em Conta pelo gestor da {lista.organizacao.nome}), com o nome e o contato do parceiro.</li>
            <li>Os orçamentos dos parceiros aparecem só aqui, não em "Minha equipe".</li>
          </ul>
        </Cartao>
      </div>
    </div>
  );
}

interface Importacao {
  incluidos: number;
  jaCadastrados: number;
  erros: number;
  linhas: { linha: number; nome: string; situacao: 'incluido' | 'ja_cadastrado' | 'erro'; mensagem?: string }[];
}

/** Lê o arquivo escolhido como base64 (sem o prefixo data:). */
const paraBase64 = (f: File) => new Promise<string>((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result).split(',')[1] ?? '');
  r.onerror = () => erro(new Error('Não foi possível ler o arquivo.'));
  r.readAsDataURL(f);
});

/** Vários parceiros de uma vez: baixa a planilha modelo, preenche e envia. */
function ImportarPlanilha({ aoMudar }: { aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState<'modelo' | 'enviar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [r, setR] = useState<Importacao | null>(null);

  async function baixarModelo() {
    setOcupado('modelo'); setErro(null);
    try {
      const { data } = await supabase.auth.getSession();
      const resp = await fetch('/api/parceiros/modelo', { headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` } });
      if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro ?? 'Não foi possível baixar o modelo.');
      const url = URL.createObjectURL(await resp.blob());
      const a = document.createElement('a');
      a.href = url; a.download = 'modelo-corretores-parceiros.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(null); }
  }

  async function enviar(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setOcupado('enviar'); setErro(null); setR(null);
    try {
      setR(await api<Importacao>('/api/parceiros/importar', { corpo: { arquivo: await paraBase64(f) } }));
      aoMudar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : String(err));
    } finally { setOcupado(null); }
  }

  const problemas = r?.linhas.filter((l) => l.situacao !== 'incluido') ?? [];
  return (
    <Cartao titulo="Cadastrar vários de uma vez">
      <div className="flex flex-col gap-4">
        <p className="text-suave">Baixe a planilha modelo, preencha uma linha por parceiro (nome, imobiliária, WhatsApp e, se quiser, e-mail) e envie aqui. Para corretor autônomo, escreva Autônomo na coluna da imobiliária.</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={baixarModelo} disabled={!!ocupado}>
            <FileSpreadsheet className="size-5" aria-hidden="true" />{ocupado === 'modelo' ? 'Baixando…' : 'Baixar planilha modelo'}
          </Botao>
          <label className={cn('inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-[10px] border border-dashed border-borda bg-white px-4 font-bold hover:border-tinta', ocupado && 'pointer-events-none opacity-60')}>
            <Upload className="size-5" aria-hidden="true" />{ocupado === 'enviar' ? 'Cadastrando…' : 'Enviar planilha preenchida'}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={enviar} disabled={!!ocupado} />
          </label>
        </div>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        {r && (
          <Aviso tom={r.erros ? 'amarelo' : 'verde'}>
            {r.incluidos} parceiro{r.incluidos === 1 ? '' : 's'} cadastrado{r.incluidos === 1 ? '' : 's'}
            {r.jaCadastrados ? `, ${r.jaCadastrados} já estava${r.jaCadastrados === 1 ? '' : 'm'} cadastrado${r.jaCadastrados === 1 ? '' : 's'}` : ''}
            {r.erros ? ` e ${r.erros} linha${r.erros === 1 ? '' : 's'} com problema. Corrija e envie a planilha de novo: quem já entrou é ignorado.` : '.'}
          </Aviso>
        )}
        {problemas.length > 0 && (
          <ul className="flex max-h-60 flex-col gap-1.5 overflow-y-auto text-sm">
            {problemas.map((l) => (
              <li key={l.linha} className="rounded-lg bg-nevoa px-3 py-2">
                <strong>Linha {l.linha}{l.nome ? ` · ${l.nome}` : ''}:</strong> {l.situacao === 'ja_cadastrado' ? 'já cadastrado' : l.mensagem}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Cartao>
  );
}
