alter table public.pcm_troca_pneus
  add column if not exists numero_fogo_pneu text,
  add column if not exists foto_numero_fogo_path text,
  add column if not exists foto_numero_fogo_url text;

alter table public.pcm_troca_pneus
  alter column pneu_retirado_descricao drop not null,
  alter column pneu_colocado_descricao drop not null,
  alter column foto_fogo_retirado_path drop not null,
  alter column foto_fogo_retirado_url drop not null,
  alter column foto_pneu_retirado_path drop not null,
  alter column foto_pneu_retirado_url drop not null,
  alter column foto_fogo_colocado_path drop not null,
  alter column foto_fogo_colocado_url drop not null,
  alter column foto_pneu_colocado_path drop not null,
  alter column foto_pneu_colocado_url drop not null;
