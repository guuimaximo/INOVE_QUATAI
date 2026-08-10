-- Programacao MANUAL da semana das Preventivas (tela PCM_PreventivasPlano).
-- O usuario "programa" carros a partir do Gerencial; cada item vira uma linha aqui.
-- "Feito" e derivado (casa com public.preventivas realizadas), nao fica armazenado.
create extension if not exists pgcrypto;

create table if not exists public.preventivas_programacao (
  id uuid primary key default gen_random_uuid(),
  prefixo text not null,
  categoria text not null,          -- 'Revisão' | 'Inspeção' | 'Garantia'
  tipo text,
  data_planejada date,
  semana text,                       -- segunda-feira da semana (YYYY-MM-DD)
  observacao text,
  criado_por_login text,
  criado_por_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_prev_prog_semana on public.preventivas_programacao (semana);
create index if not exists idx_prev_prog_prefixo on public.preventivas_programacao (prefixo);

alter table public.preventivas_programacao enable row level security;

drop policy if exists "auth preventivas_programacao" on public.preventivas_programacao;
create policy "auth preventivas_programacao" on public.preventivas_programacao
  for all to authenticated using (true) with check (true);

-- ESSENCIAL: tabela nova no Supabase nasce com grant pro anon (default privileges).
revoke all on public.preventivas_programacao from anon;
grant select, insert, update, delete on public.preventivas_programacao to authenticated;

notify pgrst, 'reload schema';
