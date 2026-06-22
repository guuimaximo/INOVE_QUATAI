begin;

-- =====================================================================
-- INSIGHTS DO MONITORAMENTO
-- Views agregadas sobre vision_inspecoes para a tela de Insights.
-- Evita varrer o banco no cliente e considera TODO o historico.
-- Classificacao de acao:
--   irregularidade = acao 'CONFIRMAR IRREGULARIDADE' ou categoria PESSOA_VISIVEL_DIFERENTE
--   similaridade   = acao 'CONFIRMAR SIMILARIDADE'   ou categoria PESSOA_VISIVEL_SIMILAR
--   inconclusivo   = acao 'CONFIRMAR INCONCLUSIVO'   ou categoria INCONCLUSIVO
--   tecnica        = acao 'INCONSISTENCIA TECNICA'
-- =====================================================================

-- 1) Resumo por TIPO DE CARTAO -----------------------------------------
drop view if exists public.vw_monitoramento_cartoes;
create or replace view public.vw_monitoramento_cartoes as
with base as (
  select
    coalesce(nullif(btrim(vi.tipo_cartao), ''), 'Nao informado') as tipo_cartao,
    upper(btrim(coalesce(vi.acao_prevista, ''))) as acao_norm,
    upper(btrim(coalesce(vi.categoria, ''))) as cat_norm,
    vi.codigo_cartao
  from public.vision_inspecoes vi
)
select
  b.tipo_cartao,
  count(*)::bigint as total_laudos,
  count(*) filter (where b.acao_norm = 'CONFIRMAR IRREGULARIDADE' or b.cat_norm = 'PESSOA_VISIVEL_DIFERENTE')::bigint as total_irregularidade,
  count(*) filter (where b.acao_norm = 'CONFIRMAR SIMILARIDADE' or b.cat_norm = 'PESSOA_VISIVEL_SIMILAR')::bigint as total_similaridade,
  count(*) filter (where b.acao_norm = 'CONFIRMAR INCONCLUSIVO' or b.cat_norm = 'INCONCLUSIVO')::bigint as total_inconclusivo,
  count(*) filter (where b.acao_norm = 'INCONSISTENCIA TECNICA')::bigint as total_tecnica,
  count(distinct b.codigo_cartao)::bigint as cartoes_distintos,
  round(
    (count(*) filter (where b.acao_norm = 'CONFIRMAR IRREGULARIDADE' or b.cat_norm = 'PESSOA_VISIVEL_DIFERENTE')::numeric * 100)
    / nullif(count(*), 0), 1
  ) as taxa_fraude
from base b
group by b.tipo_cartao
order by total_irregularidade desc, taxa_fraude desc nulls last;

grant select on public.vw_monitoramento_cartoes to anon, authenticated;

-- 2) Fraude por MES ----------------------------------------------------
drop view if exists public.vw_monitoramento_fraude_mensal;
create or replace view public.vw_monitoramento_fraude_mensal as
with base as (
  select
    public.monitoramento_event_date(vi.data_hora_evento, vi.created_at) as dt_evento,
    upper(btrim(coalesce(vi.acao_prevista, ''))) as acao_norm,
    upper(btrim(coalesce(vi.categoria, ''))) as cat_norm
  from public.vision_inspecoes vi
)
select
  to_char(date_trunc('month', b.dt_evento), 'YYYY-MM') as mes,
  count(*)::bigint as total_laudos,
  count(*) filter (where b.acao_norm = 'CONFIRMAR SIMILARIDADE' or b.cat_norm = 'PESSOA_VISIVEL_SIMILAR')::bigint as total_similaridade,
  count(*) filter (where b.acao_norm = 'CONFIRMAR IRREGULARIDADE' or b.cat_norm = 'PESSOA_VISIVEL_DIFERENTE')::bigint as total_irregularidade,
  count(*) filter (where b.acao_norm = 'CONFIRMAR INCONCLUSIVO' or b.cat_norm = 'INCONCLUSIVO')::bigint as total_inconclusivo,
  count(*) filter (where b.acao_norm = 'INCONSISTENCIA TECNICA')::bigint as total_tecnica
from base b
where b.dt_evento is not null
group by date_trunc('month', b.dt_evento)
order by date_trunc('month', b.dt_evento);

grant select on public.vw_monitoramento_fraude_mensal to anon, authenticated;

-- 3) Fraude por HORARIO do dia ----------------------------------------
drop view if exists public.vw_monitoramento_fraude_horario;
create or replace view public.vw_monitoramento_fraude_horario as
with base as (
  select
    case
      when vi.data_hora_evento ~ '[0-9]{2}/[0-9]{2}/[0-9]{4}\s+[0-9]{2}'
        then (substring(vi.data_hora_evento from '\s+([0-9]{2}):'))::int
      when vi.created_at is not null
        then extract(hour from vi.created_at)::int
      else null
    end as hora,
    upper(btrim(coalesce(vi.acao_prevista, ''))) as acao_norm,
    upper(btrim(coalesce(vi.categoria, ''))) as cat_norm
  from public.vision_inspecoes vi
)
select
  h.hora,
  count(*)::bigint as total_laudos,
  count(*) filter (where b.acao_norm = 'CONFIRMAR IRREGULARIDADE' or b.cat_norm = 'PESSOA_VISIVEL_DIFERENTE')::bigint as total_irregularidade
from generate_series(0, 23) as h(hora)
left join base b on b.hora = h.hora
group by h.hora
order by h.hora;

grant select on public.vw_monitoramento_fraude_horario to anon, authenticated;

-- 4) Cartoes REINCIDENTES (2+ irregularidades) ------------------------
drop view if exists public.vw_monitoramento_cartoes_reincidentes;
create or replace view public.vw_monitoramento_cartoes_reincidentes as
with irregulares as (
  select
    vi.codigo_cartao,
    vi.nome,
    vi.tipo_cartao,
    vi.created_at
  from public.vision_inspecoes vi
  where vi.codigo_cartao is not null
    and (
      upper(btrim(coalesce(vi.acao_prevista, ''))) = 'CONFIRMAR IRREGULARIDADE'
      or upper(btrim(coalesce(vi.categoria, ''))) = 'PESSOA_VISIVEL_DIFERENTE'
    )
)
select
  i.codigo_cartao,
  count(*)::bigint as ocorrencias,
  max(i.nome) as ultimo_nome,
  max(i.tipo_cartao) as tipo_cartao,
  max(i.created_at) as ultima_ocorrencia
from irregulares i
group by i.codigo_cartao
having count(*) >= 2
order by ocorrencias desc, ultima_ocorrencia desc;

grant select on public.vw_monitoramento_cartoes_reincidentes to anon, authenticated;

commit;
