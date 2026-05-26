-- Ajusta RLS de acidentes e SAC para o app, que usa autenticacao propria
-- (cliente Supabase vai como anon). As policies originais aceitavam apenas
-- 'authenticated', causando "new row violates row-level security policy" no
-- insert. Recriamos as policies para 'anon, authenticated', seguindo o
-- padrao das outras migrations (suprimentos, estoque-diesel, etc.).

-- =========================
-- ACIDENTES - tabelas
-- =========================
drop policy if exists "acidentes_ocorrencias_select_all" on public.acidentes_ocorrencias;
create policy "acidentes_ocorrencias_select_all"
  on public.acidentes_ocorrencias for select
  to anon, authenticated using (true);

drop policy if exists "acidentes_ocorrencias_insert_all" on public.acidentes_ocorrencias;
create policy "acidentes_ocorrencias_insert_all"
  on public.acidentes_ocorrencias for insert
  to anon, authenticated with check (true);

drop policy if exists "acidentes_ocorrencias_update_all" on public.acidentes_ocorrencias;
create policy "acidentes_ocorrencias_update_all"
  on public.acidentes_ocorrencias for update
  to anon, authenticated using (true) with check (true);

drop policy if exists "acidentes_ocorrencias_delete_all" on public.acidentes_ocorrencias;
create policy "acidentes_ocorrencias_delete_all"
  on public.acidentes_ocorrencias for delete
  to anon, authenticated using (true);

drop policy if exists "acidentes_tratativas_select_all" on public.acidentes_tratativas;
create policy "acidentes_tratativas_select_all"
  on public.acidentes_tratativas for select
  to anon, authenticated using (true);

drop policy if exists "acidentes_tratativas_insert_all" on public.acidentes_tratativas;
create policy "acidentes_tratativas_insert_all"
  on public.acidentes_tratativas for insert
  to anon, authenticated with check (true);

drop policy if exists "acidentes_tratativas_update_all" on public.acidentes_tratativas;
create policy "acidentes_tratativas_update_all"
  on public.acidentes_tratativas for update
  to anon, authenticated using (true) with check (true);

drop policy if exists "acidentes_tratativas_delete_all" on public.acidentes_tratativas;
create policy "acidentes_tratativas_delete_all"
  on public.acidentes_tratativas for delete
  to anon, authenticated using (true);

-- =========================
-- SAC - tabelas
-- =========================
drop policy if exists "sac_atendimentos_select_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_select_auth"
  on public.sac_atendimentos for select
  to anon, authenticated using (true);

drop policy if exists "sac_atendimentos_insert_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_insert_auth"
  on public.sac_atendimentos for insert
  to anon, authenticated with check (true);

drop policy if exists "sac_atendimentos_update_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_update_auth"
  on public.sac_atendimentos for update
  to anon, authenticated using (true) with check (true);

drop policy if exists "sac_atendimentos_delete_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_delete_auth"
  on public.sac_atendimentos for delete
  to anon, authenticated using (true);

drop policy if exists "sac_movimentacoes_select_auth" on public.sac_movimentacoes;
create policy "sac_movimentacoes_select_auth"
  on public.sac_movimentacoes for select
  to anon, authenticated using (true);

drop policy if exists "sac_movimentacoes_insert_auth" on public.sac_movimentacoes;
create policy "sac_movimentacoes_insert_auth"
  on public.sac_movimentacoes for insert
  to anon, authenticated with check (true);

drop policy if exists "sac_movimentacoes_update_auth" on public.sac_movimentacoes;
create policy "sac_movimentacoes_update_auth"
  on public.sac_movimentacoes for update
  to anon, authenticated using (true) with check (true);

drop policy if exists "sac_movimentacoes_delete_auth" on public.sac_movimentacoes;
create policy "sac_movimentacoes_delete_auth"
  on public.sac_movimentacoes for delete
  to anon, authenticated using (true);

-- =========================
-- Storage buckets (acidentes / sac) - libera anon para upload/update
-- =========================
drop policy if exists "acidentes_storage_insert" on storage.objects;
create policy "acidentes_storage_insert"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'acidentes');

drop policy if exists "acidentes_storage_update" on storage.objects;
create policy "acidentes_storage_update"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'acidentes')
  with check (bucket_id = 'acidentes');

drop policy if exists "acidentes_storage_delete" on storage.objects;
create policy "acidentes_storage_delete"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'acidentes');

drop policy if exists "sac_storage_insert_auth" on storage.objects;
create policy "sac_storage_insert_auth"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'sac');

drop policy if exists "sac_storage_update_auth" on storage.objects;
create policy "sac_storage_update_auth"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'sac')
  with check (bucket_id = 'sac');

drop policy if exists "sac_storage_delete_auth" on storage.objects;
create policy "sac_storage_delete_auth"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'sac');

notify pgrst, 'reload schema';
