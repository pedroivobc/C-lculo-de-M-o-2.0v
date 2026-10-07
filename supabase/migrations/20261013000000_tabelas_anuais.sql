-- Tabelas que mudam todo ano, publicadas pelo administrador por planilha (Admin → Tabelas anuais):
--   emolumentos → tabela de emolumentos de MG (TJMG): faixas, excedente, cancelamento e atos fixos
--   incc        → índices do INCC da correção contratual (Juiz de Fora)
--   itbiJf      → base do desconto de ITBI no SFH em Juiz de Fora
-- Vale a versão de cada tipo com a maior vigencia_inicio que já começou; sem versão, valem as de 2026 do código.
create table if not exists public.tabelas_anuais (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('emolumentos', 'incc', 'itbiJf')),
  ano int not null check (ano between 2026 and 2100),
  vigencia_inicio date not null,
  dados jsonb not null,
  publicado_por uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  unique (tipo, vigencia_inicio)
);
alter table public.tabelas_anuais enable row level security;
-- Leitura pública (são tabelas oficiais); gravação só pelo servidor, depois de validar a planilha.
create policy "tabelas_anuais: leitura pública" on public.tabelas_anuais for select using (true);
