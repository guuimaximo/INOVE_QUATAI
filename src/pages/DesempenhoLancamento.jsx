// src/pages/DesempenhoLancamento.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CampoMotorista from "../components/CampoMotorista";
import CampoPrefixo from "../components/CampoPrefixo";
import { useAuth } from "../context/AuthContext";
import { 
  FaTimes, 
  FaBolt, 
  FaClock, 
  FaExclamationTriangle, 
  FaFileUpload, 
  FaTrash, 
  FaCheckCircle, 
  FaFilePdf, 
  FaRobot, 
  FaSpinner 
} from "react-icons/fa";


const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";
const WF_ACOMP = "ordem-acompanhamento.yml";

// =============================================================================
// Storage — IGUAL AO AGENTE
// =============================================================================
const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_RELATORIOS = "relatorios";

// =============================================================================
// Config do prontuário
// =============================================================================
const TIPO_PRONTUARIO = "prontuarios_acompanhamento";

const MOTIVOS = ["KM/L abaixo da meta", "Tendência de queda", "Comparativo com cluster", "Outro"];

const DESTINOS = {
  ACOMP: "ACOMPANHAMENTO",
  TRAT: "TRATATIVA",
};

const PRIORIDADES = ["Gravíssima", "Alta", "Média", "Baixa"];

// =============================================================================
// HELPERS
// =============================================================================
function isUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function filesToList(files) {
  if (!files?.length) return [];
  return Array.from(files).map((f) => ({
    name: f.name,
    size: f.size,
    type: f.type,
    lastModified: f.lastModified,
    file: f,
  }));
}

function dedupeFiles(list) {
  const seen = new Set();
  return (list || []).filter((x) => {
    const k = `${x.name}__${x.size}__${x.lastModified}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function uploadManyToStorage({ files, bucket, folder }) {
  if (!files?.length) return [];

  const out = [];
  const ts = Date.now();

  for (let i = 0; i < files.length; i++) {
    const f = files[i]?.file;
    if (!f) continue;

    const safeName = String(f.name || `arquivo_${i}`)
      .replaceAll(" ", "_")
      .replace(/[^\w.\-()]/g, "");

    const path = `${folder}/${ts}_${i}_${safeName}`;

    const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, {
      upsert: false,
      cacheControl: "3600",
      contentType: f.type || undefined,
    });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    out.push({ path, publicUrl: pub?.publicUrl || null });
  }

  return out;
}

function normalizePath(p) {
  if (!p) return "";
  return String(p).replace(/^\/+/, "");
}

// ✅ igual ao Agente
function getPublicUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${SUPABASE_BASE_URL}/storage/v1/object/public/${BUCKET_RELATORIOS}/${cleanPath}`;
}

// ✅ GitHub Actions dispatch — igual ao Agente
async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) throw new Error("Credenciais GitHub ausentes (VITE_GITHUB_*).");
  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: GH_REF, inputs }),
  });

  if (response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Erro GitHub: ${response.status}`);
  }
  return true;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function pollFindProntuario({ chapa, loteId, maxTries = 24, intervalMs = 2500 }) {
  // Estratégia robusta:
  // 1) tenta achar em relatorios_gerados pelos campos comuns
  // 2) tenta achar por arquivo_pdf_path contendo a chapa
  // 3) retorna URL pública se achar

  const chapaStr = String(chapa || "").trim();
  const loteStr = loteId ? String(loteId) : null;

  for (let i = 0; i < maxTries; i++) {
    // 1) tipo exato
    let q = supabase
      .from("relatorios_gerados")
      .select("id, created_at, tipo, status, arquivo_pdf_path, arquivo_path, erro_msg, extra, metadata")
      .order("created_at", { ascending: false })
      .limit(30);

    // se você grava tipo do prontuário, ajuda MUITO
    q = q.eq("tipo", TIPO_PRONTUARIO);

    const { data: rows, error } = await q;
    if (!error && rows?.length) {
      // tenta casar por lote/chapa de vários jeitos
      const found =
        rows.find((r) => String(r?.extra?.lote_id || "") === loteStr) ||
        rows.find((r) => String(r?.metadata?.lote_id || "") === loteStr) ||
        rows.find((r) => String(r?.extra?.motorista_chapa || "") === chapaStr) ||
        rows.find((r) => String(r?.metadata?.motorista_chapa || "") === chapaStr) ||
        rows.find((r) => String(r?.arquivo_pdf_path || r?.arquivo_path || "").includes(chapaStr));

      const row = found || rows[0];

      const pdfPath = normalizePath(row?.arquivo_pdf_path || "");
      const anyPath = normalizePath(row?.arquivo_path || "");

      const url = getPublicUrl(pdfPath || anyPath);
      if (url && row?.status === "CONCLUIDO") {
        return { row, url };
      }

      // se tiver path mesmo em PROCESSANDO, continua polling
    }

    await sleep(intervalMs);
  }

  return null;
}

// =============================================================================
// COMPONENTES AUXILIARES UI
// =============================================================================
function Segmented({ value, onChange, disabled }) {
  return (
    <div className="flex bg-slate-200/60 p-1.5 rounded-2xl w-fit shadow-inner">
      <button
        type="button"
        onClick={() => onChange(DESTINOS.ACOMP)}
        disabled={disabled}
        className={`px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all flex items-center gap-2 ${
          value === DESTINOS.ACOMP 
            ? "bg-white text-blue-700 shadow-sm border border-slate-200/50" 
            : "text-slate-500 hover:text-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <FaClock className={value === DESTINOS.ACOMP ? "text-blue-500" : ""} /> Acompanhamento
      </button>
      <button
        type="button"
        onClick={() => onChange(DESTINOS.TRAT)}
        disabled={disabled}
        className={`px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all flex items-center gap-2 ${
          value === DESTINOS.TRAT 
            ? "bg-white text-rose-700 shadow-sm border border-slate-200/50" 
            : "text-slate-500 hover:text-slate-700"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <FaExclamationTriangle className={value === DESTINOS.TRAT ? "text-rose-500" : ""} /> Tratativas
      </button>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl animate-in zoom-in-95 duration-200">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/50 flex flex-col" style={{ maxHeight: "calc(100vh - 48px)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-lg font-black text-slate-800 truncate">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all"
            >
              <FaTimes size={16} />
            </button>
          </div>
          <div className="p-0 overflow-auto bg-slate-100/50 flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function DesempenhoLancamento() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // =============================
  // Tabs
  // =============================
  const [destino, setDestino] = useState(DESTINOS.ACOMP);

  // =============================
  // Shared
  // =============================
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [observacaoInicial, setObservacaoInicial] = useState("");

  const motivoFinal = motivo === "Outro" ? motivoOutro.trim() : motivo;

  // =============================
  // TRATATIVA
  // =============================
  const [linhasOpt, setLinhasOpt] = useState([]);
  const [refsLoading, setRefsLoading] = useState(false);

  const [prefixo, setPrefixo] = useState("");
  const [linha, setLinha] = useState("");
  const [cluster, setCluster] = useState("");

  const [prioridadeTratativa, setPrioridadeTratativa] = useState("Alta");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");

  const [evidTrat, setEvidTrat] = useState([]);

  // =============================
  // UI
  // =============================
  const diasMonitoramento = 10;

  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // =============================
  // Prontuário (viewer)
  // =============================
  const [prontLoading, setProntLoading] = useState(false);
  const [prontErr, setProntErr] = useState("");
  const [prontRow, setProntRow] = useState(null);
  const [prontPdfUrl, setProntPdfUrl] = useState(null);
  const [prontPdfOpen, setProntPdfOpen] = useState(false);

  // =============================
  // Load refs (linhas)
  // =============================
  useEffect(() => {
    (async () => {
      setRefsLoading(true);
      try {
        const { data: linhasData, error: eLinhas } = await supabase
          .from("linhas")
          .select("id, codigo, descricao")
          .order("codigo", { ascending: true });
        if (eLinhas) throw eLinhas;
        setLinhasOpt(linhasData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setRefsLoading(false);
      }
    })();
  }, []);

  // =============================
  // Files (Tratativa)
  // =============================
  function addFilesTrat(e) {
    const list = filesToList(e.target.files);
    setEvidTrat((prev) => dedupeFiles([...(prev || []), ...list]));
    e.target.value = "";
  }
  function removeFileTrat(idx) {
    setEvidTrat((prev) => prev.filter((_, i) => i !== idx));
  }

  // =============================
  // Validation
  // =============================
  const prontoAcomp = useMemo(() => {
    if (destino !== DESTINOS.ACOMP) return false;
    const chapaOuNome = String(motorista?.chapa || motorista?.nome || "").trim();
    const motivoOk = String(motivoFinal || "").trim().length > 0;
    const obsOk = String(observacaoInicial || "").trim().length > 0;
    return !!(chapaOuNome && motivoOk && obsOk);
  }, [destino, motorista, motivoFinal, observacaoInicial]);

  const prontoTrat = useMemo(() => {
    if (destino !== DESTINOS.TRAT) return false;

    const baseOk =
      (motorista?.chapa || motorista?.nome) &&
      String(prefixo || "").trim() &&
      String(linha || "").trim() &&
      String(cluster || "").trim();

    if (!baseOk) return false;

    const motivoOk = String(motivoFinal || "").trim().length > 0;
    const evidOk = (evidTrat || []).length > 0;
    const periodoOk = String(periodoInicio || "").trim() && String(periodoFim || "").trim();

    return motivoOk && evidOk && periodoOk;
  }, [destino, motorista, prefixo, linha, cluster, motivoFinal, evidTrat, periodoInicio, periodoFim]);

  const pronto = destino === DESTINOS.ACOMP ? prontoAcomp : prontoTrat;

  // =============================
  // Reset / limpar
  // =============================
  function limparTudo() {
    setMotorista({ chapa: "", nome: "" });
    setMotivo(MOTIVOS[0]);
    setMotivoOutro("");
    setObservacaoInicial("");
    setPrefixo("");
    setLinha("");
    setCluster("");
    setPrioridadeTratativa("Alta");
    setPeriodoInicio("");
    setPeriodoFim("");
    setEvidTrat([]);
    setSaving(false);
    setErrMsg("");
    setOkMsg("");
    setProntLoading(false);
    setProntErr("");
    setProntRow(null);
    setProntPdfUrl(null);
    setProntPdfOpen(false);
  }

  useEffect(() => {
    setErrMsg("");
    setOkMsg("");
    setProntErr("");
    setProntRow(null);
    setProntPdfUrl(null);
    setProntPdfOpen(false);
  }, [destino]);

  // =============================================================================
  // PRONTUÁRIO (ACOMP) — GERAÇÃO AVULSA
  // =============================================================================
  async function gerarProntuarioAcomp() {
    if (prontLoading) return;
    setProntLoading(true);
    setProntErr("");
    setProntRow(null);
    setProntPdfUrl(null);

    try {
      const chapa = String(motorista?.chapa || "").trim();
      const nome = String(motorista?.nome || "").trim() || null;

      if (!chapa) throw new Error("Para gerar prontuário, informe a CHAPA do motorista.");

      // 1) cria lote
      const { data: lote, error: errL } = await supabase
        .from("acompanhamento_lotes")
        .insert({
          status: "PROCESSANDO",
          qtd: 1,
          extra: {
            origem: "DESPENHO_LANCAMENTO_ACOMP",
            tipo: TIPO_PRONTUARIO,
            gerado_em: new Date().toISOString(),
            motorista_chapa: chapa,
            motorista_nome: nome,
          },
        })
        .select("id")
        .single();
      if (errL) throw errL;

      // 2) cria item
      const { error: errI } = await supabase.from("acompanhamento_lote_itens").insert([
        {
          lote_id: lote.id,
          motorista_chapa: chapa,
          linha_mais_rodada: null,
          km_percorrido: 0,
          combustivel_consumido: 0,
          kml_realizado: 0,
          kml_meta: 0,
          combustivel_desperdicado: 0,
          extra: { motorista_nome: nome, origem: "DESPENHO_LANCAMENTO_ACOMP", tipo: TIPO_PRONTUARIO },
        },
      ]);
      if (errI) throw errI;

      // 3) dispatch workflow
      await dispatchGitHubWorkflow(WF_ACOMP, {
        ordem_batch_id: String(lote.id),
        qtd: "1",
      });

      // 4) polling
      const found = await pollFindProntuario({ chapa, loteId: lote.id, maxTries: 28, intervalMs: 2500 });

      if (!found?.url) {
        throw new Error(`Workflow disparado (lote #${lote.id}), mas não encontrei o PDF no banco ainda. Tente atualizar em 1–2 min.`);
      }

      if (!mountedRef.current) return;
      setProntRow(found.row);
      setProntPdfUrl(found.url);
      setProntPdfOpen(true);
    } catch (e) {
      if (!mountedRef.current) return;
      setProntErr(String(e?.message || e));
    } finally {
      if (!mountedRef.current) return;
      setProntLoading(false);
    }
  }

  // =============================================================================
  // LANÇAR (ACOMP minimal vs TRAT full)
  // =============================================================================
  async function lancar() {
    if (!pronto || saving) return;

    setSaving(true);
    setErrMsg("");
    setOkMsg("");

    try {
      const lancadorLogin = user?.login || user?.email || null;
      const lancadorNome = user?.nome || null;
      const lancadorIdNum = user?.id ?? null;

      const chapa = String(motorista?.chapa || "").trim();
      const nomeMotorista = String(motorista?.nome || "").trim() || null;

      // ==========================================================
      // ACOMPANHAMENTO (minimal)
      // ==========================================================
      if (destino === DESTINOS.ACOMP) {
        const chapaOuNome = String(motorista?.chapa || motorista?.nome || "").trim();
        if (!chapaOuNome) throw new Error("Informe o motorista.");
        if (!String(motivoFinal || "").trim()) throw new Error("Informe o motivo.");
        if (!String(observacaoInicial || "").trim()) throw new Error("Informe a observação.");

        const payloadLancamento = {
          motorista_chapa: chapa || null,
          motorista_nome: nomeMotorista,
          prefixo: null, linha: null, cluster: null,
          destino: DESTINOS.ACOMP, prioridade: null,
          motivo: motivoFinal,
          observacao_inicial: String(observacaoInicial || "").trim(),
          periodo_inicio: null, periodo_fim: null,
          dias_monitoramento: Number(diasMonitoramento) || 10,
          kml_meta: null, evidencias_urls: [], meritocracia: {},
          resumo_totais: { dias: 0, km: 0, litros: 0, kml: 0 },
          resumo_dias: [], resumo_veiculos: [],
          lancado_por_login: lancadorLogin, lancado_por_nome: lancadorNome,
          lancado_por_usuario_id: lancadorIdNum ? String(lancadorIdNum) : null,
          metadata: { origem: "LANCAMENTO_MINIMAL_ACOMP", motorista_ref: chapaOuNome },
        };

        const { data: lanc, error: eL } = await supabase.from("diesel_lancamentos").insert(payloadLancamento).select("id").single();
        if (eL) throw eL;

        const payloadAcomp = {
          motorista_chapa: chapa || null, motorista_nome: nomeMotorista,
          motivo: motivoFinal, status: "A_SER_ACOMPANHADO",
          dias_monitoramento: Number(diasMonitoramento),
          dt_inicio: new Date().toISOString().slice(0, 10),
          observacao_inicial: String(observacaoInicial || "").trim(),
          lancamento_id: lanc.id,
          metadata: { origem: "LANCAMENTO_MINIMAL_ACOMP", lancado_por_login: lancadorLogin, lancado_por_nome: lancadorNome },
        };

        const { data: acomp, error: eA } = await supabase.from("diesel_acompanhamentos").insert(payloadAcomp).select("id").single();
        if (eA) throw eA;

        const payloadEvento = {
          acompanhamento_id: acomp.id, tipo: "LANCAMENTO",
          observacoes: `${motivoFinal}\n\n${String(observacaoInicial || "").trim()}`,
          criado_por_login: lancadorLogin, criado_por_nome: lancadorNome,
          criado_por_id: isUuid(user?.id) ? user.id : null,
          extra: { lancamento_id: lanc.id, origem: "LANCAMENTO_MINIMAL_ACOMP" },
        };

        const { error: eE } = await supabase.from("diesel_acompanhamento_eventos").insert(payloadEvento);
        if (eE) throw eE;

        setOkMsg("Acompanhamento lançado! Gerando prontuário automaticamente...");
        await gerarProntuarioAcomp();

        if (!mountedRef.current) return;
        setOkMsg("Acompanhamento lançado e prontuário gerado com sucesso.");
        return;
      }

      // ==========================================================
      // TRATATIVA (full)
      // ==========================================================
      const ini = String(periodoInicio || "").trim();
      const fim = String(periodoFim || "").trim();

      if (!String(prefixo || "").trim()) throw new Error("Informe o prefixo.");
      if (!String(linha || "").trim()) throw new Error("Informe a linha.");
      if (!String(cluster || "").trim()) throw new Error("Cluster não encontrado no prefixo.");
      if (!ini || !fim) throw new Error("Informe o período (início e fim).");
      if (!String(motivoFinal || "").trim()) throw new Error("Informe o motivo.");
      if (!evidTrat?.length) throw new Error("Anexe pelo menos 1 evidência.");

      const folder = `diesel/tratativas/${chapa || "sem_chapa"}/lancamento_${Date.now()}`;
      const uploaded = await uploadManyToStorage({ files: evidTrat, bucket: "diesel", folder });
      const evidenciasUrls = uploaded.map((u) => u.publicUrl).filter(Boolean);
      const obsInit = String(observacaoInicial || "").trim() || null;

      const payloadLancamento = {
        motorista_chapa: chapa || null, motorista_nome: nomeMotorista,
        prefixo: String(prefixo || "").trim(), linha: String(linha || "").trim(), cluster: String(cluster || "").trim(),
        destino: DESTINOS.TRAT, prioridade: prioridadeTratativa,
        motivo: motivoFinal, observacao_inicial: obsInit,
        periodo_inicio: ini || null, periodo_fim: fim || null,
        dias_monitoramento: Number(diasMonitoramento) || 10,
        evidencias_urls: evidenciasUrls,
        lancado_por_login: lancadorLogin, lancado_por_nome: lancadorNome,
        metadata: { lancamento_periodo_inicio: ini || null, lancamento_periodo_fim: fim || null },
      };

      const { data: lanc, error: eL } = await supabase.from("diesel_lancamentos").insert(payloadLancamento).select("id").single();
      if (eL) throw eL;

      const descricaoBase = obsInit ? `${motivoFinal}\n\n${obsInit}` : motivoFinal;

      const payloadTratativa = {
        motorista_chapa: chapa || null, motorista_nome: nomeMotorista,
        origem: "DIESEL", tipo_ocorrencia: "DIESEL_KML", prioridade: prioridadeTratativa, status: "Pendente",
        descricao: descricaoBase, prefixo: String(prefixo || "").trim(), linha: String(linha || "").trim(), cluster: String(cluster || "").trim(),
        periodo_inicio: ini || null, periodo_fim: fim || null,
        evidencias_urls: evidenciasUrls, lancamento_id: lanc.id,
        metadata: { origem: "LANCAMENTO_MANUAL", lancado_por_login: lancadorLogin, lancado_por_nome: lancadorNome },
      };

      const { data: trat, error: eT } = await supabase.from("diesel_tratativas").insert(payloadTratativa).select("id").single();
      if (eT) throw eT;

      await supabase.from("diesel_tratativas_detalhes").insert({
        tratativa_id: trat.id, acao_aplicada: "ABERTURA_MANUAL", observacoes: descricaoBase,
        tratado_por_login: lancadorLogin, tratado_por_nome: lancadorNome, tratado_por_id: isUuid(user?.id) ? user.id : null,
        extra: { evidencias_urls: evidenciasUrls, lancamento_id: lanc.id },
      });

      setOkMsg("Tratativa criada com sucesso! Redirecionando...");
      setTimeout(() => { navigate("/desempenho-diesel/tratativas"); }, 1500);

    } catch (err) {
      console.error(err);
      setErrMsg(err?.message || "Erro ao lançar.");
    } finally {
      setSaving(false);
    }
  }

  // =============================================================================
  // RENDERIZAÇÃO
  // =============================================================================
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 bg-slate-50 min-h-screen font-sans">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <FaBolt className="text-yellow-500" />
            Painel de Lançamentos
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-2">
            Inicie um acompanhamento preventivo ou abra uma medida disciplinar na Central.
          </p>
        </div>
        <Segmented value={destino} onChange={setDestino} disabled={saving || prontLoading} />
      </div>

      {/* FEEDBACK (ALERTAS) */}
      {errMsg && (
        <div className="mb-6 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <FaExclamationTriangle className="text-rose-500 text-xl" />
          <div className="text-sm font-bold text-rose-800">{errMsg}</div>
        </div>
      )}
      {okMsg && (
        <div className="mb-6 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <FaCheckCircle className="text-emerald-500 text-xl" />
          <div className="text-sm font-bold text-emerald-800">{okMsg}</div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL (BASEADO NO DESTINO) */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden transition-all duration-300">
        
        {/* BANNER DA ABA */}
        <div className={`px-6 md:px-10 py-5 border-b ${destino === DESTINOS.ACOMP ? "bg-blue-50/50 border-blue-100" : "bg-rose-50/50 border-rose-100"}`}>
          <div className={`text-lg font-black flex items-center gap-2 ${destino === DESTINOS.ACOMP ? "text-blue-800" : "text-rose-800"}`}>
            {destino === DESTINOS.ACOMP ? <><FaClock /> Acompanhamento Preventivo</> : <><FaExclamationTriangle /> Medida Disciplinar (Tratativa)</>}
          </div>
          <div className={`text-sm mt-1 font-medium ${destino === DESTINOS.ACOMP ? "text-blue-600/80" : "text-rose-600/80"}`}>
            {destino === DESTINOS.ACOMP 
              ? "Preencha apenas o básico. O robô gerará o prontuário e enviará a ordem para os Instrutores de campo." 
              : "Preencha o formulário completo. O caso será encaminhado para avaliação rigorosa do RH e Gestores."}
          </div>
        </div>

        {/* CONTAINER DUPLO PARA ACOMPANHAMENTO (FORM + STATUS PRONTUÁRIO) */}
        {destino === DESTINOS.ACOMP ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            
            {/* LADO ESQUERDO: FORMULÁRIO */}
            <div className="lg:col-span-2 p-6 md:p-10 space-y-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Identificação do Motorista</label>
                  <CampoMotorista value={motorista} onChange={setMotorista} />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Motivo do Acompanhamento</label>
                  <select 
                    value={motivo} 
                    onChange={(e) => setMotivo(e.target.value)} 
                    disabled={saving || prontLoading}
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all cursor-pointer"
                  >
                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {motivo === "Outro" && (
                    <input 
                      value={motivoOutro} 
                      onChange={(e) => setMotivoOutro(e.target.value)} 
                      disabled={saving || prontLoading}
                      className="mt-3 w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold" 
                      placeholder="Especifique o motivo..." 
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Observações Iniciais</label>
                  <textarea 
                    value={observacaoInicial} 
                    onChange={(e) => setObservacaoInicial(e.target.value)} 
                    disabled={saving || prontLoading}
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 resize-none min-h-[140px]"
                    placeholder="Contexto do caso, ponto observado na telemetria, ou orientação inicial para o instrutor..."
                  />
                </div>
              </div>

              <div className="pt-6 flex flex-wrap items-center justify-between gap-4">
                <button type="button" onClick={limparTudo} disabled={saving || prontLoading} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors w-full sm:w-auto">
                  Limpar
                </button>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={!String(motorista?.chapa || "").trim() || saving || prontLoading}
                    onClick={gerarProntuarioAcomp}
                    className="px-6 py-3 rounded-xl text-sm font-bold bg-white border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    {prontLoading ? <><FaSpinner className="animate-spin" /> Gerando...</> : <><FaFilePdf /> Gerar Prontuário</>}
                  </button>
                  <button
                    type="button"
                    disabled={!prontoAcomp || saving || prontLoading}
                    onClick={lancar}
                    className="px-8 py-3 rounded-xl text-sm font-black bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-blue-600/30 transition-all disabled:opacity-60 disabled:hover:shadow-none w-full sm:w-auto flex justify-center"
                  >
                    {saving ? "Lançando..." : "Lançar Ordem"}
                  </button>
                </div>
              </div>
            </div>

            {/* LADO DIREITO: STATUS DO PRONTUÁRIO */}
            <div className="bg-slate-50/50 p-6 md:p-10 flex flex-col">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-2"><FaRobot className="text-slate-400 text-lg" /> Status do Robô</h3>
              <p className="text-xs text-slate-500 font-medium mb-6">Acompanhe a geração do documento em tempo real.</p>
              
              {(prontLoading || prontErr || prontRow) ? (
                <div className="space-y-4 flex-1">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Progresso</div>
                    <div className="text-base font-black text-slate-800 flex items-center gap-2">
                      {prontLoading ? <><FaSpinner className="animate-spin text-blue-500" /> Analisando Dados...</> : prontErr ? <span className="text-rose-600">Falha na Geração</span> : <><FaCheckCircle className="text-emerald-500" /> Relatório Pronto</>}
                    </div>

                    {prontErr && (
                      <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                        {prontErr}
                      </div>
                    )}

                    {prontRow && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-medium text-slate-500">
                        <span>Status DB: {String(prontRow.status || "")}</span>
                        {prontRow.id && <span>ID: #{prontRow.id}</span>}
                      </div>
                    )}
                  </div>

                  {prontPdfUrl && (
                    <button
                      type="button"
                      onClick={() => setProntPdfOpen(true)}
                      className="w-full py-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-300 hover:text-blue-700 text-sm font-bold text-slate-700 transition-all flex justify-center items-center gap-2 shadow-sm"
                    >
                      <FaFilePdf className="text-rose-500" /> Abrir Visualizador de PDF
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50">
                  <FaFilePdf className="text-4xl text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-slate-400">Nenhum prontuário gerado.</p>
                  <p className="text-xs font-medium text-slate-400 mt-1">Preencha o motorista e clique em "Gerar Prontuário" para visualizar a análise da IA antes de lançar.</p>
                </div>
              )}
            </div>
          </div>
        ) : (

          // ==========================================================
          // FLUXO DE TRATATIVA (FORMULÁRIO COMPLETO)
          // ==========================================================
          <div className="p-6 md:p-10 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              
              {/* MOTORISTA */}
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Identificação do Infrator</label>
                <CampoMotorista value={motorista} onChange={setMotorista} />
              </div>

              {/* PRIORIDADE */}
              <div className="md:col-span-2">
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Nível de Gravidade</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-rose-50/50 p-2 rounded-2xl border border-rose-100">
                  {PRIORIDADES.map(p => (
                    <button 
                      key={p} 
                      type="button"
                      onClick={() => setPrioridadeTratativa(p)}
                      disabled={saving}
                      className={`py-3 px-4 rounded-xl text-sm font-bold transition-all ${prioridadeTratativa === p ? "bg-rose-600 text-white shadow-md shadow-rose-600/20" : "bg-white text-slate-600 border border-slate-200 hover:border-rose-300"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* DADOS DO VEÍCULO */}
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Prefixo do Veículo</label>
                  <CampoPrefixo value={prefixo} onChange={setPrefixo} onChangeCluster={setCluster} disabled={saving} />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Linha Operada</label>
                  <select value={linha} onChange={(e) => setLinha(e.target.value)} disabled={refsLoading || saving} className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none cursor-pointer appearance-none">
                    <option value="">{refsLoading ? "Carregando..." : "Selecione a linha..."}</option>
                    {linhasOpt.map((l) => (
                      <option key={l.id || l.codigo} value={String(l.codigo || "").trim()}>
                        {String(l.codigo || "").trim()} — {String(l.descricao || "").trim()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Cluster Detectado</label>
                  <input value={cluster} readOnly placeholder="Automático pelo prefixo..." className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-100 text-slate-500 font-bold outline-none cursor-not-allowed" />
                </div>
              </div>

              {/* DADOS DA OCORRÊNCIA E EVIDÊNCIAS */}
              <div className="space-y-6 flex flex-col h-full">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Período da Infração</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} disabled={saving} className="p-3.5 rounded-2xl border-2 border-slate-100 font-bold text-slate-600 focus:border-blue-500 outline-none w-full" />
                    <input type="date" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} disabled={saving} className="p-3.5 rounded-2xl border-2 border-slate-100 font-bold text-slate-600 focus:border-blue-500 outline-none w-full" />
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Provas Documentais <span className="text-rose-500 ml-1">* Obrigatório</span></label>
                  <div className="flex-1 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 p-4 hover:bg-slate-100 transition-colors flex flex-col gap-4">
                    <label className="cursor-pointer bg-white border border-slate-200 rounded-xl py-4 flex flex-col items-center justify-center hover:border-blue-400 transition-all shadow-sm">
                      <input type="file" multiple onChange={addFilesTrat} disabled={saving} className="hidden" />
                      <FaFileUpload className="text-2xl text-blue-500 mb-2" />
                      <span className="text-sm font-bold text-slate-600">Adicionar Anexos</span>
                    </label>
                    <div className="space-y-2 overflow-y-auto max-h-40 pr-2">
                      {evidTrat.map((f, idx) => (
                        <div key={idx} className="bg-white border rounded-lg p-3 flex items-center justify-between shadow-sm">
                          <div className="truncate pr-4">
                            <p className="text-xs font-bold text-slate-700 truncate">{f.name}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{(Number(f.size || 0) / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                          <button type="button" onClick={() => removeFileTrat(idx)} disabled={saving} className="text-rose-400 hover:text-rose-600 p-2"><FaTrash size={12}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* MOTIVO E OBSERVAÇÃO (LARGURA TOTAL) */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Motivo da Tratativa</label>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={saving} className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 font-bold text-slate-700 focus:border-blue-500 focus:bg-white outline-none appearance-none cursor-pointer">
                    {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {motivo === "Outro" && (
                    <input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} disabled={saving} className="mt-3 w-full p-4 rounded-2xl border-2 border-slate-100 focus:border-blue-500 outline-none font-bold" placeholder="Especifique..." />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Justificativa e Parecer</label>
                  <textarea value={observacaoInicial} onChange={(e) => setObservacaoInicial(e.target.value)} disabled={saving} className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 focus:border-blue-500 focus:bg-white outline-none font-medium text-slate-700 resize-none min-h-[120px]" placeholder="Argumentação técnica para a abertura da medida disciplinar..." />
                </div>
              </div>

            </div>

            <div className="pt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100">
              <button type="button" onClick={limparTudo} disabled={saving} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors w-full sm:w-auto">
                Limpar Formulário
              </button>
              <button
                type="button"
                disabled={!prontoTrat || saving}
                onClick={lancar}
                className="px-10 py-4 rounded-2xl text-sm font-black bg-rose-600 text-white hover:bg-rose-700 shadow-lg hover:shadow-rose-600/30 transition-all disabled:opacity-60 disabled:hover:shadow-none w-full sm:w-auto flex items-center justify-center gap-3 transform active:scale-95"
              >
                {saving ? "Criando Tratativa..." : <><FaExclamationTriangle /> Oficializar Tratativa</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DO PDF DE ACOMPANHAMENTO */}
      <Modal 
        open={prontPdfOpen} 
        onClose={() => setProntPdfOpen(false)} 
        title={motorista?.chapa ? `Prontuário Preventivo — Motorista ${String(motorista.chapa)}` : "Visualizador de Prontuário"}
      >
        {!prontPdfUrl ? (
          <div className="p-10 text-center text-slate-500 font-bold bg-white">Nenhum documento gerado para exibir.</div>
        ) : (
          <div className="w-full bg-slate-200" style={{ height: "80vh" }}>
            <iframe title="Visualizador de PDF" src={prontPdfUrl} className="w-full h-full border-none bg-white" />
          </div>
        )}
      </Modal>

    </div>
  );
}
