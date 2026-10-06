-- Perfis de acesso (admin, pro, usuario, trial) e cartão obrigatório.
-- Rodar DEPOIS de 20261005000000_schema_inicial.sql (SQL Editor do Supabase ou `supabase db push`).
--
-- Regras:
--   admin   → controle total; não precisa de cartão nem assinatura.
--   pro     → assinante; o orçamento sai com a logo e a paleta dele.
--   usuario → assinante; o orçamento sai com a marca Orçaí, sem paleta própria.
--   trial   → teste de 3 dias, que começa quando o cartão é validado.
-- Todos menos o admin precisam de um cartão validado no gateway para usar o sistema,
-- mesmo que paguem no Pix. O banco NUNCA guarda número nem CVV: só o token do gateway.

-- ============ Papel do usuário ============
do $$ begin
  create type public.papel_usuario as enum ('admin', 'pro', 'usuario', 'trial');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists papel public.papel_usuario not null default 'trial',
  add column if not exists trial_expira_em timestamptz,          -- preenchido quando o 1º cartão é validado
  add column if not exists cor_primaria text,                    -- só para pro
  add column if not exists cor_secundaria text;                  -- só para pro
-- pdf_logo_path e pdf_header já existem desde a migração inicial.

do $$ begin
  alter table public.profiles add constraint profiles_cor_primaria_hex check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$');
  alter table public.profiles add constraint profiles_cor_secundaria_hex check (cor_secundaria ~ '^#[0-9A-Fa-f]{6}$');
exception when duplicate_object then null; end $$;

create index if not exists profiles_papel on public.profiles (papel);

/** É admin? (security definer para não cair em recursão de RLS ao ler profiles) */
create or replace function public.eh_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and papel = 'admin');
$$;

-- ============ Cartões (só token do gateway) ============
create table if not exists public.cartoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  gateway text not null check (gateway in ('asaas', 'mercadopago', 'stripe')),
  gateway_customer_id text not null,
  gateway_cartao_token text not null,              -- token devolvido pelo gateway; nunca o número
  bandeira text,
  ultimos4 char(4) check (ultimos4 ~ '^[0-9]{4}$'),
  validade_mes smallint check (validade_mes between 1 and 12),
  validade_ano smallint check (validade_ano between 2000 and 2100),
  verificado_em timestamptz,                       -- validação no gateway (autorização de valor simbólico estornada)
  principal boolean not null default true,
  removido_em timestamptz,
  created_at timestamptz not null default now(),
  unique (gateway, gateway_cartao_token)
);
create unique index if not exists cartoes_um_principal on public.cartoes (user_id) where principal and removido_em is null;
alter table public.cartoes enable row level security;
-- Dono e admin leem (mascarado: token não é dado sensível sem a chave do gateway, mas o front nem pede).
-- Só o servidor (service role) cria, atualiza e remove cartões, depois de falar com o gateway.
create policy "cartoes: dono lê" on public.cartoes for select using (auth.uid() = user_id);
create policy "cartoes: admin lê" on public.cartoes for select using (public.eh_admin());

create or replace function public.tem_cartao_valido(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cartoes c
    where c.user_id = uid and c.verificado_em is not null and c.removido_em is null
      and (c.validade_ano is null
           or (c.validade_ano, c.validade_mes) >= (extract(year from now())::smallint, extract(month from now())::smallint))
  );
$$;

-- O teste de 3 dias começa quando o primeiro cartão é validado.
create or replace function public.iniciar_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verificado_em is not null and new.removido_em is null then
    update public.profiles
       set trial_expira_em = now() + interval '3 days'
     where id = new.user_id and papel = 'trial' and trial_expira_em is null;
  end if;
  return new;
end $$;
drop trigger if exists iniciar_trial on public.cartoes;
create trigger iniciar_trial after insert or update of verificado_em, removido_em on public.cartoes
  for each row execute function public.iniciar_trial();

-- ============ Assinaturas: nível e forma de pagamento ============
alter table public.subscriptions
  add column if not exists nivel text not null default 'usuario',
  add column if not exists forma_pagamento text;
do $$ begin
  alter table public.subscriptions add constraint subscriptions_nivel check (nivel in ('usuario', 'pro'));
  alter table public.subscriptions add constraint subscriptions_forma check (forma_pagamento in ('pix', 'cartao'));
exception when duplicate_object then null; end $$;

/** Mantém profiles.papel igual ao nível da assinatura ativa (admin nunca é alterado). */
create or replace function public.sincronizar_papel(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  nivel_ativo text;
begin
  select case when bool_or(s.nivel = 'pro') then 'pro' else 'usuario' end
    into nivel_ativo
    from public.subscriptions s
   where s.user_id = uid and s.status = 'ativa'
     and (s.current_period_end is null or s.current_period_end > now())
  having count(*) > 0;

  if nivel_ativo is not null then
    update public.profiles set papel = nivel_ativo::public.papel_usuario
     where id = uid and papel <> 'admin' and papel::text <> nivel_ativo;
  end if;
  -- Sem assinatura ativa o papel fica como está; quem decide o bloqueio é situacao_acesso().
end $$;

create or replace function public.ao_mudar_assinatura() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.sincronizar_papel(coalesce(new.user_id, old.user_id));
  return null;
end $$;
drop trigger if exists ao_mudar_assinatura on public.subscriptions;
create trigger ao_mudar_assinatura after insert or update or delete on public.subscriptions
  for each row execute function public.ao_mudar_assinatura();

-- ============ Situação de acesso (fonte única para app, API e agente) ============
create or replace function public.situacao_acesso(uid uuid)
returns table (
  papel public.papel_usuario,
  liberado boolean,
  motivo text,                 -- ok | trial | sem_cartao | trial_expirado | assinatura_inativa | sem_perfil
  tem_cartao boolean,
  trial_expira_em timestamptz,
  assinatura_ate timestamptz,
  personaliza_orcamento boolean  -- logo e paleta próprias no PDF (só pro e admin)
)
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  cartao boolean;
  ate timestamptz;
  ativa boolean;
begin
  -- Cada um consulta só a si mesmo; admin e o servidor (sem auth.uid()) consultam qualquer um.
  if auth.uid() is not null and uid <> auth.uid() and not public.eh_admin() then
    raise exception 'sem permissão';
  end if;

  select * into p from public.profiles where id = uid;
  if not found then
    return query select null::public.papel_usuario, false, 'sem_perfil', false, null::timestamptz, null::timestamptz, false;
    return;
  end if;

  cartao := public.tem_cartao_valido(uid);
  select max(s.current_period_end), bool_or(s.current_period_end is null or s.current_period_end > now())
    into ate, ativa
    from public.subscriptions s where s.user_id = uid and s.status = 'ativa';
  ativa := coalesce(ativa, false);

  if p.papel = 'admin' then
    return query select p.papel, true, 'ok', cartao, p.trial_expira_em, ate, true;
  elsif not cartao then
    return query select p.papel, false, 'sem_cartao', false, p.trial_expira_em, ate, false;
  elsif ativa then
    return query select p.papel, true, 'ok', true, p.trial_expira_em, ate, p.papel = 'pro';
  elsif p.papel = 'trial' and p.trial_expira_em > now() then
    return query select p.papel, true, 'trial', true, p.trial_expira_em, ate, false;
  elsif p.papel = 'trial' then
    return query select p.papel, false, 'trial_expirado', true, p.trial_expira_em, ate, false;
  else
    return query select p.papel, false, 'assinatura_inativa', true, p.trial_expira_em, ate, false;
  end if;
end $$;

-- Para o front: supabase.rpc('minha_situacao_acesso').
create or replace function public.minha_situacao_acesso()
returns table (papel public.papel_usuario, liberado boolean, motivo text, tem_cartao boolean,
               trial_expira_em timestamptz, assinatura_ate timestamptz, personaliza_orcamento boolean)
language sql stable security definer set search_path = public as $$
  select * from public.situacao_acesso(auth.uid());
$$;

create or replace function public.acesso_liberado() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select liberado from public.situacao_acesso(auth.uid())), false);
$$;

revoke execute on function public.situacao_acesso(uuid) from public, anon;
revoke execute on function public.minha_situacao_acesso() from public, anon;
revoke execute on function public.acesso_liberado() from public, anon;
revoke execute on function public.sincronizar_papel(uuid) from public, anon, authenticated;
revoke execute on function public.tem_cartao_valido(uuid) from public, anon, authenticated;
grant execute on function public.situacao_acesso(uuid) to authenticated, service_role;
grant execute on function public.minha_situacao_acesso() to authenticated;
grant execute on function public.acesso_liberado() to authenticated;

-- ============ Proteção do perfil ============
-- Usuário comum não muda o próprio papel, o trial nem o WhatsApp; logo e paleta só se for pro.
-- Admin (logado) pode mudar tudo. Servidor e SQL Editor não passam por esta checagem.
-- Sem security definer de propósito: current_user precisa ser o papel de quem fez o update.
create or replace function public.proteger_perfil() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if current_user not in ('authenticated', 'anon') or public.eh_admin() then
    return new;
  end if;
  if new.whatsapp_e164 is distinct from old.whatsapp_e164
     or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at then
    raise exception 'O WhatsApp só pode ser alterado pela verificação por código';
  end if;
  if new.papel is distinct from old.papel or new.trial_expira_em is distinct from old.trial_expira_em then
    raise exception 'O perfil de acesso é definido pela assinatura';
  end if;
  if old.papel <> 'pro' and (
       (new.cor_primaria is distinct from old.cor_primaria and new.cor_primaria is not null)
    or (new.cor_secundaria is distinct from old.cor_secundaria and new.cor_secundaria is not null)
    or (new.pdf_logo_path is distinct from old.pdf_logo_path and new.pdf_logo_path is not null)) then
    raise exception 'Logo e cores próprias no orçamento são do plano Pro';
  end if;
  return new;
end $$;
drop trigger if exists proteger_whatsapp on public.profiles;
drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil before update on public.profiles
  for each row execute function public.proteger_perfil();
drop function if exists public.proteger_whatsapp();

-- ============ RLS: bloqueio sem acesso e poderes do admin ============
-- Cálculos: só cria quem está liberado (cartão + trial válido ou assinatura ativa).
drop policy if exists "calculations: dono cria" on public.calculations;
create policy "calculations: dono liberado cria" on public.calculations for insert
  with check (auth.uid() = user_id and public.acesso_liberado());

create policy "profiles: admin lê" on public.profiles for select using (public.eh_admin());
create policy "profiles: admin atualiza" on public.profiles for update using (public.eh_admin()) with check (public.eh_admin());

create policy "subscriptions: admin gerencia" on public.subscriptions for all using (public.eh_admin()) with check (public.eh_admin());

create policy "calculations: admin lê" on public.calculations for select using (public.eh_admin());
create policy "calculations: admin apaga" on public.calculations for delete using (public.eh_admin());

create policy "whatsapp_messages: admin lê" on public.whatsapp_messages for select using (public.eh_admin());

create policy "pedidos_cidade: admin lê" on public.pedidos_cidade for select using (public.eh_admin());
create policy "pedidos_cidade: admin apaga" on public.pedidos_cidade for delete using (public.eh_admin());

create policy "municipios: admin gerencia" on public.municipios for all using (public.eh_admin()) with check (public.eh_admin());

-- ============ Logos dos assinantes Pro (Storage privado) ============
insert into storage.buckets (id, name, public)
values ('logos', 'logos', false)
on conflict (id) do nothing;

-- Caminho: logos/<user_id>/<arquivo>. Só o próprio Pro envia/troca/apaga; admin lê tudo.
create policy "logos: pro gerencia a própria" on storage.objects for all to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
         and exists (select 1 from public.profiles where id = auth.uid() and papel in ('pro', 'admin')))
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text
         and exists (select 1 from public.profiles where id = auth.uid() and papel in ('pro', 'admin')));
create policy "logos: admin lê" on storage.objects for select to authenticated
  using (bucket_id = 'logos' and public.eh_admin());

-- ============ Painel do admin ============
-- security_invoker: o RLS vale; admin vê todos, os demais só a si mesmos.
create or replace view public.admin_clientes with (security_invoker = true) as
select
  p.id, p.full_name, p.email, p.whatsapp_e164, p.papel, p.trial_expira_em, p.created_at,
  s.plan, s.nivel, s.status as status_assinatura, s.forma_pagamento, s.current_period_end,
  c.bandeira, c.ultimos4, c.verificado_em as cartao_verificado_em,
  (select count(*) from public.calculations k where k.user_id = p.id) as total_calculos,
  (select max(k.created_at) from public.calculations k where k.user_id = p.id) as ultimo_calculo
from public.profiles p
left join lateral (
  select * from public.subscriptions s where s.user_id = p.id order by s.created_at desc limit 1
) s on true
left join lateral (
  select * from public.cartoes c where c.user_id = p.id and c.removido_em is null order by c.principal desc, c.created_at desc limit 1
) c on true;

-- ============ Primeiro admin ============
-- Rode no SQL Editor depois que a sua conta existir (troque o e-mail):
-- update public.profiles set papel = 'admin' where email = 'seu-email@exemplo.com';
