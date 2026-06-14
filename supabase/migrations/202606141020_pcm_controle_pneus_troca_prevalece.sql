create or replace view public.vw_pcm_controle_pneus_central as
with posicoes as (
  select 'DD' as posicao
  union all select 'DE'
  union all select 'TEE'
  union all select 'TEI'
  union all select 'TDI'
  union all select 'TDE'
),
prefixos as (
  select distinct nullif(trim(a.prefixo), '') as prefixo
  from public.pcm_pneus_transnet_alocacao a
  where nullif(trim(a.prefixo), '') is not null
  union
  select distinct nullif(trim(a.prefixo), '') as prefixo
  from public.pcm_auditoria_pneus a
  where nullif(trim(a.prefixo), '') is not null
),
base_snapshot as (
  select
    nullif(trim(a.prefixo), '') as prefixo,
    upper(trim(a.posicao)) as posicao,
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
  from prefixos pb
  cross join posicoes p
  left join base_snapshot bs
    on bs.prefixo = pb.prefixo
   and bs.posicao = p.posicao
),
auditorias_ordenadas as (
  select
    a.id::text as auditoria_real_id,
    a.ficha_auditoria,
    nullif(trim(a.prefixo), '') as prefixo,
    a.created_at as auditoria_em,
    a.criado_por_nome as auditado_por,
    a.posicoes,
    row_number() over (partition by nullif(trim(a.prefixo), '') order by a.created_at desc, a.id desc) as rn
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
    nullif(trim(p->>'numero_fogo'), '') as numero_fogo_aud
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
trocas_ordenadas as (
  select
    nullif(trim(t.prefixo_instalacao), '') as prefixo,
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
    nullif(trim(t.numero_fogo_colocado), '') as numero_fogo_troca,
    t.created_at as ultima_troca_em,
    row_number() over (
      partition by nullif(trim(t.prefixo_instalacao), ''),
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
      end
      order by t.created_at desc, t.id desc
    ) as rn
  from public.pcm_troca_pneus t
  where nullif(trim(t.prefixo_instalacao), '') is not null
    and nullif(trim(t.posicao_instalacao), '') is not null
),
troca_post as (
  select
    prefixo,
    posicao,
    numero_fogo_troca,
    ultima_troca_em
  from trocas_ordenadas
  where rn = 1
),
conferencia as (
  select
    coalesce(ua.auditoria_real_id, 'base:' || b.prefixo) as grupo_id,
    coalesce(ua.auditoria_real_id, 'base:' || b.prefixo) as auditoria_id,
    ua.ficha_auditoria,
    b.prefixo as prefixo_base,
    coalesce(ua.prefixo, b.prefixo) as prefixo_auditoria,
    ua.auditoria_em,
    ua.auditado_por,
    b.posicao,
    case
      when ua.auditoria_em is not null
       and tp.ultima_troca_em is not null
       and tp.ultima_troca_em > ua.auditoria_em
       and nullif(trim(tp.numero_fogo_troca), '') is not null then tp.numero_fogo_troca
      else ap.numero_fogo_aud
    end as numero_fogo_aud,
    b.numero_fogo_base,
    (ua.auditoria_real_id is not null) as tem_auditoria,
    case
      when ua.auditoria_em is not null and tp.ultima_troca_em is not null and tp.ultima_troca_em > ua.auditoria_em then true
      else false
    end as troca_pos_auditoria,
    tp.ultima_troca_em as troca_ultima_em,
    b.snapshot_em
  from base b
  left join ultima_auditoria ua
    on ua.prefixo = b.prefixo
  left join auditoria_posicoes ap
    on ap.prefixo_auditoria = b.prefixo
   and ap.posicao = b.posicao
  left join troca_post tp
    on tp.prefixo = b.prefixo
   and tp.posicao = b.posicao
)
select
  c.grupo_id,
  c.auditoria_id,
  c.ficha_auditoria,
  c.prefixo_base,
  c.prefixo_auditoria,
  c.auditoria_em,
  c.auditado_por,
  c.posicao,
  c.numero_fogo_aud,
  c.numero_fogo_base,
  c.tem_auditoria,
  c.troca_pos_auditoria,
  c.troca_ultima_em,
  case
    when c.numero_fogo_aud is null or c.numero_fogo_aud = '' then null
    when lpad(regexp_replace(coalesce(c.numero_fogo_base, ''), '\D', '', 'g'), 6, '0')
       = lpad(regexp_replace(coalesce(c.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0') then 'OK'
    when exists (
      select 1
      from public.pcm_pneus_transnet_inativos i
      where lpad(regexp_replace(coalesce(i.numero_fogo, ''), '\D', '', 'g'), 6, '0')
          = lpad(regexp_replace(coalesce(c.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0')
    ) then 'SUCATA'
    when exists (
      select 1
      from alocacao_por_pneu ap2
      where ap2.pneu_key = lpad(regexp_replace(coalesce(c.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0')
        and (ap2.prefixo <> c.prefixo_auditoria or ap2.posicao <> c.posicao)
    ) then 'OUTRO VEICULO'
    when exists (
      select 1
      from public.pcm_pneus_transnet_ativos at2
      where lpad(regexp_replace(coalesce(at2.numero_fogo, ''), '\D', '', 'g'), 6, '0')
          = lpad(regexp_replace(coalesce(c.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0')
    ) then 'ESTOQUE'
    else 'NAO EXISTE'
  end as status,
  c.snapshot_em
from conferencia c;

grant select on public.vw_pcm_controle_pneus_central to anon, authenticated;
