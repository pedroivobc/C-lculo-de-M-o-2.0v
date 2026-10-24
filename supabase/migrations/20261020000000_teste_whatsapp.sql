-- Teste grátis pelo WhatsApp: quem manda mensagem ao agente sem cadastro ganha uma conta de teste
-- (sem e-mail real nem senha) com até 3 orçamentos. Ao se cadastrar no site e confirmar o mesmo
-- WhatsApp, os orçamentos passam para a conta nova e a de teste é apagada.
-- Só o servidor lê e grava (RLS ligado e sem políticas).
create table if not exists public.whatsapp_testes (
  user_id uuid primary key references auth.users on delete cascade,
  whatsapp_e164 text not null unique,
  origem text,                                  -- código que veio na mensagem do botão do site, ou 'whatsapp'
  created_at timestamptz not null default now()
);
alter table public.whatsapp_testes enable row level security;
