import { GoogleGenAI } from '@google/genai';
import { config } from '../config';
import { baixarMidia } from '../evolution';

/** Áudio recebido pelo WhatsApp: o base64 quando a Evolution já manda no webhook, senão o { key, message } para baixar. */
export interface AudioRecebido {
  base64?: string | null;
  mimetype?: string | null;
  segundos?: number | null;
  mensagem?: unknown;
}

/** Áudios mais longos que isso não são transcritos: pedido de orçamento cabe em bem menos. */
export const AUDIO_MAX_SEGUNDOS = 180;

const INSTRUCAO = `Transcreva este áudio de WhatsApp, em português do Brasil, exatamente como foi falado.
Escreva números com algarismos: valores como "350 mil" ou "1,2 milhão", anos como "2025", opções como "1".
Responda só com a transcrição, sem comentários. Se não houver fala compreensível, responda apenas: ???`;

/** Transcreve o áudio com o Gemini. Devolve null quando não há chave, não deu para baixar ou não há fala. O áudio não é guardado. */
export async function transcreverAudio(audio: AudioRecebido): Promise<string | null> {
  if (!config.geminiKey) return null;
  let base64 = audio.base64 ?? undefined;
  let mimetype = audio.mimetype ?? undefined;
  if (!base64 && audio.mensagem) {
    const midia = await baixarMidia(audio.mensagem);
    base64 = midia.base64;
    mimetype = mimetype ?? midia.mimetype;
  }
  if (!base64) return null;

  const ai = new GoogleGenAI({ apiKey: config.geminiKey });
  const r = await ai.models.generateContent({
    model: config.geminiModel,
    contents: [{ role: 'user', parts: [
      { inlineData: { mimeType: (mimetype ?? 'audio/ogg').split(';')[0].trim(), data: base64 } },
      { text: INSTRUCAO },
    ] }],
    config: { temperature: 0 },
  });
  const texto = (r.text ?? '').trim();
  return texto && texto !== '???' ? texto : null;
}
