-- PCM · PASSAGEM DE TURNO DA MANUTENÇÃO (27/09/2026)
--
-- O "Relatório de Passagem de Turno" que a manutenção fazia no Word (26/09: turno diurno,
-- responsável Adenilson), agora no INOVE, dentro do PCM. Um registro por DIA e TURNO
-- (diurno/noturno — a manutenção vira a noite), com:
--   · alerta prioritário, desvios/ocorrências e a observação das etiquetas (texto);
--   · as LIBERAÇÕES concluídas: o carro e o que foi feito ("222235 foi trocado abraçadeira
--     do radiador"). O PCM já sabe QUAIS carros saíram no turno (`veiculos_pcm.data_saida`),
--     mas não O QUE foi feito — por isso a liberação é digitada, com o PCM como sugestão;
--   · as AUSÊNCIAS da equipe, pela chapa;
--   · o indicador de aderência: previsto x atendido.
-- As etiquetas do SOS (abertas, fechadas e tratadas no turno) são lidas ao vivo, não
-- gravadas aqui.
--
-- Chapa gravada SÓ COM DÍGITOS e SEM ZERO À ESQUERDA, como na passagem do Operacional.
--
-- RLS: só `authenticated` (playbook §1). Tabela nova nasce com grant para `anon` pelos
-- default privileges — o `revoke ... from anon` abaixo é o que fecha.

create table if not exists public.pcm_passagens_turno (
  id uuid primary key default gen_random_uuid(),
  data_referencia date not null,
  turno text not null check (turno in ('DIURNO', 'NOTURNO')),
  turno_inicio text not null,
  turno_fim text not null,
  responsaveis text,
  alerta text,
  etiquetas_obs text,
  desvios text,
  previsto integer check (previsto is null or previsto >= 0),
  atendido integer check (atendido is null or atendido >= 0),
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  unique (data_referencia, turno)
);

create table if not exists public.pcm_passagem_liberacoes (
  id uuid primary key default gen_random_uuid(),
  passagem_id uuid not null references public.pcm_passagens_turno(id) on delete cascade,
  data_referencia date not null,
  turno text not null,
  frota text not null,
  servico text not null,
  -- quando a liberação veio da sugestão do PCM, o carro de lá (para não sugerir de novo)
  veiculo_pcm_id uuid,
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists pcm_passagem_liberacoes_passagem on public.pcm_passagem_liberacoes (passagem_id);
create index if not exists pcm_passagem_liberacoes_frota on public.pcm_passagem_liberacoes (frota, data_referencia);

create table if not exists public.pcm_passagem_ausencias (
  id uuid primary key default gen_random_uuid(),
  passagem_id uuid not null references public.pcm_passagens_turno(id) on delete cascade,
  data_referencia date not null,
  turno text not null,
  chapa text not null,
  nome text,
  funcao text,
  motivo text not null,
  observacao text,
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists pcm_passagem_ausencias_passagem on public.pcm_passagem_ausencias (passagem_id);

alter table public.pcm_passagens_turno enable row level security;
alter table public.pcm_passagem_liberacoes enable row level security;
alter table public.pcm_passagem_ausencias enable row level security;

drop policy if exists "auth pcm_passagens_turno" on public.pcm_passagens_turno;
create policy "auth pcm_passagens_turno" on public.pcm_passagens_turno
  for all to authenticated using (true) with check (true);
drop policy if exists "auth pcm_passagem_liberacoes" on public.pcm_passagem_liberacoes;
create policy "auth pcm_passagem_liberacoes" on public.pcm_passagem_liberacoes
  for all to authenticated using (true) with check (true);
drop policy if exists "auth pcm_passagem_ausencias" on public.pcm_passagem_ausencias;
create policy "auth pcm_passagem_ausencias" on public.pcm_passagem_ausencias
  for all to authenticated using (true) with check (true);

revoke all on public.pcm_passagens_turno from anon;
revoke all on public.pcm_passagem_liberacoes from anon;
revoke all on public.pcm_passagem_ausencias from anon;
grant select, insert, update, delete on public.pcm_passagens_turno to authenticated;
grant select, insert, update, delete on public.pcm_passagem_liberacoes to authenticated;
grant select, insert, update, delete on public.pcm_passagem_ausencias to authenticated;

notify pgrst, 'reload schema';
