import { supabase } from './supabase';

/** Chamada à API do servidor com o token do usuário logado. Erros viram Error com a mensagem do servidor. */
export async function api<T = unknown>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; publico?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!opcoes.publico) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const resp = await fetch(caminho, {
    method: opcoes.metodo ?? (opcoes.corpo ? 'POST' : 'GET'),
    headers,
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(corpo.erro ?? `Não foi possível concluir (${resp.status}).`);
  return corpo as T;
}
