-- Novos perfis de acesso para equipes (imobiliárias). Fica num arquivo próprio porque o Postgres
-- não deixa usar um valor novo de enum na mesma transação em que ele foi criado.
--   teams    → imobiliária assinante: gestor e colaboradores, todos com os recursos do Pro.
--   clemente → equipe interna da Clemente Assessoria: mesmo formato do teams, sem cobrança.
alter type public.papel_usuario add value if not exists 'teams';
alter type public.papel_usuario add value if not exists 'clemente';
