begin;

create table if not exists public.vision_inspecoes (
  id              bigserial primary key,
  registro        varchar(20),
  nome            varchar(200),
  codigo_usuario  varchar(50),
  data_hora_evento varchar(50),
  codigo_cartao   varchar(50),
  tipo_cartao     varchar(100),
  status_cartao   varchar(50),

  -- resultado da análise Gemini
  score           integer,
  categoria       varchar(50) not null default 'SEM_PESSOA',
  rosto_visivel   boolean default false,
  confianca       varchar(10),
  motivo          text,
  acao_prevista   varchar(50) not null,

  -- imagens base64 (cadastro + câmera)
  img_cadastro_url text,
  img_camera_url   text,

  -- filtros usados na consulta
  status_inspecao  varchar(50),
  data_inicio      varchar(20),
  data_fim         varchar(20),

  created_at      timestamptz not null default now()
);

create index if not exists idx_vision_inspecoes_acao on public.vision_inspecoes(acao_prevista);
create index if not exists idx_vision_inspecoes_score on public.vision_inspecoes(score);
create index if not exists idx_vision_inspecoes_created on public.vision_inspecoes(created_at);
create index if not exists idx_vision_inspecoes_categoria on public.vision_inspecoes(categoria);

-- Storage bucket para as imagens de inspeção
insert into storage.buckets (id, name, public)
values ('vision-inspecoes', 'vision-inspecoes', true)
on conflict (id) do nothing;

create policy "vision_inspecoes_public_read"
  on storage.objects for select
  using (bucket_id = 'vision-inspecoes');

create policy "vision_inspecoes_auth_insert"
  on storage.objects for insert
  with check (bucket_id = 'vision-inspecoes');

commit;
