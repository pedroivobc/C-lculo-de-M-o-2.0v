import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { NOME_PAPEL, PERIODOS, type Papel, type Periodo } from '@/lib/config';
import { dataHora, telefoneBonito } from '@/lib/formato';
import { Aviso, Botao, Campo } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

type Situacao = 'ativo' | 'em_risco' | 'inativo' | 'nunca';
interface Plano { nivel: string; plan: string; status: string; manual: boolean; vigente: boolean; ate: string | null }
interface Usuario {
  id: string; full_name: string | null; email: string | null; whatsapp_e164: string | null; papel: Papel; trial_expira_em: string | null;
  created_at: string; total_calculos: number; ultimo_calculo: string | null; orcamentos30d: number;
  situacao: Situacao; power: boolean; equipe: { nome: string; funcao: string } | null; plano: Plano | null;
}
interface Ficha {
  perfil: { id: string; full_name: string | null; email: string | null; telefone: string | null; whatsapp_e164: string | null; whatsapp_verified_at: string | null;
    papel: Papel; created_at: string; trial_expira_em: string | null; municipio: string | null; uf: string };
  origem: string;
  equipe: { nome: string; tipo: string; funcao: string } | null;
  orcamentos: { total: number; site: number; whatsapp: number; ultimos30: number; ultimo: string | null };
  situacao: Situacao; power: boolean;
  assinaturas: (Plano & { user_id: string; gateway: string; created_at: string; current_period_end: string | null; forma_pagamento: string | null })[];
  auditoria: { acao: string; rotulo: string; motivo: string | null; created_at: string; depois: Record<string, unknown> | null }[];
}

const SITUACAO: Record<Situacao, { nome: string; classe: string; nota: string }> = {
  ativo: { nome: 'Ativo', classe: 'bg-ok-claro text-ok', nota: 'Orçou nos últimos 15 dias' },
  em_risco: { nome: 'Em risco', classe: 'bg-amarelo-claro text-amarelo-texto', nota: 'Sem orçar há mais de 15 dias' },
  inativo: { nome: 'Inativo', classe: 'bg-minas-claro text-minas-texto', nota: 'Sem orçar há mais de 30 dias' },
  nunca: { nome: 'Nunca ativado', classe: 'bg-cinza text-texto', nota: 'Ainda não fez orçamento' },
};
const NIVEL: Record<string, string> = { usuario: 'Starter', pro: 'Pró', teams: 'Teams' };
const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const daquiA = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

function textoPlano(u: Pick<Usuario, 'papel' | 'plano' | 'equipe' | 'trial_expira_em'>) {
  if (u.papel === 'admin') return 'Administrador';
  if (u.equipe) return `Equipe ${u.equipe.nome}`;
  const p = u.plano;
  if (p?.vigente) return `${NIVEL[p.nivel] ?? p.nivel} ${p.manual ? 'liberado' : PERIODOS[p.plan as Periodo]?.nome.toLowerCase() ?? p.plan}${p.ate ? ` até ${data(p.ate)}` : ''}${p.status === 'atrasada' ? ' · atrasada' : ''}`;
  if (u.papel === 'trial') return u.trial_expira_em ? (new Date(u.trial_expira_em) > new Date() ? `Teste até ${data(u.trial_expira_em)}` : 'Teste encerrado') : 'Teste não iniciado';
  return p ? `Sem plano (${p.status})` : 'Sem plano';
}

/** Gestão de Negócio → Usuários e planos: busca, classificação de uso e a ficha com ações auditadas. */
export default function AdminUsuarios() {
  const [params, setParams] = useSearchParams();
  const [lista, setLista] = useState<Usuario[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const perfil = params.get('perfil') ?? '';
  const situacao = params.get('situacao') ?? '';
  const aberto = params.get('id');

  const carregar = useCallback(() => { api<{ usuarios: Usuario[] }>('/api/admin/usuarios').then((r) => setLista(r.usuarios)).catch((e) => setErro(e.message)); }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mudar = (chave: string, valor: string | null) => {
    const p = new URLSearchParams(params);
    if (valor) p.set(chave, valor); else p.delete(chave);
    setParams(p, { replace: chave !== 'id' });
  };

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (lista ?? []).filter((u) => (!perfil || u.papel === perfil) && (!situacao || (situacao === 'power' ? u.power : u.situacao === situacao))
      && (!b || `${u.full_name ?? ''} ${u.email ?? ''} ${u.whatsapp_e164 ?? ''} ${u.equipe?.nome ?? ''}`.toLowerCase().includes(b)));
  }, [lista, busca, perfil, situacao]);

  const contagem = useMemo(() => {
    const c: Record<string, number> = { power: 0 };
    for (const u of lista ?? []) { c[u.situacao] = (c[u.situacao] ?? 0) + 1; if (u.power) c.power++; }
    return c;
  }, [lista]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="rotulo-secao">Gestão de Negócio</span>
        <h1 className="text-[28px] font-bold leading-[34px]">Usuários e planos</h1>
        <p className="text-suave">Quem usa o Orça.ai, com que frequência e em que plano. Toda ação fica registrada com o motivo.</p>
      </header>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}

      <div role="group" aria-label="Uso" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(['', 'ativo', 'em_risco', 'inativo', 'nunca'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={situacao === s} onClick={() => mudar('situacao', s || null)}
            className={cn('flex flex-col rounded-xl border-2 bg-white px-3.5 py-2.5 text-left', situacao === s ? 'border-acao' : 'border-linha')}>
            <span className="text-sm font-semibold text-suave">{s ? SITUACAO[s].nome : 'Todos'}</span>
            <span className="numero text-xl font-black">{s ? contagem[s] ?? 0 : lista?.length ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-1 flex-col gap-1.5 font-semibold">Buscar
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, e-mail, WhatsApp ou equipe" className="h-12 rounded-[10px] border border-borda bg-white px-3" />
        </label>
        <label className="flex flex-col gap-1.5 font-semibold">Perfil
          <select value={perfil} onChange={(e) => mudar('perfil', e.target.value || null)} className="h-12 rounded-[10px] border border-borda bg-white px-3">
            <option value="">Todos</option>
            {(Object.keys(NOME_PAPEL) as Papel[]).map((p) => <option key={p} value={p}>{NOME_PAPEL[p]}</option>)}
          </select>
        </label>
        <button type="button" aria-pressed={situacao === 'power'} onClick={() => mudar('situacao', situacao === 'power' ? null : 'power')}
          className={cn('flex h-12 items-center gap-1.5 rounded-[10px] border-2 bg-white px-3.5 font-bold', situacao === 'power' ? 'border-acao text-acao' : 'border-linha text-texto')}>
          <Zap className="size-4" aria-hidden="true" />Power users ({contagem.power})
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-linha bg-white px-4 sm:px-6">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="text-left text-xs text-suave">
              <th scope="col" className="py-3 pr-2 font-semibold">Usuário</th>
              <th scope="col" className="p-2 font-semibold">Perfil</th>
              <th scope="col" className="p-2 font-semibold">Plano</th>
              <th scope="col" className="p-2 font-semibold">Uso</th>
              <th scope="col" className="p-2 text-right font-semibold">30 dias</th>
              <th scope="col" className="p-2 text-right font-semibold">Total</th>
              <th scope="col" className="py-3 pl-2 font-semibold">Desde</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((u) => (
              <tr key={u.id} className={cn('border-t border-linha', aberto === u.id && 'bg-acao-claro/50')}>
                <td className="py-3 pr-2">
                  <button type="button" onClick={() => mudar('id', u.id)} className="flex flex-col text-left">
                    <span className="font-bold text-acao">{u.full_name ?? 'Sem nome'}</span>
                    <span className="text-xs text-suave">{u.email}</span>
                  </button>
                </td>
                <td className="p-2"><span className="rounded-full bg-cinza px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">{NOME_PAPEL[u.papel] ?? u.papel}</span></td>
                <td className="p-2 text-sm">{textoPlano(u)}</td>
                <td className="p-2">
                  <span className="flex flex-wrap gap-1">
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap', SITUACAO[u.situacao].classe)}>{SITUACAO[u.situacao].nome}</span>
                    {u.power && <span className="flex items-center gap-0.5 rounded-full bg-acao-claro px-2 py-0.5 text-xs font-bold text-acao"><Zap className="size-3" aria-hidden="true" />Power</span>}
                  </span>
                </td>
                <td className="numero p-2 text-right font-bold">{u.orcamentos30d}</td>
                <td className="numero p-2 text-right">{u.total_calculos}</td>
                <td className="py-3 pl-2 text-sm text-suave">{data(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista && filtrados.length === 0 && <p className="py-6 text-suave">Nenhum usuário com esses filtros.</p>}
        {!lista && !erro && <p className="py-6 text-suave" role="status">Carregando…</p>}
      </div>
      <p className="text-xs text-suave">Uso: ativo até 15 dias sem orçar, em risco de 16 a 30, inativo acima de 30. Power user: 20 orçamentos ou mais em 30 dias.</p>

      {aberto && <FichaDoUsuario id={aberto} aoFechar={() => mudar('id', null)} aoMudar={carregar} />}
    </div>
  );
}

type Acao = 'liberar' | 'teste' | 'encerrar' | null;

function FichaDoUsuario({ id, aoFechar, aoMudar }: { id: string; aoFechar: () => void; aoMudar: () => void }) {
  const [f, setF] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<Acao>(null);

  const carregar = useCallback(() => { setErro(null); api<Ficha>(`/api/admin/usuarios/${id}`).then(setF).catch((e) => setErro(e.message)); }, [id]);
  useEffect(() => { setF(null); setAcao(null); carregar(); }, [carregar]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const p = f?.perfil;
  const liberacaoAtiva = f?.assinaturas.some((s) => s.manual && s.vigente);
  const individual = p && p.papel !== 'admin' && !f?.equipe;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-tinta/30" onClick={aoFechar}>
      <aside role="dialog" aria-modal="true" aria-label="Ficha do usuário" onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-lg flex-col gap-5 overflow-y-auto bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="rotulo-secao">Ficha do usuário</span>
            <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{p?.full_name ?? (f ? 'Sem nome' : 'Carregando…')}</h2>
            {p && <span className="text-sm text-suave [overflow-wrap:anywhere]">{p.email}</span>}
          </div>
          <button type="button" onClick={aoFechar} aria-label="Fechar" className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-nevoa"><X className="size-5" aria-hidden="true" /></button>
        </div>
        {erro && <Aviso tom="vermelho">{erro}</Aviso>}
        {f && p && (
          <>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-cinza px-2.5 py-0.5 text-xs font-bold">{NOME_PAPEL[p.papel]}</span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', SITUACAO[f.situacao].classe)}>{SITUACAO[f.situacao].nome}</span>
              {f.power && <span className="rounded-full bg-acao-claro px-2.5 py-0.5 text-xs font-bold text-acao">Power user</span>}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Dado rotulo="Plano" valor={textoPlano({ papel: p.papel, plano: f.assinaturas.find((s) => s.vigente) ?? f.assinaturas[0] ?? null, equipe: f.equipe, trial_expira_em: p.trial_expira_em })} />
              <Dado rotulo="Equipe" valor={f.equipe ? `${f.equipe.nome} (${f.equipe.funcao})` : '—'} />
              <Dado rotulo="WhatsApp" valor={p.whatsapp_e164 ? `${telefoneBonito(p.whatsapp_e164)}${p.whatsapp_verified_at ? '' : ' (não confirmado)'}` : '—'} />
              <Dado rotulo="Telefone" valor={p.telefone ? telefoneBonito(p.telefone) : '—'} />
              <Dado rotulo="Município" valor={p.municipio ? `${p.municipio} · ${p.uf}` : '—'} />
              <Dado rotulo="Origem" valor={f.origem} />
              <Dado rotulo="Cadastro" valor={data(p.created_at)} />
              <Dado rotulo="Último orçamento" valor={f.orcamentos.ultimo ? dataHora(f.orcamentos.ultimo) : '—'} />
              <Dado rotulo="Orçamentos" valor={`${f.orcamentos.total} no total · ${f.orcamentos.ultimos30} em 30 dias`} />
              <Dado rotulo="Pelo agente" valor={`${f.orcamentos.whatsapp} pelo WhatsApp · ${f.orcamentos.site} pelo site`} />
            </dl>

            {individual && (
              <section className="flex flex-col gap-3 rounded-2xl border border-linha p-4">
                <h3 className="font-bold">Ações</h3>
                <div className="flex flex-wrap gap-2">
                  <BotaoAcao ativo={acao === 'liberar'} onClick={() => setAcao(acao === 'liberar' ? null : 'liberar')}>Liberar plano sem cobrança</BotaoAcao>
                  {p.papel === 'trial' && <BotaoAcao ativo={acao === 'teste'} onClick={() => setAcao(acao === 'teste' ? null : 'teste')}>Estender teste</BotaoAcao>}
                  {liberacaoAtiva && <BotaoAcao ativo={acao === 'encerrar'} onClick={() => setAcao(acao === 'encerrar' ? null : 'encerrar')}>Encerrar liberação</BotaoAcao>}
                </div>
                {acao && <FormAcao acao={acao} id={id} aoConcluir={() => { setAcao(null); carregar(); aoMudar(); }} />}
              </section>
            )}
            {p.papel !== 'admin' && f.equipe && <Aviso>O acesso desta conta vem da equipe {f.equipe.nome}. Para mudar o plano, use Equipes.</Aviso>}

            <section className="flex flex-col gap-2">
              <h3 className="font-bold">Histórico de planos</h3>
              {f.assinaturas.length === 0 ? <p className="text-sm text-suave">Nenhuma assinatura.</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {f.assinaturas.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-t border-linha pt-1.5 first:border-t-0 first:pt-0">
                      <span className="font-semibold">{NIVEL[s.nivel] ?? s.nivel} {s.manual ? '· liberação manual' : `· ${PERIODOS[s.plan as Periodo]?.nome.toLowerCase() ?? s.plan}${s.forma_pagamento ? ` (${s.forma_pagamento})` : ''}`}</span>
                      <span className="text-suave">{s.status}{s.vigente ? ' · vigente' : ''} · {data(s.created_at)} a {data(s.current_period_end)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-bold">Auditoria</h3>
              {f.auditoria.length === 0 ? <p className="text-sm text-suave">Nenhuma ação administrativa nesta conta.</p> : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {f.auditoria.map((a, i) => (
                    <li key={i} className="flex flex-col border-t border-linha pt-1.5 first:border-t-0 first:pt-0">
                      <span className="flex justify-between gap-2"><span className="font-semibold">{a.rotulo}</span><span className="text-xs whitespace-nowrap text-suave">{dataHora(a.created_at)}</span></span>
                      {a.motivo && <span className="text-suave">Motivo: {a.motivo}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </aside>
    </div>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs font-semibold text-suave">{rotulo}</dt>
      <dd className="font-semibold text-tinta [overflow-wrap:anywhere]">{valor}</dd>
    </div>
  );
}

function BotaoAcao({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={cn('min-h-10 rounded-full border-2 px-3.5 text-sm font-bold', ativo ? 'border-acao bg-acao-claro text-acao' : 'border-linha text-texto hover:border-tinta')}>
      {children}
    </button>
  );
}

/** Confirma a ação com o efeito explicado e o motivo, que vai para a auditoria. */
function FormAcao({ acao, id, aoConcluir }: { acao: Exclude<Acao, null>; id: string; aoConcluir: () => void }) {
  const [nivel, setNivel] = useState<'pro' | 'usuario'>('pro');
  const [ate, setAte] = useState(daquiA(acao === 'teste' ? 7 : 30));
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const efeito = acao === 'liberar'
    ? `A conta passa a usar o ${nivel === 'pro' ? 'Pró' : 'Starter'} até ${data(`${ate}T12:00:00`)} sem cobrança. Não entra no MRR nem gera cobrança no gateway.`
    : acao === 'teste' ? `O teste passa a valer até ${data(`${ate}T12:00:00`)}.` : 'A liberação manual termina agora. Se não houver assinatura paga, o acesso fica bloqueado.';

  async function confirmar() {
    setOcupado(true); setErro(null);
    try {
      const rota = acao === 'liberar' ? 'liberar' : acao === 'teste' ? 'teste' : 'encerrar';
      await api(`/api/admin/usuarios/${id}/${rota}`, { corpo: acao === 'liberar' ? { nivel, ate, motivo } : acao === 'teste' ? { ate, motivo } : { motivo } });
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally { setOcupado(false); }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-linha pt-3">
      {acao === 'liberar' && (
        <div role="radiogroup" aria-label="Plano" className="grid grid-cols-2 gap-2">
          {(['pro', 'usuario'] as const).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={nivel === n} onClick={() => setNivel(n)}
              className={cn('rounded-xl border-2 bg-white p-2.5 text-left font-bold', nivel === n ? 'border-acao' : 'border-linha')}>{NIVEL[n]}</button>
          ))}
        </div>
      )}
      {acao !== 'encerrar' && <Campo rotulo="Até" type="date" value={ate} min={daquiA(1)} onChange={(e) => setAte(e.target.value)} />}
      <Campo rotulo="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} dica="Fica registrado na auditoria." />
      <Aviso tom="amarelo">{efeito}</Aviso>
      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      <Botao onClick={confirmar} disabled={ocupado || motivo.trim().length < 3 || (acao !== 'encerrar' && !ate)}>{ocupado ? 'Salvando…' : 'Confirmar'}</Botao>
    </div>
  );
}
