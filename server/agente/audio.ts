import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

/** Áudio de WhatsApp (nota de voz) costuma ter poucas centenas de KB; acima disso, pede para escrever. */
export const LIMITE_AUDIO_BYTES = 3 * 1024 * 1024;

export const ehAudio = (mimetype?: string) => !!mimetype && mimetype.toLowerCase().startsWith('audio/');

/**
 * Transcreve a nota de voz (base64) com o Gemini e devolve só o texto falado.
 * O áudio fica só na memória durante a chamada: não é salvo nem registrado; o histórico guarda a transcrição.
 */
export async function transcreverAudio(base64: string, mimetype: string): Promise<string> {
  if (!config.geminiKey) throw new Error('GEMINI_API_KEY não configurada');
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });
  const r = await ai.models.generateContent({
    model: config.geminiModel,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimetype.split(';')[0].trim(), data: base64 } },
        { text: 'Transcreva em português do Brasil exatamente o que a pessoa disse neste áudio. '
          + 'Escreva valores em reais com números (ex.: "350 mil" vira "350000") e porcentagens com "%". '
          + 'Responda só com a transcrição, sem comentários. Se não houver fala, responda vazio.' },
      ],
    }],
    config: { temperature: 0 },
  });
  return (r.text ?? '').trim();
}
