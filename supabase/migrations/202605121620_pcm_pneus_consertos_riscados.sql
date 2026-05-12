begin;

alter table public.pcm_estoque_pneus
  add column if not exists numero_fogo text;

update public.pcm_estoque_pneus
set numero_fogo = coalesce(nullif(numero_fogo, ''), numero_pneu)
where coalesce(numero_fogo, '') = '';

create table if not exists public.pcm_consertos_pneus (
  id uuid primary key default gen_random_uuid(),
  ficha_conserto text not null,
  origem_tab text,
  origem_item_id text,
  prefixo text,
  numero_fogo text not null,
  situacao_origem text,
  status text not null default 'PENDENTE',
  observacoes text,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  borracheiro_login text,
  borracheiro_nome text,
  borracheiro_id text,
  baixa_em timestamptz,
  baixa_por_login text,
  baixa_por_nome text,
  baixa_por_id text,
  baixa_observacoes text,
  notificacao_pendente boolean not null default true,
  notificacao_enviada_em timestamptz,
  origem text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_pcm_consertos_pneus_status
  on public.pcm_consertos_pneus (status, created_at desc);

create index if not exists idx_pcm_consertos_pneus_numero
  on public.pcm_consertos_pneus (numero_fogo);

alter table public.pcm_consertos_pneus enable row level security;

drop policy if exists "pcm_consertos_pneus_select" on public.pcm_consertos_pneus;
create policy "pcm_consertos_pneus_select"
on public.pcm_consertos_pneus
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_consertos_pneus_insert" on public.pcm_consertos_pneus;
create policy "pcm_consertos_pneus_insert"
on public.pcm_consertos_pneus
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_consertos_pneus_update" on public.pcm_consertos_pneus;
create policy "pcm_consertos_pneus_update"
on public.pcm_consertos_pneus
for update
to anon, authenticated
using (true)
with check (true);

create table if not exists public.pcm_riscados_pneus (
  id uuid primary key default gen_random_uuid(),
  ficha_riscado text not null,
  data_riscado date not null,
  prefixo text not null,
  numero_fogo text not null,
  marca text,
  status text not null default 'ABERTO',
  mm_antes numeric(10,2),
  mm_depois numeric(10,2),
  foto_path text,
  foto_url text,
  observacoes text,
  ultimo_alerta_ciclo integer not null default 0,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  origem text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_pcm_riscados_pneus_status
  on public.pcm_riscados_pneus (status, data_riscado desc);

create index if not exists idx_pcm_riscados_pneus_numero
  on public.pcm_riscados_pneus (numero_fogo);

alter table public.pcm_riscados_pneus enable row level security;

drop policy if exists "pcm_riscados_pneus_select" on public.pcm_riscados_pneus;
create policy "pcm_riscados_pneus_select"
on public.pcm_riscados_pneus
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_riscados_pneus_insert" on public.pcm_riscados_pneus;
create policy "pcm_riscados_pneus_insert"
on public.pcm_riscados_pneus
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_riscados_pneus_update" on public.pcm_riscados_pneus;
create policy "pcm_riscados_pneus_update"
on public.pcm_riscados_pneus
for update
to anon, authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
select 'pcm_riscados_pneus', 'pcm_riscados_pneus', true
where not exists (
  select 1
  from storage.buckets
  where id = 'pcm_riscados_pneus'
);

drop policy if exists "pcm_riscados_pneus_storage_select" on storage.objects;
create policy "pcm_riscados_pneus_storage_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'pcm_riscados_pneus');

drop policy if exists "pcm_riscados_pneus_storage_insert" on storage.objects;
create policy "pcm_riscados_pneus_storage_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'pcm_riscados_pneus');

drop policy if exists "pcm_riscados_pneus_storage_update" on storage.objects;
create policy "pcm_riscados_pneus_storage_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'pcm_riscados_pneus')
with check (bucket_id = 'pcm_riscados_pneus');

commit;
