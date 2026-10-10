import { GoogleGenAI, type Content } from '@google/genai';
import { confirmarPorMensagem, type ResultadoConfirmacao } from '../verificacao';
import { ZodError } from 'zod';
import { brl, calcular, comCustos, MUNICIPIOS, MUNICIPIO_OUTRA } from '../../src/lib/calc';
import { config } from '../config';
import { supabaseAdmin } from '../supabase';
import { variantesTelefone } from '../telefone';
import { DECLARACOES, executar, type Contexto, type Resposta } from './ferramentas';
import { passo, telaAtual, type ContextoMenu, type Estado, type FormatoEntrega } from './menu';
import { orcamentoEmTexto } from './orcamentoTexto';
import { codigoDoUsuario, DIAS_TESTE, DIAS_TESTE_INDICACAO, linkDeIndicacao } from '../indicacao';
import { arquivoDoOrcamento, buscarPorSeq, numeroCalculo, salvarCalculo, type CalculoSalvo } from '../historico';
import { comLocalidade, configuracaoDoUsuario, type Configuracao } from '../estilo';
import { usaWhatsapp, type Papel } from '../../src/lib/planos';
import { pedirAtendente } from '../chatwoot';
import { AUDIO_MAX_SEGUNDOS, transcreverAudio, type AudioRecebido } from './audio';
import { falar } from './voz';

export interface MensagemRecebida {
  telefone: string;              // E.164
  texto?: string;
  messageId?: string;
  nome?: string;                 // pushName do WhatsApp
  /** A mensagem trouxe foto ou arquivo. Só o fato é registrado: o anexo não é lido nem guardado. */
  temAnexo?: boolean;
  /** Mensagem de voz: é transcrita (só para assinantes com o agente) e segue como se fosse escrita. */
  audio?: AudioRecebido;
}

export type MotivoAcesso = 'ok' | 'trial' | 'sem_cartao' | 'trial_expirado' | 'assinatura_inativa' | 'organizacao_inativa' | 'sem_perfil';

export interface Assinante {
  userId: string;
  nome: string | null;
  configuracao: Configuracao;
  papel: Papel;
  /** Regra única do banco (situacao_acesso): cartão validado + trial no prazo ou assinatura ativa; admin sempre. */
  ativo: boolean;
  motivo: MotivoAcesso;
}

export async function identificar(telefone: string): Promise<Assinante | null> {
  const db = supabaseAdmin();
  const { data: perfil } = await db.from('profiles')
    .select('id, full_name, nome')
    .in('whatsapp_e164', variantesTelefone(telefone))
    .not('whatsapp_verified_at', 'is', null)
    .limit(1).maybeSingle();
  if (!perfil) return null;
  const { data: situacao, error } = await db.rpc('situacao_acesso', { uid: perfil.id }).maybeSingle<{ papel: Assinante['papel']; liberado: boolean; motivo: MotivoAcesso }>();
  if (error) throw new Error(`Falha ao consultar o acesso: ${error.message}`);
  return {
    userId: perfil.id, nome: perfil.nome?.trim() || perfil.full_name?.trim().split(/\s+/)[0] || null, configuracao: await configuracaoDoUsuario(perfil.id),
    papel: situacao?.papel ?? 'trial', ativo: !!situacao?.liberado, motivo: situacao?.motivo ?? 'sem_perfil',
  };
}

const MENSAGEM_BLOQUEIO: Record<MotivoAcesso, (url: string) => string> = {
  ok: () => '',
  trial: () => '',
  sem_cartao: (u) => `Para usar o ${config.marca}, cadastre um cartão de crédito na sua conta (mesmo que vá pagar no Pix): ${u}/app/conta`,
  trial_expirado: (u) => `Seu teste grátis do ${config.marca} terminou. Assine em ${u}/assinar e eu volto a calcular na hora.`,
  assinatura_inativa: (u) => `Sua assinatura do ${config.marca} não está ativa. Renove em ${u}/assinar e eu volto a calcular na hora.`,
  organizacao_inativa: () => `O plano da sua equipe no ${config.marca} não está ativo. Fale com o gestor da sua imobiliária.`,
  sem_perfil: (u) => `Não encontrei sua conta. Entre em ${u}/entrar.`,
};

function instrucoes(a: Assinante) {
  const l = a.configuracao.localidade;
  const outra = l.municipio === MUNICIPIO_OUTRA;
  const cidade = outra ? `${l.cidade ?? 'cidade de MG'} (ITBI de ${l.itbiPercentual}% informado pelo assinante)`
    : `${MUNICIPIOS[l.municipio]?.nome ?? l.municipio}${l.itbiPercentual !== undefined ? ` (ITBI de ${l.itbiPercentual}% informado pelo assinante)` : ''}`;
  const atendidos = Object.values(MUNICIPIOS).map((m) => `${m.nome} (${m.uf})`).join(', ');
  const formato = a.configuracao.estilo.formato === 'jpeg' ? 'imagem (JPEG)' : 'PDF';
  return `Você é o agente do ${config.marca} no WhatsApp. Ajuda corretores, despachantes e assessorias a orçar custos de documentação de imóveis.
Hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Assinante: ${a.nome ?? 'sem nome'}. Município padrão: ${cidade}.
Municípios com regra da prefeitura cadastrada: ${atendidos}. Os emolumentos de cartório seguem a tabela de MG.
Os cálculos usam a cidade do assinante automaticamente; não pergunte a cidade se ele não falar de outra.

Regras:
- Nunca calcule valores por conta própria. Todo número vem de uma ferramenta.
- Se faltar um dado obrigatório (ex.: valor do imóvel, valor financiado, modalidade), pergunte só o que falta, em uma frase.
- A base de cálculo é o valor declarado do imóvel (a prefeitura não usa mais o valor venal corrigido). Se o usuário falar em "venal", use esse valor como valor declarado.
- Valores como "350 mil" ou "1,2 mi" viram números (350000, 1200000).
- Se o imóvel for em outra cidade de MG sem regra cadastrada, peça a alíquota do ITBI dessa cidade e passe municipio "mg-outra", cidade e itbiPercentual na ferramenta. Fora de MG, diga que ainda não atende o estado e chame pedir_cidade.
- Resposta curta, em português, no estilo do WhatsApp: total em *negrito* primeiro, depois os itens principais, e o número do cálculo (#0000). O orçamento já vai anexado em ${formato}: não cole links. Se ele pedir no outro formato, use reenviar_calculo com formato.
- Mostre Escritura e Registro como um valor cada. Só se o usuário pedir para detalhar, liste as partes (campo detalhes): Escritura = lavratura + arquivamento; Registro = ato de registro + prenotação + certidão de inteiro teor + averbações.
- Termine orçamentos lembrando que são estimativas a confirmar com o cartório e a prefeitura, em poucas palavras.
- Não fale de assuntos fora de orçamento de documentação imobiliária.`;
}

/** Conversas ficam guardadas por 30 dias (o agente só usa as últimas 6 horas como contexto). Ver /privacidade. */
export const RETENCAO_CONVERSAS_DIAS = 30;

async function registrar(telefone: string, userId: string | null, direcao: 'entrada' | 'saida', tipo: string, conteudo: string, messageId?: string) {
  const db = supabaseAdmin();
  await db.from('whatsapp_messages').insert({
    whatsapp_e164: telefone, user_id: userId, direcao, tipo, conteudo: conteudo.slice(0, 4000), evolution_message_id: messageId ?? null,
  });
  if (direcao === 'entrada') {
    const limite = new Date(Date.now() - RETENCAO_CONVERSAS_DIAS * 86400_000).toISOString();
    await db.from('whatsapp_messages').delete().eq('whatsapp_e164', telefone).lt('created_at', limite);
  }
}

async function historicoRecente(telefone: string): Promise<Content[]> {
  const { data } = await supabaseAdmin().from('whatsapp_messages')
    .select('direcao, conteudo').eq('whatsapp_e164', telefone)
    .gte('created_at', new Date(Date.now() - 6 * 3600_000).toISOString())
    .order('created_at', { ascending: false }).limit(10);
  // Junta mensagens seguidas do mesmo lado (a pessoa costuma mandar 2 ou 3 de uma vez).
  const turnos: Content[] = [];
  for (const m of (data ?? []).reverse()) {
    if (!m.conteudo) continue;
    const role = m.direcao === 'entrada' ? 'user' : 'model';
    const ultimo = turnos[turnos.length - 1];
    if (ultimo?.role === role) ultimo.parts!.push({ text: m.conteudo as string });
    else turnos.push({ role, parts: [{ text: m.conteudo as string }] });
  }
  // A conversa enviada ao modelo precisa começar pelo usuário.
  while (turnos.length && turnos[0].role !== 'user') turnos.shift();
  return turnos;
}

const RESPOSTA_CONFIRMACAO: Record<ResultadoConfirmacao['status'], (url: string) => string> = {
  confirmado: () => `Pronto, WhatsApp confirmado! ✅\n\nVolte ao site para terminar o cadastro. Depois é só me mandar os valores do negócio que eu faço o orçamento.`,
  codigo_errado: () => 'Esse código não confere. Confira o código na tela do cadastro e envie de novo.',
  expirado: (url) => `Esse código expirou. Gere um novo em ${url}/verificar e envie de novo.`,
  em_uso: () => 'Este WhatsApp já está ligado a outra conta. Fale com o suporte para trocar.',
};

/** Processa uma mensagem do WhatsApp e devolve o que o n8n deve enviar. */
export async function processarMensagem(msg: MensagemRecebida): Promise<{ status: string; respostas: Resposta[] }> {
  const db = supabaseAdmin();
  if (msg.messageId) {
    const { data } = await db.from('whatsapp_messages').select('id').eq('evolution_message_id', msg.messageId).maybeSingle();
    if (data) return { status: 'duplicada', respostas: [] };
  }

  // Confirmação do WhatsApp do cadastro: o corretor manda ao agente o código que aparece no site.
  const confirmacao = await confirmarPorMensagem(msg.telefone, msg.texto);
  if (confirmacao) {
    await registrar(msg.telefone, confirmacao.status === 'confirmado' ? confirmacao.userId : null, 'entrada', 'texto', msg.texto ?? '', msg.messageId);
    return { status: `verificacao_${confirmacao.status}`, respostas: [{ tipo: 'texto', texto: RESPOSTA_CONFIRMACAO[confirmacao.status](config.appUrl) }] };
  }

  const assinante = await identificar(msg.telefone);
  if (!assinante) {
    await registrar(msg.telefone, null, 'entrada', msg.audio ? 'audio' : msg.temAnexo ? 'midia' : 'texto', msg.texto ?? '', msg.messageId);
    return { status: 'sem_cadastro', respostas: [{ tipo: 'texto', texto:
      `Olá${msg.nome?.trim() ? `, ${msg.nome.trim().split(/\s+/)[0]}` : ''}! Eu sou o agente do *${config.marca}*: faço orçamento de escritura, ITBI e financiamento em segundos.\n\nEste número ainda não está cadastrado. Assine em ${config.appUrl}/cadastro e confirme este WhatsApp para começar.` }] };
  }
  if (!assinante.ativo) {
    await registrar(msg.telefone, assinante.userId, 'entrada', 'texto', msg.texto ?? '', msg.messageId);
    return { status: assinante.motivo, respostas: [{ tipo: 'texto', texto: MENSAGEM_BLOQUEIO[assinante.motivo](config.appUrl) }] };
  }

  // Starter usa só o site: o agente do WhatsApp é dos planos Pró e de equipe.
  if (!usaWhatsapp(assinante.papel)) {
    await registrar(msg.telefone, assinante.userId, 'entrada', 'texto', msg.texto ?? '', msg.messageId);
    return { status: 'sem_whatsapp', respostas: [{ tipo: 'texto', texto:
      `O atendimento pelo WhatsApp é do plano Pró. No Starter, os orçamentos são feitos em ${config.appUrl}/app. Para usar o agente, mude de plano em ${config.appUrl}/assinar?nivel=pro` }] };
  }

  let textoUsuario = msg.texto?.trim() ?? '';
  // Áudio: transcreve e segue como se o corretor tivesse escrito. Mostra o que entendeu antes da resposta.
  let ouvido: Resposta | null = null;
  if (msg.audio && !textoUsuario) {
    const longo = (msg.audio.segundos ?? 0) > AUDIO_MAX_SEGUNDOS;
    const transcricao = longo ? null : await transcreverAudio(msg.audio).catch((e) => { console.error('Falha ao transcrever o áudio', e); return null; });
    if (!transcricao) {
      await registrar(msg.telefone, assinante.userId, 'entrada', 'audio', '', msg.messageId);
      return responder(msg.telefone, assinante.userId, 'audio_nao_entendido', [{ tipo: 'texto', texto: longo
        ? `Esse áudio passou de ${AUDIO_MAX_SEGUNDOS / 60} minutos 😅 Mande um mais curto ou escreva o pedido.`
        : 'Não consegui entender o áudio 😕 Pode mandar de novo, falando perto do celular, ou escrever?' }]);
    }
    textoUsuario = transcricao;
    ouvido = { tipo: 'texto', texto: `🎙️ Entendi: _${transcricao}_` };
  }
  await registrar(msg.telefone, assinante.userId, 'entrada', msg.audio ? 'audio' : msg.temAnexo ? 'midia' : 'texto', textoUsuario, msg.messageId);
  // Com um atendente na conversa o robô não responde, então também não ecoa o áudio.
  const comOuvido = <T extends { respostas: Resposta[] }>(r: T): T => (ouvido && r.respostas.length ? { ...r, respostas: [ouvido, ...r.respostas] } : r);

  // "indicar" ou "cupom": manda o cupom de indicação do assinante, pronto para encaminhar.
  if (/^(indicar|indicacao|indicação|cupom|meu cupom)$/i.test(textoUsuario)) {
    const codigo = await codigoDoUsuario(assinante.userId);
    return comOuvido(await responder(msg.telefone, assinante.userId, 'ok', [
      { tipo: 'texto', texto: `Seu cupom de indicação: *${codigo}*\nQuem se cadastrar com ele ganha ${DIAS_TESTE_INDICACAO} dias grátis (em vez de ${DIAS_TESTE}). Encaminhe a mensagem abaixo 👇` },
      { tipo: 'texto', texto: `Uso o *${config.marca}* para fazer orçamento de escritura, ITBI e financiamento em segundos, direto no WhatsApp. Cadastre-se com o meu cupom *${codigo}* e ganhe ${DIAS_TESTE_INDICACAO} dias grátis:\n${linkDeIndicacao(codigo)}` },
    ]));
  }

  // Conversa por menus numerados (./menu.ts). Texto livre no menu inicial vai para o agente com IA.
  const ctxMenu: ContextoMenu = { nome: assinante.nome, formatoPadrao: assinante.configuracao.estilo.formato, temAnexo: msg.temAnexo, custosPadrao: assinante.configuracao.custos, municipio: assinante.configuracao.localidade.municipio };
  const p = passo(await lerSessao(msg.telefone), textoUsuario, ctxMenu);
  if (p.acao?.tipo === 'livre') {
    await salvarSessao(msg.telefone, assinante.userId, p.estado);
    if (config.geminiKey) return comOuvido(await responderComIa(msg.telefone, assinante, textoUsuario, Boolean(ouvido)));
    return comOuvido(await responder(msg.telefone, assinante.userId, 'ok', [{ tipo: 'texto', texto: telaAtual(p.estado, ctxMenu, 'Para orçar, escolha uma opção 👇\n\n').texto }]));
  }

  const respostas: Resposta[] = [];
  let estado = p.estado;
  let mensagens = p.mensagens;
  try {
    const estilo = assinante.configuracao.estilo;
    if (p.acao?.tipo === 'calcular') {
      const dados = p.acao.calculo === 'correcao' ? p.acao.dados
        : comCustos(p.acao.calculo, comLocalidade(p.acao.dados, assinante.configuracao.localidade), assinante.configuracao.custos);
      const resultado = calcular(p.acao.calculo, dados);
      const salvo = await salvarCalculo({ userId: assinante.userId, resultado, entrada: dados, origem: 'whatsapp', descricao: p.acao.endereco });
      respostas.push(...await entregar(salvo, p.acao.formato, estilo));
      estado = { ...estado, ultimo: salvo.seq };
    } else if (p.acao?.tipo === 'atendente') {
      const nota = `🙋 ${assinante.nome ?? 'O corretor'} pediu para falar com uma pessoa. O robô fica pausado nesta conversa até ele escrever "menu".${estado.ultimo ? ` Último orçamento: ${numeroCalculo(estado.ultimo)}.` : ''}`;
      await pedirAtendente(msg.telefone, nota).catch((e) => console.error('Chatwoot: não deu para abrir a conversa', e));
    } else if (p.acao?.tipo === 'reenviar' || p.acao?.tipo === 'detalhar') {
      const salvo = await buscarPorSeq(assinante.userId, p.acao.seq);
      if (!salvo) throw new Error('Não encontrei esse orçamento. Vamos fazer um novo?');
      respostas.push(...await entregar(salvo, p.acao.tipo === 'reenviar' ? p.acao.formato : 'texto', estilo, p.acao.tipo === 'detalhar'));
    }
  } catch (e) {
    console.error('Falha no orçamento pelo menu', e);
    const motivo = e instanceof ZodError || !(e instanceof Error) ? 'Confira os valores e tente de novo.' : e.message;
    respostas.push({ tipo: 'texto', texto: `Não consegui fazer esse orçamento 😕 ${motivo}` });
    estado = { tela: 'menu', id: 'inicio', ultimo: estado.ultimo };
    mensagens = [telaAtual(estado, ctxMenu)];
  }
  respostas.push(...mensagens.map((m): Resposta => ({ tipo: 'texto', texto: m.texto, corpo: m.corpo, opcoes: m.opcoes })));
  await salvarSessao(msg.telefone, assinante.userId, estado);
  return comOuvido(await responder(msg.telefone, assinante.userId, 'ok', respostas));
}

/** Registra as mensagens de saída (texto) e devolve a resposta para o n8n. */
async function responder(telefone: string, userId: string, status: string, respostas: Resposta[]) {
  const texto = respostas.map((r) => (r.tipo === 'texto' ? r.texto : r.tipo === 'audio' ? `🎙️ ${r.texto}` : `[${r.nomeArquivo}]`)).join('\n\n');
  if (texto) await registrar(telefone, userId, 'saida', 'texto', texto); // com atendente, o robô não responde
  return { status, respostas };
}

/** O orçamento no formato pedido: imagem ou PDF (arquivo) ou mensagem escrita. */
async function entregar(salvo: CalculoSalvo, formato: FormatoEntrega, estilo: Configuracao['estilo'], comDetalhes = false): Promise<Resposta[]> {
  const meta = { numero: numeroCalculo(salvo.seq), data: new Date(salvo.created_at), endereco: salvo.descricao ?? undefined };
  if (formato === 'texto') return [{ tipo: 'texto', texto: orcamentoEmTexto(salvo.resultado, meta, estilo, comDetalhes) }];
  const arquivo = await arquivoDoOrcamento(salvo, estilo, formato);
  return [{ tipo: 'documento', ...arquivo, legenda: `Orçamento ${meta.numero} · Total ${brl(salvo.resultado.total)}` }];
}

// ---------------- Sessão do menu ----------------

/** Depois de 30 minutos parada, a conversa recomeça do menu inicial. Com uma pessoa atendendo, o robô fica quieto por até 8 horas. */
const SESSAO_MINUTOS = 30;
const ATENDENTE_HORAS = 8;

async function lerSessao(telefone: string): Promise<Estado | null> {
  const db = supabaseAdmin();
  const { data } = await db.from('whatsapp_sessoes').select('estado, updated_at').eq('whatsapp_e164', telefone).maybeSingle();
  if (!data) return null;
  const limite = (data.estado as Estado)?.tela === 'atendente' ? ATENDENTE_HORAS * 60 : SESSAO_MINUTOS;
  if (Date.now() - new Date(data.updated_at).getTime() > limite * 60_000) {
    await db.from('whatsapp_sessoes').delete().eq('whatsapp_e164', telefone); // não guarda valores de conversa parada
    return null;
  }
  return data.estado as Estado;
}

async function salvarSessao(telefone: string, userId: string, estado: Estado) {
  await supabaseAdmin().from('whatsapp_sessoes').upsert({ whatsapp_e164: telefone, user_id: userId, estado, updated_at: new Date().toISOString() });
}

// ---------------- Texto livre com IA ----------------

/** Pedido escrito por extenso ("escritura de 350 mil em JF"): o modelo chama as mesmas calculadoras. */
/** `porVoz`: o corretor mandou áudio, então a resposta curta também vai falada (menus, valores e arquivos seguem escritos). */
async function responderComIa(telefone: string, assinante: Assinante, textoUsuario: string, porVoz = false) {
  const anexos: Resposta[] = [];
  const ctx: Contexto = { userId: assinante.userId, telefone, configuracao: assinante.configuracao, anexos };
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });
  // O histórico já inclui a mensagem que acabamos de registrar.
  const contents: Content[] = await historicoRecente(telefone);
  if (!contents.length || contents[contents.length - 1].role !== 'user') contents.push({ role: 'user', parts: [{ text: textoUsuario }] });

  let resposta = '';
  for (let i = 0; i < 5; i++) {
    const r = await ai.models.generateContent({
      model: config.geminiModel,
      contents,
      config: { systemInstruction: instrucoes(assinante), tools: [{ functionDeclarations: DECLARACOES }], temperature: 0.2 },
    });
    const chamadas = r.functionCalls ?? [];
    if (!chamadas.length) { resposta = r.text ?? ''; break; }
    // Devolve o turno do modelo como veio (preserva as assinaturas de raciocínio do Gemini 3).
    const turno = r.candidates?.[0]?.content;
    if (turno) contents.push(turno);
    const partes = [];
    for (const c of chamadas) {
      const saida = await executar(c.name ?? '', (c.args ?? {}) as Record<string, unknown>, ctx);
      partes.push({ functionResponse: { id: c.id, name: c.name, response: saida } });
    }
    contents.push({ role: 'user', parts: partes });
  }

  if (!resposta) resposta = 'Não consegui entender esse pedido.';
  const voz = porVoz ? await falar(resposta).catch((e) => { console.error('Falha ao gerar a resposta falada', e); return null; }) : null;
  if (voz) {
    return responder(telefone, assinante.userId, 'ok', [{ tipo: 'audio', base64: voz, texto: resposta }, ...anexos, { tipo: 'texto', texto: 'Digite *menu* para ver as opções.' }]);
  }
  resposta += '\n\nDigite *menu* para ver as opções.';
  return responder(telefone, assinante.userId, 'ok', [{ tipo: 'texto', texto: resposta }, ...anexos]);
}
