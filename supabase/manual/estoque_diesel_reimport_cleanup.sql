begin;

delete from public.estoque_diesel_leituras_bomba
where medicao_id in (
  select id
  from public.estoque_diesel_medicoes_diarias
  where status_lancamento = 'IMPORTADO_PLANILHA'
);

delete from public.estoque_diesel_medicoes_diarias
where status_lancamento = 'IMPORTADO_PLANILHA';

commit;
