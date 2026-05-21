begin;

alter table if exists public.avarias_terceiros
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.avarias_terceiros
  add column if not exists atualizado_em timestamptz not null default now();

update public.avarias_terceiros
set
  updated_at = coalesce(updated_at, now()),
  atualizado_em = coalesce(atualizado_em, updated_at, now())
where updated_at is null or atualizado_em is null;

drop trigger if exists trg_avarias_terceiros_compat_updated_columns on public.avarias_terceiros;
create trigger trg_avarias_terceiros_compat_updated_columns
before insert or update on public.avarias_terceiros
for each row
execute function public.set_updated_atualizado_em_columns();

commit;
