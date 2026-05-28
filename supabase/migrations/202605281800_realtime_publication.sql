-- Garante que as tabelas de contagem entrem na publicação do Realtime.
-- Sem isso, o supabase.channel('...').on('postgres_changes', ...) nunca dispara.

do $$
begin
  -- supabase_realtime é a publicação padrão criada pelo Supabase
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    -- adiciona apenas se ainda não estiver
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suprimentos_contagens'
    ) then
      execute 'alter publication supabase_realtime add table public.suprimentos_contagens';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suprimentos_bot_jobs'
    ) then
      execute 'alter publication supabase_realtime add table public.suprimentos_bot_jobs';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suprimentos_auditorias'
    ) then
      execute 'alter publication supabase_realtime add table public.suprimentos_auditorias';
    end if;
  end if;
end $$;
