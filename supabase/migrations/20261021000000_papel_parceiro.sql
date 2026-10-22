-- Novo perfil de acesso: Corretor Parceiro da Clemente Assessoria. Fica num arquivo próprio porque o Postgres
-- não deixa usar um valor novo de enum na mesma transação em que ele foi criado.
--   parceiro → corretor de fora, cadastrado pelo time da Clemente: não paga, orça no site e no WhatsApp
--              e todos os orçamentos saem com a logo da Clemente. Rodar ANTES de 20261021000001_corretor_parceiro.sql.
alter type public.papel_usuario add value if not exists 'parceiro';
