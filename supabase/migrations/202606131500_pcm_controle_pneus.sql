-- ============================================================================
-- PCM Controle de Pneus
-- 3 tabelas snapshot do TransNet + view que cruza com pcm_auditoria_pneus e
-- pcm_troca_pneus pra calcular o status de cada posicao (OK / SUCATA /
-- OUTRO VEICULO / NAO EXISTE / ESTOQUE).
-- Logica replicada da planilha controle_auditoria_pneus_inove_transnet_principal_v3.
-- ============================================================================

-- ---- snapshot do TransNet: alocacao atual (Pneus Por Veiculo) ----
create table if not exists public.pcm_pneus_transnet_alocacao (
    prefixo     text not null,
    posicao     text not null,   -- DD, DE, TEE, TEI, TDI, TDE, Step
    numero_fogo text,
    snapshot_em timestamptz not null default now(),
    primary key (prefixo, posicao)
);

-- ---- snapshot: pneus ativos (Localizacao de Pneus, boAtivo=S) ----
create table if not exists public.pcm_pneus_transnet_ativos (
    numero_fogo text primary key,
    dot         text,
    km_rodada   numeric,
    vida_atual  text,
    localizacao text,             -- ex: "046-W531" ou estoque "046-..."
    medida      text,
    marca       text,
    posicao     text,
    desenho     text,
    snapshot_em timestamptz not null default now()
);

-- ---- snapshot: pneus inativos (boAtivo=N) - detecta SUCATA ----
create table if not exists public.pcm_pneus_transnet_inativos (
    numero_fogo text primary key,
    motivo      text,
    snapshot_em timestamptz not null default now()
);

-- ---- indices uteis ----
create index if not exists idx_pcm_alocacao_pneu  on public.pcm_pneus_transnet_alocacao (numero_fogo);
create index if not exists idx_pcm_ativos_local   on public.pcm_pneus_transnet_ativos    (localizacao);

-- ---- RLS aberto (kitchen-display style, ja seguido no resto do projeto) ----
alter table public.pcm_pneus_transnet_alocacao enable row level security;
alter table public.pcm_pneus_transnet_ativos   enable row level security;
alter table public.pcm_pneus_transnet_inativos enable row level security;

drop policy if exists "pcm_aloc_read"    on public.pcm_pneus_transnet_alocacao;
drop policy if exists "pcm_ativos_read"  on public.pcm_pneus_transnet_ativos;
drop policy if exists "pcm_inat_read"    on public.pcm_pneus_transnet_inativos;
create policy "pcm_aloc_read"    on public.pcm_pneus_transnet_alocacao   for select to anon, authenticated using (true);
create policy "pcm_ativos_read"  on public.pcm_pneus_transnet_ativos     for select to anon, authenticated using (true);
create policy "pcm_inat_read"    on public.pcm_pneus_transnet_inativos   for select to anon, authenticated using (true);

-- ============================================================================
-- View: para cada (auditoria, posicao) -> base / aud / status
-- ============================================================================
create or replace view public.vw_pcm_controle_pneus_central as
with audit_pos as (
    -- explode auditoria.posicoes (jsonb array) em 1 linha por posicao
    select
        a.id                         as auditoria_id,
        a.ficha_auditoria,
        a.prefixo                    as prefixo_auditoria,
        a.created_at                 as auditoria_em,
        a.criado_por_nome            as auditado_por,
        coalesce(p->>'posicao', '')                            as posicao,
        nullif(trim(p->>'numero_fogo'), '')                    as numero_fogo_aud
    from public.pcm_auditoria_pneus a
    left join lateral jsonb_array_elements(coalesce(a.posicoes, '[]'::jsonb)) p on true
    where a.posicoes is not null
),
base as (
    select prefixo, posicao, numero_fogo from public.pcm_pneus_transnet_alocacao
),
troca_post as (
    -- houve troca apos a auditoria nessa posicao?
    select t.prefixo_instalacao as prefixo, t.posicao_instalacao as posicao,
           max(t.created_at) as ultima_troca_em
    from public.pcm_troca_pneus t
    where t.prefixo_instalacao is not null and t.posicao_instalacao is not null
    group by t.prefixo_instalacao, t.posicao_instalacao
)
select
    ap.auditoria_id,
    ap.ficha_auditoria,
    ap.prefixo_auditoria,
    ap.auditoria_em,
    ap.auditado_por,
    ap.posicao,
    ap.numero_fogo_aud,
    b.numero_fogo  as numero_fogo_base,
    -- "Troca apos auditoria": foi instalado um pneu nessa posicao do prefixo apos a auditoria?
    case
        when tp.ultima_troca_em is not null and tp.ultima_troca_em > ap.auditoria_em then true
        else false
    end as troca_pos_auditoria,
    case
        when ap.numero_fogo_aud is null or ap.numero_fogo_aud = ''                       then null
        when b.numero_fogo is not null and lpad(b.numero_fogo, 6, '0') = lpad(ap.numero_fogo_aud, 6, '0')  then 'OK'
        when exists (select 1 from public.pcm_pneus_transnet_inativos i where lpad(i.numero_fogo, 6, '0') = lpad(ap.numero_fogo_aud, 6, '0'))  then 'SUCATA'
        when exists (
            select 1 from public.pcm_pneus_transnet_ativos at2
            where lpad(at2.numero_fogo, 6, '0') = lpad(ap.numero_fogo_aud, 6, '0')
              and coalesce(at2.localizacao, '') !~ ('-' || ap.prefixo_auditoria || '$')
              and coalesce(at2.localizacao, '') ~ '^[0-9]{3}-[0-9A-Z]+$'
        ) then 'OUTRO VEICULO'
        when exists (select 1 from public.pcm_pneus_transnet_ativos at2 where lpad(at2.numero_fogo, 6, '0') = lpad(ap.numero_fogo_aud, 6, '0'))  then 'ESTOQUE'
        else 'NAO EXISTE'
    end as status
from audit_pos ap
left join base b
    on b.prefixo = ap.prefixo_auditoria and b.posicao = ap.posicao
left join troca_post tp
    on tp.prefixo = ap.prefixo_auditoria and tp.posicao = ap.posicao;

grant select on public.vw_pcm_controle_pneus_central to anon, authenticated;
