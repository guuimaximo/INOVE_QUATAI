-- Programacao das preventivas: adiciona o turno (Dia/Noite) de cada carro
-- programado. Cada dia da semana passa a ser dividido em Dia e Noite.
-- Itens antigos (sem turno) assumem 'Dia' pelo default.
alter table public.preventivas_programacao
  add column if not exists turno text not null default 'Dia';   -- 'Dia' | 'Noite'

notify pgrst, 'reload schema';
