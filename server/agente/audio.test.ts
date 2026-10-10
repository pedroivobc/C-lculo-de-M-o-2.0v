import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';

let servidor: Server;
let url = '';

beforeAll(async () => {
  process.env.AGENT_API_KEY = 'chave-teste';
  process.env.GEMINI_API_KEY = '';
  const { criarApp } = await import('../app');
  servidor = criarApp().listen(0);
  url = `http://127.0.0.1:${(servidor.address() as { port: number }).port}`;
});
afterAll(() => servidor?.close());

const enviar = (corpo: unknown) => fetch(`${url}/api/agente/mensagem`, {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-agent-key': 'chave-teste' }, body: JSON.stringify(corpo),
}).then((r) => r.json());

describe('nota de voz no agente', () => {
  it('reconhece áudio pelo mimetype', async () => {
    const { ehAudio } = await import('./audio');
    expect(ehAudio('audio/ogg; codecs=opus')).toBe(true);
    expect(ehAudio('image/jpeg')).toBe(false);
    expect(ehAudio(undefined)).toBe(false);
  });

  it('sem chave do Gemini, pede para escrever (e não chama o resto do agente)', async () => {
    const r = await enviar({ remoteJid: '5532999990000@s.whatsapp.net', midia: { base64: 'AAAA', mimetype: 'audio/ogg; codecs=opus' } });
    expect(r.status).toBe('audio_nao_entendido');
    expect(r.respostas[0].texto).toMatch(/escrever/);
    expect(r.respostas[0].envio).toBeTruthy();
  });
});
