grant usage on schema auth to supabase_auth_admin;

grant all privileges on all tables in schema auth to supabase_auth_admin;
grant all privileges on all sequences in schema auth to supabase_auth_admin;
grant all privileges on all routines in schema auth to supabase_auth_admin;

alter default privileges for role postgres in schema auth
grant all privileges on tables to supabase_auth_admin;

alter default privileges for role postgres in schema auth
grant all privileges on sequences to supabase_auth_admin;

alter default privileges for role postgres in schema auth
grant all privileges on routines to supabase_auth_admin;
