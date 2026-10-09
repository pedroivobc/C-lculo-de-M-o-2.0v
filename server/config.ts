import dotenv from 'dotenv';

dotenv.config();

const env = (nome: string, padrao = '') => process.env[nome] ?? padrao;

export const config = {
  port: Number(env('PORT', '3000')),
  appUrl: env('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  /** Nome da vertical (marca Orçaí + segmento). Cada vertical roda com o seu MARCA_NOME. */
  marca: env('MARCA_NOME', 'Orçaí Imob'),
  supabaseUrl: env('SUPABASE_URL', env('VITE_SUPABASE_URL')),
  supabaseServiceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  geminiKey: env('GEMINI_API_KEY'),
  geminiModel: env('GEMINI_MODEL', 'gemini-3-flash-preview'),
  /** Chave que o n8n manda no header x-agent-key. */
  agentKey: env('AGENT_API_KEY'),
  /** Segredo para o hash dos códigos de verificação do WhatsApp. */
  codigoSegredo: env('VERIFICACAO_SEGREDO', env('AGENT_API_KEY')),
  evolution: {
    url: env('EVOLUTION_API_URL').replace(/\/$/, ''),
    key: env('EVOLUTION_API_KEY'),
    instancia: env('EVOLUTION_INSTANCE', 'agente'),
  },
};

export function exigirConfig(...chaves: (keyof typeof config)[]) {
  const faltando = chaves.filter((c) => !config[c]);
  if (faltando.length) throw new Error(`Configuração ausente no .env: ${faltando.join(', ')}`);
}
