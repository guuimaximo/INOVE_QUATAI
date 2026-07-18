-- ============================================================================
-- ⚠️ RODAR NO SUPABASE A — project ref `ubppprgquekozluvsloo` (IMPORTACAO_DADOS),
-- o mesmo de ultimo_plano / indicadores_diesel. NAO e o projeto deste repo
-- (INOVE = `wboelthngddvkgrvwkbu`). Por isso este script fica em `manual/` e
-- nao em `migrations/`: um `supabase db push` aplicaria no banco errado.
--
-- Tabela preventivas_acuracidade_hist.
--
-- Aplicado em 18/07/2026 (tabela, indice, view e policy ja existem em prod).
--
-- Histórico diário da acuracidade do plano preventivo. Como a ultimo_plano é
-- um snapshot que se substitui inteiro a cada importação (sem histórico), esta
-- tabela guarda o número de cada dia para permitir o FECHAMENTO POR MÊS
-- (= linha do último dia do mês) e a evolução intra-mês.
--
-- O workflow do Flash Report faz UPSERT de uma linha por data_ref a cada
-- execução (grava/atualiza o dia corrente). Rode este script UMA VEZ no
-- SQL Editor do Supabase.
-- ============================================================================

create table if not exists public.preventivas_acuracidade_hist (
  data_ref         date primary key,           -- dia de referência do snapshot
  total_planos     integer not null,           -- planos ativos in-house (sem concessionária)
  em_dia           integer not null,           -- planos dentro do prazo
  vencidos         integer not null,           -- planos vencidos (km >= 0 ou dias > 0)
  vencidos_km      integer,                     -- vencidos por km
  vencidos_tempo   integer,                     -- vencidos por tempo (TCO)
  acuracidade_pct  numeric(5,2) not null,       -- em_dia / total * 100
  atualizado_em    timestamptz not null default now()
);

-- O cast p/ timestamp é obrigatório: com `data_ref` (date) puro, o Postgres
-- resolve para date_trunc(text, timestamptz), que é STABLE — e expressão de
-- índice exige IMMUTABLE (erro 42P17). A variante (text, timestamp) é immutable.
create index if not exists idx_acuracidade_hist_mes
  on public.preventivas_acuracidade_hist (date_trunc('month', data_ref::timestamp));

alter table public.preventivas_acuracidade_hist enable row level security;
drop policy if exists "anon read acuracidade_hist" on public.preventivas_acuracidade_hist;
create policy "anon read acuracidade_hist" on public.preventivas_acuracidade_hist
  for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Fechamento por mês (view auxiliar): pega o snapshot do último dia de cada mês.
-- ---------------------------------------------------------------------------
create or replace view public.vw_acuracidade_mensal as
select distinct on (date_trunc('month', data_ref))
       date_trunc('month', data_ref)::date as mes,
       data_ref                            as data_fechamento,
       total_planos,
       em_dia,
       vencidos,
       acuracidade_pct
from public.preventivas_acuracidade_hist
order by date_trunc('month', data_ref), data_ref desc;
