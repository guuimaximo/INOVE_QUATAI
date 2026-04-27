create schema if not exists supabase;

create or replace function public.resolve_auth_account(p_identifier text)
returns table (
  auth_user_id uuid,
  auth_email text,
  usuario_id integer,
  nome text,
  login text,
  legacy_email text,
  nivel text,
  setor text,
  ativo boolean,
  status_cadastro text,
  migrado_auth boolean,
  email_precisa_correcao boolean
)
language sql
security definer
set search_path = public, auth
as $$
  with matched as (
    select
      coalesce(u.auth_user_id, au.id) as auth_user_id,
      au.email as auth_email,
      u.id as usuario_id,
      u.nome,
      u.login,
      u.email as legacy_email,
      u.nivel,
      u.setor,
      coalesce(u.ativo, false) as ativo,
      u.status_cadastro,
      coalesce(u.migrado_auth, false) as migrado_auth
    from public.usuarios_aprovadores u
    left join lateral (
      select a.id, a.email
      from auth.users a
      where
        a.id = u.auth_user_id
        or lower(coalesce(a.email, '')) = lower(coalesce(u.email, ''))
        or lower(coalesce(a.raw_user_meta_data->>'login', '')) = lower(coalesce(u.login, ''))
        or (
          coalesce(a.raw_user_meta_data->>'usuario_id', '') ~ '^\d+$'
          and (a.raw_user_meta_data->>'usuario_id')::integer = u.id
        )
      order by
        case when a.id = u.auth_user_id then 0 else 1 end,
        case when lower(coalesce(a.email, '')) = lower(coalesce(u.email, '')) then 0 else 1 end,
        case when lower(coalesce(a.raw_user_meta_data->>'login', '')) = lower(coalesce(u.login, '')) then 0 else 1 end
      limit 1
    ) au on true
    where
      lower(coalesce(u.login, '')) = lower(coalesce(p_identifier, ''))
      or lower(coalesce(u.email, '')) = lower(coalesce(p_identifier, ''))
      or lower(coalesce(au.email, '')) = lower(coalesce(p_identifier, ''))
    order by
      case
        when lower(coalesce(au.email, '')) = lower(coalesce(p_identifier, '')) then 0
        when lower(coalesce(u.email, '')) = lower(coalesce(p_identifier, '')) then 1
        else 2
      end,
      u.id asc
    limit 1
  )
  select
    auth_user_id,
    auth_email,
    usuario_id,
    nome,
    login,
    legacy_email,
    nivel,
    setor,
    ativo,
    status_cadastro,
    migrado_auth,
    coalesce(auth_email ilike '%@inove.local', true) as email_precisa_correcao
  from matched;
$$;

grant execute on function public.resolve_auth_account(text) to anon, authenticated;

create or replace function public.link_auth_account(
  p_usuario_id integer,
  p_auth_user_id uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_auth_user_id then
    raise exception 'Usuario nao autorizado a vincular esta conta.';
  end if;

  update public.usuarios_aprovadores
     set auth_user_id = p_auth_user_id,
         migrado_auth = true,
         email = coalesce(nullif(trim(p_email), ''), email),
         atualizado_em = now()
   where id = p_usuario_id;

  insert into public.profiles (id, usuario_id, nome, nivel, setor, ativo, login)
  select
    p_auth_user_id,
    u.id,
    u.nome,
    u.nivel,
    u.setor,
    coalesce(u.ativo, true),
    u.login
  from public.usuarios_aprovadores u
  where u.id = p_usuario_id
  on conflict (id) do update
    set usuario_id = excluded.usuario_id,
        nome = excluded.nome,
        nivel = excluded.nivel,
        setor = excluded.setor,
        ativo = excluded.ativo,
        login = excluded.login;
end;
$$;

grant execute on function public.link_auth_account(integer, uuid, text) to authenticated;

create or replace function public.sync_profile_after_review(
  p_nome text,
  p_login text,
  p_setor text
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
           setor = nullif(trim(p_setor), ''),
           atualizado_em = now()
     where id = v_usuario_id;
  end if;
end;
$$;

grant execute on function public.sync_profile_after_review(text, text, text) to authenticated;
