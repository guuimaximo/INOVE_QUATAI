alter table public.organograma_manutencao_areas
  add column if not exists nivel text,
  add column if not exists setor text;

-- niveis aceitos (apenas referencia, sem constraint para permitir flexibilidade)
-- DIRETOR, GERENTE, COORDENADOR, SUPERVISOR, LIDER, COLABORADOR

-- setores aceitos
-- PLANEJAMENTO_CONTROLE, ADMINISTRATIVO, MANUTENCAO

-- Mantemos a coluna "cor" como override manual quando o nivel nao for adequado.
