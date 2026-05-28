-- Audits do bot. Diária deriva direto das contagens; semanal grava 1 linha por run.
create table if not exists public.suprimentos_auditorias (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('diaria','semanal')),
  data_inicio date not null,
  data_fim date not null,
  resumo_json jsonb,
  excel_url text,
  criado_por_id integer,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists supaud_tipo_idx on public.suprimentos_auditorias (tipo);
create index if not exists supaud_data_idx on public.suprimentos_auditorias (data_fim desc);

alter table public.suprimentos_auditorias enable row level security;
drop policy if exists "supaud_select" on public.suprimentos_auditorias;
create policy "supaud_select" on public.suprimentos_auditorias for select to anon, authenticated using (true);
drop policy if exists "supaud_insert" on public.suprimentos_auditorias;
create policy "supaud_insert" on public.suprimentos_auditorias for insert to anon, authenticated with check (true);
drop policy if exists "supaud_update" on public.suprimentos_auditorias;
create policy "supaud_update" on public.suprimentos_auditorias for update to anon, authenticated using (true) with check (true);

-- Garante bucket público suprimentos (já deve existir; idempotente)
insert into storage.buckets (id, name, public)
values ('suprimentos', 'suprimentos', true)
on conflict (id) do update set public = excluded.public;
