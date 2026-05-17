alter table if exists public.suprimentos_garantias
  add column if not exists tipo_garantia text check (tipo_garantia in ('Peca comprada', 'Veiculo novo')),
  add column if not exists retirada_fornecedor_em date,
  add column if not exists prazo_retorno_dias integer,
  add column if not exists laudo_urls jsonb not null default '[]'::jsonb;

update public.suprimentos_garantias
set tipo_garantia = coalesce(tipo_garantia, 'Peca comprada')
where tipo_garantia is null;

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
    'application/pdf',
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
