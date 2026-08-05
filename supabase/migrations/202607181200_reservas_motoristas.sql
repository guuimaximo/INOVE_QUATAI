-- Modulo Pessoas > Controle de Reservas. Registra, por dia, os motoristas que
-- ficaram de reserva a disposicao da empresa, com hora de entrada e de saida.
-- Registro direto (sem fluxo de validacao): quem tem acesso lanca e edita.
-- Campos extras: `cobertura` (onde/o que o reserva atendeu no dia) e observacao.

create extension if not exists pgcrypto;

create table if not exists public.reservas_motoristas (
  id uuid primary key default gen_random_uuid(),

  -- snapshot do motorista (origem: funcionarios_atualizada)
  funcionario_id text,
  funcionario_cracha text,
  funcionario_nome text,
  funcionario_funcao text,

  -- registro do dia
  data_referencia date not null,
  hora_entrada time,
  hora_saida time,
  cobertura text,
  observacao text,

  -- auditoria
  criado_por_login text,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_por_login text,
  atualizado_por_nome text,
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_reservas_motoristas_data on public.reservas_motoristas (data_referencia);
create index if not exists idx_reservas_motoristas_cracha on public.reservas_motoristas (funcionario_cracha);

alter table public.reservas_motoristas enable row level security;

-- Somente usuarios autenticados (nunca anon). O acesso anonimo foi trancado no
-- banco na "RLS Fase 1"; grants a anon reabririam o buraco (ver atestados).
drop policy if exists "anon all reservas_motoristas" on public.reservas_motoristas;
drop policy if exists "auth reservas_motoristas" on public.reservas_motoristas;
create policy "auth reservas_motoristas" on public.reservas_motoristas
  for all to authenticated using (true) with check (true);

-- IMPORTANTE: no Supabase, toda tabela nova no schema public nasce com grants
-- para anon por DEFAULT PRIVILEGES. Conceder só a authenticated NAO basta — o
-- anon precisa ser revogado explicitamente, senao a tabela fica legivel/gravavel
-- sem login (foi o que aconteceu aqui e no atestados). Ver skill inove-playbook.
revoke all on public.reservas_motoristas from anon;
grant select, insert, update, delete on public.reservas_motoristas to authenticated;

notify pgrst, 'reload schema';
