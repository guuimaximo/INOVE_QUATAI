-- ============================================================================
-- vw_pcm_controle_pneus_central
-- Ajuste: trocas posteriores a auditoria sobrescrevem o numero_fogo_aud daquela
-- posicao. Logica espelhando a regra do PCMTrocaPneus:
--
--   * Posicao = lado INSTALACAO da troca (prefixo_instalacao + posicao_instalacao):
--       numero_fogo_aud  <-  numero_fogo_colocado
--
--   * Posicao = lado RETIRADA da troca CARRO->CARRO (prefixo_retirada + posicao_retirada):
--       origem_recebeu = 'FICOU SEM PNEU'                    -> 'PNEU RETIRADO'
--       origem_recebeu = 'RECEBEU O PNEU DO CARRO DE DESTINO' -> numero_fogo_origem_recebido
--       origem_recebeu = 'RECEBEU OUTRO PNEU'                -> numero_fogo_origem_recebido
--       (sem origem_recebeu)                                  -> 'PNEU RETIRADO' (fallback)
--
-- troca_pos_auditoria continua TRUE quando a troca rolou DEPOIS do created_at
-- da auditoria — gera a estrelinha amarela.
-- ============================================================================

create or replace view public.vw_pcm_controle_pneus_central as
with posicoes as (
  select 'DD' as posicao
  union all select 'DE'
  union all select 'TEE'
  union all select 'TEI'
  union all select 'TDI'
  union all select 'TDE'
),
prefixos_base as (
  select distinct a.prefixo
  from public.pcm_pneus_transnet_alocacao a
),
base_snapshot as (
  select
    a.prefixo,
    a.posicao,
    nullif(trim(a.numero_fogo), '') as numero_fogo_base,
    a.snapshot_em
  from public.pcm_pneus_transnet_alocacao a
),
base as (
  select
    pb.prefixo,
    p.posicao,
    bs.numero_fogo_base,
    bs.snapshot_em
  from prefixos_base pb
  cross join posicoes p
  left join base_snapshot bs
    on bs.prefixo = pb.prefixo
   and bs.posicao = p.posicao
),
auditorias_ordenadas as (
  select
    a.id::text as auditoria_real_id,
    a.ficha_auditoria,
    a.prefixo,
    a.created_at as auditoria_em,
    a.criado_por_nome as auditado_por,
    a.posicoes,
    row_number() over (partition by a.prefixo order by a.created_at desc, a.id desc) as rn
  from public.pcm_auditoria_pneus a
),
ultima_auditoria as (
  select *
  from auditorias_ordenadas
  where rn = 1
),
auditoria_posicoes as (
  select
    ua.auditoria_real_id,
    ua.ficha_auditoria,
    ua.prefixo as prefixo_auditoria,
    ua.auditoria_em,
    ua.auditado_por,
    case upper(trim(coalesce(p->>'posicao', '')))
      when 'DD' then 'DD'
      when 'DIANTEIRO DIREITO' then 'DD'
      when 'DE' then 'DE'
      when 'DIANTEIRO ESQUERDO' then 'DE'
      when 'TEE' then 'TEE'
      when 'TRASEIRO EXTERNO ESQUERDO' then 'TEE'
      when 'TEI' then 'TEI'
      when 'TRASEIRO INTERNO ESQUERDO' then 'TEI'
      when 'TDI' then 'TDI'
      when 'TRASEIRO INTERNO DIREITO' then 'TDI'
      when 'TDE' then 'TDE'
      when 'TRASEIRO EXTERNO DIREITO' then 'TDE'
      else coalesce(nullif(trim(p->>'posicao'), ''), '')
    end as posicao,
    nullif(trim(p->>'numero_fogo'), '') as numero_fogo_aud_original
  from ultima_auditoria ua
  left join lateral jsonb_array_elements(coalesce(ua.posicoes, '[]'::jsonb)) p on true
),
alocacao_por_pneu as (
  select
    lpad(regexp_replace(coalesce(bs.numero_fogo_base, ''), '\D', '', 'g'), 6, '0') as pneu_key,
    bs.prefixo,
    bs.posicao
  from base_snapshot bs
  where coalesce(bs.numero_fogo_base, '') <> ''
),
-- ===== TROCAS POSTERIORES (sobrescrevem aud) =====
-- Cada troca gera 1 linha pro lado INSTALACAO e (se CARRO->CARRO) outra pro lado RETIRADA.
trocas_normalizadas as (
  -- lado INSTALACAO (vale pros 2 tipos de troca)
  select
    t.prefixo_instalacao as prefixo,
    case upper(trim(coalesce(t.posicao_instalacao, '')))
      when 'DD' then 'DD'
      when 'DIANTEIRO DIREITO' then 'DD'
      when 'DE' then 'DE'
      when 'DIANTEIRO ESQUERDO' then 'DE'
      when 'TEE' then 'TEE'
      when 'TRASEIRO EXTERNO ESQUERDO' then 'TEE'
      when 'TEI' then 'TEI'
      when 'TRASEIRO INTERNO ESQUERDO' then 'TEI'
      when 'TDI' then 'TDI'
      when 'TRASEIRO INTERNO DIREITO' then 'TDI'
      when 'TDE' then 'TDE'
      when 'TRASEIRO EXTERNO DIREITO' then 'TDE'
      else trim(coalesce(t.posicao_instalacao, ''))
    end as posicao,
    nullif(trim(t.numero_fogo_colocado), '') as numero_novo,
    t.created_at,
    t.id
  from public.pcm_troca_pneus t
  where t.prefixo_instalacao is not null
    and t.posicao_instalacao is not null

  union all

  -- lado RETIRADA (so CARRO -> CARRO)
  select
    t.prefixo_retirada as prefixo,
    case upper(trim(coalesce(t.posicao_retirada, '')))
      when 'DD' then 'DD'
      when 'DIANTEIRO DIREITO' then 'DD'
      when 'DE' then 'DE'
      when 'DIANTEIRO ESQUERDO' then 'DE'
      when 'TEE' then 'TEE'
      when 'TRASEIRO EXTERNO ESQUERDO' then 'TEE'
      when 'TEI' then 'TEI'
      when 'TRASEIRO INTERNO ESQUERDO' then 'TEI'
      when 'TDI' then 'TDI'
      when 'TRASEIRO INTERNO DIREITO' then 'TDI'
      when 'TDE' then 'TDE'
      when 'TRASEIRO EXTERNO DIREITO' then 'TDE'
      else trim(coalesce(t.posicao_retirada, ''))
    end as posicao,
    case
      when upper(trim(coalesce(t.origem_recebeu, ''))) = 'FICOU SEM PNEU' then 'PNEU RETIRADO'
      when nullif(trim(t.numero_fogo_origem_recebido), '') is not null then trim(t.numero_fogo_origem_recebido)
      else 'PNEU RETIRADO'
    end as numero_novo,
    t.created_at,
    t.id
  from public.pcm_troca_pneus t
  where upper(trim(coalesce(t.tipo_troca, ''))) = 'CARRO -> CARRO'
    and t.prefixo_retirada is not null
    and t.posicao_retirada is not null
),
trocas_ranked as (
  select
    prefixo,
    posicao,
    numero_novo,
    created_at as ultima_troca_em,
    row_number() over (partition by prefixo, posicao order by created_at desc, id desc) as rn
  from trocas_normalizadas
),
ultima_troca as (
  select prefixo, posicao, numero_novo, ultima_troca_em
  from trocas_ranked
  where rn = 1
)
select
  coalesce(ua.auditoria_real_id, 'base:' || b.prefixo) as grupo_id,
  coalesce(ua.auditoria_real_id, 'base:' || b.prefixo) as auditoria_id,
  ua.ficha_auditoria,
  b.prefixo as prefixo_base,
  b.prefixo as prefixo_auditoria,
  ua.auditoria_em,
  ua.auditado_por,
  b.posicao,
  -- numero_fogo_aud final: usa o resultado da troca se ela rolou (independente
  -- da auditoria) ou se rolou DEPOIS da auditoria.
  case
    when ut.numero_novo is not null
         and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
      then ut.numero_novo
    else ap.numero_fogo_aud_original
  end as numero_fogo_aud,
  ap.numero_fogo_aud_original,
  b.numero_fogo_base,
  (ua.auditoria_real_id is not null) as tem_auditoria,
  case
    when ua.auditoria_em is not null
         and ut.ultima_troca_em is not null
         and ut.ultima_troca_em > ua.auditoria_em
      then true
    else false
  end as troca_pos_auditoria,
  ut.ultima_troca_em as troca_ultima_em,
  -- status comparando Base vs aud_final
  case
    -- pneu retirado sem reposicao: status sempre vermelho (incorreto)
    when (case
            when ut.numero_novo is not null
                 and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
              then ut.numero_novo
            else ap.numero_fogo_aud_original
          end) = 'PNEU RETIRADO'
      then 'NAO EXISTE'
    when (case
            when ut.numero_novo is not null
                 and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
              then ut.numero_novo
            else ap.numero_fogo_aud_original
          end) is null or
         (case
            when ut.numero_novo is not null
                 and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
              then ut.numero_novo
            else ap.numero_fogo_aud_original
          end) = ''
      then null
    when lpad(regexp_replace(coalesce(b.numero_fogo_base, ''), '\D', '', 'g'), 6, '0')
       = lpad(regexp_replace(coalesce(case
                                        when ut.numero_novo is not null
                                             and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
                                          then ut.numero_novo
                                        else ap.numero_fogo_aud_original
                                      end, ''), '\D', '', 'g'), 6, '0')
      then 'OK'
    when exists (
      select 1 from public.pcm_pneus_transnet_inativos i
      where lpad(regexp_replace(coalesce(i.numero_fogo, ''), '\D', '', 'g'), 6, '0')
          = lpad(regexp_replace(coalesce(case
                                          when ut.numero_novo is not null
                                               and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
                                            then ut.numero_novo
                                          else ap.numero_fogo_aud_original
                                        end, ''), '\D', '', 'g'), 6, '0')
    ) then 'SUCATA'
    when exists (
      select 1 from alocacao_por_pneu ap2
      where ap2.pneu_key = lpad(regexp_replace(coalesce(case
                                                          when ut.numero_novo is not null
                                                               and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
                                                            then ut.numero_novo
                                                          else ap.numero_fogo_aud_original
                                                        end, ''), '\D', '', 'g'), 6, '0')
        and (ap2.prefixo <> b.prefixo or ap2.posicao <> b.posicao)
    ) then 'OUTRO VEICULO'
    when exists (
      select 1 from public.pcm_pneus_transnet_ativos at2
      where lpad(regexp_replace(coalesce(at2.numero_fogo, ''), '\D', '', 'g'), 6, '0')
          = lpad(regexp_replace(coalesce(case
                                          when ut.numero_novo is not null
                                               and (ua.auditoria_em is null or ut.ultima_troca_em > ua.auditoria_em)
                                            then ut.numero_novo
                                          else ap.numero_fogo_aud_original
                                        end, ''), '\D', '', 'g'), 6, '0')
    ) then 'ESTOQUE'
    else 'NAO EXISTE'
  end as status,
  b.snapshot_em
from base b
left join ultima_auditoria ua
  on ua.prefixo = b.prefixo
left join auditoria_posicoes ap
  on ap.prefixo_auditoria = b.prefixo
 and ap.posicao = b.posicao
left join ultima_troca ut
  on ut.prefixo = b.prefixo
 and ut.posicao = b.posicao;

grant select on public.vw_pcm_controle_pneus_central to anon, authenticated;
