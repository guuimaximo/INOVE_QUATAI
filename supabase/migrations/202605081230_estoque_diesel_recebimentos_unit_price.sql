begin;

alter table if exists public.estoque_diesel_recebimentos
  add column if not exists valor_unitario numeric(12,4);

alter table if exists public.estoque_diesel_recebimentos
  add column if not exists valor_total numeric(14,2);

commit;
