import { randomInt } from 'node:crypto';
import { config } from './config';
import { supabaseAdmin } from './supabase';

/**
 * Cupom de indicação. Cada assinante gera o seu (ex.: PEDRO7K2); quem se cadastra com ele ganha
 * 5 dias de teste em vez de 3 e fica ligado a quem indicou (profiles.indicado_por). Quem indicou ganha
 * 1 mês grátis quando o indicado assina o plano anual. O CPF único por conta impede repetir o truque.
 */
export const DIAS_TESTE = 3;
export const DIAS_TESTE_INDICACAO = 5;
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I/L, que se confundem

const primeiroNome = (nome?: string | null) => (nome ?? '').trim().split(/\s+/)[0] || 'Um colega';

/** "pedro7k2", " PEDRO-7K2 " → "PEDRO7K2". */
export function normalizarCodigo(codigo: string): string {
  return codigo.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

/** Prefixo do cupom a partir do nome: "Pedro Ivo" → "PEDRO". */
export function prefixoDoNome(nome?: string | null): string {
  const p = normalizarCodigo((nome ?? '').trim().split(/\s+/)[0] ?? '').replace(/\d/g, '').slice(0, 8);
  return p.length >= 3 ? p : 'ORCAI';
}

export const linkDeIndicacao = (codigo: string) => `${config.appUrl}/cadastro?cupom=${codigo}`;

/** Devolve o cupom do assinante, criando na primeira vez. */
export async function codigoDoUsuario(userId: string): Promise<string> {
  const db = supabaseAdmin();
  const { data: p } = await db.from('profiles').select('full_name, codigo_indicacao').eq('id', userId).single();
  if (p?.codigo_indicacao) return p.codigo_indicacao;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const sufixo = Array.from({ length: 3 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
    const codigo = `${prefixoDoNome(p?.full_name)}${sufixo}`;
    const { error } = await db.from('profiles').update({ codigo_indicacao: codigo }).eq('id', userId).is('codigo_indicacao', null);
    if (!error) {
      const { data } = await db.from('profiles').select('codigo_indicacao').eq('id', userId).single();
      if (data?.codigo_indicacao) return data.codigo_indicacao;
    }
    // Código repetido (unique): tenta outro sufixo.
  }
  throw new Error('Não foi possível gerar o cupom agora. Tente de novo.');
}

/** Quem é o dono do cupom (para a tela de cadastro mostrar "Cupom de Pedro"). */
export async function validarCodigo(codigo: string): Promise<{ valido: boolean; nome?: string; dias: number }> {
  const c = normalizarCodigo(codigo);
  if (c.length < 4) return { valido: false, dias: DIAS_TESTE };
  const { data } = await supabaseAdmin().from('profiles').select('id, full_name').eq('codigo_indicacao', c).maybeSingle();
  return data ? { valido: true, nome: primeiroNome(data.full_name), dias: DIAS_TESTE_INDICACAO } : { valido: false, dias: DIAS_TESTE };
}

/**
 * Liga a conta nova a quem indicou. Vale para quem ainda está no teste (ou nem começou) e só uma vez.
 * Se o teste já está correndo, ganha os dias que faltam para chegar a 5.
 */
export async function usarCodigo(userId: string, codigo: string): Promise<{ nome: string; dias: number }> {
  const db = supabaseAdmin();
  const c = normalizarCodigo(codigo);
  const [{ data: dono }, { data: eu }] = await Promise.all([
    db.from('profiles').select('id, full_name').eq('codigo_indicacao', c).maybeSingle(),
    db.from('profiles').select('papel, trial_expira_em, indicado_por, cpf').eq('id', userId).single(),
  ]);
  if (!dono) throw new Error('Cupom não encontrado. Confira as letras e os números.');
  if (dono.id === userId) throw new Error('Você não pode usar o seu próprio cupom.');
  if (!eu?.cpf) throw new Error('Informe o seu CPF antes de usar o cupom.');
  if (eu?.indicado_por) throw new Error('Sua conta já tem um cupom de indicação.');
  if (eu?.papel !== 'trial' || (eu.trial_expira_em && new Date(eu.trial_expira_em) < new Date())) {
    throw new Error('O cupom vale só para contas novas, durante o teste grátis.');
  }
  const extra = (DIAS_TESTE_INDICACAO - DIAS_TESTE) * 86400_000;
  const trial = eu.trial_expira_em ? new Date(new Date(eu.trial_expira_em).getTime() + extra).toISOString() : null;
  const { error } = await db.from('profiles')
    .update({ indicado_por: dono.id, indicado_em: new Date().toISOString(), ...(trial ? { trial_expira_em: trial } : {}) })
    .eq('id', userId).is('indicado_por', null);
  if (error) throw new Error(`Não foi possível aplicar o cupom: ${error.message}`);
  // Quem indicou ganha 1 mês grátis quando este indicado assinar o plano anual (trigger no banco libera).
  await db.from('recompensas_indicacao').insert({ indicador: dono.id, indicado: userId });
  return { nome: primeiroNome(dono.full_name), dias: DIAS_TESTE_INDICACAO };
}

/** Cupom, link e quem se cadastrou com ele (só o primeiro nome, por privacidade). */
export async function resumoDaIndicacao(userId: string) {
  const db = supabaseAdmin();
  const { data: p } = await db.from('profiles').select('codigo_indicacao').eq('id', userId).single();
  const { data: indicados } = await db.from('profiles')
    .select('full_name, indicado_em, papel, trial_expira_em').eq('indicado_por', userId).order('indicado_em', { ascending: false });
  const { data: recompensas } = await db.from('recompensas_indicacao').select('status, meses_gratis').eq('indicador', userId);
  const meses = (st: string) => (recompensas ?? []).filter((r) => r.status === st).reduce((t, r) => t + (r.meses_gratis ?? 1), 0);
  return {
    recompensa: { liberados: meses('liberada'), usados: meses('usada'), aguardandoAnual: meses('pendente') },
    codigo: p?.codigo_indicacao ?? null,
    link: p?.codigo_indicacao ? linkDeIndicacao(p.codigo_indicacao) : null,
    indicados: (indicados ?? []).map((i) => ({
      nome: primeiroNome(i.full_name),
      em: i.indicado_em,
      situacao: i.papel === 'trial' ? (i.trial_expira_em && new Date(i.trial_expira_em) < new Date() ? 'teste_encerrado' : 'em_teste') : 'assinante',
    })),
  };
}
