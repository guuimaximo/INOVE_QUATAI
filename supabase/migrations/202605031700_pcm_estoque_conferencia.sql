alter table public.pcm_estoque_pneus
  add column if not exists transnet_status text,
  add column if not exists transnet_conferido_em timestamptz,
  add column if not exists transnet_conferido_por_login text,
  add column if not exists transnet_conferido_por_nome text,
  add column if not exists transnet_conferido_por_id text;
