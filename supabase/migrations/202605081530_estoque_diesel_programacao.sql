begin;

create table if not exists public.estoque_diesel_programacoes_diarias (
  id bigserial primary key,
  tanque_id bigint not null references public.estoque_diesel_tanques(id) on delete cascade,
  data_programacao date not null,
  entrada_prevista_litros numeric(10,2) not null default 0,
  saida_prevista_litros numeric(10,2) not null default 0,
  fornecedor_previsto varchar(120),
  observacao text,
  usuario_id bigint,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tanque_id, data_programacao)
);

create index if not exists idx_estoque_diesel_programacoes_tanque_data
  on public.estoque_diesel_programacoes_diarias (tanque_id, data_programacao desc);

create index if not exists idx_estoque_diesel_programacoes_data
  on public.estoque_diesel_programacoes_diarias (data_programacao);

grant select, insert, update, delete on public.estoque_diesel_programacoes_diarias to anon, authenticated;
grant usage, select on sequence public.estoque_diesel_programacoes_diarias_id_seq to anon, authenticated;

alter table public.estoque_diesel_programacoes_diarias enable row level security;

drop policy if exists "read estoque diesel programacoes" on public.estoque_diesel_programacoes_diarias;
create policy "read estoque diesel programacoes"
on public.estoque_diesel_programacoes_diarias
for select
to anon, authenticated
using (true);

drop policy if exists "insert estoque diesel programacoes" on public.estoque_diesel_programacoes_diarias;
create policy "insert estoque diesel programacoes"
on public.estoque_diesel_programacoes_diarias
for insert
to anon, authenticated
with check (true);

drop policy if exists "update estoque diesel programacoes" on public.estoque_diesel_programacoes_diarias;
create policy "update estoque diesel programacoes"
on public.estoque_diesel_programacoes_diarias
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "delete estoque diesel programacoes" on public.estoque_diesel_programacoes_diarias;
create policy "delete estoque diesel programacoes"
on public.estoque_diesel_programacoes_diarias
for delete
to anon, authenticated
using (true);

commit;
