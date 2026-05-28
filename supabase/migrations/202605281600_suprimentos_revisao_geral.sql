-- ============================================================
-- INOVE Suprimentos — revisão geral de schema
-- Adiciona colunas que o código usa mas que ainda não tinham migration.
-- Idempotente (pode rodar várias vezes).
-- ============================================================

-- ─── suprimentos_contagens ─────────────────────────────────
-- tipo: separar Diária / Semanal / Lubrificantes
-- origem: saber se veio do mobile (Capacitor) ou da web (PWA)
-- workflow_disparado_em: marcador para o lote saber se já foi enfileirado no GH Actions
alter table public.suprimentos_contagens
  add column if not exists tipo_contagem text not null default 'diaria',
  add column if not exists origem text,
  add column if not exists workflow_disparado_em timestamptz;

-- Tipo só aceita os 3 valores conhecidos
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'supcontagens_tipo_chk'
  ) then
    alter table public.suprimentos_contagens
      add constraint supcontagens_tipo_chk
      check (tipo_contagem in ('diaria','semanal','lubrificantes'));
  end if;
end $$;

create index if not exists supcontagens_tipo_idx on public.suprimentos_contagens (tipo_contagem);
create index if not exists supcontagens_data_idx on public.suprimentos_contagens ((created_at::date) desc);

-- ─── suprimentos_servico_externo ───────────────────────────
-- usadas no código (aba "Retorno" -> aprovado + valor aprovado)
alter table public.suprimentos_servico_externo
  add column if not exists servico_aprovado boolean,
  add column if not exists valor_aprovado   numeric;

-- ─── suprimentos_se_movimentacoes ─────────────────────────
-- usadas no código (valor / qtd_retornada)
alter table public.suprimentos_se_movimentacoes
  add column if not exists valor          numeric,
  add column if not exists qtd_retornada  numeric;

-- ─── suprimentos_bot_jobs ──────────────────────────────────
-- novo: tipo_contagem para saber qual lote está sendo conferido
alter table public.suprimentos_bot_jobs
  add column if not exists tipo_contagem text not null default 'diaria';

create index if not exists supbotjobs_data_tipo_idx
  on public.suprimentos_bot_jobs (data_alvo, tipo_contagem, status);

-- ─── suprimentos_pecas ─────────────────────────────────────
-- Flag de "é lubrificante" (deriva por grupo ou marca manual)
alter table public.suprimentos_pecas
  add column if not exists is_lubrificante boolean not null default false,
  add column if not exists grupo text,
  add column if not exists subgrupo text;

create index if not exists suppecas_lubrificante_idx
  on public.suprimentos_pecas (is_lubrificante) where is_lubrificante = true;
create index if not exists suppecas_grupo_idx on public.suprimentos_pecas (grupo);

-- ─── suprimentos_auditorias ────────────────────────────────
-- aceitar 'lubrificantes' também no check
do $$
begin
  alter table public.suprimentos_auditorias drop constraint if exists suprimentos_auditorias_tipo_check;
  alter table public.suprimentos_auditorias
    add constraint suprimentos_auditorias_tipo_check
    check (tipo in ('diaria','semanal','lubrificantes'));
exception when undefined_table then null;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- Vista útil pra dashboard: lotes de contagem com acurácia
-- (contagens conferidas com saldo_erp not null, sem_cadastro nao
-- entram no denominador da acurácia)
-- ============================================================
create or replace view public.v_suprimentos_lotes as
select
  (created_at at time zone 'America/Sao_Paulo')::date as data,
  tipo_contagem,
  count(*) as total,
  count(*) filter (where peca_id is null) as sem_cadastro,
  count(*) filter (where saldo_erp is not null) as conferidos,
  count(*) filter (where saldo_erp is not null and abs(coalesce(diferenca,0)) < 0.000001) as corretos,
  count(*) filter (where saldo_erp is not null and abs(coalesce(diferenca,0)) >= 0.000001) as divergentes,
  case
    when count(*) filter (where saldo_erp is not null) = 0 then null
    else round(
      100.0 * count(*) filter (where saldo_erp is not null and abs(coalesce(diferenca,0)) < 0.000001)
            / count(*) filter (where saldo_erp is not null),
    2)
  end as acuracidade_pct,
  count(distinct contado_por_nome) as contadores_distintos,
  max(created_at) as ultimo_apontamento
from public.suprimentos_contagens
group by 1, 2
order by data desc, tipo_contagem;
