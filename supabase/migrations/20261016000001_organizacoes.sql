-- Organizações (imobiliárias e equipe Clemente): um gestor paga um fee fixo por um pacote de usuários
-- (assentos_base) e cada usuário a mais entra como adicional. Preços em src/lib/planos.ts (EQUIPE).
-- Rodar DEPOIS de 20261016000000_papeis_equipe.sql.
--
-- Regras:
--   - Cada pessoa está em no máximo uma organização ativa.
--   - Todos os membros saem no orçamento com a logo, a cor e o cabeçalho do gestor (o dono da organização),
--     e com o próprio nome, WhatsApp e e-mail no contato.
--   - Membro não precisa de cartão nem de assinatura própria: o acesso vem da organização.
--     teams    → liberado enquanto o dono tiver assinatura ativa de nível 'teams'.
--     clemente → sempre liberado.
--   - Membros são incluídos, alterados e removidos pelo servidor (rotas /api/equipe), nunca direto pelo front.

-- ============ Organizações ============
create table if not exists public.organizacoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(nome) between 2 and 120),
  tipo text not null default 'teams' check (tipo in ('teams', 'clemente')),
  dono_id uuid not null unique references auth.users on delete restrict,
  assentos_base smallint not null default 5 check (assentos_base between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizacao_membros (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references public.organizacoes on delete cascade,
  user_id uuid references auth.users on delete set null,   -- nulo enquanto a pessoa não tem conta
  nome text not null check (length(nome) between 2 and 120),
  telefone_e164 text not null check (telefone_e164 ~ '^\+[0-9]{10,15}$'),
  email text check (email is null or length(email) <= 200),
  funcao text not null default 'colaborador' check (funcao in ('gestor', 'colaborador')),
  removido_em timestamptz,                                 -- "excluir" guarda o histórico para os relatórios
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists membros_uma_org_por_pessoa on public.organizacao_membros (user_id)
  where removido_em is null and user_id is not null;
create unique index if not exists membros_telefone_unico on public.organizacao_membros (organizacao_id, telefone_e164)
  where removido_em is null;
create index if not exists membros_org on public.organizacao_membros (organizacao_id) where removido_em is null;
create index if not exists membros_email on public.organizacao_membros (lower(email)) where removido_em is null and user_id is null;

-- Orçamentos ficam marcados com a organização em que foram feitos (relatórios do gestor).
alter table public.calculations
  add column if not exists organizacao_id uuid references public.organizacoes on delete set null;
create index if not exists calculations_org_data on public.calculations (organizacao_id, created_at desc)
  where organizacao_id is not null;

-- ============ Funções de apoio ============
/** Organização ativa do usuário (ou null). */
create or replace function public.organizacao_do_usuario(uid uuid default auth.uid()) returns uuid
language sql stable security definer set search_path = public as $$
  select organizacao_id from public.organizacao_membros where user_id = uid and removido_em is null limit 1;
$$;

/** É gestor da organização? */
create or replace function public.eh_gestor(org uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organizacao_membros
                  where organizacao_id = org and user_id = uid and funcao = 'gestor' and removido_em is null);
$$;

/** A organização está liberada? clemente sempre; teams com a assinatura 'teams' do dono ativa. */
create or replace function public.organizacao_liberada(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select o.tipo = 'clemente' or exists (
      select 1 from public.subscriptions s
       where s.user_id = o.dono_id and s.nivel = 'teams' and s.status = 'ativa'
         and (s.current_period_end is null or s.current_period_end > now()))
      from public.organizacoes o where o.id = org), false);
$$;

revoke execute on function public.organizacao_do_usuario(uuid) from public, anon;
revoke execute on function public.eh_gestor(uuid, uuid) from public, anon;
revoke execute on function public.organizacao_liberada(uuid) from public, anon, authenticated;
grant execute on function public.organizacao_do_usuario(uuid) to authenticated, service_role;
grant execute on function public.eh_gestor(uuid, uuid) to authenticated, service_role;
grant execute on function public.organizacao_liberada(uuid) to service_role;

-- ============ RLS ============
alter table public.organizacoes enable row level security;
alter table public.organizacao_membros enable row level security;
create policy "organizacoes: membro lê a sua" on public.organizacoes for select
  using (id = public.organizacao_do_usuario());
create policy "organizacoes: admin gerencia" on public.organizacoes for all
  using (public.eh_admin()) with check (public.eh_admin());
create policy "membros: a pessoa lê o próprio vínculo" on public.organizacao_membros for select
  using (user_id = auth.uid());
create policy "membros: gestor lê a equipe" on public.organizacao_membros for select
  using (public.eh_gestor(organizacao_id));
create policy "membros: admin gerencia" on public.organizacao_membros for all
  using (public.eh_admin()) with check (public.eh_admin());
-- Gestor lê os orçamentos feitos na organização.
create policy "calculations: gestor lê os da equipe" on public.calculations for select
  using (organizacao_id is not null and public.eh_gestor(organizacao_id));

-- ============ Assinatura de equipe ============
alter table public.subscriptions drop constraint if exists subscriptions_nivel;
alter table public.subscriptions add constraint subscriptions_nivel check (nivel in ('usuario', 'pro', 'teams'));

/** Papel pela assinatura ativa. Admin e membros de organização não mudam por aqui (o papel deles vem da organização). */
create or replace function public.sincronizar_papel(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  nivel_ativo text;
begin
  if public.organizacao_do_usuario(uid) is not null then return; end if;
  select case when bool_or(s.nivel = 'teams') then 'teams' when bool_or(s.nivel = 'pro') then 'pro' else 'usuario' end
    into nivel_ativo
    from public.subscriptions s
   where s.user_id = uid and s.status = 'ativa'
     and (s.current_period_end is null or s.current_period_end > now())
  having count(*) > 0;

  if nivel_ativo is not null then
    update public.profiles set papel = nivel_ativo::public.papel_usuario
     where id = uid and papel <> 'admin' and papel::text <> nivel_ativo;
  end if;
end $$;

-- ============ Papel acompanha o vínculo ============
-- Entrou na organização: papel = tipo dela (teams/clemente). Saiu: volta ao da assinatura própria, ou trial.
create or replace function public.ao_mudar_membro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tipo_org text;
begin
  if tg_op <> 'INSERT' and old.user_id is not null
     and (tg_op = 'DELETE' or new.removido_em is not null or new.user_id is distinct from old.user_id) then
    update public.profiles set papel = 'trial' where id = old.user_id and papel in ('teams', 'clemente');
    perform public.sincronizar_papel(old.user_id);
  end if;
  if tg_op <> 'DELETE' and new.user_id is not null and new.removido_em is null then
    select tipo into tipo_org from public.organizacoes where id = new.organizacao_id;
    update public.profiles set papel = tipo_org::public.papel_usuario
     where id = new.user_id and papel <> 'admin' and papel::text <> tipo_org;
  end if;
  return null;
end $$;
drop trigger if exists ao_mudar_membro on public.organizacao_membros;
create trigger ao_mudar_membro after insert or update or delete on public.organizacao_membros
  for each row execute function public.ao_mudar_membro();

-- Conta nova com o e-mail de um convite pendente: entra na organização sozinha.
-- (Quem foi incluído só pelo telefone entra ao confirmar o WhatsApp; ver server/equipe.ts.)
create or replace function public.vincular_convite_por_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and public.organizacao_do_usuario(new.id) is null then
    update public.organizacao_membros set user_id = new.id, updated_at = now()
     where id = (select id from public.organizacao_membros
                  where user_id is null and removido_em is null and lower(email) = lower(new.email)
                  order by created_at limit 1);
  end if;
  return null;
end $$;
drop trigger if exists vincular_convite_por_email on public.profiles;
create trigger vincular_convite_por_email after insert on public.profiles
  for each row execute function public.vincular_convite_por_email();

-- Cada orçamento guarda a organização de quem o fez naquele momento.
create or replace function public.marcar_organizacao_calculo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.organizacao_id := public.organizacao_do_usuario(new.user_id);
  return new;
end $$;
drop trigger if exists marcar_organizacao_calculo on public.calculations;
create trigger marcar_organizacao_calculo before insert on public.calculations
  for each row execute function public.marcar_organizacao_calculo();

revoke execute on function public.ao_mudar_membro() from public, anon, authenticated;
revoke execute on function public.vincular_convite_por_email() from public, anon, authenticated;
revoke execute on function public.marcar_organizacao_calculo() from public, anon, authenticated;

-- ============ Situação de acesso: membros de organização ============
-- Mesma assinatura da versão de 20261007; o motivo ganha 'organizacao_inativa'.
create or replace function public.situacao_acesso(uid uuid)
returns table (
  papel public.papel_usuario,
  liberado boolean,
  motivo text,                 -- ok | trial | sem_cartao | trial_expirado | assinatura_inativa | organizacao_inativa | sem_perfil
  tem_cartao boolean,
  trial_expira_em timestamptz,
  assinatura_ate timestamptz,
  personaliza_orcamento boolean  -- logo e cor no orçamento: pro, trial (no prazo), admin e membros de organização liberada
)
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  cartao boolean;
  ate timestamptz;
  ativa boolean;
  org uuid;
begin
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
  org := public.organizacao_do_usuario(uid);

  if p.papel = 'admin' then
    return query select p.papel, true, 'ok', cartao, p.trial_expira_em, ate, true;
  elsif org is not null then
    if public.organizacao_liberada(org) then
      return query select p.papel, true, 'ok', cartao, p.trial_expira_em, ate, true;
    else
      return query select p.papel, false, 'organizacao_inativa', cartao, p.trial_expira_em, ate, false;
    end if;
  elsif not cartao then
    return query select p.papel, false, 'sem_cartao', false, p.trial_expira_em, ate, false;
  elsif ativa then
    return query select p.papel, true, 'ok', true, p.trial_expira_em, ate, p.papel = 'pro';
  elsif p.papel = 'trial' and p.trial_expira_em > now() then
    return query select p.papel, true, 'trial', true, p.trial_expira_em, ate, true;
  elsif p.papel = 'trial' then
    return query select p.papel, false, 'trial_expirado', true, p.trial_expira_em, ate, false;
  else
    return query select p.papel, false, 'assinatura_inativa', true, p.trial_expira_em, ate, false;
  end if;
end $$;
