grant select, insert, update, delete on public.pcm_pneus_transnet_alocacao to anon, authenticated;
grant select, insert, update, delete on public.pcm_pneus_transnet_ativos to anon, authenticated;
grant select, insert, update, delete on public.pcm_pneus_transnet_inativos to anon, authenticated;

alter table public.pcm_pneus_transnet_alocacao enable row level security;
alter table public.pcm_pneus_transnet_ativos enable row level security;
alter table public.pcm_pneus_transnet_inativos enable row level security;

drop policy if exists "pcm_pneus_transnet_alocacao_select" on public.pcm_pneus_transnet_alocacao;
create policy "pcm_pneus_transnet_alocacao_select"
on public.pcm_pneus_transnet_alocacao
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_pneus_transnet_alocacao_insert" on public.pcm_pneus_transnet_alocacao;
create policy "pcm_pneus_transnet_alocacao_insert"
on public.pcm_pneus_transnet_alocacao
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_pneus_transnet_alocacao_update" on public.pcm_pneus_transnet_alocacao;
create policy "pcm_pneus_transnet_alocacao_update"
on public.pcm_pneus_transnet_alocacao
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pcm_pneus_transnet_alocacao_delete" on public.pcm_pneus_transnet_alocacao;
create policy "pcm_pneus_transnet_alocacao_delete"
on public.pcm_pneus_transnet_alocacao
for delete
to anon, authenticated
using (true);

drop policy if exists "pcm_pneus_transnet_ativos_select" on public.pcm_pneus_transnet_ativos;
create policy "pcm_pneus_transnet_ativos_select"
on public.pcm_pneus_transnet_ativos
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_pneus_transnet_ativos_insert" on public.pcm_pneus_transnet_ativos;
create policy "pcm_pneus_transnet_ativos_insert"
on public.pcm_pneus_transnet_ativos
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_pneus_transnet_ativos_update" on public.pcm_pneus_transnet_ativos;
create policy "pcm_pneus_transnet_ativos_update"
on public.pcm_pneus_transnet_ativos
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pcm_pneus_transnet_ativos_delete" on public.pcm_pneus_transnet_ativos;
create policy "pcm_pneus_transnet_ativos_delete"
on public.pcm_pneus_transnet_ativos
for delete
to anon, authenticated
using (true);

drop policy if exists "pcm_pneus_transnet_inativos_select" on public.pcm_pneus_transnet_inativos;
create policy "pcm_pneus_transnet_inativos_select"
on public.pcm_pneus_transnet_inativos
for select
to anon, authenticated
using (true);

drop policy if exists "pcm_pneus_transnet_inativos_insert" on public.pcm_pneus_transnet_inativos;
create policy "pcm_pneus_transnet_inativos_insert"
on public.pcm_pneus_transnet_inativos
for insert
to anon, authenticated
with check (true);

drop policy if exists "pcm_pneus_transnet_inativos_update" on public.pcm_pneus_transnet_inativos;
create policy "pcm_pneus_transnet_inativos_update"
on public.pcm_pneus_transnet_inativos
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "pcm_pneus_transnet_inativos_delete" on public.pcm_pneus_transnet_inativos;
create policy "pcm_pneus_transnet_inativos_delete"
on public.pcm_pneus_transnet_inativos
for delete
to anon, authenticated
using (true);
