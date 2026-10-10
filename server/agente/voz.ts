import { GoogleGenAI } from '@google/genai';
import { config } from '../config';

/** Respostas mais longas que isso (orçamento por extenso, listas) continuam só escritas. */
export const VOZ_MAX_CARACTERES = 600;

/** O Gemini devolve PCM 16 bits, mono, 24 kHz; a Evolution converte o WAV em mensagem de voz do WhatsApp. */
function wav(pcm: Buffer, taxa = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(taxa, 24); h.writeUInt32LE(taxa * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Texto do WhatsApp sem a formatação (*negrito*, _itálico_, ~riscado~) e sem emojis, para ser lido em voz alta. */
export const textoParaFala = (texto: string) =>
  texto.replace(/[*_~`]/g, '').replace(/\p{Extended_Pictographic}️?/gu, '').replace(/[ \t]+/g, ' ').trim();

/** Gera a resposta falada (WAV em base64). Devolve null sem chave, com texto longo ou se o Gemini não devolver áudio. */
export async function falar(texto: string): Promise<string | null> {
  const fala = textoParaFala(texto);
  if (!config.geminiKey || !config.geminiTtsModel || !fala || fala.length > VOZ_MAX_CARACTERES) return null;
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });
  const r = await ai.models.generateContent({
    model: config.geminiTtsModel,
    contents: [{ role: 'user', parts: [{ text: `Fale em português do Brasil, de forma simpática e natural: ${fala}` }] }],
    config: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.geminiVoz } } } },
  });
  const pcm = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  return pcm ? wav(Buffer.from(pcm, 'base64')).toString('base64') : null;
}
