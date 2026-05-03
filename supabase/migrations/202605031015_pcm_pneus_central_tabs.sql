alter table public.pcm_troca_pneus
  add column if not exists transnet_lancado_em timestamptz,
  add column if not exists transnet_lancado_por_login text,
  add column if not exists transnet_lancado_por_nome text,
  add column if not exists transnet_lancado_por_id text;

create table if not exists public.pcm_auditoria_pneus (
  id uuid primary key default gen_random_uuid(),
  ficha_auditoria text not null,
  prefixo text not null,
  posicoes jsonb not null default '[]'::jsonb,
  observacoes text,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  origem text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.pcm_estoque_pneus (
  id uuid primary key default gen_random_uuid(),
  ficha_estoque text not null,
  numero_pneu text not null,
  marca text not null,
  situacao text not null,
  observacoes text,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  origem text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.pcm_auditoria_pneus enable row level security;
alter table public.pcm_estoque_pneus enable row level security;

drop policy if exists "pcm_auditoria_pneus_select" on public.pcm_auditoria_pneus;
create policy "pcm_auditoria_pneus_select"
on public.pcm_auditoria_pneus
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_auditoria_pneus_insert" on public.pcm_auditoria_pneus;
create policy "pcm_auditoria_pneus_insert"
on public.pcm_auditoria_pneus
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_auditoria_pneus_update" on public.pcm_auditoria_pneus;
create policy "pcm_auditoria_pneus_update"
on public.pcm_auditoria_pneus
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pcm_estoque_pneus_select" on public.pcm_estoque_pneus;
create policy "pcm_estoque_pneus_select"
on public.pcm_estoque_pneus
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_estoque_pneus_insert" on public.pcm_estoque_pneus;
create policy "pcm_estoque_pneus_insert"
on public.pcm_estoque_pneus
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_estoque_pneus_update" on public.pcm_estoque_pneus;
create policy "pcm_estoque_pneus_update"
on public.pcm_estoque_pneus
for update
to anon, authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
select 'pcm_auditoria_pneus', 'pcm_auditoria_pneus', true
where not exists (
  select 1
  from storage.buckets
  where id = 'pcm_auditoria_pneus'
);

drop policy if exists "pcm_auditoria_pneus_storage_select" on storage.objects;
create policy "pcm_auditoria_pneus_storage_select"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'pcm_auditoria_pneus');

drop policy if exists "pcm_auditoria_pneus_storage_insert" on storage.objects;
create policy "pcm_auditoria_pneus_storage_insert"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'pcm_auditoria_pneus');

drop policy if exists "pcm_auditoria_pneus_storage_update" on storage.objects;
create policy "pcm_auditoria_pneus_storage_update"
on storage.objects
for update
to anon, authenticated
using (bucket_id = 'pcm_auditoria_pneus')
with check (bucket_id = 'pcm_auditoria_pneus');
