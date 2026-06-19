begin;

create table if not exists public.monitoramento_dias (
  dt_evento date primary key,
  inspecionado boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.monitoramento_dias enable row level security;
grant select, insert, update on public.monitoramento_dias to anon, authenticated;

drop policy if exists "monitoramento_dias_select" on public.monitoramento_dias;
create policy "monitoramento_dias_select"
  on public.monitoramento_dias
  for select
  using (true);

drop policy if exists "monitoramento_dias_insert" on public.monitoramento_dias;
create policy "monitoramento_dias_insert"
  on public.monitoramento_dias
  for insert
  with check (true);

drop policy if exists "monitoramento_dias_update" on public.monitoramento_dias;
create policy "monitoramento_dias_update"
  on public.monitoramento_dias
  for update
  using (true)
  with check (true);

drop view if exists public.vw_monitoramento_inspecoes_calendario;
create or replace view public.vw_monitoramento_inspecoes_calendario as
select
  d.dt_evento,
  d.total_laudos,
  d.total_similaridade,
  d.total_irregularidade,
  d.total_inconclusivo,
  d.total_tecnica,
  d.total_rostos_camera,
  d.score_medio,
  d.score_medio_biometrico,
  d.score_medio_face_mesh,
  d.prefixos_distintos,
  coalesce(m.inspecionado, false) as inspecionado,
  m.updated_at as status_updated_at
from public.vw_monitoramento_inspecoes_diario d
left join public.monitoramento_dias m on m.dt_evento = d.dt_evento;

grant select on public.vw_monitoramento_inspecoes_calendario to anon, authenticated;

commit;
