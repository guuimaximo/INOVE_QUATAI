-- DP360 — a PROVA do que o robô fez no Transnet, guardada para sempre.
--
-- O PROBLEMA QUE ISTO RESOLVE
-- Os bots do Transnet fotografam a tela antes e depois de cada lançamento
-- (`bot/evidencias/*.png` no repo guuimaximo/DP360). É a peça trabalhista: o que
-- se anexa quando alguém contesta uma advertência ou um ajuste de ponto. Hoje
-- essas fotos só existem como artefato do run do GitHub Actions, com
-- `retention-days: 30`. Dois buracos:
--   1. quem não tem acesso ao repositório não alcança a prova;
--   2. em 30 dias ela SOME — e reclamação trabalhista vive muito mais que isso.
--
-- O QUE ESTA MIGRATION CRIA
--   · public.dp360_robo_execucao  — liga cada disparo (dp360_auditoria) ao RUN
--                                   do GitHub que ele provocou.
--   · public.dp360_robo_evidencia — uma linha por arquivo já copiado do run
--                                   para o Storage do INOVE.
--   · bucket PRIVADO `dp360_evidencias` — a cópia permanente das fotos.
--
-- POR QUE PRIVADO, SEM EXCEÇÃO
-- Cada print é uma foto da tela do Transnet: tem NOME, CRACHÁ e HORÁRIO de
-- gente. Bucket público seria a mesma foto acessível por URL adivinhável, sem
-- login nenhum. Aqui o bucket é privado, NENHUMA policy de storage cita este
-- bucket para `anon`/`authenticated` (ou seja: navegador nenhum lê direto), e a
-- leitura acontece por URL assinada de vida curta emitida pela Edge Function
-- `dp360-api`, que já exige sessão do INOVE + nível Administrador.
--
-- Fase 1 do RLS deste projeto: NADA para `anon`. O `revoke ... from anon` é
-- OBRIGATÓRIO — no Supabase toda tabela nova do schema `public` nasce com grant
-- amplo para `anon` por default privilege; conceder só a `authenticated` não
-- fecha nada. Já houve vazamento neste projeto exatamente por esse esquecimento.

/* ══════════════════════════════════════════════════════════════════════════
   1) EXECUÇÃO — o elo que faltava entre "alguém clicou" e "o robô rodou"
   ══════════════════════════════════════════════════════════════════════════
   `dp360_auditoria` já registra o disparo (quem, quando, qual workflow, ensaio
   ou valendo). O que faltava é o RUN correspondente — sem ele não há como
   chegar na evidência.

   O `POST .../dispatches` do GitHub responde 204 SEM CORPO: ele não devolve o
   id do run. O jeito é consultar os runs do workflow logo depois e casar pelo
   instante. Isso é um palpite, e a tabela trata como palpite:
     `casamento` diz o QUE ACONTECEU no casamento, e `candidatos` guarda a lista
     quando não deu para ter certeza. Nunca se escolhe "o mais provável" — run
     errado significaria mostrar a foto do lançamento de OUTRA pessoa como prova
     deste aqui, que é pior do que não ter foto nenhuma.                        */

create table if not exists public.dp360_robo_execucao (
  id             bigint generated always as identity primary key,

  -- o disparo que originou tudo (dp360_auditoria, acao = 'robo_disparo')
  auditoria_id   bigint      not null references public.dp360_auditoria (id),

  robo           text        not null,   -- 'ocorrencias' | 'ponto' | 'comunicado' | 'ajustes'
  workflow       text        not null,   -- 'ponto.yml', 'comunicado.yml'...
  repo           text        not null,   -- 'guuimaximo/DP360'
  git_ref        text        not null,   -- 'main'
  confirmar      boolean     not null default false,  -- false = ENSAIO (o bot não clica)
  disparado_em   timestamptz not null default now(),
  autor_id       uuid,
  autor_nome     text,

  -- ── o casamento com o run ────────────────────────────────────────────────
  --   pendente       o disparo saiu e ainda não se procurou o run
  --   exato          um único candidato na janela → é este, com certeza
  --   ambiguo        mais de um candidato → `candidatos` tem todos, e a tela
  --                  mostra a lista em vez de fingir que sabe qual é
  --   nao_encontrado nenhum run apareceu na janela (o GitHub pode ter demorado
  --                  ou o workflow ficou na fila do `concurrency: bots-transnet`)
  --   erro           a consulta ao GitHub falhou; `casamento_nota` traz o motivo
  casamento      text        not null default 'pendente'
                 check (casamento in ('pendente', 'exato', 'ambiguo', 'nao_encontrado', 'erro')),
  casamento_nota text,
  candidatos     jsonb       not null default '[]'::jsonb,
  casado_em      timestamptz,

  run_id         bigint,
  run_numero     integer,
  run_url        text,
  run_criado_em  timestamptz,
  run_status     text,        -- queued | in_progress | completed
  run_conclusao  text,        -- success | failure | cancelled | skipped...

  -- ── o arquivamento da prova ──────────────────────────────────────────────
  arquivado_em      timestamptz,
  arquivos_total    integer   not null default 0,
  arquivo_bytes     bigint    not null default 0,
  arquivamento_erro text
);

-- UM disparo, UMA execução. Sem isto, um clique duplo no botão "casar" criaria
-- duas linhas para o mesmo disparo e a tela mostraria a mesma coisa duas vezes.
create unique index if not exists dp360_robo_execucao_auditoria_uk
  on public.dp360_robo_execucao (auditoria_id);

-- UM RUN PERTENCE A UM DISPARO SÓ — e esta é a trava mais útil da tabela, não
-- só higiene. Dois disparos seguidos (o `concurrency: bots-transnet` enfileira
-- os bots, então isso acontece de verdade) caem na MESMA janela de tempo e
-- teriam os mesmos candidatos. Como o primeiro já reivindicou o run dele, o
-- segundo pode descartá-lo da lista e frequentemente sobra um só — o casamento
-- vira `exato` por eliminação, não por chute.
create unique index if not exists dp360_robo_execucao_run_uk
  on public.dp360_robo_execucao (run_id)
  where run_id is not null;

create index if not exists dp360_robo_execucao_disparo_idx
  on public.dp360_robo_execucao (disparado_em desc);

create index if not exists dp360_robo_execucao_robo_idx
  on public.dp360_robo_execucao (robo, disparado_em desc);

/* ══════════════════════════════════════════════════════════════════════════
   2) EVIDÊNCIA — uma linha por arquivo já copiado para o Storage
   ══════════════════════════════════════════════════════════════════════════
   `cracha` e `date_ref` saem do NOME do arquivo que o bot gravou. Os padrões
   (bot_ponto.py:60 `evidencia()`, bot_ajustes_app.py:1371):
     <ts>_preenchido_<cracha>_<dd-mm-aaaa>.png     correção · ANTES de salvar
     <ts>_apos_inserir_<cracha>_<dd-mm-aaaa>.png   correção · DEPOIS de salvar
     <ts>_relido_<cracha>_<dd-mm-aaaa>.png         releitura do cartão
     <ts>_erro_<cracha>.png                        deu erro naquele crachá
     conferido_<cracha8>_<aaaa-mm-dd>.png          cartão lido pelo bot
     <ts>_envio_csv_*.png                          comunicado: o lote inteiro
   Guardar `cracha`/`date_ref` em coluna é o que permite a busca "por caso"
   (crachá + dia), que é como o DP procura a prova quando alguém contesta.

   NÃO é dado novo exposto: o crachá já está em `dp360_auditoria.alvo`, e as
   duas tabelas são legíveis só por Administrador, pela mesma policy.          */

create table if not exists public.dp360_robo_evidencia (
  id            bigint generated always as identity primary key,
  execucao_id   bigint      not null references public.dp360_robo_execucao (id) on delete cascade,
  run_id        bigint      not null,

  artefato_id   bigint,
  artefato_nome text,

  arquivo       text        not null,   -- nome original dentro do zip
  caminho       text        not null,   -- caminho no bucket dp360_evidencias
  bytes         integer     not null default 0,
  tipo          text,                   -- 'png' | 'jpg' | 'csv' | 'txt'...

  -- extraídos do nome do arquivo (podem ser nulos: nem todo print é por pessoa)
  cracha        text,
  date_ref      date,
  momento       text,                   -- 'antes' | 'depois' | 'leitura' | 'erro' | 'lote'
  rotulo        text,                   -- legenda humana ("correção · antes de salvar")
  capturado_em  timestamptz,            -- carimbo que o bot pôs no nome do arquivo

  criado_em     timestamptz not null default now()
);

-- Idempotência do arquivamento: rodar de novo o mesmo run não duplica a prova.
create unique index if not exists dp360_robo_evidencia_caminho_uk
  on public.dp360_robo_evidencia (caminho);

-- A busca "por caso": crachá + dia. É o índice da pergunta que o DP faz.
create index if not exists dp360_robo_evidencia_caso_idx
  on public.dp360_robo_evidencia (cracha, date_ref);

create index if not exists dp360_robo_evidencia_execucao_idx
  on public.dp360_robo_evidencia (execucao_id);

create index if not exists dp360_robo_evidencia_run_idx
  on public.dp360_robo_evidencia (run_id);

/* ══════════════════════════════════════════════════════════════════════════
   3) RLS — ler é só de Administrador; ESCREVER, só o gateway
   ══════════════════════════════════════════════════════════════════════════
   Mesma régua de `dp360_auditoria`: a trilha guarda crachá e nome, então
   `using (true)` faria a própria trilha virar um vazamento de dado pessoal para
   qualquer usuário logado do INOVE.

   Diferença para a `dp360_auditoria`: aqui `authenticated` não recebe nem
   INSERT. Quem escreve é a Edge Function `dp360-api`, com a service key, que
   bypassa RLS — e ela é a única que sabe casar um run e baixar um artefato.
   Navegador não escreve prova.                                                */

alter table public.dp360_robo_execucao  enable row level security;
alter table public.dp360_robo_evidencia enable row level security;

-- O revoke vem ANTES do grant e é o que realmente fecha: o default privilege do
-- Supabase já concedeu a `anon` no `create table` acima.
revoke all on public.dp360_robo_execucao  from anon;
revoke all on public.dp360_robo_evidencia from anon;

grant select on public.dp360_robo_execucao  to authenticated;
grant select on public.dp360_robo_evidencia to authenticated;
-- o grant acima não tira o que o default privilege já deu ao authenticated:
revoke insert, update, delete, truncate, references, trigger
  on public.dp360_robo_execucao  from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.dp360_robo_evidencia from authenticated;

drop policy if exists dp360_robo_execucao_ler on public.dp360_robo_execucao;
create policy dp360_robo_execucao_ler
  on public.dp360_robo_execucao for select
  to authenticated
  using (exists (
    select 1 from public.usuarios_aprovadores u
    where u.auth_user_id = auth.uid()
      and lower(coalesce(u.nivel, '')) in ('administrador', 'admin')
  ));

drop policy if exists dp360_robo_evidencia_ler on public.dp360_robo_evidencia;
create policy dp360_robo_evidencia_ler
  on public.dp360_robo_evidencia for select
  to authenticated
  using (exists (
    select 1 from public.usuarios_aprovadores u
    where u.auth_user_id = auth.uid()
      and lower(coalesce(u.nivel, '')) in ('administrador', 'admin')
  ));

-- Sem policy de insert/update/delete: sem policy, o RLS nega. É de propósito —
-- prova que a pessoa auditada (ou qualquer usuário) pode editar não é prova.

/* ══════════════════════════════════════════════════════════════════════════
   4) STORAGE — bucket PRIVADO, e só o gateway encosta nele
   ══════════════════════════════════════════════════════════════════════════
   `public = false`: nada de URL pública. A tela recebe uma URL ASSINADA de vida
   curta, emitida pela Edge Function.

   Tipos aceitos: os prints (png/jpeg/webp) e o `resultado_lote_*.csv` que o
   bot_ponto grava junto (bot_ponto.py:641) — ele diz o que foi lançado e é
   parte da mesma prova.

   ATENÇÃO ao `on conflict`: força `public = false` mesmo se o bucket já existir
   por engano como público. Um bucket com este conteúdo NUNCA pode voltar a ser
   público, e reaplicar a migration tem de consertar, não preservar o erro.     */

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dp360_evidencias',
  'dp360_evidencias',
  false,
  26214400,  -- 25 MB por arquivo; um print de tela cheia não passa de ~1 MB
  array[
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    'text/csv', 'text/plain', 'application/json'
  ]
)
on conflict (id) do update
set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

/* NENHUMA policy de storage concede este bucket a `anon` ou `authenticated` —
   é assim que ele fica fechado ao navegador. Todas as policies de storage deste
   projeto são escopadas por `bucket_id = '<outro bucket>'`, então nenhuma
   alcança este aqui.

   A policy abaixo é RESTRITIVA (`as restrictive`), o cinto além do suspensório:
   policy restritiva não CONCEDE nada, ela é um E lógico com todas as
   permissivas. Enquanto ela existir, qualquer policy permissiva criada no
   futuro — inclusive uma ampla, criada por engano no painel do Supabase — não
   consegue abrir este bucket para `anon`/`authenticated`. Outros buckets não
   são afetados: para eles `bucket_id <> 'dp360_evidencias'` é verdadeiro e a
   restritiva sai da frente. A service key (o gateway) bypassa RLS e continua
   lendo e gravando normalmente.                                               */
drop policy if exists "dp360_evidencias_somente_gateway" on storage.objects;
create policy "dp360_evidencias_somente_gateway"
  on storage.objects
  as restrictive
  for all
  to anon, authenticated
  using (bucket_id <> 'dp360_evidencias')
  with check (bucket_id <> 'dp360_evidencias');

notify pgrst, 'reload schema';

/* ── TESTE DE FECHAMENTO (rodar depois de aplicar) ─────────────────────────
   Com a ANON KEY pública as duas tabelas têm de dar 401:
     curl -s -o /dev/null -w '%{http_code}\n' \
       "https://wboelthngddvkgrvwkbu.supabase.co/rest/v1/dp360_robo_execucao?select=id&limit=1" \
       -H "apikey: <ANON>" -H "Authorization: Bearer <ANON>"
     (idem para dp360_robo_evidencia)
   Se der 200, tem buraco: `revoke all on public.<tabela> from anon;`
   E o bucket tem de aparecer com public = false:
     select id, public from storage.buckets where id = 'dp360_evidencias';
   ────────────────────────────────────────────────────────────────────────── */
