-- Belo Horizonte: ITBI de 3% (Lei 6.492/1993), conferido na base de pesquisa 2026.
insert into public.municipios (id, uf, nome, status)
values ('mg-belo-horizonte', 'MG', 'Belo Horizonte', 'ativo')
on conflict (id) do nothing;
