import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';
import { supabaseAdmin } from './supabase';
import { vinculoDoUsuario, type Organizacao } from './equipe';

declare module 'express-serve-static-core' {
  interface Request { userId?: string; organizacao?: Organizacao }
}

/** Rotas do site: exige o token do Supabase Auth (Authorization: Bearer <jwt>). */
export async function exigirUsuario(req: Request, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ erro: 'Faça login para continuar.' });
  let resposta: Awaited<ReturnType<ReturnType<typeof supabaseAdmin>['auth']['getUser']>>;
  try {
    resposta = await supabaseAdmin().auth.getUser(token);
  } catch (e) {
    // Falha de rede ou configuração (ex.: SUPABASE_URL errada), não de sessão: não mandar o usuário entrar de novo à toa.
    console.error('Login: não foi possível falar com o Supabase:', e);
    return res.status(503).json({ erro: 'Não conseguimos confirmar o seu login agora. Tente de novo em instantes.' });
  }
  const { data, error } = resposta;
  if (error?.name === 'AuthRetryableFetchError') {
    console.error('Login: não foi possível falar com o Supabase:', error.message);
    return res.status(503).json({ erro: 'Não conseguimos confirmar o seu login agora. Tente de novo em instantes.' });
  }
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

/** Rotas do administrador: usuário logado com papel 'admin' (usar depois de exigirUsuario). */
export async function exigirAdmin(req: Request, res: Response, next: NextFunction) {
  const { data } = await supabaseAdmin().from('profiles').select('papel').eq('id', req.userId!).maybeSingle();
  if (data?.papel !== 'admin') return res.status(403).json({ erro: 'Área restrita ao administrador.' });
  next();
}

/** Rotas da equipe: gestor de uma organização (usar depois de exigirUsuario). Deixa a organização em req.organizacao. */
export async function exigirGestor(req: Request, res: Response, next: NextFunction) {
  const v = await vinculoDoUsuario(req.userId!).catch(() => null);
  if (!v || v.funcao !== 'gestor') return res.status(403).json({ erro: 'Área restrita ao gestor da equipe.' });
  req.organizacao = v.organizacao;
  next();
}
