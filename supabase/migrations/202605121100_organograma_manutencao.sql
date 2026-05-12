begin;

create table if not exists public.organograma_manutencao_areas (
  id bigserial primary key,
  codigo varchar(80) not null unique,
  parent_codigo varchar(80),
  titulo varchar(120) not null,
  subtitulo varchar(180),
  tipo varchar(24) not null default 'CELULA',
  grupo varchar(80),
  turno varchar(24),
  cor varchar(24),
  ordem integer not null default 0,
  detalhe text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_organograma_manutencao_areas_parent
  on public.organograma_manutencao_areas (parent_codigo, ordem);

create index if not exists idx_organograma_manutencao_areas_tipo
  on public.organograma_manutencao_areas (tipo, turno);

grant select, insert, update, delete on public.organograma_manutencao_areas to anon, authenticated;
grant usage, select on sequence public.organograma_manutencao_areas_id_seq to anon, authenticated;

alter table public.organograma_manutencao_areas enable row level security;

drop policy if exists "read organograma manutencao areas" on public.organograma_manutencao_areas;
create policy "read organograma manutencao areas"
on public.organograma_manutencao_areas
for select
to anon, authenticated
using (true);

drop policy if exists "insert organograma manutencao areas" on public.organograma_manutencao_areas;
create policy "insert organograma manutencao areas"
on public.organograma_manutencao_areas
for insert
to anon, authenticated
with check (true);

drop policy if exists "update organograma manutencao areas" on public.organograma_manutencao_areas;
create policy "update organograma manutencao areas"
on public.organograma_manutencao_areas
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "delete organograma manutencao areas" on public.organograma_manutencao_areas;
create policy "delete organograma manutencao areas"
on public.organograma_manutencao_areas
for delete
to anon, authenticated
using (true);

create table if not exists public.organograma_manutencao_pessoas (
  id bigserial primary key,
  area_codigo varchar(80) not null,
  nome varchar(160) not null,
  cargo varchar(160),
  tipo_headcount varchar(16) not null default 'REALIZADO',
  turno varchar(24),
  status varchar(24) not null default 'ATIVO',
  ordem integer not null default 0,
  chapa varchar(40),
  telefone varchar(40),
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_organograma_manutencao_pessoas_area
  on public.organograma_manutencao_pessoas (area_codigo, tipo_headcount, ordem);

create index if not exists idx_organograma_manutencao_pessoas_status
  on public.organograma_manutencao_pessoas (status, turno);

grant select, insert, update, delete on public.organograma_manutencao_pessoas to anon, authenticated;
grant usage, select on sequence public.organograma_manutencao_pessoas_id_seq to anon, authenticated;

alter table public.organograma_manutencao_pessoas enable row level security;

drop policy if exists "read organograma manutencao pessoas" on public.organograma_manutencao_pessoas;
create policy "read organograma manutencao pessoas"
on public.organograma_manutencao_pessoas
for select
to anon, authenticated
using (true);

drop policy if exists "insert organograma manutencao pessoas" on public.organograma_manutencao_pessoas;
create policy "insert organograma manutencao pessoas"
on public.organograma_manutencao_pessoas
for insert
to anon, authenticated
with check (true);

drop policy if exists "update organograma manutencao pessoas" on public.organograma_manutencao_pessoas;
create policy "update organograma manutencao pessoas"
on public.organograma_manutencao_pessoas
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "delete organograma manutencao pessoas" on public.organograma_manutencao_pessoas;
create policy "delete organograma manutencao pessoas"
on public.organograma_manutencao_pessoas
for delete
to anon, authenticated
using (true);

update public.app_niveis_acesso
set paginas = case
  when paginas @> array['config_organograma_manutencao']::text[] then paginas
  else array_append(paginas, 'config_organograma_manutencao')
end
where nome in ('Manutencao', 'Manutenção', 'RH', 'Gestor', 'Administrador');

commit;
