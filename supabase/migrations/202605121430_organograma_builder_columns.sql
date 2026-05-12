begin;

alter table public.organograma_manutencao_areas
  add column if not exists pagina_organograma varchar(24) not null default 'MANUTENCAO',
  add column if not exists orcado_planejado integer;

create index if not exists idx_organograma_manutencao_areas_pagina
  on public.organograma_manutencao_areas (pagina_organograma, ordem);

update public.organograma_manutencao_areas
set pagina_organograma = case
  when lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%administr%'
    or lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%pcm%'
    or lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%supriment%'
    or lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%compr%'
    or lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%almox%'
  then 'ADM'
  when lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%operac%'
    or lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%entrada%'
    or lower(coalesce(grupo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(subtitulo, '')) like '%saida%'
  then 'OPERACAO'
  else 'MANUTENCAO'
end
where pagina_organograma is null
   or pagina_organograma = '';

commit;
