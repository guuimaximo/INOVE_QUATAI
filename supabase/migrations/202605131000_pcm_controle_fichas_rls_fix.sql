-- Alinha RLS do controle de fichas ao padrao das demais tabelas PCM (anon + authenticated)
grant select, insert, update on public.pcm_controle_fichas to anon, authenticated;

drop policy if exists "pcm_controle_fichas_select_all" on public.pcm_controle_fichas;
drop policy if exists "pcm_controle_fichas_insert_all" on public.pcm_controle_fichas;
drop policy if exists "pcm_controle_fichas_update_all" on public.pcm_controle_fichas;

create policy "pcm_controle_fichas_select"
  on public.pcm_controle_fichas
  for select
  to anon, authenticated
  using (true);

create policy "pcm_controle_fichas_insert"
  on public.pcm_controle_fichas
  for insert
  to anon, authenticated
  with check (true);

create policy "pcm_controle_fichas_update"
  on public.pcm_controle_fichas
  for update
  to anon, authenticated
  using (true)
  with check (true);

-- Storage
drop policy if exists "pcm_controle_fichas_storage_read" on storage.objects;
drop policy if exists "pcm_controle_fichas_storage_write" on storage.objects;

create policy "pcm_controle_fichas_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'pcm_controle_fichas');

create policy "pcm_controle_fichas_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'pcm_controle_fichas');
