-- Adiciona colunas que existiam no CSV do ERP TransNet mas não estavam na tabela
ALTER TABLE public.suprimentos_fornecedores
  ADD COLUMN IF NOT EXISTS tipo_fornecedor text,
  ADD COLUMN IF NOT EXISTS codigo_erp      text,
  ADD COLUMN IF NOT EXISTS uf              text,
  ADD COLUMN IF NOT EXISTS telefone2       text,
  ADD COLUMN IF NOT EXISTS tipo            text;
