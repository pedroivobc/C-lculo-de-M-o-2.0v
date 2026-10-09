-- Pagamento pela Stripe.
-- Cartão: todo plano é cobrado mês a mês, com fidelidade de 3, 6 ou 12 meses; depois renova no mesmo plano.
-- Pix: só no anual, pago de uma vez (a renovação é um novo Pix).
-- Não existe plano mensal: 'mensal' continua no check só para assinaturas antigas.

alter table public.subscriptions alter column gateway set default 'stripe';
alter table public.subscriptions
  add column if not exists fidelidade_ate timestamptz,  -- antes disso o cancelamento não vale (cartão)
  add column if not exists cancela_em timestamptz;      -- cancelamento agendado (fim da fidelidade ou do mês pago)

-- Cliente do gateway de cada conta. Só o servidor lê e grava (RLS sem políticas).
create table if not exists public.clientes_gateway (
  user_id uuid not null references auth.users on delete cascade,
  gateway text not null check (gateway in ('stripe')),
  customer_id text not null unique,
  created_at timestamptz not null default now(),
  primary key (user_id, gateway)
);
alter table public.clientes_gateway enable row level security;

