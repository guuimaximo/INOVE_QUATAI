alter table public.diesel_acompanhamento_eventos
  drop constraint if exists diesel_acompanhamento_eventos_tipo_check;

alter table public.diesel_acompanhamento_eventos
  add constraint diesel_acompanhamento_eventos_tipo_check
  check (
    tipo is not null
    and length(btrim(tipo)) > 0
    and tipo = upper(tipo)
  );
