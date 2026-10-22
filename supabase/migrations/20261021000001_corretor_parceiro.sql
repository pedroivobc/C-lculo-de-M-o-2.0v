-- Corretor Parceiro da Clemente Assessoria. Rodar DEPOIS de 20261021000000_papel_parceiro.sql.
--
-- Regras:
--   - O parceiro é um membro da organização Clemente Team com funcao = 'parceiro' e a imobiliária em que trabalha.
--     Só existe em organização do tipo 'clemente' (conferido abaixo).
--   - Quem cadastra é o time da Clemente (gestor e colaboradores da Clemente Team) ou o administrador, pelo servidor
--     (rotas /api/parceiros). O parceiro não cadastra ninguém nem vê o painel.
--   - Acesso sem cobrança: vem da organização (situacao_acesso já libera Clemente Team sempre) e o orçamento sai com a
--     logo, a cor e o cabeçalho do dono da Clemente Team, com o nome e o contato do parceiro.
--   - Cada orçamento do parceiro fica marcado com o vínculo dele (calculations.parceiro_id). O painel de controle do time
--     filtra por esse vínculo; as telas da equipe (Minha equipe) deixam esses orçamentos de fora.

-- ============ Vínculo do parceiro ============
alter table public.organizacao_membros drop constraint if exists organizacao_membros_funcao_check;
alter table public.organizacao_membros add constraint organizacao_membros_funcao_check
  check (funcao in ('gestor', 'colaborador', 'parceiro'));
alter table public.organizacao_membros
  add column if not exists imobiliaria text check (imobiliaria is null or length(imobiliaria) between 2 and 120);
create index if not exists membros_parceiros on public.organizacao_membros (organizacao_id) where funcao = 'parceiro';

/** Parceiro só na Clemente Team. */
create or replace function public.conferir_parceiro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.funcao = 'parceiro' and (select tipo from public.organizacoes where id = new.organizacao_id) <> 'clemente' then
    raise exception 'Corretor parceiro só pode ser cadastrado na Clemente Team.';
  end if;
  return new;
end $$;
drop trigger if exists conferir_parceiro on public.organizacao_membros;
create trigger conferir_parceiro before insert or update of funcao, organizacao_id on public.organizacao_membros
  for each row execute function public.conferir_parceiro();

-- ============ Papel acompanha o vínculo (igual a 20261016000001, com o parceiro) ============
-- Entrou: papel = tipo da organização (teams/clemente), ou 'parceiro'. Saiu: volta ao da assinatura própria, ou trial.
create or replace function public.ao_mudar_membro() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  papel_novo text;
begin
  if tg_op <> 'INSERT' and old.user_id is not null
     and (tg_op = 'DELETE' or new.removido_em is not null or new.user_id is distinct from old.user_id) then
    update public.profiles set papel = 'trial' where id = old.user_id and papel in ('teams', 'clemente', 'parceiro');
    perform public.sincronizar_papel(old.user_id);
  end if;
  if tg_op <> 'DELETE' and new.user_id is not null and new.removido_em is null then
    if new.funcao = 'parceiro' then
      papel_novo := 'parceiro';
    else
      select tipo into papel_novo from public.organizacoes where id = new.organizacao_id;
    end if;
    update public.profiles set papel = papel_novo::public.papel_usuario
     where id = new.user_id and papel <> 'admin' and papel::text <> papel_novo;
  end if;
  return null;
end $$;
drop trigger if exists ao_mudar_membro on public.organizacao_membros;
create trigger ao_mudar_membro after insert or update or delete on public.organizacao_membros
  for each row execute function public.ao_mudar_membro();

-- ============ Orçamentos do parceiro ============
alter table public.calculations
  add column if not exists parceiro_id uuid references public.organizacao_membros on delete set null;
create index if not exists calculations_parceiro_data on public.calculations (organizacao_id, created_at desc)
  where parceiro_id is not null;

-- Cada orçamento guarda a organização de quem o fez naquele momento e, se for parceiro, o vínculo dele.
create or replace function public.marcar_organizacao_calculo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.organizacao_id := public.organizacao_do_usuario(new.user_id);
  new.parceiro_id := (select id from public.organizacao_membros
                       where user_id = new.user_id and removido_em is null and funcao = 'parceiro' limit 1);
  return new;
end $$;
drop trigger if exists marcar_organizacao_calculo on public.calculations;
create trigger marcar_organizacao_calculo before insert on public.calculations
  for each row execute function public.marcar_organizacao_calculo();

revoke execute on function public.conferir_parceiro() from public, anon, authenticated;
revoke execute on function public.ao_mudar_membro() from public, anon, authenticated;
revoke execute on function public.marcar_organizacao_calculo() from public, anon, authenticated;
