import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigurado) {
  console.warn('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.');
}

// Link de convite ou de nova senha que caiu em outra página (o Supabase manda para o Site URL quando o endereço
// pedido não está liberado): leva para /entrar antes de o cliente ler o endereço, para a pessoa criar a senha lá.
if (typeof window !== 'undefined' && window.location.pathname !== '/entrar' && /(^|[#&])(type=(invite|recovery)|error_code=)/.test(window.location.hash)) {
  window.history.replaceState(null, '', `/entrar${window.location.hash}`);
}

// Sem credenciais, usa um endereço inválido em vez de quebrar o app na importação:
// a landing e as calculadoras continuam funcionando; login e histórico mostram erro.
export const supabase = createClient(supabaseUrl || 'http://supabase.invalid', supabaseAnonKey || 'sem-chave');
