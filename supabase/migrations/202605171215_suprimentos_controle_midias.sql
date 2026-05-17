alter table if exists public.suprimentos_garantias
  add column if not exists numero_controle text;

alter table if exists public.suprimentos_testes
  add column if not exists numero_controle text;

create unique index if not exists idx_suprimentos_garantias_numero_controle
  on public.suprimentos_garantias (numero_controle)
  where numero_controle is not null;

create unique index if not exists idx_suprimentos_testes_numero_controle
  on public.suprimentos_testes (numero_controle)
  where numero_controle is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'suprimentos',
  'suprimentos',
  true,
  31457280,
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/ogg'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
