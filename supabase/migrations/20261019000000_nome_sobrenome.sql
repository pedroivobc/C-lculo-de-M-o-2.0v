-- Nome e sobrenome separados: o agente e o site chamam o corretor pelo nome ("Olá, Pedro!").
-- full_name continua sendo "nome sobrenome" (orçamento, Stripe, painel do administrador).
alter table public.profiles
  add column if not exists nome text,
  add column if not exists sobrenome text;

-- Contas antigas: a primeira palavra vira o nome; o resto, o sobrenome.
update public.profiles
set nome = split_part(btrim(full_name), ' ', 1),
    sobrenome = nullif(btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1)), '')
where nome is null and nullif(btrim(full_name), '') is not null;

-- O cadastro manda nome e sobrenome nos metadados; o perfil já nasce com eles.
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tel text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g'), '');
  completo text := nullif(btrim(new.raw_user_meta_data->>'full_name'), '');
  v_nome text := coalesce(nullif(btrim(new.raw_user_meta_data->>'nome'), ''), split_part(completo, ' ', 1));
  v_sobrenome text := coalesce(nullif(btrim(new.raw_user_meta_data->>'sobrenome'), ''),
    nullif(btrim(substr(completo, length(split_part(completo, ' ', 1)) + 1)), ''));
begin
  insert into public.profiles (id, full_name, nome, sobrenome, email, telefone)
  values (new.id, completo, nullif(v_nome, ''), v_sobrenome, new.email,
          case when tel ~ '^[0-9]{10,13}$' then tel end)
  on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
