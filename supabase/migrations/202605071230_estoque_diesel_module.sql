begin;

create extension if not exists pgcrypto;

create table if not exists public.estoque_diesel_locais (
  id bigserial primary key,
  nome varchar(100) not null,
  endereco text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.estoque_diesel_tanques (
  id bigserial primary key,
  local_id bigint not null references public.estoque_diesel_locais(id),
  nome varchar(50) not null,
  tipo_diesel varchar(10) not null check (tipo_diesel in ('S500', 'S10')),
  diametro_m numeric(6,4) not null,
  raio_m numeric(6,4) generated always as (diametro_m / 2) stored,
  comprimento_m numeric(6,4) not null,
  capacidade_max_litros numeric(10,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.estoque_diesel_bombas (
  id bigserial primary key,
  tanque_id bigint not null references public.estoque_diesel_tanques(id),
  numero int not null,
  descricao varchar(50),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (tanque_id, numero)
);

create table if not exists public.estoque_diesel_fornecedores (
  id bigserial primary key,
  nome varchar(100) not null,
  cnpj varchar(18),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.estoque_diesel_parametros (
  id bigserial primary key,
  tanque_id bigint not null unique references public.estoque_diesel_tanques(id) on delete cascade,
  regua_max_cm numeric(6,2) not null default 254.90,
  pct_diff_nf_alerta numeric(8,4) not null default 0.0100,
  pct_diff_nf_critico numeric(8,4) not null default 0.0300,
  pct_diff_transnet_alerta numeric(8,4) not null default 0.0200,
  pct_diff_transnet_critico numeric(8,4) not null default 0.0300,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.estoque_diesel_tolerancias_nf (
  id bigserial primary key,
  tipo_diesel varchar(10) not null check (tipo_diesel in ('S500', 'S10')),
  volume_nf numeric(10,2) not null,
  pct_variacao_aceitavel numeric(8,4) not null,
  diff_volume_aceitavel numeric(10,3) not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (tipo_diesel, volume_nf)
);

create table if not exists public.estoque_diesel_medicoes_diarias (
  id bigserial primary key,
  tanque_id bigint not null references public.estoque_diesel_tanques(id),
  data_medicao date not null,
  regua_anterior_t1 numeric(5,1),
  regua_anterior_t2 numeric(5,1),
  regua_final_t1 numeric(5,1),
  regua_final_t2 numeric(5,1),
  nf_volume_litros numeric(10,2) not null default 0,
  fornecedor_id bigint references public.estoque_diesel_fornecedores(id),
  nf_numero varchar(50),
  saida_transnet numeric(10,2),
  litros_anterior_t1 numeric(10,2),
  litros_anterior_t2 numeric(10,2),
  litros_final_t1 numeric(10,2),
  litros_final_t2 numeric(10,2),
  saldo_anterior numeric(10,2),
  saldo_final numeric(10,2),
  entrada_diesel numeric(10,2),
  medicao_d1 numeric(10,2),
  medicao_atual numeric(10,2),
  saida_tanque numeric(10,2),
  diff_recebimento numeric(10,2),
  pct_diff_nf numeric(8,4),
  pct_diff_transnet numeric(8,4),
  saida_total_bombas numeric(10,2),
  status_lancamento varchar(20) not null default 'ABERTO',
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  usuario_id bigint,
  unique (tanque_id, data_medicao)
);

create table if not exists public.estoque_diesel_leituras_bomba (
  id bigserial primary key,
  medicao_id bigint not null references public.estoque_diesel_medicoes_diarias(id) on delete cascade,
  bomba_id bigint not null references public.estoque_diesel_bombas(id),
  hodometro_inicial numeric(12,2) not null,
  hodometro_final numeric(12,2) not null,
  saida_bomba numeric(10,2) generated always as (hodometro_final - hodometro_inicial) stored,
  unique (medicao_id, bomba_id)
);

create or replace function public.estoque_diesel_calcular_volume_litros(
  regua_cm numeric,
  raio_m numeric,
  comprimento_m numeric
) returns numeric as $$
declare
  h numeric;
  r numeric;
  l numeric;
  volume numeric;
begin
  if regua_cm is null or regua_cm = 0 then
    return null;
  end if;

  h := regua_cm / 100.0;
  r := raio_m;
  l := comprimento_m;

  volume := (
    r * r * acos(1.0 - h / r)
    - sqrt(2.0 * r * h - h * h) * (r - h)
  ) * 1000.0 * l;

  return round(volume, 0);
end;
$$ language plpgsql immutable;

create index if not exists idx_estoque_diesel_medicoes_tanque_data
  on public.estoque_diesel_medicoes_diarias(tanque_id, data_medicao desc);

create index if not exists idx_estoque_diesel_medicoes_data
  on public.estoque_diesel_medicoes_diarias(data_medicao);

create index if not exists idx_estoque_diesel_leituras_medicao
  on public.estoque_diesel_leituras_bomba(medicao_id);

create index if not exists idx_estoque_diesel_tanques_local
  on public.estoque_diesel_tanques(local_id);

insert into public.estoque_diesel_locais (nome, endereco)
values ('Base Quatai', null)
on conflict do nothing;

insert into public.estoque_diesel_tanques (
  local_id,
  nome,
  tipo_diesel,
  diametro_m,
  comprimento_m,
  capacidade_max_litros
)
select
  l.id,
  src.nome,
  src.tipo_diesel,
  src.diametro_m,
  src.comprimento_m,
  src.capacidade_max_litros
from public.estoque_diesel_locais l
join (
  values
    ('Tanque S500', 'S500', 2.5490, 6.1300, 31000.00),
    ('Tanque S10', 'S10', 2.5490, 6.1300, 31000.00)
) as src(nome, tipo_diesel, diametro_m, comprimento_m, capacidade_max_litros)
  on l.nome = 'Base Quatai'
where not exists (
  select 1
  from public.estoque_diesel_tanques t
  where t.local_id = l.id
    and t.tipo_diesel = src.tipo_diesel
);

insert into public.estoque_diesel_bombas (tanque_id, numero, descricao)
select t.id, src.numero, src.descricao
from public.estoque_diesel_tanques t
join (
  values
    ('S500', 1, 'Bomba 1'),
    ('S500', 2, 'Bomba 2'),
    ('S500', 3, 'Bomba 3'),
    ('S10', 1, 'Bomba 1')
) as src(tipo_diesel, numero, descricao)
  on t.tipo_diesel = src.tipo_diesel
where not exists (
  select 1
  from public.estoque_diesel_bombas b
  where b.tanque_id = t.id
    and b.numero = src.numero
);

insert into public.estoque_diesel_parametros (
  tanque_id,
  regua_max_cm,
  pct_diff_nf_alerta,
  pct_diff_nf_critico,
  pct_diff_transnet_alerta,
  pct_diff_transnet_critico
)
select
  t.id,
  254.90,
  0.0100,
  0.0300,
  0.0200,
  0.0300
from public.estoque_diesel_tanques t
where not exists (
  select 1
  from public.estoque_diesel_parametros p
  where p.tanque_id = t.id
);

insert into public.estoque_diesel_tolerancias_nf (
  tipo_diesel,
  volume_nf,
  pct_variacao_aceitavel,
  diff_volume_aceitavel
)
values
  ('S500', 5000, 0.0105, 4.947),
  ('S500', 10000, 0.0105, 9.895),
  ('S500', 15000, 0.0105, 14.842),
  ('S500', 20000, 0.0105, 19.790),
  ('S500', 25000, 0.0105, 24.737),
  ('S500', 30000, 0.0105, 29.685),
  ('S500', 35000, 0.0105, 34.632),
  ('S10', 5000, 0.0105, 4.947),
  ('S10', 10000, 0.0105, 9.895),
  ('S10', 15000, 0.0105, 14.842),
  ('S10', 20000, 0.0105, 19.790),
  ('S10', 25000, 0.0105, 24.737),
  ('S10', 30000, 0.0105, 29.685),
  ('S10', 35000, 0.0105, 34.632)
on conflict (tipo_diesel, volume_nf) do update
set pct_variacao_aceitavel = excluded.pct_variacao_aceitavel,
    diff_volume_aceitavel = excluded.diff_volume_aceitavel;

insert into public.estoque_diesel_fornecedores (nome)
values ('Raizen'), ('BR Distribuidora'), ('Ipiranga')
on conflict do nothing;

create or replace view public.v_estoque_diesel_resumo_mensal as
select
  t.nome as tanque,
  t.tipo_diesel,
  date_trunc('month', m.data_medicao) as mes,
  sum(m.nf_volume_litros) as total_recebido_nf,
  sum(m.saida_tanque) as total_saida_tanque,
  sum(m.saida_total_bombas) as total_saida_bombas,
  sum(m.saida_transnet) as total_saida_transnet,
  avg(m.pct_diff_transnet) as media_pct_diff_transnet
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id
group by t.nome, t.tipo_diesel, date_trunc('month', m.data_medicao);

create or replace view public.v_estoque_diesel_ultima_medicao as
select distinct on (tanque_id)
  m.*,
  t.nome as tanque_nome,
  t.tipo_diesel
from public.estoque_diesel_medicoes_diarias m
join public.estoque_diesel_tanques t on t.id = m.tanque_id
order by tanque_id, data_medicao desc;

commit;
