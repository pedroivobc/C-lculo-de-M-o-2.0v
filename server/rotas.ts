import { createHash, randomInt } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { calcular, CALCULADORAS, type TipoCalculo } from '../src/lib/calc';
import { config } from './config';
import { exigirAgente, exigirUsuario } from './auth';
import { supabaseAdmin, salvarArquivo, urlAssinada } from './supabase';
import { normalizarTelefone, telefoneDoJid } from './telefone';
import { enviarTexto } from './evolution';
import { arquivoDoOrcamento, buscarPorSeq, intervaloDoMes, listarCalculos, salvarCalculo } from './historico';
import { comLocalidade, configuracaoDoUsuario } from './estilo';
import { gerarCsv } from './exportar';
import { identificar, processarMensagem } from './agente/conversa';

export const rotas = Router();

/** Envolve handlers async: erro de validação vira 400 com a mensagem, o resto vira 500. */
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
  fn(req, res).catch((e) => {
    if (e instanceof z.ZodError) return res.status(400).json({ erro: 'Dados inválidos', detalhes: e.issues });
    console.error(e);
    res.status(500).json({ erro: e instanceof Error ? e.message : 'Erro interno' });
  });

rotas.get('/api/saude', (_req, res) => res.json({ ok: true, marca: config.marca }));

// ---------------- Agente (n8n) ----------------

const mensagemSchema = z.object({
  telefone: z.string().optional(),
  remoteJid: z.string().optional(),
  texto: z.string().optional(),
  messageId: z.string().optional(),
  nome: z.string().optional(),
  /** Aceitos por compatibilidade com o fluxo do n8n. O conteúdo de anexos não é baixado, lido nem guardado. */
  midia: z.object({ base64: z.string(), mimetype: z.string() }).optional(),
  temMidia: z.boolean().optional(),
});

rotas.post('/api/agente/mensagem', exigirAgente, h(async (req, res) => {
  const m = mensagemSchema.parse(req.body);
  const telefone = m.remoteJid ? telefoneDoJid(m.remoteJid) : normalizarTelefone(m.telefone ?? '');
  if (!telefone) return res.json({ status: 'ignorada', respostas: [] }); // grupo, broadcast ou número inválido
  const temAnexo = Boolean(m.midia || m.temMidia);
  res.json(await processarMensagem({ telefone, texto: m.texto, messageId: m.messageId, nome: m.nome, temAnexo }));
}));

rotas.get('/api/agente/identificar', exigirAgente, h(async (req, res) => {
  const telefone = normalizarTelefone(String(req.query.whatsapp ?? ''));
  if (!telefone) return res.status(400).json({ erro: 'Telefone inválido' });
  const a = await identificar(telefone);
  res.json(a ? { status: a.ativo ? 'ativo' : 'inativo', motivo: a.motivo, papel: a.papel, nome: a.nome, userId: a.userId } : { status: 'sem_cadastro' });
}));

// ---------------- Verificação do WhatsApp ----------------

const hashCodigo = (userId: string, codigo: string) =>
  createHash('sha256').update(`${config.codigoSegredo}:${userId}:${codigo}`).digest('hex');

const limiteCodigo = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

rotas.post('/api/whatsapp/codigo', limiteCodigo, exigirUsuario, h(async (req, res) => {
  const telefone = normalizarTelefone(z.object({ whatsapp: z.string() }).parse(req.body).whatsapp);
  if (!telefone) return res.status(400).json({ erro: 'Informe o WhatsApp com DDD.' });
  const db = supabaseAdmin();
  const { data: emUso } = await db.from('profiles').select('id').eq('whatsapp_e164', telefone).neq('id', req.userId!).maybeSingle();
  if (emUso) return res.status(409).json({ erro: 'Este WhatsApp já está ligado a outra conta.' });
  const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.from('phone_verifications').insert({
    user_id: req.userId, whatsapp_e164: telefone, code_hash: hashCodigo(req.userId!, codigo),
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  await enviarTexto(telefone, `Seu código do ${config.marca}: *${codigo}*\nVale por 10 minutos. Não compartilhe.`);
  res.json({ ok: true, enviadoPara: telefone });
}));

rotas.post('/api/whatsapp/verificar', exigirUsuario, h(async (req, res) => {
  const { codigo } = z.object({ codigo: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const db = supabaseAdmin();
  const { data: v } = await db.from('phone_verifications').select('*').eq('user_id', req.userId!)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!v || new Date(v.expires_at) < new Date()) return res.status(400).json({ erro: 'Código expirado. Peça um novo.' });
  if (v.attempts >= 5) return res.status(429).json({ erro: 'Muitas tentativas. Peça um novo código.' });
  if (v.code_hash !== hashCodigo(req.userId!, codigo)) {
    await db.from('phone_verifications').update({ attempts: v.attempts + 1 }).eq('id', v.id);
    return res.status(400).json({ erro: 'Código incorreto.' });
  }
  await db.from('profiles').update({ whatsapp_e164: v.whatsapp_e164, whatsapp_verified_at: new Date().toISOString() }).eq('id', req.userId!);
  await db.from('phone_verifications').delete().eq('user_id', req.userId!);
  res.json({ ok: true, whatsapp: v.whatsapp_e164 });
}));

// ---------------- Cálculos pelo site ----------------

rotas.post('/api/calculos/:tipo', exigirUsuario, h(async (req, res) => {
  const tipo = req.params.tipo as TipoCalculo;
  if (!CALCULADORAS[tipo]) return res.status(404).json({ erro: 'Tipo de cálculo inexistente' });
  const { descricao, salvar = true, ...informado } = req.body ?? {};
  // Cidade e alíquota do ITBI do assinante entram quando a tela não manda outra.
  const usaLocalidade = tipo !== 'correcao';
  const entrada = usaLocalidade ? comLocalidade(informado, (await configuracaoDoUsuario(req.userId!)).localidade) : informado;
  const resultado = calcular(tipo, entrada);
  if (!salvar) return res.json({ resultado });
  const salvo = await salvarCalculo({ userId: req.userId!, resultado, entrada, origem: 'site', descricao });
  res.json({ resultado, numero: salvo.seq, id: salvo.id });
}));

rotas.get('/api/calculos', exigirUsuario, h(async (req, res) => {
  const mes = req.query.mes ? intervaloDoMes(String(req.query.mes)) : {};
  res.json(await listarCalculos(req.userId!, {
    ...mes, tipo: req.query.tipo as string | undefined, origem: req.query.origem as string | undefined,
  }));
}));

/** Link temporário do orçamento. Formato: ?formato=pdf|jpeg; sem ele, o escolhido na conta. `/pdf` força PDF. */
rotas.get(['/api/calculos/:seq/arquivo', '/api/calculos/:seq/pdf'], exigirUsuario, h(async (req, res) => {
  const salvo = await buscarPorSeq(req.userId!, Number(req.params.seq));
  if (!salvo) return res.status(404).json({ erro: 'Cálculo não encontrado' });
  const { estilo } = await configuracaoDoUsuario(req.userId!);
  const pedido = req.path.endsWith('/pdf') ? 'pdf' : req.query.formato;
  const formato = pedido === 'pdf' || pedido === 'jpeg' ? pedido : estilo.formato;
  res.json(await arquivoDoOrcamento(salvo, estilo, formato));
}));

rotas.get('/api/exportar', exigirUsuario, h(async (req, res) => {
  const mes = String(req.query.mes ?? new Date().toISOString().slice(0, 7));
  const calculos = await listarCalculos(req.userId!, intervaloDoMes(mes));
  const nome = `calculos-${mes}.csv`;
  const caminho = await salvarArquivo(`${req.userId}/exportacoes/${nome}`, gerarCsv(calculos), 'text/csv');
  res.json({ quantidade: calculos.length, url: await urlAssinada(caminho, 600, nome) });
}));

// ---------------- Pedido de cidade (landing, sem login) ----------------

const limitePedido = rateLimit({ windowMs: 60 * 60_000, limit: 10 });
rotas.post('/api/cidades/pedido', limitePedido, h(async (req, res) => {
  const { cidade, uf, whatsapp } = z.object({
    cidade: z.string().min(2).max(80), uf: z.string().regex(/^[A-Za-z]{2}$/).default('MG'), whatsapp: z.string().optional(),
  }).parse(req.body);
  await supabaseAdmin().from('pedidos_cidade').insert({ cidade: cidade.trim(), uf: uf.toUpperCase(), whatsapp_e164: whatsapp ? normalizarTelefone(whatsapp) : null });
  res.json({ ok: true });
}));
