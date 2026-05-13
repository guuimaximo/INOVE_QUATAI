alter table public.pcm_controle_fichas
  add column if not exists itens jsonb not null default '[]'::jsonb,
  add column if not exists supervisor_recusado_em timestamptz,
  add column if not exists supervisor_recusa_motivo text,
  add column if not exists pcm_recusado_em timestamptz,
  add column if not exists pcm_recusa_motivo text;

-- migra registros antigos (lote com foto unica) para o novo formato de itens
update public.pcm_controle_fichas
   set itens = jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid(),
          'numero_ficha', null,
          'foto_path', foto_path,
          'foto_url', foto_url
        )
      )
 where (itens is null or jsonb_array_length(itens) = 0)
   and foto_url is not null;
