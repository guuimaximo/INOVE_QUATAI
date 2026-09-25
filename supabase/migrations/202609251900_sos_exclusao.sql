-- SOS · ETIQUETA EXCLUÍDA (25/09/2026)
--
-- Dono: "colocar para gestor poder apagar uma etiqueta de intervenção no INOVE — ele coloca
-- o login e a senha, e ela não simplesmente apaga: fica como EXCLUÍDA, ele tem que falar o
-- porquê e fica gravado. Não fica nos indicadores, aparece só na Central, não precisa
-- fechar nem tratar."
--
-- A etiqueta ganha status 'EXCLUIDA' (as telas de Fechamento e Tratamento já filtram por
-- 'Aberto' e 'Em Andamento', então ela sai das filas sozinha) e o registro de quem, quando
-- e por quê. O status de antes fica guardado, para a história e para uma volta atrás.
--
-- A TRAVA É DO BANCO, não da tela: a tela confere o login e a senha do gestor e grava COM
-- A SESSÃO DELE (`utils/autorizacaoGestor.js`); este gatilho só aceita EXCLUIDA quando quem
-- grava é Gestor ou Administrador ativo, exige o motivo e carimba o autor a partir do
-- próprio login — ninguém escreve o nome de outro. Tirar da EXCLUÍDA também é só para
-- Gestor/Administrador.
--
-- Tabela já existente e já trancada para anon: coluna nova herda as permissões.

alter table public.sos_acionamentos
  add column if not exists excluida_em timestamptz,
  add column if not exists excluida_por_nome text,
  add column if not exists excluida_por_login text,
  add column if not exists exclusao_motivo text,
  add column if not exists status_antes_exclusao text;

-- o status aceito pela tabela ganha EXCLUIDA (antes: Aberto, Em Andamento, Fechado)
alter table public.sos_acionamentos drop constraint if exists chk_status_sos;
alter table public.sos_acionamentos add constraint chk_status_sos
  check (status = any (array['Aberto'::text, 'Em Andamento'::text, 'Fechado'::text, 'EXCLUIDA'::text]));

create or replace function public.sos_trava_exclusao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quem record;
begin
  -- só age quando a etiqueta ENTRA ou SAI da exclusão; qualquer outra alteração passa
  if coalesce(new.status, '') = 'EXCLUIDA' and coalesce(old.status, '') <> 'EXCLUIDA' then
    select nome, login, nivel into quem
      from public.usuarios_aprovadores
     where auth_user_id = auth.uid() and coalesce(ativo, true)
     limit 1;
    if not found or not (lower(coalesce(quem.nivel, '')) in ('administrador', 'admin')
                            or lower(coalesce(quem.nivel, '')) like 'gestor%') then
      raise exception 'Só Gestor ou Administrador exclui etiqueta de SOS.';
    end if;
    if length(trim(coalesce(new.exclusao_motivo, ''))) < 5 then
      raise exception 'Informe o motivo da exclusão.';
    end if;
    new.exclusao_motivo := trim(new.exclusao_motivo);
    new.excluida_em := now();
    new.excluida_por_nome := coalesce(nullif(trim(quem.nome), ''), quem.login);
    new.excluida_por_login := quem.login;
    new.status_antes_exclusao := old.status;
  elsif coalesce(old.status, '') = 'EXCLUIDA' and coalesce(new.status, '') <> 'EXCLUIDA' then
    select nome, login, nivel into quem
      from public.usuarios_aprovadores
     where auth_user_id = auth.uid() and coalesce(ativo, true)
     limit 1;
    if not found or not (lower(coalesce(quem.nivel, '')) in ('administrador', 'admin')
                            or lower(coalesce(quem.nivel, '')) like 'gestor%') then
      raise exception 'Só Gestor ou Administrador tira uma etiqueta da exclusão.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sos_trava_exclusao on public.sos_acionamentos;
create trigger trg_sos_trava_exclusao
  before update on public.sos_acionamentos
  for each row execute function public.sos_trava_exclusao();

notify pgrst, 'reload schema';
