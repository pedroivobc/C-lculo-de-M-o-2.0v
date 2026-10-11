import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';

declare module 'express-serve-static-core' {
  interface Request { requestId?: string }
}

/** Cada pedido ganha um código (header X-Request-Id) para achar o erro no log a partir do que o usuário viu. */
export function marcarPedido(req: Request, res: Response, next: NextFunction) {
  req.requestId = randomUUID().slice(0, 8);
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/** Loga o detalhe no servidor; em produção o usuário vê só uma mensagem genérica com o código do pedido. */
export function erroInterno(req: Request, res: Response, e: unknown, status = 500) {
  const id = req.requestId ?? randomUUID().slice(0, 8);
  console.error(`[${id}] ${req.method} ${req.path}:`, e);
  if (res.headersSent) return;
  const detalhe = e instanceof Error ? e.message : 'Erro interno';
  res.status(status).json({
    erro: config.producao ? `Algo deu errado do nosso lado. Tente de novo; se continuar, informe o código ${id} ao suporte.` : detalhe,
    requestId: id,
  });
}

/** Último middleware: erros fora dos handlers (JSON malformado, corpo grande demais) também saem sem detalhe interno. */
export function tratarErro(e: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = (e as { status?: number; statusCode?: number })?.status ?? (e as { statusCode?: number })?.statusCode ?? 500;
  if (status >= 400 && status < 500) {
    if (res.headersSent) return;
    return res.status(status).json({ erro: status === 413 ? 'Arquivo grande demais.' : 'Pedido inválido.', requestId: req.requestId });
  }
  erroInterno(req, res, e);
}
