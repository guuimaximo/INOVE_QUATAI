-- OPERACIONAL · PASSAGEM DE TURNO (25/09/2026)
--
-- O "Fechamento de Turno" que o plantão preenchia em planilha, agora no INOVE: um
-- registro por DIA (como o PCM), alimentado ao longo do dia, com as faltas e as
-- intercorrências de motorista. As intercorrências guardam as CHAPAS dos motoristas
-- citados: o DP360 lê daqui a observação do plantão no cartão de ponto de cada um
-- (ex.: "30060914 trouxe o 222214 para a garagem porque o 30060916 passou mal" dá
-- subsídio à análise do ponto dos DOIS).
--
-- Chapa gravada SÓ COM DÍGITOS e SEM ZERO À ESQUERDA ("03602042" -> "3602042"): as bases
-- do ponto divergem no zero à esquerda, e a busca do DP360 normaliza do mesmo jeito.
--
-- RLS: só `authenticated` (playbook §1). Tabela nova nasce com grant para `anon` pelos
-- default privileges — o `revoke ... from anon` abaixo é o que fecha.

create table if not exists public.operacional_turnos (
  id uuid primary key default gen_random_uuid(),
  data_referencia date not null unique,
  turno_inicio text not null default '07:00',
  turno_fim text not null default '19:00',
  -- os números do turno: digitados pelo plantão; GNS, faixa amarela, SOS, troca, avaria
  -- e reservas têm um "puxar do sistema" na tela (PCM do dia, SOS, Controle de Reservas)
  carros_programados integer,
  gns integer,
  po_programado integer,
  faixa_amarela integer,
  reservas_manha integer,
  reservas_tarde integer,
  sos integer,
  troca integer,
  avaria integer,
  assalto integer,
  malotes text,
  observacoes text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.operacional_faltas (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.operacional_turnos(id) on delete cascade,
  data_referencia date not null,
  periodo text not null check (periodo in ('MANHA', 'TARDE')),
  chapa text not null,
  operador text,
  linha text,
  substituto_chapa text,
  substituto_nome text,
  substituto_linha text,
  observacao text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
create index if not exists operacional_faltas_dia_chapa on public.operacional_faltas (data_referencia, chapa);
create index if not exists operacional_faltas_dia_subst on public.operacional_faltas (data_referencia, substituto_chapa);

create table if not exists public.operacional_intercorrencias (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.operacional_turnos(id) on delete cascade,
  data_referencia date not null,
  periodo text not null check (periodo in ('MANHA', 'TARDE')),
  hora text,
  veiculo text,
  texto text not null,
  -- os motoristas citados (chapas normalizadas): é por aqui que o DP360 acha a
  -- intercorrência no cartão de ponto de cada um
  chapas text[] not null default '{}',
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
create index if not exists operacional_intercorrencias_dia on public.operacional_intercorrencias (data_referencia);
create index if not exists operacional_intercorrencias_chapas on public.operacional_intercorrencias using gin (chapas);

alter table public.operacional_turnos enable row level security;
alter table public.operacional_faltas enable row level security;
alter table public.operacional_intercorrencias enable row level security;

drop policy if exists "auth operacional_turnos" on public.operacional_turnos;
create policy "auth operacional_turnos" on public.operacional_turnos
  for all to authenticated using (true) with check (true);
drop policy if exists "auth operacional_faltas" on public.operacional_faltas;
create policy "auth operacional_faltas" on public.operacional_faltas
  for all to authenticated using (true) with check (true);
drop policy if exists "auth operacional_intercorrencias" on public.operacional_intercorrencias;
create policy "auth operacional_intercorrencias" on public.operacional_intercorrencias
  for all to authenticated using (true) with check (true);

revoke all on public.operacional_turnos from anon;
revoke all on public.operacional_faltas from anon;
revoke all on public.operacional_intercorrencias from anon;
grant select, insert, update, delete on public.operacional_turnos to authenticated;
grant select, insert, update, delete on public.operacional_faltas to authenticated;
grant select, insert, update, delete on public.operacional_intercorrencias to authenticated;

notify pgrst, 'reload schema';
