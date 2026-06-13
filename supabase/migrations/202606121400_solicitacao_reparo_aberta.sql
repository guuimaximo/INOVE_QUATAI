-- Tabela populada pelo bot_sr_aberta.py: SRs com situacao "Nao Atendida" no TransNet.
-- Chave: id_reclamacao (idReclamacao do TransNet, unico).
-- categoria: 'eletrica' | 'mecanica' (definido pelo bot a partir do motivo).
-- triado_em: setado pela tela quando o ajudante clica no card -> some pra todo mundo.

create table if not exists public.solicitacao_reparo_aberta (
    id_reclamacao    bigint primary key,
    codigo           text,
    usuario_cadastro text,
    equipamento      text,
    prefixo          text,
    situacao         text,
    data_abertura    date,
    motivo           text,
    categoria        text,
    observacao       text,
    triado_em        timestamptz,
    triado_por       text,
    primeiro_visto   timestamptz not null default now(),
    ultima_consulta  timestamptz not null default now()
);

-- Idempotente caso a tabela ja exista de uma migration anterior.
alter table public.solicitacao_reparo_aberta add column if not exists prefixo text;
alter table public.solicitacao_reparo_aberta add column if not exists motivo text;
alter table public.solicitacao_reparo_aberta add column if not exists categoria text;
alter table public.solicitacao_reparo_aberta add column if not exists triado_em timestamptz;
alter table public.solicitacao_reparo_aberta add column if not exists triado_por text;

create index if not exists idx_sra_data_abertura on public.solicitacao_reparo_aberta (data_abertura desc);
create index if not exists idx_sra_ultima_consulta on public.solicitacao_reparo_aberta (ultima_consulta desc);
create index if not exists idx_sra_painel
    on public.solicitacao_reparo_aberta (categoria, prefixo)
    where triado_em is null;

alter table public.solicitacao_reparo_aberta enable row level security;

-- Painel "kitchen display" roda em tablet compartilhado sem login.
-- Leitura e triagem liberadas pra anon + authenticated.
drop policy if exists "sra_read_all" on public.solicitacao_reparo_aberta;
create policy "sra_read_all"
    on public.solicitacao_reparo_aberta
    for select
    to anon, authenticated
    using (true);

drop policy if exists "sra_update_triagem" on public.solicitacao_reparo_aberta;
create policy "sra_update_triagem"
    on public.solicitacao_reparo_aberta
    for update
    to anon, authenticated
    using (true)
    with check (true);

-- Realtime: a tela acompanha mudancas (insert do bot, update do clique).
alter publication supabase_realtime add table public.solicitacao_reparo_aberta;
