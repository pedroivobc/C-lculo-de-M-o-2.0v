import { GoogleGenAI } from '@google/genai';
import { config, exigirConfig } from './config';

export interface DadosIptu {
  inscricao: string | null;
  endereco: string | null;
  terreno: { valorM2: number | null; valorVenal: number | null; areaIsotima: string | null };
  edificacao: {
    tipo: 'APTO' | 'CASA' | 'SALA' | 'LOJA' | 'TELHEIRO' | 'GALPAO' | null;
    padrao: 'OTIMO' | 'BOM' | 'REGULAR' | 'BAIXO' | 'POPULAR' | null;
    valorM2: number | null;
    valorVenal: number | null;
  };
}

// Mesmo prompt de src/services/geminiService.ts, agora no servidor (a chave não vai mais para o navegador).
const PROMPT = `Você é um especialista em leitura de documentos fiscais imobiliários brasileiros.
Analise este Espelho de IPTU da Prefeitura de Juiz de Fora (MG) e extraia os campos abaixo.
Retorne SOMENTE um JSON válido, sem texto adicional, sem markdown, sem explicações.

{
  "inscricao": "número de inscrição cadastral completo",
  "endereco": "logradouro completo com número e bairro",
  "terreno": {
    "valorM2": número puro sem R$ ou pontos de milhar,
    "valorVenal": número puro sem R$ ou pontos de milhar,
    "areaIsotima": "código sem espaços ex: RE227"
  },
  "edificacao": {
    "tipo": "um de: APTO, CASA, SALA, LOJA, TELHEIRO, GALPAO",
    "padrao": "um de: OTIMO, BOM, REGULAR, BAIXO, POPULAR",
    "valorM2": número puro sem R$ ou pontos de milhar,
    "valorVenal": número puro sem R$ ou pontos de milhar
  }
}

Regras de normalização:
- tipo: Apartamento→APTO, Casa→CASA, Sala→SALA, Loja→LOJA, Galpão→GALPAO
- padrao: Ótimo→OTIMO, Bom→BOM, Regular→REGULAR, Baixo→BAIXO, Popular→POPULAR
- Números: remova R$, pontos de milhar, converta vírgula decimal em ponto
- areaIsotima: remova espaços (RE 227 → RE227)
- Se não encontrar um campo, retorne null
- Se o arquivo não for um espelho de IPTU, retorne todos os campos null
Retorne APENAS o JSON. Nada antes ou depois.`;

export const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function lerEspelhoIptu(base64: string, mimeType: string): Promise<DadosIptu> {
  exigirConfig('geminiKey');
  if (!TIPOS_ACEITOS.includes(mimeType)) throw new Error(`Formato não suportado: ${mimeType}. Envie PDF ou foto.`);
  const ai = new GoogleGenAI({ apiKey: config.geminiKey });
  const resp = await ai.models.generateContent({
    model: config.geminiModel,
    contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: base64 } }] }],
    config: { responseMimeType: 'application/json' },
  });
  if (!resp.text) throw new Error('A leitura do espelho não retornou dados');
  return JSON.parse(resp.text) as DadosIptu;
}
