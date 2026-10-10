import { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { mesAtual } from '@/hooks/useCalculos';
import { EQUIPE } from '@/lib/config';
import { brl } from '@/lib/formato';
import { Aviso, Botao, Campo, Cartao } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

interface Organizacao {
  id: string; nome: string; tipo: 'teams' | 'clemente'; assentosBase: number; criadaEm: string; gestor: string;
  usuarios: number; pendentes: number; orcamentosMes: number; ativa: boolean;
  mensalidade: { adicionais: number; mensal: number; mensalTexto: string } | null;
}
interface Gestao {
  receitaEquipesMensal: number;
  organizacoes: Organizacao[];
}

const VAZIA = { nome: '', tipo: 'teams' as 'teams' | 'clemente', emailGestor: '', telefoneGestor: '', assentosBase: String(EQUIPE.assentosBase) };

/** Gestão de Negócio → Equipes: imobiliárias (Teams) e Clemente Team, pacote, liberação e criação. */
export default function AdminEquipes() {
  const [mes, setMes] = useState(mesAtual());
  const [g, setG] = useState<Gestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(() => { api<Gestao>(`/api/admin/gestao?mes=${mes}`).then(setG).catch((e) => setErro(e.message)); }, [mes]);
  useEffect(() => { carregar(); }, [carregar]);

  const usuarios = g?.organizacoes.reduce((s, o) => s + o.usuarios, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="rotulo-secao">Gestão de Negócio</span>
          <h1 className="text-[28px] font-bold leading-[34px]">Equipes</h1>
          <p className="text-suave">Imobiliárias no plano Teams e as Clemente Teams.</p>
        </div>
        <label className="flex flex-col gap-1.5 font-semibold">Mês
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="h-12 rounded-[10px] border border-borda bg-white px-3" />
        </label>
      </header>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {!g ? <span className="text-suave">Carregando…</span> : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Numero rotulo="Equipes" valor={String(g.organizacoes.length)} nota={`${usuarios} usuários em equipes`} />
            <Numero rotulo="Orçamentos das equipes no mês" valor={String(g.organizacoes.reduce((s, o) => s + o.orcamentosMes, 0))} />
            <Numero rotulo="Equipes: valor por mês" valor={brl(g.receitaEquipesMensal / 100)} nota="Teams ativas, base mensal dos planos trimestral, semestral e anual (valores provisórios)" />
          </div>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Organizacoes lista={g.organizacoes} aoMudar={carregar} />
            <NovaOrganizacao aoCriar={carregar} />
          </div>
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
