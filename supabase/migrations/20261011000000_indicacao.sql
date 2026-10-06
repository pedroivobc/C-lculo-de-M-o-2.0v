-- Cupom de indicação: cada assinante gera o seu código; quem se cadastra com ele ganha 5 dias de teste (em vez de 3)
-- e fica ligado a quem indicou. Código e indicação só mudam pelo servidor.
alter table public.profiles
  add column if not exists codigo_indicacao text unique check (codigo_indicacao ~ '^[A-Z0-9]{4,16}$'),
  add column if not exists indicado_por uuid references auth.users on delete set null,
  add column if not exists indicado_em timestamptz;
create index if not exists profiles_indicado_por on public.profiles (indicado_por);

-- O teste começa quando o primeiro cartão é validado: 3 dias, ou 5 com indicação.
create or replace function public.iniciar_trial() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.verificado_em is not null and new.removido_em is null then
    update public.profiles
       set trial_expira_em = now() + case when indicado_por is not null then interval '5 days' else interval '3 days' end
     where id = new.user_id and papel = 'trial' and trial_expira_em is null;
  end if;
  return new;
end $$;

-- Proteção do perfil (versão de 20261007 + código e indicação).
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
  -- O logo só pode apontar para a pasta do próprio usuário.
  if new.pdf_logo_path is not null and new.pdf_logo_path not like new.id::text || '/%' then
    raise exception 'Logo inválido';
  end if;
  return new;
end $$;
