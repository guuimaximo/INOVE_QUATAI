-- Cria o bucket de armazenamento usado pelas fotos do estoque de diesel
-- (recebimentos e reguas da medicao). O codigo faz upload/leitura de
-- storage.from('estoque-diesel'); sem este bucket as fotos nao aparecem.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estoque-diesel',
  'estoque-diesel',
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

drop policy if exists "estoque_diesel_storage_select" on storage.objects;
create policy "estoque_diesel_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'estoque-diesel');

drop policy if exists "estoque_diesel_storage_insert" on storage.objects;
create policy "estoque_diesel_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'estoque-diesel');

drop policy if exists "estoque_diesel_storage_update" on storage.objects;
create policy "estoque_diesel_storage_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'estoque-diesel')
  with check (bucket_id = 'estoque-diesel');

drop policy if exists "estoque_diesel_storage_delete" on storage.objects;
create policy "estoque_diesel_storage_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'estoque-diesel');

notify pgrst, 'reload schema';
