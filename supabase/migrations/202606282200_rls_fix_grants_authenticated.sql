-- Correcao do erro "permission denied for table ..." para usuarios LOGADOS.
--
-- Contexto: apos a ativacao da RLS (Fase 1), o papel `authenticated` ficou sem
-- o GRANT de tabela em parte do schema (ex.: suprimentos_pecas). No Postgres,
-- acessar uma tabela exige DOIS niveis: (1) o GRANT de privilegio da tabela e
-- (2) a policy de RLS. As policies para `authenticated` existem, mas faltava o
-- GRANT -> por isso o colaborador (que entra pelo Auth real = papel
-- `authenticated`) via "permission denied", enquanto o admin (contingencia
-- legada = papel `anon`) continuava funcionando.
--
-- Esta correcao DEVOLVE o GRANT ao `authenticated` em todas as tabelas, views,
-- sequences e funcoes do schema public. A RLS continua LIGADA: quem nao esta
-- logado (anon) segue barrado pelas policies; o controle por linha permanece.
--
-- Seguro e reversivel. Rode no Supabase -> SQL Editor (ou via migration).

-- 1) Tabelas: privilegios de leitura/escrita ao authenticated
do $$
declare r record;
begin
  for r in
    select tablename as nm from pg_tables where schemaname = 'public'
  loop
    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      r.nm
    );
  end loop;
end $$;

-- 2) Views: leitura ao authenticated
do $$
declare r record;
begin
  for r in
    select table_name as nm from information_schema.views where table_schema = 'public'
  loop
    execute format('grant select on public.%I to authenticated', r.nm);
  end loop;
end $$;

-- 3) Sequences: necessario para inserts com colunas serial/identity
do $$
declare r record;
begin
  for r in
    select sequence_name as nm from information_schema.sequences where sequence_schema = 'public'
  loop
    execute format('grant usage, select on sequence public.%I to authenticated', r.nm);
  end loop;
end $$;

-- 4) Funcoes/RPCs: garantir execucao ao authenticated (login, etc.)
grant execute on all functions in schema public to authenticated;

-- 5) Default privileges: tabelas/sequences/funcoes FUTURAS ja nascem acessiveis
--    ao authenticated (evita o problema voltar quando criarem novas tabelas).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;
