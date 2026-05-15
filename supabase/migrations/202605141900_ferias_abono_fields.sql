alter table public.ferias_periodos_importados
  add column if not exists dias_gozo_realizados integer,
  add column if not exists dias_gozo_em_andamento integer,
  add column if not exists dias_gozo_agendados integer,
  add column if not exists dias_abono_realizados integer,
  add column if not exists dias_abono_em_andamento integer,
  add column if not exists dias_abono_agendados integer,
  add column if not exists qtd_abonos_realizados integer,
  add column if not exists qtd_abonos_em_andamento integer,
  add column if not exists qtd_abonos_agendados integer,
  add column if not exists ultimo_inicio_abono_realizado date,
  add column if not exists ultimo_fim_abono_realizado date,
  add column if not exists proximo_inicio_abono date,
  add column if not exists proximo_fim_abono date;

alter table public.ferias_planejamento
  add column if not exists usar_abono boolean not null default false,
  add column if not exists programado_abono_inicio date,
  add column if not exists programado_abono_fim date;

create index if not exists idx_ferias_periodos_abono on public.ferias_periodos_importados (ativo, dias_abono_realizados, dias_abono_agendados);
create index if not exists idx_ferias_planejamento_abono on public.ferias_planejamento (usar_abono, programado_abono_inicio);

notify pgrst, 'reload schema';
