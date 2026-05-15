create extension if not exists pgcrypto;

create table if not exists public.afastados (
  id uuid primary key default gen_random_uuid(),
  funcionario_id text,
  funcionario_cracha text,
  nome text not null,
  funcao text,
  motivo text not null,
  observacao text,
  data_inicio date not null default current_date,
  data_fim date,
  ativo boolean not null default true,
  criado_por_login text,
  criado_por_nome text,
  atualizado_por_login text,
  atualizado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_afastados_ativo on public.afastados (ativo, data_inicio desc);
create index if not exists idx_afastados_funcionario on public.afastados (funcionario_id, funcionario_cracha);

alter table public.afastados enable row level security;

drop policy if exists "afastados_select" on public.afastados;
create policy "afastados_select" on public.afastados
for select to anon, authenticated
using (true);

drop policy if exists "afastados_insert" on public.afastados;
create policy "afastados_insert" on public.afastados
for insert to anon, authenticated
with check (true);

drop policy if exists "afastados_update" on public.afastados;
create policy "afastados_update" on public.afastados
for update to anon, authenticated
using (true)
with check (true);

drop policy if exists "afastados_delete" on public.afastados;
create policy "afastados_delete" on public.afastados
for delete to anon, authenticated
using (true);

notify pgrst, 'reload schema';
