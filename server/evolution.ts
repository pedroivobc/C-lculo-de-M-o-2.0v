import { config } from './config';

/**
 * Cliente mínimo da Evolution API (v2). As respostas do agente saem pelo n8n;
 * o servidor só envia direto o código de verificação e a mensagem de boas-vindas.
 */
async function chamar(caminho: string, corpo: unknown) {
  const { url, key, instancia } = config.evolution;
  if (!url || !key) throw new Error('EVOLUTION_API_URL e EVOLUTION_API_KEY não configurados');
  const resp = await fetch(`${url}${caminho}/${encodeURIComponent(instancia)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) throw new Error(`Evolution ${caminho} respondeu ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

const numero = (e164: string) => e164.replace(/\D/g, '');

export const enviarTexto = (e164: string, texto: string) =>
  chamar('/message/sendText', { number: numero(e164), text: texto });

export const enviarDocumento = (e164: string, url: string, nomeArquivo: string, mimetype: string, legenda?: string) =>
  chamar('/message/sendMedia', { number: numero(e164), mediatype: 'document', mimetype, media: url, fileName: nomeArquivo, caption: legenda });

/** Baixa a mídia de uma mensagem recebida (ex.: áudio). `mensagem` é o { key, message } que veio no webhook. */
export const baixarMidia = (mensagem: unknown) =>
  chamar('/chat/getBase64FromMediaMessage', { message: mensagem, convertToMp4: false }) as Promise<{ base64?: string; mimetype?: string }>;
