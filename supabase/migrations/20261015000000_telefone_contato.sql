-- Telefone de contato do assinante, impresso no orçamento (plano Pró/teste).
-- Independe do WhatsApp confirmado pelo agente, que é opcional. Só dígitos, com DDD (DDI 55 opcional).
alter table public.profiles
  add column if not exists telefone text check (telefone is null or telefone ~ '^[0-9]{10,13}$');

-- O cadastro manda o telefone nos metadados do usuário; o perfil já nasce com ele.
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tel text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g'), '');
begin
  insert into public.profiles (id, full_name, email, telefone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email,
          case when tel ~ '^[0-9]{10,13}$' then tel end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
