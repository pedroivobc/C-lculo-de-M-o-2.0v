import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config, exigirConfig } from './config';

let cliente: SupabaseClient | null = null;

/** Cliente com a service role: ignora RLS. Só usar no servidor. */
export function supabaseAdmin(): SupabaseClient {
  if (!cliente) {
    exigirConfig('supabaseUrl', 'supabaseServiceKey');
    cliente = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}

export const BUCKET = 'orcamentos';

export async function salvarArquivo(caminho: string, conteudo: Buffer, contentType: string) {
  const { error } = await supabaseAdmin().storage.from(BUCKET).upload(caminho, conteudo, { contentType, upsert: true });
  if (error) throw new Error(`Falha ao salvar arquivo: ${error.message}`);
  return caminho;
}

export async function urlAssinada(caminho: string, segundos = 600, nomeDownload?: string) {
  const { data, error } = await supabaseAdmin().storage.from(BUCKET)
    .createSignedUrl(caminho, segundos, nomeDownload ? { download: nomeDownload } : undefined);
  if (error || !data) throw new Error(`Falha ao gerar link: ${error?.message}`);
  return data.signedUrl;
}
