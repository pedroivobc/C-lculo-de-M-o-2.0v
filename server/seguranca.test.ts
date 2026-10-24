import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { acessoLiberado } from './auth';
import { criarApp } from './app';

describe('acesso na API (mesma regra da tela)', () => {
  it('libera o que o banco libera', () => {
    expect(acessoLiberado({ liberado: true, motivo: 'ok' }, false)).toBe(true);
    expect(acessoLiberado({ liberado: true, motivo: 'trial' }, false)).toBe(true);
  });
  it('assinatura própria ativa entra mesmo sem cartão (Pix anual)', () => {
    expect(acessoLiberado({ liberado: false, motivo: 'sem_cartao' }, true)).toBe(true);
  });
  it('bloqueia teste vencido, assinatura parada e equipe inativa', () => {
    expect(acessoLiberado({ liberado: false, motivo: 'trial_expirado' }, false)).toBe(false);
    expect(acessoLiberado({ liberado: false, motivo: 'assinatura_inativa' }, false)).toBe(false);
    expect(acessoLiberado({ liberado: false, motivo: 'organizacao_inativa' }, true)).toBe(false);
    expect(acessoLiberado(null, false)).toBe(false);
  });
});

describe('cabeçalhos e erros da API', () => {
  let servidor: Server;
  let base: string;
  beforeAll(async () => {
    servidor = criarApp().listen(0);
    await new Promise((ok) => servidor.once('listening', ok));
    const endereco = servidor.address();
    base = `http://127.0.0.1:${typeof endereco === 'object' && endereco ? endereco.port : 0}`;
  });
  afterAll(() => { servidor.close(); });

  it('manda os cabeçalhos de segurança e o código do pedido', async () => {
    const r = await fetch(`${base}/api/saude`);
    expect(r.status).toBe(200);
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(r.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(r.headers.get('x-powered-by')).toBeNull();
    expect(r.headers.get('x-request-id')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('JSON malformado vira 400 sem detalhe interno', async () => {
    const r = await fetch(`${base}/api/cidades/pedido`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{x' });
    expect(r.status).toBe(400);
    const corpo = await r.json();
    expect(corpo.erro).toBe('Pedido inválido.');
    expect(JSON.stringify(corpo)).not.toContain('Unexpected');
  });

  it('agente sem chave não passa', async () => {
    const r = await fetch(`${base}/api/agente/identificar?whatsapp=5532999999999`);
    expect(r.status).toBe(401);
  });
});
