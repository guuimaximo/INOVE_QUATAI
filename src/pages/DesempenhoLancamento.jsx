// src/pages/DesempenhoLancamento.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CampoMotorista from "../components/CampoMotorista";
import CampoPrefixo from "../components/CampoPrefixo";
import { useAuth } from "../context/AuthContext";
import { FaTimes } from "react-icons/fa";

/**
 * ✅ ATUALIZAÇÃO IMPORTANTE (conforme seu DesempenhoDieselAgente):
 * - REMOVIDO: geração de prontuário via API Python (/relatorios/gerar)
 * - AGORA: gera prontuário via GitHub Actions (ordem-acompanhamento.yml)
 *   exatamente como no seu Agente Diesel:
 *   1) cria acompanhamento_lotes
 *   2) cria acompanhamento_lote_itens (1 item)
 *   3) dispatch workflow WF_ACOMP com ordem_batch_id + qtd
 *   4) faz polling no relatorios_gerados e/ou Storage para abrir o PDF
 */

// =============================================================================
// CONFIG (GitHub Actions) — IGUAL AO AGENTE
// =============================================================================
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

function Segmented({ value, onChange, disabled }) {
  return (
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange(DESTINOS.ACOMP)}
        disabled={disabled}
        className={[
          "px-4 py-2 rounded-xl text-sm font-semibold transition",
          value === DESTINOS.ACOMP ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
          disabled ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        Acompanhamento
      </button>
      <button
        type="button"
        onClick={() => onChange(DESTINOS.TRAT)}
        disabled={disabled}
        className={[
          "px-4 py-2 rounded-xl text-sm font-semibold transition",
          value === DESTINOS.TRAT ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50",
          disabled ? "opacity-60 cursor-not-allowed" : "",
        ].join(" ")}
      >
        Tratativas
      </button>
    </div>
  );
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} role="button" tabIndex={0} aria-label="Fechar" />
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6">
        <div className="w-full max-w-6xl">
          <div
            className="rounded-2xl border border-slate-200/70 bg-white shadow-[0_25px_90px_rgba(0,0,0,0.25)] overflow-hidden"
            style={{ maxHeight: "calc(100vh - 24px)" }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 truncate">{title}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <FaTimes />
                Fechar
              </button>
            </div>

            <div className="p-4 overflow-auto" style={{ maxHeight: "calc(100vh - 24px - 52px)" }}>
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE
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
  // TRATATIVA (mantive do seu fluxo anterior)
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
  // ✅ PRONTUÁRIO (ACOMP) — AGORA IGUAL AO AGENTE DIESEL
  // - cria lote
  // - cria item do lote
  // - dispatch workflow ordem-acompanhamento.yml
  // - polling relatorios_gerados e abre PDF
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

          // esses campos podem ser nulos no manual (script deve aguentar)
          linha_mais_rodada: null,
          km_percorrido: 0,
          combustivel_consumido: 0,
          kml_realizado: 0,
          kml_meta: 0,
          combustivel_desperdicado: 0,

          extra: {
            motorista_nome: nome,
            origem: "DESPENHO_LANCAMENTO_ACOMP",
            tipo: TIPO_PRONTUARIO,
          },
        },
      ]);
      if (errI) throw errI;

      // 3) dispatch workflow (igual ao agente)
      await dispatchGitHubWorkflow(WF_ACOMP, {
        ordem_batch_id: String(lote.id),
        qtd: "1",
      });

      // 4) polling — tenta achar o relatório gerado e abrir PDF
      const found = await pollFindProntuario({ chapa, loteId: lote.id, maxTries: 28, intervalMs: 2500 });

      if (!found?.url) {
        throw new Error(
          `Workflow disparado (lote #${lote.id}), mas não encontrei o PDF no relatorios_gerados ainda. Tente atualizar em 1–2 min.`
        );
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
  // ✅ LANÇAR (ACOMP minimal vs TRAT full)
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
      // ✅ ACOMPANHAMENTO (minimal)
      // ==========================================================
      if (destino === DESTINOS.ACOMP) {
        const chapaOuNome = String(motorista?.chapa || motorista?.nome || "").trim();
        if (!chapaOuNome) throw new Error("Informe o motorista.");
        if (!String(motivoFinal || "").trim()) throw new Error("Informe o motivo.");
        if (!String(observacaoInicial || "").trim()) throw new Error("Informe a observação.");

        // 1) histórico do lançamento (diesel_lancamentos)
        const payloadLancamento = {
          motorista_chapa: chapa || null,
          motorista_nome: nomeMotorista,
          prefixo: null,
          linha: null,
          cluster: null,

          destino: DESTINOS.ACOMP,
          prioridade: null,

          motivo: motivoFinal,
          observacao_inicial: String(observacaoInicial || "").trim(),
          periodo_inicio: null,
          periodo_fim: null,

          dias_monitoramento: Number(diasMonitoramento) || 10,
          kml_meta: null,

          evidencias_urls: [],

          meritocracia: {},
          resumo_totais: { dias: 0, km: 0, litros: 0, kml: 0 },
          resumo_dias: [],
          resumo_veiculos: [],

          lancado_por_login: lancadorLogin,
          lancado_por_nome: lancadorNome,
          lancado_por_usuario_id: lancadorIdNum ? String(lancadorIdNum) : null,

          metadata: {
            origem: "LANCAMENTO_MINIMAL_ACOMP",
            motorista_ref: chapaOuNome,
          },
        };

        const { data: lanc, error: eL } = await supabase
          .from("diesel_lancamentos")
          .insert(payloadLancamento)
          .select("id")
          .single();
        if (eL) throw eL;

        // 2) cria acompanhamento
        const payloadAcomp = {
          motorista_chapa: chapa || null,
          motorista_nome: nomeMotorista,
          motivo: motivoFinal,
          status: "A_SER_ACOMPANHADO",
          dias_monitoramento: Number(diasMonitoramento),

          dt_inicio: new Date().toISOString().slice(0, 10),
          dt_inicio_monitoramento: null,
          dt_fim_planejado: null,
          dt_fim_real: null,

          kml_inicial: null,
          kml_meta: null,
          kml_final: null,

          observacao_inicial: String(observacaoInicial || "").trim(),
          evidencias_urls: [],

          instrutor_login: null,
          instrutor_nome: null,
          instrutor_id: null,

          tratativa_id: null,
          lancamento_id: lanc.id,

          metadata: {
            origem: "LANCAMENTO_MINIMAL_ACOMP",
            lancado_por_login: lancadorLogin,
            lancado_por_nome: lancadorNome,
            lancado_por_usuario_id: lancadorIdNum,
          },
        };

        const { data: acomp, error: eA } = await supabase
          .from("diesel_acompanhamentos")
          .insert(payloadAcomp)
          .select("id")
          .single();
        if (eA) throw eA;

        // 3) evento inicial
        const payloadEvento = {
          acompanhamento_id: acomp.id,
          tipo: "LANCAMENTO",
          observacoes: `${motivoFinal}\n\n${String(observacaoInicial || "").trim()}`,
          evidencias_urls: [],

          kml: null,
          periodo_inicio: null,
          periodo_fim: null,

          criado_por_login: lancadorLogin,
          criado_por_nome: lancadorNome,
          criado_por_id: isUuid(user?.id) ? user.id : null,

          extra: {
            lancamento_id: lanc.id,
            origem: "LANCAMENTO_MINIMAL_ACOMP",
          },
        };

        const { error: eE } = await supabase.from("diesel_acompanhamento_eventos").insert(payloadEvento);
        if (eE) throw eE;

        setOkMsg("Acompanhamento lançado. Gerando prontuário...");

        // ✅ gera prontuário pelo mesmo método do Agente
        await gerarProntuarioAcomp();

        if (!mountedRef.current) return;
        setOkMsg("Acompanhamento lançado e prontuário gerado.");

        return;
      }

      // ==========================================================
      // ✅ TRATATIVA (full)
      // ==========================================================
      const ini = String(periodoInicio || "").trim();
      const fim = String(periodoFim || "").trim();

      if (!String(prefixo || "").trim()) throw new Error("Informe o prefixo.");
      if (!String(linha || "").trim()) throw new Error("Informe a linha.");
      if (!String(cluster || "").trim()) throw new Error("Cluster não encontrado no prefixo.");
      if (!ini || !fim) throw new Error("Informe o período (início e fim).");
      if (!String(motivoFinal || "").trim()) throw new Error("Informe o motivo.");
      if (!evidTrat?.length) throw new Error("Anexe pelo menos 1 evidência.");

      // Upload evidências (TRATATIVA)
      const folder = `diesel/tratativas/${chapa || "sem_chapa"}/lancamento_${Date.now()}`;
      const uploaded = await uploadManyToStorage({
        files: evidTrat,
        bucket: "diesel",
        folder,
      });

      const evidenciasUrls = uploaded.map((u) => u.publicUrl).filter(Boolean);
      const obsInit = String(observacaoInicial || "").trim() || null;

      // 1) diesel_lancamentos
      const payloadLancamento = {
        motorista_chapa: chapa || null,
        motorista_nome: nomeMotorista,
        prefixo: String(prefixo || "").trim(),
        linha: String(linha || "").trim(),
        cluster: String(cluster || "").trim(),

        destino: DESTINOS.TRAT,
        prioridade: prioridadeTratativa,

        motivo: motivoFinal,
        observacao_inicial: obsInit,
        periodo_inicio: ini || null,
        periodo_fim: fim || null,

        dias_monitoramento: Number(diasMonitoramento) || 10,
        kml_meta: null,

        evidencias_urls: evidenciasUrls,

        meritocracia: {},
        resumo_totais: { dias: 0, km: 0, litros: 0, kml: 0 },
        resumo_dias: [],
        resumo_veiculos: [],

        lancado_por_login: lancadorLogin,
        lancado_por_nome: lancadorNome,
        lancado_por_usuario_id: lancadorIdNum ? String(lancadorIdNum) : null,

        metadata: {
          lancamento_periodo_inicio: ini || null,
          lancamento_periodo_fim: fim || null,
        },
      };

      const { data: lanc, error: eL } = await supabase
        .from("diesel_lancamentos")
        .insert(payloadLancamento)
        .select("id")
        .single();
      if (eL) throw eL;

      // 2) diesel_tratativas
      const descricaoBase = obsInit ? `${motivoFinal}\n\n${obsInit}` : motivoFinal;

      const payloadTratativa = {
        motorista_chapa: chapa || null,
        motorista_nome: nomeMotorista,

        origem: "DIESEL",
        tipo_ocorrencia: "DIESEL_KML",
        prioridade: prioridadeTratativa,
        status: "Pendente",

        descricao: descricaoBase,

        prefixo: String(prefixo || "").trim(),
        linha: String(linha || "").trim(),
        cluster: String(cluster || "").trim(),

        periodo_inicio: ini || null,
        periodo_fim: fim || null,

        evidencias_urls: evidenciasUrls,

        lancamento_id: lanc.id,

        metadata: {
          origem: "LANCAMENTO_MANUAL",
          lancado_por_login: lancadorLogin,
          lancado_por_nome: lancadorNome,
          lancado_por_usuario_id: lancadorIdNum ? String(lancadorIdNum) : null,
        },
      };

      const { data: trat, error: eT } = await supabase
        .from("diesel_tratativas")
        .insert(payloadTratativa)
        .select("id")
        .single();
      if (eT) throw eT;

      // 3) diesel_tratativas_detalhes (timeline inicial)
      await supabase.from("diesel_tratativas_detalhes").insert({
        tratativa_id: trat.id,
        acao_aplicada: "ABERTURA_MANUAL",
        observacoes: descricaoBase,
        imagem_tratativa: null,
        anexo_tratativa: null,
        tratado_por_login: lancadorLogin,
        tratado_por_nome: lancadorNome,
        tratado_por_id: isUuid(user?.id) ? user.id : null,
        extra: { evidencias_urls: evidenciasUrls, lancamento_id: lanc.id },
      });

      setOkMsg("Tratativa criada com sucesso. Redirecionando...");
      setTimeout(() => {
        navigate("/desempenho-diesel/tratativas");
      }, 300);

      return;
    } catch (err) {
      console.error(err);
      setErrMsg(err?.message || "Erro ao lançar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Desempenho Diesel</h1>
          <p className="text-sm text-slate-600 mt-1">
            Lançamento manual com interface profissional: <b>Acompanhamento</b> (essencial) ou <b>Tratativas</b>{" "}
            (completo).
          </p>
        </div>

        <Segmented value={destino} onChange={setDestino} disabled={saving || prontLoading} />
      </div>

      {/* Alerts */}
      {errMsg && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errMsg}</div>
      )}
      {okMsg && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {okMsg}
        </div>
      )}

      {/* ================================
          ACOMPANHAMENTO (minimal)
         ================================ */}
      {destino === DESTINOS.ACOMP && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Form */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-sm font-bold text-slate-900">Acompanhamento — Essencial</div>
              <div className="text-xs text-slate-500 mt-1">
                Para acompanhamento você preenche só: <b>Motorista</b>, <b>Motivo</b> e <b>Observação</b>. O restante
                vem do prontuário.
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <CampoMotorista value={motorista} onChange={setMotorista} label="Motorista" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1 font-semibold">Motivo</label>
                <select
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={saving || prontLoading}
                >
                  {MOTIVOS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                {motivo === "Outro" && (
                  <input
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                    value={motivoOutro}
                    onChange={(e) => setMotivoOutro(e.target.value)}
                    placeholder="Descreva o motivo..."
                    disabled={saving || prontLoading}
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-slate-700 mb-1 font-semibold">Observação</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[140px]"
                  value={observacaoInicial}
                  onChange={(e) => setObservacaoInicial(e.target.value)}
                  disabled={saving || prontLoading}
                  placeholder="Contexto do caso, ponto observado, orientação inicial..."
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                onClick={limparTudo}
                disabled={saving || prontLoading}
              >
                Limpar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!String(motorista?.chapa || "").trim() || saving || prontLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={gerarProntuarioAcomp}
                  title="Gera/Regera o prontuário (PDF) via workflow (ordem-acompanhamento.yml)"
                >
                  {prontLoading ? "Gerando..." : "Gerar prontuário (PDF)"}
                </button>

                <button
                  type="button"
                  disabled={!prontoAcomp || saving || prontLoading}
                  className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
                  onClick={lancar}
                  title="Lança acompanhamento e solicita prontuário automaticamente"
                >
                  {saving ? "Lançando..." : "Lançar Acompanhamento"}
                </button>
              </div>
            </div>
          </div>

          {/* Side status */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <div className="text-sm font-bold text-slate-900">Prontuário</div>
              <div className="text-xs text-slate-500 mt-1">Geração via workflow + abertura do PDF.</div>
            </div>

            <div className="p-5">
              {(prontLoading || prontErr || prontRow) ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs text-slate-600">
                      Tipo: <b>{TIPO_PRONTUARIO}</b>
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1">
                      {prontLoading ? "Gerando prontuário..." : prontErr ? "Falhou" : "Pronto"}
                    </div>

                    {prontErr && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {prontErr}
                      </div>
                    )}

                    {!!prontRow && (
                      <div className="mt-2 text-xs text-slate-600">
                        Status: <b>{String(prontRow.status || "")}</b>
                        {prontRow?.id ? <span> • #{prontRow.id}</span> : null}
                      </div>
                    )}
                  </div>

                  {prontPdfUrl && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setProntPdfOpen(true)}
                      >
                        Abrir
                      </button>
                      <a
                        href={prontPdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Nova aba
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  Clique em <b>Gerar prontuário (PDF)</b> para disparar o workflow e abrir o documento.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================
          TRATATIVAS (full)
         ================================ */}
      {destino === DESTINOS.TRAT && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <div className="text-sm font-bold text-slate-900">Tratativas — Completo</div>
            <div className="text-xs text-slate-500 mt-1">
              Aqui você preenche tudo (prefixo/linha/cluster/período/evidências). O sistema salva o lançamento e cria a
              tratativa na central.
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Prioridade */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Prioridade</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                value={prioridadeTratativa}
                onChange={(e) => setPrioridadeTratativa(e.target.value)}
                disabled={saving}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-slate-500">Define SLA na Central de Tratativas.</div>
            </div>

            {/* Motorista */}
            <div className="md:col-span-2">
              <CampoMotorista value={motorista} onChange={setMotorista} label="Motorista" />
            </div>

            {/* Prefixo */}
            <div className="md:col-span-2">
              <CampoPrefixo value={prefixo} onChange={setPrefixo} onChangeCluster={setCluster} disabled={saving} label="Prefixo" />
            </div>

            {/* Linha */}
            <div>
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Linha</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                value={linha}
                onChange={(e) => setLinha(e.target.value)}
                disabled={refsLoading || saving}
              >
                <option value="">{refsLoading ? "Carregando..." : "Selecione a linha"}</option>
                {linhasOpt.map((l) => (
                  <option key={l.id || l.codigo} value={String(l.codigo || "").trim()}>
                    {String(l.codigo || "").trim()} — {String(l.descricao || "").trim()}
                  </option>
                ))}
              </select>
            </div>

            {/* Cluster */}
            <div>
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Cluster (automático)</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50"
                value={cluster}
                readOnly
                placeholder="Selecione um prefixo"
              />
            </div>

            {/* Período */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Período analisado do KM/L</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  disabled={saving}
                />
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Motivo */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Motivo</label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                disabled={saving}
              >
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              {motivo === "Outro" && (
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
                  value={motivoOutro}
                  onChange={(e) => setMotivoOutro(e.target.value)}
                  placeholder="Descreva o motivo..."
                  disabled={saving}
                />
              )}
            </div>

            {/* Observação */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Observação inicial</label>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3 py-2 min-h-[120px]"
                value={observacaoInicial}
                onChange={(e) => setObservacaoInicial(e.target.value)}
                disabled={saving}
                placeholder="Detalhes, contexto, orientação, etc..."
              />
            </div>

            {/* Evidências */}
            <div className="md:col-span-4">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Evidências (obrigatório)</label>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="file" multiple onChange={addFilesTrat} disabled={saving} />
                  <div className="text-xs text-slate-500">
                    {evidTrat.length ? `${evidTrat.length} arquivo(s)` : "Nenhum arquivo selecionado"}
                  </div>
                </div>

                {evidTrat.length > 0 && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {evidTrat.map((f, idx) => (
                      <div
                        key={`${f.name}_${f.size}_${f.lastModified}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-800 truncate" title={f.name}>
                            {f.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {(Number(f.size || 0) / 1024 / 1024).toFixed(2)} MB • {f.type || "arquivo"}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-red-700 hover:underline"
                          onClick={() => removeFileTrat(idx)}
                          disabled={saving}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              onClick={limparTudo}
              disabled={saving || prontLoading}
            >
              Limpar
            </button>

            <button
              type="button"
              disabled={!prontoTrat || saving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
              onClick={lancar}
              title="Cria tratativa Diesel e envia para a Central"
            >
              {saving ? "Criando..." : "Criar Tratativa"}
            </button>
          </div>
        </div>
      )}

      {/* Modal PDF */}
      <Modal
        open={prontPdfOpen}
        onClose={() => setProntPdfOpen(false)}
        title={motorista?.chapa ? `Prontuário — Motorista ${String(motorista.chapa)}` : "Prontuário — PDF"}
      >
        {!prontPdfUrl ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
            Nenhum PDF disponível para exibir.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Viewer (Public URL)
              </div>
              <a
                href={prontPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                title="Abrir em nova aba"
              >
                Abrir
              </a>
            </div>

            <div className="bg-slate-50/70" style={{ height: "calc(100vh - 24px - 52px - 140px)" }}>
              <iframe title="ProntuarioPDF" src={prontPdfUrl} className="w-full h-full" style={{ background: "transparent" }} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
