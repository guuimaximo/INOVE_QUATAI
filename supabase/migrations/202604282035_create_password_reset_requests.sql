create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  usuario_id integer references public.usuarios_aprovadores(id) on delete set null,
  login text not null,
  email text not null,
  requested_identifier text not null,
  status text not null default 'Pendente',
  notes text,
  processed_at timestamptz,
  processed_by text
);

create index if not exists password_reset_requests_usuario_idx
  on public.password_reset_requests (usuario_id, status, created_at desc);

create or replace function public.create_password_reset_request(p_identifier text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_identifier text := nullif(trim(p_identifier), '');
  v_user public.usuarios_aprovadores%rowtype;
  v_request_id uuid;
begin
  if v_identifier is null then
    raise exception 'Informe um apelido ou e-mail valido.';
  end if;

  select *
    into v_user
  from public.usuarios_aprovadores
  where lower(coalesce(login, '')) = lower(v_identifier)
     or lower(coalesce(email, '')) = lower(v_identifier)
  order by id asc
  limit 1;

  if not found then
    return null;
  end if;

  if coalesce(v_user.ativo, false) is false then
    raise exception 'Sua conta esta inativa no momento.';
  end if;

  if coalesce(trim(v_user.email), '') = '' then
    raise exception 'Seu cadastro ainda nao possui um e-mail valido para recuperacao.';
  end if;

  select id
    into v_request_id
  from public.password_reset_requests
  where usuario_id = v_user.id
    and status = 'Pendente'
  order by created_at desc
  limit 1;

  if v_request_id is null then
    insert into public.password_reset_requests (
      usuario_id,
      login,
      email,
      requested_identifier,
      status
    )
    values (
      v_user.id,
      coalesce(v_user.login, ''),
      lower(trim(v_user.email)),
      v_identifier,
      'Pendente'
    )
    returning id into v_request_id;
  else
    update public.password_reset_requests
       set updated_at = now(),
           requested_identifier = v_identifier,
           email = lower(trim(v_user.email))
     where id = v_request_id;
  end if;

  return v_request_id;
end;
$$;

revoke all on public.password_reset_requests from anon, authenticated;
grant execute on function public.create_password_reset_request(text) to anon, authenticated;
