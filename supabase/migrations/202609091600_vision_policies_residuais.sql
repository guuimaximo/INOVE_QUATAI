-- Continuacao do 202609091500. Aquela migration virou o bucket para privado
-- (confirmado: a URL /object/public/ passou a devolver 400), mas o vazamento
-- seguiu aberto por outro caminho:
--
--   anon lista o bucket  ->  anon assina qualquer objeto  ->  baixa
--
-- Causa: alem da `vision_inspecoes_public_read` que a migration original
-- criou, o banco tinha policies feitas A MAO que nao existem em nenhum
-- arquivo do repo -- `vision_select` (SELECT, role `public`), `vision_insert`
-- e `vision_update`. Em Postgres o role `public` inclui `anon`, entao a
-- `vision_select` sozinha mantinha o bucket legivel sem login.
--
-- LICAO: os arquivos de migration NAO refletem o banco deste projeto (elas
-- sao aplicadas a mao). Antes de escrever fix de RLS/policy, LISTE o que
-- esta vivo em pg_policies -- nao confie no repo.
--
-- Em vez de derrubar policy pelo nome (e arriscar levar junto alguma que
-- sirva outro bucket), este bloco deixa o proprio banco achar: so cai o que
-- for SELECT, alcancar `vision-inspecoes` no qual, e estiver aberto a
-- public/anon.
--
-- INSERT/UPDATE ficam de fora de proposito: o produtor do laudo roda fora do
-- repo e nao sabemos com que chave ele grava; se for anon, fechar o insert
-- pararia a ingestao. Isso precisa ser decidido a parte -- mas fica o
-- registro de que hoje qualquer um consegue ESCREVER nesse bucket.

begin;

do $$
declare
  p record;
  n int := 0;
begin
  for p in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename  = 'objects'
       and cmd        = 'SELECT'
       and coalesce(qual, '') like '%vision-inspecoes%'
       and roles::text[] && array['public', 'anon']
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'policy de select aberta derrubada: %', p.policyname;
    n := n + 1;
  end loop;

  raise notice 'total derrubado: %', n;
end $$;

-- Garante que a policy correta existe (idempotente).
drop policy if exists "vision_inspecoes_select_auth" on storage.objects;

create policy "vision_inspecoes_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vision-inspecoes');

commit;

-- Conferencia: deve sobrar apenas a policy de select restrita a authenticated.
select policyname, roles, cmd
  from pg_policies
 where schemaname = 'storage'
   and tablename  = 'objects'
   and coalesce(qual, '') like '%vision-inspecoes%'
 order by cmd, policyname;
