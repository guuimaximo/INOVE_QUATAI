-- Atualiza vw_suprimentos_lotes_pendentes para:
--   1) Capturar lotes legacy sem lote_id (agrupados por dia + tipo_contagem)
--   2) Re-enfileirar lote que ja' teve job 'erro' (antes ficava na fila eternamente)
--   3) Re-enfileirar quando novas contagens forem adicionadas DEPOIS do ultimo
--      job 'concluido' (resolve "bot rodou cedo, usuario continuou contando")
--
-- Criterio final: lote pendente =
--   - tem alguma contagem com saldo_erp ainda nulo (n. processada), E
--   - NAO ha job 'pendente'/'processando' atual pra ele, E
--   - NAO ha job 'concluido' que tenha rodado APOS o ultimo registro do lote.

begin;

-- View tem reorder de colunas: precisa drop antes de re-criar.
drop view if exists public.vw_suprimentos_lotes_pendentes;

create view public.vw_suprimentos_lotes_pendentes as
with grupos as (
  select
    c.lote_id,
    coalesce(c.tipo_contagem, 'diaria') as tipo_contagem,
    (c.created_at at time zone 'America/Sao_Paulo')::date as data_alvo,
    min(c.created_at) as primeiro_registro,
    max(c.created_at) as ultimo_registro,
    count(*) as total_itens,
    count(*) filter (where c.saldo_erp is null) as nao_processados
  from public.suprimentos_contagens c
  group by
    c.lote_id,
    coalesce(c.tipo_contagem, 'diaria'),
    (c.created_at at time zone 'America/Sao_Paulo')::date
)
select
  g.lote_id,
  g.tipo_contagem,
  g.data_alvo,
  g.primeiro_registro,
  g.ultimo_registro,
  g.total_itens,
  g.nao_processados
from grupos g
where g.nao_processados > 0
  and not exists (
    select 1
    from public.suprimentos_bot_jobs j
    where (
      (j.lote_id is not null and j.lote_id = g.lote_id)
      or (
        j.lote_id is null and g.lote_id is null
        and j.data_alvo = g.data_alvo
        and coalesce(j.tipo_contagem, 'diaria') = g.tipo_contagem
      )
    )
    and j.status in ('pendente', 'processando')
  )
  and not exists (
    select 1
    from public.suprimentos_bot_jobs j
    where (
      (j.lote_id is not null and j.lote_id = g.lote_id)
      or (
        j.lote_id is null and g.lote_id is null
        and j.data_alvo = g.data_alvo
        and coalesce(j.tipo_contagem, 'diaria') = g.tipo_contagem
      )
    )
    and j.status = 'concluido'
    and j.concluido_em > g.ultimo_registro
  );

grant select on public.vw_suprimentos_lotes_pendentes to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
