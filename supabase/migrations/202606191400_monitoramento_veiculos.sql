begin;

drop view if exists public.vw_monitoramento_inspecoes_veiculos;
create or replace view public.vw_monitoramento_inspecoes_veiculos as
with base as (
  select
    b.*,
    row_number() over (
      partition by b.prefixo_resolvido
      order by b.created_at desc nulls last, b.id desc nulls last
    ) as rn
  from public.vw_monitoramento_inspecoes_base b
)
select
  b.prefixo_resolvido as prefixo,
  count(*)::bigint as total_laudos,
  count(*) filter (where b.acao_prevista = 'Confirmar Similaridade')::bigint as total_similaridade,
  count(*) filter (where b.acao_prevista = 'Confirmar Irregularidade')::bigint as total_irregularidade,
  count(*) filter (where b.acao_prevista = 'Confirmar Inconclusivo')::bigint as total_inconclusivo,
  count(*) filter (where b.acao_prevista = 'Inconsistencia Tecnica')::bigint as total_tecnica,
  coalesce(sum(coalesce(b.quantidade_rostos_camera, 0)), 0)::bigint as total_rostos_camera,
  round(avg(nullif(b.score::numeric, 0)), 1) as score_medio,
  round(avg(nullif(b.score_biometrico::numeric, 0)), 1) as score_medio_biometrico,
  round(avg(nullif(b.similaridade_arcface::numeric, 0)), 3) as score_medio_face_mesh,
  max(b.dt_evento) as ultimo_evento,
  max(b.created_at) filter (where b.rn = 1) as ultimo_created_at,
  max(b.acao_prevista) filter (where b.rn = 1) as ultima_acao_prevista,
  max(b.categoria) filter (where b.rn = 1) as ultima_categoria,
  max(b.veiculo) filter (where b.rn = 1) as ultima_descricao
from base b
group by b.prefixo_resolvido;

grant select on public.vw_monitoramento_inspecoes_veiculos to anon, authenticated;

commit;
