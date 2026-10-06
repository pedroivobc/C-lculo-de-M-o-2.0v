import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { calcular, CALCULADORAS, comCustos, type TipoCalculo } from '../src/lib/calc';
import { config } from './config';
import { exigirAgente, exigirUsuario } from './auth';
import { supabaseAdmin, salvarArquivo, urlAssinada } from './supabase';
import { normalizarTelefone, telefoneDoJid, variantesTelefone } from './telefone';
import { criarCodigo, mensagemDeConfirmacao } from './verificacao';
import { cpfValido, soDigitosCpf } from '../src/lib/cpf';
import { codigoDoUsuario, linkDeIndicacao, resumoDaIndicacao, usarCodigo, validarCodigo } from './indicacao';
import { arquivoDoOrcamento, buscarPorSeq, intervaloDoMes, listarCalculos, salvarCalculo } from './historico';
import { comLocalidade, configuracaoDoUsuario, correcaoLiberada } from './estilo';
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

const limiteCodigo = rateLimit({ windowMs: 15 * 60_000, limit: 5, standardHeaders: true, legacyHeaders: false });

/** Gera o código que o corretor envia ao agente pelo WhatsApp (ver ./verificacao.ts). Nada é enviado daqui. */
rotas.post('/api/whatsapp/codigo', limiteCodigo, exigirUsuario, h(async (req, res) => {
  const telefone = normalizarTelefone(z.object({ whatsapp: z.string() }).parse(req.body).whatsapp);
  if (!telefone) return res.status(400).json({ erro: 'Informe o WhatsApp com DDD.' });
  const { data: emUso } = await supabaseAdmin().from('profiles').select('id')
    .in('whatsapp_e164', variantesTelefone(telefone)).neq('id', req.userId!).limit(1).maybeSingle();
  if (emUso) return res.status(409).json({ erro: 'Este WhatsApp já está ligado a outra conta.' });
  const codigo = await criarCodigo(req.userId!, telefone);
  res.json({ whatsapp: telefone, codigo, mensagem: mensagemDeConfirmacao(codigo) });
}));

// ---------------- CPF (um por conta) ----------------

/** Grava o CPF da conta. Único no sistema: a mesma pessoa não abre outra conta para repetir teste ou cupom. */
rotas.post('/api/conta/cpf', limiteCodigo, exigirUsuario, h(async (req, res) => {
  const cpf = soDigitosCpf(z.object({ cpf: z.string() }).parse(req.body).cpf);
  if (!cpfValido(cpf)) return res.status(400).json({ erro: 'CPF inválido. Confira os números.' });
  const db = supabaseAdmin();
  const { data: eu } = await db.from('profiles').select('cpf').eq('id', req.userId!).single();
  if (eu?.cpf) {
    if (eu.cpf === cpf) return res.json({ ok: true });
    return res.status(409).json({ erro: 'O CPF desta conta já foi cadastrado e não pode ser trocado. Fale com o suporte.' });
  }
  const { data: outro } = await db.from('profiles').select('id').eq('cpf', cpf).neq('id', req.userId!).maybeSingle();
  if (outro) return res.status(409).json({ erro: 'Este CPF já tem uma conta. Entre com ela ou fale com o suporte.' });
  const { error } = await db.from('profiles').update({ cpf }).eq('id', req.userId!);
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ erro: error.code === '23505' ? 'Este CPF já tem uma conta.' : error.message });
  res.json({ ok: true });
}));

// ---------------- Cupom de indicação ----------------

rotas.get('/api/indicacao', exigirUsuario, h(async (req, res) => {
  res.json(await resumoDaIndicacao(req.userId!));
}));

rotas.post('/api/indicacao/codigo', exigirUsuario, h(async (req, res) => {
  const codigo = await codigoDoUsuario(req.userId!);
  res.json({ codigo, link: linkDeIndicacao(codigo) });
}));

rotas.post('/api/indicacao/usar', exigirUsuario, h(async (req, res) => {
  const { codigo } = z.object({ codigo: z.string().min(3).max(40) }).parse(req.body);
  try {
    res.json(await usarCodigo(req.userId!, codigo));
  } catch (e) {
    res.status(400).json({ erro: e instanceof Error ? e.message : String(e) });
  }
}));

/** Público, para a tela de cadastro mostrar "Cupom de Pedro: 5 dias grátis" antes de criar a conta. */
const limiteCupom = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
rotas.get('/api/indicacao/validar', limiteCupom, h(async (req, res) => {
  res.json(await validarCodigo(String(req.query.codigo ?? '')));
}));

// ---------------- Cálculos pelo site ----------------

rotas.post('/api/calculos/:tipo', exigirUsuario, h(async (req, res) => {
  const tipo = req.params.tipo as TipoCalculo;
  if (!CALCULADORAS[tipo]) return res.status(404).json({ erro: 'Tipo de cálculo inexistente' });
  const { descricao, salvar = true, ...informado } = req.body ?? {};
  // Cidade e alíquota do ITBI do assinante entram quando a tela não manda outra.
  const usaLocalidade = tipo !== 'correcao';
  const conf = await configuracaoDoUsuario(req.userId!);
  if (tipo === 'correcao' && !correcaoLiberada(conf.localidade.municipio)) {
    return res.status(403).json({ erro: 'A correção contratual está disponível só para Juiz de Fora (MG).' });
  }
  const entrada = usaLocalidade ? comCustos(tipo, comLocalidade(informado, conf.localidade), conf.custos) : informado;
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
