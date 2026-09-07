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

   O "↩ Padrão" (app.js:6810 e :6837) e o "Testar os modelos" (app.js:6818 →
   main.py `testar_mensagens`, :8443) ENTRARAM — ver os comentários de cada um.
   Continua FORA só o "▤ Auditar CSVs já gerados" (app.js:6819 →
   `auditar_mensagens_enviadas`, main.py:8494): ele abre os arquivos que a ferramenta
   desktop escreveu na pasta `exports/` da máquina do DP, e navegador nenhum enxerga
   esse disco.
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

/* A PRÉVIA IMITA O ENVIO, INCLUSIVE NO DEFEITO. Só MAIÚSCULA é trocada — variável
   maiúscula que ninguém conhece vira vazio, e `{Nome}` fica NA TELA, literal. É o que
   `normalizaMensagem` (em `comunicadoTransnet.js`, porte do homônimo do app.js) faz no
   envio de verdade: `.replace(/\{[A-Z_]+\}/g, "")`. Deixar a prévia
   "consertar" o que o envio não conserta esconderia justo o erro que interessa. */
const preencher = (texto) =>
  String(texto ?? "").replace(/\{([A-Z_]+)\}/g, (todo, chave) =>
    EXEMPLO[chave] != null ? EXEMPLO[chave] : ""
  );

/* Porte de set_template (main.py:8146): recusa variável que não existe no tipo.

   COM UMA AMPLIAÇÃO DE PROPÓSITO — o `[A-Za-z_]` no lugar do `[A-Z_]`. O
   `set_template` do Python só olha MAIÚSCULA, então `{Nome}` passa pela gravação; e
   `testar_mensagens` (main.py:8465), que roda depois, olha `\{[A-Za-z_]+\}` e acusa.
   O que muda o tamanho do estrago é o que cada lado faz com o que sobrou:
     · na ferramenta, `_render` (main.py:8182) termina com
       `re.sub(r"\{[A-Za-z_]+\}", "", out)` — `{Nome}` some e a frase fica com um buraco;
     · no INOVE, `normalizaMensagem` (em `comunicadoTransnet.js`) apaga SÓ maiúsculas,
       então `{Nome}` sai LITERAL na carta do colaborador.
   Como as duas telas leem esta mesma `app_config`, o lugar de barrar é aqui, antes de
   gravar. A comparação com as válidas continua sensível a maiúscula, igual ao Python:
   `{Nome}` é inválido mesmo existindo `{NOME}`. */
function variaveisInvalidas(tipo, texto) {
  const validas = new Set(VARS[tipo] || []);
  const usadas = new Set(String(texto ?? "").match(/\{[A-Za-z_]+\}/g) || []);
  return [...usadas].filter((v) => !validas.has(v)).sort();
}

/* ENSAIO DOS MODELOS — porte de `testar_mensagens` (main.py:8443, botão em
   app.js:6818). Não grava, não gera CSV, não abre o Transnet, não envia nada: roda os
   modelos ativos pelo MESMO preenchimento da prévia e diz o que sairia quebrado.

   As três checagens do original, na mesma ordem: texto vazio · variável inválida ·
   variável que sobrou depois do render.

   TRÊS ANOTAÇÕES, todas conferidas no código do original (não na docstring):

   1. O original testa o texto GRAVADO (ele chama `get_templates`). Aqui o teste roda o
      texto que está NO EDITOR — é o que o Salvar vai gravar, e o objetivo é pegar o
      erro ANTES de ele virar carta. A coluna "origem" diz de onde veio cada um, e
      rascunho em branco é testado como o modelo oficial, porque vazio VOLTA ao oficial.

   2. "variável sem preencher" é código MORTO no original: `_render` (main.py:8182)
      termina apagando qualquer `\{[A-Za-z_]+\}`, então nunca sobra nada pro
      `re.findall` seguinte achar. Aqui a checagem tem efeito de verdade, porque quem
      limpa no envio do INOVE (`normalizaMensagem`) apaga SÓ maiúsculas: é exatamente
      por onde um `{Nome}` chegaria ao colaborador.

   3. A checagem `cp1252` do original NÃO foi portada: o INOVE manda UTF-8 e o CSV do
      robô sai em UTF-8. Mas o risco não sumiu junto — a ferramenta desktop lê ESTA
      MESMA `app_config` e escreve o CSV do comunicado em cp1252 com
      `errors="replace"` (main.py:8249). Uma seta "→" ou um travessão salvos aqui viram
      "?" na carta que sai por lá. Escreva os modelos em texto simples. */
function testarModelos(textoDe, origemDe) {
  return TIPOS.map(([tipo, rotulo]) => {
    const bruto = String(textoDe(tipo) ?? "");
    const invalidas = variaveisInvalidas(tipo, bruto);
    const render = preencher(bruto);
    const sobrou = [...new Set(render.match(/\{[A-Za-z_]+\}/g) || [])].sort();
    const erros = [];
    if (!render.trim()) erros.push("texto vazio");
    if (invalidas.length) erros.push(`variável inválida: ${invalidas.join(", ")}`);
    if (sobrou.length) erros.push(`variável sem preencher: ${sobrou.join(", ")}`);
    return { tipo, rotulo, origem: origemDe(tipo), ok: !erros.length, erros };
  });
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
  const [teste, setTeste] = useState(null);    // resultado do último ensaio (ou null)
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
        setTeste(null); // resultado velho não vale para texto novo
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
  // (Vale para QUALQUER tipo, não só o aberto: é o que o ensaio dos modelos usa.)
  const vigenteDe = (t) => {
    const g = salvo[chaveTemplate(t)];
    return String(g ?? "").trim() ? g : PADRAO[t];
  };
  const editorDe = (t) => {
    const r = rascunho[chaveTemplate(t)];
    return r != null ? r : vigenteDe(t);
  };
  // O que o envio usaria se fosse agora: rascunho em branco VOLTA ao modelo oficial
  // (main.py `get_templates`, :8134 — "texto salvo tem prioridade; vazio cai no oficial").
  const efetivoDe = (t) => (String(editorDe(t)).trim() ? editorDe(t) : PADRAO[t]);
  const origemDe = (t) => {
    if (editorDe(t) !== vigenteDe(t)) return "não salva";
    return String(salvo[chaveTemplate(t)] ?? "").trim() ? "personalizada" : "padrão";
  };

  const gravado = salvo[chave];
  const ehPadrao = !String(gravado ?? "").trim();
  const vigente = vigenteDe(tipo);
  const texto = editorDe(tipo);
  const sujo = texto !== vigente;
  const textoVazio = !String(texto).trim();

  const motivoGravado = String(salvo[CHAVE_MOTIVO] ?? "");
  const motivo = rascunho[CHAVE_MOTIVO] != null ? rascunho[CHAVE_MOTIVO] : motivoGravado;
  const motivoSujo = motivo !== motivoGravado;

  const invalidas = variaveisInvalidas(tipo, texto);

  const editar = (qual, valor) => {
    setRascunho((atual) => ({ ...atual, [qual]: valor }));
    setAviso(null);
    // Ensaio velho não vale pro texto novo — e um "✓ testado" desatualizado é pior
    // do que nenhum, porque dá permissão pra não testar de novo.
    setTeste(null);
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
    /* CAIXA VAZIA NÃO É CARTA EM BRANCO. Gravar "" nesta chave é justamente o que faz o
       modelo VOLTAR ao texto oficial (main.py `get_templates`, :8134: "texto salvo tem
       prioridade; vazio cai no modelo oficial") — é o mesmo caminho do botão "↩ Padrão"
       do app antigo (app.js:6837, `set_template(tipo, "")`). Mas o botão nessa hora
       ainda diz "Salvar", e ninguém é obrigado a saber disso: a confirmação diz o que
       vai acontecer de verdade. */
    if (textoVazio) {
      if (!window.confirm(
        "O texto está vazio.\n\nSalvar assim APAGA a personalização e o modelo volta "
        + "ao texto oficial — não manda carta em branco para ninguém.\n\nConfirmar?",
      )) return;
      salvarChave(chave, "");
      return;
    }
    salvarChave(chave, texto);
  };

  /* "↩ Padrão" (app.js:6810 e :6837). O botão do original grava texto VAZIO e recarrega
     os modelos — vazio é o que devolve o oficial. Mesma coisa aqui, com a mesma
     pergunta antes (`confirm("Voltar essa mensagem ao texto padrão?")`). */
  const voltarAoPadrao = () => {
    if (ehPadrao) return;
    if (!window.confirm(
      `Voltar "${rotulo}" ao texto padrão?\n\nA personalização gravada em ${chave} é `
      + "apagada e o modelo oficial (Art. 74 da CLT) volta a valer — inclusive para a "
      + "ferramenta antiga, que lê a mesma chave.",
    )) return;
    salvarChave(chave, "");
  };

  // O ensaio é local e instantâneo: não há chamada de rede, nada é gravado.
  const rodarTeste = () => setTeste(testarModelos(efetivoDe, origemDe));
  const testeDoTipo = teste ? teste.find((x) => x.tipo === tipo) : null;
  const testeFalhas = teste ? teste.filter((x) => !x.ok).length : 0;

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

          {/* A caixa vazia é um caminho legítimo — e é o único que não se adivinha. */}
          {textoVazio ? (
            <div style={{ marginTop: 8 }}>
              <span className="dp-pill warn">
                caixa vazia = volta ao modelo oficial · não manda carta em branco
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
            <button
              type="button"
              className="dp-btn"
              onClick={voltarAoPadrao}
              disabled={ehPadrao || gravando === chave}
              title={ehPadrao
                ? "Esta chave já está vazia — o que vale é o texto oficial."
                : "Apaga o texto gravado; o modelo oficial volta a valer."}
            >
              ↩ Padrão
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
              — com dados de exemplo; variável MAIÚSCULA sem valor sai vazia
            </span>
            {testeDoTipo ? (
              <span className={`dp-pill ${testeDoTipo.ok ? "ok" : "danger"}`}>
                {testeDoTipo.ok ? "✓ modelo testado" : "✕ revisar modelo"}
              </span>
            ) : null}
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

        {/* ── ensaio dos modelos (app.js:6818 → main.py `testar_mensagens`) ── */}
        <div className="dp-card">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>Teste dos modelos</strong>
            <span className="dp-faint" style={{ fontSize: 12 }}>
              — não grava, não gera arquivo, não envia nada
            </span>
          </div>
          <div className="dp-faint" style={{ fontSize: 12, marginTop: 6 }}>
            Roda os {TIPOS.length} modelos com os dados de exemplo e acusa o que sairia
            quebrado: variável que não existe no tipo, variável que sobrou depois do
            preenchimento e texto vazio. Repare no CASO das letras — <span className="dp-mono">
            {"{Nome}"}</span> não é <span className="dp-mono">{"{NOME}"}</span>: o envio do
            INOVE só apaga variável MAIÚSCULA, então a minúscula sai literal na carta do
            colaborador. Testa o que está no editor, inclusive alteração ainda não salva.
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="dp-btn" onClick={rodarTeste}>
              ✓ Testar os {TIPOS.length} modelos
            </button>
            {teste ? (
              <span className={`dp-pill ${testeFalhas ? "danger" : "ok"}`}>
                {testeFalhas
                  ? `${testeFalhas} modelo(s) para revisar`
                  : `${teste.length} modelos sem problema`}
              </span>
            ) : (
              <span className="dp-faint" style={{ fontSize: 12 }}>
                Ainda não testado nesta tela.
              </span>
            )}
          </div>

          {teste ? (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              {teste.map((x) => (
                <button
                  key={x.tipo}
                  type="button"
                  onClick={() => setTipo(x.tipo)}
                  title={`abrir ${x.tipo}`}
                  style={{
                    display: "flex", alignItems: "baseline", gap: 8, textAlign: "left",
                    font: "inherit", fontSize: 12.5, border: 0, padding: "4px 0",
                    background: "transparent", cursor: "pointer",
                    color: x.tipo === tipo ? "var(--dp-accent)" : "var(--dp-ink)",
                  }}
                >
                  <span style={{ color: x.ok ? "var(--dp-ok-ink)" : "var(--dp-danger-ink)",
                    fontWeight: 700, width: 14 }}
                  >
                    {x.ok ? "✓" : "✕"}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b>{x.rotulo}</b>{" "}
                    <span className="dp-faint">{x.origem}</span>
                    {x.ok ? null : (
                      <span className="dp-muted"> — {x.erros.join("; ")}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="dp-faint" style={{ fontSize: 12, marginTop: 10 }}>
            Escreva os modelos em texto simples. A ferramenta antiga lê esta mesma
            <span className="dp-mono"> app_config</span> e grava o CSV do comunicado em
            Windows-1252 com <span className="dp-mono">errors=&quot;replace&quot;</span>
            {" "}(main.py:8249): uma seta &quot;→&quot; ou um travessão salvos aqui viram
            &quot;?&quot; na carta que sai por lá.
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
