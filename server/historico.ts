import type { Resultado } from '../src/lib/calc';
import { supabaseAdmin, salvarArquivo, urlAssinada } from './supabase';
import { gerarPdfOrcamento } from './pdf';
import { gerarJpegOrcamento } from './imagem';
import type { Estilo, Formato } from './estilo';

export interface CalculoSalvo {
  id: string;
  seq: number;
  user_id: string;
  tipo: string;
  subtipo: string | null;
  municipio: string | null;
  origem: 'site' | 'whatsapp';
  descricao: string | null;
  entrada: unknown;
  resultado: Resultado;
  total: number;
  pdf_path: string | null;
  created_at: string;
}

export const numeroCalculo = (seq: number) => `#${String(seq).padStart(4, '0')}`;

export async function salvarCalculo(params: {
  userId: string; resultado: Resultado; entrada: unknown; origem: 'site' | 'whatsapp'; descricao?: string;
}): Promise<CalculoSalvo> {
  const { userId, resultado, entrada, origem, descricao } = params;
  const { data, error } = await supabaseAdmin().from('calculations').insert({
    user_id: userId,
    tipo: resultado.tipo,
    subtipo: resultado.subtipo,
    municipio: resultado.municipio === 'n/a' ? null : resultado.municipio,
    origem,
    descricao: descricao ?? null,
    entrada,
    resultado,
    total: resultado.total,
  }).select('*').single();
  if (error) throw new Error(`Falha ao salvar o cálculo: ${error.message}`);
  return data as CalculoSalvo;
}

export async function buscarPorSeq(userId: string, seq: number): Promise<CalculoSalvo | null> {
  const { data } = await supabaseAdmin().from('calculations').select('*').eq('user_id', userId).eq('seq', seq).maybeSingle();
  return (data as CalculoSalvo) ?? null;
}

export async function listarCalculos(userId: string, filtro: { de?: string; ate?: string; tipo?: string; origem?: string; limite?: number } = {}) {
  let q = supabaseAdmin().from('calculations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (filtro.de) q = q.gte('created_at', filtro.de);
  if (filtro.ate) q = q.lt('created_at', filtro.ate);
  if (filtro.tipo) q = q.eq('tipo', filtro.tipo);
  if (filtro.origem) q = q.eq('origem', filtro.origem);
  q = q.limit(filtro.limite ?? 500);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as CalculoSalvo[];
}

/**
 * Gera o orçamento no formato pedido (PDF ou JPEG), guarda no Storage e devolve um link temporário.
 * Gera de novo a cada pedido: assim o arquivo sempre sai com a logo, a cor e o plano atuais.
 */
export async function arquivoDoOrcamento(calculo: CalculoSalvo, estilo: Estilo, formato: Formato = estilo.formato) {
  const base = `orcamento-${String(calculo.seq).padStart(4, '0')}`;
  const meta = { numero: numeroCalculo(calculo.seq), data: new Date(calculo.created_at) };
  const [conteudo, nomeArquivo, mimetype] = formato === 'jpeg'
    ? [await gerarJpegOrcamento(calculo.resultado, meta, estilo), `${base}.jpg`, 'image/jpeg']
    : [await gerarPdfOrcamento(calculo.resultado, meta, estilo), `${base}.pdf`, 'application/pdf'];
  const caminho = await salvarArquivo(`${calculo.user_id}/${nomeArquivo}`, conteudo, mimetype);
  if (formato === 'pdf' && calculo.pdf_path !== caminho) {
    await supabaseAdmin().from('calculations').update({ pdf_path: caminho }).eq('id', calculo.id);
  }
  return { url: await urlAssinada(caminho, 600, nomeArquivo), nomeArquivo, mimetype };
}

/** Intervalo [de, ate) de um mês 'AAAA-MM'. */
export function intervaloDoMes(mes: string) {
  const [a, m] = mes.split('-').map(Number);
  if (!a || !m || m < 1 || m > 12) throw new Error('Mês inválido. Use AAAA-MM.');
  return { de: new Date(Date.UTC(a, m - 1, 1)).toISOString(), ate: new Date(Date.UTC(a, m, 1)).toISOString() };
}
