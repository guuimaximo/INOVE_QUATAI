create table if not exists public.diesel_acompanhamento_sessoes (
  id uuid primary key default gen_random_uuid(),
  acompanhamento_id uuid not null references public.diesel_acompanhamentos(id) on delete cascade,
  sessao_numero integer not null default 1,
  data_sessao date not null default current_date,
  hora_inicio time without time zone,
  hora_fim time without time zone,
  iniciado_em timestamp with time zone,
  encerrado_em timestamp with time zone,
  status_sessao text not null default 'INICIADA',
  instrutor_id uuid,
  instrutor_login text,
  instrutor_nome text,
  linha_snapshot text,
  foco_snapshot text,
  latitude_inicio double precision,
  longitude_inicio double precision,
  precisao_inicio double precision,
  capturado_em_inicio timestamp with time zone,
  latitude_fim double precision,
  longitude_fim double precision,
  precisao_fim double precision,
  capturado_em_fim timestamp with time zone,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists idx_diesel_acompanhamento_sessoes_acomp
on public.diesel_acompanhamento_sessoes (acompanhamento_id, data_sessao desc, created_at desc);

create index if not exists idx_diesel_acompanhamento_sessoes_instrutor
on public.diesel_acompanhamento_sessoes (instrutor_login, data_sessao desc);

create or replace function public.set_diesel_acompanhamento_sessoes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_diesel_acompanhamento_sessoes_updated_at
on public.diesel_acompanhamento_sessoes;

create trigger trg_diesel_acompanhamento_sessoes_updated_at
before update on public.diesel_acompanhamento_sessoes
for each row
execute function public.set_diesel_acompanhamento_sessoes_updated_at();

alter table public.diesel_acompanhamento_sessoes enable row level security;

grant select, insert, update on public.diesel_acompanhamento_sessoes to anon, authenticated;

drop policy if exists "diesel_acompanhamento_sessoes_select" on public.diesel_acompanhamento_sessoes;
create policy "diesel_acompanhamento_sessoes_select"
on public.diesel_acompanhamento_sessoes
for select
to anon, authenticated
using (true);

drop policy if exists "diesel_acompanhamento_sessoes_insert" on public.diesel_acompanhamento_sessoes;
create policy "diesel_acompanhamento_sessoes_insert"
on public.diesel_acompanhamento_sessoes
for insert
to anon, authenticated
with check (true);

drop policy if exists "diesel_acompanhamento_sessoes_update" on public.diesel_acompanhamento_sessoes;
create policy "diesel_acompanhamento_sessoes_update"
on public.diesel_acompanhamento_sessoes
for update
to anon, authenticated
using (true)
with check (true);
