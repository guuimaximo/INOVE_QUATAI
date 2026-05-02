create table if not exists public.pcm_troca_pneus (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc'::text, now()),
  prefixo text not null,
  ficha_troca text not null,
  posicao text not null check (
    posicao in (
      'DIANTEIRO DIREITO',
      'DIANTEIRO ESQUERDO',
      'TRASEIRO INTERNO DIREITO',
      'TRASEIRO INTERNO ESQUERDO',
      'TRASEIRO EXTERNO DIREITO',
      'TRASEIRO EXTERNO ESQUERDO'
    )
  ),
  pneu_retirado_descricao text not null,
  pneu_colocado_descricao text not null,
  observacoes text,
  foto_fogo_retirado_path text not null,
  foto_fogo_retirado_url text not null,
  foto_pneu_retirado_path text not null,
  foto_pneu_retirado_url text not null,
  foto_fogo_colocado_path text not null,
  foto_fogo_colocado_url text not null,
  foto_pneu_colocado_path text not null,
  foto_pneu_colocado_url text not null,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  origem text not null default 'INOVE_WEB_APP',
  status text not null default 'REGISTRADA'
);

create index if not exists idx_pcm_troca_pneus_created_at
  on public.pcm_troca_pneus (created_at desc);

create index if not exists idx_pcm_troca_pneus_prefixo
  on public.pcm_troca_pneus (prefixo);

create index if not exists idx_pcm_troca_pneus_ficha_troca
  on public.pcm_troca_pneus (ficha_troca);

alter table public.pcm_troca_pneus enable row level security;

grant select, insert, update on public.pcm_troca_pneus to anon, authenticated;

drop policy if exists "pcm_troca_pneus_select" on public.pcm_troca_pneus;
create policy "pcm_troca_pneus_select"
  on public.pcm_troca_pneus
  for select
  to anon, authenticated
  using (true);

drop policy if exists "pcm_troca_pneus_insert" on public.pcm_troca_pneus;
create policy "pcm_troca_pneus_insert"
  on public.pcm_troca_pneus
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "pcm_troca_pneus_update" on public.pcm_troca_pneus;
create policy "pcm_troca_pneus_update"
  on public.pcm_troca_pneus
  for update
  to anon, authenticated
  using (true)
  with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pcm_troca_pneus',
  'pcm_troca_pneus',
  true,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pcm_troca_pneus_storage_select" on storage.objects;
create policy "pcm_troca_pneus_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'pcm_troca_pneus');

drop policy if exists "pcm_troca_pneus_storage_insert" on storage.objects;
create policy "pcm_troca_pneus_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'pcm_troca_pneus');
