-- Estoque das peças (localização, mínimo, máximo, referência fabricante)
alter table public.suprimentos_pecas
  add column if not exists localizacao    text,
  add column if not exists estoque_min    numeric,
  add column if not exists estoque_max    numeric,
  add column if not exists ref_fabricante text,
  add column if not exists saldo_erp      numeric,
  add column if not exists pmu            numeric,
  add column if not exists almoxarifado   text,
  add column if not exists erp_sync_em    timestamptz;

create index if not exists suppecas_localizacao_idx on public.suprimentos_pecas (localizacao);

-- Contagem de itens (registros soltos por usuário)
create table if not exists public.suprimentos_contagens (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid references public.suprimentos_pecas(id) on delete set null,
  codigo text,
  descricao text,
  localizacao text,
  unidade text,
  quantidade numeric not null,
  saldo_erp numeric,
  diferenca numeric,
  observacao text,
  contado_por_id integer,
  contado_por_login text,
  contado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists supcontagens_codigo_idx on public.suprimentos_contagens (codigo);
create index if not exists supcontagens_created_at_idx on public.suprimentos_contagens (created_at desc);

alter table public.suprimentos_contagens enable row level security;
drop policy if exists "supcontagens_select" on public.suprimentos_contagens;
create policy "supcontagens_select" on public.suprimentos_contagens for select to anon, authenticated using (true);
drop policy if exists "supcontagens_insert" on public.suprimentos_contagens;
create policy "supcontagens_insert" on public.suprimentos_contagens for insert to anon, authenticated with check (true);
drop policy if exists "supcontagens_update" on public.suprimentos_contagens;
create policy "supcontagens_update" on public.suprimentos_contagens for update to anon, authenticated using (true) with check (true);
drop policy if exists "supcontagens_delete" on public.suprimentos_contagens;
create policy "supcontagens_delete" on public.suprimentos_contagens for delete to anon, authenticated using (true);
