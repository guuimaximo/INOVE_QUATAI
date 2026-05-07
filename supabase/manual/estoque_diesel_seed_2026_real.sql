-- Carga real extraida das abas MED.EXT de 2026 (jan-mai) da planilha Controle Diesel Quatai

-- Fonte: Controle Diesel Quatai (4).xlsx

-- Observacao: a planilha possui dados reais somente ate maio de 2026 para este fluxo.

begin;

-- Limpa a importacao automatica anterior antes de recriar os dados validos.

delete from public.estoque_diesel_leituras_bomba
where medicao_id in (
  select id
  from public.estoque_diesel_medicoes_diarias
  where status_lancamento = 'IMPORTADO_PLANILHA'
);

delete from public.estoque_diesel_medicoes_diarias
where status_lancamento = 'IMPORTADO_PLANILHA';



insert into public.estoque_diesel_fornecedores (nome) values ('Ale') on conflict do nothing;

insert into public.estoque_diesel_fornecedores (nome) values ('Combustran') on conflict do nothing;

insert into public.estoque_diesel_fornecedores (nome) values ('Ipiranga') on conflict do nothing;

insert into public.estoque_diesel_fornecedores (nome) values ('Raizen') on conflict do nothing;

insert into public.estoque_diesel_fornecedores (nome) values ('Vibra') on conflict do nothing;

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-01',
  null,
  null,
  119.3,
  0,
  0,
  null,
  null,
  3374,
  null,
  null,
  14368,
  0,
  0,
  14368,
  null,
  17801,
  14368,
  3433,
  0,
  null,
  -0.0172,
  3374,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-02',
  110.6,
  0,
  213.5,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1329,
  13016,
  0,
  27980,
  0,
  13016,
  27980,
  14964,
  14368,
  27980,
  1352,
  -36,
  -0.0024,
  -0.017,
  1330,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-03',
  null,
  null,
  187.6,
  0,
  0,
  null,
  null,
  3397,
  null,
  null,
  24678,
  0,
  0,
  24678,
  null,
  27980,
  24678,
  3302,
  0,
  null,
  0.0288,
  3398,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-04',
  null,
  null,
  164,
  0,
  0,
  null,
  null,
  3114,
  null,
  null,
  21273,
  0,
  0,
  21273,
  null,
  24678,
  21273,
  3405,
  0,
  null,
  -0.0855,
  3114,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-05',
  null,
  null,
  154.3,
  0,
  0,
  null,
  null,
  1377,
  null,
  null,
  19805,
  0,
  0,
  19805,
  null,
  21273,
  19805,
  1468,
  0,
  null,
  -0.062,
  1378,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-06',
  null,
  null,
  124.2,
  0,
  0,
  null,
  null,
  4914,
  null,
  null,
  15133,
  0,
  0,
  15133,
  null,
  19805,
  15133,
  4672,
  0,
  null,
  0.0518,
  4914,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-07',
  91.5,
  0,
  192.3,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Vibra' limit 1),
  null,
  4995,
  10099,
  0,
  25318,
  0,
  10099,
  25318,
  15219,
  15133,
  25318,
  5034,
  219,
  0.0146,
  -0.0077,
  4996,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-08',
  null,
  null,
  156.6,
  0,
  0,
  null,
  null,
  4973,
  null,
  null,
  20156,
  0,
  0,
  20156,
  null,
  25318,
  20156,
  5162,
  0,
  null,
  -0.0366,
  4973,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-09',
  null,
  null,
  127.6,
  0,
  0,
  null,
  null,
  4744,
  null,
  0,
  15664,
  0,
  0,
  15664,
  null,
  20156,
  15664,
  4492,
  0,
  null,
  0.0561,
  4744,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-10',
  96.2,
  0,
  197.2,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Vibra' limit 1),
  null,
  4781,
  10807,
  0,
  25968,
  0,
  10807,
  25968,
  15161,
  15664,
  25968,
  4857,
  161,
  0.0107,
  -0.0156,
  4782,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-11',
  null,
  null,
  172.8,
  0,
  0,
  null,
  null,
  3336,
  null,
  null,
  22574,
  0,
  0,
  22574,
  null,
  25968,
  22574,
  3394,
  0,
  null,
  -0.0171,
  3336,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-12',
  null,
  null,
  163.1,
  0,
  0,
  null,
  null,
  1457,
  null,
  null,
  21138,
  0,
  0,
  21138,
  null,
  22574,
  21138,
  1436,
  0,
  null,
  0.0146,
  1458,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-13',
  null,
  null,
  133.5,
  0,
  0,
  null,
  null,
  4317,
  null,
  null,
  16586,
  0,
  0,
  16586,
  null,
  21138,
  16586,
  4552,
  0,
  null,
  -0.0516,
  4317,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-14',
  null,
  null,
  106.4,
  0,
  0,
  null,
  null,
  4173,
  null,
  null,
  12367,
  0,
  0,
  12367,
  null,
  16586,
  12367,
  4219,
  0,
  null,
  -0.0109,
  4173,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-15',
  78.5,
  0,
  216.7,
  0,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  4176,
  8185,
  0,
  28343,
  0,
  8185,
  28343,
  20158,
  12367,
  28343,
  4182,
  158,
  0.0079,
  -0.0014,
  4176,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-16',
  null,
  null,
  185.5,
  0,
  0,
  null,
  null,
  3920,
  null,
  null,
  24387,
  0,
  0,
  24387,
  null,
  28343,
  24387,
  3956,
  0,
  null,
  -0.0091,
  3921,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-17',
  null,
  null,
  156.8,
  0,
  0,
  null,
  null,
  4107,
  null,
  null,
  20186,
  0,
  0,
  20186,
  null,
  24387,
  20186,
  4201,
  0,
  null,
  -0.0224,
  4108,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-18',
  null,
  null,
  139.5,
  0,
  0,
  null,
  null,
  2714,
  null,
  null,
  17521,
  0,
  0,
  17521,
  null,
  20186,
  17521,
  2665,
  0,
  null,
  0.0184,
  2714,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-19',
  null,
  null,
  127.8,
  0,
  0,
  null,
  null,
  1825,
  null,
  null,
  15696,
  0,
  0,
  15696,
  null,
  17521,
  15696,
  1825,
  0,
  null,
  0,
  1826,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-20',
  98.5,
  0,
  199.3,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ale' limit 1),
  null,
  4410,
  11157,
  0,
  26241,
  0,
  11157,
  26241,
  15084,
  15696,
  26241,
  4539,
  84,
  0.0056,
  -0.0284,
  4410,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-21',
  null,
  null,
  169.3,
  0,
  0,
  null,
  null,
  4132,
  null,
  null,
  22061,
  0,
  0,
  22061,
  null,
  26241,
  22061,
  4180,
  0,
  null,
  -0.0115,
  4133,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-22',
  null,
  null,
  144.5,
  0,
  0,
  null,
  null,
  3758,
  null,
  null,
  18297,
  0,
  0,
  18297,
  null,
  22061,
  18297,
  3764,
  0,
  null,
  -0.0016,
  3757,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-23',
  119.3,
  0,
  228.5,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ale' limit 1),
  null,
  3904,
  14368,
  0,
  29568,
  0,
  14368,
  29568,
  15200,
  18297,
  29568,
  3929,
  200,
  0.0133,
  -0.0064,
  3905,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-24',
  null,
  null,
  190.4,
  0,
  0,
  null,
  null,
  4360,
  null,
  null,
  25061,
  0,
  0,
  25061,
  null,
  29568,
  25061,
  4507,
  0,
  null,
  -0.0326,
  4361,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-25',
  null,
  null,
  173,
  0,
  0,
  null,
  null,
  2618,
  null,
  null,
  22604,
  0,
  0,
  22604,
  null,
  25061,
  22604,
  2457,
  0,
  null,
  0.0655,
  2619,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-26',
  null,
  null,
  164.5,
  0,
  0,
  null,
  null,
  1344,
  null,
  null,
  21347,
  0,
  0,
  21347,
  null,
  22604,
  21347,
  1257,
  0,
  null,
  0.0692,
  1344,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-27',
  null,
  null,
  135.5,
  0,
  0,
  null,
  null,
  4375,
  null,
  null,
  16898,
  0,
  0,
  16898,
  null,
  21347,
  16898,
  4449,
  0,
  null,
  -0.0166,
  4376,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-28',
  null,
  null,
  107.2,
  0,
  0,
  null,
  null,
  4415,
  null,
  null,
  12490,
  0,
  0,
  12490,
  null,
  16898,
  12490,
  4408,
  0,
  null,
  0.0016,
  4416,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-29',
  79.2,
  0,
  218.2,
  0,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4098,
  8286,
  0,
  28509,
  0,
  8286,
  28509,
  20223,
  12490,
  28509,
  4204,
  223,
  0.0112,
  -0.0252,
  4099,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-30',
  null,
  null,
  182.5,
  0,
  0,
  null,
  null,
  4356,
  null,
  null,
  23967,
  0,
  0,
  23967,
  null,
  28509,
  23967,
  4542,
  0,
  null,
  -0.041,
  4357,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-31',
  null,
  null,
  152.5,
  0,
  0,
  null,
  null,
  4472,
  null,
  null,
  19530,
  0,
  0,
  19530,
  null,
  23967,
  19530,
  4437,
  0,
  null,
  0.0079,
  4472,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-01',
  null,
  null,
  134,
  0,
  0,
  null,
  null,
  2905,
  null,
  null,
  16664,
  0,
  0,
  16664,
  null,
  19530,
  16664,
  2866,
  0,
  null,
  0.0136,
  2901,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-02',
  null,
  null,
  122.5,
  0,
  0,
  null,
  null,
  1659,
  null,
  null,
  14868,
  0,
  0,
  14868,
  null,
  16664,
  14868,
  1796,
  0,
  null,
  -0.0763,
  1660,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-03',
  90.2,
  0,
  190.1,
  0,
  15000,
  null,
  null,
  4946,
  9904,
  0,
  25020,
  0,
  9904,
  25020,
  15116,
  14868,
  25020,
  4964,
  116,
  0.0077,
  -0.0036,
  4944,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-04',
  null,
  null,
  156.4,
  0,
  0,
  null,
  null,
  4839,
  null,
  null,
  20125,
  0,
  0,
  20125,
  null,
  25020,
  20125,
  4895,
  0,
  null,
  -0.0114,
  4839,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-05',
  null,
  null,
  126.6,
  0,
  0,
  null,
  null,
  4645,
  null,
  null,
  15508,
  0,
  0,
  15508,
  null,
  20125,
  15508,
  4617,
  0,
  null,
  0.0061,
  4646,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-06',
  97.5,
  0,
  198.1,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  4430,
  11004,
  0,
  26085,
  0,
  11004,
  26085,
  15081,
  15508,
  26085,
  4504,
  81,
  0.0054,
  -0.0164,
  4430,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-07',
  null,
  null,
  165.5,
  0,
  0,
  null,
  null,
  4441,
  null,
  null,
  21497,
  0,
  0,
  21497,
  null,
  26085,
  21497,
  4588,
  0,
  null,
  -0.032,
  4441,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-08',
  null,
  null,
  143.7,
  0,
  0,
  null,
  null,
  3378,
  null,
  null,
  18173,
  0,
  0,
  18173,
  null,
  21497,
  18173,
  3324,
  0,
  null,
  0.0162,
  3378,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-09',
  null,
  null,
  134.3,
  0,
  0,
  null,
  null,
  1446,
  null,
  0,
  16711,
  0,
  0,
  16711,
  null,
  18173,
  16711,
  1462,
  0,
  null,
  -0.0109,
  1447,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-10',
  null,
  null,
  102.3,
  0,
  0,
  null,
  null,
  4939,
  null,
  null,
  11737,
  0,
  0,
  11737,
  null,
  16711,
  11737,
  4974,
  0,
  null,
  -0.007,
  4939,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-11',
  104.2,
  0,
  206.4,
  0,
  15000,
  null,
  null,
  4945,
  12028,
  null,
  27135,
  0,
  12028,
  27135,
  15107,
  27135,
  27135,
  15107,
  107,
  0.0071,
  -0.6727,
  4946,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-12',
  null,
  null,
  170.7,
  0,
  0,
  null,
  null,
  4790,
  null,
  null,
  22267,
  0,
  0,
  22267,
  null,
  27135,
  22267,
  4868,
  0,
  null,
  -0.016,
  4791,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-13',
  null,
  null,
  140,
  0,
  0,
  null,
  null,
  4958,
  null,
  null,
  17599,
  0,
  0,
  17599,
  null,
  22267,
  17599,
  4668,
  0,
  null,
  0.0621,
  4959,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-14',
  null,
  null,
  106.3,
  0,
  0,
  null,
  null,
  5005,
  null,
  null,
  12351,
  0,
  0,
  12351,
  null,
  17599,
  12351,
  5248,
  0,
  null,
  -0.0463,
  5005,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-15',
  null,
  null,
  84.9,
  0,
  0,
  null,
  null,
  3318,
  null,
  null,
  9118,
  0,
  0,
  9118,
  null,
  12351,
  9118,
  3233,
  0,
  null,
  0.0263,
  3318,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-16',
  77.4,
  0,
  214.4,
  0,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  1072,
  8026,
  0,
  28084,
  0,
  8026,
  28084,
  20058,
  9118,
  28084,
  1092,
  58,
  0.0029,
  -0.0183,
  1073,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-17',
  null,
  null,
  185.6,
  0,
  0,
  null,
  null,
  3714,
  null,
  null,
  24401,
  0,
  0,
  24401,
  null,
  28084,
  24401,
  3683,
  0,
  null,
  0.0084,
  3714,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-18',
  null,
  null,
  165.3,
  0,
  0,
  null,
  null,
  2810,
  null,
  null,
  21467,
  0,
  0,
  21467,
  null,
  24401,
  21467,
  2934,
  0,
  null,
  -0.0423,
  2811,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-19',
  null,
  null,
  137.5,
  0,
  0,
  null,
  null,
  4375,
  null,
  null,
  17210,
  0,
  0,
  17210,
  null,
  21467,
  17210,
  4257,
  0,
  null,
  0.0277,
  4375,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-20',
  null,
  null,
  104.3,
  0,
  0,
  null,
  null,
  5004,
  null,
  null,
  12044,
  0,
  0,
  12044,
  null,
  17210,
  12044,
  5166,
  0,
  null,
  -0.0314,
  5005,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-21',
  69.3,
  0,
  205.4,
  0,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  5198,
  6881,
  0,
  27012,
  0,
  6881,
  27012,
  20131,
  12044,
  27012,
  5163,
  131,
  0.0066,
  0.0068,
  5199,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-22',
  null,
  null,
  181.4,
  0,
  0,
  null,
  null,
  3084,
  null,
  null,
  23812,
  0,
  0,
  23812,
  null,
  27012,
  23812,
  3200,
  0,
  null,
  -0.0362,
  3084,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-23',
  null,
  null,
  174.3,
  0,
  0,
  null,
  null,
  1043,
  null,
  null,
  22793,
  0,
  0,
  22793,
  null,
  23812,
  22793,
  1019,
  0,
  null,
  0.0236,
  1043,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-24',
  null,
  null,
  140,
  0,
  0,
  null,
  null,
  5145,
  null,
  null,
  17599,
  0,
  0,
  17599,
  null,
  22793,
  17599,
  5194,
  0,
  null,
  -0.0094,
  5146,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-25',
  121.8,
  0,
  232.7,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  2845,
  14758,
  0,
  29953,
  0,
  14758,
  29953,
  15195,
  17599,
  29953,
  2841,
  195,
  0.013,
  0.0014,
  2845,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-26',
  null,
  null,
  190.5,
  0,
  0,
  null,
  null,
  4821,
  null,
  null,
  25075,
  0,
  0,
  25075,
  null,
  29953,
  25075,
  4878,
  0,
  null,
  -0.0117,
  4822,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-27',
  null,
  null,
  158.3,
  0,
  0,
  null,
  null,
  4681,
  null,
  null,
  20414,
  0,
  0,
  20414,
  null,
  25075,
  20414,
  4661,
  0,
  null,
  0.0043,
  4682,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-28',
  null,
  null,
  128,
  0,
  0,
  null,
  null,
  4661,
  null,
  null,
  15727,
  0,
  0,
  15727,
  null,
  20414,
  15727,
  4687,
  0,
  null,
  -0.0055,
  4661,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-01',
  null,
  null,
  107,
  0,
  0,
  null,
  null,
  3237,
  null,
  null,
  12459,
  0,
  0,
  12459,
  null,
  15727,
  12459,
  3268,
  0,
  null,
  -0.0095,
  3238,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-02',
  97.6,
  0,
  198.6,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1428,
  11020,
  0,
  26150,
  0,
  11020,
  26150,
  15130,
  12459,
  26150,
  1439,
  130,
  0.0087,
  -0.0076,
  1428,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-03',
  null,
  null,
  164.4,
  0,
  0,
  null,
  null,
  4712,
  null,
  null,
  21332,
  0,
  0,
  21332,
  null,
  26150,
  21332,
  4818,
  0,
  null,
  -0.022,
  4712,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-04',
  null,
  null,
  134.8,
  0,
  0,
  null,
  null,
  4719,
  null,
  null,
  16789,
  0,
  0,
  16789,
  null,
  21332,
  16789,
  4543,
  0,
  null,
  0.0387,
  4719,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-05',
  101.6,
  0,
  203.2,
  0,
  15000,
  null,
  null,
  4950,
  11630,
  0,
  26738,
  0,
  11630,
  26738,
  15108,
  16789,
  26738,
  5159,
  108,
  0.0072,
  -0.0405,
  4952,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-06',
  null,
  null,
  169.5,
  0,
  0,
  null,
  null,
  4613,
  null,
  null,
  22090,
  0,
  0,
  22090,
  null,
  26738,
  22090,
  4648,
  0,
  null,
  -0.0075,
  4614,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-07',
  null,
  null,
  138.3,
  0,
  0,
  null,
  null,
  4777,
  null,
  null,
  17334,
  0,
  0,
  17334,
  null,
  22090,
  17334,
  4756,
  0,
  null,
  0.0044,
  4777,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-08',
  null,
  null,
  118,
  0,
  0,
  null,
  null,
  3240,
  null,
  null,
  14166,
  0,
  0,
  14166,
  null,
  17334,
  14166,
  3168,
  0,
  null,
  0.0227,
  3240,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-09',
  108.8,
  0,
  174.04,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1331,
  12737,
  0,
  22755,
  0,
  12737,
  22755,
  10018,
  14166,
  22755,
  1429,
  18,
  0.0018,
  -0.0686,
  1331,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-10',
  null,
  null,
  142.5,
  0,
  0,
  null,
  null,
  4801,
  null,
  null,
  17987,
  0,
  0,
  17987,
  null,
  22755,
  17987,
  4768,
  0,
  null,
  0.0069,
  4801,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-11',
  111.7,
  0,
  144.5,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4757,
  13186,
  0,
  18297,
  0,
  13186,
  18297,
  5111,
  17987,
  18297,
  4801,
  111,
  0.0222,
  -0.0092,
  4758,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-12',
  115,
  0,
  148.5,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4595,
  13699,
  null,
  18915,
  0,
  13699,
  18915,
  5216,
  18297,
  18915,
  4598,
  216,
  0.0432,
  -0.0007,
  4595,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-13',
  148,
  0,
  219,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Combustran' limit 1),
  null,
  4998,
  18838,
  0,
  28597,
  0,
  18838,
  28597,
  9759,
  18838,
  28597,
  0,
  -241,
  -0.0241,
  null,
  4999,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-14',
  182.5,
  0,
  224.5,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4703,
  23967,
  0,
  29174,
  0,
  23967,
  29174,
  5207,
  28597,
  29174,
  4630,
  207,
  0.0414,
  0.0158,
  4704,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-15',
  null,
  null,
  198.5,
  0,
  0,
  null,
  null,
  3009,
  null,
  null,
  26137,
  0,
  0,
  26137,
  null,
  29174,
  26137,
  3037,
  0,
  null,
  -0.0092,
  3009,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-16',
  187.7,
  0,
  230,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1400,
  24692,
  0,
  29709,
  0,
  24692,
  29709,
  5017,
  26137,
  29709,
  1445,
  17,
  0.0034,
  -0.0311,
  1401,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-17',
  null,
  null,
  187.5,
  0,
  0,
  null,
  null,
  5075,
  null,
  null,
  24664,
  0,
  0,
  24664,
  null,
  29709,
  24664,
  5045,
  0,
  null,
  0.0059,
  5076,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-18',
  153.7,
  0,
  231,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4835,
  19713,
  0,
  29801,
  0,
  19713,
  29801,
  10088,
  24664,
  29801,
  4951,
  88,
  0.0088,
  -0.0234,
  4835,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-19',
  189.2,
  0,
  232.5,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4821,
  24897,
  0,
  29935,
  0,
  24897,
  29935,
  5038,
  29801,
  29935,
  4904,
  38,
  0.0076,
  -0.0169,
  4821,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-20',
  null,
  null,
  192.5,
  0,
  0,
  null,
  null,
  4782,
  null,
  null,
  25345,
  0,
  0,
  25345,
  null,
  29935,
  25345,
  4590,
  0,
  null,
  0.0418,
  4783,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-21',
  158.7,
  0,
  238.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4899,
  20474,
  0,
  30432,
  0,
  20474,
  30432,
  9958,
  25345,
  30432,
  4871,
  -42,
  -0.0042,
  0.0057,
  4899,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-22',
  null,
  null,
  207.6,
  0,
  0,
  null,
  null,
  3006,
  null,
  null,
  27281,
  0,
  0,
  27281,
  null,
  30432,
  27281,
  3151,
  0,
  null,
  -0.046,
  3007,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-23',
  null,
  null,
  0,
  195.5,
  0,
  null,
  null,
  1420,
  null,
  null,
  0,
  25745,
  0,
  25745,
  null,
  27281,
  25745,
  1536,
  0,
  null,
  -0.0755,
  1421,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-24',
  161.8,
  0,
  197.5,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4966,
  20942,
  0,
  26007,
  0,
  20942,
  26007,
  5065,
  25745,
  26007,
  4803,
  65,
  0.013,
  0.0339,
  4966,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-25',
  null,
  null,
  164,
  0,
  0,
  null,
  null,
  4755,
  null,
  null,
  21273,
  0,
  0,
  21273,
  null,
  26007,
  21273,
  4734,
  0,
  null,
  0.0044,
  4756,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-26',
  131.6,
  0,
  200.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4983,
  16289,
  0,
  26395,
  0,
  16289,
  26395,
  10106,
  21273,
  26395,
  4984,
  106,
  0.0106,
  -0.0002,
  4983,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-27',
  167.3,
  0,
  204.6,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4694,
  21765,
  0,
  26913,
  0,
  21765,
  26913,
  5148,
  26395,
  26913,
  4630,
  148,
  0.0296,
  0.0138,
  4693,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-28',
  null,
  null,
  165.5,
  0,
  0,
  null,
  null,
  5198,
  null,
  null,
  21497,
  0,
  0,
  21497,
  null,
  26913,
  21497,
  5416,
  0,
  null,
  -0.0403,
  5198,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-29',
  null,
  null,
  142,
  0,
  0,
  null,
  null,
  3540,
  null,
  null,
  17909,
  0,
  0,
  17909,
  null,
  21497,
  17909,
  3588,
  0,
  null,
  -0.0134,
  3541,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-30',
  131.3,
  0,
  165,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1675,
  16242,
  0,
  21422,
  0,
  16242,
  21422,
  5180,
  17909,
  21422,
  1667,
  180,
  0.036,
  0.0048,
  1676,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-31',
  131.5,
  0,
  200.4,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4909,
  16274,
  0,
  26382,
  0,
  16274,
  26382,
  10108,
  21422,
  26382,
  5148,
  108,
  0.0108,
  -0.0464,
  4910,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-01',
  165.4,
  0,
  202.4,
  0,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4848,
  21482,
  0,
  26637,
  0,
  21482,
  26637,
  5155,
  26382,
  26637,
  4900,
  155,
  0.031,
  -0.0106,
  4842,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-02',
  165.5,
  0,
  249,
  0,
  9600,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  5080,
  21497,
  0,
  31096,
  0,
  21497,
  31096,
  9599,
  26637,
  31096,
  5140,
  -1,
  -0.0001,
  -0.0117,
  5080,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-03',
  null,
  null,
  197.8,
  0,
  0,
  null,
  null,
  5072,
  null,
  null,
  26046,
  0,
  0,
  26046,
  null,
  31096,
  26046,
  5050,
  0,
  null,
  0.0044,
  5073,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-04',
  null,
  null,
  185.6,
  0,
  0,
  null,
  null,
  1638,
  null,
  null,
  24401,
  0,
  0,
  24401,
  null,
  26046,
  24401,
  1645,
  0,
  null,
  -0.0043,
  1638,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-05',
  null,
  null,
  165.5,
  0,
  0,
  null,
  null,
  3057,
  null,
  null,
  21497,
  0,
  0,
  21497,
  null,
  24401,
  21497,
  2904,
  0,
  null,
  0.0527,
  3057,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-06',
  156.5,
  0,
  235.7,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1449,
  20140,
  0,
  30209,
  0,
  20140,
  30209,
  10069,
  21497,
  30209,
  1357,
  69,
  0.0069,
  0.0678,
  1449,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-07',
  null,
  null,
  188.8,
  0,
  0,
  null,
  null,
  5048,
  null,
  null,
  24843,
  0,
  0,
  24843,
  null,
  30209,
  24843,
  5366,
  0,
  null,
  -0.0593,
  5048,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-08',
  154.5,
  0,
  231.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  5087,
  19836,
  0,
  29846,
  0,
  19836,
  29846,
  10010,
  24843,
  29846,
  5007,
  10,
  0.001,
  0.016,
  5088,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-09',
  null,
  null,
  197,
  0,
  0,
  null,
  null,
  5275,
  null,
  null,
  25942,
  0,
  0,
  25942,
  null,
  29846,
  25942,
  3904,
  0,
  null,
  0.3512,
  5275,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-10',
  153.5,
  0,
  231,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4900,
  19683,
  0,
  29801,
  0,
  19683,
  29801,
  10118,
  25942,
  29801,
  6259,
  118,
  0.0118,
  -0.2171,
  4900,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-11',
  null,
  null,
  188.6,
  0,
  0,
  null,
  null,
  4867,
  null,
  null,
  24815,
  0,
  0,
  24815,
  null,
  29801,
  24815,
  4986,
  0,
  null,
  -0.0239,
  4868,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-12',
  null,
  null,
  165.7,
  0,
  0,
  null,
  null,
  3217,
  null,
  null,
  21527,
  0,
  0,
  21527,
  null,
  24815,
  21527,
  3288,
  0,
  null,
  -0.0216,
  3216,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-13',
  null,
  null,
  155.8,
  0,
  0,
  null,
  null,
  1462,
  null,
  null,
  20034,
  0,
  0,
  20034,
  null,
  21527,
  20034,
  1493,
  0,
  null,
  -0.0208,
  1460,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-14',
  125.5,
  0,
  192.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4760,
  15336,
  0,
  25345,
  0,
  15336,
  25345,
  10009,
  20034,
  25345,
  4698,
  9,
  0.0009,
  0.0132,
  4760,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-15',
  null,
  null,
  157.7,
  0,
  0,
  null,
  null,
  4953,
  null,
  null,
  20323,
  0,
  0,
  20323,
  null,
  25345,
  20323,
  5022,
  0,
  null,
  -0.0137,
  4954,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-16',
  127,
  0,
  194.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4858,
  15571,
  0,
  25612,
  0,
  15571,
  25612,
  10041,
  20323,
  25612,
  4752,
  41,
  0.0041,
  0.0223,
  4858,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-17',
  null,
  null,
  158.7,
  0,
  0,
  null,
  null,
  4859,
  null,
  null,
  20474,
  0,
  0,
  20474,
  null,
  25612,
  20474,
  5138,
  0,
  null,
  -0.0543,
  4859,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-18',
  null,
  null,
  128.7,
  0,
  0,
  null,
  null,
  4723,
  null,
  null,
  15836,
  0,
  0,
  15836,
  null,
  20474,
  15836,
  4638,
  0,
  null,
  0.0183,
  4723,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-19',
  null,
  null,
  106.4,
  0,
  0,
  null,
  null,
  3403,
  null,
  null,
  12367,
  0,
  0,
  12367,
  null,
  15836,
  12367,
  3469,
  0,
  null,
  -0.019,
  3403,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-20',
  95.4,
  0,
  161.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1826,
  10686,
  0,
  20897,
  0,
  10686,
  20897,
  10211,
  12367,
  20897,
  1681,
  211,
  0.0211,
  0.0863,
  1823,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-21',
  null,
  null,
  134.3,
  0,
  0,
  null,
  null,
  4010,
  null,
  null,
  16711,
  0,
  0,
  16711,
  null,
  20897,
  16711,
  4186,
  0,
  null,
  -0.042,
  4011,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-22',
  122.8,
  0,
  189.4,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1756,
  14914,
  0,
  24925,
  0,
  14914,
  24925,
  10011,
  16711,
  24925,
  1797,
  11,
  0.0011,
  -0.0228,
  1754,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-23',
  null,
  null,
  153.6,
  0,
  0,
  null,
  null,
  4958,
  null,
  null,
  19698,
  0,
  0,
  19698,
  null,
  24925,
  19698,
  5227,
  0,
  null,
  -0.0515,
  4955,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-24',
  124.7,
  0,
  191.5,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  4723,
  15211,
  0,
  25210,
  0,
  15211,
  25210,
  9999,
  19698,
  25210,
  4487,
  -1,
  -0.0001,
  0.0526,
  4723,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-25',
  null,
  null,
  158.2,
  0,
  0,
  null,
  null,
  4603,
  null,
  null,
  20399,
  0,
  0,
  20399,
  null,
  25210,
  20399,
  4811,
  0,
  null,
  -0.0432,
  4603,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-26',
  null,
  null,
  138,
  0,
  0,
  null,
  null,
  3007,
  null,
  null,
  17287,
  0,
  0,
  17287,
  null,
  20399,
  17287,
  3112,
  0,
  null,
  -0.0337,
  3002,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-27',
  null,
  null,
  130.4,
  0,
  0,
  null,
  null,
  1414,
  null,
  null,
  16102,
  0,
  0,
  16102,
  null,
  17287,
  16102,
  1185,
  0,
  null,
  0.1932,
  1413,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-28',
  100.5,
  0,
  201.9,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Combustran' limit 1),
  null,
  4629,
  11461,
  0,
  26573,
  0,
  11461,
  26573,
  15112,
  16102,
  26573,
  4641,
  112,
  0.0075,
  -0.0026,
  4627,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-29',
  null,
  null,
  168.6,
  0,
  0,
  null,
  null,
  4554,
  null,
  null,
  21957,
  0,
  0,
  21957,
  null,
  26573,
  21957,
  4616,
  0,
  null,
  -0.0134,
  4554,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-30',
  136,
  0,
  205.6,
  0,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  5050,
  16976,
  0,
  27037,
  0,
  16976,
  27037,
  10061,
  21957,
  27037,
  4981,
  61,
  0.0061,
  0.0139,
  5051,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-01',
  null,
  null,
  170.4,
  0,
  0,
  null,
  null,
  4640,
  null,
  null,
  22223,
  0,
  0,
  22223,
  null,
  27037,
  22223,
  4814,
  0,
  null,
  -0.0361,
  4640,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-02',
  null,
  null,
  157.4,
  0,
  0,
  null,
  null,
  1924,
  null,
  null,
  20277,
  0,
  0,
  20277,
  null,
  22223,
  20277,
  1946,
  0,
  null,
  -0.0113,
  1925,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-03',
  null,
  null,
  138.5,
  0,
  0,
  null,
  null,
  2940,
  null,
  null,
  17365,
  0,
  0,
  17365,
  null,
  20277,
  17365,
  2912,
  0,
  null,
  0.0096,
  2941,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-04',
  null,
  null,
  127.7,
  0,
  0,
  null,
  null,
  1679,
  null,
  null,
  15680,
  0,
  0,
  15680,
  null,
  17365,
  15680,
  1685,
  0,
  null,
  -0.0036,
  1679,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-05',
  98.4,
  0,
  199.3,
  0,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  0,
  11141,
  0,
  26241,
  0,
  11141,
  26241,
  15100,
  15680,
  26241,
  4539,
  100,
  0.0067,
  -1,
  0,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-06',
  null,
  0,
  164.4,
  0,
  0,
  null,
  null,
  0,
  null,
  0,
  21332,
  0,
  0,
  21332,
  null,
  26241,
  21332,
  4909,
  0,
  null,
  -1,
  0,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S10'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-01',
  null,
  null,
  0,
  109.9,
  0,
  null,
  null,
  2480,
  null,
  null,
  0,
  12907,
  0,
  12907,
  null,
  15446,
  12907,
  2539,
  0,
  null,
  -0.0232,
  2481,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-02',
  0,
  100.5,
  0,
  201.5,
  15000,
  null,
  null,
  1466,
  0,
  11461,
  0,
  26523,
  11461,
  26523,
  15062,
  12907,
  26461,
  1446,
  62,
  0.0041,
  0.0138,
  1466,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-03',
  null,
  null,
  0,
  177.5,
  0,
  null,
  null,
  3069,
  null,
  null,
  0,
  23255,
  0,
  23255,
  null,
  26461,
  23255,
  3206,
  0,
  null,
  -0.0427,
  3069,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-04',
  null,
  null,
  0,
  163,
  0,
  null,
  null,
  2107,
  null,
  null,
  0,
  21123,
  0,
  21123,
  null,
  23255,
  21123,
  2132,
  0,
  null,
  -0.0117,
  2107,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-05',
  null,
  null,
  0,
  151,
  0,
  null,
  null,
  1780,
  null,
  null,
  0,
  19300,
  0,
  19300,
  null,
  21123,
  19300,
  1823,
  0,
  null,
  -0.0236,
  1781,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-06',
  null,
  null,
  0,
  126.5,
  0,
  null,
  null,
  3852,
  null,
  null,
  0,
  15492,
  0,
  15492,
  null,
  19300,
  15492,
  null,
  0,
  null,
  null,
  3852,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-07',
  0,
  104.1,
  0,
  206.3,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Vibra' limit 1),
  null,
  3609,
  0,
  12013,
  0,
  27123,
  12013,
  27123,
  15110,
  15492,
  27013,
  3479,
  110,
  0.0073,
  0.0374,
  3610,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-08',
  null,
  null,
  0,
  177.5,
  0,
  null,
  null,
  3927,
  null,
  null,
  0,
  23255,
  0,
  23255,
  null,
  27013,
  23255,
  3758,
  0,
  null,
  0.045,
  3928,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-09',
  null,
  null,
  0,
  152.2,
  0,
  null,
  null,
  3755,
  null,
  null,
  0,
  19484,
  0,
  19484,
  null,
  23255,
  19484,
  3771,
  0,
  null,
  -0.0042,
  3756,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-10',
  0,
  127.8,
  0,
  241,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Vibra' limit 1),
  null,
  3724,
  0,
  15696,
  0,
  30617,
  15696,
  30617,
  14921,
  19484,
  30696,
  3788,
  -79,
  -0.0053,
  -0.0169,
  3725,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-11',
  null,
  null,
  0,
  217.2,
  0,
  null,
  null,
  2354,
  null,
  null,
  0,
  28399,
  0,
  28399,
  null,
  30696,
  28399,
  2297,
  0,
  null,
  0.0248,
  2354,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-12',
  null,
  null,
  0,
  202.4,
  0,
  null,
  null,
  1830,
  null,
  null,
  0,
  26637,
  0,
  26637,
  null,
  28399,
  26637,
  1762,
  0,
  null,
  0.0386,
  1830,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-13',
  null,
  null,
  0,
  169.6,
  0,
  null,
  null,
  4074,
  null,
  null,
  0,
  22105,
  0,
  22105,
  null,
  26637,
  22105,
  4532,
  0,
  null,
  -0.1011,
  4076,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-14',
  null,
  null,
  0,
  140,
  0,
  null,
  null,
  4617,
  null,
  null,
  0,
  17599,
  0,
  17599,
  null,
  22105,
  17599,
  4506,
  0,
  null,
  0.0246,
  4617,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-15',
  0,
  110.4,
  0,
  214.5,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  4644,
  0,
  12985,
  0,
  28095,
  12985,
  28095,
  15110,
  17599,
  27985,
  4614,
  110,
  0.0073,
  0.0065,
  4644,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-17',
  null,
  null,
  0,
  142.3,
  0,
  null,
  null,
  5011,
  null,
  null,
  0,
  17956,
  0,
  17956,
  null,
  null,
  17956,
  -17956,
  0,
  null,
  -1.2791,
  5012,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-18',
  null,
  null,
  0,
  125.5,
  0,
  null,
  null,
  2645,
  null,
  null,
  0,
  15336,
  0,
  15336,
  null,
  17956,
  15336,
  2620,
  0,
  null,
  0.0095,
  2646,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-19',
  null,
  null,
  0,
  116.4,
  0,
  null,
  null,
  1456,
  null,
  null,
  0,
  13916,
  0,
  13916,
  null,
  15336,
  13916,
  1420,
  0,
  null,
  0.0254,
  1456,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-20',
  0,
  88.5,
  0,
  232.9,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ale' limit 1),
  null,
  4191,
  0,
  9651,
  0,
  29971,
  9651,
  29971,
  20320,
  13916,
  29651,
  4265,
  320,
  0.016,
  -0.0174,
  4191,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-21',
  null,
  null,
  0,
  190,
  0,
  null,
  null,
  4760,
  null,
  null,
  0,
  25007,
  0,
  25007,
  null,
  29651,
  25007,
  4644,
  0,
  null,
  0.025,
  4761,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-22',
  null,
  null,
  0,
  157.3,
  0,
  null,
  null,
  4721,
  null,
  null,
  0,
  20262,
  0,
  20262,
  null,
  25007,
  20262,
  4745,
  0,
  null,
  -0.0051,
  4720,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-23',
  null,
  null,
  0,
  126,
  0,
  null,
  null,
  4825,
  null,
  null,
  0,
  15414,
  0,
  15414,
  null,
  20262,
  15414,
  4848,
  0,
  null,
  -0.0047,
  4827,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-24',
  null,
  null,
  0,
  96.5,
  0,
  null,
  null,
  4514,
  null,
  null,
  0,
  10853,
  0,
  10853,
  null,
  15414,
  10853,
  4561,
  0,
  null,
  -0.0103,
  4514,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-25',
  null,
  null,
  0,
  78.7,
  0,
  null,
  null,
  2720,
  null,
  null,
  0,
  8214,
  0,
  8214,
  null,
  10853,
  8214,
  2639,
  0,
  null,
  0.0307,
  2721,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-26',
  0,
  65.3,
  0,
  201.5,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ale' limit 1),
  null,
  1928,
  0,
  6330,
  0,
  26523,
  6330,
  26523,
  20193,
  8214,
  26330,
  1884,
  193,
  0.0097,
  0.0234,
  1928,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-27',
  null,
  null,
  0,
  167.5,
  0,
  null,
  null,
  4623,
  null,
  null,
  0,
  21794,
  0,
  21794,
  null,
  null,
  21794,
  -21794,
  0,
  null,
  -1.2121,
  4624,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-28',
  null,
  null,
  0,
  140.2,
  0,
  null,
  null,
  4171,
  null,
  null,
  0,
  17630,
  0,
  17630,
  null,
  21794,
  17630,
  4164,
  0,
  null,
  0.0017,
  4172,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-29',
  0,
  109.5,
  0,
  214.6,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Vibra' limit 1),
  null,
  4559,
  0,
  12845,
  0,
  28106,
  12845,
  28106,
  15261,
  17630,
  27845,
  4785,
  261,
  0.0174,
  -0.0472,
  4560,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-30',
  null,
  null,
  0,
  180.2,
  0,
  null,
  null,
  4333,
  null,
  null,
  0,
  23641,
  0,
  23641,
  null,
  27845,
  23641,
  4204,
  0,
  null,
  0.0307,
  4334,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-01-31',
  null,
  null,
  0,
  151.3,
  0,
  null,
  null,
  4171,
  null,
  null,
  0,
  19346,
  0,
  19346,
  null,
  23641,
  19346,
  4295,
  0,
  null,
  -0.0289,
  4171,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-01',
  null,
  null,
  0,
  131.5,
  0,
  null,
  null,
  3033,
  null,
  null,
  0,
  16274,
  0,
  16274,
  null,
  19346,
  16274,
  3072,
  0,
  null,
  -0.0127,
  3034,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-02',
  null,
  null,
  0,
  120.8,
  0,
  null,
  null,
  1604,
  null,
  null,
  0,
  14602,
  0,
  14602,
  null,
  16274,
  14602,
  1672,
  0,
  null,
  -0.0407,
  1604,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-03',
  0,
  93.5,
  0,
  194.5,
  15000,
  null,
  null,
  4192,
  0,
  10399,
  0,
  25612,
  10399,
  25612,
  15213,
  14602,
  25399,
  4203,
  213,
  0.0142,
  -0.0026,
  4192,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-04',
  null,
  null,
  0,
  162.6,
  0,
  null,
  null,
  4484,
  null,
  null,
  0,
  21063,
  0,
  21063,
  null,
  25399,
  21063,
  4336,
  0,
  null,
  0.0341,
  4485,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-05',
  null,
  null,
  0,
  133.7,
  0,
  null,
  null,
  4423,
  null,
  null,
  0,
  16617,
  0,
  16617,
  null,
  21063,
  16617,
  4446,
  0,
  null,
  -0.0052,
  4423,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-06',
  0,
  104.3,
  0,
  206.7,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  4583,
  0,
  12044,
  0,
  27172,
  12044,
  27172,
  15128,
  16617,
  27044,
  null,
  128,
  0.0085,
  null,
  4584,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-07',
  null,
  null,
  0,
  172.2,
  0,
  null,
  null,
  4413,
  null,
  null,
  0,
  22487,
  0,
  22487,
  null,
  27044,
  22487,
  4557,
  0,
  null,
  -0.0316,
  4412,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-08',
  null,
  null,
  0,
  156.4,
  0,
  null,
  null,
  2402,
  null,
  null,
  0,
  20125,
  0,
  20125,
  null,
  22487,
  20125,
  2362,
  0,
  null,
  0.0169,
  2403,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-09',
  null,
  null,
  0,
  143.3,
  0,
  null,
  null,
  1998,
  null,
  null,
  0,
  18111,
  0,
  18111,
  null,
  20125,
  18111,
  2014,
  0,
  null,
  -0.0079,
  1998,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-10',
  null,
  null,
  0,
  113.4,
  0,
  null,
  null,
  4515,
  null,
  null,
  0,
  13450,
  0,
  13450,
  null,
  18111,
  13450,
  4661,
  0,
  null,
  -0.0313,
  4516,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-11',
  0,
  84.7,
  0,
  225.7,
  20000,
  null,
  null,
  4538,
  0,
  9088,
  0,
  29295,
  9088,
  29295,
  20207,
  13450,
  29088,
  4362,
  207,
  0.0103,
  0.0403,
  4538,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-12',
  null,
  null,
  0,
  187.6,
  0,
  null,
  null,
  4339,
  null,
  null,
  0,
  24678,
  0,
  24678,
  null,
  29088,
  24678,
  4410,
  0,
  null,
  -0.0161,
  4339,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-13',
  null,
  null,
  0,
  160,
  0,
  null,
  null,
  4236,
  null,
  null,
  0,
  20671,
  0,
  20671,
  null,
  24678,
  20671,
  4007,
  0,
  null,
  0.0571,
  4236,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-14',
  null,
  null,
  0,
  131,
  0,
  null,
  null,
  4217,
  null,
  null,
  0,
  16195,
  0,
  16195,
  null,
  20671,
  16195,
  4476,
  0,
  null,
  -0.0579,
  4218,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-15',
  null,
  null,
  0,
  116,
  0,
  null,
  null,
  2379,
  null,
  null,
  0,
  13854,
  0,
  13854,
  null,
  16195,
  13854,
  2341,
  0,
  null,
  0.0162,
  2379,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-16',
  0,
  102.3,
  0,
  204.3,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  2189,
  0,
  11737,
  0,
  26875,
  11737,
  26875,
  15138,
  13854,
  26737,
  2117,
  138,
  0.0092,
  0.034,
  2190,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-17',
  null,
  null,
  0,
  181.7,
  0,
  null,
  null,
  2873,
  null,
  null,
  0,
  23854,
  0,
  23854,
  null,
  26737,
  23854,
  2883,
  0,
  null,
  -0.0035,
  2873,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-18',
  null,
  null,
  0,
  163.3,
  0,
  null,
  null,
  2746,
  null,
  null,
  0,
  21168,
  0,
  21168,
  null,
  23854,
  21168,
  2686,
  0,
  null,
  0.0223,
  2747,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-19',
  null,
  null,
  0,
  136.4,
  0,
  null,
  null,
  4198,
  null,
  null,
  0,
  17038,
  0,
  17038,
  null,
  21168,
  17038,
  4130,
  0,
  null,
  0.0165,
  4199,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-20',
  null,
  null,
  0,
  108.3,
  0,
  null,
  null,
  4101,
  null,
  null,
  0,
  12660,
  0,
  12660,
  null,
  17038,
  12660,
  4378,
  0,
  null,
  -0.0633,
  4101,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-21',
  0,
  80.5,
  0,
  179.9,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Ipiranga' limit 1),
  null,
  4287,
  0,
  8474,
  0,
  23599,
  8474,
  23599,
  15125,
  12660,
  23474,
  4186,
  125,
  0.0083,
  0.0241,
  4287,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-22',
  null,
  null,
  0,
  159.5,
  0,
  null,
  null,
  2783,
  null,
  null,
  0,
  20595,
  0,
  20595,
  null,
  23474,
  20595,
  2879,
  0,
  null,
  -0.0333,
  2783,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-23',
  null,
  null,
  0,
  145.6,
  0,
  null,
  null,
  2134,
  null,
  null,
  0,
  18467,
  0,
  18467,
  null,
  20595,
  18467,
  2128,
  0,
  null,
  0.0028,
  2135,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-24',
  null,
  null,
  0,
  117.5,
  0,
  null,
  null,
  4307,
  null,
  null,
  0,
  14088,
  0,
  14088,
  null,
  18467,
  14088,
  4379,
  0,
  null,
  -0.0164,
  4308,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-25',
  0,
  74.9,
  0,
  213.3,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  6481,
  0,
  7669,
  0,
  27957,
  7669,
  27957,
  20288,
  14088,
  27669,
  6419,
  288,
  0.0144,
  0.0097,
  6480,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-26',
  null,
  null,
  0,
  176.4,
  0,
  null,
  null,
  4566,
  null,
  null,
  0,
  23097,
  0,
  23097,
  null,
  27669,
  23097,
  4572,
  0,
  null,
  -0.0013,
  4567,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-27',
  null,
  null,
  0,
  145.4,
  0,
  null,
  null,
  4723,
  null,
  null,
  0,
  18436,
  0,
  18436,
  null,
  null,
  18436,
  -18436,
  0,
  null,
  -1.2562,
  4723,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-02-28',
  null,
  null,
  0,
  115,
  0,
  null,
  null,
  4658,
  null,
  null,
  0,
  13699,
  0,
  13699,
  null,
  18436,
  13699,
  4737,
  0,
  null,
  -0.0167,
  4659,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-01',
  null,
  null,
  0,
  99,
  0,
  null,
  null,
  2480,
  null,
  null,
  0,
  11233,
  0,
  11233,
  null,
  13699,
  11233,
  2466,
  0,
  null,
  0.0057,
  2481,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-02',
  0,
  87.8,
  0,
  188.3,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1702,
  0,
  9547,
  0,
  24774,
  9547,
  24774,
  15227,
  11233,
  24547,
  1686,
  227,
  0.0151,
  0.0095,
  1702,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-03',
  null,
  null,
  0,
  154.5,
  0,
  null,
  null,
  4647,
  null,
  null,
  0,
  19836,
  0,
  19836,
  null,
  24547,
  19836,
  4711,
  0,
  null,
  -0.0136,
  4646,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-04',
  null,
  null,
  0,
  126.3,
  0,
  null,
  null,
  4505,
  null,
  null,
  0,
  15461,
  0,
  15461,
  null,
  19836,
  15461,
  4375,
  0,
  null,
  0.0297,
  4506,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-05',
  0,
  95.4,
  0,
  195.7,
  15000,
  null,
  null,
  4625,
  0,
  10686,
  0,
  25771,
  10686,
  25771,
  15085,
  15461,
  25686,
  4775,
  85,
  0.0057,
  -0.0314,
  4625,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-06',
  null,
  null,
  0,
  160.5,
  0,
  null,
  null,
  4889,
  null,
  null,
  0,
  20747,
  0,
  20747,
  null,
  25686,
  20747,
  null,
  0,
  null,
  null,
  4890,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-07',
  null,
  null,
  0,
  131.6,
  0,
  null,
  null,
  4434,
  null,
  null,
  0,
  16289,
  0,
  16289,
  null,
  20747,
  16289,
  4458,
  0,
  null,
  -0.0054,
  4434,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-08',
  null,
  null,
  0,
  115.5,
  0,
  null,
  null,
  2500,
  null,
  null,
  0,
  13776,
  0,
  13776,
  null,
  16289,
  13776,
  2513,
  0,
  null,
  -0.0052,
  2500,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-09',
  null,
  null,
  0,
  102.7,
  0,
  null,
  null,
  2005,
  null,
  null,
  0,
  11798,
  0,
  11798,
  null,
  13776,
  11798,
  1978,
  0,
  null,
  0.0137,
  2005,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-10',
  null,
  null,
  0,
  70.5,
  0,
  null,
  null,
  4662,
  null,
  null,
  0,
  7048,
  0,
  7048,
  null,
  11798,
  7048,
  4750,
  0,
  null,
  -0.0185,
  4663,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-11',
  0,
  34.4,
  0,
  74.4,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4536,
  0,
  2524,
  0,
  7598,
  2524,
  7598,
  5074,
  7048,
  7524,
  4524,
  74,
  0.0148,
  0.0027,
  4537,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-12',
  0,
  37,
  0,
  76.7,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4624,
  0,
  2805,
  0,
  7926,
  2805,
  7926,
  5121,
  7524,
  7805,
  4719,
  121,
  0.0242,
  -0.0201,
  4624,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-13',
  0,
  43.2,
  0,
  81,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Combustran' limit 1),
  null,
  4305,
  0,
  3511,
  0,
  8547,
  3511,
  8547,
  5036,
  7805,
  8511,
  4294,
  36,
  0.0072,
  0.0026,
  4305,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-14',
  0,
  46.3,
  0,
  183.9,
  20000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4542,
  0,
  3879,
  0,
  24164,
  3879,
  24164,
  20285,
  8511,
  23879,
  4632,
  285,
  0.0143,
  -0.0194,
  4543,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-15',
  null,
  null,
  0,
  164.1,
  0,
  null,
  null,
  2731,
  null,
  null,
  0,
  21288,
  0,
  21288,
  null,
  23879,
  21288,
  2591,
  0,
  null,
  0.054,
  2732,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-16',
  0,
  152.4,
  0,
  229.5,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1909,
  0,
  19514,
  0,
  29662,
  19514,
  29662,
  10148,
  21288,
  29514,
  1774,
  148,
  0.0148,
  0.0761,
  1909,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-17',
  null,
  null,
  0,
  190.8,
  0,
  null,
  null,
  4366,
  null,
  null,
  0,
  25115,
  0,
  25115,
  null,
  29514,
  25115,
  4399,
  0,
  null,
  -0.0075,
  4367,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-18',
  0,
  160.5,
  0,
  195.5,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4311,
  0,
  20747,
  0,
  25745,
  20747,
  25745,
  4998,
  25115,
  25747,
  4368,
  -2,
  -0.0004,
  -0.013,
  4311,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-19',
  0,
  162.2,
  0,
  249,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4490,
  0,
  21003,
  0,
  31096,
  21003,
  31096,
  10093,
  25747,
  31003,
  4744,
  93,
  0.0093,
  -0.0535,
  4490,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-20',
  null,
  null,
  0,
  202,
  0,
  null,
  null,
  4486,
  null,
  null,
  0,
  26586,
  0,
  26586,
  null,
  null,
  26586,
  null,
  0,
  null,
  null,
  4486,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-21',
  0,
  169.5,
  0,
  207.7,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4590,
  0,
  22090,
  0,
  27294,
  22090,
  27294,
  5204,
  26586,
  27090,
  4496,
  204,
  0.0408,
  0.0209,
  4592,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-22',
  null,
  null,
  0,
  185.5,
  0,
  null,
  null,
  2676,
  null,
  null,
  0,
  24387,
  0,
  24387,
  null,
  27090,
  24387,
  2703,
  0,
  null,
  -0.01,
  2676,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-23',
  0,
  172.5,
  0,
  211.5,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1791,
  0,
  22531,
  0,
  27748,
  22531,
  27748,
  5217,
  24387,
  27531,
  1856,
  217,
  0.0434,
  -0.035,
  1791,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-24',
  null,
  null,
  0,
  176.3,
  0,
  null,
  null,
  4799,
  null,
  null,
  0,
  23083,
  0,
  23083,
  null,
  27531,
  23083,
  4448,
  0,
  null,
  0.0789,
  4798,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-25',
  null,
  null,
  0,
  156.5,
  0,
  null,
  null,
  4649,
  null,
  null,
  0,
  20140,
  0,
  20140,
  null,
  23083,
  20140,
  2943,
  0,
  null,
  0.5797,
  4650,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-26',
  0,
  119.3,
  0,
  152.7,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4293,
  0,
  14368,
  0,
  19560,
  14368,
  19560,
  5192,
  20140,
  19368,
  5772,
  192,
  0.0384,
  -0.2562,
  4293,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-27',
  0,
  123.5,
  0,
  234.5,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4422,
  0,
  15024,
  0,
  30109,
  15024,
  30109,
  15085,
  19368,
  25024,
  4344,
  5085,
  0.5085,
  0.018,
  4423,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-28',
  null,
  null,
  0,
  196.3,
  0,
  null,
  null,
  4233,
  null,
  null,
  0,
  25850,
  0,
  25850,
  null,
  25024,
  25850,
  -826,
  0,
  null,
  -6.1247,
  4233,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-29',
  null,
  null,
  0,
  180.5,
  0,
  null,
  null,
  2159,
  null,
  null,
  0,
  23684,
  0,
  23684,
  null,
  25850,
  23684,
  2166,
  0,
  null,
  -0.0032,
  2160,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-30',
  0,
  169.8,
  0,
  206.5,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1546,
  0,
  22134,
  0,
  27147,
  22134,
  27147,
  5013,
  23684,
  27134,
  1550,
  13,
  0.0026,
  -0.0026,
  1547,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-03-31',
  null,
  null,
  0,
  171.3,
  0,
  null,
  null,
  4589,
  null,
  null,
  0,
  22355,
  0,
  22355,
  null,
  27134,
  22355,
  4779,
  0,
  null,
  -0.0398,
  4589,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-01',
  0,
  143.6,
  0,
  216,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4221,
  0,
  18158,
  0,
  28265,
  18158,
  28265,
  10107,
  22355,
  28158,
  4197,
  107,
  0.0107,
  0.0057,
  4224,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-02',
  0,
  181.5,
  0,
  225.8,
  5400,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4295,
  0,
  23826,
  0,
  29305,
  23826,
  29305,
  5479,
  28158,
  29226,
  4332,
  79,
  0.0146,
  -0.0085,
  4295,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-03',
  null,
  null,
  0,
  186.5,
  0,
  null,
  null,
  4484,
  null,
  null,
  0,
  24526,
  0,
  24526,
  null,
  29226,
  24526,
  4700,
  0,
  null,
  -0.046,
  4484,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-04',
  null,
  null,
  0,
  174.5,
  0,
  null,
  null,
  1669,
  null,
  null,
  0,
  22822,
  0,
  22822,
  null,
  24526,
  22822,
  1704,
  0,
  null,
  -0.0205,
  1669,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-05',
  null,
  null,
  0,
  156,
  0,
  null,
  null,
  2708,
  null,
  null,
  0,
  20064,
  0,
  20064,
  null,
  22822,
  20064,
  2758,
  0,
  null,
  -0.0181,
  2710,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-06',
  0,
  146.7,
  0,
  180.6,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1712,
  0,
  18637,
  0,
  23698,
  18637,
  23698,
  5061,
  20064,
  23637,
  null,
  61,
  0.0122,
  null,
  1712,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-07',
  0,
  148.4,
  0,
  182.5,
  0,
  null,
  null,
  4563,
  0,
  18900,
  0,
  23967,
  18900,
  23967,
  5067,
  23637,
  18900,
  4737,
  5067,
  null,
  -0.0367,
  4564,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-08',
  0,
  152.8,
  0,
  230.5,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4330,
  0,
  19576,
  0,
  29755,
  19576,
  29755,
  10179,
  18900,
  29576,
  -676,
  179,
  0.0179,
  -7.4053,
  4331,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-09',
  null,
  null,
  0,
  195.8,
  0,
  null,
  null,
  4073,
  null,
  null,
  0,
  25784,
  0,
  25784,
  null,
  29576,
  25784,
  3792,
  0,
  null,
  0.0741,
  4072,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-10',
  0,
  161.8,
  0,
  245,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4562,
  0,
  20942,
  0,
  30880,
  20942,
  30880,
  9938,
  25784,
  30942,
  4842,
  -62,
  -0.0062,
  -0.0578,
  4563,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-11',
  null,
  null,
  0,
  202.5,
  0,
  null,
  null,
  4215,
  null,
  null,
  0,
  26649,
  0,
  26649,
  null,
  30942,
  26649,
  4293,
  0,
  null,
  -0.0182,
  4215,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-12',
  null,
  null,
  0,
  183.5,
  0,
  null,
  null,
  2549,
  null,
  null,
  0,
  24108,
  0,
  24108,
  null,
  26649,
  24108,
  2541,
  0,
  null,
  0.0031,
  2549,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-13',
  null,
  null,
  0,
  171.4,
  0,
  null,
  null,
  1737,
  null,
  null,
  0,
  22370,
  0,
  22370,
  null,
  24108,
  22370,
  1738,
  0,
  null,
  -0.0006,
  1738,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-14',
  0,
  140.6,
  0,
  212,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4703,
  0,
  17692,
  0,
  27806,
  17692,
  27806,
  10114,
  22370,
  27692,
  4678,
  114,
  0.0114,
  0.0053,
  4703,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-15',
  null,
  null,
  0,
  176.8,
  0,
  null,
  null,
  4556,
  null,
  null,
  0,
  23155,
  0,
  23155,
  null,
  27692,
  23155,
  4537,
  0,
  null,
  0.0042,
  4557,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-16',
  0,
  148.5,
  0,
  224.5,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4243,
  0,
  18915,
  0,
  29174,
  18915,
  29174,
  10259,
  23155,
  28915,
  4240,
  259,
  0.0259,
  0.0007,
  4242,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-17',
  null,
  null,
  0,
  185.5,
  0,
  null,
  null,
  4505,
  null,
  null,
  0,
  24387,
  0,
  24387,
  null,
  28915,
  24387,
  4528,
  0,
  null,
  -0.0051,
  4506,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-18',
  null,
  null,
  0,
  155.3,
  0,
  null,
  null,
  4566,
  null,
  null,
  0,
  19958,
  0,
  19958,
  null,
  24387,
  19958,
  4429,
  0,
  null,
  0.0309,
  4566,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-19',
  null,
  null,
  0,
  140.7,
  0,
  null,
  null,
  2311,
  null,
  null,
  0,
  17707,
  0,
  17707,
  null,
  19958,
  17707,
  2251,
  0,
  null,
  0.0267,
  2312,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-20',
  0,
  133.2,
  0,
  202.6,
  10000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1190,
  0,
  16539,
  0,
  26662,
  16539,
  26662,
  10123,
  17707,
  26539,
  1168,
  123,
  0.0123,
  0.0188,
  1190,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-21',
  0,
  180.6,
  0,
  220.5,
  5000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  2948,
  0,
  23698,
  0,
  28758,
  23698,
  28758,
  5060,
  26539,
  28698,
  2841,
  60,
  0.012,
  0.0377,
  2948,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-22',
  null,
  null,
  0,
  206,
  0,
  null,
  null,
  1463,
  null,
  null,
  0,
  27086,
  0,
  27086,
  null,
  28698,
  27086,
  1612,
  0,
  null,
  -0.0924,
  1464,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-23',
  null,
  null,
  0,
  172.3,
  0,
  null,
  null,
  4562,
  null,
  null,
  0,
  22501,
  0,
  22501,
  null,
  27086,
  22501,
  4585,
  0,
  null,
  -0.005,
  4562,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-24',
  null,
  null,
  0,
  140.5,
  0,
  null,
  null,
  4850,
  null,
  null,
  0,
  17676,
  0,
  17676,
  null,
  22501,
  17676,
  4825,
  0,
  null,
  0.0052,
  4851,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-25',
  0,
  107.6,
  0,
  210.5,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  5263,
  0,
  12552,
  0,
  27630,
  12552,
  27630,
  15078,
  17676,
  27552,
  5124,
  78,
  0.0052,
  0.0271,
  5264,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-26',
  null,
  null,
  0,
  189.1,
  0,
  null,
  null,
  2597,
  null,
  null,
  0,
  24884,
  0,
  24884,
  null,
  27552,
  24884,
  2668,
  0,
  null,
  -0.0266,
  2597,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-27',
  null,
  null,
  0,
  175.5,
  0,
  null,
  null,
  1874,
  null,
  null,
  0,
  22967,
  0,
  22967,
  null,
  24884,
  22967,
  1917,
  0,
  null,
  -0.0224,
  1875,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-28',
  null,
  null,
  0,
  142.8,
  0,
  null,
  null,
  4894,
  null,
  null,
  0,
  18034,
  0,
  18034,
  null,
  22967,
  18034,
  4933,
  0,
  null,
  -0.0079,
  4894,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-29',
  0,
  111.5,
  0,
  215.6,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  4907,
  0,
  13155,
  0,
  28220,
  13155,
  28220,
  15065,
  18034,
  28155,
  4879,
  65,
  0.0043,
  0.0057,
  4907,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-04-30',
  null,
  null,
  0,
  183.5,
  0,
  null,
  null,
  4220,
  null,
  null,
  0,
  24108,
  0,
  24108,
  null,
  28155,
  24108,
  4047,
  0,
  null,
  0.0427,
  4221,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-01',
  null,
  null,
  0,
  148.6,
  0,
  null,
  null,
  4946,
  null,
  null,
  0,
  18930,
  0,
  18930,
  null,
  24108,
  18930,
  5178,
  0,
  null,
  -0.0448,
  4946,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-02',
  null,
  null,
  0,
  139.2,
  0,
  null,
  null,
  1457,
  null,
  null,
  0,
  17474,
  0,
  17474,
  null,
  18930,
  17474,
  1456,
  0,
  null,
  0.0007,
  1457,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-03',
  null,
  null,
  0,
  124,
  0,
  null,
  null,
  2500,
  null,
  null,
  0,
  15102,
  0,
  15102,
  null,
  17474,
  15102,
  2372,
  0,
  null,
  0.054,
  2501,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-04',
  0,
  114.6,
  0,
  221.7,
  15000,
  (select id from public.estoque_diesel_fornecedores where nome = 'Raizen' limit 1),
  null,
  1450,
  0,
  13636,
  0,
  28885,
  13636,
  28885,
  15249,
  15102,
  28636,
  1466,
  249,
  null,
  -0.0109,
  1451,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-05',
  null,
  null,
  0,
  183.9,
  0,
  null,
  null,
  0,
  null,
  null,
  0,
  24164,
  0,
  24164,
  null,
  28636,
  24164,
  4472,
  0,
  null,
  -1,
  0,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_medicoes_diarias (
  tanque_id,
  data_medicao,
  regua_anterior_t1,
  regua_anterior_t2,
  regua_final_t1,
  regua_final_t2,
  nf_volume_litros,
  fornecedor_id,
  nf_numero,
  saida_transnet,
  litros_anterior_t1,
  litros_anterior_t2,
  litros_final_t1,
  litros_final_t2,
  saldo_anterior,
  saldo_final,
  entrada_diesel,
  medicao_d1,
  medicao_atual,
  saida_tanque,
  diff_recebimento,
  pct_diff_nf,
  pct_diff_transnet,
  saida_total_bombas,
  status_lancamento,
  observacao
)
select
  t.id,
  date '2026-05-06',
  null,
  null,
  0,
  153.5,
  0,
  null,
  null,
  0,
  null,
  null,
  0,
  19683,
  0,
  19683,
  null,
  24164,
  19683,
  null,
  0,
  null,
  null,
  0,
  'IMPORTADO_PLANILHA',
  'Carga automatica 2026 a partir da planilha de medicao.'
from public.estoque_diesel_tanques t
where t.tipo_diesel = 'S500'
on conflict (tanque_id, data_medicao) do update
set regua_anterior_t1 = excluded.regua_anterior_t1,
    regua_anterior_t2 = excluded.regua_anterior_t2,
    regua_final_t1 = excluded.regua_final_t1,
    regua_final_t2 = excluded.regua_final_t2,
    nf_volume_litros = excluded.nf_volume_litros,
    fornecedor_id = excluded.fornecedor_id,
    nf_numero = excluded.nf_numero,
    saida_transnet = excluded.saida_transnet,
    litros_anterior_t1 = excluded.litros_anterior_t1,
    litros_anterior_t2 = excluded.litros_anterior_t2,
    litros_final_t1 = excluded.litros_final_t1,
    litros_final_t2 = excluded.litros_final_t2,
    saldo_anterior = excluded.saldo_anterior,
    saldo_final = excluded.saldo_final,
    entrada_diesel = excluded.entrada_diesel,
    medicao_d1 = excluded.medicao_d1,
    medicao_atual = excluded.medicao_atual,
    saida_tanque = excluded.saida_tanque,
    diff_recebimento = excluded.diff_recebimento,
    pct_diff_nf = excluded.pct_diff_nf,
    pct_diff_transnet = excluded.pct_diff_transnet,
    saida_total_bombas = excluded.saida_total_bombas,
    status_lancamento = excluded.status_lancamento,
    observacao = excluded.observacao,
    atualizado_em = now();

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9231972,
  9235346
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9235346,
  9236676
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9236676,
  9240074
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9240074,
  9243188
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9243188,
  9244566
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9244566,
  9249480
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9249480,
  9254476
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9254476,
  9259449
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9259449,
  9264193
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9264193,
  9268975
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9268975,
  9272311
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9272311,
  9273769
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9273769,
  9278086
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9278086,
  9282259
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9282259,
  9286435
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9286435,
  9290356
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9290356,
  9294464
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9294464,
  9297178
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9297178,
  9299004
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9299004,
  9303414
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9303414,
  9307547
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9307547,
  9311304
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9311304,
  9315209
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9315209,
  9319570
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9319570,
  9322189
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9322189,
  9323533
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9323533,
  9327909
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9327909,
  9332325
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9332325,
  9336424
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9336424,
  9340781
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9340781,
  9345253
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-01-31'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9345253,
  9348154
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9348154,
  9349814
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9349814,
  9354758
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9354758,
  9359597
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9359597,
  9364243
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9364243,
  9368673
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9368673,
  9373114
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9373114,
  9376492
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9376492,
  9377939
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9377939,
  9382878
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9382878,
  9387824
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9387824,
  9392615
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9392615,
  9397574
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9397574,
  9402579
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9402580,
  9405898
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9405898,
  9406971
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9406971,
  9410685
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9410685,
  9413496
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9413496,
  9417871
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9417871,
  9422876
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9422876,
  9428075
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9428075,
  9431159
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9431159,
  9432202
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9432202,
  9437348
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9437348,
  9440193
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9440193,
  9445015
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9445015,
  9449697
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9449697,
  9454358
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-02-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9454358,
  9457596
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9457596,
  9459024
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9459024,
  9463736
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9463736,
  9468455
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9468455,
  9473407
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9473407,
  9478021
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9478021,
  9482798
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9482798,
  9486038
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9486038,
  9487369
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9487369,
  9492170
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9492170,
  9496928
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9496928,
  9501523
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9501523,
  9506522
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9506522,
  9511226
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9511226,
  9514235
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9514235,
  9515636
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9515636,
  9520712
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9520712,
  9525547
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9525547,
  9530368
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9530368,
  9535151
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9535151,
  9540050
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9540050,
  9543057
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9543057,
  9544478
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9544478,
  9549444
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9549444,
  9554200
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9554200,
  9559183
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9559183,
  9563876
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9563876,
  9569074
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9569074,
  9572615
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9572615,
  9574291
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9574291,
  9579201
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-03-31'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9579207,
  9584049
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9584049,
  9589129
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9589129,
  9594202
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9594202,
  9595840
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9595840,
  9598897
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9598897,
  9600346
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9600346,
  9605394
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9605394,
  9610482
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9610482,
  9615757
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9615757,
  9620657
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9620657,
  9625525
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9625523,
  9628739
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9628739,
  9630199
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9630199,
  9634959
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9634959,
  9639913
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9639913,
  9644771
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9644771,
  9649630
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9649630,
  9654353
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9654353,
  9657756
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9657756,
  9659579
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9659579,
  9663590
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9663590,
  9665344
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9665344,
  9670299
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9670299,
  9675022
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9675022,
  9679625
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9679625,
  9682627
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9682628,
  9684041
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9684041,
  9688668
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9688668,
  9693222
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9693222,
  9698273
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-04-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9698273,
  9702913
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-05-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9702913,
  9704838
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-05-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9704838,
  9707779
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-05-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  9707779,
  9709458
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S10'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 1
where m.data_medicao = date '2026-05-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2230959,
  2231595
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6851120,
  6852965
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2231595,
  2231595
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6852965,
  6854431
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2231595,
  2231595
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6854431,
  6857500
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2231595,
  2231595
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6857500,
  6859607
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2231595,
  2231634
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6859607,
  6861349
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2231634,
  2233189
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6861350,
  6863647
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2233189,
  2234328
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6863647,
  6866118
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2234328,
  2235596
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6866118,
  6868778
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2235596,
  2235712
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6868778,
  6872418
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2235712,
  2236810
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6872418,
  6875045
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2236810,
  2237300
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6875045,
  6876909
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2237300,
  2237300
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6876909,
  6878739
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2237300,
  2238739
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6878739,
  6881376
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2238739,
  2240290
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6881376,
  6884442
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2240290,
  2242015
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6884442,
  6887361
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2242015,
  2243418
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6892172,
  6895781
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2243418,
  2244224
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6895781,
  6897621
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2244224,
  2244224
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6897621,
  6899077
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2244224,
  2246010
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6899077,
  6901482
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2246010,
  2247580
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6901482,
  6904673
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2247580,
  2249591
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6904673,
  6907382
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2249591,
  2249758
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6907382,
  6912042
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2249758,
  2251257
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6912042,
  6915057
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2251257,
  2251951
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6915057,
  6917084
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2251951,
  2251951
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6917084,
  6919012
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2251951,
  2253465
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6919012,
  6922122
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2253465,
  2254837
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6922122,
  6924922
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2254837,
  2256425
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6924922,
  6927894
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2256425,
  2256648
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6927894,
  6932005
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2256648,
  2258230
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-01-31'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6932005,
  6934594
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-01-31'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2258230,
  2258842
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6934594,
  6937016
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2258842,
  2258842
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6937016,
  6938620
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2258842,
  2260326
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6938620,
  6941328
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2260326,
  2261889
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6941328,
  6944250
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2261889,
  2263567
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6944250,
  6946995
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2262082,
  2262843
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6946995,
  6950818
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2262843,
  2264753
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6950818,
  6953320
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2264753,
  2265377
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6953320,
  6955099
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2265377,
  2265662
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6955099,
  6956812
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2265662,
  2267421
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6956812,
  6959569
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2267421,
  2269114
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6959569,
  6962414
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2269114,
  2271023
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6962414,
  6964844
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2271023,
  2271247
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6964844,
  6968856
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2271247,
  2273107
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6968856,
  6971214
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2273107,
  2273798
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6971214,
  6972902
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2273798,
  2274205
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6972902,
  6974685
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2274205,
  2275198
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6974685,
  6976565
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2275198,
  2275838
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6976565,
  6978672
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2275838,
  2277335
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6978672,
  6981374
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2277335,
  2277600
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6981374,
  6985210
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2277600,
  2279023
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6985210,
  6988074
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2279023,
  2279727
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6988074,
  6990153
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2279727,
  2279727
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6990153,
  6992288
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2279727,
  2281238
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6992288,
  6995085
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2281238,
  2284084
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6995085,
  6998719
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2284084,
  2285561
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  6998719,
  7001809
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2285561,
  2286004
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7001809,
  7006089
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2286004,
  2287405
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-02-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7006089,
  7009347
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-02-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2287405,
  2287973
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7009347,
  7011260
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2287973,
  2288250
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7011260,
  7012685
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2288250,
  2290029
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7012685,
  7015552
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2290029,
  2291312
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7015552,
  7018775
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2291312,
  2293070
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7018775,
  7021642
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2293070,
  2294639
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7021642,
  7024963
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2294639,
  2295217
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7024963,
  7028819
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2295217,
  2296171
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7028819,
  7030365
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2296171,
  2296171
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7030365,
  7032370
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2296171,
  2297580
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7032370,
  7035624
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2297580,
  2299087
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7035624,
  7038654
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2299087,
  2300687
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7038654,
  7041678
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2300687,
  2301038
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7041678,
  7045632
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2301038,
  2302809
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7045632,
  7048404
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2302809,
  2303642
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7048404,
  7050303
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2303642,
  2304148
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7050303,
  7051706
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2304148,
  2305835
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7051706,
  7054386
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2305835,
  2307346
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7054386,
  7057186
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2307346,
  2309377
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7057186,
  7059645
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2309377,
  2310280
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7059645,
  7063228
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2310280,
  2311963
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7063228,
  7066137
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2311963,
  2313045
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7066137,
  7067731
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2313045,
  2313045
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7067731,
  7069522
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2313045,
  2314618
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7069522,
  7072747
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2314618,
  2316743
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7072747,
  7075272
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2316743,
  2318051
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7075272,
  7078257
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2318051,
  2318263
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7078257,
  7082468
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2318263,
  2320118
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7082468,
  7084846
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2320118,
  2320594
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7084846,
  7086530
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2320594,
  2320933
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7086530,
  7087738
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2320933,
  2322681
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-03-31'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7087738,
  7090579
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-03-31'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2322681,
  2324728
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7090579,
  7092756
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2324728,
  2324728
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7092756,
  7097051
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2324728,
  2326733
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7097051,
  7099530
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2326733,
  2326733
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7099530,
  7101199
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2326733,
  2326784
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7101199,
  7103858
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-05'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2326784,
  2327108
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7103858,
  7105246
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-06'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2327108,
  2328894
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7105246,
  7108024
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-07'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2328894,
  2330804
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7108024,
  7110445
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-08'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2330804,
  2330842
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7110445,
  7114479
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-09'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2330842,
  2332738
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7114479,
  7117146
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-10'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2332738,
  2334692
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7117146,
  7119407
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-11'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2334692,
  2335390
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7119407,
  7121258
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-12'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2335390,
  2335457
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7121258,
  7122929
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-13'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2335457,
  2337206
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7122929,
  7125883
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-14'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2337206,
  2339274
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7125883,
  7128372
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-15'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2339274,
  2339694
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7128372,
  7132194
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-16'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2339694,
  2341474
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7132194,
  7134920
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-17'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2341474,
  2343413
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7134920,
  7137547
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-18'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2343413,
  2343915
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7137547,
  7139357
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-19'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2343915,
  2343915
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7139357,
  7140547
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-20'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2343915,
  2344588
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7140547,
  7142822
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-21'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2344588,
  2344588
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7142822,
  7144286
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-22'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2344588,
  2345124
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7144286,
  7148312
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-23'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2345124,
  2346791
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7148312,
  7151496
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-24'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2346791,
  2348768
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7151496,
  7154783
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-25'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2348768,
  2349277
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7154783,
  7156871
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-26'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2349277,
  2349606
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7156871,
  7158417
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-27'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2349606,
  2351885
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7158417,
  7161032
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-28'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2351885,
  2354090
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7161032,
  7163734
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-29'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2354090,
  2354808
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-04-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7163734,
  7167237
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-04-30'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2354808,
  2356909
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-05-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7167237,
  7170082
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-05-01'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2356909,
  2356909
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-05-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7170082,
  7171539
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-05-02'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2356909,
  2357588
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-05-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7171539,
  7173361
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-05-03'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  2357588,
  2357588
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 2
where m.data_medicao = date '2026-05-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

insert into public.estoque_diesel_leituras_bomba (
  medicao_id,
  bomba_id,
  hodometro_inicial,
  hodometro_final
)
select
  m.id,
  b.id,
  7173361,
  7174812
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id and t.tipo_diesel = 'S500'
join public.estoque_diesel_bombas b on b.tanque_id = t.id and b.numero = 3
where m.data_medicao = date '2026-05-04'
on conflict (medicao_id, bomba_id) do update
set hodometro_inicial = excluded.hodometro_inicial,
    hodometro_final = excluded.hodometro_final;

commit;
