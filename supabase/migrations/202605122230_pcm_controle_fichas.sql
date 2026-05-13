create table if not exists public.pcm_controle_fichas (
  id uuid primary key,
  ficha_controle text not null,
  numero_os text not null,
  data_entrega timestamptz not null default now(),
  quantidade_fichas int,
  foto_path text,
  foto_url text,
  observacoes text,
  status text not null default 'AGUARDANDO_SUPERVISOR',
  supervisor_nome text,
  supervisor_recebido_em timestamptz,
  pcm_nome text,
  pcm_recebido_em timestamptz,
  transnet_lancado_em timestamptz,
  transnet_lancado_por_nome text,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  origem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pcm_controle_fichas_status_idx
  on public.pcm_controle_fichas (status);
create index if not exists pcm_controle_fichas_created_at_idx
  on public.pcm_controle_fichas (created_at desc);

alter table public.pcm_controle_fichas enable row level security;

drop policy if exists "pcm_controle_fichas_select_all" on public.pcm_controle_fichas;
create policy "pcm_controle_fichas_select_all"
  on public.pcm_controle_fichas for select
  to authenticated using (true);

drop policy if exists "pcm_controle_fichas_insert_all" on public.pcm_controle_fichas;
create policy "pcm_controle_fichas_insert_all"
  on public.pcm_controle_fichas for insert
  to authenticated with check (true);

drop policy if exists "pcm_controle_fichas_update_all" on public.pcm_controle_fichas;
create policy "pcm_controle_fichas_update_all"
  on public.pcm_controle_fichas for update
  to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('pcm_controle_fichas', 'pcm_controle_fichas', true)
on conflict (id) do nothing;

drop policy if exists "pcm_controle_fichas_storage_read" on storage.objects;
create policy "pcm_controle_fichas_storage_read"
  on storage.objects for select
  to public using (bucket_id = 'pcm_controle_fichas');

drop policy if exists "pcm_controle_fichas_storage_write" on storage.objects;
create policy "pcm_controle_fichas_storage_write"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'pcm_controle_fichas');
