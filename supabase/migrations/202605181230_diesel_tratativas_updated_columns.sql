begin;

alter table if exists public.diesel_tratativas
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.diesel_tratativas
  add column if not exists atualizado_em timestamptz not null default now();

alter table if exists public.diesel_tratativas_detalhes
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.diesel_tratativas_detalhes
  add column if not exists atualizado_em timestamptz not null default now();

update public.diesel_tratativas
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

update public.diesel_tratativas_detalhes
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

drop trigger if exists trg_diesel_tratativas_compat_updated_columns on public.diesel_tratativas;
create trigger trg_diesel_tratativas_compat_updated_columns
before insert or update on public.diesel_tratativas
for each row
execute function public.set_updated_atualizado_em_columns();

drop trigger if exists trg_diesel_tratativas_detalhes_compat_updated_columns on public.diesel_tratativas_detalhes;
create trigger trg_diesel_tratativas_detalhes_compat_updated_columns
before insert or update on public.diesel_tratativas_detalhes
for each row
execute function public.set_updated_atualizado_em_columns();

commit;
