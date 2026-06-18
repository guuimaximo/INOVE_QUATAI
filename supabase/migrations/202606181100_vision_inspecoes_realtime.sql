begin;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'vision_inspecoes'
    ) then
      execute 'alter publication supabase_realtime add table public.vision_inspecoes';
    end if;
  end if;
end $$;

commit;
