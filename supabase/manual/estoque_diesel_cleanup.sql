begin;

drop view if exists public.v_estoque_diesel_alertas_abertos;
drop view if exists public.v_estoque_diesel_conciliacao;
drop view if exists public.v_estoque_diesel_resumo;
drop view if exists public.v_estoque_diesel_resumo_mensal;
drop view if exists public.v_estoque_diesel_ultima_medicao;

drop function if exists public.estoque_diesel_calcular_volume_litros(numeric, numeric, numeric);

drop table if exists public.estoque_diesel_alertas cascade;
drop table if exists public.estoque_diesel_programacoes cascade;
drop table if exists public.estoque_diesel_inventarios cascade;
drop table if exists public.estoque_diesel_recebimentos cascade;
drop table if exists public.estoque_diesel_operacoes_dia cascade;
drop table if exists public.estoque_diesel_operacoes cascade;
drop table if exists public.estoque_diesel_tolerancias_recebimento cascade;
drop table if exists public.estoque_diesel_regras_estoque cascade;
drop table if exists public.estoque_diesel_regua_litros cascade;
drop table if exists public.estoque_diesel_parametros cascade;
drop table if exists public.estoque_diesel_tolerancias_nf cascade;
drop table if exists public.estoque_diesel_leituras_bomba cascade;
drop table if exists public.estoque_diesel_medicoes_diarias cascade;
drop table if exists public.estoque_diesel_bombas cascade;
drop table if exists public.estoque_diesel_fornecedores cascade;
drop table if exists public.estoque_diesel_tanques cascade;
drop table if exists public.estoque_diesel_locais cascade;
drop table if exists public.estoque_diesel_produtos cascade;

commit;
