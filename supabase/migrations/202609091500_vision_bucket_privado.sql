-- Fecha o vazamento do bucket de imagens do Monitoramento Vision.
--
-- Situacao encontrada em 2026-09-09: as fotos de rosto (cadastro + camera,
-- com codigo/registro da pessoa no nome do arquivo) abriam por URL publica
-- SEM credencial nenhuma, e a anon key -- que e publica, esta assada no
-- bundle -- ainda conseguia LISTAR o bucket inteiro. Ou seja: enumeravel e
-- baixavel por qualquer um. Dado biometrico identificavel (LGPD).
--
-- Duas causas somadas:
--   1. o bucket foi criado com `public = true` (migration 202606171900)
--   2. a policy de select foi criada SEM clausula `to`, entao valia para
--      `anon` tambem, nao so para quem esta logado
--
-- As TABELAS ja estavam protegidas (o lockdown da Fase 1 segurou; os
-- `grant ... to anon` daquelas migrations nunca chegaram no banco).
--
-- O `insert` fica como esta de proposito: o produtor do laudo roda fora do
-- repo e nao sabemos com qual chave ele grava. Se for anon, mexer aqui
-- pararia a ingestao. O vazamento era o select.

begin;

-- 1) sem isso, /storage/v1/object/public/... continua respondendo
update storage.buckets
   set public = false
 where id = 'vision-inspecoes';

-- 2) a policy antiga nao restringia o role
drop policy if exists "vision_inspecoes_public_read" on storage.objects;

create policy "vision_inspecoes_select_auth"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vision-inspecoes');

commit;
