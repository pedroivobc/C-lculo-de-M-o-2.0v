import { supabase } from "@/lib/supabase";

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

/**
 * Lê o espelho do IPTU pelo servidor (POST /api/iptu/extrair).
 * A chave do Gemini fica só no servidor; antes ela ia embutida no bundle do navegador.
 */
export async function extractDataFromPDF(base64Data: string, mimeType = "application/pdf"): Promise<ExtractedData> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const resp = await fetch("/api/iptu/extrair", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ base64: base64Data, mimeType }),
  });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(corpo.erro ?? `Falha ao ler o espelho (${resp.status})`);
  return corpo as ExtractedData;
}
