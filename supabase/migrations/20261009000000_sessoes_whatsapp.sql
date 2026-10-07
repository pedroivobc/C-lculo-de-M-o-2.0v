-- Onde cada conversa do WhatsApp está no menu (tela atual e valores já respondidos).
-- Só o servidor acessa. Depois de 30 minutos parada, a conversa recomeça do menu inicial.
create table if not exists public.whatsapp_sessoes (
  whatsapp_e164 text primary key,
  user_id uuid references auth.users on delete cascade,
  estado jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.whatsapp_sessoes enable row level security;
