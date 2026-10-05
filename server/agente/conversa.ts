import { GoogleGenAI, type Content } from '@google/genai';
import { brl, calcular, MUNICIPIOS } from '../../src/lib/calc';
import { config } from '../config';
import { supabaseAdmin } from '../supabase';
import { variantesTelefone } from '../telefone';
import { lerEspelhoIptu } from '../iptu';
import { salvarCalculo, numeroCalculo } from '../historico';
import { DECLARACOES, executar, type Contexto, type Resposta } from './ferramentas';

export interface MensagemRecebida {
  telefone: string;              // E.164
  texto?: string;
  messageId?: string;
  nome?: string;                 // pushName do WhatsApp
  midia?: { base64: string; mimetype: string };
}

export interface Assinante {
  userId: string;
  nome: string | null;
  municipio: string;
  cabecalhoPdf: string | null;
  ativo: boolean;
}

export async function identificar(telefone: string): Promise<Assinante | null> {
  const db = supabaseAdmin();
  const { data: perfil } = await db.from('profiles')
    .select('id, full_name, municipio_padrao, pdf_header')
    .in('whatsapp_e164', variantesTelefone(telefone))
    .not('whatsapp_verified_at', 'is', null)
    .limit(1).maybeSingle();
  if (!perfil) return null;
  const { data: assinatura } = await db.from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', perfil.id).eq('status', 'ativa')
    .order('current_period_end', { ascending: false }).limit(1).maybeSingle();
  const ativo = !!assinatura && (!assinatura.current_period_end || new Date(assinatura.current_period_end) > new Date());
  return { userId: perfil.id, nome: perfil.full_name, municipio: perfil.municipio_padrao, cabecalhoPdf: perfil.pdf_header, ativo };
}

function instrucoes(a: Assinante) {
  const cidade = MUNICIPIOS[a.municipio]?.nome ?? a.municipio;
  const atendidos = Object.values(MUNICIPIOS).map((m) => `${m.nome} (${m.uf})`).join(', ');
  return `Você é o agente do ${config.marca} no WhatsApp. Ajuda corretores, despachantes e assessorias a orçar custos de documentação de imóveis.
Hoje é ${new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Assinante: ${a.nome ?? 'sem nome'}. Município padrão: ${cidade}.
Municípios atendidos: ${atendidos}. Os emolumentos de cartório seguem a tabela de MG.

Regras:
- Nunca calcule valores por conta própria. Todo número vem de uma ferramenta.
- Se faltar um dado obrigatório (ex.: valor venal, valor financiado, modalidade), pergunte só o que falta, em uma frase.
- "Base" é sempre o maior entre o valor declarado e o venal; a ferramenta faz isso. Se o usuário der só um valor, use-o nos dois campos e avise.
- Valores como "350 mil" ou "1,2 mi" viram números (350000, 1200000).
- Se o imóvel for em cidade não atendida, diga que ainda não atende essa cidade e chame pedir_cidade.
- Resposta curta, em português, no estilo do WhatsApp: total em *negrito* primeiro, depois os itens principais, e o número do cálculo (#0000). O PDF já vai anexado: não cole links.
- Termine orçamentos lembrando que são estimativas a confirmar com o cartório e a prefeitura, em poucas palavras.
- Não fale de assuntos fora de orçamento de documentação imobiliária.`;
}

async function registrar(telefone: string, userId: string | null, direcao: 'entrada' | 'saida', tipo: string, conteudo: string, messageId?: string) {
  await supabaseAdmin().from('whatsapp_messages').insert({
    whatsapp_e164: telefone, user_id: userId, direcao, tipo, conteudo: conteudo.slice(0, 4000), evolution_message_id: messageId ?? null,
  });
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

/** Processa uma mensagem do WhatsApp e devolve o que o n8n deve enviar. */
export async function processarMensagem(msg: MensagemRecebida): Promise<{ status: string; respostas: Resposta[] }> {
  const db = supabaseAdmin();
  if (msg.messageId) {
    const { data } = await db.from('whatsapp_messages').select('id').eq('evolution_message_id', msg.messageId).maybeSingle();
    if (data) return { status: 'duplicada', respostas: [] };
  }

  const assinante = await identificar(msg.telefone);
  if (!assinante) {
    await registrar(msg.telefone, null, 'entrada', msg.midia ? 'midia' : 'texto', msg.texto ?? '', msg.messageId);
    return { status: 'sem_cadastro', respostas: [{ tipo: 'texto', texto:
      `Olá! Eu sou o agente do *${config.marca}*: faço orçamento de escritura, ITBI e financiamento em segundos.\n\nEste número ainda não está cadastrado. Assine em ${config.appUrl}/cadastro e confirme este WhatsApp para começar.` }] };
  }
  if (!assinante.ativo) {
    await registrar(msg.telefone, assinante.userId, 'entrada', 'texto', msg.texto ?? '', msg.messageId);
    return { status: 'inativo', respostas: [{ tipo: 'texto', texto:
      `Sua assinatura do ${config.marca} não está ativa. Renove em ${config.appUrl}/assinar e eu volto a calcular na hora.` }] };
  }

  let textoUsuario = msg.texto?.trim() ?? '';
  const anexos: Resposta[] = [];

  // Foto ou PDF: tenta ler como espelho do IPTU antes de chamar o modelo.
  if (msg.midia) {
    try {
      const d = await lerEspelhoIptu(msg.midia.base64, msg.midia.mimetype);
      if (d.terreno?.valorVenal && d.terreno?.valorM2) {
        const resultado = calcular('valor_venal', {
          areaIsotima: d.terreno.areaIsotima, tipo: d.edificacao?.tipo, padrao: d.edificacao?.padrao,
          terrenoValorVenal: d.terreno.valorVenal, terrenoValorM2: d.terreno.valorM2,
          edificacaoValorVenal: d.edificacao?.valorVenal ?? 0, edificacaoValorM2: d.edificacao?.valorM2 ?? 0,
          municipio: assinante.municipio,
        });
        const salvo = await salvarCalculo({ userId: assinante.userId, resultado, entrada: d, origem: 'whatsapp', descricao: d.endereco ?? undefined });
        textoUsuario += `\n[Enviei o espelho do IPTU. Dados lidos: inscrição ${d.inscricao ?? '?'}, ${d.endereco ?? 'endereço não lido'}, ` +
          `${d.edificacao?.tipo ?? 'tipo ?'} padrão ${d.edificacao?.padrao ?? '?'}, área isótima ${d.terreno.areaIsotima ?? '?'}. ` +
          `Valor venal corrigido calculado: ${brl(resultado.total)} (cálculo ${numeroCalculo(salvo.seq)}).]`;
      } else {
        textoUsuario += '\n[Enviei um arquivo, mas ele não parece um espelho de IPTU legível.]';
      }
    } catch (e) {
      textoUsuario += `\n[Enviei um arquivo que não consegui ler: ${e instanceof Error ? e.message : e}]`;
    }
  }

  await registrar(msg.telefone, assinante.userId, 'entrada', msg.midia ? 'midia' : 'texto', textoUsuario, msg.messageId);
  if (!config.geminiKey) return { status: 'erro', respostas: [{ tipo: 'texto', texto: 'O agente está em manutenção. Use o site enquanto isso.' }] };

  const ctx: Contexto = { userId: assinante.userId, telefone: msg.telefone, municipio: assinante.municipio, cabecalhoPdf: assinante.cabecalhoPdf, anexos };
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });
  // O histórico já inclui a mensagem que acabamos de registrar.
  const contents: Content[] = await historicoRecente(msg.telefone);
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

  if (!resposta) resposta = 'Não consegui concluir esse cálculo. Pode me mandar os valores de novo, um por linha?';
  await registrar(msg.telefone, assinante.userId, 'saida', 'texto', resposta);
  return { status: 'ok', respostas: [{ tipo: 'texto', texto: resposta }, ...anexos] };
}
