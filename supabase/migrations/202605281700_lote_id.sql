-- Conceito de "lote" = sessão de contagem.
-- Várias sessões podem acontecer no mesmo dia, e cada uma dispara o workflow uma única vez.

alter table public.suprimentos_contagens
  add column if not exists lote_id uuid;

alter table public.suprimentos_bot_jobs
  add column if not exists lote_id uuid;

create index if not exists supcontagens_lote_idx on public.suprimentos_contagens (lote_id);
create index if not exists supbotjobs_lote_idx on public.suprimentos_bot_jobs (lote_id);

notify pgrst, 'reload schema';
