-- Garante todas as colunas usadas pelo OrganogramaCanvas (idempotente)
alter table public.organograma_manutencao_areas
  add column if not exists orcado_qtd integer,
  add column if not exists realizado_qtd integer,
  add column if not exists nivel text,
  add column if not exists setor text,
  add column if not exists canvas_x numeric,
  add column if not exists canvas_y numeric,
  add column if not exists canvas_largura numeric,
  add column if not exists canvas_altura numeric;

alter table public.organograma_manutencao_pessoas
  add column if not exists canvas_x numeric,
  add column if not exists canvas_y numeric,
  add column if not exists tipo_headcount text default 'REALIZADO';

-- Recarrega o cache do PostgREST para a API enxergar as colunas novas
notify pgrst, 'reload schema';
