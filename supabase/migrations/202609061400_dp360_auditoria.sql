-- DP360 — trilha de auditoria das acoes que saem da tela.
--
-- Por que uma tabela e nao um campo em cada lugar: as tres acoes que faltavam no
-- porte tem a MESMA pergunta por tras — "quem fez isso, quando, e sobre quem?".
--   · marcar um cracha como "nao bate ponto" (some da lista de abandonos);
--   · exportar o Banco de Horas (folha: hora extra e valor em R$);
--   · disparar o robo do Transnet (avisa/adverte um trabalhador).
-- Nenhuma delas tinha autor nem carimbo. A primeira e uma lista JSON no
-- `app_config` que uma aba sobrescreve a outra; a segunda foi adiada justamente
-- ate existir registro de quem exportou; a terceira alcanca pessoa de verdade.
--
-- Fica no projeto do INOVE (nao no de importacao) de proposito: e registro do
-- INOVE sobre quem clicou, e o de importacao e alimentado por pipeline.
--
-- APENDE-SE, NAO SE EDITA: sem update e sem delete para ninguem. Trilha que a
-- pessoa auditada pode apagar nao e trilha.

create table if not exists public.dp360_auditoria (
  id          bigint generated always as identity primary key,
  acao        text        not null,   -- 'abandono_nao_bate' | 'banco_horas_export' | 'robo_disparo'
  alvo        text,                   -- cracha, competencia, workflow... o "sobre quem/o que"
  detalhe     jsonb       not null default '{}'::jsonb,
  autor_id    uuid,                   -- auth.uid() de quem clicou
  autor_nome  text,
  criado_em   timestamptz not null default now()
);

create index if not exists dp360_auditoria_acao_idx  on public.dp360_auditoria (acao, criado_em desc);
create index if not exists dp360_auditoria_alvo_idx  on public.dp360_auditoria (alvo);

alter table public.dp360_auditoria enable row level security;

-- Fase 1 do RLS deste projeto: NADA para `anon`. O revoke e obrigatorio porque o
-- Supabase concede ao anon por default privilege — criar a tabela e nao revogar
-- deixa o registro de auditoria legivel sem login.
revoke all on public.dp360_auditoria from anon;
grant select, insert on public.dp360_auditoria to authenticated;
-- o grant acima nao tira o que o default privilege ja deu; o revoke abaixo tira.
revoke update, delete, truncate, references, trigger on public.dp360_auditoria from authenticated;

-- LER e SO DE ADMINISTRADOR. A trilha guarda cracha no `alvo` e nome no
-- `detalhe` — quem exportou folha de quem, quem marcou quem. Deixar
-- `using (true)` faria a trilha de auditoria virar, ela propria, um vazamento
-- de dado pessoal para qualquer usuario logado do INOVE.
drop policy if exists dp360_auditoria_ler on public.dp360_auditoria;
create policy dp360_auditoria_ler
  on public.dp360_auditoria for select
  to authenticated
  using (exists (
    select 1 from public.usuarios_aprovadores u
    where u.auth_user_id = auth.uid()
      and lower(coalesce(u.nivel,'')) in ('administrador','admin')
  ));

drop policy if exists dp360_auditoria_inserir on public.dp360_auditoria;
create policy dp360_auditoria_inserir
  on public.dp360_auditoria for insert
  to authenticated
  with check (true);

-- Sem policy de update/delete: sem policy, o RLS nega.
