import { precoEquipe } from '../src/lib/planos';
import { config } from './config';
import { supabaseAdmin } from './supabase';
import { variantesTelefone } from './telefone';
import type { CalculoSalvo } from './historico';

/**
 * Organizações (imobiliárias e Clemente Team): o gestor inclui, altera e remove usuários (nome e telefone,
 * e-mail opcional para entrar no site) e acompanha os orçamentos da equipe. Regras de acesso no banco
 * (supabase/migrations/20261015000001_organizacoes.sql).
 */

export type TipoOrganizacao = 'teams' | 'clemente';

export interface Organizacao {
  id: string;
  nome: string;
  tipo: TipoOrganizacao;
  dono_id: string;
  assentos_base: number;
  created_at: string;
}

export interface Membro {
  id: string;
  organizacao_id: string;
  user_id: string | null;
  nome: string;
  telefone_e164: string;
  email: string | null;
  funcao: 'gestor' | 'colaborador';
  removido_em: string | null;
  created_at: string;
}

export interface DadosMembro { nome: string; telefone: string; email?: string | null }
export interface NovaOrganizacao { nome: string; tipo: TipoOrganizacao; emailGestor: string; telefoneGestor?: string | null; assentosBase: number }

/** Erro com mensagem para mostrar ao gestor (vira 400/409 na rota). */
export class ErroEquipe extends Error {
  constructor(mensagem: string, public status = 400) { super(mensagem); }
}

const db = () => supabaseAdmin();

/** Organização ativa do usuário e a função dele nela. */
export async function vinculoDoUsuario(userId: string): Promise<{ organizacao: Organizacao; funcao: Membro['funcao'] } | null> {
  const { data } = await db().from('organizacao_membros')
    .select('funcao, organizacao:organizacoes(*)')
    .eq('user_id', userId).is('removido_em', null).maybeSingle();
  if (!data?.organizacao) return null;
  return { organizacao: data.organizacao as unknown as Organizacao, funcao: data.funcao as Membro['funcao'] };
}

/** Usuários ativos (incluindo o gestor) contam no pacote. */
export async function membrosAtivos(orgId: string): Promise<Membro[]> {
  const { data, error } = await db().from('organizacao_membros').select('*')
    .eq('organizacao_id', orgId).is('removido_em', null).order('funcao').order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Membro[];
}

/** O que a organização paga por mês com os usuários de hoje (clemente não é cobrada). */
export function mensalidade(org: Organizacao, usuarios: number) {
  if (org.tipo === 'clemente') return null;
  return precoEquipe(usuarios, org.assentos_base);
}

async function liberada(org: Organizacao) {
  if (org.tipo === 'clemente') return true;
  const { data } = await db().from('subscriptions').select('id, current_period_end')
    .eq('user_id', org.dono_id).eq('nivel', 'teams').eq('status', 'ativa');
  return (data ?? []).some((s) => !s.current_period_end || new Date(s.current_period_end) > new Date());
}

/** Resumo para a página da equipe: dados, usuários com o uso do mês, pacote e mensalidade. */
export async function resumoEquipe(org: Organizacao, mes: { de: string; ate: string }) {
  const [membros, { data: calculos }, ativa] = await Promise.all([
    membrosAtivos(org.id),
    db().from('calculations').select('user_id').eq('organizacao_id', org.id).gte('created_at', mes.de).lt('created_at', mes.ate),
    liberada(org),
  ]);
  const porUsuario = new Map<string, number>();
  for (const c of calculos ?? []) porUsuario.set(c.user_id, (porUsuario.get(c.user_id) ?? 0) + 1);
  return {
    organizacao: { id: org.id, nome: org.nome, tipo: org.tipo, assentosBase: org.assentos_base, ativa },
    membros: membros.map((m) => ({
      id: m.id, nome: m.nome, telefone: m.telefone_e164, email: m.email, funcao: m.funcao,
      situacao: m.user_id ? 'ativo' : 'aguardando_cadastro', orcamentosMes: m.user_id ? porUsuario.get(m.user_id) ?? 0 : 0,
    })),
    mensalidade: mensalidade(org, membros.length),
    linkCadastro: `${config.appUrl}/cadastro`,
  };
}

/** Conta que já existe com esse e-mail ou com esse WhatsApp confirmado. */
async function contaExistente(email: string | null, telefone: string) {
  if (email) {
    const { data } = await db().from('profiles').select('id, papel').ilike('email', email).limit(1).maybeSingle();
    if (data) return data as { id: string; papel: string };
  }
  const { data } = await db().from('profiles').select('id, papel')
    .in('whatsapp_e164', variantesTelefone(telefone)).not('whatsapp_verified_at', 'is', null).limit(1).maybeSingle();
  return (data as { id: string; papel: string } | null) ?? null;
}

async function conferirTelefoneLivre(orgId: string, telefone: string, ignorar?: string) {
  let q = db().from('organizacao_membros').select('id').eq('organizacao_id', orgId).is('removido_em', null)
    .in('telefone_e164', variantesTelefone(telefone));
  if (ignorar) q = q.neq('id', ignorar);
  const { data } = await q.limit(1).maybeSingle();
  if (data) throw new ErroEquipe('Já existe um usuário com este telefone na equipe.', 409);
}

/** Liga uma conta a um membro pendente, se ela puder entrar (não é admin nem está em outra organização). */
async function ligarConta(membroId: string, conta: { id: string; papel: string }) {
  if (conta.papel === 'admin') return 'admin' as const;
  const { data: outro } = await db().from('organizacao_membros').select('id').eq('user_id', conta.id).is('removido_em', null).limit(1).maybeSingle();
  if (outro) throw new ErroEquipe('Esta pessoa já faz parte de outra equipe. Peça que ela saia de lá antes.', 409);
  const { error } = await db().from('organizacao_membros').update({ user_id: conta.id, updated_at: new Date().toISOString() }).eq('id', membroId);
  if (error) throw new Error(error.message);
  return 'ligado' as const;
}

/**
 * Inclui um usuário na equipe. Se já existe conta com o e-mail ou o WhatsApp, ela entra na hora.
 * Com e-mail e sem conta, o Supabase manda um convite para criar a senha. Só com telefone, a pessoa
 * entra na equipe quando criar a conta e confirmar esse WhatsApp.
 */
export async function incluirMembro(org: Organizacao, dados: DadosMembro) {
  const email = dados.email?.trim().toLowerCase() || null;
  await conferirTelefoneLivre(org.id, dados.telefone);
  if (email) {
    const { data: dup } = await db().from('organizacao_membros').select('id').eq('organizacao_id', org.id).is('removido_em', null).ilike('email', email).limit(1).maybeSingle();
    if (dup) throw new ErroEquipe('Já existe um usuário com este e-mail na equipe.', 409);
  }
  const conta = await contaExistente(email, dados.telefone);
  if (conta?.papel === 'admin') throw new ErroEquipe('Esta conta é de administrador e não entra em equipes.', 409);
  if (conta) {
    const { data: outro } = await db().from('organizacao_membros').select('id').eq('user_id', conta.id).is('removido_em', null).limit(1).maybeSingle();
    if (outro) throw new ErroEquipe('Esta pessoa já faz parte de outra equipe. Peça que ela saia de lá antes.', 409);
  }

  const { data: membro, error } = await db().from('organizacao_membros').insert({
    organizacao_id: org.id, nome: dados.nome.trim(), telefone_e164: dados.telefone, email, funcao: 'colaborador',
  }).select('*').single();
  if (error) throw new Error(error.message);

  let entrega: 'ligado' | 'convite_email' | 'aguardando_cadastro' = 'aguardando_cadastro';
  let aviso: string | undefined;
  if (conta) {
    await ligarConta(membro.id, conta);
    entrega = 'ligado';
  } else if (email) {
    // O gatilho vincular_convite_por_email liga a conta criada pelo convite a este membro.
    const { error: e } = await db().auth.admin.inviteUserByEmail(email, {
      data: { full_name: dados.nome.trim() }, redirectTo: `${config.appUrl}/entrar`,
    });
    if (e) aviso = `Não conseguimos mandar o convite por e-mail (${e.message}). A pessoa pode criar a conta em ${config.appUrl}/cadastro com este e-mail.`;
    else entrega = 'convite_email';
  }
  return { id: membro.id as string, entrega, aviso };
}

async function membroDaOrg(org: Organizacao, membroId: string): Promise<Membro> {
  const { data } = await db().from('organizacao_membros').select('*').eq('id', membroId).eq('organizacao_id', org.id).is('removido_em', null).maybeSingle();
  if (!data) throw new ErroEquipe('Usuário não encontrado na equipe.', 404);
  return data as Membro;
}

/** Altera nome, telefone ou e-mail. Trocar o contato de quem ainda não tem conta refaz a busca da conta. */
export async function alterarMembro(org: Organizacao, membroId: string, dados: DadosMembro) {
  const m = await membroDaOrg(org, membroId);
  const email = dados.email?.trim().toLowerCase() || null;
  await conferirTelefoneLivre(org.id, dados.telefone, m.id);
  const { error } = await db().from('organizacao_membros')
    .update({ nome: dados.nome.trim(), telefone_e164: dados.telefone, email, updated_at: new Date().toISOString() }).eq('id', m.id);
  if (error) throw new Error(error.message);
  if (!m.user_id) {
    const conta = await contaExistente(email, dados.telefone);
    if (conta && conta.papel !== 'admin') await ligarConta(m.id, conta);
  }
  return { ok: true };
}

/** Remove o usuário da equipe (o histórico de orçamentos continua nos relatórios). O gestor não sai por aqui. */
export async function removerMembro(org: Organizacao, membroId: string) {
  const m = await membroDaOrg(org, membroId);
  if (m.funcao === 'gestor') throw new ErroEquipe('O gestor não pode ser removido da própria equipe.');
  const { error } = await db().from('organizacao_membros').update({ removido_em: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', m.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Quem confirmou um WhatsApp que o gestor cadastrou entra na equipe (chamado na confirmação do número). */
export async function vincularPorTelefone(userId: string, telefone: string) {
  const { data: pendente } = await db().from('organizacao_membros').select('id')
    .is('user_id', null).is('removido_em', null).in('telefone_e164', variantesTelefone(telefone))
    .order('created_at').limit(1).maybeSingle();
  if (!pendente) return;
  const { data: conta } = await db().from('profiles').select('id, papel').eq('id', userId).single();
  if (conta) await ligarConta(pendente.id, conta).catch((e) => console.warn('Equipe: vínculo pelo telefone não feito:', e.message));
}

/** Nome de cada conta da equipe (inclui quem já saiu, para o histórico). */
async function nomesDaEquipe(orgId: string) {
  const { data } = await db().from('organizacao_membros').select('user_id, nome, removido_em').eq('organizacao_id', orgId).not('user_id', 'is', null)
    .order('created_at');
  const nomes = new Map<string, string>();
  for (const m of data ?? []) nomes.set(m.user_id, m.removido_em ? `${m.nome} (saiu)` : m.nome);
  return nomes;
}

/** Orçamentos feitos na equipe num intervalo, com o nome de quem fez. */
export async function orcamentosDaEquipe(orgId: string, filtro: { de: string; ate: string; membroUserId?: string }) {
  let q = db().from('calculations').select('*').eq('organizacao_id', orgId)
    .gte('created_at', filtro.de).lt('created_at', filtro.ate).order('created_at', { ascending: false }).limit(1000);
  if (filtro.membroUserId) q = q.eq('user_id', filtro.membroUserId);
  const [{ data, error }, nomes] = await Promise.all([q, nomesDaEquipe(orgId)]);
  if (error) throw new Error(error.message);
  const calculos = (data ?? []) as CalculoSalvo[];
  return { calculos, nomes };
}

/** Relatório do mês: por usuário, por tipo e a evolução dos últimos 6 meses. */
export async function relatorioDaEquipe(org: Organizacao, mes: string, intervalo: { de: string; ate: string }) {
  const [a, m] = mes.split('-').map(Number);
  const inicio6 = new Date(Date.UTC(a, m - 6, 1)).toISOString();
  const [{ calculos, nomes }, membros, { data: serie }] = await Promise.all([
    orcamentosDaEquipe(org.id, intervalo),
    membrosAtivos(org.id),
    db().from('calculations').select('created_at').eq('organizacao_id', org.id).gte('created_at', inicio6).lt('created_at', intervalo.ate),
  ]);

  const porUsuario = new Map<string, { nome: string; quantidade: number; site: number; whatsapp: number; totalOrcado: number; ultimo: string | null }>();
  for (const mb of membros) if (mb.user_id) porUsuario.set(mb.user_id, { nome: mb.nome, quantidade: 0, site: 0, whatsapp: 0, totalOrcado: 0, ultimo: null });
  const porTipo = new Map<string, { quantidade: number; totalOrcado: number }>();
  for (const c of calculos) {
    const u = porUsuario.get(c.user_id) ?? { nome: nomes.get(c.user_id) ?? 'Usuário removido', quantidade: 0, site: 0, whatsapp: 0, totalOrcado: 0, ultimo: null };
    u.quantidade++; u[c.origem]++; u.totalOrcado += Number(c.total);
    if (!u.ultimo || c.created_at > u.ultimo) u.ultimo = c.created_at;
    porUsuario.set(c.user_id, u);
    const t = porTipo.get(c.tipo) ?? { quantidade: 0, totalOrcado: 0 };
    t.quantidade++; t.totalOrcado += Number(c.total);
    porTipo.set(c.tipo, t);
  }

  const meses: { mes: string; quantidade: number }[] = [];
  for (let i = 5; i >= 0; i--) meses.push({ mes: new Date(Date.UTC(a, m - 1 - i, 1)).toISOString().slice(0, 7), quantidade: 0 });
  for (const c of serie ?? []) {
    const item = meses.find((x) => x.mes === new Date(c.created_at).toISOString().slice(0, 7));
    if (item) item.quantidade++;
  }

  const usuarios = [...porUsuario.values()].sort((x, y) => y.quantidade - x.quantidade || x.nome.localeCompare(y.nome));
  return {
    mes,
    totais: {
      orcamentos: calculos.length,
      totalOrcado: calculos.reduce((s, c) => s + Number(c.total), 0),
      usuariosQueOrcaram: usuarios.filter((u) => u.quantidade > 0).length,
      usuariosAtivos: membros.length,
      pelaWhatsapp: calculos.filter((c) => c.origem === 'whatsapp').length,
    },
    usuarios,
    tipos: [...porTipo.entries()].map(([tipo, v]) => ({ tipo, ...v })).sort((x, y) => y.quantidade - x.quantidade),
    meses,
  };
}

// ---------------- Administrador ----------------

/** Painel do administrador: contas por perfil, organizações e clientes. */
export async function gestaoDoNegocio(intervalo: { de: string; ate: string }) {
  const [{ data: perfis }, { data: orgs }, { data: membros }, { data: calculosMes }, { data: clientes }, { data: assinaturas }] = await Promise.all([
    db().from('profiles').select('papel'),
    db().from('organizacoes').select('*').order('created_at', { ascending: false }),
    db().from('organizacao_membros').select('organizacao_id, user_id').is('removido_em', null),
    db().from('calculations').select('organizacao_id, origem').gte('created_at', intervalo.de).lt('created_at', intervalo.ate),
    db().from('admin_clientes').select('*').order('created_at', { ascending: false }).limit(500),
    db().from('subscriptions').select('user_id, nivel, status, current_period_end').eq('status', 'ativa'),
  ]);

  const contagem: Record<string, number> = {};
  for (const p of perfis ?? []) contagem[p.papel] = (contagem[p.papel] ?? 0) + 1;

  const ativa = (uid: string) => (assinaturas ?? []).some((s) => s.user_id === uid && s.nivel === 'teams'
    && (!s.current_period_end || new Date(s.current_period_end) > new Date()));

  const lista = (orgs ?? []) as Organizacao[];
  const { data: donos } = lista.length
    ? await db().from('profiles').select('id, full_name, email').in('id', lista.map((o) => o.dono_id))
    : { data: [] };
  const organizacoes = lista.map((o) => {
    const dono = (donos ?? []).find((d) => d.id === o.dono_id);
    const doGrupo = (membros ?? []).filter((m) => m.organizacao_id === o.id);
    return {
      id: o.id, nome: o.nome, tipo: o.tipo, assentosBase: o.assentos_base, criadaEm: o.created_at,
      gestor: dono?.full_name || dono?.email || '—',
      usuarios: doGrupo.length,
      pendentes: doGrupo.filter((m) => !m.user_id).length,
      orcamentosMes: (calculosMes ?? []).filter((c) => c.organizacao_id === o.id).length,
      mensalidade: mensalidade(o, doGrupo.length),
      ativa: o.tipo === 'clemente' || ativa(o.dono_id),
    };
  });

  return {
    perfis: contagem,
    orcamentosMes: (calculosMes ?? []).length,
    orcamentosMesWhatsapp: (calculosMes ?? []).filter((c) => c.origem === 'whatsapp').length,
    receitaEquipesMensal: organizacoes.filter((o) => o.ativa && o.mensalidade).reduce((s, o) => s + (o.mensalidade?.mensal ?? 0), 0),
    organizacoes,
    clientes: clientes ?? [],
  };
}

/** Cria uma organização com o gestor (conta já existente, pelo e-mail). */
export async function criarOrganizacao(dados: NovaOrganizacao) {
  const { data: gestor } = await db().from('profiles').select('id, full_name, email, whatsapp_e164').ilike('email', dados.emailGestor.trim()).limit(1).maybeSingle();
  if (!gestor) throw new ErroEquipe('Não há conta com este e-mail. Peça para o gestor se cadastrar primeiro.', 404);
  const telefone = dados.telefoneGestor || gestor.whatsapp_e164;
  if (!telefone) throw new ErroEquipe('Informe o telefone do gestor (a conta dele ainda não tem WhatsApp confirmado).');
  const { data: jaTem } = await db().from('organizacao_membros').select('id').eq('user_id', gestor.id).is('removido_em', null).limit(1).maybeSingle();
  if (jaTem) throw new ErroEquipe('Este gestor já faz parte de uma equipe.', 409);

  const { data: org, error } = await db().from('organizacoes').insert({
    nome: dados.nome.trim(), tipo: dados.tipo, dono_id: gestor.id, assentos_base: dados.assentosBase,
  }).select('*').single();
  if (error) throw new ErroEquipe(error.code === '23505' ? 'Este gestor já é dono de uma organização.' : error.message, error.code === '23505' ? 409 : 500);
  const { error: e2 } = await db().from('organizacao_membros').insert({
    organizacao_id: org.id, user_id: gestor.id, nome: gestor.full_name || dados.nome.trim(), telefone_e164: telefone, email: gestor.email, funcao: 'gestor',
  });
  if (e2) {
    await db().from('organizacoes').delete().eq('id', org.id);
    throw new Error(e2.message);
  }
  return { id: org.id as string };
}

export async function alterarOrganizacao(id: string, dados: { nome?: string; assentosBase?: number }) {
  const { error } = await db().from('organizacoes').update({
    ...(dados.nome ? { nome: dados.nome.trim() } : {}),
    ...(dados.assentosBase ? { assentos_base: dados.assentosBase } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * Enquanto a cobrança no Stripe não entra: o admin libera uma equipe Teams até uma data
 * (cria a assinatura 'teams' do dono com gateway 'manual').
 */
export async function liberarManualmente(id: string, ate: string) {
  const { data: org } = await db().from('organizacoes').select('dono_id, tipo').eq('id', id).maybeSingle();
  if (!org) throw new ErroEquipe('Organização não encontrada.', 404);
  if (org.tipo === 'clemente') return { ok: true };
  const { error } = await db().from('subscriptions').insert({
    user_id: org.dono_id, plan: 'trimestral', nivel: 'teams', status: 'ativa', gateway: 'manual',
    current_period_end: new Date(`${ate}T23:59:59-03:00`).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}
