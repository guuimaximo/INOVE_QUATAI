alter table public.pcm_troca_pneus
  add column if not exists tipo_troca text,
  add column if not exists prefixo_retirada text,
  add column if not exists posicao_retirada text,
  add column if not exists numero_fogo_retirado text,
  add column if not exists foto_numero_fogo_retirado_path text,
  add column if not exists foto_numero_fogo_retirado_url text,
  add column if not exists prefixo_instalacao text,
  add column if not exists posicao_instalacao text,
  add column if not exists numero_fogo_colocado text,
  add column if not exists foto_numero_fogo_colocado_path text,
  add column if not exists foto_numero_fogo_colocado_url text;

update public.pcm_troca_pneus
set
  tipo_troca = coalesce(tipo_troca, 'ESTOQUE -> CARRO'),
  prefixo_retirada = coalesce(prefixo_retirada, prefixo),
  posicao_retirada = coalesce(posicao_retirada, posicao),
  numero_fogo_retirado = coalesce(numero_fogo_retirado, numero_fogo_pneu),
  foto_numero_fogo_retirado_path = coalesce(foto_numero_fogo_retirado_path, foto_numero_fogo_path),
  foto_numero_fogo_retirado_url = coalesce(foto_numero_fogo_retirado_url, foto_numero_fogo_url),
  prefixo_instalacao = coalesce(prefixo_instalacao, prefixo),
  posicao_instalacao = coalesce(posicao_instalacao, posicao),
  numero_fogo_colocado = coalesce(numero_fogo_colocado, numero_fogo_pneu),
  foto_numero_fogo_colocado_path = coalesce(foto_numero_fogo_colocado_path, foto_numero_fogo_path),
  foto_numero_fogo_colocado_url = coalesce(foto_numero_fogo_colocado_url, foto_numero_fogo_url)
where
  tipo_troca is null
  or prefixo_retirada is null
  or posicao_retirada is null
  or numero_fogo_retirado is null
  or foto_numero_fogo_retirado_path is null
  or foto_numero_fogo_retirado_url is null
  or prefixo_instalacao is null
  or posicao_instalacao is null
  or numero_fogo_colocado is null
  or foto_numero_fogo_colocado_path is null
  or foto_numero_fogo_colocado_url is null;
