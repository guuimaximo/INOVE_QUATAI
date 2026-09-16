-- Vagas: registro de cada exclusão (16/09/2026).
--
-- Excluir uma vaga passou a exigir o login e a senha de um Gestor ou Administrador, na
-- própria tela (dono: "faz a mesma coisa para o botão excluir, colocar para gestor e adm
-- e apenas com senha deles"). A vaga some da `vagas_solicitacao`, então quem autorizou só
-- fica registrado aqui, junto com uma cópia da vaga como ela estava.
--
-- A tela grava esta linha ANTES de apagar a vaga e a remove se a exclusão falhar.
create table if not exists public.vagas_exclusoes (
  id                 bigserial primary key,
  vaga_id            text not null,
  numero_vaga        text,
  nome_cargo         text,
  dados              jsonb,          -- a vaga inteira, como estava antes de ser apagada
  motivo             text,
  autorizado_por     text not null,  -- nome do Gestor/Administrador que digitou a senha
  autorizado_login   text,
  autorizado_nivel   text,
  excluido_por       text,           -- quem estava logado na tela
  excluido_em        timestamptz not null default now()
);

create index if not exists idx_vagas_exclusoes_em on public.vagas_exclusoes (excluido_em desc);

-- Só `authenticated`. A tabela nasce com grant para anon (default privileges do
-- Supabase): o revoke é obrigatório.
alter table public.vagas_exclusoes enable row level security;
drop policy if exists "auth vagas_exclusoes" on public.vagas_exclusoes;
create policy "auth vagas_exclusoes" on public.vagas_exclusoes
  for all to authenticated using (true) with check (true);
revoke all on public.vagas_exclusoes from anon;
revoke all on sequence public.vagas_exclusoes_id_seq from anon;
grant select, insert, delete on public.vagas_exclusoes to authenticated;
grant usage, select on sequence public.vagas_exclusoes_id_seq to authenticated;

comment on table public.vagas_exclusoes is
  'Cada vaga excluída: cópia da vaga, motivo e o Gestor/Administrador que autorizou com login e senha.';

notify pgrst, 'reload schema';
