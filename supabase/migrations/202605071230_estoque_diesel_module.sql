begin;

create extension if not exists pgcrypto;

create table if not exists public.estoque_diesel_produtos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_tanques (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  capacidade_litros numeric(14,2),
  diametro_m numeric(10,4),
  raio_m numeric(10,4),
  comprimento_m numeric(10,4),
  estoque_minimo_litros numeric(14,2) not null default 0,
  estoque_medio_litros numeric(14,2) not null default 0,
  estoque_maximo_litros numeric(14,2) not null default 0,
  tolerancia_recebimento_pct numeric(8,4) not null default 0,
  tolerancia_inventario_litros numeric(14,2) not null default 0,
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

create table if not exists public.estoque_diesel_operacoes (
  id uuid primary key default gen_random_uuid(),
  data_operacao date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  tanque_id uuid not null references public.estoque_diesel_tanques(id),
  fornecedor text,
  numero_nf text,
  saldo_anterior_litros numeric(14,2) not null default 0,
  regua_inicial_cm numeric(10,2),
  regua_final_cm numeric(10,2),
  litros_regua_inicial numeric(14,2),
  litros_regua_final numeric(14,2),
  entrada_total_litros numeric(14,2) not null default 0,
  saida_bomba_1_litros numeric(14,2) not null default 0,
  saida_bomba_2_litros numeric(14,2) not null default 0,
  saida_bomba_3_litros numeric(14,2) not null default 0,
  saida_transnet_litros numeric(14,2) not null default 0,
  medicao_externa_litros numeric(14,2),
  saldo_teorico_litros numeric(14,2),
  saldo_medido_litros numeric(14,2),
  diferenca_tanque_litros numeric(14,2),
  status_fechamento text not null default 'ABERTO',
  observacao text,
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_operacao, tanque_id)
);

create table if not exists public.estoque_diesel_recebimentos (
  id uuid primary key default gen_random_uuid(),
  data_recebimento date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  tanque_id uuid references public.estoque_diesel_tanques(id),
  operacao_id uuid references public.estoque_diesel_operacoes(id) on delete set null,
  fornecedor text not null,
  numero_nf text,
  volume_nf_litros numeric(14,2) not null default 0,
  volume_recebido_litros numeric(14,2) not null default 0,
  preco_unitario numeric(14,4),
  diferenca_litros numeric(14,2),
  diferenca_pct numeric(10,4),
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
  tanque_id uuid not null references public.estoque_diesel_tanques(id),
  operacao_id uuid references public.estoque_diesel_operacoes(id) on delete set null,
  regua_cm numeric(10,2),
  litros_regua numeric(14,2),
  medicao_externa_litros numeric(14,2),
  saldo_teorico_litros numeric(14,2),
  diferenca_litros numeric(14,2),
  ajuste_litros numeric(14,2) not null default 0,
  justificativa text,
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_programacoes (
  id uuid primary key default gen_random_uuid(),
  data_programada date not null,
  produto_id uuid not null references public.estoque_diesel_produtos(id),
  tanque_id uuid references public.estoque_diesel_tanques(id),
  fornecedor text,
  estoque_atual_litros numeric(14,2) not null default 0,
  consumo_medio_7d numeric(14,2) not null default 0,
  consumo_medio_30d numeric(14,2) not null default 0,
  cobertura_dias numeric(10,2) not null default 0,
  estoque_minimo_litros numeric(14,2) not null default 0,
  estoque_medio_litros numeric(14,2) not null default 0,
  estoque_maximo_litros numeric(14,2) not null default 0,
  volume_sugerido_litros numeric(14,2) not null default 0,
  volume_programado_litros numeric(14,2) not null default 0,
  preco_referencia numeric(14,4),
  status_programacao text not null default 'ABERTA',
  observacao text,
  extra jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.estoque_diesel_alertas (
  id uuid primary key default gen_random_uuid(),
  data_alerta date not null default current_date,
  produto_id uuid references public.estoque_diesel_produtos(id),
  tanque_id uuid references public.estoque_diesel_tanques(id),
  operacao_id uuid references public.estoque_diesel_operacoes(id) on delete set null,
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

create index if not exists idx_estoque_diesel_operacoes_data
  on public.estoque_diesel_operacoes (data_operacao desc);

create index if not exists idx_estoque_diesel_recebimentos_data
  on public.estoque_diesel_recebimentos (data_recebimento desc);

create index if not exists idx_estoque_diesel_inventarios_data
  on public.estoque_diesel_inventarios (data_inventario desc);

create index if not exists idx_estoque_diesel_programacoes_data
  on public.estoque_diesel_programacoes (data_programada desc);

create index if not exists idx_estoque_diesel_alertas_status
  on public.estoque_diesel_alertas (status, severidade, data_alerta desc);

insert into public.estoque_diesel_produtos (codigo, nome)
values
  ('S500', 'Diesel S500'),
  ('S10', 'Diesel S10'),
  ('ARLA', 'ARLA 32')
on conflict (codigo) do nothing;

create or replace view public.v_estoque_diesel_resumo as
select
  p.codigo as produto_codigo,
  p.nome as produto_nome,
  count(distinct o.id) as total_operacoes,
  max(o.data_operacao) as ultima_operacao,
  coalesce(sum(o.entrada_total_litros), 0) as entrada_total_litros,
  coalesce(sum(
    o.saida_bomba_1_litros +
    o.saida_bomba_2_litros +
    o.saida_bomba_3_litros +
    o.saida_transnet_litros
  ), 0) as saida_total_litros,
  coalesce(sum(case when a.status = 'ABERTO' then 1 else 0 end), 0) as alertas_abertos
from public.estoque_diesel_produtos p
left join public.estoque_diesel_operacoes o on o.produto_id = p.id
left join public.estoque_diesel_alertas a on a.produto_id = p.id
group by p.codigo, p.nome;

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
  t.codigo as tanque_codigo
from public.estoque_diesel_alertas a
left join public.estoque_diesel_produtos p on p.id = a.produto_id
left join public.estoque_diesel_tanques t on t.id = a.tanque_id
where a.status = 'ABERTO';

commit;
