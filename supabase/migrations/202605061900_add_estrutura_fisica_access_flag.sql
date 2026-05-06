alter table if exists public.usuarios_aprovadores
  add column if not exists estrutura_fisica_liberada boolean not null default false;
