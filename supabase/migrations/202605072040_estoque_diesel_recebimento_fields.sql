begin;

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists houve_recebimento boolean not null default false;

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists regua_recebimento_antes_t1 numeric(5,1);

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists regua_recebimento_antes_t2 numeric(5,1);

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists regua_recebimento_depois_t1 numeric(5,1);

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists regua_recebimento_depois_t2 numeric(5,1);

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists foto_regua_antes_url text;

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists foto_regua_depois_url text;

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists recebimento_litros_calculado numeric(10,2);

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists recebimento_tolerancia_litros numeric(10,2);

alter table if exists public.estoque_diesel_medicoes_diarias
  add column if not exists recebimento_dentro_tolerancia boolean;

commit;
