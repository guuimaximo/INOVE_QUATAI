begin;

drop view if exists public.vw_monitoramento_inspecoes_dashboard;
create or replace view public.vw_monitoramento_inspecoes_dashboard as
with recentes as (
  select *
  from public.vw_monitoramento_inspecoes_base
  order by created_at desc nulls last, id desc nulls last
  limit 1000
)
select
  r.dt_evento,
  count(*)::bigint as total_laudos,
  count(*) filter (where r.acao_prevista = 'Confirmar Similaridade')::bigint as total_similaridade,
  count(*) filter (where r.acao_prevista = 'Confirmar Irregularidade')::bigint as total_irregularidade,
  count(*) filter (where r.acao_prevista = 'Confirmar Inconclusivo')::bigint as total_inconclusivo,
  count(*) filter (where r.acao_prevista = 'Inconsistencia Tecnica')::bigint as total_tecnica,
  coalesce(sum(coalesce(r.quantidade_rostos_camera, 0)), 0)::bigint as total_rostos_camera,
  round(avg(nullif(r.score::numeric, 0)), 1) as score_medio,
  round(avg(nullif(r.score_biometrico::numeric, 0)), 1) as score_medio_biometrico,
  round(avg(nullif(r.score_face_mesh::numeric, 0)), 1) as score_medio_face_mesh,
  count(distinct r.prefixo_resolvido)::bigint as prefixos_distintos,
  coalesce(m.inspecionado, false) as inspecionado,
  m.updated_at as status_updated_at
from recentes r
left join public.monitoramento_dias m on m.dt_evento = r.dt_evento
group by r.dt_evento, m.inspecionado, m.updated_at;

grant select on public.vw_monitoramento_inspecoes_dashboard to anon, authenticated;

drop view if exists public.vw_monitoramento_inspecoes_veiculos;
create or replace view public.vw_monitoramento_inspecoes_veiculos as
with recentes as (
  select *
  from public.vw_monitoramento_inspecoes_base
  order by created_at desc nulls last, id desc nulls last
  limit 1000
),
ranked as (
  select
    r.*,
    upper(trim(coalesce(r.qualidade_imagem_camera, ''))) as qualidade_camera_norm,
    row_number() over (
      partition by r.prefixo_resolvido
      order by r.created_at desc nulls last, r.id desc nulls last
    ) as rn
  from recentes r
)
select
  r.prefixo_resolvido as prefixo,
  count(*)::bigint as total_laudos,
  count(*) filter (where r.acao_prevista = 'Confirmar Similaridade')::bigint as total_similaridade,
  count(*) filter (where r.acao_prevista = 'Confirmar Irregularidade')::bigint as total_irregularidade,
  count(*) filter (where r.acao_prevista = 'Confirmar Inconclusivo')::bigint as total_inconclusivo,
  count(*) filter (where r.acao_prevista = 'Inconsistencia Tecnica')::bigint as total_tecnica,
  count(*) filter (
    where
      coalesce(r.camera_enquadramento, '') in ('INADEQUADO', 'ERRO')
      or r.qualidade_camera_norm in ('RUIM', 'MEDIA')
      or coalesce(r.categoria, '') in ('SEM_PESSOA', 'INCONCLUSIVO', 'PESSOA_VISIVEL_DIFERENTE')
      or coalesce(r.acao_prevista, '') = 'Inconsistencia Tecnica'
  )::bigint as total_ajustes_camera,
  round(avg(nullif(r.score::numeric, 0)), 1) as score_medio,
  round(avg(nullif(r.score_face_mesh::numeric, 0)), 1) as score_medio_face_mesh,
  max(r.dt_evento) as ultimo_evento,
  max(r.created_at) filter (where r.rn = 1) as ultimo_created_at,
  max(r.veiculo) filter (where r.rn = 1) as ultima_descricao,
  max(r.categoria) filter (where r.rn = 1) as ultima_categoria,
  max(r.acao_prevista) filter (where r.rn = 1) as ultima_acao_prevista,
  max(r.qualidade_imagem_camera) filter (where r.rn = 1) as ultima_qualidade_camera,
  max(r.camera_enquadramento) filter (where r.rn = 1) as ultima_camera_enquadramento,
  max(r.camera_posicao_rosto) filter (where r.rn = 1) as ultima_camera_posicao,
  max(r.camera_area_rosto_percentual) filter (where r.rn = 1) as ultima_camera_area_rosto_percentual,
  max(coalesce(r.camera_recomendacao, r.recomendacao_camera)) filter (where r.rn = 1) as ultima_recomendacao_camera,
  max(r.descricao_profissional) filter (where r.rn = 1) as ultima_descricao_profissional,
  max(r.pontos_compativeis) filter (where r.rn = 1) as pontos_compativeis_ultimo,
  max(r.pontos_divergentes) filter (where r.rn = 1) as pontos_divergentes_ultimo,
  max(r.pontos_nao_visiveis) filter (where r.rn = 1) as pontos_nao_visiveis_ultimo,
  (
    count(*) filter (
      where
        coalesce(r.camera_enquadramento, '') in ('INADEQUADO', 'ERRO')
        or r.qualidade_camera_norm in ('RUIM', 'MEDIA')
        or coalesce(r.categoria, '') in ('SEM_PESSOA', 'INCONCLUSIVO', 'PESSOA_VISIVEL_DIFERENTE')
        or coalesce(r.acao_prevista, '') = 'Inconsistencia Tecnica'
    ) > 0
  ) as necessita_ajuste_camera,
  (
    count(*) filter (where coalesce(r.acao_prevista, '') = 'Inconsistencia Tecnica') * 4
    + count(*) filter (where coalesce(r.acao_prevista, '') = 'Confirmar Inconclusivo') * 3
    + count(*) filter (where coalesce(r.camera_enquadramento, '') in ('INADEQUADO', 'ERRO')) * 3
    + count(*) filter (where r.qualidade_camera_norm in ('RUIM', 'MEDIA')) * 2
    + count(*) filter (where coalesce(r.categoria, '') in ('SEM_PESSOA', 'INCONCLUSIVO', 'PESSOA_VISIVEL_DIFERENTE')) * 2
  )::bigint as prioridade_camera
from ranked r
group by r.prefixo_resolvido;

grant select on public.vw_monitoramento_inspecoes_veiculos to anon, authenticated;

commit;
