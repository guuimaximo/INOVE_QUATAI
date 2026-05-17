create table if not exists public.suprimentos_garantias (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  peca text not null,
  codigo_peca text,
  fornecedor text not null,
  data_compra date,
  valor_peca numeric(12,2) not null default 0,
  prefixo text not null,
  km_instalacao integer,
  km_falha integer,
  data_falha date not null,
  tipo_solicitacao text check (tipo_solicitacao in ('Ressarcimento', 'Peça nova')),
  protocolo_fornecedor text,
  enviado_fornecedor_em date,
  observacao text,
  resultado text check (resultado in ('Aprovada', 'Negada')),
  tipo_retorno text check (tipo_retorno in ('Crédito', 'Peça nova')),
  valor_aprovado numeric(12,2),
  retorno_fornecedor_em date,
  previsao_recebimento date,
  recebida_em date,
  encerrada_em date,
  anexos jsonb not null default '[]'::jsonb,
  aberto_por_id integer references public.usuarios_aprovadores(id) on delete set null,
  aberto_por_nome text,
  aberto_por_login text
);

create index if not exists idx_suprimentos_garantias_created_at
  on public.suprimentos_garantias (created_at desc);

create index if not exists idx_suprimentos_garantias_prefixo
  on public.suprimentos_garantias (prefixo);

create index if not exists idx_suprimentos_garantias_fornecedor
  on public.suprimentos_garantias (fornecedor);

alter table public.suprimentos_garantias enable row level security;
grant select, insert, update, delete on public.suprimentos_garantias to anon, authenticated;

drop policy if exists "suprimentos_garantias_select" on public.suprimentos_garantias;
create policy "suprimentos_garantias_select"
  on public.suprimentos_garantias
  for select
  to anon, authenticated
  using (true);

drop policy if exists "suprimentos_garantias_insert" on public.suprimentos_garantias;
create policy "suprimentos_garantias_insert"
  on public.suprimentos_garantias
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "suprimentos_garantias_update" on public.suprimentos_garantias;
create policy "suprimentos_garantias_update"
  on public.suprimentos_garantias
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "suprimentos_garantias_delete" on public.suprimentos_garantias;
create policy "suprimentos_garantias_delete"
  on public.suprimentos_garantias
  for delete
  to anon, authenticated
  using (true);

create table if not exists public.suprimentos_testes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  nome_teste text not null,
  peca text not null,
  codigo_peca text,
  fornecedor text not null,
  objetivo text,
  prefixo text not null,
  data_inicio date not null,
  km_inicial integer not null,
  km_atual integer,
  prazo_teste date,
  observacao text,
  falha_registrada boolean not null default false,
  data_falha date,
  km_falha integer,
  descricao_falha text,
  parecer_tecnico text,
  resultado_final text check (resultado_final in ('Aprovado', 'Reprovado')),
  encerrado_em date,
  anexos jsonb not null default '[]'::jsonb,
  aberto_por_id integer references public.usuarios_aprovadores(id) on delete set null,
  aberto_por_nome text,
  aberto_por_login text
);

create index if not exists idx_suprimentos_testes_created_at
  on public.suprimentos_testes (created_at desc);

create index if not exists idx_suprimentos_testes_prefixo
  on public.suprimentos_testes (prefixo);

create index if not exists idx_suprimentos_testes_fornecedor
  on public.suprimentos_testes (fornecedor);

alter table public.suprimentos_testes enable row level security;
grant select, insert, update, delete on public.suprimentos_testes to anon, authenticated;

drop policy if exists "suprimentos_testes_select" on public.suprimentos_testes;
create policy "suprimentos_testes_select"
  on public.suprimentos_testes
  for select
  to anon, authenticated
  using (true);

drop policy if exists "suprimentos_testes_insert" on public.suprimentos_testes;
create policy "suprimentos_testes_insert"
  on public.suprimentos_testes
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "suprimentos_testes_update" on public.suprimentos_testes;
create policy "suprimentos_testes_update"
  on public.suprimentos_testes
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "suprimentos_testes_delete" on public.suprimentos_testes;
create policy "suprimentos_testes_delete"
  on public.suprimentos_testes
  for delete
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'suprimentos',
  'suprimentos',
  true,
  15728640,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "suprimentos_storage_select" on storage.objects;
create policy "suprimentos_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'suprimentos');

drop policy if exists "suprimentos_storage_insert" on storage.objects;
create policy "suprimentos_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'suprimentos');

drop policy if exists "suprimentos_storage_update" on storage.objects;
create policy "suprimentos_storage_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'suprimentos')
  with check (bucket_id = 'suprimentos');

notify pgrst, 'reload schema';
