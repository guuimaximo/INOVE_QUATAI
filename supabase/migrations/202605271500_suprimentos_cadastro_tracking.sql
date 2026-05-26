-- Cadastro de Fornecedores e Peças + rastreio de movimentações SE

-- =========================
-- FORNECEDORES
-- =========================
create table if not exists public.suprimentos_fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  telefone text,
  email text,
  contato text,
  obs text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supforn_nome_idx on public.suprimentos_fornecedores (nome);

create or replace function public.set_supforn_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_supforn_updated_at on public.suprimentos_fornecedores;
create trigger trg_supforn_updated_at
  before update on public.suprimentos_fornecedores
  for each row execute function public.set_supforn_updated_at();

alter table public.suprimentos_fornecedores enable row level security;
drop policy if exists "supforn_select" on public.suprimentos_fornecedores;
create policy "supforn_select" on public.suprimentos_fornecedores for select to anon, authenticated using (true);
drop policy if exists "supforn_insert" on public.suprimentos_fornecedores;
create policy "supforn_insert" on public.suprimentos_fornecedores for insert to anon, authenticated with check (true);
drop policy if exists "supforn_update" on public.suprimentos_fornecedores;
create policy "supforn_update" on public.suprimentos_fornecedores for update to anon, authenticated using (true) with check (true);
drop policy if exists "supforn_delete" on public.suprimentos_fornecedores;
create policy "supforn_delete" on public.suprimentos_fornecedores for delete to anon, authenticated using (true);

-- =========================
-- PEÇAS (catálogo)
-- =========================
create table if not exists public.suprimentos_pecas (
  id uuid primary key default gen_random_uuid(),
  codigo text,
  descricao text not null,
  unidade_padrao text not null default 'un',
  fornecedor_id uuid references public.suprimentos_fornecedores(id) on delete set null,
  obs text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppecas_codigo_idx on public.suprimentos_pecas (codigo);
create index if not exists suppecas_descricao_idx on public.suprimentos_pecas (descricao);

create or replace function public.set_suppecas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_suppecas_updated_at on public.suprimentos_pecas;
create trigger trg_suppecas_updated_at
  before update on public.suprimentos_pecas
  for each row execute function public.set_suppecas_updated_at();

alter table public.suprimentos_pecas enable row level security;
drop policy if exists "suppecas_select" on public.suprimentos_pecas;
create policy "suppecas_select" on public.suprimentos_pecas for select to anon, authenticated using (true);
drop policy if exists "suppecas_insert" on public.suprimentos_pecas;
create policy "suppecas_insert" on public.suprimentos_pecas for insert to anon, authenticated with check (true);
drop policy if exists "suppecas_update" on public.suprimentos_pecas;
create policy "suppecas_update" on public.suprimentos_pecas for update to anon, authenticated using (true) with check (true);
drop policy if exists "suppecas_delete" on public.suprimentos_pecas;
create policy "suppecas_delete" on public.suprimentos_pecas for delete to anon, authenticated using (true);

-- =========================
-- MOVIMENTAÇÕES Serviço Externo (rastreio completo)
-- =========================
create table if not exists public.suprimentos_se_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  se_id uuid not null references public.suprimentos_servico_externo(id) on delete cascade,
  tipo text not null default 'Observação'
    check (tipo in ('Saída', 'Observação', 'Retorno', 'Cancelamento')),
  descricao text,
  fotos_urls jsonb not null default '[]'::jsonb,
  valor numeric,
  qtd_retornada numeric,
  criado_por_id text,
  criado_por_login text,
  criado_por_nome text,
  created_at timestamptz not null default now()
);

create index if not exists se_mov_se_idx on public.suprimentos_se_movimentacoes (se_id, created_at);

alter table public.suprimentos_se_movimentacoes enable row level security;
drop policy if exists "semov_select" on public.suprimentos_se_movimentacoes;
create policy "semov_select" on public.suprimentos_se_movimentacoes for select to anon, authenticated using (true);
drop policy if exists "semov_insert" on public.suprimentos_se_movimentacoes;
create policy "semov_insert" on public.suprimentos_se_movimentacoes for insert to anon, authenticated with check (true);
drop policy if exists "semov_update" on public.suprimentos_se_movimentacoes;
create policy "semov_update" on public.suprimentos_se_movimentacoes for update to anon, authenticated using (true) with check (true);
drop policy if exists "semov_delete" on public.suprimentos_se_movimentacoes;
create policy "semov_delete" on public.suprimentos_se_movimentacoes for delete to anon, authenticated using (true);

notify pgrst, 'reload schema';
