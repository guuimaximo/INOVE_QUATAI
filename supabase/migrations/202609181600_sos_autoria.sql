-- QUEM FEZ CADA PASSO DO SOS (18/09/2026, pedido do dono no "Detalhes SOS" da Central).
--
-- O SOS passa por três telas — Solicitação (Aberto) → Fechamento (Em Andamento) →
-- Tratamento (Fechado) — e nenhuma delas guardava o USUÁRIO DO INOVE que agiu: só os nomes
-- digitados no formulário (plantonista, avaliador, solucionador). E o Tratamento regrava
-- `data_fechamento`, então a hora do Fechamento se perdia. Aqui cada passo ganha o seu
-- autor (nome + login do INOVE) e a sua hora; `data_fechamento` segue como está, porque os
-- painéis de SOS leem dela.
--
-- Tabela já existente e já trancada para anon (só `authenticated`): coluna nova herda as
-- permissões da tabela, não há grant nem policy a mexer.
alter table public.sos_acionamentos
  add column if not exists criado_por_nome text,
  add column if not exists criado_por_login text,
  add column if not exists fechamento_por_nome text,
  add column if not exists fechamento_por_login text,
  add column if not exists fechamento_em timestamptz,
  add column if not exists tratamento_por_nome text,
  add column if not exists tratamento_por_login text,
  add column if not exists tratamento_em timestamptz,
  add column if not exists editado_por_nome text,
  add column if not exists editado_por_login text;

notify pgrst, 'reload schema';
