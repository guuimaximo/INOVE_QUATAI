create or replace view public.vw_pcm_controle_pneus_central as
with base as (
  select
    a.prefixo,
    a.posicao,
    nullif(trim(a.numero_fogo), '') as numero_fogo_base,
    a.snapshot_em
  from public.pcm_pneus_transnet_alocacao a
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
    nullif(trim(p->>'numero_fogo'), '') as numero_fogo_aud
  from ultima_auditoria ua
  left join lateral jsonb_array_elements(coalesce(ua.posicoes, '[]'::jsonb)) p on true
),
alocacao_por_pneu as (
  select
    lpad(regexp_replace(coalesce(b.numero_fogo_base, ''), '\D', '', 'g'), 6, '0') as pneu_key,
    b.prefixo,
    b.posicao
  from base b
  where coalesce(b.numero_fogo_base, '') <> ''
),
troca_post as (
  select
    t.prefixo_instalacao as prefixo,
    t.posicao_instalacao as posicao,
    max(t.created_at) as ultima_troca_em
  from public.pcm_troca_pneus t
  where t.prefixo_instalacao is not null
    and t.posicao_instalacao is not null
  group by t.prefixo_instalacao, t.posicao_instalacao
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
  ap.numero_fogo_aud,
  b.numero_fogo_base,
  (ua.auditoria_real_id is not null) as tem_auditoria,
  case
    when ua.auditoria_em is not null and tp.ultima_troca_em is not null and tp.ultima_troca_em > ua.auditoria_em then true
    else false
  end as troca_pos_auditoria,
  case
    when ap.numero_fogo_aud is null or ap.numero_fogo_aud = '' then null
    when lpad(regexp_replace(coalesce(b.numero_fogo_base, ''), '\D', '', 'g'), 6, '0')
       = lpad(regexp_replace(coalesce(ap.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0') then 'OK'
    when exists (
      select 1
      from public.pcm_pneus_transnet_inativos i
      where lpad(regexp_replace(coalesce(i.numero_fogo, ''), '\D', '', 'g'), 6, '0')
          = lpad(regexp_replace(coalesce(ap.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0')
    ) then 'SUCATA'
    when exists (
      select 1
      from alocacao_por_pneu ap2
      where ap2.pneu_key = lpad(regexp_replace(coalesce(ap.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0')
        and (ap2.prefixo <> b.prefixo or ap2.posicao <> b.posicao)
    ) then 'OUTRO VEICULO'
    when exists (
      select 1
      from public.pcm_pneus_transnet_ativos at2
      where lpad(regexp_replace(coalesce(at2.numero_fogo, ''), '\D', '', 'g'), 6, '0')
          = lpad(regexp_replace(coalesce(ap.numero_fogo_aud, ''), '\D', '', 'g'), 6, '0')
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
left join troca_post tp
  on tp.prefixo = b.prefixo
 and tp.posicao = b.posicao;

grant select on public.vw_pcm_controle_pneus_central to anon, authenticated;
