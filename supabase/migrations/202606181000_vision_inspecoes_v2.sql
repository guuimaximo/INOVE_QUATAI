-- Novas colunas para suportar InsightFace/ArcFace, Face Mesh e analise multicamada
begin;

-- Face Mesh
alter table public.vision_inspecoes add column if not exists score_face_mesh integer;
alter table public.vision_inspecoes add column if not exists motivo_face_mesh text;
alter table public.vision_inspecoes add column if not exists quantidade_rostos_camera integer;
alter table public.vision_inspecoes add column if not exists mapa_facial_tecnico jsonb;

-- Gemini detalhado
alter table public.vision_inspecoes add column if not exists qualidade_imagem_camera varchar(20);
alter table public.vision_inspecoes add column if not exists descricao_profissional text;
alter table public.vision_inspecoes add column if not exists mapa_facial_visual_url text;
alter table public.vision_inspecoes add column if not exists mapa_facial_visual jsonb;
alter table public.vision_inspecoes add column if not exists indicios_semelhanca jsonb;
alter table public.vision_inspecoes add column if not exists indicios_diferenca jsonb;
alter table public.vision_inspecoes add column if not exists limitacoes jsonb;
alter table public.vision_inspecoes add column if not exists recomendacao_operacional varchar(100);
alter table public.vision_inspecoes add column if not exists pontos_compativeis integer;
alter table public.vision_inspecoes add column if not exists pontos_divergentes integer;
alter table public.vision_inspecoes add column if not exists pontos_nao_visiveis integer;

-- Biometria InsightFace / ArcFace
alter table public.vision_inspecoes add column if not exists score_biometrico integer;
alter table public.vision_inspecoes add column if not exists similaridade_arcface real;
alter table public.vision_inspecoes add column if not exists categoria_biometrica varchar(50);
alter table public.vision_inspecoes add column if not exists confianca_biometrica varchar(20);
alter table public.vision_inspecoes add column if not exists decisao_biometrica varchar(50);
alter table public.vision_inspecoes add column if not exists melhor_variante_biometrica varchar(80);
alter table public.vision_inspecoes add column if not exists motivo_biometrico text;
alter table public.vision_inspecoes add column if not exists biometria_detalhes jsonb;

-- Avaliacao camera / enquadramento
alter table public.vision_inspecoes add column if not exists avaliacao_camera text;
alter table public.vision_inspecoes add column if not exists problemas_enquadramento_camera jsonb;
alter table public.vision_inspecoes add column if not exists recomendacao_camera text;
alter table public.vision_inspecoes add column if not exists camera_enquadramento varchar(30);
alter table public.vision_inspecoes add column if not exists camera_recomendacao text;
alter table public.vision_inspecoes add column if not exists camera_area_rosto_percentual real;
alter table public.vision_inspecoes add column if not exists camera_posicao_rosto varchar(50);
alter table public.vision_inspecoes add column if not exists prefixo text;
alter table public.vision_inspecoes add column if not exists variante_face_mesh varchar(100);
alter table public.vision_inspecoes add column if not exists variante_face_mesh_prioritaria varchar(100);
alter table public.vision_inspecoes add column if not exists variantes_face_mesh_testadas jsonb;

-- Tabela para configuracao do prompt Gemini (editavel pelo admin)
create table if not exists public.vision_config (
  id         bigserial primary key,
  chave      varchar(100) unique not null,
  valor      text not null,
  updated_at timestamptz not null default now()
);

-- RLS publica para vision_inspecoes (leitura/insert/delete)
alter table public.vision_inspecoes enable row level security;

drop policy if exists "vision_inspecoes_select" on public.vision_inspecoes;
create policy "vision_inspecoes_select" on public.vision_inspecoes
  for select using (true);

drop policy if exists "vision_inspecoes_insert" on public.vision_inspecoes;
create policy "vision_inspecoes_insert" on public.vision_inspecoes
  for insert with check (true);

drop policy if exists "vision_inspecoes_delete" on public.vision_inspecoes;
create policy "vision_inspecoes_delete" on public.vision_inspecoes
  for delete using (true);

-- RLS para vision_config
alter table public.vision_config enable row level security;

drop policy if exists "vision_config_select" on public.vision_config;
create policy "vision_config_select" on public.vision_config
  for select using (true);

drop policy if exists "vision_config_insert" on public.vision_config;
create policy "vision_config_insert" on public.vision_config
  for insert with check (true);

drop policy if exists "vision_config_update" on public.vision_config;
create policy "vision_config_update" on public.vision_config
  for update using (true);

commit;
