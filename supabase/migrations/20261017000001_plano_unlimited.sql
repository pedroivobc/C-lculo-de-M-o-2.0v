-- Plano Unlimited: acesso completo a tudo, sem cobrança e sem data para acabar. Uso interno (conta do administrador).
-- Gravado como assinatura nivel 'unlimited', gateway 'manual' e current_period_end vazio: não entra no MRR nem gera cobrança.
alter table public.subscriptions drop constraint if exists subscriptions_nivel;
alter table public.subscriptions add constraint subscriptions_nivel check (nivel in ('usuario', 'pro', 'teams', 'unlimited'));

/** Papel pela assinatura ativa (igual a 20261016000001; Unlimited conta como Pró para quem não é admin). */
create or replace function public.sincronizar_papel(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  nivel_ativo text;
begin
  if public.organizacao_do_usuario(uid) is not null then return; end if;
  select case when bool_or(s.nivel = 'teams') then 'teams' when bool_or(s.nivel in ('pro', 'unlimited')) then 'pro' else 'usuario' end
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
revoke execute on function public.sincronizar_papel(uuid) from public, anon, authenticated;

-- Ativa o Unlimited na conta do administrador principal (se a conta já existir e ainda não tiver).
insert into public.subscriptions (user_id, plan, nivel, status, gateway, current_period_end)
select p.id, 'trimestral', 'unlimited', 'ativa', 'manual', null
  from public.profiles p
 where lower(p.email) = 'pedroivo@clementeassessoria.com'
   and not exists (select 1 from public.subscriptions s where s.user_id = p.id and s.nivel = 'unlimited' and s.status = 'ativa');
