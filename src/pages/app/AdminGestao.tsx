import { useCallback, useEffect, useId, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, Minus, RefreshCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '@/lib/api';
import { NOME_TIPO } from '@/hooks/useCalculos';
import { NOME_PAPEL, type Papel } from '@/lib/config';
import { brl, dataHora } from '@/lib/formato';
import { Aviso, Cartao } from '@/components/ui/Campos';
import { cn } from '@/lib/utils';

interface Kpi { valor: number | null; anterior: number | null }
interface Fatia { chave: string; quantidade: number; participacao: number | null; nome?: string }
interface Visao {
  periodo: { dias: number; de: string; ate: string; granularidade: 'dia' | 'semana' | 'mes' };
  atualizadoEm: string;
  financeiro: { mrr: Kpi; assinantes: Kpi; novosAssinantes: Kpi; churn: Kpi; receitaRecebida: Kpi };
  uso: { orcamentos: Kpi; usuariosAtivos: Kpi; orcamentosWhatsapp: Kpi; custoMedioIa: Kpi };
  base: { cadastrados: Kpi; novosUsuarios: Kpi; conversao: Kpi };
  serie: { rotulo: string; orcamentos: number; mrr: number; assinantes: number }[];
  porOperacao: Fatia[];
  porCanal: Fatia[];
  porMunicipio: Fatia[];
  perfis: Partial<Record<Papel, number>>;
  equipes: { total: number; usuarios: number; pagantes: number };
  alertas: { severidade: 'alta' | 'media' | 'baixa'; categoria: string; titulo: string; detalhe: string; destino: string }[];
  totalAlertas: number;
  atividade: { tipo: string; texto: string; data: string; destino?: string }[];
}

type Formato = 'brl' | 'num' | 'pct';
const PERIODOS = [7, 30, 90, 365];
const ORDEM_PAPEIS: Papel[] = ['teams', 'clemente', 'pro', 'usuario', 'trial', 'admin'];
const NOME_GRAN = { dia: 'por dia', semana: 'por semana', mes: 'por mês' };

const numero = (n: number) => n.toLocaleString('pt-BR');
const formatar = (v: number, f: Formato) => (f === 'brl' ? brl(v / 100) : f === 'pct' ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : numero(v));

/** Gestão de Negócio → Visão geral (fase 1 de DASHBOARD_ADMIN_ORCA_AI.md). */
export default function AdminGestao() {
  const [params, setParams] = useSearchParams();
  const dias = PERIODOS.includes(Number(params.get('dias'))) ? Number(params.get('dias')) : 30;
  const [v, setV] = useState<Visao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true); setErro(null);
    api<Visao>(`/api/admin/visao?dias=${dias}`).then(setV).catch((e) => setErro(e.message)).finally(() => setCarregando(false));
  }, [dias]);
  useEffect(() => { carregar(); }, [carregar]);

  const anterior = 'vs. período anterior';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="rotulo-secao">Gestão de Negócio</span>
          <h1 className="text-[28px] font-bold leading-[34px]">Visão geral</h1>
          <p className="text-sm text-suave">
            {v ? `Atualizado às ${new Date(v.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · comparação com os ${dias === 365 ? '12 meses' : `${dias} dias`} anteriores` : 'Receita, uso e crescimento do Orça.ai'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Período" className="flex rounded-full border border-linha bg-white p-1">
            {PERIODOS.map((d) => (
              <button key={d} type="button" aria-pressed={dias === d} onClick={() => setParams(d === 30 ? {} : { dias: String(d) })}
                className={cn('min-h-10 rounded-full px-3 text-sm font-bold whitespace-nowrap', dias === d ? 'bg-tinta text-white' : 'text-suave hover:text-texto')}>
                {d === 365 ? '12 meses' : `${d} dias`}
              </button>
            ))}
          </div>
          <button type="button" onClick={carregar} disabled={carregando} className="flex min-h-11 items-center gap-1.5 rounded-full border border-linha bg-white px-4 text-sm font-bold text-texto hover:border-tinta disabled:opacity-60">
            <RefreshCw className={cn('size-4', carregando && 'animate-spin')} aria-hidden="true" />Atualizar
          </button>
        </div>
      </header>

      {erro && <Aviso tom="vermelho">{erro}</Aviso>}
      {!v ? (!erro && <span className="text-suave" role="status">Carregando…</span>) : (
        <>
          <section aria-labelledby="t-fin" className="flex flex-col gap-3">
            <h2 id="t-fin" className="text-sm font-bold uppercase tracking-[0.12em] text-suave">Financeiro e assinaturas</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador rotulo="MRR" kpi={v.financeiro.mrr} formato="brl" comparacao="vs. início do período"
                definicao="Receita recorrente mensal: soma do valor mensal equivalente das assinaturas pagas vigentes hoje (trimestral, semestral e anual divididos pelos meses). Liberações manuais e testes ficam fora. Valores provisórios até a cobrança no Stripe." />
              <Indicador rotulo="Assinantes ativos" kpi={v.financeiro.assinantes} formato="num" comparacao="vs. início do período"
                definicao="Clientes únicos com ao menos uma assinatura paga vigente. Cobrança atrasada continua contando (carência). Uma equipe Teams conta como um cliente." />
              <Indicador rotulo="Novos assinantes" kpi={v.financeiro.novosAssinantes} formato="num" comparacao={anterior}
                definicao="Clientes cuja primeira assinatura paga começou no período." />
              <Indicador rotulo="Churn" kpi={v.financeiro.churn} formato="pct" comparacao={anterior} menorMelhor
                definicao="Assinantes ativos no início do período que terminaram sem assinatura paga vigente, divididos pelos ativos no início." />
            </div>
          </section>

          <section aria-labelledby="t-uso" className="flex flex-col gap-3">
            <h2 id="t-uso" className="text-sm font-bold uppercase tracking-[0.12em] text-suave">Utilização</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador rotulo="Orçamentos realizados" kpi={v.uso.orcamentos} formato="num" comparacao={anterior}
                definicao="Orçamentos concluídos e salvos no período, pelo site e pelo WhatsApp." />
              <Indicador rotulo="Usuários ativos" kpi={v.uso.usuariosAtivos} formato="num" comparacao={anterior}
                definicao="Pessoas que fizeram pelo menos um orçamento no período. Só entrar no site não conta." />
              <Indicador rotulo="Orçamentos pelo agente" kpi={v.uso.orcamentosWhatsapp} formato="num" comparacao={anterior}
                definicao="Orçamentos feitos pelo agente de IA no WhatsApp." />
              <Indicador rotulo="Gasto médio de IA por orçamento" kpi={v.uso.custoMedioIa} formato="brl" comparacao={anterior} menorMelhor
                definicao="Gasto conhecido com IA e mensagens dividido pelos orçamentos do agente. Esses gastos ainda não são registrados, por isso aparece como não disponível." />
            </div>
          </section>

          <section aria-label="Resumo complementar" className="grid gap-px overflow-hidden rounded-2xl border border-linha bg-linha sm:grid-cols-2 xl:grid-cols-4">
            <Resumo rotulo="Receita recebida" kpi={v.financeiro.receitaRecebida} formato="brl" nota="Entra com a cobrança no Stripe" />
            <Resumo rotulo="Usuários cadastrados" kpi={v.base.cadastrados} formato="num" />
            <Resumo rotulo="Novos usuários" kpi={v.base.novosUsuarios} formato="num" />
            <Resumo rotulo="Conversão da base em assinantes" kpi={v.base.conversao} formato="pct" nota="Assinantes ÷ cadastrados, hoje" />
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Cartao titulo="Receita e assinantes">
              <p className="mb-3 text-sm text-suave">No fim de cada {v.periodo.granularidade === 'dia' ? 'dia' : v.periodo.granularidade === 'semana' ? 'semana' : 'mês'}, em gráficos separados: reais e pessoas não se comparam na mesma escala.</p>
              <div className="flex flex-col gap-4">
                <Serie dados={v.serie} chave="mrr" nome="MRR" formato="brl" />
                <Serie dados={v.serie} chave="assinantes" nome="Assinantes ativos" formato="num" />
              </div>
            </Cartao>
            <Cartao titulo="Orçamentos por operação">
              <Barras itens={v.porOperacao.map((o) => ({ ...o, nome: NOME_TIPO[o.chave] ?? o.chave }))} vazio="Nenhum orçamento no período." />
            </Cartao>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Cartao titulo={`Orçamentos ${NOME_GRAN[v.periodo.granularidade]}`}>
              <Serie dados={v.serie} chave="orcamentos" nome="Orçamentos" formato="num" area alto />
            </Cartao>
            <div className="flex flex-col gap-6">
              <Cartao titulo="Por canal">
                <Barras itens={v.porCanal.map((c) => ({ ...c, nome: c.chave === 'whatsapp' ? 'WhatsApp (agente)' : 'Site' }))} vazio="Sem orçamentos no período." />
              </Cartao>
              <Cartao titulo="Municípios mais orçados">
                <Barras itens={v.porMunicipio.map((m) => ({ ...m, nome: m.nome ?? m.chave }))} vazio="Sem orçamentos no período." />
                <p className="mt-3 text-xs text-suave">Município do imóvel no orçamento. O mapa por estado entra quando houver cidades fora de MG.</p>
              </Cartao>
            </div>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Cartao titulo={`Alertas${v.totalAlertas ? ` (${v.totalAlertas})` : ''}`}>
              {v.alertas.length === 0 ? <p className="text-suave">Nenhum alerta agora.</p> : (
                <ul className="flex flex-col gap-2">
                  {v.alertas.map((a, i) => (
                    <li key={i}>
                      <Link to={a.destino} className="flex items-start gap-3 rounded-xl border border-linha p-3 no-underline hover:border-tinta">
                        <span className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase',
                          a.severidade === 'alta' ? 'bg-minas-claro text-minas-texto' : a.severidade === 'media' ? 'bg-amarelo-claro text-amarelo-texto' : 'bg-cinza text-texto')}>
                          {a.severidade === 'alta' ? 'Alta' : a.severidade === 'media' ? 'Média' : 'Baixa'}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-bold text-tinta">{a.titulo}</span>
                          <span className="text-sm text-suave">{a.categoria} · {a.detalhe}</span>
                        </span>
                        <ArrowRight className="mt-1 size-4 shrink-0 text-suave" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
            <Cartao titulo="Atividade recente">
              {v.atividade.length === 0 ? <p className="text-suave">Nada por aqui ainda.</p> : (
                <ol className="flex flex-col">
                  {v.atividade.map((e, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 border-t border-linha py-2.5 first:border-t-0 first:pt-0">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-xs font-bold uppercase tracking-[0.08em] text-suave">{e.tipo}</span>
                        {e.destino ? <Link to={e.destino} className="truncate font-semibold text-tinta">{e.texto}</Link> : <span className="truncate font-semibold">{e.texto}</span>}
                      </span>
                      <span className="shrink-0 text-xs whitespace-nowrap text-suave">{dataHora(e.data)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Cartao>
          </div>

          <Cartao titulo="Contas por perfil">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {ORDEM_PAPEIS.map((p) => (
                <li key={p}>
                  <Link to={`/app/admin/usuarios?perfil=${p}`} className="flex flex-col rounded-xl bg-nevoa px-3.5 py-3 no-underline hover:bg-cinza">
                    <span className="text-sm font-semibold text-suave">{NOME_PAPEL[p]}</span>
                    <span className="numero text-2xl font-black text-tinta">{numero(v.perfis[p] ?? 0)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-suave">{v.equipes.total} equipes com {v.equipes.usuarios} usuários. <Link to="/app/admin/equipes" className="font-bold text-acao">Ver equipes</Link></p>
          </Cartao>
        </>
      )}
    </div>
  );
}

/** Explicação do cálculo: abre por clique ou teclado (não só ao passar o mouse). */
function Dica({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false);
  const id = useId();
  return (
    <span className="relative">
      <button type="button" aria-expanded={aberta} aria-controls={id} aria-label="Como calculamos" onClick={() => setAberta(!aberta)} onBlur={() => setAberta(false)}
        className="flex size-7 items-center justify-center rounded-full text-suave hover:bg-nevoa hover:text-texto">
        <Info className="size-4" aria-hidden="true" />
      </button>
      {aberta && (
        <span id={id} role="tooltip" className="absolute top-8 right-0 z-20 w-64 rounded-xl border border-linha bg-white p-3 text-xs font-medium leading-5 text-texto shadow-lg">{texto}</span>
      )}
    </span>
  );
}

function Variacao({ kpi, formato, menorMelhor, comparacao }: { kpi: Kpi; formato: Formato; menorMelhor?: boolean; comparacao: string }) {
  if (kpi.valor == null) return <span className="text-xs text-suave">Sem dados para comparar</span>;
  if (kpi.anterior == null) return <span className="text-xs text-suave">Sem base de comparação</span>;
  const dif = kpi.valor - kpi.anterior;
  let texto: string;
  if (formato === 'pct') texto = `${dif > 0 ? '+' : ''}${dif.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
  else if (kpi.anterior === 0) return <span className="text-xs text-suave">Sem base de comparação{dif ? ` (${dif > 0 ? '+' : ''}${formatar(dif, formato)})` : ''}</span>;
  else texto = `${dif > 0 ? '+' : ''}${((dif / kpi.anterior) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const bom = dif === 0 ? null : (dif > 0) !== !!menorMelhor;
  const Icone = dif === 0 ? Minus : dif > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex flex-wrap items-center gap-1 text-xs">
      <span className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold', bom == null ? 'bg-cinza text-texto' : bom ? 'bg-ok-claro text-ok' : 'bg-minas-claro text-minas-texto')}>
        <Icone className="size-3.5" aria-hidden="true" />{texto}
      </span>
      <span className="text-suave">{comparacao}</span>
    </span>
  );
}

function Indicador({ rotulo, kpi, formato, definicao, comparacao, menorMelhor }: {
  rotulo: string; kpi: Kpi; formato: Formato; definicao: string; comparacao: string; menorMelhor?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-linha bg-white p-5">
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-suave">{rotulo}</span>
        <Dica texto={definicao} />
      </span>
      <span className={cn('numero font-black leading-8 [overflow-wrap:anywhere]', kpi.valor == null ? 'text-lg text-suave' : 'text-[26px]')}>
        {kpi.valor == null ? 'Não disponível' : formatar(kpi.valor, formato)}
      </span>
      <Variacao kpi={kpi} formato={formato} menorMelhor={menorMelhor} comparacao={comparacao} />
    </div>
  );
}

function Resumo({ rotulo, kpi, formato, nota }: { rotulo: string; kpi: Kpi; formato: Formato; nota?: string }) {
  return (
    <div className="flex flex-col gap-1 bg-white px-5 py-4">
      <span className="text-sm font-semibold text-suave">{rotulo}</span>
      <span className={cn('numero font-black', kpi.valor == null ? 'text-base text-suave' : 'text-xl')}>{kpi.valor == null ? 'Não disponível' : formatar(kpi.valor, formato)}</span>
      {nota ? <span className="text-xs text-suave">{nota}</span> : <Variacao kpi={kpi} formato={formato} comparacao="vs. período anterior" />}
    </div>
  );
}

function Serie({ dados, chave, nome, formato, area, alto }: {
  dados: Visao['serie']; chave: 'mrr' | 'assinantes' | 'orcamentos'; nome: string; formato: Formato; area?: boolean; alto?: boolean;
}) {
  const fmt = (n: number) => formatar(n, formato);
  const eixo = (n: number) => (formato === 'brl' ? `R$${Math.round(n / 100).toLocaleString('pt-BR')}` : numero(n));
  const margem = { top: 8, right: 8, bottom: 0, left: 0 };
  const grade = <CartesianGrid stroke="#e4e7ec" vertical={false} />;
  const x = <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: '#556070' }} tickLine={false} axisLine={false} minTickGap={16} />;
  const y = <YAxis tickFormatter={eixo} tick={{ fontSize: 11, fill: '#556070' }} tickLine={false} axisLine={false} width={formato === 'brl' ? 64 : 36} allowDecimals={false} />;
  const dica = <Tooltip formatter={(n) => [fmt(Number(n)), nome]} labelStyle={{ fontWeight: 700 }} contentStyle={{ borderRadius: 12, borderColor: '#e4e7ec' }} />;
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs font-bold text-suave">{nome}</figcaption>
      <div className={alto ? 'h-56' : 'h-36'} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {area ? (
            <AreaChart data={dados} margin={margem}>{grade}{x}{y}{dica}<Area type="monotone" dataKey={chave} name={nome} stroke="#2342d6" fill="#e6ebff" strokeWidth={2} /></AreaChart>
          ) : (
            <LineChart data={dados} margin={margem}>{grade}{x}{y}{dica}<Line type="monotone" dataKey={chave} name={nome} stroke="#2342d6" strokeWidth={2} dot={false} /></LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {/* Tabela equivalente, para leitor de tela e para consultar os números. */}
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-bold text-acao">Ver em tabela</summary>
        <div className="mt-2 max-h-48 overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead><tr className="text-xs text-suave"><th scope="col" className="py-1 font-semibold">Período</th><th scope="col" className="py-1 text-right font-semibold">{nome}</th></tr></thead>
            <tbody>{dados.map((d) => <tr key={d.rotulo} className="border-t border-linha"><td className="py-1">{d.rotulo}</td><td className="numero py-1 text-right">{fmt(d[chave])}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function Barras({ itens, vazio }: { itens: (Fatia & { nome: string })[]; vazio: string }) {
  if (!itens.length) return <p className="text-suave">{vazio}</p>;
  const maior = Math.max(...itens.map((i) => i.quantidade));
  return (
    <ul className="flex flex-col gap-2.5">
      {itens.map((i) => (
        <li key={i.chave} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-tinta">{i.nome}</span>
            <span className="numero whitespace-nowrap text-suave"><strong className="text-tinta">{numero(i.quantidade)}</strong>{i.participacao != null ? ` · ${i.participacao.toLocaleString('pt-BR')}%` : ''}</span>
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-nevoa" aria-hidden="true">
            <span className="block h-full rounded-full bg-acao" style={{ width: `${Math.max(2, (i.quantidade / maior) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
