import { supabaseAdmin } from '../supabase';
import { variantesTelefone } from '../telefone';

/**
 * Teste grátis pelo WhatsApp: quem escreve ao agente sem cadastro ganha uma conta de teste, sem e-mail
 * real nem senha, com LIMITE_TESTE orçamentos. Ao se cadastrar no site e confirmar o mesmo WhatsApp,
 * os orçamentos passam para a conta nova e a de teste é apagada (liberarNumeroDeTeste).
 */
export const LIMITE_TESTE = 3;

/** "…Código: site-inicio" (mensagem pronta do botão do site) → 'site-inicio'. Sem código, 'whatsapp'. */
export function origemDaMensagem(texto?: string): string {
  return texto?.match(/c[óo]digo:?\s*([\w-]{2,40})/i)?.[1]?.toLowerCase() ?? 'whatsapp';
}

const capitalizar = (p: string) => p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR');

/** "meu nome é pedro ivo" → { nome: 'Pedro', sobrenome: 'Ivo' }. null quando não parece um nome. */
export function lerNome(texto: string): { nome: string; sobrenome: string | null } | null {
  const t = texto.trim()
    .replace(/^(ol[áa]|oi|bom dia|boa tarde|boa noite)[,!.\s]*/i, '')
    .replace(/^(meu nome [ée]|me chamo|eu sou o|eu sou a|eu sou|sou o|sou a|sou|aqui [ée] o|aqui [ée] a|[ée] o|[ée] a)\s+/i, '')
    .replace(/[.!,;]+$/g, '').trim();
  if (!t || t.length > 60 || /[\d@/:]/.test(t)) return null;
  const partes = t.split(/\s+/).filter((p) => /^[\p{L}'-]+$/u.test(p));
  if (!partes.length || partes.length > 6) return null;
  const [nome, ...resto] = partes.map((p) => (/^(da|de|do|das|dos|e)$/i.test(p) ? p.toLowerCase() : capitalizar(p)));
  return { nome, sobrenome: resto.join(' ') || null };
}

/** Orçamentos já feitos por uma conta de teste; null quando a conta não é de teste. */
export async function usadosNoTeste(userId: string): Promise<number | null> {
  const db = supabaseAdmin();
  const { data } = await db.from('whatsapp_testes').select('user_id').eq('user_id', userId).maybeSingle();
  if (!data) return null;
  const { count } = await db.from('calculations').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  return count ?? 0;
}

/** Cria a conta de teste já com este WhatsApp confirmado (foi ele que escreveu ao agente). */
export async function criarContaDeTeste(telefone: string, nomeWhatsapp: string | undefined, origem: string): Promise<string> {
  const db = supabaseAdmin();
  const digitos = telefone.replace(/\D/g, '');
  const nome = nomeWhatsapp ? lerNome(nomeWhatsapp) : null;
  const { data, error } = await db.auth.admin.createUser({
    email: `whatsapp-${digitos}@teste.calculonamao.com.br`,
    email_confirm: true,
    user_metadata: { full_name: nome ? [nome.nome, nome.sobrenome].filter(Boolean).join(' ') : null, nome: nome?.nome, sobrenome: nome?.sobrenome, teste_whatsapp: true },
  });
  if (error || !data.user) throw new Error(`Falha ao criar a conta de teste: ${error?.message}`);
  const userId = data.user.id;
  const { error: e1 } = await db.from('profiles').update({ whatsapp_e164: telefone, whatsapp_verified_at: new Date().toISOString() }).eq('id', userId);
  const { error: e2 } = await db.from('whatsapp_testes').insert({ user_id: userId, whatsapp_e164: telefone, origem });
  if (e1 || e2) {
    await db.auth.admin.deleteUser(userId).catch(() => undefined);
    throw new Error(`Falha ao preparar a conta de teste: ${(e1 ?? e2)?.message}`);
  }
  return userId;
}

/** Contas de teste com este WhatsApp (para não contarem como "número já em uso"). */
export async function contasDeTeste(telefone: string): Promise<string[]> {
  const { data } = await supabaseAdmin().from('whatsapp_testes').select('user_id').in('whatsapp_e164', variantesTelefone(telefone));
  return (data ?? []).map((t) => t.user_id as string);
}

/** O número foi confirmado numa conta de verdade: os orçamentos do teste vão para ela e a conta de teste some. */
export async function liberarNumeroDeTeste(telefone: string, novoUserId: string) {
  const db = supabaseAdmin();
  for (const antigo of await contasDeTeste(telefone)) {
    if (antigo === novoUserId) continue;
    const { error } = await db.from('calculations').update({ user_id: novoUserId }).eq('user_id', antigo);
    if (error) throw new Error(`Falha ao mover os orçamentos do teste: ${error.message}`);
    const { error: e } = await db.auth.admin.deleteUser(antigo);
    if (e) throw new Error(`Falha ao apagar a conta de teste: ${e.message}`);
  }
}
