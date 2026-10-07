-- Certidões e honorários padrão do assinante, definidos na etapa "Seu orçamento" do cadastro.
-- Formato: {"escritura": {"certidoes": 400, "honorarios": 700}, "financiamento": {"certidoes": 260.07, "honorarios": 700}} (em reais).
alter table public.profiles add column if not exists custos_padrao jsonb;
