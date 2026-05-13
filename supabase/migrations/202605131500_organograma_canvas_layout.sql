alter table public.organograma_manutencao_areas
  add column if not exists canvas_x numeric,
  add column if not exists canvas_y numeric,
  add column if not exists canvas_largura numeric,
  add column if not exists canvas_altura numeric;

alter table public.organograma_manutencao_pessoas
  add column if not exists canvas_x numeric,
  add column if not exists canvas_y numeric;

grant select, insert, update on public.organograma_manutencao_areas to anon, authenticated;
grant select, insert, update on public.organograma_manutencao_pessoas to anon, authenticated;
