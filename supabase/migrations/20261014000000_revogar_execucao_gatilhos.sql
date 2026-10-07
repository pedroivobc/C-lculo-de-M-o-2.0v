-- Funções de gatilho não são chamadas pela API (/rest/v1/rpc): só os triggers as executam.
-- Apontado pelo verificador de segurança do Supabase.
revoke execute on function public.ao_mudar_assinatura() from public, anon, authenticated;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.iniciar_trial() from public, anon, authenticated;
revoke execute on function public.iniciar_trial_pelo_cpf() from public, anon, authenticated;
revoke execute on function public.liberar_recompensa_indicacao() from public, anon, authenticated;
