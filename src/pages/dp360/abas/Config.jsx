import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AbaShell from "./AbaShell";
import { lerDP360, upsertDP360 } from "../../../services/dp360Api";

/* ═══════════════════════════════════════════════════════════════════════════
   Config — os textos que a ferramenta manda para o colaborador.

   Porte de Sistemas/PONTO/app/ui/app.js::viewConfig, com o backend em
   app/main.py (`get_templates`, `set_template`, `get_motivo_advertencia`,
   `set_motivo_advertencia`) e ferramenta/supabase_client.py
   (`ler_config`/`gravar_config`).

   ESTA ABA GRAVA. Vai direto na tabela `app_config` (colunas `chave` / `valor`),
   a MESMA que a ferramenta antiga lê em tempo de envio. Por isso o nome da chave
   aparece na tela ao lado do botão de salvar: gravar com o nome errado não dá
   erro nenhum — só faz a mensagem sair no texto padrão para sempre, sem ninguém
   perceber. As chaves abaixo foram copiadas de main.py, não inventadas:

     template_ocorrencia_motorista   template_interno_almoco
     template_registro_incompleto    template_interno_incompleto
     template_pedir_exclusao         template_interno_curta
     template_aviso_fora             template_advertencia
     template_advertencia_prazo      motivo_advertencia

   `app_config.valor` é JSONB (DDL em PONTO/supabase_setup.sql). A ferramenta
   grava uma STRING JSON — é isso que `ler_config` espera de volta. Aqui a gente
   escreve string também; nada de objeto, ou o Python quebra na hora do envio.

   Fora de escopo nesta fase (existem no app antigo e NÃO foram portados):
   "↩ Padrão" (apagar o texto salvo), "Testar os 9 modelos" e "Auditar CSVs" —
   os dois últimos dependem do robô que gera os CSVs, que não existe no INOVE.
   ═══════════════════════════════════════════════════════════════════════════ */

const CHAVE_MOTIVO = "motivo_advertencia";

/* Tipos + rótulos: cópia de Api._TPL (app/main.py). A ORDEM é a de lá. */
const TIPOS = [
  ["ocorrencia_motorista", "Aviso ao motorista"],
  ["registro_incompleto", "Pedir registro do ponto (sem sugestão)"],
  ["pedir_exclusao", "Pedir exclusão de batida indevida"],
  ["aviso_fora", "Ponto fora do local (GPS)"],
  ["interno_almoco", "Refeição · almoço curto"],
  ["interno_incompleto", "Interno · registro incompleto"],
  ["interno_curta", "Interno · jornada curta"],
  ["advertencia", "Advertência (ajuste errado)"],
  ["advertencia_prazo", "Advertência (não corrigiu em 48h)"],
];

/* Variáveis válidas por tipo: cópia de Api._TPL_VARS. `set_template` RECUSA
   variável fora desta lista, e a validação está portada abaixo — sem ela, um
   {NOM} digitado errado vira buraco na carta que o colaborador recebe. */
const VARS = {
  ocorrencia_motorista: ["{NOME}", "{CRACHA}", "{DATA}", "{DIVERGENCIA}", "{PEDIDO}", "{ESCALA}", "{BATIDAS}"],
  registro_incompleto: ["{NOME}", "{CRACHA}", "{DATA}", "{DIVERGENCIA}", "{BATIDAS}"],
  pedir_exclusao: ["{NOME}", "{CRACHA}", "{DATA}", "{BATIDAS}", "{DIA_SEMANA}"],
  aviso_fora: ["{NOME}", "{CRACHA}", "{DATA}", "{HORA}", "{DISTANCIA}", "{QTD}"],
  interno_almoco: ["{NOME}", "{CRACHA}", "{DATA}"],
  interno_incompleto: ["{NOME}", "{CRACHA}", "{DATA}", "{DIVERGENCIA}"],
  interno_curta: ["{NOME}", "{CRACHA}", "{DATA}", "{JORNADA}"],
  advertencia: ["{NOME}", "{CRACHA}", "{DATA}", "{PEDIU}", "{ANTES}", "{DEPOIS}", "{REAL}", "{DIFERENCA}"],
  advertencia_prazo: ["{NOME}", "{CRACHA}", "{DATA}"],
};

/* Texto oficial (Quataí + Art. 74 da CLT): cópia de Api._TPL_DEFAULT.
   É o que sai quando a chave está VAZIA no app_config — precisa aparecer aqui,
   senão o admin edita no escuro. CÓPIA: mexeu no main.py, atualize aqui. */
const PADRAO = {
  ocorrencia_motorista:
    "Prezado(a) {NOME},\n\nCrachá {CRACHA},\n\nIdentificamos que, no dia {DATA}, NÃO houve marcação de {DIVERGENCIA} no seu registro de ponto.\n\nNos termos do art. 74 da CLT, o registro de ponto deve refletir a jornada efetivamente realizada. Solicitamos que {PEDIDO}, por meio do aplicativo de registro de ponto, no prazo de 48 horas.\n\nEm caso de dúvidas, procure seu supervisor imediato ou o Departamento Pessoal.\n\nAtenciosamente,\n\nDP — Quataí Transporte de Passageiros.",
  registro_incompleto:
    "Prezado(a) {NOME},\n\nCrachá {CRACHA},\n\nIdentificamos que, no dia {DATA}, NÃO houve marcação de {DIVERGENCIA} no seu registro de ponto.\n\nNo cartão constam as batidas: {BATIDAS}.\n\nNos termos do art. 74 da CLT, o registro de ponto deve refletir a jornada efetivamente realizada. Solicitamos que realize o registro de {DIVERGENCIA}, por meio do aplicativo de registro de ponto, no prazo de 48 horas.\n\nEm caso de dúvidas, procure seu supervisor imediato ou o Departamento Pessoal.\n\nAtenciosamente,\n\nDP — Quataí Transporte de Passageiros.",
  pedir_exclusao:
    "Prezado(a) {NOME}, crachá {CRACHA}. No dia {DATA} ({DIA_SEMANA}) consta em seu cartão o registro {BATIDAS}, sem jornada correspondente. Pelo que apuramos, não houve trabalho nesse dia — trata-se de marcação indevida. Solicitamos que peça a EXCLUSÃO desse registro pelo aplicativo de ponto no prazo de 48 horas, para que seu cartão reflita a jornada efetivamente cumprida (Art. 74 da CLT). Em caso de dúvida, procure seu supervisor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  aviso_fora:
    "Prezado(a) {NOME}, crachá {CRACHA}. Identificamos que seu registro de ponto do dia {DATA} foi realizado FORA de local autorizado (garagem ou terminal): a batida das {HORA} ficou a {DISTANCIA} da garagem. O ponto deve ser registrado no seu local de trabalho. Solicitamos que justifique essa ocorrência com seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  interno_almoco:
    "Prezado(a) {NOME}, crachá {CRACHA}. No seu ponto do dia {DATA}, o intervalo de almoço ficou abaixo de 1 hora. Lembramos que o descanso mínimo de 1 hora é um direito do colaborador — por favor, respeite essa regra. Em caso de dúvida, procure seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  interno_incompleto:
    "Prezado(a) {NOME}, crachá {CRACHA}. Seu registro de ponto do dia {DATA} está incompleto: {DIVERGENCIA}. Por favor, ajuste pelo aplicativo de ponto em até 24 horas. Em caso de dúvida, procure seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  interno_curta:
    "Prezado(a) {NOME}, crachá {CRACHA}. Seu registro de ponto do dia {DATA} apresenta jornada abaixo do normal ({JORNADA}). Por favor, verifique se todas as batidas foram registradas e, se faltar alguma, ajuste pelo aplicativo de ponto em até 24 horas. Em caso de dúvida, procure seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  advertencia:
    "Prezado(a) {NOME}, crachá {CRACHA}. O ajuste de ponto solicitado por você referente ao dia {DATA} ({PEDIU}) não corresponde à operação efetivamente registrada pelos sistemas de controle, cuja marcação real foi {REAL} — divergência de {DIFERENCA} minutos. O pedido foi indeferido e o ponto ajustado para o horário real. Reforçamos que o registro de ponto deve espelhar a jornada realmente cumprida, conforme Art. 74 da CLT, e que solicitações em desacordo estão sujeitas às medidas cabíveis. Departamento Pessoal — Quataí Transporte de Passageiros.",
  advertencia_prazo:
    "Prezado(a) {NOME}, crachá {CRACHA}. Você foi comunicado(a) sobre a pendência no seu registro de ponto do dia {DATA} e não realizou a correção no prazo de 48 horas. Fica registrada esta advertência. O registro correto de ponto é obrigação do colaborador, conforme Art. 74 da CLT. Departamento Pessoal — Quataí Transporte de Passageiros.",
};

/* Dados de exemplo da prévia: cópia de CFG_SAMPLE (app.js). */
const EXEMPLO = {
  NOME: "FULANO DE TAL",
  CRACHA: "30060000",
  DATA: "04/08/2026",
  DIA_SEMANA: "segunda-feira",
  BATIDAS: "04:10 · 11:27 · 11:57 · 16:52",
  DIVERGENCIA: "SAÍDA",
  PEDIDO: "realize o ajuste do horário de SAÍDA para 16:52",
  JORNADA: "7h42",
  HORA: "01:15 do dia seguinte",
  DISTANCIA: "130 m",
  PEDIU: "saída às 16:20",
  ANTES: "04:10 · 16:20",
  DEPOIS: "04:10 · 16:52",
  REAL: "01:15 do dia seguinte",
  DIFERENCA: "32",
};

const chaveTemplate = (tipo) => `template_${tipo}`;
const CHAVES = [...TIPOS.map(([tipo]) => chaveTemplate(tipo)), CHAVE_MOTIVO];

/* `valor` é jsonb: a ferramenta grava string, mas nada impede que alguém tenha
   gravado outra coisa. Mostra o que der, sem estourar a tela. */
function comoTexto(valor) {
  if (valor == null) return null;
  return typeof valor === "string" ? valor : JSON.stringify(valor);
}

const preencher = (texto) =>
  String(texto ?? "").replace(/\{([A-Z_]+)\}/g, (todo, chave) =>
    EXEMPLO[chave] != null ? EXEMPLO[chave] : ""
  );

/* Porte de set_template: recusa variável que não existe no tipo. */
function variaveisInvalidas(tipo, texto) {
  const validas = new Set(VARS[tipo] || []);
  const usadas = new Set(String(texto ?? "").match(/\{[A-Z_]+\}/g) || []);
  return [...usadas].filter((v) => !validas.has(v)).sort();
}

function fmtQuando(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return texto;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(data);
}

const ESTILO_CAMPO = {
  font: "inherit",
  fontSize: 13,
  lineHeight: 1.55,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--dp-border-strong)",
  background: "var(--dp-surface)",
  color: "var(--dp-ink)",
  outline: "none",
};

/* ═════════════════════════════ tela ═════════════════════════════ */

export default function Config() {
  const [salvo, setSalvo] = useState({});      // chave -> texto no banco (null = chave não existe)
  const [quando, setQuando] = useState({});    // chave -> atualizado_em, quando a coluna vier
  const [rascunho, setRascunho] = useState({});// chave -> texto em edição
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tipo, setTipo] = useState(TIPOS[0][0]);
  const [aviso, setAviso] = useState(null);    // { chave, tom: "ok"|"danger", texto }
  const [gravando, setGravando] = useState("");
  const areaRef = useRef(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro("");
    setAviso(null);
    // Só as chaves desta tela. Ler a app_config inteira traria também o
    // `folga_motivos`, que é um JSON grande e não tem nada a ver com mensagem.
    return lerDP360("app_config", { filtros: { chave: `in.(${CHAVES.join(",")})` } })
      .then((linhas) => {
        const valores = {};
        const datas = {};
        (linhas || []).forEach((linha) => {
          valores[linha.chave] = comoTexto(linha.valor);
          if (linha.atualizado_em) datas[linha.chave] = linha.atualizado_em;
        });
        setSalvo(valores);
        setQuando(datas);
        setRascunho({});
      })
      .catch((falha) => setErro(falha.message || "Falha ao ler app_config."))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const chave = chaveTemplate(tipo);
  const rotulo = useMemo(() => (TIPOS.find(([t]) => t === tipo) || [, ""])[1], [tipo]);

  // Texto vigente = o que está no banco; chave vazia cai no padrão do Python.
  const gravado = salvo[chave];
  const ehPadrao = !String(gravado ?? "").trim();
  const vigente = ehPadrao ? PADRAO[tipo] : gravado;
  const texto = rascunho[chave] != null ? rascunho[chave] : vigente;
  const sujo = texto !== vigente;

  const motivoGravado = String(salvo[CHAVE_MOTIVO] ?? "");
  const motivo = rascunho[CHAVE_MOTIVO] != null ? rascunho[CHAVE_MOTIVO] : motivoGravado;
  const motivoSujo = motivo !== motivoGravado;

  const invalidas = variaveisInvalidas(tipo, texto);

  const editar = (qual, valor) => {
    setRascunho((atual) => ({ ...atual, [qual]: valor }));
    setAviso(null);
  };

  // Insere a variável na posição do cursor, como os chips do app antigo.
  const inserirVar = (variavel) => {
    const area = areaRef.current;
    if (!area) return editar(chave, `${texto}${variavel}`);
    const ini = area.selectionStart ?? texto.length;
    const fim = area.selectionEnd ?? ini;
    editar(chave, texto.slice(0, ini) + variavel + texto.slice(fim));
    requestAnimationFrame(() => {
      area.focus();
      area.selectionStart = area.selectionEnd = ini + variavel.length;
    });
  };

  // GRAVA — só daqui, só no clique. Um upsert por chave, com o nome da chave
  // dito na mensagem de sucesso para o admin conferir onde foi parar.
  const salvarChave = async (qual, valor) => {
    setGravando(qual);
    setAviso(null);
    try {
      await upsertDP360("app_config", { chave: qual, valor });
      setSalvo((atual) => ({ ...atual, [qual]: valor }));
      setRascunho((atual) => {
        const copia = { ...atual };
        delete copia[qual];
        return copia;
      });
      setAviso({ chave: qual, tom: "ok", texto: `✓ salvo em ${qual}` });
    } catch (falha) {
      setAviso({
        chave: qual,
        tom: "danger",
        texto: falha.message || `Não foi possível gravar ${qual}.`,
      });
    } finally {
      setGravando("");
    }
  };

  const salvarTemplate = () => {
    if (invalidas.length) {
      setAviso({
        chave,
        tom: "danger",
        texto: `variável não existe em ${tipo}: ${invalidas.join(", ")}`,
      });
      return;
    }
    salvarChave(chave, texto);
  };

  const salvarMotivo = () => {
    const limpo = motivo.trim();
    // Mesma trava de set_motivo_advertencia: 102 é o motivo de AVISO no Transnet.
    if (limpo === "102") {
      setAviso({
        chave: CHAVE_MOTIVO,
        tom: "danger",
        texto: "102 é o motivo de AVISO, não de advertência.",
      });
      return;
    }
    salvarChave(CHAVE_MOTIVO, limpo);
  };

  const avisoDe = (qual) =>
    aviso && aviso.chave === qual ? (
      <span className={`dp-pill ${aviso.tom}`}>{aviso.texto}</span>
    ) : null;

  return (
    <AbaShell
      carregando={carregando}
      erro={erro}
      resumo="Os textos que a ferramenta envia ao colaborador. O que você salva aqui vai para a tabela app_config e passa a valer no próximo envio — inclusive para a ferramenta antiga, que lê a mesma chave."
      filtros={
        <>
          {TIPOS.map(([id, nome]) => {
            const gravadoNoBanco = String(salvo[chaveTemplate(id)] ?? "").trim();
            return (
              <button
                key={id}
                type="button"
                className={`dp-chip-f${tipo === id ? " on" : ""}`}
                onClick={() => setTipo(id)}
                title={chaveTemplate(id)}
              >
                {nome}
                {gravadoNoBanco ? <span className="n">•</span> : null}
              </button>
            );
          })}

          <button type="button" className="dp-btn" onClick={carregar} disabled={carregando}>
            ↻ Recarregar
          </button>

          <span className="dp-faint" style={{ marginLeft: "auto", fontSize: 12 }}>
            • = texto personalizado gravado
          </span>
        </>
      }
    >
      <div style={{ display: "grid", gap: 14, margin: "8px 20px 20px", maxWidth: 980 }}>
        {/* ── editor da mensagem ── */}
        <div className="dp-card">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>{rotulo}</strong>
            <span className="dp-pill mute dp-mono">{chave}</span>
            <span className={`dp-pill ${ehPadrao ? "mute" : "accent"}`}>
              {ehPadrao ? "texto padrão (chave vazia)" : "personalizado"}
            </span>
            {quando[chave] ? (
              <span className="dp-faint" style={{ fontSize: 12 }}>
                alterado em {fmtQuando(quando[chave])}
              </span>
            ) : null}
          </div>

          <div className="dp-faint" style={{ fontSize: 12, marginTop: 6 }}>
            {ehPadrao
              ? "Ainda não existe valor gravado nessa chave — abaixo está o texto oficial embutido na ferramenta. Salvar cria a chave e passa a valer no lugar dele."
              : "Este é o texto gravado no banco; é ele que sai para o colaborador."}
          </div>

          <div className="dp-muted" style={{ fontSize: 12, margin: "12px 0 6px" }}>
            Variáveis — clique para inserir no cursor
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(VARS[tipo] || []).map((variavel) => (
              <button
                key={variavel}
                type="button"
                className="dp-chip-f dp-mono"
                onClick={() => inserirVar(variavel)}
              >
                {variavel}
              </button>
            ))}
          </div>

          <textarea
            ref={areaRef}
            value={texto}
            onChange={(evento) => editar(chave, evento.target.value)}
            spellCheck={false}
            style={{ ...ESTILO_CAMPO, width: "100%", minHeight: 230, marginTop: 10, resize: "vertical" }}
          />

          {invalidas.length ? (
            <div style={{ marginTop: 8 }}>
              <span className="dp-pill danger">
                variável não existe em {tipo}: {invalidas.join(", ")}
              </span>
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="dp-btn primary"
              onClick={salvarTemplate}
              disabled={!sujo || !!invalidas.length || gravando === chave}
            >
              {gravando === chave ? "Salvando…" : "Salvar"}
            </button>
            <span className="dp-faint dp-mono" style={{ fontSize: 12 }}>
              grava em app_config.chave = {chave}
            </span>
            {sujo && !invalidas.length ? (
              <span className="dp-pill warn">alteração não salva</span>
            ) : null}
            {avisoDe(chave)}
          </div>
        </div>

        {/* ── prévia ── */}
        <div className="dp-card">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Prévia</strong>
            <span className="dp-faint" style={{ fontSize: 12 }}>
              — com dados de exemplo; variável sem valor sai vazia
            </span>
          </div>
          <div
            style={{
              marginTop: 10,
              padding: "12px 14px",
              borderRadius: 8,
              background: "var(--dp-surface-2)",
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {preencher(texto) || <span className="dp-faint">Mensagem vazia.</span>}
          </div>
          <div className="dp-faint" style={{ fontSize: 12, marginTop: 8 }}>
            No envio, o Python junta as quebras de linha em um parágrafo só
            (<span className="dp-mono">_render</span> em app/main.py) e traduz hora ≥ 24:00 para
            &quot;01:15 do dia seguinte&quot;.
          </div>
        </div>

        {/* ── motivo da advertência: chave própria, salvamento próprio ── */}
        {tipo === "advertencia" ? (
          <div className="dp-card">
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>Código do Motivo no Transnet</strong>
              <span className="dp-pill mute dp-mono">{CHAVE_MOTIVO}</span>
              {quando[CHAVE_MOTIVO] ? (
                <span className="dp-faint" style={{ fontSize: 12 }}>
                  alterado em {fmtQuando(quando[CHAVE_MOTIVO])}
                </span>
              ) : null}
            </div>
            <div className="dp-faint" style={{ fontSize: 12, marginTop: 6 }}>
              É o código que o robô escolhe na tela de lançamento da advertência. O 102 é
              recusado: no Transnet ele é o motivo de AVISO, não de advertência.
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <input
                type="text"
                value={motivo}
                onChange={(evento) => editar(CHAVE_MOTIVO, evento.target.value)}
                placeholder="ex.: 07"
                className="dp-mono"
                style={{ ...ESTILO_CAMPO, width: 120 }}
              />
              <button
                type="button"
                className="dp-btn primary"
                onClick={salvarMotivo}
                disabled={!motivoSujo || gravando === CHAVE_MOTIVO}
              >
                {gravando === CHAVE_MOTIVO ? "Salvando…" : "Salvar motivo"}
              </button>
              <span className="dp-faint dp-mono" style={{ fontSize: 12 }}>
                grava em app_config.chave = {CHAVE_MOTIVO}
              </span>
              {motivoSujo ? <span className="dp-pill warn">alteração não salva</span> : null}
              {avisoDe(CHAVE_MOTIVO)}
            </div>
          </div>
        ) : null}
      </div>
    </AbaShell>
  );
}
