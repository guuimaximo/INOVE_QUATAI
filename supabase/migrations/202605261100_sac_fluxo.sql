create extension if not exists pgcrypto;

create sequence if not exists public.sac_protocolo_seq;

create table if not exists public.sac_atendimentos (
  id uuid primary key default gen_random_uuid(),
  protocolo text not null unique default (
    'SAC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.sac_protocolo_seq')::text, 6, '0')
  ),
  status text not null default 'Registrado' check (status in ('Registrado', 'Em tratativa', 'Concluido', 'Cancelado')),
  data_atendimento date not null default current_date,
  hora_atendimento time without time zone not null default localtime(0),
  origem text not null,
  atendente_id text,
  atendente_login text,
  atendente_nome text,
  cliente_nome text,
  cliente_telefone text,
  carro_prefixo text,
  linha text,
  operador_chapa text,
  operador_nome text,
  grupo_motivo text not null,
  subgrupo_motivo text,
  data_ocorrencia date,
  hora_ocorrencia time without time zone,
  detalhamento text not null,
  acao_tomada text,
  abrir_tratativa boolean not null default false,
  tratativa_id uuid,
  evidencias_urls jsonb not null default '[]'::jsonb,
  conclusao text,
  cancelado_motivo text,
  concluido_em timestamptz,
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sac_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  sac_id uuid not null references public.sac_atendimentos(id) on delete cascade,
  tipo text not null default 'Tratativa',
  descricao text not null,
  anexos_urls jsonb not null default '[]'::jsonb,
  criado_por_id text,
  criado_por_login text,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists sac_atendimentos_status_idx
  on public.sac_atendimentos (status, created_at desc);

create index if not exists sac_atendimentos_data_idx
  on public.sac_atendimentos (data_atendimento desc, hora_atendimento desc);

create index if not exists sac_movimentacoes_sac_idx
  on public.sac_movimentacoes (sac_id, created_at desc);

create or replace function public.set_sac_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sac_atendimentos_updated_at on public.sac_atendimentos;
create trigger trg_sac_atendimentos_updated_at
before update on public.sac_atendimentos
for each row execute function public.set_sac_updated_at();

alter table public.sac_atendimentos enable row level security;
alter table public.sac_movimentacoes enable row level security;

drop policy if exists "sac_atendimentos_select_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_select_auth"
on public.sac_atendimentos for select
to authenticated
using (true);

drop policy if exists "sac_atendimentos_insert_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_insert_auth"
on public.sac_atendimentos for insert
to authenticated
with check (true);

drop policy if exists "sac_atendimentos_update_auth" on public.sac_atendimentos;
create policy "sac_atendimentos_update_auth"
on public.sac_atendimentos for update
to authenticated
using (true)
with check (true);

drop policy if exists "sac_movimentacoes_select_auth" on public.sac_movimentacoes;
create policy "sac_movimentacoes_select_auth"
on public.sac_movimentacoes for select
to authenticated
using (true);

drop policy if exists "sac_movimentacoes_insert_auth" on public.sac_movimentacoes;
create policy "sac_movimentacoes_insert_auth"
on public.sac_movimentacoes for insert
to authenticated
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sac',
  'sac',
  true,
  52428800,
  array['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime','application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sac_storage_select_public" on storage.objects;
create policy "sac_storage_select_public"
on storage.objects for select
to public
using (bucket_id = 'sac');

drop policy if exists "sac_storage_insert_auth" on storage.objects;
create policy "sac_storage_insert_auth"
on storage.objects for insert
to authenticated
with check (bucket_id = 'sac');

drop policy if exists "sac_storage_update_auth" on storage.objects;
create policy "sac_storage_update_auth"
on storage.objects for update
to authenticated
using (bucket_id = 'sac')
with check (bucket_id = 'sac');
