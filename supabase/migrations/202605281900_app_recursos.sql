-- Governança de acesso do APP (Capacitor).
-- Cada usuário tem uma lista de recursos que pode usar dentro do APP.
-- A web continua usando paginas_liberadas / paginas_bloqueadas + nivel.

alter table public.usuarios_aprovadores
  add column if not exists app_recursos jsonb not null default '[]'::jsonb;

create index if not exists usuarios_app_recursos_idx
  on public.usuarios_aprovadores using gin (app_recursos);

notify pgrst, 'reload schema';
