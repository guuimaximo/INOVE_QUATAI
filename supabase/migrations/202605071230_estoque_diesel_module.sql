begin;

create extension if not exists pgcrypto;

create table if not exists public.estoque_diesel_produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null default 'COMBUSTIVEL',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_tanques (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  ordem_operacional smallint not null default 1,
  capacidade_litros numeric(14,2),
  diametro_m numeric(10,4),
  raio_m numeric(10,4),
  comprimento_m numeric(10,4),
  ativo boolean not null default true,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_regras_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null unique references public.estoque_diesel_produtos(id) on delete cascade,
  estoque_minimo_litros numeric(14,2) not null default 0,
  estoque_medio_litros numeric(14,2) not null default 0,
  estoque_maximo_litros numeric(14,2) not null default 0,
  cobertura_minima_dias numeric(10,2) not null default 0,
  cobertura_alvo_dias numeric(10,2) not null default 0,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_tolerancias_recebimento (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references public.estoque_diesel_produtos(id) on delete cascade,
  volume_nf_min_litros numeric(14,2) not null,
  volume_nf_max_litros numeric(14,2),
  variacao_pct numeric(10,6) not null,
  diferenca_aceitavel_litros numeric(14,3) not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_regua_litros (
  id uuid primary key default gen_random_uuid(),
  tanque_id uuid not null references public.estoque_diesel_tanques(id) on delete cascade,
  regua_cm numeric(10,2) not null,
  litros numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (tanque_id, regua_cm)
);

create table if not exists public.estoque_diesel_operacoes_dia (
  id uuid primary key default gen_random_uuid(),
  data_operacao date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  fornecedor text,
  numero_nf text,
  programacao_entrega_litros numeric(14,2) not null default 0,
  volume_nf_litros numeric(14,2) not null default 0,
  volume_recebido_litros numeric(14,2) not null default 0,
  saldo_anterior_t1_regua_cm numeric(10,2),
  saldo_anterior_t1_litros numeric(14,2),
  saldo_final_t1_regua_cm numeric(10,2),
  saldo_final_t1_litros numeric(14,2),
  saldo_anterior_t2_regua_cm numeric(10,2),
  saldo_anterior_t2_litros numeric(14,2),
  saldo_final_t2_regua_cm numeric(10,2),
  saldo_final_t2_litros numeric(14,2),
  medicao_dia_anterior_litros numeric(14,2),
  entrada_diesel_litros numeric(14,2),
  medicao_atual_litros numeric(14,2),
  bomba_1_inicial numeric(14,2),
  bomba_1_final numeric(14,2),
  bomba_1_saida_litros numeric(14,2),
  bomba_2_inicial numeric(14,2),
  bomba_2_final numeric(14,2),
  bomba_2_saida_litros numeric(14,2),
  bomba_3_inicial numeric(14,2),
  bomba_3_final numeric(14,2),
  bomba_3_saida_litros numeric(14,2),
  transnet_inicial numeric(14,2),
  transnet_final numeric(14,2),
  transnet_saida_litros numeric(14,2),
  saida_total_litros numeric(14,2),
  saldo_teorico_litros numeric(14,2),
  medicao_externa_litros numeric(14,2),
  diferenca_nf_recebido_pct numeric(10,6),
  diferenca_recebimento_litros numeric(14,2),
  diferenca_tanque_litros numeric(14,2),
  status_fechamento text not null default 'ABERTO',
  observacao text,
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_operacao, produto_id)
);

create table if not exists public.estoque_diesel_recebimentos (
  id uuid primary key default gen_random_uuid(),
  data_recebimento date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  operacao_dia_id uuid references public.estoque_diesel_operacoes_dia(id) on delete set null,
  fornecedor text not null,
  numero_nf text,
  volume_nf_litros numeric(14,2) not null default 0,
  volume_recebido_litros numeric(14,2) not null default 0,
  preco_unitario numeric(14,4),
  diferenca_litros numeric(14,2),
  diferenca_pct numeric(10,6),
  tolerancia_id uuid references public.estoque_diesel_tolerancias_recebimento(id) on delete set null,
  diferenca_aceitavel_litros numeric(14,3),
  status_conferencia text not null default 'PENDENTE',
  observacao text,
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_inventarios (
  id uuid primary key default gen_random_uuid(),
  data_inventario date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  tanque_id uuid references public.estoque_diesel_tanques(id) on delete set null,
  operacao_dia_id uuid references public.estoque_diesel_operacoes_dia(id) on delete set null,
  regua_cm numeric(10,2),
  litros_curva numeric(14,2),
  medicao_externa_litros numeric(14,2),
  saldo_teorico_litros numeric(14,2),
  diferenca_litros numeric(14,2),
  ajuste_litros numeric(14,2) not null default 0,
  justificativa text,
  status_inventario text not null default 'ABERTO',
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_programacoes (
  id uuid primary key default gen_random_uuid(),
  data_programada date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  fornecedor text,
  preco_diesel numeric(14,4),
  defasagem_cbie_pct numeric(10,4),
  defasagem_valor numeric(14,4),
  indicador_nivel_estoque text,
  saldo_planejado_litros numeric(14,2),
  programacao_entrega_litros numeric(14,2),
  saldo_pos_entrega_litros numeric(14,2),
  saida_programada_litros numeric(14,2),
  estoque_atual_litros numeric(14,2),
  consumo_medio_7d numeric(14,2),
  consumo_medio_30d numeric(14,2),
  cobertura_dias numeric(10,2),
  volume_sugerido_litros numeric(14,2),
  volume_programado_litros numeric(14,2),
  status_programacao text not null default 'ABERTA',
  observacao text,
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_alertas (
  id uuid primary key default gen_random_uuid(),
  data_alerta date not null default current_date,
  produto_id uuid references public.estoque_diesel_produtos(id) on delete set null,
  operacao_dia_id uuid references public.estoque_diesel_operacoes_dia(id) on delete set null,
  recebimento_id uuid references public.estoque_diesel_recebimentos(id) on delete set null,
  inventario_id uuid references public.estoque_diesel_inventarios(id) on delete set null,
  programacao_id uuid references public.estoque_diesel_programacoes(id) on delete set null,
  tipo text not null,
  severidade text not null default 'ATENCAO',
  status text not null default 'ABERTO',
  titulo text not null,
  descricao text,
  responsavel text,
  resolucao text,
  resolvido_em timestamptz,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_estoque_diesel_operacoes_dia_data
  on public.estoque_diesel_operacoes_dia (data_operacao desc, produto_id);

create index if not exists idx_estoque_diesel_recebimentos_data
  on public.estoque_diesel_recebimentos (data_recebimento desc, produto_id);

create index if not exists idx_estoque_diesel_inventarios_data
  on public.estoque_diesel_inventarios (data_inventario desc, produto_id);

create index if not exists idx_estoque_diesel_programacoes_data
  on public.estoque_diesel_programacoes (data_programada desc, produto_id);

create index if not exists idx_estoque_diesel_alertas_status
  on public.estoque_diesel_alertas (status, severidade, data_alerta desc);

insert into public.estoque_diesel_produtos (codigo, nome, tipo)
values
  ('S500', 'Diesel S500', 'COMBUSTIVEL'),
  ('S10', 'Diesel S10', 'COMBUSTIVEL'),
  ('ARLA', 'ARLA 32', 'INSUMO')
on conflict (codigo) do update
set nome = excluded.nome,
    tipo = excluded.tipo;

insert into public.estoque_diesel_tanques (
  codigo,
  nome,
  produto_id,
  ordem_operacional,
  diametro_m,
  raio_m,
  comprimento_m
)
select
  src.codigo,
  src.nome,
  p.id,
  src.ordem_operacional,
  src.diametro_m,
  src.raio_m,
  src.comprimento_m
from (
  values
    ('S500-T1', 'Tanque 1 S500', 'S500', 1, 2.5490, 1.2745, 6.1300),
    ('S500-T2', 'Tanque 2 S500', 'S500', 2, 2.5490, 1.2745, 6.1300),
    ('S10-T1', 'Tanque 1 S10', 'S10', 1, 2.5490, 1.2745, 6.1300),
    ('S10-T2', 'Tanque 2 S10', 'S10', 2, 2.5490, 1.2745, 6.1300),
    ('ARLA-T1', 'Reservatorio ARLA', 'ARLA', 1, null, null, null)
) as src(codigo, nome, produto_codigo, ordem_operacional, diametro_m, raio_m, comprimento_m)
join public.estoque_diesel_produtos p on p.codigo = src.produto_codigo
on conflict (codigo) do update
set nome = excluded.nome,
    produto_id = excluded.produto_id,
    ordem_operacional = excluded.ordem_operacional,
    diametro_m = excluded.diametro_m,
    raio_m = excluded.raio_m,
    comprimento_m = excluded.comprimento_m;

insert into public.estoque_diesel_regras_estoque (
  produto_id,
  estoque_minimo_litros,
  estoque_medio_litros,
  estoque_maximo_litros
)
select p.id, src.minimo, src.medio, src.maximo
from (
  values
    ('S500', 14000, 30000, 47000),
    ('S10', 10000, 15000, 10000),
    ('ARLA', 300, 1000, 2000)
) as src(produto_codigo, minimo, medio, maximo)
join public.estoque_diesel_produtos p on p.codigo = src.produto_codigo
on conflict (produto_id) do update
set estoque_minimo_litros = excluded.estoque_minimo_litros,
    estoque_medio_litros = excluded.estoque_medio_litros,
    estoque_maximo_litros = excluded.estoque_maximo_litros;

insert into public.estoque_diesel_tolerancias_recebimento (
  produto_id,
  volume_nf_min_litros,
  volume_nf_max_litros,
  variacao_pct,
  diferenca_aceitavel_litros
)
select
  p.id,
  src.volume_nf_min_litros,
  src.volume_nf_max_litros,
  src.variacao_pct,
  src.diferenca_aceitavel_litros
from (
  values
    (5000, 5000, -0.0105, 4.947),
    (10000, 10000, -0.0105, 9.895),
    (15000, 15000, -0.0105, 14.842),
    (20000, 20000, -0.0105, 19.790),
    (25000, 25000, -0.0105, 24.737),
    (30000, 30000, -0.0105, 29.685),
    (35000, 35000, -0.0105, 34.632)
) as src(volume_nf_min_litros, volume_nf_max_litros, variacao_pct, diferenca_aceitavel_litros)
join public.estoque_diesel_produtos p on p.codigo in ('S500', 'S10')
where not exists (
  select 1
  from public.estoque_diesel_tolerancias_recebimento t
  where t.produto_id = p.id
    and t.volume_nf_min_litros = src.volume_nf_min_litros
    and coalesce(t.volume_nf_max_litros, src.volume_nf_max_litros) = src.volume_nf_max_litros
);

create or replace view public.v_estoque_diesel_resumo as
select
  p.id as produto_id,
  p.codigo as produto_codigo,
  p.nome as produto_nome,
  o.data_operacao as ultima_data_operacao,
  o.saldo_teorico_litros,
  o.medicao_externa_litros,
  r.estoque_minimo_litros,
  r.estoque_medio_litros,
  r.estoque_maximo_litros,
  o.saida_total_litros as consumo_dia_litros,
  round(avg(o.saida_total_litros) filter (where o.data_operacao >= current_date - interval '7 days'), 2) as consumo_medio_7d,
  round(avg(o.saida_total_litros) filter (where o.data_operacao >= current_date - interval '30 days'), 2) as consumo_medio_30d,
  count(a.id) filter (where a.status = 'ABERTO') as alertas_abertos
from public.estoque_diesel_produtos p
left join lateral (
  select od.*
  from public.estoque_diesel_operacoes_dia od
  where od.produto_id = p.id
  order by od.data_operacao desc
  limit 1
) o on true
left join public.estoque_diesel_regras_estoque r on r.produto_id = p.id
left join public.estoque_diesel_operacoes_dia h on h.produto_id = p.id
left join public.estoque_diesel_alertas a on a.produto_id = p.id
group by
  p.id,
  p.codigo,
  p.nome,
  o.data_operacao,
  o.saldo_teorico_litros,
  o.medicao_externa_litros,
  o.saida_total_litros,
  r.estoque_minimo_litros,
  r.estoque_medio_litros,
  r.estoque_maximo_litros;

create or replace view public.v_estoque_diesel_conciliacao as
select
  o.id,
  o.data_operacao,
  p.codigo as produto_codigo,
  p.nome as produto_nome,
  o.volume_recebido_litros as entrada_abastecimento_litros,
  o.saida_total_litros as saida_abastecimento_litros,
  o.saldo_teorico_litros as saldo_abastecimento_litros,
  o.medicao_externa_litros,
  coalesce(sum(r.volume_recebido_litros), 0) as entrada_suprimentos_litros,
  coalesce(sum(o.saida_total_litros * coalesce(pr.preco_diesel, 0)), 0) as saida_suprimentos_valor,
  o.diferenca_tanque_litros,
  case
    when abs(coalesce(o.diferenca_tanque_litros, 0)) > 0 then 'ATENCAO'
    else 'OK'
  end as status_conciliacao
from public.estoque_diesel_operacoes_dia o
join public.estoque_diesel_produtos p on p.id = o.produto_id
left join public.estoque_diesel_recebimentos r on r.operacao_dia_id = o.id
left join public.estoque_diesel_programacoes pr on pr.produto_id = o.produto_id and pr.data_programada = o.data_operacao
group by
  o.id,
  o.data_operacao,
  p.codigo,
  p.nome,
  o.volume_recebido_litros,
  o.saida_total_litros,
  o.saldo_teorico_litros,
  o.medicao_externa_litros,
  o.diferenca_tanque_litros;

create or replace view public.v_estoque_diesel_alertas_abertos as
select
  a.id,
  a.data_alerta,
  a.tipo,
  a.severidade,
  a.status,
  a.titulo,
  a.descricao,
  a.responsavel,
  p.codigo as produto_codigo,
  p.nome as produto_nome
from public.estoque_diesel_alertas a
left join public.estoque_diesel_produtos p on p.id = a.produto_id
where a.status = 'ABERTO';

commit;
