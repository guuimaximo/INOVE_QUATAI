begin;

alter table if exists public.suprimentos_garantias
  add column if not exists data_instalacao date;

notify pgrst, 'reload schema';

commit;
