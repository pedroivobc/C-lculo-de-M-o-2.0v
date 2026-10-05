import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { supabaseAdmin } from './supabase';

declare module 'express-serve-static-core' {
  interface Request { userId?: string }
}

/** Rotas do site: exige o token do Supabase Auth (Authorization: Bearer <jwt>). */
export async function exigirUsuario(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ erro: 'Sessão expirada. Entre de novo.' });
  req.userId = data.user.id;
  next();
}

/** Rotas do n8n: exige x-agent-key igual a AGENT_API_KEY. */
export function exigirAgente(req: Request, res: Response, next: NextFunction) {
  const recebida = Buffer.from(req.header('x-agent-key') ?? '');
  const esperada = Buffer.from(config.agentKey);
  if (!config.agentKey || recebida.length !== esperada.length || !timingSafeEqual(recebida, esperada)) {
    return res.status(401).json({ erro: 'Chave do agente inválida.' });
  }
  next();
}
