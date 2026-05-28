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

select public.app_niveis_append_pages(
  array['Manutencao', 'Gestor', 'Administrador'],
  array['suprimentos_contagem']::text[]
);

drop function public.app_niveis_append_pages(text[], text[]);

notify pgrst, 'reload schema';

commit;
