-- Esquema inicial (projeto novo ou restaurado).
-- Rodar no SQL Editor do Supabase ou com `supabase db push`.
-- Substitui supabase-schema.sql (que tinha perfis públicos para leitura).

create extension if not exists pgcrypto;

-- ============ Municípios atendidos ============
create table if not exists public.municipios (
  id text primary key,                         -- 'mg-juiz-de-fora'
  uf char(2) not null,
  nome text not null,
  status text not null check (status in ('ativo', 'em_breve')),
  vigencia date not null default current_date,
  created_at timestamptz not null default now()
);
insert into public.municipios (id, uf, nome, status)
values ('mg-juiz-de-fora', 'MG', 'Juiz de Fora', 'ativo')
on conflict (id) do nothing;

alter table public.municipios enable row level security;
create policy "municipios: leitura pública" on public.municipios for select using (true);

-- ============ Perfis ============
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  whatsapp_e164 text unique,                   -- +5532999990000
  whatsapp_verified_at timestamptz,
  municipio_padrao text not null default 'mg-juiz-de-fora' references public.municipios,
  pdf_header text,
  pdf_logo_path text,
  avatar_url text,                              -- usados pelas telas atuais (Settings, useTheme)
  theme text default 'light',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: dono lê" on public.profiles for select using (auth.uid() = id);
create policy "profiles: dono atualiza" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);
-- whatsapp_e164 e whatsapp_verified_at só mudam pelo servidor (verificação por código).
-- (revoke por coluna não funciona aqui: o Supabase concede UPDATE na tabela inteira.)
create or replace function public.proteger_whatsapp() returns trigger
language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.whatsapp_e164 is distinct from old.whatsapp_e164
          or new.whatsapp_verified_at is distinct from old.whatsapp_verified_at) then
    raise exception 'O WhatsApp só pode ser alterado pela verificação por código';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists proteger_whatsapp on public.profiles;
create trigger proteger_whatsapp before update on public.profiles
  for each row execute function public.proteger_whatsapp();

-- Cria o perfil ao cadastrar
create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

-- ============ Assinaturas ============
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan text not null check (plan in ('mensal', 'anual')),
  status text not null check (status in ('pendente', 'ativa', 'atrasada', 'cancelada')),
  gateway text not null default 'asaas',
  gateway_customer_id text,
  gateway_subscription_id text unique,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user on public.subscriptions (user_id, status);
alter table public.subscriptions enable row level security;
create policy "subscriptions: dono lê" on public.subscriptions for select using (auth.uid() = user_id);

-- ============ Cálculos (site e WhatsApp) ============
create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,  -- "#0142"
  user_id uuid not null references auth.users on delete cascade,
  tipo text not null,
  subtipo text,
  municipio text references public.municipios,
  origem text not null default 'site' check (origem in ('site', 'whatsapp')),
  descricao text,                                  -- endereço/cliente, livre
  entrada jsonb not null,
  resultado jsonb not null,
  total numeric(14, 2) not null,
  pdf_path text,
  created_at timestamptz not null default now()
);
create index if not exists calculations_user_data on public.calculations (user_id, created_at desc);
alter table public.calculations enable row level security;
create policy "calculations: dono lê" on public.calculations for select using (auth.uid() = user_id);
create policy "calculations: dono cria" on public.calculations for insert with check (auth.uid() = user_id);
create policy "calculations: dono apaga" on public.calculations for delete using (auth.uid() = user_id);

-- ============ Verificação do WhatsApp (só o servidor acessa) ============
create table if not exists public.phone_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  whatsapp_e164 text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.phone_verifications enable row level security;

-- ============ Log das conversas (só o servidor acessa) ============
create table if not exists public.whatsapp_messages (
  id bigserial primary key,
  user_id uuid references auth.users on delete set null,
  whatsapp_e164 text not null,
  direcao text not null check (direcao in ('entrada', 'saida')),
  tipo text not null,                              -- texto | imagem | documento
  conteudo text,
  evolution_message_id text unique,                -- idempotência
  calculation_id uuid references public.calculations on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_tel on public.whatsapp_messages (whatsapp_e164, created_at desc);
alter table public.whatsapp_messages enable row level security;

-- ============ Pedidos de novas cidades (landing e agente) ============
create table if not exists public.pedidos_cidade (
  id bigserial primary key,
  cidade text not null,
  uf char(2) not null default 'MG',
  whatsapp_e164 text,
  user_id uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);
alter table public.pedidos_cidade enable row level security;
create policy "pedidos_cidade: qualquer um pede" on public.pedidos_cidade for insert with check (true);

-- ============ Arquivos (PDFs e exportações), privado ============
insert into storage.buckets (id, name, public)
values ('orcamentos', 'orcamentos', false)
on conflict (id) do nothing;
-- Sem policy de leitura: os arquivos saem só por URL assinada gerada no servidor.

-- Avatares (tela Configurações atual grava em avatars/<user_id>-<aleatório>.<ext>)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
create policy "avatars: usuário envia o próprio" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name like 'avatars/' || auth.uid()::text || '-%');
