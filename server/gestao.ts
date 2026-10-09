import { EQUIPE, PERIODOS, PLANOS, precoEquipe, preco, type Nivel, type Periodo } from '../src/lib/planos';
import { MUNICIPIOS } from '../src/lib/calc/municipios';
import { ErroEquipe } from './equipe';
import { supabaseAdmin } from './supabase';

/**
 * Gestão de Negócio do administrador (fase 1 de DASHBOARD_ADMIN_ORCA_AI.md): indicadores de assinaturas e uso
 * com comparação ao período anterior, gráficos, alertas, atividade recente e a gestão de usuários com auditoria.
 *
 * Regras adotadas (as fórmulas da especificação, com o que o banco tem hoje):
 * - Assinatura vigente numa data: criada até ela, não pendente, dentro de current_period_end e, se cancelada,
 *   cancelada depois dela (updated_at). 'atrasada' segue vigente (carência).
 * - Paga = gateway diferente de 'manual'. Liberações manuais e testes não entram em MRR nem em assinantes.
 * - MRR: valor mensal equivalente do plano no período contratado (trimestral, semestral 10% off, anual 20% off).
 *   Teams usa o tamanho atual da equipe (não há histórico de usuários por data).
 * - Contas de administrador ficam fora das contagens de usuários e assinantes.
 * - Receita recebida e custo de IA ainda não existem no banco: saem como null ("Não disponível"), nunca como zero.
 */

const DIA = 86_400_000;
/** Brasil sem horário de verão: o dia local da administração é UTC−3. */
const FUSO = 3 * 3_600_000;
export const LIMITE_POWER_USER = 20; // orçamentos em 30 dias

export type Granularidade = 'dia' | 'semana' | 'mes';
export interface Faixa { rotulo: string; de: number; ate: number }

export interface PerfilLinha { id: string; papel: string; created_at: string }
export interface AssinaturaLinha {
  user_id: string; plan: string; nivel: string; status: string; gateway: string;
  created_at: string; updated_at: string; current_period_end: string | null;
}
export interface CalculoLinha { user_id: string; tipo: string; origem: string; municipio: string | null; created_at: string }
export interface OrgLinha { id: string; nome: string; tipo: 'teams' | 'clemente'; dono_id: string; assentos_base: number; usuarios: number }

const inicioDoDiaLocal = (t: number) => Math.floor((t - FUSO) / DIA) * DIA + FUSO;
const ddmm = (t: number) => new Date(t - FUSO).toISOString().slice(5, 10).split('-').reverse().join('/');
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Faixas do gráfico e do período: por dia até 31 dias, por semana até 120, por mês acima disso. */
export function faixas(dias: number, agora: number): { granularidade: Granularidade; faixas: Faixa[] } {
  if (dias <= 31) {
    const hoje = inicioDoDiaLocal(agora);
    return {
      granularidade: 'dia',
      faixas: Array.from({ length: dias }, (_, i) => {
        const de = hoje - (dias - 1 - i) * DIA;
        return { rotulo: ddmm(de), de, ate: Math.min(de + DIA, agora) };
      }),
    };
  }
  if (dias <= 120) {
    const n = Math.ceil(dias / 7);
    return {
      granularidade: 'semana',
      faixas: Array.from({ length: n }, (_, i) => {
        const ate = agora - (n - 1 - i) * 7 * DIA;
        return { rotulo: ddmm(ate - 7 * DIA), de: ate - 7 * DIA, ate };
      }),
    };
  }
  const local = new Date(agora - FUSO);
  const n = Math.round(dias / 30.4);
  return {
    granularidade: 'mes',
    faixas: Array.from({ length: n }, (_, i) => {
      const ano = local.getUTCFullYear(), mes = local.getUTCMonth() - (n - 1 - i);
      const de = Date.UTC(ano, mes, 1) + FUSO;
      const ate = Math.min(Date.UTC(ano, mes + 1, 1) + FUSO, agora);
      const d = new Date(de - FUSO);
      return { rotulo: `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`, de, ate };
    }),
  };
}

export function vigente(s: AssinaturaLinha, t: number) {
  if (s.status === 'pendente' || Date.parse(s.created_at) > t) return false;
  if (s.current_period_end && Date.parse(s.current_period_end) <= t) return false;
  if (s.status === 'cancelada' && Date.parse(s.updated_at) <= t) return false;
  return true;
}
const paga = (s: AssinaturaLinha) => s.gateway !== 'manual';

/** Valor mensal equivalente de uma assinatura, em centavos. */
export function mensalEquivalente(s: AssinaturaLinha, orgs: OrgLinha[]) {
  const desconto = PERIODOS[s.plan as Periodo]?.desconto ?? 0;
  if (s.nivel === 'teams') {
    const org = orgs.find((o) => o.dono_id === s.user_id && o.tipo === 'teams');
    const mensal = precoEquipe(org?.usuarios ?? EQUIPE.assentosBase, org?.assentos_base ?? EQUIPE.assentosBase).mensal;
    return Math.round(mensal * (1 - desconto));
  }
  const nivel: Nivel = s.nivel === 'pro' ? 'pro' : 'usuario';
  return s.plan in PERIODOS ? preco(nivel, s.plan as Periodo).porMes : PLANOS[nivel].mensalCentavos;
}

/** Assinantes pagantes (clientes únicos) e MRR numa data. */
export function carteira(assinaturas: AssinaturaLinha[], orgs: OrgLinha[], t: number) {
  const porCliente = new Map<string, number>();
  for (const s of assinaturas) {
    if (!paga(s) || !vigente(s, t)) continue;
    // Duas assinaturas do mesmo cliente não duplicam o cliente; vale a de maior valor.
    porCliente.set(s.user_id, Math.max(porCliente.get(s.user_id) ?? 0, mensalEquivalente(s, orgs)));
  }
  return { clientes: new Set(porCliente.keys()), mrr: [...porCliente.values()].reduce((a, b) => a + b, 0) };
}

const taxa = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 1000) / 10 : null);

export interface Kpi { valor: number | null; anterior: number | null }

/** Indicadores da página principal a partir das linhas do banco (função pura, testada em gestao.test.ts). */
export function indicadores(d: {
  perfis: PerfilLinha[]; assinaturas: AssinaturaLinha[]; calculos: CalculoLinha[]; orgs: OrgLinha[];
}, dias: number, agora: number) {
  const { granularidade, faixas: fx } = faixas(dias, agora);
  const inicio = fx[0].de, fim = agora, duracao = fim - inicio, inicioAnt = inicio - duracao;
  const admins = new Set(d.perfis.filter((p) => p.papel === 'admin').map((p) => p.id));
  const assinaturas = d.assinaturas.filter((s) => !admins.has(s.user_id));
  const perfis = d.perfis.filter((p) => !admins.has(p.id));

  const noIntervalo = (iso: string, de: number, ate: number) => { const t = Date.parse(iso); return t >= de && t < ate; };
  const calcP = d.calculos.filter((c) => noIntervalo(c.created_at, inicio, fim + 1));
  const calcAnt = d.calculos.filter((c) => noIntervalo(c.created_at, inicioAnt, inicio));

  const cFim = carteira(assinaturas, d.orgs, fim);
  const cIni = carteira(assinaturas, d.orgs, inicio);
  const cIniAnt = carteira(assinaturas, d.orgs, inicioAnt);

  const primeiraPaga = new Map<string, number>();
  for (const s of assinaturas) if (paga(s) && s.status !== 'pendente') {
    const t = Date.parse(s.created_at);
    if (!primeiraPaga.has(s.user_id) || t < primeiraPaga.get(s.user_id)!) primeiraPaga.set(s.user_id, t);
  }
  const novosAssinantes = (de: number, ate: number) => [...primeiraPaga.values()].filter((t) => t >= de && t < ate).length;
  const churn = (antes: Set<string>, depois: Set<string>) => taxa([...antes].filter((u) => !depois.has(u)).length, antes.size);
  const cadastrados = (t: number) => perfis.filter((p) => Date.parse(p.created_at) <= t).length;
  const novosUsuarios = (de: number, ate: number) => perfis.filter((p) => noIntervalo(p.created_at, de, ate)).length;
  const ativos = (lista: CalculoLinha[]) => new Set(lista.filter((c) => !admins.has(c.user_id)).map((c) => c.user_id)).size;
  const whatsapp = (lista: CalculoLinha[]) => lista.filter((c) => c.origem === 'whatsapp').length;

  const contar = <K extends string>(lista: CalculoLinha[], chave: (c: CalculoLinha) => K) => {
    const m = new Map<K, number>();
    for (const c of lista) m.set(chave(c), (m.get(chave(c)) ?? 0) + 1);
    return [...m.entries()].map(([k, quantidade]) => ({ chave: k, quantidade, participacao: taxa(quantidade, lista.length) }))
      .sort((a, b) => b.quantidade - a.quantidade);
  };

  const serie = fx.map((f) => {
    const c = carteira(assinaturas, d.orgs, f.ate);
    return {
      rotulo: f.rotulo,
      orcamentos: d.calculos.filter((k) => noIntervalo(k.created_at, f.de, f.ate + (f.ate === agora ? 1 : 0))).length,
      mrr: c.mrr,
      assinantes: c.clientes.size,
    };
  });

  return {
    periodo: { dias, de: new Date(inicio).toISOString(), ate: new Date(fim).toISOString(), granularidade },
    financeiro: {
      mrr: { valor: cFim.mrr, anterior: cIni.mrr } as Kpi,
      assinantes: { valor: cFim.clientes.size, anterior: cIni.clientes.size } as Kpi,
      novosAssinantes: { valor: novosAssinantes(inicio, fim + 1), anterior: novosAssinantes(inicioAnt, inicio) } as Kpi,
      churn: { valor: churn(cIni.clientes, cFim.clientes), anterior: churn(cIniAnt.clientes, cIni.clientes) } as Kpi,
      receitaRecebida: { valor: null, anterior: null } as Kpi,
    },
    uso: {
      orcamentos: { valor: calcP.length, anterior: calcAnt.length } as Kpi,
      usuariosAtivos: { valor: ativos(calcP), anterior: ativos(calcAnt) } as Kpi,
      orcamentosWhatsapp: { valor: whatsapp(calcP), anterior: whatsapp(calcAnt) } as Kpi,
      custoMedioIa: { valor: null, anterior: null } as Kpi,
    },
    base: {
      cadastrados: { valor: cadastrados(fim), anterior: cadastrados(inicio) } as Kpi,
      novosUsuarios: { valor: novosUsuarios(inicio, fim + 1), anterior: novosUsuarios(inicioAnt, inicio) } as Kpi,
      conversao: { valor: taxa(cFim.clientes.size, cadastrados(fim)), anterior: taxa(cIni.clientes.size, cadastrados(inicio)) } as Kpi,
    },
    serie,
    porOperacao: contar(calcP, (c) => c.tipo),
    porCanal: contar(calcP, (c) => (c.origem === 'whatsapp' ? 'whatsapp' : 'site')),
    porMunicipio: contar(calcP, (c) => c.municipio ?? 'nao_informado').slice(0, 10).map((m) => ({
      ...m, nome: m.chave === 'nao_informado' ? 'Não informado' : m.chave === 'mg-outra' ? 'Outras cidades de MG' : MUNICIPIOS[m.chave]?.nome ?? m.chave,
    })),
  };
}

// ---------------- Classificação de usuários ----------------

export type Situacao = 'ativo' | 'em_risco' | 'inativo' | 'nunca';

/** Prioridade Inativo → Em risco → Ativo; "Nunca ativado" para quem não fez orçamento. Power user é marca à parte. */
export function classificar(ultimoOrcamento: string | null, orcamentos30d: number, agora: number) {
  if (!ultimoOrcamento) return { situacao: 'nunca' as Situacao, power: false };
  const dias = (agora - Date.parse(ultimoOrcamento)) / DIA;
  const situacao: Situacao = dias > 30 ? 'inativo' : dias > 15 ? 'em_risco' : 'ativo';
  return { situacao, power: orcamentos30d >= LIMITE_POWER_USER };
}

// ---------------- Leitura do banco ----------------

const db = () => supabaseAdmin();

/** Lê todas as linhas, de mil em mil (limite do PostgREST). */
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const saida: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await consulta(i, i + 999);
    if (error) throw new Error(error.message);
    saida.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return saida;
  }
}

async function orgsComUsuarios(): Promise<OrgLinha[]> {
  const [orgs, membros] = await Promise.all([
    todas<Omit<OrgLinha, 'usuarios'>>((a, b) => db().from('organizacoes').select('id, nome, tipo, dono_id, assentos_base').range(a, b)),
    todas<{ organizacao_id: string }>((a, b) => db().from('organizacao_membros').select('organizacao_id').is('removido_em', null).range(a, b)),
  ]);
  return orgs.map((o) => ({ ...o, usuarios: membros.filter((m) => m.organizacao_id === o.id).length }));
}

const ASSINATURA_COLUNAS = 'user_id, plan, nivel, status, gateway, created_at, updated_at, current_period_end';

export async function visaoGeral(dias: number, agora = Date.now()) {
  const { faixas: fx } = faixas(dias, agora);
  const inicioAnt = fx[0].de - (agora - fx[0].de);
  const [perfis, assinaturas, calculos, orgs, tabelas, auditoria] = await Promise.all([
    todas<PerfilLinha & { full_name: string | null; email: string | null; trial_expira_em: string | null }>((a, b) =>
      db().from('profiles').select('id, papel, created_at, full_name, email, trial_expira_em').order('created_at').range(a, b)),
    todas<AssinaturaLinha & { id: string }>((a, b) => db().from('subscriptions').select(`id, ${ASSINATURA_COLUNAS}`).order('created_at').range(a, b)),
    todas<CalculoLinha>((a, b) => db().from('calculations').select('user_id, tipo, origem, municipio, created_at')
      .gte('created_at', new Date(inicioAnt).toISOString()).order('created_at').range(a, b)),
    orgsComUsuarios(),
    todas<{ tipo: string; ano: number; created_at: string }>((a, b) => db().from('tabelas_anuais').select('tipo, ano, created_at').range(a, b)),
    db().from('admin_auditoria').select('acao, objeto_tipo, objeto_id, motivo, created_at').order('created_at', { ascending: false }).limit(10),
  ]);

  const nome = (id: string) => { const p = perfis.find((x) => x.id === id); return p?.full_name || p?.email || 'Conta removida'; };
  const ind = indicadores({ perfis, assinaturas, calculos, orgs }, dias, agora);

  // ---- Alertas (até dez, por severidade) ----
  type Alerta = { severidade: 'alta' | 'media' | 'baixa'; categoria: string; titulo: string; detalhe: string; destino: string };
  const alertas: Alerta[] = [];
  for (const s of assinaturas.filter((x) => x.status === 'atrasada')) {
    alertas.push({ severidade: 'alta', categoria: 'Pagamentos', titulo: 'Cobrança atrasada', detalhe: nome(s.user_id), destino: `/app/admin/usuarios?id=${s.user_id}` });
  }
  const carteiraAgora = carteira(assinaturas, orgs, agora);
  for (const o of orgs.filter((x) => x.tipo === 'teams')) {
    const liberada = assinaturas.some((s) => s.user_id === o.dono_id && s.nivel === 'teams' && vigente(s, agora));
    if (!liberada) alertas.push({ severidade: 'media', categoria: 'Equipes', titulo: 'Equipe Teams sem plano ativo', detalhe: `${o.nome}: os usuários estão sem acesso`, destino: '/app/admin/equipes' });
  }
  for (const s of assinaturas.filter((x) => x.gateway === 'manual' && x.current_period_end && vigente(x, agora)
    && Date.parse(x.current_period_end!) - agora < 7 * DIA)) {
    alertas.push({ severidade: 'media', categoria: 'Assinaturas', titulo: 'Liberação manual perto do fim', detalhe: `${nome(s.user_id)} · até ${new Date(s.current_period_end!).toLocaleDateString('pt-BR')}`, destino: `/app/admin/usuarios?id=${s.user_id}` });
  }
  const ano = new Date(agora - FUSO).getUTCFullYear(), mes = new Date(agora - FUSO).getUTCMonth();
  const NOME_TABELA: Record<string, string> = { emolumentos: 'Emolumentos (TJMG)', incc: 'INCC', itbiJf: 'ITBI no SFH (Juiz de Fora)' };
  for (const tipo of Object.keys(NOME_TABELA)) {
    const anos = tabelas.filter((t) => t.tipo === tipo).map((t) => t.ano);
    if (ano > 2026 && !anos.includes(ano)) {
      alertas.push({ severidade: 'alta', categoria: 'Tabelas', titulo: `Tabela de ${ano} não publicada`, detalhe: `${NOME_TABELA[tipo]}: os cálculos usam a última versão disponível`, destino: '/app/admin/tabelas' });
    } else if (mes >= 10 && !anos.includes(ano + 1)) {
      alertas.push({ severidade: 'baixa', categoria: 'Tabelas', titulo: `Preparar a tabela de ${ano + 1}`, detalhe: `${NOME_TABELA[tipo]} vale até 31/12`, destino: '/app/admin/tabelas' });
    }
  }
  const trialsAcabando = perfis.filter((p) => p.papel === 'trial' && p.trial_expira_em
    && Date.parse(p.trial_expira_em) > agora && Date.parse(p.trial_expira_em) - agora < 2 * DIA);
  if (trialsAcabando.length) alertas.push({ severidade: 'baixa', categoria: 'Conversão', titulo: `${trialsAcabando.length} teste(s) terminando em 48 horas`, detalhe: trialsAcabando.slice(0, 3).map((p) => nome(p.id)).join(', '), destino: '/app/admin/usuarios?perfil=trial' });
  const peso = { alta: 0, media: 1, baixa: 2 };
  alertas.sort((a, b) => peso[a.severidade] - peso[b.severidade]);

  // ---- Atividade recente ----
  type Evento = { tipo: string; texto: string; data: string; destino?: string };
  const eventos: Evento[] = [
    ...perfis.slice(-10).map((p) => ({ tipo: 'Cadastro', texto: nome(p.id), data: p.created_at, destino: `/app/admin/usuarios?id=${p.id}` })),
    ...assinaturas.slice(-10).map((s) => ({
      tipo: s.gateway === 'manual' ? 'Liberação manual' : 'Nova assinatura',
      texto: `${nome(s.user_id)} · ${s.nivel === 'unlimited' ? 'Unlimited' : `${s.nivel === 'teams' ? 'Teams' : s.nivel === 'pro' ? 'Pró' : 'Starter'} ${PERIODOS[s.plan as Periodo]?.nome.toLowerCase() ?? s.plan}`}`,
      data: s.created_at, destino: `/app/admin/usuarios?id=${s.user_id}`,
    })),
    ...assinaturas.filter((s) => s.status === 'cancelada').map((s) => ({ tipo: 'Cancelamento', texto: nome(s.user_id), data: s.updated_at, destino: `/app/admin/usuarios?id=${s.user_id}` })),
    ...tabelas.map((t) => ({ tipo: 'Tabela publicada', texto: `${NOME_TABELA[t.tipo] ?? t.tipo} ${t.ano}`, data: t.created_at, destino: '/app/admin/tabelas' })),
    ...(auditoria.data ?? []).map((a) => ({ tipo: 'Ação administrativa', texto: `${ROTULO_ACAO[a.acao] ?? a.acao}${a.objeto_tipo === 'usuario' ? ` · ${nome(a.objeto_id)}` : ''}`, data: a.created_at,
      destino: a.objeto_tipo === 'usuario' ? `/app/admin/usuarios?id=${a.objeto_id}` : '/app/admin/equipes' })),
  ].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10);

  const perfisPorPapel: Record<string, number> = {};
  for (const p of perfis) perfisPorPapel[p.papel] = (perfisPorPapel[p.papel] ?? 0) + 1;

  return {
    ...ind,
    atualizadoEm: new Date(agora).toISOString(),
    perfis: perfisPorPapel,
    equipes: { total: orgs.length, usuarios: orgs.reduce((s, o) => s + o.usuarios, 0), pagantes: [...carteiraAgora.clientes].filter((u) => orgs.some((o) => o.dono_id === u)).length },
    alertas: alertas.slice(0, 10),
    totalAlertas: alertas.length,
    atividade: eventos,
  };
}

export const ROTULO_ACAO: Record<string, string> = {
  liberar_plano: 'Plano liberado sem cobrança',
  encerrar_liberacao: 'Liberação manual encerrada',
  estender_teste: 'Teste estendido',
  criar_equipe: 'Equipe criada',
  mudar_pacote: 'Pacote da equipe alterado',
  liberar_equipe: 'Equipe liberada sem cobrança',
};

// ---------------- Usuários ----------------

export async function listarUsuarios(agora = Date.now()) {
  const desde = new Date(agora - 30 * DIA).toISOString();
  const [clientes, recentes, membros, assinaturas] = await Promise.all([
    todas<{
      id: string; full_name: string | null; email: string | null; whatsapp_e164: string | null; papel: string; trial_expira_em: string | null;
      created_at: string; total_calculos: number; ultimo_calculo: string | null;
    }>((a, b) => db().from('admin_clientes').select('id, full_name, email, whatsapp_e164, papel, trial_expira_em, created_at, total_calculos, ultimo_calculo')
      .order('created_at', { ascending: false }).range(a, b)),
    todas<{ user_id: string; origem: string }>((a, b) => db().from('calculations').select('user_id, origem').gte('created_at', desde).range(a, b)),
    todas<{ user_id: string; funcao: string; organizacao: { nome: string } | null }>((a, b) =>
      db().from('organizacao_membros').select('user_id, funcao, organizacao:organizacoes(nome)').is('removido_em', null).not('user_id', 'is', null).range(a, b)),
    todas<AssinaturaLinha>((a, b) => db().from('subscriptions').select(ASSINATURA_COLUNAS).order('created_at', { ascending: false }).range(a, b)),
  ]);
  return clientes.map((c) => {
    const ult30 = recentes.filter((r) => r.user_id === c.id);
    const equipe = membros.find((m) => m.user_id === c.id);
    return {
      ...c,
      orcamentos30d: ult30.length,
      ...classificar(c.ultimo_calculo, ult30.length, agora),
      equipe: equipe ? { nome: equipe.organizacao?.nome ?? '', funcao: equipe.funcao } : null,
      plano: resumoDoPlano(assinaturas.filter((s) => s.user_id === c.id), agora),
    };
  });
}

/** Assinatura que vale hoje (ou a última, se nenhuma vale). */
export function resumoDoPlano(lista: AssinaturaLinha[], agora: number) {
  const s = lista.find((x) => vigente(x, agora)) ?? lista[0];
  if (!s) return null;
  return { nivel: s.nivel, plan: s.plan, status: s.status, manual: s.gateway === 'manual', vigente: vigente(s, agora), ate: s.current_period_end };
}

export async function fichaDoUsuario(id: string, agora = Date.now()) {
  const [{ data: p }, { data: subs }, { data: membro }, { data: calcs }, { data: audit }] = await Promise.all([
    db().from('profiles').select('id, full_name, email, telefone, whatsapp_e164, whatsapp_verified_at, papel, created_at, trial_expira_em, municipio_padrao, cidade_nome, uf, indicado_por').eq('id', id).maybeSingle(),
    db().from('subscriptions').select(`${ASSINATURA_COLUNAS}, forma_pagamento`).eq('user_id', id).order('created_at', { ascending: false }),
    db().from('organizacao_membros').select('funcao, organizacao:organizacoes(nome, tipo)').eq('user_id', id).is('removido_em', null).maybeSingle(),
    db().from('calculations').select('origem, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(5000),
    db().from('admin_auditoria').select('acao, motivo, antes, depois, created_at, ator_id').eq('objeto_tipo', 'usuario').eq('objeto_id', id).order('created_at', { ascending: false }).limit(50),
  ]);
  if (!p) throw new ErroEquipe('Usuário não encontrado.', 404);
  const lista = calcs ?? [];
  const ult30 = lista.filter((c) => Date.parse(c.created_at) > agora - 30 * DIA).length;
  const indicador = p.indicado_por ? (await db().from('profiles').select('full_name, email').eq('id', p.indicado_por).maybeSingle()).data : null;
  return {
    perfil: { ...p, municipio: p.municipio_padrao === 'mg-outra' ? p.cidade_nome : MUNICIPIOS[p.municipio_padrao]?.nome ?? p.municipio_padrao },
    origem: indicador ? `Indicação de ${indicador.full_name || indicador.email}` : 'Cadastro direto',
    equipe: membro ? { ...(membro.organizacao as unknown as { nome: string; tipo: string }), funcao: membro.funcao } : null,
    orcamentos: { total: lista.length, site: lista.filter((c) => c.origem === 'site').length, whatsapp: lista.filter((c) => c.origem === 'whatsapp').length, ultimos30: ult30, ultimo: lista[0]?.created_at ?? null },
    ...classificar(lista[0]?.created_at ?? null, ult30, agora),
    assinaturas: (subs ?? []).map((s) => ({ ...s, manual: s.gateway === 'manual', vigente: vigente(s as AssinaturaLinha, agora) })),
    auditoria: (audit ?? []).map((a) => ({ ...a, rotulo: ROTULO_ACAO[a.acao] ?? a.acao })),
  };
}

// ---------------- Ações com auditoria ----------------

export async function registrar(atorId: string, acao: string, objeto: { tipo: 'usuario' | 'organizacao'; id: string }, extra: { motivo?: string | null; antes?: unknown; depois?: unknown } = {}) {
  const { error } = await db().from('admin_auditoria').insert({
    ator_id: atorId, acao, objeto_tipo: objeto.tipo, objeto_id: objeto.id, motivo: extra.motivo ?? null, antes: extra.antes ?? null, depois: extra.depois ?? null,
  });
  if (error) console.error('Auditoria:', error.message);
}

async function alvoIndividual(id: string) {
  const { data: p } = await db().from('profiles').select('id, papel, trial_expira_em').eq('id', id).maybeSingle();
  if (!p) throw new ErroEquipe('Usuário não encontrado.', 404);
  if (p.papel === 'admin') throw new ErroEquipe('Contas de administrador não têm plano.');
  const { data: membro } = await db().from('organizacao_membros').select('id').eq('user_id', id).is('removido_em', null).limit(1).maybeSingle();
  return { ...p, emEquipe: !!membro };
}

/** Libera Starter ou Pró sem cobrança até uma data (assinatura com gateway 'manual'; não entra no MRR). */
export async function liberarPlano(atorId: string, id: string, d: { nivel: 'usuario' | 'pro'; ate: string; motivo: string }) {
  const alvo = await alvoIndividual(id);
  if (alvo.emEquipe) throw new ErroEquipe('Esta conta faz parte de uma equipe: o acesso vem do plano da equipe.');
  const ate = new Date(`${d.ate}T23:59:59-03:00`);
  if (!(ate.getTime() > Date.now())) throw new ErroEquipe('Escolha uma data futura.');
  const { error } = await db().from('subscriptions').insert({
    user_id: id, plan: 'trimestral', nivel: d.nivel, status: 'ativa', gateway: 'manual', current_period_end: ate.toISOString(),
  });
  if (error) throw new Error(error.message);
  await registrar(atorId, 'liberar_plano', { tipo: 'usuario', id }, { motivo: d.motivo, antes: { papel: alvo.papel }, depois: { nivel: d.nivel, ate: ate.toISOString() } });
  return { ok: true };
}

export async function encerrarLiberacao(atorId: string, id: string, motivo: string) {
  const { data, error } = await db().from('subscriptions').update({ status: 'cancelada', updated_at: new Date().toISOString() })
    .eq('user_id', id).eq('gateway', 'manual').eq('status', 'ativa').select('nivel, current_period_end');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new ErroEquipe('Não há liberação manual ativa nesta conta.', 404);
  await registrar(atorId, 'encerrar_liberacao', { tipo: 'usuario', id }, { motivo, antes: data });
  return { ok: true };
}

export async function estenderTeste(atorId: string, id: string, d: { ate: string; motivo: string }) {
  const alvo = await alvoIndividual(id);
  if (alvo.papel !== 'trial') throw new ErroEquipe('Só contas em teste podem ter o teste estendido.');
  const ate = new Date(`${d.ate}T23:59:59-03:00`);
  if (!(ate.getTime() > Date.now())) throw new ErroEquipe('Escolha uma data futura.');
  const { error } = await db().from('profiles').update({ trial_expira_em: ate.toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  await registrar(atorId, 'estender_teste', { tipo: 'usuario', id }, { motivo: d.motivo, antes: { trial_expira_em: alvo.trial_expira_em }, depois: { trial_expira_em: ate.toISOString() } });
  return { ok: true };
}
