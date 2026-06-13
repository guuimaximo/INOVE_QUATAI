grant select, insert, update, delete on public.pcm_auditoria_pneus to anon, authenticated;
grant select, insert, update, delete on public.pcm_estoque_pneus to anon, authenticated;

drop policy if exists "pcm_auditoria_pneus_delete" on public.pcm_auditoria_pneus;
create policy "pcm_auditoria_pneus_delete"
on public.pcm_auditoria_pneus
for delete
to anon, authenticated
using (true);

drop policy if exists "pcm_estoque_pneus_delete" on public.pcm_estoque_pneus;
create policy "pcm_estoque_pneus_delete"
on public.pcm_estoque_pneus
for delete
to anon, authenticated
using (true);
