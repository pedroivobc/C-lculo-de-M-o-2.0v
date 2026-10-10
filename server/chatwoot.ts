import { config } from './config';

/**
 * Chatwoot (opcional). As mensagens já chegam lá pela integração nativa da Evolution;
 * aqui só abrimos a conversa e deixamos uma nota quando o corretor pede para falar com uma pessoa.
 */
async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const { url, token, conta } = config.chatwoot;
  const resp = await fetch(`${url}/api/v1/accounts/${conta}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', api_access_token: token },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!resp.ok) throw new Error(`Chatwoot ${caminho} respondeu ${resp.status}: ${await resp.text()}`);
  return resp.json() as Promise<T>;
}

export const chatwootConfigurado = () => !!(config.chatwoot.url && config.chatwoot.token && config.chatwoot.conta);

/** Abre a conversa mais recente do contato, marca com "atendente" e deixa uma nota privada para a equipe. */
export async function pedirAtendente(telefone: string, nota: string) {
  if (!chatwootConfigurado()) return false;
  const busca = await chamar<{ payload: { id: number; phone_number: string | null }[] }>('GET', `/contacts/search?q=${encodeURIComponent(telefone.replace(/\D/g, ''))}`);
  const digitos = telefone.replace(/\D/g, '');
  const contato = busca.payload.find((c) => (c.phone_number ?? '').replace(/\D/g, '').endsWith(digitos.slice(-8))) ?? busca.payload[0];
  if (!contato) return false;
  const conversas = await chamar<{ payload: { id: number; last_activity_at: number }[] }>('GET', `/contacts/${contato.id}/conversations`);
  const conversa = [...conversas.payload].sort((a, b) => b.last_activity_at - a.last_activity_at)[0];
  if (!conversa) return false;
  await chamar('POST', `/conversations/${conversa.id}/toggle_status`, { status: 'open' });
  await chamar('POST', `/conversations/${conversa.id}/labels`, { labels: ['atendente'] });
  await chamar('POST', `/conversations/${conversa.id}/messages`, { content: nota, private: true, message_type: 'outgoing' });
  return true;
}
