begin;

alter table if exists public.estoque_diesel_programacoes_diarias
  add column if not exists preco_diesel numeric(12,4);

alter table if exists public.estoque_diesel_programacoes_diarias
  add column if not exists defasagem_cbie numeric(10,2);

commit;
