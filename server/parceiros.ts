import { valorTransacionado } from '../src/lib/calc';
import { supabaseAdmin } from './supabase';
import { variantesTelefone } from './telefone';
import { ErroEquipe, vinculoDoUsuario, type Membro, type Organizacao } from './equipe';
import type { CalculoSalvo } from './historico';

/**
 * Corretor Parceiro da Clemente Assessoria: corretor de fora, cadastrado pelo time da Clemente, que não paga e orça
 * no site e no WhatsApp com a logo da Clemente. É um membro da Clemente Team com funcao 'parceiro' (regras no banco:
 * supabase/migrations/20261021000001_corretor_parceiro.sql). O time acompanha cada orçamento no painel de controle.
 */

const db = () => supabaseAdmin();

/**
 * Clemente Team que esta pessoa administra como time: gestor ou colaborador da Clemente Team, ou o administrador
 * (que usa a própria Clemente Team, ou a primeira cadastrada). Parceiro e demais perfis: null.
 */
export async function clementeDoTime(userId: string): Promise<Organizacao | null> {
  const v = await vinculoDoUsuario(userId);
  if (v) return v.organizacao.tipo === 'clemente' && v.funcao !== 'parceiro' ? v.organizacao : null;
  const { data: p } = await db().from('profiles').select('papel').eq('id', userId).maybeSingle();
  if (p?.papel !== 'admin') return null;
  const { data } = await db().from('organizacoes').select('*').eq('tipo', 'clemente').order('created_at').limit(1).maybeSingle();
  return (data as Organizacao | null) ?? null;
}

/** Vínculos de parceiro da organização, inclusive de quem já saiu (para o histórico do painel). */
async function vinculosDeParceiro(orgId: string): Promise<Membro[]> {
  const { data, error } = await db().from('organizacao_membros').select('*')
    .eq('organizacao_id', orgId).eq('funcao', 'parceiro').order('nome');
  if (error) throw new Error(error.message);
  return (data ?? []) as Membro[];
}

/** Parceiros ativos com o uso de cada um, e as imobiliárias cadastradas (para os filtros). */
export async function listarParceiros(org: Organizacao) {
  const [vinculos, { data: calculos }] = await Promise.all([
    vinculosDeParceiro(org.id),
    db().from('calculations').select('parceiro_id, created_at').eq('organizacao_id', org.id).not('parceiro_id', 'is', null),
  ]);
  const uso = new Map<string, { total: number; ultimo: string | null }>();
  for (const c of calculos ?? []) {
    const u = uso.get(c.parceiro_id) ?? { total: 0, ultimo: null };
    u.total++;
    if (!u.ultimo || c.created_at > u.ultimo) u.ultimo = c.created_at;
    uso.set(c.parceiro_id, u);
  }
  const ativos = vinculos.filter((m) => !m.removido_em);
  return {
    organizacao: { id: org.id, nome: org.nome },
    parceiros: ativos.map((m) => ({
      id: m.id, nome: m.nome, telefone: m.telefone_e164, email: m.email, imobiliaria: m.imobiliaria,
      situacao: m.user_id ? 'ativo' as const : 'aguardando_cadastro' as const,
      orcamentos: uso.get(m.id)?.total ?? 0, ultimoOrcamento: uso.get(m.id)?.ultimo ?? null, desde: m.created_at,
    })),
    imobiliarias: [...new Set(vinculos.map((m) => m.imobiliaria?.trim()).filter((i): i is string => !!i))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  };
}

export interface FiltroControle {
  /** Datas 'AAAA-MM-DD' no horário de Brasília, as duas inclusivas. */
  de?: string;
  ate?: string;
  /** Parte do nome do parceiro. */
  nome?: string;
  /** Parte do nome da imobiliária. */
  imobiliaria?: string;
  /** Modalidade: tipo do cálculo (escritura, financiamento_caixa, banco_privado, doacao, correcao). */
  tipo?: string;
  /** Tipo de envio: site ou WhatsApp. */
  origem?: 'site' | 'whatsapp';
  /** Faixa do valor transacionado, em reais. */
  valorMin?: number;
  valorMax?: number;
}

export const LIMITE_CONTROLE = 2000;

/** Nome de cada modalidade (mesmo texto da tela, em src/hooks/useCalculos.ts). */
const MODALIDADES: Record<string, string> = {
  escritura: 'Escritura', doacao: 'Doação', financiamento_caixa: 'Financiamento Caixa', banco_privado: 'Banco privado', correcao: 'Correção contratual',
};

const contem = (texto: string | null | undefined, busca: string) =>
  (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .includes(busca.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim());

/** Dia 'AAAA-MM-DD' em Brasília → instante ISO do começo do dia (ou do dia seguinte, para o fim do intervalo). */
const inicioDoDia = (dia: string, maisUm = false) => {
  const d = new Date(`${dia}T00:00:00-03:00`);
  if (maisUm) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
};

/**
 * Painel de controle: cada orçamento feito pelos parceiros, filtrado por data, nome, imobiliária, modalidade,
 * valor transacionado e tipo de envio. Nome e imobiliária são os do cadastro do parceiro hoje.
 */
export async function controleDeOrcamentos(org: Organizacao, f: FiltroControle) {
  const vinculos = await vinculosDeParceiro(org.id);
  const escolhidos = vinculos.filter((m) => (!f.nome || contem(m.nome, f.nome)) && (!f.imobiliaria || contem(m.imobiliaria, f.imobiliaria)));
  const vazio = { orcamentos: [], totais: { orcamentos: 0, valorTransacionado: 0, totalOrcado: 0, site: 0, whatsapp: 0, parceiros: 0 }, truncado: false };
  if (!escolhidos.length) return vazio;

  let q = db().from('calculations').select('*').eq('organizacao_id', org.id).order('created_at', { ascending: false }).limit(LIMITE_CONTROLE + 1);
  q = f.nome || f.imobiliaria ? q.in('parceiro_id', escolhidos.map((m) => m.id)) : q.not('parceiro_id', 'is', null);
  if (f.de) q = q.gte('created_at', inicioDoDia(f.de));
  if (f.ate) q = q.lt('created_at', inicioDoDia(f.ate, true));
  if (f.tipo) q = q.eq('tipo', f.tipo);
  if (f.origem) q = q.eq('origem', f.origem);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const truncado = (data?.length ?? 0) > LIMITE_CONTROLE;

  const porId = new Map(vinculos.map((m) => [m.id, m]));
  const orcamentos = ((data ?? []) as (CalculoSalvo & { parceiro_id: string })[]).slice(0, LIMITE_CONTROLE)
    .map((c) => {
      const p = porId.get(c.parceiro_id);
      return {
        id: c.id, seq: c.seq, created_at: c.created_at, tipo: c.tipo, subtipo: c.subtipo, municipio: c.municipio,
        origem: c.origem, descricao: c.descricao, total: Number(c.total), valorTransacionado: valorTransacionado(c.resultado),
        parceiroId: c.parceiro_id, parceiro: p ? `${p.nome}${p.removido_em ? ' (saiu)' : ''}` : '—', imobiliaria: p?.imobiliaria ?? null,
      };
    })
    .filter((c) => (f.valorMin === undefined || c.valorTransacionado >= f.valorMin) && (f.valorMax === undefined || c.valorTransacionado <= f.valorMax));

  return {
    orcamentos,
    totais: {
      orcamentos: orcamentos.length,
      valorTransacionado: orcamentos.reduce((s, c) => s + c.valorTransacionado, 0),
      totalOrcado: orcamentos.reduce((s, c) => s + c.total, 0),
      site: orcamentos.filter((c) => c.origem === 'site').length,
      whatsapp: orcamentos.filter((c) => c.origem === 'whatsapp').length,
      parceiros: new Set(orcamentos.map((c) => c.parceiroId)).size,
    },
    truncado,
  };
}

/** Planilha do painel: mesmas colunas da tela, no padrão do Excel brasileiro (separador ;, vírgula decimal, BOM). */
export function csvDoControle(linhas: Awaited<ReturnType<typeof controleDeOrcamentos>>['orcamentos']): Buffer {
  const cel = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const decimal = (n: number) => n.toFixed(2).replace('.', ',');
  const cab = ['Nº', 'Data', 'Parceiro', 'Imobiliária', 'Modalidade', 'Subtipo', 'Envio', 'Descrição', 'Valor transacionado', 'Total orçado'];
  const corpo = linhas.map((c) => [
    `#${String(c.seq).padStart(4, '0')}`,
    new Date(c.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    c.parceiro, c.imobiliaria ?? '', MODALIDADES[c.tipo] ?? c.tipo, c.subtipo ?? '', c.origem === 'whatsapp' ? 'WhatsApp' : 'Site', c.descricao ?? '',
    decimal(c.valorTransacionado), decimal(c.total),
  ].map(cel).join(';'));
  return Buffer.from('﻿' + [cab.join(';'), ...corpo].join('\r\n'), 'utf8');
}

/** Orçamento de um parceiro desta organização (para baixar o arquivo pelo painel). */
export async function orcamentoDeParceiro(org: Organizacao, id: string): Promise<CalculoSalvo | null> {
  const { data } = await db().from('calculations').select('*').eq('id', id).eq('organizacao_id', org.id).not('parceiro_id', 'is', null).maybeSingle();
  return (data as CalculoSalvo | null) ?? null;
}

/** Garante que o vínculo é de parceiro (as rotas de parceiros não mexem no time). */
export async function exigirVinculoDeParceiro(org: Organizacao, membroId: string) {
  const { data } = await db().from('organizacao_membros').select('funcao').eq('id', membroId).eq('organizacao_id', org.id).is('removido_em', null).maybeSingle();
  if (data?.funcao !== 'parceiro') throw new ErroEquipe('Parceiro não encontrado.', 404);
}

/**
 * Parceiro cadastrado só com o telefone escreve ao agente pela primeira vez: cria a conta dele na hora, já com este
 * WhatsApp confirmado (foi o time da Clemente que cadastrou o número), e liga ao cadastro. Assim ele é atendido
 * normalmente, sem passar pelo teste grátis. Devolve true quando havia um parceiro esperando por este número.
 */
export async function ativarParceiroPeloWhatsapp(telefone: string): Promise<boolean> {
  const { data: m } = await db().from('organizacao_membros').select('id, user_id, nome, email')
    .eq('funcao', 'parceiro').is('removido_em', null).in('telefone_e164', variantesTelefone(telefone))
    .order('created_at').limit(1).maybeSingle();
  if (!m) return false;
  const [nome, ...resto] = String(m.nome).trim().split(/\s+/);
  const perfil = { whatsapp_e164: telefone, whatsapp_verified_at: new Date().toISOString() };

  if (m.user_id) {
    // Já tem conta (ex.: veio pelo convite por e-mail) mas o WhatsApp ainda não estava confirmado nela.
    const { error } = await db().from('profiles').update(perfil).eq('id', m.user_id);
    if (error) throw new Error(`Falha ao confirmar o WhatsApp do parceiro: ${error.message}`);
    return true;
  }

  const digitos = telefone.replace(/\D/g, '');
  const metadados = { full_name: m.nome, nome, sobrenome: resto.join(' ') || null, parceiro: true };
  let criado = await db().auth.admin.createUser({ email: m.email || `whatsapp-${digitos}@parceiro.calculonamao.com.br`, email_confirm: true, user_metadata: metadados });
  // E-mail já usado por outra conta: entra com o endereço interno; o time ajusta o cadastro depois.
  if (criado.error && m.email) {
    criado = await db().auth.admin.createUser({ email: `whatsapp-${digitos}@parceiro.calculonamao.com.br`, email_confirm: true, user_metadata: metadados });
  }
  if (criado.error || !criado.data.user) throw new Error(`Falha ao criar a conta do parceiro: ${criado.error?.message}`);
  const userId = criado.data.user.id;
  const { error: e1 } = await db().from('profiles').update({ ...perfil, nome, sobrenome: resto.join(' ') || null, full_name: m.nome }).eq('id', userId);
  // O gatilho ao_mudar_membro passa o papel para 'parceiro'.
  const { error: e2 } = e1 ? { error: null } : await db().from('organizacao_membros').update({ user_id: userId, updated_at: new Date().toISOString() }).eq('id', m.id);
  if (e1 || e2) {
    await db().auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(`Falha ao ligar a conta do parceiro: ${(e1 ?? e2)?.message}`);
  }
  return true;
}
