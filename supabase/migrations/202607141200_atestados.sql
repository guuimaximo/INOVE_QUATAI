-- Modulo Pessoas > Atestados. O gestor lanca atestados/declaracoes dos
-- colaboradores (anexando o documento) e o RH valida/recusa. Tabela propria,
-- independente de `afastados`. O arquivo vai para o bucket publico `atestados`
-- (mesmo padrao dos outros modulos: upload + getPublicUrl).

create table if not exists public.atestados (
  id uuid primary key default gen_random_uuid(),

  -- snapshot do colaborador (origem: funcionarios_atualizada)
  funcionario_id text,
  funcionario_cracha text,
  funcionario_nome text,
  funcionario_funcao text,

  -- documento
  tipo_documento text not null default 'ATESTADO_MEDICO',
  data_inicio date,
  data_fim date,
  dias numeric(5,1),
  cid text,
  medico_emissor text,
  observacao text,

  -- anexo (bucket publico `atestados`)
  arquivo_url text,
  arquivo_nome text,

  -- fluxo de validacao
  status text not null default 'AGUARDA_RH',
  motivo_recusa text,

  -- auditoria: quem lancou (gestor)
  criado_por_login text,
  criado_por_nome text,
  criado_em timestamptz not null default now(),

  -- auditoria: quem validou/recusou (RH)
  validado_por_login text,
  validado_por_nome text,
  validado_em timestamptz,

  atualizado_em timestamptz not null default now(),

  constraint atestados_tipo_documento_check
    check (tipo_documento in ('ATESTADO_MEDICO', 'DECLARACAO_COMPARECIMENTO', 'ATESTADO_ACOMPANHANTE', 'OUTROS')),
  constraint atestados_status_check
    check (status in ('AGUARDA_RH', 'VALIDADO', 'RECUSADO'))
);

create index if not exists idx_atestados_cracha on public.atestados (funcionario_cracha);
create index if not exists idx_atestados_status on public.atestados (status);
create index if not exists idx_atestados_data_inicio on public.atestados (data_inicio);

alter table public.atestados enable row level security;

drop policy if exists "anon all atestados" on public.atestados;
create policy "anon all atestados" on public.atestados
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.atestados to anon, authenticated;

-- Bucket de armazenamento dos documentos anexados aos atestados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'atestados',
  'atestados',
  true,
  31457280,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "atestados_storage_select" on storage.objects;
create policy "atestados_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'atestados');

drop policy if exists "atestados_storage_insert" on storage.objects;
create policy "atestados_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'atestados');

drop policy if exists "atestados_storage_update" on storage.objects;
create policy "atestados_storage_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'atestados')
  with check (bucket_id = 'atestados');

drop policy if exists "atestados_storage_delete" on storage.objects;
create policy "atestados_storage_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'atestados');

notify pgrst, 'reload schema';
