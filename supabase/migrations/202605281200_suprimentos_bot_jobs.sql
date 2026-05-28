-- Fila de jobs do bot de conferência de estoque.
-- A app insere um job (status='pendente'), o bot em C:\Projetos\Bot_Estoque_1
-- faz polling, executa a conferência da data_alvo no TransNet e atualiza as
-- linhas correspondentes em suprimentos_contagens.

create table if not exists public.suprimentos_bot_jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'conferencia_dia',
  data_alvo date not null,
  status text not null default 'pendente', -- pendente | processando | concluido | erro
  criado_por_id integer,
  criado_por_nome text,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  resultado_json jsonb,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supbotjobs_status_idx on public.suprimentos_bot_jobs (status);
create index if not exists supbotjobs_data_idx on public.suprimentos_bot_jobs (data_alvo desc);

create or replace function public.set_supbotjobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_supbotjobs_updated_at on public.suprimentos_bot_jobs;
create trigger trg_supbotjobs_updated_at
  before update on public.suprimentos_bot_jobs
  for each row execute function public.set_supbotjobs_updated_at();

alter table public.suprimentos_bot_jobs enable row level security;
drop policy if exists "supbotjobs_select" on public.suprimentos_bot_jobs;
create policy "supbotjobs_select" on public.suprimentos_bot_jobs for select to anon, authenticated using (true);
drop policy if exists "supbotjobs_insert" on public.suprimentos_bot_jobs;
create policy "supbotjobs_insert" on public.suprimentos_bot_jobs for insert to anon, authenticated with check (true);
drop policy if exists "supbotjobs_update" on public.suprimentos_bot_jobs;
create policy "supbotjobs_update" on public.suprimentos_bot_jobs for update to anon, authenticated using (true) with check (true);
