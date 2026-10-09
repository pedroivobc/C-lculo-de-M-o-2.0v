-- Trilha das ações do administrador na Gestão de Negócio (liberar plano, estender teste, mudar pacote de equipe...).
-- Só o servidor grava (service role); o admin lê. Ninguém altera nem apaga pelo app.
create table if not exists public.admin_auditoria (
  id bigserial primary key,
  ator_id uuid references auth.users on delete set null,
  acao text not null,                 -- liberar_plano | encerrar_liberacao | estender_teste | criar_equipe | mudar_pacote | liberar_equipe
  objeto_tipo text not null,          -- usuario | organizacao
  objeto_id uuid not null,
  motivo text,
  antes jsonb,
  depois jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_auditoria_objeto on public.admin_auditoria (objeto_tipo, objeto_id, created_at desc);
create index if not exists admin_auditoria_data on public.admin_auditoria (created_at desc);

alter table public.admin_auditoria enable row level security;
drop policy if exists "admin_auditoria: admin lê" on public.admin_auditoria;
create policy "admin_auditoria: admin lê" on public.admin_auditoria for select using (public.eh_admin());

-- Índices para os indicadores (orçamentos por período e assinaturas por data).
create index if not exists calculations_data on public.calculations (created_at desc);
create index if not exists subscriptions_data on public.subscriptions (created_at desc);
