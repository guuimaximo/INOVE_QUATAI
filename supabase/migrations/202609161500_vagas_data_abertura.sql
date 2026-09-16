-- Vagas: a data de abertura pode ser corrigida por um gestor (16/09/2026).
--
-- A abertura continua automática: é o `criado_em`, gravado quando a vaga entra no sistema,
-- e ele nunca muda. Quando um Gestor/Administrador corrige a data (com login e senha, na
-- tela), a data corrigida vai para `data_abertura`, junto com quem autorizou, quando e por
-- quê. A tela usa `data_abertura` quando existe e `criado_em` quando não.
--
-- Só colunas novas e opcionais: nenhuma linha muda, e a RLS/grants da tabela continuam
-- como estão (somente `authenticated`).
alter table public.vagas_solicitacao
  add column if not exists data_abertura date,
  add column if not exists data_abertura_alterada_por text,
  add column if not exists data_abertura_alterada_em timestamptz,
  add column if not exists data_abertura_motivo text;

comment on column public.vagas_solicitacao.data_abertura is
  'Data de abertura corrigida por um gestor. Vazia = vale o criado_em.';

notify pgrst, 'reload schema';
