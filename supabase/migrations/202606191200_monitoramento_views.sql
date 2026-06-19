begin;

create or replace function public.monitoramento_event_date(
  p_data_hora_evento text,
  p_created_at timestamptz
)
returns date
language sql
immutable
as $$
  select coalesce(
    case
      when btrim(coalesce(p_data_hora_evento, '')) ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}'
        then make_date(
          split_part(split_part(btrim(p_data_hora_evento), ' ', 1), '/', 3)::int,
          split_part(split_part(btrim(p_data_hora_evento), ' ', 1), '/', 2)::int,
          split_part(split_part(btrim(p_data_hora_evento), ' ', 1), '/', 1)::int
        )
      else null
    end,
    p_created_at::date
  );
$$;

create or replace function public.monitoramento_resolved_prefixo(
  p_prefixo text,
  p_veiculo text,
  p_codigo_cartao text,
  p_codigo_usuario text
)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(btrim(coalesce(p_prefixo, '')), ''),
    nullif(btrim(coalesce(p_veiculo, '')), ''),
    nullif(btrim(coalesce(p_codigo_cartao, '')), ''),
    nullif(btrim(coalesce(p_codigo_usuario, '')), ''),
    'SEM_PREFIXO'
  );
$$;

drop view if exists public.vw_monitoramento_inspecoes_base;
create or replace view public.vw_monitoramento_inspecoes_base as
select
  vi.*,
  public.monitoramento_event_date(vi.data_hora_evento, vi.created_at) as dt_evento,
  public.monitoramento_resolved_prefixo(vi.prefixo, vi.veiculo, vi.codigo_cartao, vi.codigo_usuario) as prefixo_resolvido
from public.vision_inspecoes vi;

drop view if exists public.vw_monitoramento_inspecoes_diario;
create or replace view public.vw_monitoramento_inspecoes_diario as
select
  b.dt_evento,
  count(*)::bigint as total_laudos,
  count(*) filter (where b.acao_prevista = 'Confirmar Similaridade')::bigint as total_similaridade,
  count(*) filter (where b.acao_prevista = 'Confirmar Irregularidade')::bigint as total_irregularidade,
  count(*) filter (where b.acao_prevista = 'Confirmar Inconclusivo')::bigint as total_inconclusivo,
  count(*) filter (where b.acao_prevista = 'Inconsistencia Tecnica')::bigint as total_tecnica,
  coalesce(sum(coalesce(b.quantidade_rostos_camera, 0)), 0)::bigint as total_rostos_camera,
  round(avg(nullif(b.score::numeric, 0)), 1) as score_medio,
  round(avg(nullif(b.score_biometrico::numeric, 0)), 1) as score_medio_biometrico,
  round(avg(nullif(b.score_face_mesh::numeric, 0)), 1) as score_medio_face_mesh,
  count(distinct b.prefixo_resolvido)::bigint as prefixos_distintos
from public.vw_monitoramento_inspecoes_base b
group by b.dt_evento;

drop view if exists public.vw_monitoramento_inspecoes_prefixos;
create or replace view public.vw_monitoramento_inspecoes_prefixos as
select
  b.dt_evento,
  b.prefixo_resolvido as prefixo,
  count(*)::bigint as total_laudos,
  count(*) filter (where b.acao_prevista = 'Confirmar Similaridade')::bigint as total_similaridade,
  count(*) filter (where b.acao_prevista = 'Confirmar Irregularidade')::bigint as total_irregularidade,
  count(*) filter (where b.acao_prevista = 'Confirmar Inconclusivo')::bigint as total_inconclusivo,
  count(*) filter (where b.acao_prevista = 'Inconsistencia Tecnica')::bigint as total_tecnica,
  round(avg(nullif(b.score::numeric, 0)), 1) as score_medio,
  round(avg(nullif(b.score_biometrico::numeric, 0)), 1) as score_medio_biometrico,
  round(avg(nullif(b.score_face_mesh::numeric, 0)), 1) as score_medio_face_mesh,
  coalesce(sum(coalesce(b.quantidade_rostos_camera, 0)), 0)::bigint as total_rostos_camera
from public.vw_monitoramento_inspecoes_base b
group by b.dt_evento, b.prefixo_resolvido;

create index if not exists idx_vision_inspecoes_monitoramento_dt_evento
  on public.vision_inspecoes (public.monitoramento_event_date(data_hora_evento, created_at));

create index if not exists idx_vision_inspecoes_monitoramento_prefixo
  on public.vision_inspecoes (public.monitoramento_resolved_prefixo(prefixo, veiculo, codigo_cartao, codigo_usuario));

commit;
