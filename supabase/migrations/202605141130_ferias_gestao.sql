create table if not exists public.ferias_periodos_importados (
  id uuid primary key default gen_random_uuid(),
  ferias_id text not null unique,
  funcionario_id text,
  nr_cracha text,
  nm_funcionario text not null,
  nm_funcao text,
  dt_inicio_aquisitivo date,
  dt_fim_aquisitivo date,
  dt_alerta_11_meses date,
  dt_limite_legal date,
  dias_para_limite_legal integer,
  qt_dias_ferias integer,
  dias_realizados integer,
  dias_em_andamento integer,
  dias_agendados integer,
  dias_total_programado integer,
  dias_pendentes_total integer,
  dias_pendentes_realizados integer,
  status_periodo text,
  possui_saldo_pendente boolean not null default false,
  status_realizacao text,
  status_agendamento text,
  qtd_periodos_gozo integer,
  qtd_gozos_realizados integer,
  qtd_gozos_em_andamento integer,
  qtd_gozos_agendados integer,
  ultimo_inicio_gozo_realizado date,
  ultimo_fim_gozo_realizado date,
  proximo_inicio_gozo date,
  proximo_fim_gozo date,
  cs_situacao_ferias text,
  nr_faltas integer,
  historico_gozos text,
  ativo boolean not null default true,
  arquivo_lote text,
  fonte_arquivo text,
  importado_por_login text,
  importado_por_nome text,
  importado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_ferias_periodos_status on public.ferias_periodos_importados (ativo, status_periodo);
create index if not exists idx_ferias_periodos_limite on public.ferias_periodos_importados (ativo, dt_limite_legal);
create index if not exists idx_ferias_periodos_funcionario on public.ferias_periodos_importados (funcionario_id, nr_cracha);

create table if not exists public.ferias_planejamento (
  id uuid primary key default gen_random_uuid(),
  ferias_id text not null unique references public.ferias_periodos_importados (ferias_id) on delete cascade,
  funcionario_id text,
  funcionario_cracha text,
  nome text,
  funcao text,
  area_codigo text,
  area_titulo text,
  janela_sugerida_inicio date,
  janela_sugerida_fim date,
  programado_inicio date,
  programado_fim date,
  status_planejamento text not null default 'ANALISAR',
  prioridade text not null default 'MEDIA',
  observacoes text,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  atualizado_por_login text,
  atualizado_por_nome text,
  atualizado_por_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_ferias_planejamento_status on public.ferias_planejamento (status_planejamento, prioridade);
create index if not exists idx_ferias_planejamento_area on public.ferias_planejamento (area_codigo, programado_inicio);

alter table public.ferias_periodos_importados enable row level security;
alter table public.ferias_planejamento enable row level security;

grant select, insert, update, delete on public.ferias_periodos_importados to anon, authenticated;
grant select, insert, update, delete on public.ferias_planejamento to anon, authenticated;

drop policy if exists "ferias_periodos_select" on public.ferias_periodos_importados;
create policy "ferias_periodos_select" on public.ferias_periodos_importados
for select
to anon, authenticated
using (true);

drop policy if exists "ferias_periodos_insert" on public.ferias_periodos_importados;
create policy "ferias_periodos_insert" on public.ferias_periodos_importados
for insert
to anon, authenticated
with check (true);

drop policy if exists "ferias_periodos_update" on public.ferias_periodos_importados;
create policy "ferias_periodos_update" on public.ferias_periodos_importados
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "ferias_periodos_delete" on public.ferias_periodos_importados;
create policy "ferias_periodos_delete" on public.ferias_periodos_importados
for delete
to anon, authenticated
using (true);

drop policy if exists "ferias_planejamento_select" on public.ferias_planejamento;
create policy "ferias_planejamento_select" on public.ferias_planejamento
for select
to anon, authenticated
using (true);

drop policy if exists "ferias_planejamento_insert" on public.ferias_planejamento;
create policy "ferias_planejamento_insert" on public.ferias_planejamento
for insert
to anon, authenticated
with check (true);

drop policy if exists "ferias_planejamento_update" on public.ferias_planejamento;
create policy "ferias_planejamento_update" on public.ferias_planejamento
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "ferias_planejamento_delete" on public.ferias_planejamento;
create policy "ferias_planejamento_delete" on public.ferias_planejamento
for delete
to anon, authenticated
using (true);

notify pgrst, 'reload schema';
