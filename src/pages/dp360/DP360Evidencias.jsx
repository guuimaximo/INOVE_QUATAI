// ============================================================================
// DP360 · EVIDÊNCIAS DO ROBÔ — a prova do que foi lançado no Transnet
//
// O QUE ESTA TELA RESPONDE: "prove que isso foi lançado, e mostre a tela do
// Transnet antes e depois". É a pergunta que aparece quando alguém contesta uma
// advertência ou um ajuste de ponto — e a resposta é uma FOTO, não um carimbo.
//
// FONTE DA VERDADE DO FORMATO (nada aqui foi inventado):
//   Sistemas/PONTO/app/main.py:839  get_prova_conferencia
//     — os três padrões de nome de arquivo e as LEGENDAS de cada um.
//   Sistemas/PONTO/app/ui/app.js:2595-2637
//     — a lupa, e a decisão de mostrar LINK e não miniatura (25/08): a foto
//       ocupava a coluna inteira para dar um thumbnail ilegível; quem quer ler
//       o cartão clica e abre grande. Aqui vale o mesmo, com um motivo a mais:
//       cada miniatura seria uma URL assinada emitida à toa.
//
// POR QUE ELA EXISTE
// Na ferramenta desktop a prova estava ali, lida da pasta local do bot. No
// INOVE os bots rodam no GitHub Actions e os prints viram ARTEFATO do run, com
// `retention-days: 30`. Dois buracos: quem não tem acesso ao repositório não
// alcança a prova, e em 30 dias ela some. Esta tela é a porta de entrada da
// cópia permanente: a trilha de auditoria (`dp360_auditoria`) diz quem disparou
// o robô; `dp360_robo_execucao` diz QUAL execução foi aquela; e
// `dp360_robo_evidencia` diz onde cada foto foi guardada.
//
// SEGURANÇA
// Os prints são fotos da tela do Transnet: têm nome, crachá e horário de gente.
// O bucket é PRIVADO — o navegador não lê nada dele direto. Cada foto abre por
// URL ASSINADA de vida curta, emitida pela Edge Function `dp360-api`, que exige
// sessão do INOVE e nível Administrador. Nada de crachá em console.log.
// ============================================================================
import { Fragment, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Archive, Camera, ExternalLink, RefreshCw, Search, X } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { supabase } from "../../supabase";
import AbaShell from "./abas/AbaShell";
import "./dp360.css";

/* ─────────────────────────── tabelas e constantes ────────────────────────── */

// Migration 202609071200_dp360_evidencias.sql. As duas são SOMENTE LEITURA para
// o navegador: quem escreve é a Edge Function, com a service key. Prova que a
// tela pode editar não é prova.
const TAB_EXECUCAO = "dp360_robo_execucao";
const TAB_EVIDENCIA = "dp360_robo_evidencia";
const TAB_AUDITORIA = "dp360_auditoria";

const LIMITE_LISTA = 200;

// A assinatura vale 5 min no servidor (SEGUNDOS_URL_ASSINADA). Guardar por 4
// deixa margem: URL que vence com a lupa aberta vira imagem quebrada.
const VALIDADE_URL_MS = 4 * 60 * 1000;

const ROTULO_ROBO = {
  ocorrencias: "Ocorrências",
  ponto: "Ponto",
  comunicado: "Comunicado",
  ajustes: "Ajustes do app",
};

// O que cada estado de casamento SIGNIFICA para quem lê. "ambiguo" não é um
// defeito da tela: é a tela se recusando a chutar qual execução foi.
const ROTULO_CASAMENTO = {
  exato: { texto: "execução identificada", tom: "ok" },
  ambiguo: { texto: "mais de uma execução na janela", tom: "warn" },
  nao_encontrado: { texto: "execução não localizada", tom: "warn" },
  pendente: { texto: "ainda não procurada", tom: "mute" },
  erro: { texto: "falha ao consultar o GitHub", tom: "danger" },
};

const ROTULO_MOMENTO = {
  antes: "antes de salvar",
  depois: "depois de salvar",
  leitura: "leitura do cartão",
  erro: "erro",
  lote: "lote",
};

/* ────────────────────────────── utilidades puras ─────────────────────────── */

const txt = (v) => String(v ?? "").trim();

// Instante (timestamptz) → horário de Brasília. `disparado_em`, `capturado_em` e
// `run_criado_em` são INSTANTES, então converter por fuso é o certo aqui.
function instanteBR(valor) {
  const s = txt(valor);
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// `date_ref` é uma DATA, não um instante: '2026-09-06' → '06/09/2026', na mão.
// `new Date("2026-09-06")` seria interpretado como meia-noite UTC e, no fuso do
// Brasil, exibiria 05/09 — o dia errado do cartão de ponto de alguém.
function dataBR(iso) {
  const s = txt(iso).slice(0, 10);
  if (s.length < 10) return s || "—";
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
}

function tamanho(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── o gateway ─────────────────────────────────────────────────────────────
   As ações da prova vivem na Edge Function `dp360-api` (a mesma que já checa
   sessão do INOVE + Administrador). Chamadas daqui, e não do
   `src/services/dp360Api.js`, porque aquele arquivo é o cliente das tabelas da
   base de PONTO e estas ações falam com o GitHub e com o Storage do INOVE.

   O supabase-js ENGOLE o corpo quando o status não é 2xx: `error.message` vira
   sempre "Edge Function returned a non-2xx status code", que não diz nada. O
   motivo de verdade ("o artefato EXPIROU no GitHub", "este run não está entre
   os candidatos") vem no JSON, em `error.context`. Sem isto, toda falha na tela
   vira a mesma frase inútil.                                                  */
async function motivoReal(error) {
  const resposta = error?.context;
  if (resposta && typeof resposta.json === "function") {
    try {
      const corpo = await resposta.clone().json();
      if (corpo?.error) return `${corpo.error}${resposta.status ? ` (HTTP ${resposta.status})` : ""}`;
    } catch {
      try {
        const texto = await resposta.clone().text();
        if (texto) return texto.slice(0, 200);
      } catch { /* sem corpo legível */ }
    }
  }
  if (resposta?.status === 401) return "sessão do INOVE expirada — saia e entre de novo";
  if (resposta?.status === 403) return "acesso à DP360 é exclusivo de Administrador";
  return error?.message || "Não foi possível falar com o gateway DP360.";
}

async function chamarGateway(body) {
  const { data, error } = await supabase.functions.invoke("dp360-api", { body });
  if (error) throw new Error(await motivoReal(error));
  if (!data?.ok) throw new Error(data?.error || "O gateway DP360 recusou a chamada.");
  return data;
}

/* Cache das URLs assinadas, por id de evidência. Existe porque cada URL é uma
   operação no servidor e a mesma foto costuma ser aberta duas ou três vezes
   seguidas (o DP compara antes/depois). Some quando a página recarrega — o que
   é bom: URL assinada não é para durar. */
const CACHE_URLS = new Map();

async function urlAssinada(id) {
  const guardada = CACHE_URLS.get(id);
  if (guardada && Date.now() - guardada.em < VALIDADE_URL_MS) return guardada.url;
  const resposta = await chamarGateway({ action: "evidencia_url", ids: [id] });
  const item = (resposta.urls || []).find((u) => Number(u.id) === Number(id));
  if (!item?.url) throw new Error(item?.erro || "não foi possível abrir esta evidência");
  CACHE_URLS.set(id, { url: item.url, em: Date.now() });
  return item.url;
}

/* ─────────────────────────────── a lupa ──────────────────────────────────── */

// app.js:2620 — lupa própria, overlay do app, foto em tamanho real com rolagem.
// O estilo vem inline porque `dp360.css` é compartilhado com as outras telas do
// cluster e não é meu para mexer.
function Lupa({ evidencia, url, erro, aoFechar }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === "Escape") aoFechar(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);

  return (
    <div
      className="dp-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
      style={{ zIndex: 120 }}
    >
      <div
        style={{
          display: "flex", flexDirection: "column", width: "100%", maxWidth: 1400,
          maxHeight: "94vh", background: "#111827", borderRadius: 14, overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
            background: "#1f2937", color: "#e5e7eb", fontSize: 13, flex: "none",
          }}
        >
          <b>{evidencia?.rotulo || evidencia?.arquivo}</b>
          <span style={{ opacity: 0.75 }}>
            {evidencia?.cracha ? `crachá ${evidencia.cracha}` : "lote"}
            {evidencia?.date_ref ? ` · ${dataBR(evidencia.date_ref)}` : ""}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ opacity: 0.6, fontSize: 12 }}>clique fora ou Esc para fechar</span>
          <button type="button" className="dp-btn" onClick={aoFechar} aria-label="Fechar">
            <X size={13} />
          </button>
        </div>
        <div style={{ overflow: "auto", background: "#0b1120", padding: 10, minHeight: 120 }}>
          {erro && <div className="dp-pill danger" style={{ margin: 10 }}>{erro}</div>}
          {!erro && !url && <div style={{ color: "#9ca3af", padding: 16 }}>abrindo a prova…</div>}
          {!erro && url && (
            <img
              src={url}
              alt={evidencia?.rotulo || "prova no Transnet"}
              style={{ display: "block", maxWidth: "none" }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── lista de fotos de um conjunto (execução ou caso) ─────────────────────── */

function ListaProvas({ evidencias, aoAbrir }) {
  if (!evidencias.length) {
    return (
      <div className="dp-vazio">
        Nenhuma foto arquivada para esta execução ainda — use “arquivar a prova”.
      </div>
    );
  }
  // Antes → depois, a ordem em que a prova se lê. Dentro do momento, pelo
  // carimbo do bot.
  const ordem = { antes: 0, depois: 1, leitura: 2, lote: 3, erro: 4 };
  const ordenadas = [...evidencias].sort((a, b) => {
    const d = (ordem[a.momento] ?? 9) - (ordem[b.momento] ?? 9);
    if (d) return d;
    return txt(a.capturado_em || a.arquivo).localeCompare(txt(b.capturado_em || b.arquivo));
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {ordenadas.map((ev) => (
        <button
          key={ev.id}
          type="button"
          className="dp-btn"
          onClick={() => aoAbrir(ev)}
          style={{ justifyContent: "flex-start", textAlign: "left", gap: 8 }}
          title={ev.arquivo}
        >
          <Camera size={13} style={{ verticalAlign: "-2px" }} />
          {/* Se o bot inventar um nome novo, a legenda cai no momento e, na
              falta dele, no próprio arquivo — nunca em branco. */}
          <b>{ev.rotulo || ROTULO_MOMENTO[ev.momento] || ev.arquivo}</b>
          <span className="dp-faint">
            {ev.cracha ? ` · crachá ${ev.cracha}` : ""}
            {ev.date_ref ? ` · ${dataBR(ev.date_ref)}` : ""}
            {ev.capturado_em ? ` · ${instanteBR(ev.capturado_em)}` : ""}
            {` · ${tamanho(ev.bytes)}`}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────────── a tela ──────────────────────────────── */

export default function DP360Evidencias() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360-evidencias", profileMap);

  const [modo, setModo] = useState("execucao"); // 'execucao' | 'caso'
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState(null); // { tom, texto }
  const [recarga, setRecarga] = useState(0);

  const [execucoes, setExecucoes] = useState([]);
  const [orfas, setOrfas] = useState([]);   // disparos sem execução vinculada
  const [termo, setTermo] = useState("");
  const [filtroRobo, setFiltroRobo] = useState("");
  const [soValendo, setSoValendo] = useState(false);

  const [aberta, setAberta] = useState(null);        // id da execução expandida
  const [provas, setProvas] = useState({});          // execucao_id → evidências
  const [artefatos, setArtefatos] = useState({});    // execucao_id → artefatos do run
  const [trabalhando, setTrabalhando] = useState(""); // `${acao}|${id}` enquanto grava

  const [buscaCracha, setBuscaCracha] = useState("");
  const [buscaDia, setBuscaDia] = useState("");
  const [doCaso, setDoCaso] = useState(null); // { linhas, buscou }

  const [lupa, setLupa] = useState(null); // { evidencia, url, erro }

  /* ── carga da lista ─────────────────────────────────────────────────────
     Duas consultas, e a segunda não é enfeite: `dp360_auditoria` tem disparos
     ANTERIORES a este registro existir (e disparos cujo vínculo com o run
     falhou). Mostrar só o que tem execução daria a impressão de que a trilha
     começa aqui — e trilha que esconde o que não sabe explicar é pior do que
     trilha nenhuma. Eles aparecem no fim, ditos como são: sem vínculo.        */
  useEffect(() => {
    if (!podeAcessar) return undefined;
    let vivo = true;
    setCarregando(true);
    setErro("");

    (async () => {
      try {
        const [exec, trilha] = await Promise.all([
          supabase
            .from(TAB_EXECUCAO)
            // o embed traz o QUE aquele disparo mandou fazer (modo, motivo,
            // data, tamanho do lote) — é o "o que este run fez" da tela
            .select(`*, ${TAB_AUDITORIA}!inner(id, acao, alvo, detalhe, criado_em)`)
            .order("disparado_em", { ascending: false })
            .limit(LIMITE_LISTA),
          supabase
            .from(TAB_AUDITORIA)
            .select("id, acao, alvo, detalhe, autor_nome, criado_em")
            .in("acao", ["robo_disparo", "robo_disparo_falhou"])
            .order("criado_em", { ascending: false })
            .limit(LIMITE_LISTA),
        ]);
        if (!vivo) return;
        if (exec.error) throw new Error(exec.error.message);
        if (trilha.error) throw new Error(trilha.error.message);

        const comExecucao = new Set((exec.data || []).map((e) => Number(e.auditoria_id)));
        setExecucoes(exec.data || []);
        setOrfas((trilha.data || []).filter((t) => !comExecucao.has(Number(t.id))));
      } catch (falha) {
        if (vivo) setErro(falha?.message || "Não foi possível ler a trilha do robô.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();

    return () => { vivo = false; };
  }, [podeAcessar, recarga]);

  const recarregar = useCallback(() => {
    setAviso(null);
    setProvas({});
    setArtefatos({});
    setRecarga((n) => n + 1);
  }, []);

  /* ── abrir uma execução: lê as fotos já arquivadas ─────────────────────── */
  const alternarAberta = useCallback(async (execucao) => {
    const id = Number(execucao.id);
    if (aberta === id) { setAberta(null); return; }
    setAberta(id);
    if (provas[id]) return;
    try {
      const { data, error } = await supabase
        .from(TAB_EVIDENCIA)
        .select("id, arquivo, caminho, bytes, tipo, cracha, date_ref, momento, rotulo, capturado_em")
        .eq("execucao_id", id)
        .order("capturado_em", { ascending: true });
      if (error) throw new Error(error.message);
      setProvas((atual) => ({ ...atual, [id]: data || [] }));
    } catch (falha) {
      setAviso({ tom: "danger", texto: falha?.message || "Não foi possível ler as evidências." });
    }
  }, [aberta, provas]);

  /* ── procurar o run (ou escolher entre os candidatos) ──────────────────── */
  const procurarRun = useCallback(async (execucao, runId) => {
    const marca = `casar|${execucao.id}`;
    if (trabalhando) return;
    setTrabalhando(marca);
    setAviso(null);
    try {
      const r = await chamarGateway({
        action: "robo_casar",
        execucao_id: Number(execucao.id),
        ...(runId ? { run_id: Number(runId) } : {}),
      });
      const rotulo = ROTULO_CASAMENTO[r.casamento]?.texto || r.casamento;
      setAviso({
        tom: r.casamento === "exato" ? "ok" : "warn",
        texto: `${rotulo}${r.casamento_nota ? ` · ${r.casamento_nota}` : ""}`,
      });
      setRecarga((n) => n + 1);
    } catch (falha) {
      setAviso({ tom: "danger", texto: falha?.message || "Não foi possível procurar a execução." });
    } finally {
      setTrabalhando("");
    }
  }, [trabalhando]);

  /* ── ver o que o run guardou (e em que pé ele está) ────────────────────── */
  const verArtefatos = useCallback(async (execucao) => {
    const id = Number(execucao.id);
    if (trabalhando) return;
    setTrabalhando(`artefatos|${id}`);
    setAviso(null);
    try {
      const r = await chamarGateway({ action: "robo_artefatos", execucao_id: id });
      setArtefatos((atual) => ({ ...atual, [id]: r }));
    } catch (falha) {
      setAviso({ tom: "danger", texto: falha?.message || "Não foi possível consultar o run." });
    } finally {
      setTrabalhando("");
    }
  }, [trabalhando]);

  /* ── arquivar: a cópia que sobrevive aos 30 dias do GitHub ─────────────── */
  const arquivar = useCallback(async (execucao) => {
    const id = Number(execucao.id);
    if (trabalhando) return;
    setTrabalhando(`arquivar|${id}`);
    setAviso(null);
    try {
      const r = await chamarGateway({ action: "robo_arquivar", execucao_id: id });
      setAviso({
        tom: r.aviso ? "warn" : "ok",
        texto: `✓ ${r.arquivados_agora} arquivo(s) copiados · ${r.arquivos_total} no total (${tamanho(r.bytes)})`
          + (r.aviso ? ` · ${r.aviso}` : ""),
      });
      setProvas((atual) => { const c = { ...atual }; delete c[id]; return c; });
      setRecarga((n) => n + 1);
      setAberta(id);
    } catch (falha) {
      setAviso({ tom: "danger", texto: falha?.message || "Não foi possível arquivar a prova." });
    } finally {
      setTrabalhando("");
    }
  }, [trabalhando]);

  /* ── busca POR CASO: crachá + dia ───────────────────────────────────────
     É como o DP procura quando alguém contesta: a pessoa e o dia, não o run.  */
  const buscarCaso = useCallback(async () => {
    const cracha = buscaCracha.trim();
    if (!cracha) { setDoCaso({ linhas: [], buscou: true }); return; }
    setCarregando(true);
    setAviso(null);
    try {
      let consulta = supabase
        .from(TAB_EVIDENCIA)
        .select("id, execucao_id, run_id, arquivo, bytes, tipo, cracha, date_ref, momento, rotulo, capturado_em")
        .eq("cracha", cracha)
        .order("capturado_em", { ascending: true })
        .limit(300);
      if (buscaDia) consulta = consulta.eq("date_ref", buscaDia);
      const { data, error } = await consulta;
      if (error) throw new Error(error.message);
      setDoCaso({ linhas: data || [], buscou: true });
    } catch (falha) {
      setAviso({ tom: "danger", texto: falha?.message || "Não foi possível buscar o caso." });
    } finally {
      setCarregando(false);
    }
  }, [buscaCracha, buscaDia]);

  /* ── abrir a foto ──────────────────────────────────────────────────────── */
  const abrirLupa = useCallback(async (evidencia) => {
    setLupa({ evidencia, url: null, erro: "" });
    try {
      const url = await urlAssinada(Number(evidencia.id));
      setLupa((atual) => (atual?.evidencia?.id === evidencia.id ? { ...atual, url } : atual));
    } catch (falha) {
      const recado = falha?.message || "não foi possível abrir esta evidência";
      setLupa((atual) => (atual?.evidencia?.id === evidencia.id ? { ...atual, erro: recado } : atual));
    }
  }, []);

  const visiveis = useMemo(() => {
    const q = termo.trim().toLowerCase();
    return execucoes.filter((e) => {
      if (filtroRobo && txt(e.robo) !== filtroRobo) return false;
      if (soValendo && e.confirmar !== true) return false;
      if (!q) return true;
      return [e.autor_nome, e.robo, e.workflow, e.run_numero, e.run_id]
        .map((v) => txt(v).toLowerCase())
        .some((v) => v.includes(q));
    });
  }, [execucoes, termo, filtroRobo, soValendo]);

  const semProva = useMemo(
    () => visiveis.filter((e) => !e.arquivado_em && e.casamento === "exato").length,
    [visiveis],
  );

  if (!podeAcessar) {
    return (
      <div className="dp360 -m-4 sm:-m-6">
        <div className="dp-topbar">
          <div className="dp-brand">
            <div className="dp-brand-mark">DP</div>
            <div>
              <div className="dp-brand-title">Evidências do robô</div>
              <div className="dp-brand-sub">acesso restrito</div>
            </div>
          </div>
        </div>
        <div className="dp-viewbar">
          <div className="dp-vazio" style={{ flex: 1 }}>
            Sem acesso à DP360. Peça ao administrador para liberar
            <span className="dp-mono"> /dp360-evidencias </span>
            no seu perfil do INOVE.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dp360 -m-4 sm:-m-6">
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">DP</div>
          <div>
            <div className="dp-brand-title">Evidências do robô</div>
            <div className="dp-brand-sub">
              a foto da tela do Transnet, antes e depois do lançamento · {user?.nome || "Usuário"}
            </div>
          </div>
        </div>
        <div className="dp-tabs">
          <button
            type="button"
            className={`dp-tab${modo === "execucao" ? " is-active" : ""}`}
            onClick={() => setModo("execucao")}
          >
            Por execução
          </button>
          <button
            type="button"
            className={`dp-tab${modo === "caso" ? " is-active" : ""}`}
            onClick={() => setModo("caso")}
          >
            Por caso (crachá + dia)
          </button>
        </div>
      </div>

      {modo === "execucao" ? (
        <AbaShell
          carregando={carregando}
          erro={erro}
          filtros={
            <>
              <div className="dp-busca">
                <Search size={14} />
                <input
                  type="search"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="quem disparou, robô, nº do run…"
                />
              </div>

              <select
                value={filtroRobo}
                onChange={(e) => setFiltroRobo(e.target.value)}
                title="Filtrar por robô"
              >
                <option value="">todos os robôs</option>
                {Object.entries(ROTULO_ROBO).map(([chave, rotulo]) => (
                  <option key={chave} value={chave}>{rotulo}</option>
                ))}
              </select>

              <button
                type="button"
                className={`dp-chip-f${soValendo ? " on" : ""}`}
                onClick={() => setSoValendo((v) => !v)}
                title="Ensaio não escreve nada no Transnet — não gera prova de lançamento"
              >
                só valendo
                <span className="n">{soValendo ? "ligado" : "desligado"}</span>
              </button>

              <button type="button" className="dp-btn" onClick={recarregar}>
                <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                Atualizar
              </button>
            </>
          }
          resumo={
            <>
              <b className="dp-num">{visiveis.length}</b> disparo(s) com execução vinculada
              {semProva > 0 && (
                <>
                  {" "}
                  <span
                    className="dp-pill warn"
                    title="O artefato do GitHub some em 30 dias — arquivar traz a cópia permanente"
                  >
                    {semProva} sem prova arquivada
                  </span>
                </>
              )}
              {orfas.length > 0 && (
                <>
                  {" "}
                  <span className="dp-pill mute">{orfas.length} disparo(s) sem vínculo</span>
                </>
              )}{" "}
              <span className="dp-faint">
                · a prova fica em bucket privado do INOVE e abre por link assinado de 5 min
              </span>
              {aviso && (
                <>
                  {" "}
                  <span className={`dp-pill ${aviso.tom}`}>{aviso.texto}</span>
                </>
              )}
            </>
          }
        >
          <div className="dp-tabela-wrap">
            <table className="dp-tabela">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Robô</th>
                  <th>Modo</th>
                  <th>Quem disparou</th>
                  <th>Execução</th>
                  <th>Resultado</th>
                  <th>Prova</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!visiveis.length && (
                  <tr className="row-msg">
                    <td colSpan={8} className="dp-tbl-vazio">
                      Nenhum disparo com execução vinculada. Assim que alguém disparar um robô pela
                      DP360, ele aparece aqui com o run correspondente.
                    </td>
                  </tr>
                )}

                {visiveis.map((e) => {
                  const id = Number(e.id);
                  const marca = ROTULO_CASAMENTO[e.casamento] || ROTULO_CASAMENTO.pendente;
                  const candidatos = Array.isArray(e.candidatos) ? e.candidatos : [];
                  const trilha = e[TAB_AUDITORIA] || {};
                  const detalhe = trilha.detalhe || {};
                  const artefatoInfo = artefatos[id];
                  const expandida = aberta === id;
                  return (
                    // Fragment COM key: a linha da execução, a dos candidatos e
                    // a do detalhe são três <tr> irmãos de um mesmo item da
                    // lista, e `<>` curto não aceita key.
                    <Fragment key={id}>
                      <tr className={e.confirmar ? "" : "row-fora"}>
                        <td className="dp-mono">{instanteBR(e.disparado_em)}</td>
                        <td>{ROTULO_ROBO[e.robo] || e.robo}</td>
                        <td>
                          {/* ENSAIO não clica no Transnet. Um print de ensaio prova
                              que o robô CHEGOU na tela, não que lançou. */}
                          <span className={`dp-pill ${e.confirmar ? "danger" : "mute"}`}>
                            {e.confirmar ? "valendo" : "ensaio"}
                          </span>
                          {detalhe.motivo ? <span className="dp-faint"> · {detalhe.motivo}</span> : null}
                          {detalhe.modo ? <span className="dp-faint"> · {detalhe.modo}</span> : null}
                          {detalhe.linhas != null ? (
                            <span className="dp-faint"> · {detalhe.linhas} linha(s)</span>
                          ) : null}
                        </td>
                        <td>{e.autor_nome || "—"}</td>
                        <td>
                          {e.run_id ? (
                            <a
                              href={e.run_url || "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="dp-mono"
                              title="abrir o run no GitHub"
                            >
                              #{e.run_numero ?? e.run_id}{" "}
                              <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
                            </a>
                          ) : (
                            <span className={`dp-pill ${marca.tom}`}>{marca.texto}</span>
                          )}
                        </td>
                        <td>
                          {e.run_conclusao
                            ? <span className={`dp-pill ${e.run_conclusao === "success" ? "ok" : "danger"}`}>{e.run_conclusao}</span>
                            : <span className="dp-faint">{e.run_status || "—"}</span>}
                        </td>
                        <td>
                          {e.arquivado_em ? (
                            <span className="dp-pill ok" title={`arquivado em ${instanteBR(e.arquivado_em)}`}>
                              {e.arquivos_total} arquivo(s)
                            </span>
                          ) : (
                            <span className="dp-pill mute">não arquivada</span>
                          )}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {e.run_id ? (
                            <>
                              <button
                                type="button"
                                className="dp-btn"
                                onClick={() => alternarAberta(e)}
                              >
                                {expandida ? "fechar" : "ver prova"}
                              </button>{" "}
                              <button
                                type="button"
                                className="dp-btn primary"
                                disabled={trabalhando === `arquivar|${id}`}
                                onClick={() => arquivar(e)}
                                title="Baixa o artefato do run e grava cópia permanente no INOVE"
                              >
                                <Archive size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                                {trabalhando === `arquivar|${id}` ? "arquivando…" : "arquivar a prova"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="dp-btn"
                              disabled={trabalhando === `casar|${id}`}
                              onClick={() => procurarRun(e)}
                            >
                              {trabalhando === `casar|${id}` ? "procurando…" : "procurar o run"}
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* ── AMBÍGUO: a tela mostra a LISTA e deixa uma pessoa
                          escolher. Cravar "o mais provável" aqui significaria
                          exibir a foto do lançamento de OUTRA pessoa como prova
                          desta — pior do que não ter foto. ── */}
                      {candidatos.length > 1 && !e.run_id && (
                        <tr className="row-sug">
                          <td colSpan={8}>
                            <div className="dp-dnote warn">
                              {candidatos.length} execuções caíram na janela deste disparo.
                              {e.casamento_nota ? ` ${e.casamento_nota}.` : ""} Confira no GitHub qual
                              é a certa e escolha — a escolha fica registrada como feita à mão, no seu nome.
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                              {candidatos.map((c) => (
                                <span key={c.id} style={{ display: "inline-flex", gap: 4 }}>
                                  <a
                                    href={c.url || "#"}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="dp-btn"
                                    title={`criado em ${instanteBR(c.criado_em)} por ${c.ator || "?"}`}
                                  >
                                    #{c.numero ?? c.id} · {instanteBR(c.criado_em)}
                                    <ExternalLink size={11} style={{ verticalAlign: "-1px", marginLeft: 4 }} />
                                  </a>
                                  <button
                                    type="button"
                                    className="dp-btn primary"
                                    disabled={trabalhando === `casar|${id}`}
                                    onClick={() => procurarRun(e, c.id)}
                                  >
                                    é esta
                                  </button>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}

                      {expandida && (
                        <tr className="row-sug">
                          <td colSpan={8}>
                            <div className="dp-dnote">
                              <b>O que esta execução fez:</b>{" "}
                              {ROTULO_ROBO[e.robo] || e.robo}
                              {detalhe.modo ? ` · ${detalhe.modo}` : ""}
                              {detalhe.motivo ? ` · motivo ${detalhe.motivo}` : ""}
                              {detalhe.data ? ` · data ${detalhe.data}` : ""}
                              {detalhe.linhas != null ? ` · ${detalhe.linhas} linha(s) no lote` : ""}
                              {` · ${e.confirmar ? "VALENDO (escreveu no Transnet)" : "ensaio (não clicou)"}`}
                              {` · workflow ${e.workflow} em ${e.repo}@${e.git_ref}`}
                              {e.casamento_nota ? ` · casamento: ${e.casamento_nota}` : ""}
                            </div>

                            <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
                              <button
                                type="button"
                                className="dp-btn"
                                disabled={trabalhando === `artefatos|${id}`}
                                onClick={() => verArtefatos(e)}
                              >
                                {trabalhando === `artefatos|${id}` ? "consultando…" : "o que o GitHub ainda tem"}
                              </button>
                            </div>

                            {artefatoInfo && (
                              <div className="dp-dnote mute">
                                run {artefatoInfo.run?.status || "?"}
                                {artefatoInfo.run?.conclusao ? ` · ${artefatoInfo.run.conclusao}` : ""}
                                {" · "}
                                {artefatoInfo.artefatos?.length
                                  ? artefatoInfo.artefatos.map((a) => (
                                      <span key={a.id}>
                                        {a.nome} ({tamanho(a.bytes)})
                                        {a.expirado
                                          ? " — EXPIRADO no GitHub"
                                          : ` — expira em ${instanteBR(a.expira_em)}`}
                                        {"  "}
                                      </span>
                                    ))
                                  : "nenhum artefato neste run"}
                              </div>
                            )}

                            <div style={{ marginTop: 8 }}>
                              <ListaProvas evidencias={provas[id] || []} aoAbrir={abrirLupa} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Disparos que a trilha registra mas que não têm execução vinculada:
              os anteriores a este registro existir, e aqueles em que o vínculo
              com o GitHub falhou. Ficam à vista porque a trilha é o inventário
              do que foi feito, não a lista do que deu certo. */}
          {orfas.length > 0 && (
            <div className="dp-resumo" style={{ marginTop: 10, display: "block" }}>
              <b>{orfas.length} disparo(s) sem execução vinculada</b>{" "}
              <span className="dp-faint">
                — registrados em {TAB_AUDITORIA}, mas sem run casado (disparos anteriores a este
                registro, ou casos em que o vínculo falhou). A prova deles, se existir, só está no
                GitHub e vence em 30 dias.
              </span>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                {orfas.slice(0, 25).map((o) => (
                  <div key={o.id} className="dp-faint dp-mono" style={{ fontSize: 12 }}>
                    {instanteBR(o.criado_em)} · {o.alvo || "?"} ·{" "}
                    {o.acao === "robo_disparo_falhou" ? "o GitHub recusou" : "disparado"} ·{" "}
                    {o.autor_nome || "sem autor"}
                  </div>
                ))}
              </div>
            </div>
          )}
        </AbaShell>
      ) : (
        <AbaShell
          carregando={carregando}
          erro={erro}
          filtros={
            <>
              <div className="dp-busca">
                <Search size={14} />
                <input
                  type="search"
                  value={buscaCracha}
                  onChange={(e) => setBuscaCracha(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") buscarCaso(); }}
                  placeholder="crachá (obrigatório)"
                />
              </div>
              <input
                type="date"
                value={buscaDia}
                onChange={(e) => setBuscaDia(e.target.value)}
                title="Dia do cartão de ponto (opcional)"
              />
              <button type="button" className="dp-btn primary" onClick={buscarCaso}>
                Procurar a prova
              </button>
              {buscaDia && (
                <button type="button" className="dp-btn" onClick={() => setBuscaDia("")}>
                  limpar o dia
                </button>
              )}
            </>
          }
          resumo={
            <>
              <span className="dp-faint">
                Busca pelo crachá e pelo dia do cartão, do jeito que a pergunta chega: “prove que o
                lançamento do Fulano no dia tal aconteceu”. Só encontra o que já foi{" "}
                <b>arquivado</b> — o que está apenas no GitHub vence em 30 dias.
              </span>
              {doCaso?.buscou && (
                <>
                  {" "}
                  <b className="dp-num">{doCaso.linhas.length}</b> foto(s)
                </>
              )}
              {aviso && (
                <>
                  {" "}
                  <span className={`dp-pill ${aviso.tom}`}>{aviso.texto}</span>
                </>
              )}
            </>
          }
        >
          {!doCaso?.buscou ? (
            <div className="dp-vazio">Informe o crachá e clique em “Procurar a prova”.</div>
          ) : !doCaso.linhas.length ? (
            <div className="dp-vazio">
              Nenhuma prova arquivada para este crachá
              {buscaDia ? ` no dia ${dataBR(buscaDia)}` : ""}. Se houve lançamento, a foto pode
              ainda estar só no artefato do run — abra “Por execução” e arquive.
            </div>
          ) : (
            <div style={{ padding: "4px 2px" }}>
              <ListaProvas evidencias={doCaso.linhas} aoAbrir={abrirLupa} />
            </div>
          )}
        </AbaShell>
      )}

      {lupa && (
        <Lupa
          evidencia={lupa.evidencia}
          url={lupa.url}
          erro={lupa.erro}
          aoFechar={() => setLupa(null)}
        />
      )}
    </div>
  );
}
