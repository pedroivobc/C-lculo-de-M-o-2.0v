-- Capitais em teste piloto: São Paulo, Rio de Janeiro, Brasília, Curitiba, Porto Alegre e Balneário Camboriú.
-- Escritura, registro, ITBI e financiamento; doação ainda só em MG (o ITCD desses estados não entrou).
-- Fontes e premissas em docs/piloto-capitais/README.md.
alter table public.municipios drop constraint if exists municipios_status_check;
alter table public.municipios add constraint municipios_status_check
  check (status in ('ativo', 'em_breve', 'personalizado', 'piloto'));

insert into public.municipios (id, uf, nome, status)
values
  ('sp-sao-paulo', 'SP', 'São Paulo', 'piloto'),
  ('rj-rio-de-janeiro', 'RJ', 'Rio de Janeiro', 'piloto'),
  ('df-brasilia', 'DF', 'Brasília', 'piloto'),
  ('pr-curitiba', 'PR', 'Curitiba', 'piloto'),
  ('rs-porto-alegre', 'RS', 'Porto Alegre', 'piloto'),
  ('sc-balneario-camboriu', 'SC', 'Balneário Camboriú', 'piloto')
on conflict (id) do nothing;
