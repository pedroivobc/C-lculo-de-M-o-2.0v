import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileDown, Pencil, Trash2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { NOME_TIPO, abrirLink, mesAtual } from '@/hooks/useCalculos';
import { useConta } from '@/hooks/useConta';
import { brl, dataHora, numeroCalculo, telefoneBonito } from '@/lib/formato';
import { Aviso, Botao, Campo, Cartao } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

interface Membro {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  funcao: 'gestor' | 'colaborador';
  situacao: 'ativo' | 'aguardando_cadastro';
  orcamentosMes: number;
}
interface Resumo {
  organizacao: { id: string; nome: string; tipo: 'teams' | 'clemente'; assentosBase: number; ativa: boolean };
  membros: Membro[];
  mensalidade: { adicionais: number; mensal: number; mensalTexto: string; fixoTexto: string; adicionalTexto: string; periodos: Record<'trimestral' | 'semestral' | 'anual', { totalTexto: string }> } | null;
  linkCadastro: string;
}
interface OrcamentoEquipe { id: string; seq: number; tipo: string; origem: 'site' | 'whatsapp'; descricao: string | null; total: number; created_at: string; userId: string; usuario: string }
interface Relatorio {
  totais: { orcamentos: number; totalOrcado: number; usuariosQueOrcaram: number; usuariosAtivos: number; pelaWhatsapp: number };
  usuarios: { nome: string; quantidade: number; site: number; whatsapp: number; totalOrcado: number; ultimo: string | null }[];
  tipos: { tipo: string; quantidade: number; totalOrcado: number }[];
  meses: { mes: string; quantidade: number }[];
}

type Aba = 'usuarios' | 'orcamentos' | 'relatorio';
const ABAS: [Aba, string][] = [['usuarios', 'Usuários'], ['orcamentos', 'Orçamentos'], ['relatorio', 'Relatório']];

const nomeMes = (mes: string) => new Date(`${mes}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

/** Minha equipe: o gestor da imobiliária cuida dos usuários e acompanha os orçamentos de todos. */
export default function Equipe() {
  const { equipe, perfil } = useConta();
  const [aba, setAba] = useState<Aba>('usuarios');
  const [mes, setMes] = useState(mesAtual());
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    api<Resumo>(`/api/equipe?mes=${mes}`).then(setResumo).catch((e) => setErro(e.message));
  }, [mes]);
  useEffect(() => { if (equipe?.funcao === 'gestor') carregar(); }, [carregar, equipe?.funcao]);

  if (!equipe && perfil?.papel === 'admin') return <CriarMinhaEquipe />;
  if (equipe?.funcao !== 'gestor') return <Aviso tom="vermelho">Área restrita ao gestor da equipe.</Aviso>;

  const o = resumo?.organizacao;
  const usados = resumo?.membros.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="rotulo-secao">{o?.tipo === 'clemente' ? 'Clemente Team' : 'Teams'}</span>
          <h1 className="text-[28px] font-bold leading-[34px]">{o?.nome ?? equipe.nome}</h1>
          <p className="text-suave">Cadastre a sua equipe e acompanhe os orçamentos de todos. Todos saem com a logo e as cores da imobiliária.</p>
        </div>
        <label className="flex flex-col gap-1.5 font-semibold">Mês
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3" />
        </label>
      </header>

      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {o && !o.ativa && <Aviso tom="amarelo">O plano da equipe não está ativo: os usuários não conseguem orçar até a assinatura ser regularizada.</Aviso>}

      {resumo && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Numero rotulo="Usuários" valor={o?.tipo === 'clemente' ? String(usados) : `${usados} de ${o?.assentosBase}`} nota={o?.tipo === 'clemente' ? 'Equipe interna' : resumo.mensalidade?.adicionais ? `${resumo.mensalidade.adicionais} a mais que o pacote` : 'dentro do pacote'} />
          <Numero rotulo="Orçamentos no mês" valor={String(resumo.membros.reduce((s, m) => s + m.orcamentosMes, 0))} nota="de toda a equipe" />
          <Numero rotulo="Valor por mês" valor={resumo.mensalidade?.mensalTexto ?? 'Sem cobrança'}
            nota={resumo.mensalidade
              ? `${resumo.mensalidade.fixoTexto} por ${o?.assentosBase} usuários + ${resumo.mensalidade.adicionalTexto} por usuário a mais. Cobrança: ${resumo.mensalidade.periodos.trimestral.totalTexto} no trimestral, ${resumo.mensalidade.periodos.semestral.totalTexto} no semestral ou ${resumo.mensalidade.periodos.anual.totalTexto} no anual.`
              : 'Clemente Team'} />
        </div>
      )}

      <div role="tablist" aria-label="Seções da equipe" className="flex gap-1 self-start rounded-xl bg-cinza p-1">
        {ABAS.map(([v, r]) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)}
            className={cn('min-h-10 rounded-lg px-4 font-bold', aba === v ? 'bg-white text-tinta shadow-sm' : 'text-suave')}>{r}</button>
        ))}
      </div>

      {aba === 'usuarios' && resumo && <Usuarios resumo={resumo} aoMudar={carregar} />}
      {aba === 'orcamentos' && resumo && <Orcamentos mes={mes} membros={resumo.membros} />}
      {aba === 'relatorio' && <RelatorioMes mes={mes} />}
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

const VAZIO = { nome: '', telefone: '', email: '' };

function Usuarios({ resumo, aoMudar }: { resumo: Resumo; aoMudar: () => void }) {
  const [form, setForm] = useState(VAZIO);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho' | 'azul'; texto: string } | null>(null);
  const o = resumo.organizacao;
  const extra = o.tipo === 'teams' && !editando && resumo.membros.length >= o.assentosBase;

  async function salvar() {
    setOcupado(true); setAviso(null);
    try {
      if (editando) {
        await api(`/api/equipe/membros/${editando}`, { metodo: 'PUT', corpo: form });
        setAviso({ tom: 'verde', texto: 'Usuário alterado.' });
      } else {
        const r = await api<{ entrega: 'ligado' | 'convite_email' | 'aguardando_cadastro'; aviso?: string }>('/api/equipe/membros', { corpo: form });
        setAviso(r.aviso ? { tom: 'azul', texto: r.aviso } : {
          tom: 'verde',
          texto: r.entrega === 'ligado' ? `${form.nome} já tinha conta e entrou na equipe.`
            : r.entrega === 'convite_email' ? `Mandamos um convite para ${form.email}. Ao criar a senha, ${form.nome} entra na equipe. Se não chegar, peça para olhar no lixo eletrônico ou spam.`
            : `${form.nome} entra na equipe ao criar a conta em ${resumo.linkCadastro} e confirmar o WhatsApp ${form.telefone}.`,
        });
      }
      setForm(VAZIO); setEditando(null);
      aoMudar();
    } catch (e) {
      setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    } finally { setOcupado(false); }
  }

  async function remover(m: Membro) {
    if (!window.confirm(`Remover ${m.nome} da equipe? Os orçamentos que ${m.nome} já fez continuam nos relatórios.`)) return;
    try {
      await api(`/api/equipe/membros/${m.id}`, { metodo: 'DELETE' });
      setAviso({ tom: 'verde', texto: `${m.nome} saiu da equipe.` });
      aoMudar();
    } catch (e) {
      setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section aria-label="Usuários da equipe" className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="text-left text-xs text-suave">
              <th scope="col" className="py-3 pr-2 font-semibold">Nome</th>
              <th scope="col" className="p-2 font-semibold">Telefone</th>
              <th scope="col" className="p-2 font-semibold">Situação</th>
              <th scope="col" className="p-2 text-right font-semibold">Orçamentos no mês</th>
              <th scope="col" className="py-3 pl-2 text-right font-semibold"><span className="sr-only">Ações</span></th>
            </tr>
          </thead>
          <tbody>
            {resumo.membros.map((m) => (
              <tr key={m.id} className="border-t border-linha">
                <td className="py-3.5 pr-2">
                  <span className="flex flex-col">
                    <span className="font-bold">{m.nome}{m.funcao === 'gestor' && <span className="ml-2 rounded-full bg-tinta px-2 py-0.5 text-[11px] font-bold text-white">Gestor</span>}</span>
                    {m.email && <span className="text-xs text-suave">{m.email}</span>}
                  </span>
                </td>
                <td className="whitespace-nowrap p-2">{telefoneBonito(m.telefone)}</td>
                <td className="p-2">
                  <span className={cn('whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', m.situacao === 'ativo' ? 'bg-ok-claro text-ok' : 'bg-amarelo-claro text-amarelo-texto')}>
                    {m.situacao === 'ativo' ? 'Ativo' : 'Aguardando cadastro'}
                  </span>
                </td>
                <td className="numero p-2 text-right font-bold">{m.orcamentosMes}</td>
                <td className="py-3.5 pl-2 text-right">
                  <span className="inline-flex gap-1">
                    <button type="button" aria-label={`Alterar ${m.nome}`} onClick={() => { setEditando(m.id); setForm({ nome: m.nome, telefone: telefoneBonito(m.telefone), email: m.email ?? '' }); setAviso(null); }}
                      className="inline-flex size-10 items-center justify-center rounded-lg text-acao hover:bg-nevoa"><Pencil className="size-4" aria-hidden="true" /></button>
                    {m.funcao !== 'gestor' && (
                      <button type="button" aria-label={`Remover ${m.nome}`} onClick={() => remover(m)}
                        className="inline-flex size-10 items-center justify-center rounded-lg text-minas-texto hover:bg-minas-claro"><Trash2 className="size-4" aria-hidden="true" /></button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="flex flex-col gap-6">
        <Cartao titulo={editando ? 'Alterar usuário' : 'Incluir usuário'}>
          <div className="flex flex-col gap-4">
            <Campo rotulo="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoComplete="off" maxLength={120} />
            <Campo rotulo="Telefone (WhatsApp)" type="tel" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(32) 99999-0000"
              dica="É por este número que o agente reconhece a pessoa." />
            <Campo rotulo="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nome@imobiliaria.com.br"
              dica="Com e-mail, mandamos um convite para entrar no site." />
            {extra && (
              <Aviso tom="azul">O pacote tem {o.assentosBase} usuários. Este entra como adicional: +{resumo.mensalidade?.adicionalTexto ?? ''} por mês.</Aviso>
            )}
            {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
            <div className="flex flex-wrap gap-2">
              <Botao onClick={salvar} disabled={ocupado || form.nome.trim().length < 2 || form.telefone.replace(/\D/g, '').length < 10}>
                {!editando && <UserPlus className="size-5" aria-hidden="true" />}{ocupado ? 'Salvando…' : editando ? 'Salvar alterações' : 'Incluir na equipe'}
              </Botao>
              {editando && <Botao variante="secundario" onClick={() => { setEditando(null); setForm(VAZIO); setAviso(null); }}>Cancelar</Botao>}
            </div>
          </div>
        </Cartao>
        <Cartao titulo="Marca da equipe">
          <p className="text-suave">A logo, a cor e o nome no topo do orçamento são os que você define em <Link to="/app/conta" className="font-bold text-acao">Conta → Seus orçamentos</Link>. Valem para todos os usuários da equipe; cada um aparece com o próprio nome e contato.</p>
        </Cartao>
      </div>
    </div>
  );
}

function Orcamentos({ mes, membros }: { mes: string; membros: Membro[] }) {
  const [usuario, setUsuario] = useState('');
  const [dados, setDados] = useState<OrcamentoEquipe[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setDados(null); setErro(null);
    api<OrcamentoEquipe[]>(`/api/equipe/orcamentos?mes=${mes}`).then((d) => ativo && setDados(d)).catch((e) => ativo && setErro(e.message));
    return () => { ativo = false; };
  }, [mes]);

  // Quem já orçou no mês (inclui quem saiu da equipe depois).
  const pessoas = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of dados ?? []) m.set(c.userId, c.usuario);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [dados]);
  const filtrados = (dados ?? []).filter((c) => !usuario || c.userId === usuario);

  async function exportar() {
    setExportando(true); setErro(null);
    try {
      const { url, quantidade } = await api<{ url: string; quantidade: number }>(`/api/equipe/exportar?mes=${mes}`);
      if (!quantidade) setErro('Nenhum orçamento da equipe nesse mês para exportar.');
      else window.location.href = url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setExportando(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-60 flex-col gap-1.5 font-semibold">Usuário
          <select value={usuario} onChange={(e) => setUsuario(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3 font-semibold">
            <option value="">Todos ({membros.length})</option>
            {pessoas.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <Botao onClick={exportar} disabled={exportando}><Download className="size-5" aria-hidden="true" />{exportando ? 'Gerando…' : 'Exportar planilha do mês'}</Botao>
      </div>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      <section aria-label="Orçamentos da equipe" className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
        {!dados && !erro && <p className="py-6 text-suave">Carregando…</p>}
        {dados && filtrados.length === 0 && <p className="py-6 text-suave">Nenhum orçamento da equipe neste mês.</p>}
        {filtrados.length > 0 && (
          <table className="w-full min-w-[680px] border-collapse">
            <thead>
              <tr className="text-left text-xs text-suave">
                <th scope="col" className="py-3 pr-2 font-semibold">Nº</th>
                <th scope="col" className="p-2 font-semibold">Data</th>
                <th scope="col" className="p-2 font-semibold">Usuário</th>
                <th scope="col" className="p-2 font-semibold">Orçamento</th>
                <th scope="col" className="p-2 font-semibold">Origem</th>
                <th scope="col" className="p-2 text-right font-semibold">Total</th>
                <th scope="col" className="py-3 pl-2 text-right font-semibold"><span className="sr-only">Baixar</span></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-t border-linha">
                  <td className="py-3.5 pr-2 text-suave">{numeroCalculo(c.seq)}</td>
                  <td className="p-2">{dataHora(c.created_at)}</td>
                  <td className="p-2 font-semibold">{c.usuario}</td>
                  <td className="p-2"><span className="flex flex-col"><span className="font-bold">{NOME_TIPO[c.tipo] ?? c.tipo}</span>{c.descricao && <span className="text-xs text-suave">{c.descricao}</span>}</span></td>
                  <td className="p-2"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', c.origem === 'whatsapp' ? 'bg-acao-claro text-acao' : 'bg-cinza text-suave')}>{c.origem === 'whatsapp' ? 'WhatsApp' : 'Site'}</span></td>
                  <td className="numero p-2 text-right font-bold">{brl(Number(c.total))}</td>
                  <td className="py-3.5 pl-2 text-right">
                    <button type="button" onClick={() => abrirLink(`/api/equipe/orcamentos/${c.id}/arquivo`).catch((e) => setErro(e.message))}
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
      {dados && <p className="text-sm text-suave">{filtrados.length} orçamentos · {brl(filtrados.reduce((s, c) => s + Number(c.total), 0))} orçados no mês.</p>}
    </div>
  );
}

function RelatorioMes({ mes }: { mes: string }) {
  const [r, setR] = useState<Relatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    setR(null); setErro(null);
    api<Relatorio>(`/api/equipe/relatorio?mes=${mes}`).then((d) => ativo && setR(d)).catch((e) => ativo && setErro(e.message));
    return () => { ativo = false; };
  }, [mes]);

  if (erro) return <Aviso tom="vermelho">{erro}</Aviso>;
  if (!r) return <p className="text-suave">Carregando…</p>;
  const maior = Math.max(1, ...r.meses.map((m) => m.quantidade));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Orçamentos" valor={String(r.totais.orcamentos)} nota={`${r.totais.pelaWhatsapp} pelo WhatsApp`} />
        <Numero rotulo="Valor orçado" valor={brl(r.totais.totalOrcado)} nota="soma dos totais" />
        <Numero rotulo="Usuários que orçaram" valor={`${r.totais.usuariosQueOrcaram} de ${r.totais.usuariosAtivos}`} />
        <Numero rotulo="Média por usuário" valor={r.totais.usuariosAtivos ? (r.totais.orcamentos / r.totais.usuariosAtivos).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '0'} nota="orçamentos no mês" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Cartao titulo="Por usuário">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="text-left text-xs text-suave">
                  <th scope="col" className="py-2 pr-2 font-semibold">Usuário</th>
                  <th scope="col" className="p-2 text-right font-semibold">Orçamentos</th>
                  <th scope="col" className="p-2 text-right font-semibold">Site / WhatsApp</th>
                  <th scope="col" className="p-2 text-right font-semibold">Valor orçado</th>
                  <th scope="col" className="py-2 pl-2 text-right font-semibold">Último</th>
                </tr>
              </thead>
              <tbody>
                {r.usuarios.map((u) => (
                  <tr key={u.nome} className="border-t border-linha">
                    <td className="py-3 pr-2 font-bold">{u.nome}</td>
                    <td className="numero p-2 text-right font-bold">{u.quantidade}</td>
                    <td className="numero p-2 text-right text-suave">{u.site} / {u.whatsapp}</td>
                    <td className="numero p-2 text-right">{brl(u.totalOrcado)}</td>
                    <td className="py-3 pl-2 text-right text-sm text-suave">{u.ultimo ? dataHora(u.ultimo) : 'nenhum'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>

        <div className="flex flex-col gap-6">
          <Cartao titulo="Últimos 6 meses">
            <ol className="flex h-36 items-end gap-2" aria-label="Orçamentos por mês">
              {r.meses.map((m) => (
                <li key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="numero text-xs font-bold">{m.quantidade}</span>
                  <span className={cn('w-full rounded-t-md', m.mes === mes ? 'bg-acao' : 'bg-acao-claro')} style={{ height: `${Math.max(4, (m.quantidade / maior) * 96)}px` }} aria-hidden="true" />
                  <span className="text-xs text-suave">{nomeMes(m.mes)}</span>
                </li>
              ))}
            </ol>
          </Cartao>
          <Cartao titulo="Por tipo de orçamento">
            {r.tipos.length === 0 ? <p className="text-suave">Nenhum orçamento no mês.</p> : (
              <ul className="flex flex-col gap-2">
                {r.tipos.map((t) => (
                  <li key={t.tipo} className="flex items-baseline justify-between gap-3 rounded-xl bg-nevoa px-3.5 py-2.5">
                    <span className="font-bold">{NOME_TIPO[t.tipo] ?? t.tipo}</span>
                    <span className="numero text-sm"><strong>{t.quantidade}</strong> · {brl(t.totalOrcado)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        </div>
      </div>
    </div>
  );
}

/** O administrador ainda sem equipe: cria a própria Clemente Team (ele é o gestor, sem cobrança). */
function CriarMinhaEquipe() {
  const { perfil, recarregar } = useConta();
  const [nome, setNome] = useState('Clemente Team');
  const [telefone, setTelefone] = useState(perfil?.whatsapp_e164 ? '' : perfil?.telefone ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setOcupado(true); setErro(null);
    try {
      await api('/api/admin/minha-equipe', { corpo: { nome, telefone: telefone || null } });
      await recarregar({ silencioso: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(false); }
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Minha equipe</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Monte a sua equipe</h1>
        <p className="text-suave">Você fica como gestor de uma Clemente Team: cadastra colaboradores com nome e telefone, acompanha os orçamentos de todos, e todos saem com a sua logo e as suas cores. Não há cobrança.</p>
      </header>
      <Cartao titulo="Nova equipe">
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome da equipe" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          {!perfil?.whatsapp_e164 && (
            <Campo rotulo="Seu telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} dica="Com DDD. É o seu número na lista da equipe." />
          )}
          {erro && <Aviso tom="vermelho">{erro}</Aviso>}
          <Botao onClick={criar} disabled={ocupado || nome.trim().length < 2 || (!perfil?.whatsapp_e164 && telefone.replace(/\D/g, '').length < 10)}>
            {ocupado ? 'Criando…' : 'Criar minha equipe'}
          </Botao>
        </div>
      </Cartao>
    </div>
  );
}
