-- Configuração do orçamento feita no cadastro: estado, cidade e alíquota do ITBI, logo, cor e formato (PDF ou JPEG).
-- Rodar DEPOIS de 20261006000000_perfis_e_acesso.sql.
--
-- Mudança de regra: qualquer pessoa pode GUARDAR logo e cor (o cadastro pede isso logo de início).
-- Quem decide se elas APARECEM no orçamento é o plano: pro, trial e admin saem com a marca do assinante;
-- usuario (Essencial) sai com a marca Orçaí, e a configuração fica guardada para quando ele mudar para o Pró.

-- ============ Cidade "outra de MG" (alíquota informada pelo assinante) ============
alter table public.municipios drop constraint if exists municipios_status_check;
alter table public.municipios add constraint municipios_status_check
  check (status in ('ativo', 'em_breve', 'personalizado'));
insert into public.municipios (id, uf, nome, status)
values ('mg-outra', 'MG', 'Outra cidade de MG', 'personalizado')
on conflict (id) do nothing;

-- ============ Perfil: configuração do orçamento ============
alter table public.profiles
  add column if not exists uf char(2) not null default 'MG',
  add column if not exists cidade_nome text,                       -- quando municipio_padrao = 'mg-outra'
  add column if not exists itbi_percentual numeric(5,2),           -- 2.00 = 2%; null = alíquota da prefeitura
  add column if not exists formato_orcamento text not null default 'pdf',
  add column if not exists configurado_em timestamptz;             -- concluiu a etapa "Seu orçamento" do cadastro

do $$ begin
  alter table public.profiles add constraint profiles_uf_valida check (uf ~ '^[A-Z]{2}$');
  alter table public.profiles add constraint profiles_itbi_faixa check (itbi_percentual is null or itbi_percentual between 0 and 10);
  alter table public.profiles add constraint profiles_formato check (formato_orcamento in ('pdf', 'jpeg'));
  alter table public.profiles add constraint profiles_cidade_tamanho check (cidade_nome is null or length(cidade_nome) <= 80);
  -- Cidade sem regra cadastrada precisa de nome e alíquota.
  alter table public.profiles add constraint profiles_outra_cidade check (
    municipio_padrao <> 'mg-outra' or (cidade_nome is not null and itbi_percentual is not null));
exception when duplicate_object then null; end $$;

-- ============ Proteção do perfil (sem a trava de logo/cor) ============
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
  -- O logo só pode apontar para a pasta do próprio usuário.
  if new.pdf_logo_path is not null and new.pdf_logo_path not like new.id::text || '/%' then
    raise exception 'Logo inválido';
  end if;
  return new;
end $$;

-- ============ Logos: todos guardam o próprio (até 2 MB, PNG/JPEG/WEBP) ============
update storage.buckets
   set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'logos';
drop policy if exists "logos: pro gerencia a própria" on storage.objects;
drop policy if exists "logos: dono gerencia a própria" on storage.objects;
create policy "logos: dono gerencia a própria" on storage.objects for all to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ Situação de acesso: trial também personaliza ============
-- O teste de 3 dias mostra o orçamento como no Pró (com a marca do assinante).
create or replace function public.situacao_acesso(uid uuid)
returns table (
  papel public.papel_usuario,
  liberado boolean,
  motivo text,                 -- ok | trial | sem_cartao | trial_expirado | assinatura_inativa | sem_perfil
  tem_cartao boolean,
  trial_expira_em timestamptz,
  assinatura_ate timestamptz,
  personaliza_orcamento boolean  -- logo e cor próprias no orçamento: pro, trial (no prazo) e admin
)
language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  cartao boolean;
  ate timestamptz;
  ativa boolean;
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

  if p.papel = 'admin' then
    return query select p.papel, true, 'ok', cartao, p.trial_expira_em, ate, true;
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
