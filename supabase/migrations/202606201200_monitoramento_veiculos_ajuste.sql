begin;

drop view if exists public.vw_monitoramento_inspecoes_veiculos;
create or replace view public.vw_monitoramento_inspecoes_veiculos as
with base as (
  select
    b.*,
    row_number() over (
      partition by b.prefixo_resolvido
      order by b.created_at desc nulls last, b.id desc nulls last
    ) as rn_prefixo,
    upper(trim(coalesce(b.qualidade_imagem_camera, ''))) as qualidade_camera_norm,
    upper(trim(coalesce(b.camera_enquadramento, ''))) as enquadramento_camera_norm,
    upper(trim(coalesce(b.acao_prevista, ''))) as acao_prevista_norm,
    upper(trim(coalesce(b.categoria, ''))) as categoria_norm,
    coalesce(
      (regexp_match(coalesce(b.camera_posicao_rosto, ''), '(?i)x\s*=\s*([0-9]+(?:\.[0-9]+)?)'))[1]::numeric,
      null
    ) as camera_posicao_x,
    coalesce(
      (regexp_match(coalesce(b.camera_posicao_rosto, ''), '(?i)y\s*=\s*([0-9]+(?:\.[0-9]+)?)'))[1]::numeric,
      null
    ) as camera_posicao_y
  from public.vw_monitoramento_inspecoes_base b
),
recortes as (
  select *
  from base
  where rn_prefixo <= 200
),
agregado as (
  select
    r.prefixo_resolvido as prefixo,
    count(*)::bigint as total_laudos,
    count(*) filter (
      where
        r.enquadramento_camera_norm in ('INADEQUADO', 'ERRO')
        or r.qualidade_camera_norm in ('RUIM', 'MEDIA')
        or r.acao_prevista_norm = 'INCONSISTENCIA TECNICA'
        or r.categoria_norm in ('SEM_PESSOA', 'INCONCLUSIVO', 'PESSOA_VISIVEL_DIFERENTE')
        or (r.camera_area_rosto_percentual is not null and r.camera_area_rosto_percentual < 7)
        or (r.camera_posicao_x is not null and (r.camera_posicao_x < 0.35 or r.camera_posicao_x > 0.65))
        or (r.camera_posicao_y is not null and (r.camera_posicao_y < 0.35 or r.camera_posicao_y > 0.65))
    )::bigint as total_com_problema_camera,
    count(*) filter (where r.camera_posicao_y is not null and r.camera_posicao_y > 0.65)::bigint as total_rosto_muito_abaixo,
    count(*) filter (where r.camera_posicao_y is not null and r.camera_posicao_y < 0.35)::bigint as total_rosto_muito_acima,
    count(*) filter (where r.camera_posicao_x is not null and r.camera_posicao_x < 0.35)::bigint as total_rosto_muito_esquerda,
    count(*) filter (where r.camera_posicao_x is not null and r.camera_posicao_x > 0.65)::bigint as total_rosto_muito_direita,
    count(*) filter (where r.enquadramento_camera_norm in ('INADEQUADO', 'ERRO'))::bigint as total_enquadramento_ruim,
    count(*) filter (where r.qualidade_camera_norm in ('RUIM', 'MEDIA'))::bigint as total_qualidade_ruim,
    count(*) filter (where r.camera_area_rosto_percentual is not null and r.camera_area_rosto_percentual < 7)::bigint as total_area_pequena,
    count(*) filter (where r.acao_prevista_norm = 'INCONSISTENCIA TECNICA')::bigint as total_tecnica,
    count(*) filter (where r.acao_prevista_norm = 'CONFIRMAR INCONCLUSIVO' or r.categoria_norm = 'INCONCLUSIVO')::bigint as total_inconclusivo,
    round(avg(nullif(r.score::numeric, 0)), 1) as score_medio,
    round(avg(nullif(r.score_face_mesh::numeric, 0)), 1) as score_medio_face_mesh,
    max(r.dt_evento) as ultimo_evento,
    max(r.created_at) filter (where r.rn_prefixo = 1) as ultimo_created_at,
    max(r.veiculo) filter (where r.rn_prefixo = 1) as ultima_descricao,
    max(r.categoria) filter (where r.rn_prefixo = 1) as ultima_categoria,
    max(r.acao_prevista) filter (where r.rn_prefixo = 1) as ultima_acao_prevista,
    max(r.qualidade_imagem_camera) filter (where r.rn_prefixo = 1) as ultima_qualidade_camera,
    max(r.camera_enquadramento) filter (where r.rn_prefixo = 1) as ultima_camera_enquadramento,
    max(r.camera_posicao_rosto) filter (where r.rn_prefixo = 1) as ultima_camera_posicao,
    max(r.camera_area_rosto_percentual) filter (where r.rn_prefixo = 1) as ultima_camera_area_rosto_percentual,
    max(coalesce(r.camera_recomendacao, r.recomendacao_camera)) filter (where r.rn_prefixo = 1) as ultima_recomendacao_camera,
    max(r.descricao_profissional) filter (where r.rn_prefixo = 1) as ultima_descricao_profissional
  from recortes r
  group by r.prefixo_resolvido
),
rotulado as (
  select
    a.*,
    case
      when a.total_laudos = 0 then 'sem dados'
      when a.total_tecnica >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo) and a.total_tecnica > 0 then 'inconsistencia tecnica'
      when a.total_rosto_muito_abaixo >= greatest(a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_abaixo > 0 then 'rostos muito embaixo'
      when a.total_rosto_muito_acima >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_acima > 0 then 'rostos muito em cima'
      when a.total_rosto_muito_esquerda >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_esquerda > 0 then 'rostos muito à esquerda'
      when a.total_rosto_muito_direita >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_direita > 0 then 'rostos muito à direita'
      when a.total_enquadramento_ruim >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_enquadramento_ruim > 0 then 'enquadramento inadequado'
      when a.total_qualidade_ruim >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_qualidade_ruim > 0 then 'imagem ruim'
      when a.total_area_pequena >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_inconclusivo, a.total_tecnica) and a.total_area_pequena > 0 then 'rosto pequeno no enquadramento'
      when a.total_inconclusivo > 0 then 'muitos inconclusivos'
      else 'sem ajuste claro'
    end as problema_principal,
    case
      when a.total_laudos = 0 then 'sem dados'
      when a.total_tecnica >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo) and a.total_tecnica > 0 then 'verificar captura / processamento'
      when a.total_rosto_muito_abaixo >= greatest(a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_abaixo > 0 then 'abaixar camera'
      when a.total_rosto_muito_acima >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_acima > 0 then 'subir camera'
      when a.total_rosto_muito_esquerda >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_esquerda > 0 then 'mover camera para a esquerda'
      when a.total_rosto_muito_direita >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_rosto_muito_direita > 0 then 'mover camera para a direita'
      when a.total_enquadramento_ruim >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_qualidade_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_enquadramento_ruim > 0 then 'rever inclinacao / posicao da camera'
      when a.total_qualidade_ruim >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_area_pequena, a.total_inconclusivo, a.total_tecnica) and a.total_qualidade_ruim > 0 then 'revisar iluminacao'
      when a.total_area_pequena >= greatest(a.total_rosto_muito_abaixo, a.total_rosto_muito_acima, a.total_rosto_muito_esquerda, a.total_rosto_muito_direita, a.total_enquadramento_ruim, a.total_qualidade_ruim, a.total_inconclusivo, a.total_tecnica) and a.total_area_pequena > 0 then 'aproximar camera / ajustar enquadramento'
      when a.total_inconclusivo > 0 then 'revisar enquadramento da captura'
      else coalesce(nullif(a.ultima_recomendacao_camera, ''), 'sem acao clara')
    end as acao_sugerida
  from agregado a
)
select
  r.prefixo,
  r.total_laudos,
  r.total_com_problema_camera,
  r.total_rosto_muito_abaixo,
  r.total_rosto_muito_acima,
  r.total_rosto_muito_esquerda,
  r.total_rosto_muito_direita,
  r.total_enquadramento_ruim,
  r.total_qualidade_ruim,
  r.total_area_pequena,
  r.total_inconclusivo,
  r.total_tecnica,
  r.score_medio,
  r.score_medio_face_mesh,
  r.ultimo_evento,
  r.ultimo_created_at,
  r.ultima_descricao,
  r.ultima_categoria,
  r.ultima_acao_prevista,
  r.ultima_qualidade_camera,
  r.ultima_camera_enquadramento,
  r.ultima_camera_posicao,
  r.ultima_camera_area_rosto_percentual,
  r.ultima_recomendacao_camera,
  r.ultima_descricao_profissional,
  r.problema_principal,
  r.acao_sugerida,
  (
    r.total_tecnica * 100
    + r.total_rosto_muito_abaixo * 80
    + r.total_rosto_muito_acima * 80
    + r.total_rosto_muito_esquerda * 70
    + r.total_rosto_muito_direita * 70
    + r.total_enquadramento_ruim * 90
    + r.total_qualidade_ruim * 60
    + r.total_area_pequena * 50
    + r.total_inconclusivo * 40
  )::bigint as prioridade_camera,
  (r.total_com_problema_camera > 0 or r.total_tecnica > 0) as necessita_ajuste_camera
from rotulado r
order by prioridade_camera desc, total_com_problema_camera desc, total_laudos desc, prefixo;

grant select on public.vw_monitoramento_inspecoes_veiculos to anon, authenticated;

commit;
