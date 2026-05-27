begin;

create or replace function public.app_niveis_append_pages(
  target_names text[],
  page_keys text[]
)
returns void
language plpgsql
as $$
begin
  update public.app_niveis_acesso
  set
    paginas = (
      select array_agg(distinct page_key order by page_key)
      from unnest(coalesce(paginas, '{}'::text[]) || page_keys) as page_key
    ),
    updated_at = timezone('utc', now())
  where nome = any(target_names)
    or ('Manutencao' = any(target_names) and nome like 'Manuten%');
end;
$$;

-- As rotas novas ja existem no front. Esta migration sincroniza os niveis
-- que ficam gravados no Supabase, para aparecerem corretamente em Configuracoes.
select public.app_niveis_append_pages(
  array['CCO'],
  array[
    'sac_lancamento',
    'sac_central',
    'acidentes_lancamento',
    'acidentes_central'
  ]::text[]
);

select public.app_niveis_append_pages(
  array['Manutencao'],
  array[
    'acidentes_lancamento',
    'acidentes_imagens',
    'acidentes_central',
    'suprimentos_resumo',
    'suprimentos_cadastro',
    'suprimentos_garantias',
    'suprimentos_testes',
    'suprimentos_servico_externo'
  ]::text[]
);

select public.app_niveis_append_pages(
  array['Tratativa'],
  array[
    'sac_resumo',
    'sac_lancamento',
    'sac_central',
    'acidentes_imagens',
    'acidentes_central'
  ]::text[]
);

select public.app_niveis_append_pages(
  array['RH'],
  array[
    'sac_resumo',
    'sac_lancamento',
    'sac_central',
    'acidentes_imagens',
    'acidentes_central'
  ]::text[]
);

select public.app_niveis_append_pages(
  array['Gestor', 'Administrador'],
  array[
    'sac_resumo',
    'sac_lancamento',
    'sac_central',
    'acidentes_lancamento',
    'acidentes_imagens',
    'acidentes_central',
    'suprimentos_resumo',
    'suprimentos_cadastro',
    'suprimentos_garantias',
    'suprimentos_testes',
    'suprimentos_servico_externo'
  ]::text[]
);

drop function public.app_niveis_append_pages(text[], text[]);

notify pgrst, 'reload schema';

commit;
