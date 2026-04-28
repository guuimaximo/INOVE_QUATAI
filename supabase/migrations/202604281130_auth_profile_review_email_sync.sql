drop function if exists public.sync_profile_after_review(text, text, text);

create or replace function public.sync_profile_after_review(
  p_nome text,
  p_login text,
  p_setor text,
  p_email text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_usuario_id integer;
  v_nivel text;
  v_ativo boolean;
begin
  if v_auth_user_id is null then
    raise exception 'Sessao invalida para atualizar perfil.';
  end if;

  select p.usuario_id
    into v_usuario_id
  from public.profiles p
  where p.id = v_auth_user_id;

  if v_usuario_id is null then
    select u.id
      into v_usuario_id
    from public.usuarios_aprovadores u
    where u.auth_user_id = v_auth_user_id
    limit 1;
  end if;

  select p.nivel, p.ativo
    into v_nivel, v_ativo
  from public.profiles p
  where p.id = v_auth_user_id;

  if v_nivel is null and v_usuario_id is not null then
    select u.nivel, coalesce(u.ativo, true)
      into v_nivel, v_ativo
    from public.usuarios_aprovadores u
    where u.id = v_usuario_id;
  end if;

  insert into public.profiles (id, usuario_id, nome, nivel, setor, ativo, login)
  values (
    v_auth_user_id,
    v_usuario_id,
    nullif(trim(p_nome), ''),
    coalesce(v_nivel, 'Pendente'),
    nullif(trim(p_setor), ''),
    coalesce(v_ativo, true),
    nullif(trim(p_login), '')
  )
  on conflict (id) do update
    set usuario_id = excluded.usuario_id,
        nome = excluded.nome,
        setor = excluded.setor,
        login = excluded.login,
        nivel = coalesce(public.profiles.nivel, excluded.nivel),
        ativo = coalesce(public.profiles.ativo, excluded.ativo);

  if v_usuario_id is not null then
    update public.usuarios_aprovadores
       set nome = nullif(trim(p_nome), ''),
           login = nullif(trim(p_login), ''),
           email = coalesce(nullif(lower(trim(p_email)), ''), email),
           setor = nullif(trim(p_setor), ''),
           atualizado_em = now()
     where id = v_usuario_id;
  end if;
end;
$$;

grant execute on function public.sync_profile_after_review(text, text, text, text) to authenticated;
