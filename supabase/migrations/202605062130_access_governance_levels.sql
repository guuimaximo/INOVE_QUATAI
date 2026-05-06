begin;

create table if not exists public.app_niveis_acesso (
  id bigserial primary key,
  nome text not null unique,
  descricao text,
  paginas text[] not null default '{}'::text[],
  farol_liberado boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table if exists public.usuarios_aprovadores
  add column if not exists paginas_liberadas text[] not null default '{}'::text[];

alter table if exists public.usuarios_aprovadores
  add column if not exists paginas_bloqueadas text[] not null default '{}'::text[];

insert into public.app_niveis_acesso (nome, descricao, paginas, farol_liberado, ativo)
values
  ('Pendente', 'Aguardando configuracao de acesso.', '{}'::text[], false, true),
  ('CCO', 'Operacao e atendimento SOS.', '{inicio_rapido,tratativas_solicitacao,sos_solicitacao,sos_fechamento,sos_dashboard,km_rodado,embarcados_reparos}'::text[], false, true),
  ('Manutenção', 'Rotinas de manutencao, SOS, avarias e PCM.', '{inicio_rapido,tratativas_solicitacao,avarias_lancamento,avarias_revisao,avarias_aprovacao,sos_resumo,sos_fechamento,sos_tratamento,sos_central,sos_dashboard,km_rodado,pcm_resumo,pcm_inicio,pcm_diario,pcm_preventivas,pcm_troca_pneus,embarcados_central,embarcados_movimentacoes,embarcados_reparos,embarcados_reparo_detalhe,embarcados_reparo_execucao,embarcados_envio_manutencao}'::text[], false, true),
  ('Tratativa', 'Central de tratativas e cobrancas.', '{inicio_rapido,tratativas_solicitacao,tratativas_central,tratativas_consultar,tratativas_tratar,avarias_cobrancas,embarcados_reparos,embarcados_reparo_detalhe,embarcados_reparo_execucao}'::text[], false, true),
  ('Instrutor', 'Acompanhamento e tratativas do Diesel.', '{inicio_rapido,diesel_lancamento,diesel_resumo,diesel_acompanhamento,diesel_agente,diesel_checkpoint,diesel_tratativas_central,diesel_tratativas_tratar,diesel_tratativas_consultar}'::text[], false, true),
  ('Embarcados', 'Operacao do modulo de embarcados.', '{inicio_rapido,embarcados_central,embarcados_movimentacoes,embarcados_reparos,embarcados_reparo_detalhe,embarcados_reparo_execucao,embarcados_envio_manutencao}'::text[], false, true),
  ('Borracheiro', 'Troca de pneus.', '{pcm_troca_pneus}'::text[], false, true),
  ('RH', 'Tratativas RH e visao resumida.', '{home,tratativas_resumo,tratativas_central,tratativas_consultar,tratativas_rh,avarias_resumo,avarias_cobrancas,diesel_tratativas_central,estrutura_fisica_solicitacao,estrutura_fisica_central}'::text[], true, true),
  ('Gestor', 'Gestao operacional ampliada.', '{home,inicio_rapido,painel,tratativas_resumo,tratativas_solicitacao,tratativas_central,tratativas_consultar,tratativas_tratar,tratativas_rh,avarias_lancamento,avarias_aprovacao,avarias_revisao,avarias_cobrancas,avarias_resumo,sos_solicitacao,sos_fechamento,sos_tratamento,sos_central,sos_dashboard,sos_resumo,km_rodado,pcm_inicio,pcm_resumo,pcm_diario,pcm_preventivas,pcm_troca_pneus,checklists_central,embarcados_central,embarcados_movimentacoes,embarcados_reparos,embarcados_reparo_detalhe,embarcados_reparo_execucao,embarcados_envio_manutencao,diesel_lancamento,diesel_resumo,diesel_acompanhamento,diesel_tratativas_legacy,diesel_agente,diesel_checkpoint,diesel_tratativas_central,diesel_tratativas_tratar,diesel_tratativas_consultar,estrutura_fisica_solicitacao,estrutura_fisica_central,estrutura_fisica_consultar,estrutura_fisica_tratar,config_usuarios,config_funcionarios}'::text[], true, true),
  ('Administrador', 'Controle total do sistema.', '{home,inicio_rapido,painel,tratativas_resumo,tratativas_solicitacao,tratativas_central,tratativas_consultar,tratativas_tratar,tratativas_rh,avarias_lancamento,avarias_aprovacao,avarias_revisao,avarias_cobrancas,avarias_resumo,sos_solicitacao,sos_fechamento,sos_tratamento,sos_central,sos_dashboard,sos_resumo,km_rodado,pcm_inicio,pcm_resumo,pcm_diario,pcm_preventivas,pcm_troca_pneus,checklists_central,embarcados_central,embarcados_movimentacoes,embarcados_reparos,embarcados_reparo_detalhe,embarcados_reparo_execucao,embarcados_envio_manutencao,diesel_lancamento,diesel_resumo,diesel_acompanhamento,diesel_tratativas_legacy,diesel_agente,diesel_checkpoint,diesel_tratativas_central,diesel_tratativas_tratar,diesel_tratativas_consultar,estrutura_fisica_solicitacao,estrutura_fisica_central,estrutura_fisica_consultar,estrutura_fisica_tratar,config_usuarios,config_funcionarios,config_niveis}'::text[], true, true)
on conflict (nome) do update
set
  descricao = excluded.descricao,
  paginas = excluded.paginas,
  farol_liberado = excluded.farol_liberado,
  ativo = excluded.ativo,
  updated_at = timezone('utc', now());

commit;
