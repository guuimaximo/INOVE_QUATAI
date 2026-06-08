-- Funcao consultada pela Edge Function `controle-dados` para mostrar uso do banco
-- e do storage. Roda como service_role; nao expor via anon.
--
-- IMPORTANTE: rodar a mesma migration tambem no projeto Supabase do Farol
-- (mesmo SQL, schemas identicos).

create or replace function public.controle_dados_metricas()
returns jsonb
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_db_bytes      bigint;
  v_storage_bytes bigint;
  v_top_tables    jsonb;
  v_buckets       jsonb;
begin
  select pg_database_size(current_database()) into v_db_bytes;

  select coalesce(sum((metadata->>'size')::bigint), 0)
    into v_storage_bytes
    from storage.objects;

  select coalesce(jsonb_agg(t), '[]'::jsonb)
    into v_top_tables
    from (
      select
        n.nspname || '.' || c.relname as tabela,
        pg_total_relation_size(c.oid) as bytes,
        c.reltuples::bigint           as linhas_estimadas
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r'
        and n.nspname not in ('pg_catalog','information_schema','pg_toast')
      order by pg_total_relation_size(c.oid) desc
      limit 10
    ) t;

  select coalesce(jsonb_agg(b), '[]'::jsonb)
    into v_buckets
    from (
      select
        bucket_id                                            as bucket,
        count(*)                                             as objetos,
        coalesce(sum((metadata->>'size')::bigint), 0)        as bytes
      from storage.objects
      group by bucket_id
      order by sum((metadata->>'size')::bigint) desc nulls last
    ) b;

  return jsonb_build_object(
    'db_bytes',      v_db_bytes,
    'storage_bytes', v_storage_bytes,
    'top_tabelas',   v_top_tables,
    'buckets',       v_buckets,
    'coletado_em',   now()
  );
end;
$$;

revoke all on function public.controle_dados_metricas() from public, anon, authenticated;
grant execute on function public.controle_dados_metricas() to service_role;
