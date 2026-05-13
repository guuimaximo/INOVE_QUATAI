alter table public.organograma_manutencao_pessoas
  add column if not exists funcionario_id text,
  add column if not exists funcionario_cracha text;

create index if not exists idx_org_pessoas_funcionario_id
  on public.organograma_manutencao_pessoas(funcionario_id)
  where ativo = true;

notify pgrst, 'reload schema';
