begin;

create table if not exists public.estoque_diesel_ajustes_hodometro_inicial (
  id bigserial primary key,
  bomba_id bigint not null references public.estoque_diesel_bombas(id) on delete cascade,
  data_referencia date not null,
  hodometro_inicial numeric(12,2) not null,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  usuario_id bigint,
  unique (bomba_id, data_referencia)
);

create index if not exists idx_estoque_diesel_ajustes_hodometro_data
  on public.estoque_diesel_ajustes_hodometro_inicial(data_referencia desc);

create index if not exists idx_estoque_diesel_ajustes_hodometro_bomba
  on public.estoque_diesel_ajustes_hodometro_inicial(bomba_id, data_referencia desc);

notify pgrst, 'reload schema';

commit;
