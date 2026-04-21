import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ExtractedData {
  inscricao: string | null;
  endereco: string | null;
  terreno: {
    valorM2: number | null;
    valorVenal: number | null;
    areaIsotima: string | null;
  };
  edificacao: {
    tipo: "APTO" | "CASA" | "SALA" | "LOJA" | "TELHEIRO" | "GALPAO" | null;
    padrao: "OTIMO" | "BOM" | "REGULAR" | "BAIXO" | "POPULAR" | null;
    valorM2: number | null;
    valorVenal: number | null;
  };
}

export async function extractDataFromPDF(base64Data: string): Promise<ExtractedData> {
  const prompt = `Você é um especialista em leitura de documentos fiscais imobiliários brasileiros.
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
Retorne APENAS o JSON. Nada antes ou depois.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as ExtractedData;
  } catch (error) {
    console.error("Error extracting data:", error);
    throw error;
  }
}
