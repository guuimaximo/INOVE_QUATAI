alter table public.pcm_troca_pneus
  add column if not exists origem_recebeu text,
  add column if not exists numero_fogo_origem_recebido text,
  add column if not exists foto_numero_fogo_origem_recebido_path text,
  add column if not exists foto_numero_fogo_origem_recebido_url text;
