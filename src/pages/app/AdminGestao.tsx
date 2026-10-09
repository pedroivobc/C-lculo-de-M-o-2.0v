import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { mesAtual } from '@/hooks/useCalculos';
import { useConta } from '@/hooks/useConta';
import { EQUIPE, NOME_PAPEL, type Papel } from '@/lib/config';
import { brl, dataHora } from '@/lib/formato';
import { Aviso, Botao, Campo, Cartao } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

interface Organizacao {
  id: string; nome: string; tipo: 'teams' | 'clemente'; assentosBase: number; criadaEm: string; gestor: string;
  usuarios: number; pendentes: number; orcamentosMes: number; ativa: boolean;
  mensalidade: { adicionais: number; mensal: number; mensalTexto: string } | null;
}
interface Cliente {
  id: string; full_name: string | null; email: string | null; papel: Papel; created_at: string;
  status_assinatura: string | null; nivel: string | null; total_calculos: number; ultimo_calculo: string | null;
}
interface Gestao {
  perfis: Partial<Record<Papel, number>>;
  orcamentosMes: number;
  orcamentosMesWhatsapp: number;
  receitaEquipesMensal: number;
  organizacoes: Organizacao[];
  clientes: Cliente[];
}

const ORDEM_PAPEIS: Papel[] = ['teams', 'clemente', 'pro', 'usuario', 'trial', 'admin'];
const VAZIA = { nome: '', tipo: 'teams' as 'teams' | 'clemente', emailGestor: '', telefoneGestor: '', assentosBase: String(EQUIPE.assentosBase) };

/** Administrador → Gestão do negócio: contas por perfil, organizações (imobiliárias) e clientes. */
export default function AdminGestao() {
  const { perfil } = useConta();
  const [mes, setMes] = useState(mesAtual());
  const [g, setG] = useState<Gestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => { api<Gestao>(`/api/admin/gestao?mes=${mes}`).then(setG).catch((e) => setErro(e.message)); }, [mes]);
  useEffect(() => { if (perfil?.papel === 'admin') carregar(); }, [carregar, perfil?.papel]);

  const clientes = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (g?.clientes ?? []).filter((c) => !b || `${c.full_name ?? ''} ${c.email ?? ''} ${NOME_PAPEL[c.papel]}`.toLowerCase().includes(b));
  }, [g, busca]);

  if (perfil && perfil.papel !== 'admin') return <Aviso tom="vermelho">Área restrita ao administrador.</Aviso>;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="rotulo-secao">Administrador</span>
          <h1 className="text-[28px] font-bold leading-[34px]">Gestão do negócio</h1>
          <p className="text-suave">Contas, equipes e uso do sistema.</p>
        </div>
        <label className="flex flex-col gap-1.5 font-semibold">Mês
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3" />
        </label>
      </header>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {!g ? <span className="text-suave">Carregando…</span> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Numero rotulo="Orçamentos no mês" valor={String(g.orcamentosMes)} nota={`${g.orcamentosMesWhatsapp} pelo WhatsApp`} />
            <Numero rotulo="Equipes" valor={String(g.organizacoes.length)} nota={`${g.organizacoes.reduce((s, o) => s + o.usuarios, 0)} usuários em equipes`} />
            <Numero rotulo="Equipes: valor por mês" valor={brl(g.receitaEquipesMensal / 100)} nota="Teams ativas, base mensal dos planos trimestral, semestral e anual (valores provisórios)" />
          </div>

          <Cartao titulo="Contas por perfil">
            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {ORDEM_PAPEIS.map((p) => (
                <li key={p} className="flex flex-col rounded-xl bg-nevoa px-3.5 py-3">
                  <span className="text-sm font-semibold text-suave">{NOME_PAPEL[p]}</span>
                  <span className="numero text-2xl font-black">{g.perfis[p] ?? 0}</span>
                </li>
              ))}
            </ul>
          </Cartao>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Organizacoes lista={g.organizacoes} aoMudar={carregar} />
            <NovaOrganizacao aoCriar={carregar} />
          </div>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-lg font-bold">Clientes</h2>
              <label className="flex min-w-60 flex-col gap-1.5 font-semibold">Buscar
                <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail ou perfil" className="h-12 rounded-[10px] border border-borda bg-white px-3" />
              </label>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="text-left text-xs text-suave">
                    <th scope="col" className="py-3 pr-2 font-semibold">Cliente</th>
                    <th scope="col" className="p-2 font-semibold">Perfil</th>
                    <th scope="col" className="p-2 font-semibold">Assinatura</th>
                    <th scope="col" className="p-2 text-right font-semibold">Orçamentos</th>
                    <th scope="col" className="p-2 font-semibold">Último</th>
                    <th scope="col" className="py-3 pl-2 font-semibold">Desde</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className="border-t border-linha">
                      <td className="py-3 pr-2"><span className="flex flex-col"><span className="font-bold">{c.full_name ?? 'Sem nome'}</span><span className="text-xs text-suave">{c.email}</span></span></td>
                      <td className="p-2"><span className="rounded-full bg-cinza px-2.5 py-0.5 text-xs font-bold">{NOME_PAPEL[c.papel] ?? c.papel}</span></td>
                      <td className="p-2 text-sm">{c.status_assinatura ?? '—'}</td>
                      <td className="numero p-2 text-right font-bold">{c.total_calculos}</td>
                      <td className="p-2 text-sm text-suave">{c.ultimo_calculo ? dataHora(c.ultimo_calculo) : '—'}</td>
                      <td className="py-3 pl-2 text-sm text-suave">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clientes.length === 0 && <p className="py-6 text-suave">Nenhum cliente encontrado.</p>}
            </div>
          </section>
        </>
      )}
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

function Organizacoes({ lista, aoMudar }: { lista: Organizacao[]; aoMudar: () => void }) {
  const [erro, setErro] = useState<string | null>(null);

  async function mudarPacote(o: Organizacao) {
    const v = window.prompt(`Usuários inclusos no pacote de ${o.nome}:`, String(o.assentosBase));
    if (!v) return;
    try { await api(`/api/admin/organizacoes/${o.id}`, { metodo: 'PUT', corpo: { assentosBase: Number(v) } }); aoMudar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }

  async function liberar(o: Organizacao) {
    const v = window.prompt(`Liberar ${o.nome} sem cobrança online até (AAAA-MM-DD):`, new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10));
    if (!v) return;
    try { await api(`/api/admin/organizacoes/${o.id}/liberar`, { corpo: { ate: v } }); aoMudar(); }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <Cartao titulo="Equipes">
      {erro && <div className="mb-3"><Aviso tom="vermelho">{erro}</Aviso></div>}
      {lista.length === 0 ? <p className="text-suave">Nenhuma equipe ainda.</p> : (
        <ul className="flex flex-col gap-3">
          {lista.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 rounded-xl border border-linha p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-bold"><Building2 className="size-5 text-suave" aria-hidden="true" />{o.nome}</span>
                <span className="flex gap-1.5">
                  <span className="rounded-full bg-cinza px-2.5 py-0.5 text-xs font-bold">{o.tipo === 'clemente' ? 'Clemente Team' : 'Teams'}</span>
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', o.ativa ? 'bg-ok-claro text-ok' : 'bg-amarelo-claro text-amarelo-texto')}>{o.ativa ? 'Ativa' : 'Sem assinatura'}</span>
                </span>
              </div>
              <span className="text-sm text-suave">
                Gestor: {o.gestor} · {o.usuarios}{o.tipo === 'teams' ? ` de ${o.assentosBase}` : ''} usuários{o.pendentes ? ` (${o.pendentes} aguardando cadastro)` : ''} · {o.orcamentosMes} orçamentos no mês
                {o.mensalidade ? ` · ${o.mensalidade.mensalTexto}/mês` : ''}
              </span>
              {o.tipo === 'teams' && (
                <span className="flex flex-wrap gap-3 text-sm">
                  <button type="button" onClick={() => mudarPacote(o)} className="font-bold text-acao">Mudar pacote</button>
                  {!o.ativa && <button type="button" onClick={() => liberar(o)} className="font-bold text-acao">Liberar sem cobrança</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

function NovaOrganizacao({ aoCriar }: { aoCriar: () => void }) {
  const [f, setF] = useState(VAZIA);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<{ tom: 'verde' | 'vermelho'; texto: string } | null>(null);

  async function criar() {
    setOcupado(true); setAviso(null);
    try {
      await api('/api/admin/organizacoes', { corpo: { ...f, assentosBase: Number(f.assentosBase), telefoneGestor: f.telefoneGestor || null } });
      setAviso({ tom: 'verde', texto: `${f.nome} criada. O gestor já vê "Minha equipe" no menu.` });
      setF(VAZIA);
      aoCriar();
    } catch (e) {
      setAviso({ tom: 'vermelho', texto: e instanceof Error ? e.message : String(e) });
    } finally { setOcupado(false); }
  }

  return (
    <Cartao titulo="Nova equipe">
      <div className="flex flex-col gap-4">
        <Campo rotulo="Nome da imobiliária" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} maxLength={120} />
        <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-2 gap-2">
          {([['teams', 'Teams', 'Imobiliária assinante'], ['clemente', 'Clemente Team', 'Equipe interna, sem cobrança']] as const).map(([v, nome, nota]) => (
            <button key={v} type="button" role="radio" aria-checked={f.tipo === v} onClick={() => setF({ ...f, tipo: v })}
              className={cn('flex flex-col rounded-xl border-2 bg-white p-3 text-left', f.tipo === v ? 'border-acao' : 'border-linha')}>
              <span className="font-bold">{nome}</span><span className="text-xs text-suave">{nota}</span>
            </button>
          ))}
        </div>
        <Campo rotulo="E-mail do gestor" type="email" value={f.emailGestor} onChange={(e) => setF({ ...f, emailGestor: e.target.value })} dica="A conta do gestor precisa existir. Ela passa a ser a dona da equipe." />
        <Campo rotulo="Telefone do gestor (opcional)" type="tel" value={f.telefoneGestor} onChange={(e) => setF({ ...f, telefoneGestor: e.target.value })} dica="Se ficar vazio, usamos o WhatsApp confirmado da conta." />
        {f.tipo === 'teams' && <Campo rotulo="Usuários no pacote" type="number" min={1} max={500} value={f.assentosBase} onChange={(e) => setF({ ...f, assentosBase: e.target.value })} />}
        {aviso && <Aviso tom={aviso.tom}>{aviso.texto}</Aviso>}
        <Botao onClick={criar} disabled={ocupado || f.nome.trim().length < 2 || !f.emailGestor.includes('@')}>{ocupado ? 'Criando…' : 'Criar equipe'}</Botao>
      </div>
    </Cartao>
  );
}
