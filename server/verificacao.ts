import { createHash, randomInt } from 'node:crypto';
import { config } from './config';
import { supabaseAdmin } from './supabase';
import { variantesTelefone } from './telefone';
import { vincularPorTelefone } from './equipe';

/**
 * Confirmação do WhatsApp invertida: o site mostra um código e o corretor o envia ao agente.
 * O número fica provado porque a mensagem chega dele, e o agente nunca chama ninguém primeiro
 * (o que evita bloqueio no número comum e custo de mensagem-modelo (template) na API oficial).
 */
const VALIDADE_MIN = 30;
const MAX_TENTATIVAS = 5;

const hashCodigo = (userId: string, codigo: string) =>
  createHash('sha256').update(`${config.codigoSegredo}:${userId}:${codigo}`).digest('hex');

/** Texto que o site pré-preenche no WhatsApp. */
export const mensagemDeConfirmacao = (codigo: string) => `Confirmar meu WhatsApp no ${config.marca}: ${codigo}`;

/** Cria um código para o usuário confirmar `telefone`. Substitui pedidos anteriores. */
export async function criarCodigo(userId: string, telefone: string): Promise<string> {
  const db = supabaseAdmin();
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.from('phone_verifications').delete().eq('user_id', userId);
  await db.from('phone_verifications').insert({
    user_id: userId, whatsapp_e164: telefone, code_hash: hashCodigo(userId, codigo),
    expires_at: new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString(),
  });
  return codigo;
}

/**
 * Código de 6 dígitos de uma mensagem de confirmação, ou o código enviado sozinho.
 * "350000" no meio de um pedido de orçamento não é código.
 */
export function extrairCodigo(texto: string | undefined): string | undefined {
  const t = texto?.trim() ?? '';
  if (/^\d{6}$/.test(t)) return t;
  return /confirmar/i.test(t) ? t.match(/(?<!\d)\d{6}(?!\d)/)?.[0] : undefined;
}

export type ResultadoConfirmacao = { status: 'confirmado'; userId: string } | { status: 'codigo_errado' | 'expirado' | 'em_uso' };

/**
 * Confere uma mensagem recebida contra o pedido pendente do número que a enviou.
 * Devolve null quando não há pedido pendente para esse número ou a mensagem não traz um código:
 * aí a conversa segue normalmente.
 */
export async function confirmarPorMensagem(telefone: string, texto: string | undefined): Promise<ResultadoConfirmacao | null> {
  const codigo = extrairCodigo(texto);
  if (!codigo) return null;
  const db = supabaseAdmin();
  const { data: v } = await db.from('phone_verifications').select('*')
    .in('whatsapp_e164', variantesTelefone(telefone))
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!v) return null;
  if (new Date(v.expires_at) < new Date() || v.attempts >= MAX_TENTATIVAS) return { status: 'expirado' };
  if (v.code_hash !== hashCodigo(v.user_id, codigo)) {
    await db.from('phone_verifications').update({ attempts: v.attempts + 1 }).eq('id', v.id);
    return { status: 'codigo_errado' };
  }
  const { data: emUso } = await db.from('profiles').select('id')
    .in('whatsapp_e164', variantesTelefone(telefone)).neq('id', v.user_id).limit(1).maybeSingle();
  if (emUso) return { status: 'em_uso' };
  // Grava o número como o WhatsApp o entrega: é assim que o agente vai reconhecê-lo.
  await db.from('profiles').update({ whatsapp_e164: telefone, whatsapp_verified_at: new Date().toISOString() }).eq('id', v.user_id);
  await db.from('phone_verifications').delete().eq('user_id', v.user_id);
  // Se o gestor de uma equipe cadastrou este telefone, a pessoa entra na equipe agora.
  await vincularPorTelefone(v.user_id, telefone).catch((e) => console.error('Equipe: falha ao vincular pelo telefone', e));
  return { status: 'confirmado', userId: v.user_id };
}
