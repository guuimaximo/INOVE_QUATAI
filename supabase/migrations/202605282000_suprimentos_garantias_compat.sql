-- Repõe a coluna tipo_garantia em suprimentos_garantias caso a migration
-- 202605171930 não tenha sido aplicada, e remove o CHECK estrito (que
-- recusava valores com acento como "Peça comprada").

alter table if exists public.suprimentos_garantias
  add column if not exists tipo_garantia text,
  add column if not exists numero_controle text,
  add column if not exists peca text,
  add column if not exists codigo_peca text,
  add column if not exists fornecedor text,
  add column if not exists data_compra date,
  add column if not exists valor_peca numeric,
  add column if not exists prefixo text,
  add column if not exists km_instalacao numeric,
  add column if not exists km_falha numeric,
  add column if not exists data_falha date,
  add column if not exists tipo_solicitacao text,
  add column if not exists protocolo_fornecedor text,
  add column if not exists enviado_fornecedor_em date,
  add column if not exists retirada_fornecedor_em date,
  add column if not exists prazo_retorno_dias numeric,
  add column if not exists observacao text,
  add column if not exists resultado text,
  add column if not exists tipo_retorno text,
  add column if not exists valor_aprovado numeric,
  add column if not exists retorno_fornecedor_em date,
  add column if not exists previsao_recebimento date,
  add column if not exists recebida_em date,
  add column if not exists encerrada_em date,
  add column if not exists anexos jsonb default '[]'::jsonb,
  add column if not exists laudo_urls jsonb default '[]'::jsonb,
  add column if not exists aberto_por_id integer,
  add column if not exists aberto_por_nome text,
  add column if not exists aberto_por_login text,
  add column if not exists updated_at timestamptz default now();

-- Remove o CHECK estrito antigo (que só aceitava sem acento)
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.suprimentos_garantias'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%tipo_garantia%'
  loop
    execute format('alter table public.suprimentos_garantias drop constraint %I', r.conname);
  end loop;
end $$;

notify pgrst, 'reload schema';
