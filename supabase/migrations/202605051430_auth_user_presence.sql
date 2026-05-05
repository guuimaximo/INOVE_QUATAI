alter table public.usuarios_aprovadores
  add column if not exists ultimo_ping_em timestamptz;

create index if not exists usuarios_aprovadores_ultimo_ping_em_idx
  on public.usuarios_aprovadores (ultimo_ping_em desc);
