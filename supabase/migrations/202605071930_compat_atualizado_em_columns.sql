begin;

alter table if exists public.diesel_acompanhamentos
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.diesel_acompanhamentos
  add column if not exists atualizado_em timestamptz not null default now();

alter table if exists public.diesel_checklist_respostas
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.diesel_checklist_respostas
  add column if not exists atualizado_em timestamptz not null default now();

alter table if exists public.diesel_acompanhamento_eventos
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.diesel_acompanhamento_eventos
  add column if not exists atualizado_em timestamptz not null default now();

alter table if exists public.diesel_acompanhamento_sessoes
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.diesel_acompanhamento_sessoes
  add column if not exists atualizado_em timestamptz not null default now();

alter table if exists public.estrutura_fisica_solicitacoes
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.estrutura_fisica_solicitacoes
  add column if not exists atualizado_em timestamptz not null default now();

alter table if exists public.estrutura_fisica_historico
  add column if not exists updated_at timestamptz not null default now();
alter table if exists public.estrutura_fisica_historico
  add column if not exists atualizado_em timestamptz not null default now();

update public.diesel_acompanhamentos
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

update public.diesel_checklist_respostas
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

update public.diesel_acompanhamento_eventos
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

update public.diesel_acompanhamento_sessoes
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

update public.estrutura_fisica_solicitacoes
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

update public.estrutura_fisica_historico
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

create or replace function public.set_updated_atualizado_em_columns()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_at := coalesce(new.updated_at, now());
    new.atualizado_em := coalesce(new.atualizado_em, new.updated_at, now());
  else
    new.updated_at := now();
    new.atualizado_em := new.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_diesel_acompanhamentos_compat_updated_columns on public.diesel_acompanhamentos;
create trigger trg_diesel_acompanhamentos_compat_updated_columns
before insert or update on public.diesel_acompanhamentos
for each row
execute function public.set_updated_atualizado_em_columns();

drop trigger if exists trg_diesel_checklist_respostas_compat_updated_columns on public.diesel_checklist_respostas;
create trigger trg_diesel_checklist_respostas_compat_updated_columns
before insert or update on public.diesel_checklist_respostas
for each row
execute function public.set_updated_atualizado_em_columns();

drop trigger if exists trg_diesel_acompanhamento_eventos_compat_updated_columns on public.diesel_acompanhamento_eventos;
create trigger trg_diesel_acompanhamento_eventos_compat_updated_columns
before insert or update on public.diesel_acompanhamento_eventos
for each row
execute function public.set_updated_atualizado_em_columns();

drop trigger if exists trg_diesel_acompanhamento_sessoes_compat_updated_columns on public.diesel_acompanhamento_sessoes;
create trigger trg_diesel_acompanhamento_sessoes_compat_updated_columns
before insert or update on public.diesel_acompanhamento_sessoes
for each row
execute function public.set_updated_atualizado_em_columns();

drop trigger if exists trg_estrutura_fisica_solicitacoes_compat_updated_columns on public.estrutura_fisica_solicitacoes;
create trigger trg_estrutura_fisica_solicitacoes_compat_updated_columns
before insert or update on public.estrutura_fisica_solicitacoes
for each row
execute function public.set_updated_atualizado_em_columns();

drop trigger if exists trg_estrutura_fisica_historico_compat_updated_columns on public.estrutura_fisica_historico;
create trigger trg_estrutura_fisica_historico_compat_updated_columns
before insert or update on public.estrutura_fisica_historico
for each row
execute function public.set_updated_atualizado_em_columns();

commit;
