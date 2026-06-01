begin;

-- View que lista os lotes com contagens lancadas mas que ainda nao
-- foram apurados com sucesso pelo bot. Serve para o bot diario:
-- mesmo que a tentativa de workflow_dispatch do APK falhe, na proxima
-- rodada agendada o bot detecta o lote pelo view e processa.

create or replace view public.vw_suprimentos_lotes_pendentes as
with contagens_agrupadas as (
  select
    c.lote_id,
    coalesce(max(c.tipo_contagem), 'diaria') as tipo_contagem,
    min(c.created_at) as primeiro_registro,
    max(c.created_at) as ultimo_registro,
    count(*) as total_itens
  from public.suprimentos_contagens c
  where c.lote_id is not null
  group by c.lote_id
)
select
  ca.lote_id,
  ca.tipo_contagem,
  ca.primeiro_registro,
  ca.ultimo_registro,
  ca.total_itens,
  to_char(ca.ultimo_registro at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as data_alvo
from contagens_agrupadas ca
where not exists (
    select 1
    from public.suprimentos_bot_jobs j
    where j.lote_id = ca.lote_id
      and j.status = 'concluido'
  )
  and not exists (
    select 1
    from public.suprimentos_bot_jobs j
    where j.lote_id = ca.lote_id
      and j.status in ('pendente', 'processando')
  );

grant select on public.vw_suprimentos_lotes_pendentes to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
