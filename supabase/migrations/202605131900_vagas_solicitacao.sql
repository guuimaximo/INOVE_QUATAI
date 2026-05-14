create table if not exists public.vagas_solicitacao (
  id uuid primary key default gen_random_uuid(),
  numero_vaga text unique,
  status text not null default 'ABERTA',
  nome_cargo text not null,
  area text,
  gestor text,
  tipo_vaga text,
  substituido text,
  aprovada_diretoria text,
  sigilosa text,
  pcd text,
  local_atuacao text,
  formacao text,
  experiencia_requerida text,
  tempo_experiencia text,
  atividades text,
  conhecimento_requerido text,
  conhecimento_desejavel text,
  habilidades_comportamentais text,
  salario_proposto text,
  contratado_nome text,
  contratado_id_funcionario text,
  data_contratacao date,
  observacoes text,
  criado_por_login text,
  criado_por_nome text,
  criado_por_id text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_vagas_status on public.vagas_solicitacao (status);
create index if not exists idx_vagas_criado_em on public.vagas_solicitacao (criado_em desc);

alter table public.vagas_solicitacao enable row level security;
grant select, insert, update on public.vagas_solicitacao to anon, authenticated;

drop policy if exists "vagas_select" on public.vagas_solicitacao;
create policy "vagas_select" on public.vagas_solicitacao for select to anon, authenticated using (true);
drop policy if exists "vagas_insert" on public.vagas_solicitacao;
create policy "vagas_insert" on public.vagas_solicitacao for insert to anon, authenticated with check (true);
drop policy if exists "vagas_update" on public.vagas_solicitacao;
create policy "vagas_update" on public.vagas_solicitacao for update to anon, authenticated using (true) with check (true);

notify pgrst, 'reload schema';
