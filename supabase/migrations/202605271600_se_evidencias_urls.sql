-- Adiciona coluna evidencias_urls à tabela suprimentos_servico_externo
alter table public.suprimentos_servico_externo
  add column if not exists evidencias_urls jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
