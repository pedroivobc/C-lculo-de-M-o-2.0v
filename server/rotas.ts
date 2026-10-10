import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { calcular, calcularItbi, CALCULADORAS, comCustos, MUNICIPIOS_ITBI, type TipoCalculo } from '../src/lib/calc';
import { config } from './config';
import { exigirAdmin, exigirAgente, exigirGestor, exigirUsuario } from './auth';
import { compararTabelas, ehErroPlanilha, gerarPlanilha, lerPlanilha, listarVersoes, parametrosParaJson, publicarTabela, removerVersao, TIPOS, tipoValido, versoesVigentes } from './tabelas';
import { supabaseAdmin, salvarArquivo, urlAssinada } from './supabase';
import { normalizarTelefone, telefoneDoJid, variantesTelefone } from './telefone';
import { criarCodigo, mensagemDeConfirmacao } from './verificacao';
import { cpfValido, soDigitosCpf } from '../src/lib/cpf';
import { codigoDoUsuario, linkDeIndicacao, resumoDaIndicacao, usarCodigo, validarCodigo } from './indicacao';
import { arquivoDoOrcamento, buscarPorSeq, intervaloDoMes, listarCalculos, salvarCalculo } from './historico';
import { comLocalidade, configuracaoDoUsuario, correcaoLiberada } from './estilo';
import { gerarCsv } from './exportar';
import { identificar, processarMensagem } from './agente/conversa';
import { abrirCadastroDeCartao, abrirCheckout, abrirCheckoutLancamento, abrirPortal, vagasDoLancamento, cancelarAssinatura, ErroAssinatura, lerEvento, tratarEvento } from './pagamento';
import { envioDe } from './agente/whatsapp';
import {
  alterarMembro, alterarOrganizacao, criarOrganizacao, ErroEquipe, gestaoDoNegocio, incluirMembro, liberarManualmente,
  orcamentosDaEquipe, relatorioDaEquipe, removerMembro, resumoEquipe, type DadosMembro, type NovaOrganizacao,
} from './equipe';
import { encerrarLiberacao, estenderTeste, fichaDoUsuario, liberarPlano, listarUsuarios, registrar, visaoGeral } from './gestao';
import { contasDeTeste } from './agente/teste';

export const rotas = Router();

/** Envolve handlers async: erro de validação vira 400 com a mensagem, o resto vira 500. */
const h = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response) =>
  fn(req, res).catch((e) => {
    if (e instanceof z.ZodError) return res.status(400).json({ erro: 'Dados inválidos', detalhes: e.issues });
    if (e instanceof ErroEquipe) return res.status(e.status).json({ erro: e.message });
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
  /** Mensagem de voz: base64 (se a Evolution mandar no webhook) ou { key, message } para baixar. Transcrita e descartada. */
  audio: z.object({
    base64: z.string().nullish(),
    mimetype: z.string().nullish(),
    segundos: z.number().nullish(),
    mensagem: z.record(z.unknown()).nullish(),
  }).nullish(),
});

rotas.post('/api/agente/mensagem', exigirAgente, h(async (req, res) => {
  const m = mensagemSchema.parse(req.body);
  const telefone = m.remoteJid ? telefoneDoJid(m.remoteJid) : normalizarTelefone(m.telefone ?? '');
  if (!telefone) return res.json({ status: 'ignorada', respostas: [] }); // grupo, broadcast ou número inválido
  const temAnexo = Boolean(m.midia || m.temMidia);
  const r = await processarMensagem({ telefone, texto: m.texto, messageId: m.messageId, nome: m.nome, temAnexo, audio: m.audio ?? undefined });
  // Cada resposta leva também o envio pronto para a Evolution (texto, botões, lista ou arquivo).
  res.json({ ...r, respostas: r.respostas.map((x) => ({ ...x, envio: envioDe(x, config.whatsappBotoes) })) });
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
  // Conta de teste do WhatsApp com este número não bloqueia: ela passa para esta conta na confirmação.
  const { data: emUso } = await supabaseAdmin().from('profiles').select('id')
    .in('whatsapp_e164', variantesTelefone(telefone))
    .not('id', 'in', `(${[req.userId!, ...await contasDeTeste(telefone)].join(',')})`).limit(1).maybeSingle();
  if (emUso) return res.status(409).json({ erro: 'Este WhatsApp já está ligado a outra conta.' });
  const codigo = await criarCodigo(req.userId!, telefone);
  res.json({ whatsapp: telefone, codigo, mensagem: mensagemDeConfirmacao(codigo) });
}));

// ---------------- Tabelas anuais (admin) ----------------

/** Tabelas em vigor, para o site calcular igual ao servidor. */
rotas.get('/api/parametros', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ parametros: parametrosParaJson(), versoes: versoesVigentes() });
});

// ---------------- Motor de ITBI (5 capitais) — só administrador, ainda fora do site ----------------
rotas.get('/api/admin/itbi/municipios', exigirUsuario, exigirAdmin, (_req, res) => { res.json({ municipios: MUNICIPIOS_ITBI }); });

rotas.post('/api/admin/itbi', exigirUsuario, exigirAdmin, h(async (req, res) => {
  try { res.json(calcularItbi(req.body)); }
  catch (e) {
    if (e instanceof z.ZodError) throw e;
    res.status(400).json({ erro: e instanceof Error ? e.message : String(e) }); // município ou data sem regra
  }
}));

rotas.get('/api/admin/tabelas', exigirUsuario, exigirAdmin, h(async (_req, res) => {
  res.json({ tipos: TIPOS, vigentes: versoesVigentes(), versoes: await listarVersoes() });
}));

/** Planilha da tabela em vigor, para editar e enviar como a do ano seguinte. */
rotas.get('/api/admin/tabelas/:tipo/planilha', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const tipo = String(req.params.tipo);
  if (!tipoValido(tipo)) return res.status(404).json({ erro: 'Tabela desconhecida.' });
  const nome = `${TIPOS[tipo].arquivo}-${versoesVigentes()[tipo].ano}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nome}"`);
  res.send(await gerarPlanilha(tipo));
}));

const envioTabela = z.object({
  arquivo: z.string().min(10).max(4_000_000), // .xlsx em base64
  ano: z.coerce.number().int().min(2026).max(2100),
  vigenciaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Lê e valida a planilha e mostra o que muda, sem publicar. */
rotas.post('/api/admin/tabelas/:tipo/previa', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const tipo = String(req.params.tipo);
  if (!tipoValido(tipo)) return res.status(404).json({ erro: 'Tabela desconhecida.' });
  const e = envioTabela.parse(req.body);
  try {
    const dados = await lerPlanilha(tipo, Buffer.from(e.arquivo, 'base64'), e.ano);
    res.json({ ok: true, ...compararTabelas(tipo, dados) });
  } catch (err) {
    if (ehErroPlanilha(err)) return res.status(400).json({ erro: err.message });
    throw err;
  }
}));

rotas.post('/api/admin/tabelas/:tipo/publicar', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const tipo = String(req.params.tipo);
  if (!tipoValido(tipo)) return res.status(404).json({ erro: 'Tabela desconhecida.' });
  const e = envioTabela.parse(req.body);
  try {
    const dados = await lerPlanilha(tipo, Buffer.from(e.arquivo, 'base64'), e.ano);
    await publicarTabela(tipo, e.ano, e.vigenciaInicio, dados, req.userId!);
    res.json({ ok: true, vigentes: versoesVigentes(), versoes: await listarVersoes() });
  } catch (err) {
    if (ehErroPlanilha(err)) return res.status(400).json({ erro: err.message });
    throw err;
  }
}));

rotas.delete('/api/admin/tabelas/versao/:id', exigirUsuario, exigirAdmin, h(async (req, res) => {
  await removerVersao(String(req.params.id));
  res.json({ ok: true, vigentes: versoesVigentes(), versoes: await listarVersoes() });
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

// ---------------- Assinatura (Stripe) ----------------

const limiteAssinatura = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

/** Erro de regra (já assina, Pix fora do anual) vira 409 com a mensagem; o resto segue para o 500. */
const regra = (fn: (req: Request, res: Response) => Promise<unknown>) => async (req: Request, res: Response) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof ErroAssinatura) return res.status(409).json({ erro: e.message });
    throw e;
  }
};

/** Abre o Checkout da Stripe. Corpo: { nivel, periodo, forma }. Pix só no anual. */
rotas.post('/api/assinatura/checkout', limiteAssinatura, exigirUsuario, h(regra(async (req, res) => {
  const { nivel, periodo, forma } = z.object({
    nivel: z.enum(['usuario', 'pro']),
    periodo: z.enum(['trimestral', 'semestral', 'anual']),
    forma: z.enum(['cartao', 'pix']),
  }).refine((v) => v.forma === 'cartao' || v.periodo === 'anual', { message: 'O Pix vale só para o plano anual.' }).parse(req.body);
  res.json({ url: await abrirCheckout(req.userId!, nivel, periodo, forma) });
})));

/** Oferta de lançamento: R$ 9,90/mês, 3 dias de teste com cartão, só para os primeiros 20. */
rotas.post('/api/assinatura/lancamento', limiteAssinatura, exigirUsuario, h(regra(async (req, res) => {
  res.json({ url: await abrirCheckoutLancamento(req.userId!) });
})));

const limiteOferta = rateLimit({ windowMs: 15 * 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
/** Público: quantas vagas da oferta de lançamento ainda restam (site e landing). */
rotas.get('/api/oferta', limiteOferta, h(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ vagas: await vagasDoLancamento() });
}));

/** Cadastra o cartão sem cobrar (libera o teste grátis). */
rotas.post('/api/assinatura/cartao', limiteAssinatura, exigirUsuario, h(async (req, res) => {
  res.json({ url: await abrirCadastroDeCartao(req.userId!) });
}));

/** Portal da Stripe: trocar cartão e ver faturas. */
rotas.post('/api/assinatura/portal', limiteAssinatura, exigirUsuario, h(async (req, res) => {
  res.json({ url: await abrirPortal(req.userId!) });
}));

/** Agenda o cancelamento (vale no fim da fidelidade ou do mês já pago). */
rotas.post('/api/assinatura/cancelar', limiteAssinatura, exigirUsuario, h(regra(async (req, res) => {
  res.json(await cancelarAssinatura(req.userId!));
})));

/** Eventos da Stripe (montado em app.ts com o corpo bruto, antes do express.json). */
export async function webhookStripe(req: Request, res: Response) {
  let evento;
  try {
    evento = lerEvento(req.body as Buffer, req.header('stripe-signature') ?? '');
  } catch (e) {
    console.error('Webhook Stripe recusado:', e instanceof Error ? e.message : e);
    return res.status(400).json({ erro: 'Assinatura do webhook inválida.' });
  }
  try {
    await tratarEvento(evento);
    res.json({ ok: true });
  } catch (e) {
    // 500 faz a Stripe tentar de novo mais tarde.
    console.error(`Webhook Stripe ${evento.type} (${evento.id}):`, e);
    res.status(500).json({ erro: 'Falha ao processar o evento.' });
  }
}

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

// ---------------- Equipe (gestor da imobiliária) ----------------

const mesDaConsulta = (req: Request) => {
  const mes = String(req.query.mes ?? new Date().toISOString().slice(0, 7));
  return { mes, ...intervaloDoMes(mes) };
};

/** Valida e devolve a primeira mensagem em português, para mostrar no formulário. */
function validar<T>(schema: z.ZodTypeAny, corpo: unknown): T {
  const r = schema.safeParse(corpo);
  if (!r.success) throw new ErroEquipe(r.error.issues[0]?.message ?? 'Dados inválidos');
  return r.data as T;
}

const membroSchema = z.object({
  nome: z.string().trim().min(2, 'Informe o nome.').max(120),
  telefone: z.string().transform((t, ctx) => {
    const n = normalizarTelefone(t);
    if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe o telefone com DDD.' });
    return n ?? '';
  }),
  email: z.string().trim().email('E-mail inválido.').max(200).optional().or(z.literal('')).nullable(),
});

rotas.get('/api/equipe', exigirUsuario, exigirGestor, h(async (req, res) => {
  res.json(await resumoEquipe(req.organizacao!, mesDaConsulta(req)));
}));

rotas.post('/api/equipe/membros', exigirUsuario, exigirGestor, h(async (req, res) => {
  res.json(await incluirMembro(req.organizacao!, validar<DadosMembro>(membroSchema, req.body)));
}));

rotas.put('/api/equipe/membros/:id', exigirUsuario, exigirGestor, h(async (req, res) => {
  res.json(await alterarMembro(req.organizacao!, String(req.params.id), validar<DadosMembro>(membroSchema, req.body)));
}));

rotas.delete('/api/equipe/membros/:id', exigirUsuario, exigirGestor, h(async (req, res) => {
  res.json(await removerMembro(req.organizacao!, String(req.params.id)));
}));

rotas.get('/api/equipe/orcamentos', exigirUsuario, exigirGestor, h(async (req, res) => {
  const { de, ate } = mesDaConsulta(req);
  const { calculos, nomes } = await orcamentosDaEquipe(req.organizacao!.id, { de, ate, membroUserId: req.query.usuario ? String(req.query.usuario) : undefined });
  res.json(calculos.map((c) => ({
    id: c.id, seq: c.seq, tipo: c.tipo, origem: c.origem, descricao: c.descricao, total: c.total, created_at: c.created_at,
    userId: c.user_id, usuario: nomes.get(c.user_id) ?? '—',
  })));
}));

/** Orçamento de alguém da equipe, com a marca da equipe e o contato de quem orçou. */
rotas.get('/api/equipe/orcamentos/:id/arquivo', exigirUsuario, exigirGestor, h(async (req, res) => {
  const { data } = await supabaseAdmin().from('calculations').select('*').eq('id', String(req.params.id)).eq('organizacao_id', req.organizacao!.id).maybeSingle();
  if (!data) return res.status(404).json({ erro: 'Orçamento não encontrado' });
  const { estilo } = await configuracaoDoUsuario(data.user_id);
  res.json(await arquivoDoOrcamento(data, estilo));
}));

rotas.get('/api/equipe/relatorio', exigirUsuario, exigirGestor, h(async (req, res) => {
  const { mes, de, ate } = mesDaConsulta(req);
  res.json(await relatorioDaEquipe(req.organizacao!, mes, { de, ate }));
}));

rotas.get('/api/equipe/exportar', exigirUsuario, exigirGestor, h(async (req, res) => {
  const { mes, de, ate } = mesDaConsulta(req);
  const { calculos, nomes } = await orcamentosDaEquipe(req.organizacao!.id, { de, ate });
  const nome = `equipe-${mes}.csv`;
  const caminho = await salvarArquivo(`${req.userId}/exportacoes/${nome}`, gerarCsv(calculos, nomes), 'text/csv');
  res.json({ quantidade: calculos.length, url: await urlAssinada(caminho, 600, nome) });
}));

// ---------------- Gestão do negócio (admin) ----------------

rotas.get('/api/admin/gestao', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const { de, ate } = mesDaConsulta(req);
  res.json(await gestaoDoNegocio({ de, ate }));
}));

rotas.post('/api/admin/organizacoes', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const d = validar<NovaOrganizacao>(z.object({
    nome: z.string().trim().min(2, 'Informe o nome da organização.').max(120),
    tipo: z.enum(['teams', 'clemente']),
    emailGestor: z.string().trim().email('E-mail do gestor inválido.'),
    telefoneGestor: z.string().optional().nullable(),
    assentosBase: z.coerce.number().int().min(1, 'O pacote precisa de pelo menos 1 usuário.').max(500).default(5),
  }), req.body);
  const telefoneGestor = d.telefoneGestor ? normalizarTelefone(d.telefoneGestor) : null;
  if (d.telefoneGestor && !telefoneGestor) return res.status(400).json({ erro: 'Telefone do gestor inválido.' });
  const org = await criarOrganizacao({ ...d, telefoneGestor });
  await registrar(req.userId!, 'criar_equipe', { tipo: 'organizacao', id: org.id }, { depois: { nome: d.nome, tipo: d.tipo, assentosBase: d.assentosBase } });
  res.json(org);
}));

rotas.put('/api/admin/organizacoes/:id', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const d = z.object({ nome: z.string().trim().min(2).max(120).optional(), assentosBase: z.coerce.number().int().min(1).max(500).optional() }).parse(req.body);
  const id = String(req.params.id);
  const { data: antes } = await supabaseAdmin().from('organizacoes').select('nome, assentos_base').eq('id', id).maybeSingle();
  const r = await alterarOrganizacao(id, d);
  await registrar(req.userId!, 'mudar_pacote', { tipo: 'organizacao', id }, { antes, depois: d });
  res.json(r);
}));

rotas.post('/api/admin/organizacoes/:id/liberar', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const { ate } = validar<{ ate: string }>(z.object({ ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.') }), req.body);
  const r = await liberarManualmente(String(req.params.id), ate);
  await registrar(req.userId!, 'liberar_equipe', { tipo: 'organizacao', id: String(req.params.id) }, { depois: { ate } });
  res.json(r);
}));

/** O administrador também trabalha como gestor: cria a própria Clemente Team (ele é o dono). */
rotas.post('/api/admin/minha-equipe', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const d = validar<{ nome: string; telefone?: string | null }>(z.object({
    nome: z.string().trim().min(2, 'Informe o nome da equipe.').max(120),
    telefone: z.string().optional().nullable(),
  }), req.body);
  const telefoneGestor = d.telefone ? normalizarTelefone(d.telefone) : null;
  if (d.telefone && !telefoneGestor) return res.status(400).json({ erro: 'Telefone inválido.' });
  const { data: eu } = await supabaseAdmin().from('profiles').select('email').eq('id', req.userId!).maybeSingle();
  if (!eu?.email) return res.status(400).json({ erro: 'A sua conta não tem e-mail.' });
  const org = await criarOrganizacao({ nome: d.nome, tipo: 'clemente', emailGestor: eu.email, telefoneGestor, assentosBase: 5 });
  await registrar(req.userId!, 'criar_equipe', { tipo: 'organizacao', id: org.id }, { depois: { nome: d.nome, tipo: 'clemente' } });
  res.json(org);
}));

// ---------------- Gestão de Negócio: visão geral e usuários (admin) ----------------

rotas.get('/api/admin/visao', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const dias = [7, 30, 90, 365].includes(Number(req.query.dias)) ? Number(req.query.dias) : 30;
  res.json(await visaoGeral(dias));
}));

rotas.get('/api/admin/usuarios', exigirUsuario, exigirAdmin, h(async (_req, res) => {
  res.json({ usuarios: await listarUsuarios() });
}));

rotas.get('/api/admin/usuarios/:id', exigirUsuario, exigirAdmin, h(async (req, res) => {
  res.json(await fichaDoUsuario(String(req.params.id)));
}));

const motivoSchema = z.string().trim().min(3, 'Escreva o motivo (fica registrado na auditoria).').max(300);
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida.');

rotas.post('/api/admin/usuarios/:id/liberar', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const d = validar<{ nivel: 'usuario' | 'pro'; ate: string; motivo: string }>(z.object({ nivel: z.enum(['usuario', 'pro']), ate: dataSchema, motivo: motivoSchema }), req.body);
  res.json(await liberarPlano(req.userId!, String(req.params.id), d));
}));

rotas.post('/api/admin/usuarios/:id/encerrar', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const d = validar<{ motivo: string }>(z.object({ motivo: motivoSchema }), req.body);
  res.json(await encerrarLiberacao(req.userId!, String(req.params.id), d.motivo));
}));

rotas.post('/api/admin/usuarios/:id/teste', exigirUsuario, exigirAdmin, h(async (req, res) => {
  const d = validar<{ ate: string; motivo: string }>(z.object({ ate: dataSchema, motivo: motivoSchema }), req.body);
  res.json(await estenderTeste(req.userId!, String(req.params.id), d));
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
