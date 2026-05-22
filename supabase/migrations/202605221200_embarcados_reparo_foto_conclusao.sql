-- Separa a evidencia da conclusao/execucao da evidencia da solicitacao.
-- Antes, a execucao gravava em embarcados_solicitacoes_reparo.foto_url,
-- sobrescrevendo a evidencia original da solicitacao.

alter table public.embarcados_solicitacoes_reparo
  add column if not exists foto_conclusao_url text;

comment on column public.embarcados_solicitacoes_reparo.foto_url
  is 'Evidencia anexada na abertura da solicitacao.';

comment on column public.embarcados_solicitacoes_reparo.foto_conclusao_url
  is 'Evidencia anexada na execucao/conclusao da solicitacao.';
