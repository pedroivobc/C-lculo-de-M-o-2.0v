-- 1) Periodicidade: trimestral (preço cheio), semestral (10% off) e anual (20% off).
--    'mensal' continua aceito só para assinaturas antigas.
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('mensal', 'trimestral', 'semestral', 'anual'));

-- 2) CPF único por conta: a mesma pessoa não abre várias contas para repetir o teste ou o cupom.
--    Guardado só com dígitos; também é exigido pelo gateway e pela nota fiscal. Só o servidor grava.
alter table public.profiles
  add column if not exists cpf char(11) unique check (cpf ~ '^[0-9]{11}$');

-- O teste só começa com CPF e cartão validado (o que vier por último dispara).
create or replace function public.iniciar_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verificado_em is not null and new.removido_em is null then
    update public.profiles
       set trial_expira_em = now() + case when indicado_por is not null then interval '5 days' else interval '3 days' end
     where id = new.user_id and papel = 'trial' and trial_expira_em is null and cpf is not null;
  end if;
  return new;
end $$;

create or replace function public.iniciar_trial_pelo_cpf() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cpf is not null and old.cpf is null and new.papel = 'trial' and new.trial_expira_em is null
     and public.tem_cartao_valido(new.id) then
    new.trial_expira_em := now() + case when new.indicado_por is not null then interval '5 days' else interval '3 days' end;
  end if;
  return new;
end $$;
drop trigger if exists iniciar_trial_pelo_cpf on public.profiles;
create trigger iniciar_trial_pelo_cpf before update of cpf on public.profiles
  for each row execute function public.iniciar_trial_pelo_cpf();

-- Proteção do perfil (versão de 20261011 + CPF).
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
  if new.codigo_indicacao is distinct from old.codigo_indicacao
     or new.indicado_por is distinct from old.indicado_por
     or new.indicado_em is distinct from old.indicado_em then
    raise exception 'O cupom de indicação é definido pelo sistema';
  end if;
  if new.cpf is distinct from old.cpf then
    raise exception 'O CPF é cadastrado pelo sistema e não pode ser trocado';
  end if;
  if new.pdf_logo_path is not null and new.pdf_logo_path not like new.id::text || '/%' then
    raise exception 'Logo inválido';
  end if;
  return new;
end $$;

-- 3) Recompensa de indicação: quem indicou ganha 1 mês grátis quando o indicado assina o plano ANUAL.
--    Fica 'pendente' desde a indicação, vira 'liberada' com a assinatura anual ativa e 'usada' quando o
--    desconto entrar numa cobrança (feito pela integração de pagamento).
create table if not exists public.recompensas_indicacao (
  id uuid primary key default gen_random_uuid(),
  indicador uuid not null references auth.users on delete cascade,
  indicado uuid not null unique references auth.users on delete cascade,
  status text not null default 'pendente' check (status in ('pendente', 'liberada', 'usada', 'cancelada')),
  meses_gratis smallint not null default 1,
  liberada_em timestamptz,
  usada_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists recompensas_indicador on public.recompensas_indicacao (indicador, status);
alter table public.recompensas_indicacao enable row level security;
create policy "recompensas: indicador lê" on public.recompensas_indicacao for select using (auth.uid() = indicador);

create or replace function public.liberar_recompensa_indicacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ativa' and new.plan = 'anual' then
    update public.recompensas_indicacao
       set status = 'liberada', liberada_em = now()
     where indicado = new.user_id and status = 'pendente';
  end if;
  return new;
end $$;
drop trigger if exists liberar_recompensa_indicacao on public.subscriptions;
create trigger liberar_recompensa_indicacao after insert or update of status, plan on public.subscriptions
  for each row execute function public.liberar_recompensa_indicacao();
