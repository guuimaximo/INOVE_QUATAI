-- OPERACIONAL · PASSAGEM DE TURNO — as ocorrências do dia (25/09/2026)
--
-- Dono: "vamos colocar as ocorrências do dia: SOS, avaria, troca, recolha, seguiu viagem,
-- assalto". As cinco primeiras vêm do módulo de SOS (`sos_acionamentos.ocorrencia`); o
-- turno guarda o RETRATO de cada uma (a tela recalcula ao abrir o dia) para a lista dos
-- dias mostrar os números sem ler o SOS de novo. Assalto segue digitado.
-- `sos` passa a ser só a ocorrência "SOS" (antes era tudo o que não fosse troca/avaria).

alter table public.operacional_turnos add column if not exists recolha integer;
alter table public.operacional_turnos add column if not exists seguiu_viagem integer;
alter table public.operacional_turnos add column if not exists sem_classificacao integer;

notify pgrst, 'reload schema';
