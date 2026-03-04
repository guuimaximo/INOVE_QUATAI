// src/pages/DesempenhoLancamento.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import CampoMotorista from "../components/CampoMotorista";
import CampoPrefixo from "../components/CampoPrefixo";
import { useAuth } from "../context/AuthContext";
import { FaTimes } from "react-icons/fa";

const API_BASE = "https://agentediesel.onrender.com"; // ✅ API Python

const TIPO_PRONTUARIO = "prontuarios_acompanhamento";
const BUCKET_RELATORIOS = "relatorios";

const MOTIVOS = ["KM/L abaixo da meta", "Tendência de queda", "Comparativo com cluster", "Outro"];

const DESTINOS = {
  ACOMP: "ACOMPANHAMENTO",
  TRAT: "TRATATIVA",
};

const PRIORIDADES = ["Gravíssima", "Alta", "Média", "Baixa"];

/* =========================
   HELPERS
========================= */
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

function getFolderFromPath(p) {
  const parts = normalizePath(p).split("/").filter(Boolean);
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/");
}

async function makeUrlFromPath(bucket, path, expiresIn = 3600) {
  const clean = normalizePath(path);

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(clean, expiresIn);
  if (!error && data?.signedUrl) return { url: data.signedUrl, mode: "signed", path: clean };

  const pub = supabase.storage.from(bucket).getPublicUrl(clean);
  return { url: pub?.data?.publicUrl, mode: "public", path: clean };
}

function parseISODateParts(iso) {
  try {
    if (!iso) return null;
    const s = String(iso).trim();
    const [yStr, mStr] = s.split("-");
    if (!yStr || yStr.length !== 4) return null;
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    if (!y || !m) return null;
    if (y < 2000 || y > 2100) return null;
    if (m < 1 || m > 12) return null;
    return { ano: y, mes: m };
  } catch {
    return null;
  }
}

function toISODate(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
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
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Fechar"
      />
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

/**
 * ✅ RESUMO (premiacao_diaria via agentediesel)
 * Esperado:
 *  - totais: { dias, km, litros, kml }
 *  - dia: [{ dia, km, litros, kml, linhas:[...], veiculos:[...] }]
 *  - veiculos (opcional)
 */
async function fetchResumoPremiacao({ chapa, inicio, fim }) {
  const qs = new URLSearchParams({
    chapa: String(chapa || "").trim(),
    inicio: String(inicio || "").trim(),
    fim: String(fim || "").trim(),
  }).toString();

  const r = await fetch(`${API_BASE}/premiacao/resumo?${qs}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail || j?.error || "Erro ao consultar premiação.");
  return j;
}

/**
 * ✅ MERITOCRACIA
 * Front chama:
 *  GET /premiacao/meritocracia?motorista=...&mes=...&ano=...
 */
async function fetchMeritocracia({ chapa, mes, ano }) {
  const qs = new URLSearchParams({
    motorista: String(chapa || "").trim(),
    mes: String(mes || "").trim(),
    ano: String(ano || "").trim(),
  }).toString();

  const r = await fetch(`${API_BASE}/premiacao/meritocracia?${qs}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.detail || j?.error || "Erro ao consultar meritocracia.");
  return j;
}

export default function DesempenhoLancamento() {
  const navigate = useNavigate();
  const { user } = useAuth(); // ✅ corrigido (antes estava errado)

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // =============================
  // Top (tabs)
  // =============================
  const [destino, setDestino] = useState(DESTINOS.ACOMP);

  // =============================
  // Shared (motorista, motivo, obs)
  // =============================
  const [motorista, setMotorista] = useState({ chapa: "", nome: "" });
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [motivoOutro, setMotivoOutro] = useState("");
  const [observacaoInicial, setObservacaoInicial] = useState("");

  const motivoFinal = motivo === "Outro" ? motivoOutro.trim() : motivo;

  // =============================
  // TRATATIVA (full fields)
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
  // Data + UI
  // =============================
  const diasMonitoramento = 10;

  const [kmlMeta, setKmlMeta] = useState("");
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaErr, setMetaErr] = useState("");
  const [meritRow, setMeritRow] = useState(null);

  const [resumoLoading, setResumoLoading] = useState(false);
  const [resumoErr, setResumoErr] = useState("");
  const [resumoTotais, setResumoTotais] = useState({ dias: 0, km: 0, litros: 0, kml: 0 });
  const [resumoVeiculos, setResumoVeiculos] = useState([]);
  const [resumoDias, setResumoDias] = useState([]);

  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // =============================
  // Prontuário (viewer)
  // =============================
  const [prontLoading, setProntLoading] = useState(false);
  const [prontErr, setProntErr] = useState("");
  const [prontRow, setProntRow] = useState(null);
  const [prontUrlsLoading, setProntUrlsLoading] = useState(false);
  const [prontPdfUrl, setProntPdfUrl] = useState(null);
  const [prontPdfPathUsed, setProntPdfPathUsed] = useState(null);
  const [prontPdfOpen, setProntPdfOpen] = useState(false);

  // =============================
  // Load refs (linhas) for Tratativa
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
  // TRATATIVA: resumo (premiacao_diaria)
  // Só roda quando destino=TRAT e tem período
  // =============================
  useEffect(() => {
    if (destino !== DESTINOS.TRAT) return;

    const chapa = String(motorista?.chapa || "").trim();
    const ini = String(periodoInicio || "").trim();
    const fim = String(periodoFim || "").trim();

    if (!chapa || !ini || !fim) {
      setResumoErr("");
      setResumoLoading(false);
      setResumoTotais({ dias: 0, km: 0, litros: 0, kml: 0 });
      setResumoVeiculos([]);
      setResumoDias([]);
      return;
    }

    let alive = true;
    (async () => {
      setResumoLoading(true);
      setResumoErr("");
      try {
        const j = await fetchResumoPremiacao({ chapa, inicio: ini, fim });
        if (!alive) return;

        setResumoTotais(j?.totais || { dias: 0, km: 0, litros: 0, kml: 0 });
        setResumoVeiculos(Array.isArray(j?.veiculos) ? j.veiculos : []);
        setResumoDias(Array.isArray(j?.dia) ? j.dia : []);
      } catch (e) {
        if (!alive) return;
        setResumoTotais({ dias: 0, km: 0, litros: 0, kml: 0 });
        setResumoVeiculos([]);
        setResumoDias([]);
        setResumoErr(e?.message || "Erro ao buscar resumo.");
      } finally {
        if (!alive) return;
        setResumoLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [destino, motorista?.chapa, periodoInicio, periodoFim]);

  // =============================
  // TRATATIVA: meritocracia usa mês do FINAL (periodoFim)
  // =============================
  useEffect(() => {
    if (destino !== DESTINOS.TRAT) return;

    const chapa = String(motorista?.chapa || "").trim();
    const parts = parseISODateParts(String(periodoFim || "").trim());

    if (!chapa || !parts?.mes || !parts?.ano) {
      setMetaErr("");
      setMetaLoading(false);
      setMeritRow(null);
      setKmlMeta("");
      return;
    }

    let alive = true;
    (async () => {
      setMetaLoading(true);
      setMetaErr("");
      try {
        const j = await fetchMeritocracia({ chapa, mes: parts.mes, ano: parts.ano });
        if (!alive) return;

        const item = j?.item || j?.data || j?.row || null;
        setMeritRow(item);

        const meta = item?.kml_meta_linha_mais_horas ?? item?.kml_meta ?? null;
        if (meta !== null && meta !== undefined && String(meta).trim() !== "") {
          setKmlMeta(String(meta));
        } else {
          setKmlMeta("");
        }
      } catch (e) {
        if (!alive) return;
        setMeritRow(null);
        setMetaErr(e?.message || "Erro ao buscar meta (meritocracia).");
        setKmlMeta("");
      } finally {
        if (!alive) return;
        setMetaLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [destino, motorista?.chapa, periodoFim]);

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

    setKmlMeta("");
    setMetaLoading(false);
    setMetaErr("");
    setMeritRow(null);

    setResumoLoading(false);
    setResumoErr("");
    setResumoTotais({ dias: 0, km: 0, litros: 0, kml: 0 });
    setResumoVeiculos([]);
    setResumoDias([]);

    setSaving(false);
    setErrMsg("");
    setOkMsg("");

    setProntLoading(false);
    setProntErr("");
    setProntRow(null);
    setProntUrlsLoading(false);
    setProntPdfUrl(null);
    setProntPdfPathUsed(null);
    setProntPdfOpen(false);
  }

  // Se mudar para ACOMP, limpa campos “pesados”
  useEffect(() => {
    setErrMsg("");
    setOkMsg("");
    setProntErr("");
    setProntRow(null);
    setProntPdfUrl(null);
    setProntPdfPathUsed(null);
    setProntPdfOpen(false);
  }, [destino]);

  // =====================================================================================
  // ✅ PRONTUÁRIO (ACOMP): gera minimalista
  // - 1ª tentativa: { tipo, motorista, janela_dias }
  // - fallback: manda { periodo_inicio, periodo_fim } (últimos 30 dias) caso API exija
  // =====================================================================================
  async function gerarProntuarioAcomp() {
    if (prontLoading) return;

    setProntLoading(true);
    setProntErr("");
    setProntRow(null);
    setProntPdfUrl(null);
    setProntPdfPathUsed(null);

    try {
      const chapaOuNome = String(motorista?.chapa || motorista?.nome || "").trim();
      if (!chapaOuNome) throw new Error("Informe o motorista.");

      // ✅ payload minimalista
      let payload = {
        tipo: TIPO_PRONTUARIO,
        motorista: chapaOuNome,
        janela_dias: 30,
      };

      let r = await fetch(`${API_BASE.replace(/\/$/, "")}/relatorios/gerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = await r.json().catch(() => ({}));

      // fallback: se API reclamar de período, manda últimos 30 dias
      if (!r.ok) {
        const msg = data?.error || data?.detail || "";
        const precisaPeriodo =
          String(msg).toLowerCase().includes("período") ||
          String(msg).toLowerCase().includes("periodo") ||
          String(msg).toLowerCase().includes("inicio") ||
          String(msg).toLowerCase().includes("fim");

        if (precisaPeriodo) {
          const fim = toISODate(new Date());
          const ini = addDaysISO(fim, -30);

          payload = {
            tipo: TIPO_PRONTUARIO,
            periodo_inicio: ini,
            periodo_fim: fim,
            motorista: chapaOuNome,
            linha: null,
            veiculo: null,
            cluster: null,
          };

          r = await fetch(`${API_BASE.replace(/\/$/, "")}/relatorios/gerar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          data = await r.json().catch(() => ({}));
        }
      }

      if (!r.ok) {
        const detail = data?.error || data?.detail || `HTTP ${r.status}`;
        throw new Error(detail);
      }

      if (!data?.report_id) throw new Error("API não retornou report_id do prontuário.");

      // busca registro (se existir)
      const { data: row, error } = await supabase
        .from("relatorios_gerados")
        .select(
          "id, created_at, tipo, status, periodo_inicio, periodo_fim, arquivo_path, arquivo_nome, mime_type, tamanho_bytes, erro_msg"
        )
        .eq("id", data.report_id)
        .single();

      if (error || !row) {
        // ainda assim tenta abrir por path padrão (caso seu worker não grave a linha)
        // mas aqui preferi falhar com mensagem clara
        throw new Error("Não consegui localizar o registro em relatorios_gerados.");
      }

      if (!mountedRef.current) return;
      setProntRow(row);

      setProntUrlsLoading(true);

      const arquivoPath = normalizePath(row?.arquivo_path || "");
      let pdfPath = arquivoPath;

      const folder = getFolderFromPath(arquivoPath);
      if (!/\.pdf$/i.test(pdfPath)) {
        // path padrão
        pdfPath = folder ? `${folder}/${chapaOuNome}_Prontuario.pdf` : `${chapaOuNome}_Prontuario.pdf`;
      }

      let resPdf = await makeUrlFromPath(BUCKET_RELATORIOS, pdfPath, 3600);
      if (!resPdf?.url && folder) {
        const alt = `${folder}/Prontuario.pdf`;
        resPdf = await makeUrlFromPath(BUCKET_RELATORIOS, alt, 3600);
      }

      if (!resPdf?.url) {
        throw new Error(`Não encontrei PDF do prontuário no bucket '${BUCKET_RELATORIOS}'. Path tentado: ${pdfPath}`);
      }

      if (!mountedRef.current) return;
      setProntPdfUrl(resPdf.url);
      setProntPdfPathUsed(resPdf.path);
      setProntPdfOpen(true);
    } catch (e) {
      if (!mountedRef.current) return;
      setProntErr(String(e?.message || e));
    } finally {
      if (mountedRef.current) {
        setProntUrlsLoading(false);
        setProntLoading(false);
      }
    }
  }

  // =====================================================================================
  // ✅ Lançar (ACOMP minimal vs TRAT full)
  // =====================================================================================
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

        // 4) gera prontuário automático (minimal) + salva report id no metadata
        let prontReportId = null;
        try {
          const payloadPront = {
            tipo: TIPO_PRONTUARIO,
            motorista: String(motorista?.chapa || motorista?.nome || "").trim(),
            janela_dias: 30,
          };

          let rPr = await fetch(`${API_BASE.replace(/\/$/, "")}/relatorios/gerar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadPront),
          });

          let jPr = await rPr.json().catch(() => ({}));

          if (!rPr.ok) {
            const msg = jPr?.error || jPr?.detail || "";
            const precisaPeriodo =
              String(msg).toLowerCase().includes("período") ||
              String(msg).toLowerCase().includes("periodo") ||
              String(msg).toLowerCase().includes("inicio") ||
              String(msg).toLowerCase().includes("fim");

            if (precisaPeriodo) {
              const fim = toISODate(new Date());
              const ini = addDaysISO(fim, -30);

              const payloadFallback = {
                tipo: TIPO_PRONTUARIO,
                periodo_inicio: ini,
                periodo_fim: fim,
                motorista: String(motorista?.chapa || motorista?.nome || "").trim(),
                linha: null,
                veiculo: null,
                cluster: null,
              };

              rPr = await fetch(`${API_BASE.replace(/\/$/, "")}/relatorios/gerar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payloadFallback),
              });

              jPr = await rPr.json().catch(() => ({}));
            }
          }

          if (!rPr.ok) throw new Error(jPr?.error || jPr?.detail || `Erro ao gerar prontuário (HTTP ${rPr.status})`);

          prontReportId = jPr?.report_id ? String(jPr.report_id) : null;

          if (prontReportId) {
            await supabase
              .from("diesel_acompanhamentos")
              .update({
                metadata: {
                  ...payloadAcomp.metadata,
                  prontuario_report_id: prontReportId,
                },
              })
              .eq("id", acomp.id);

            await supabase.from("diesel_acompanhamento_eventos").insert({
              acompanhamento_id: acomp.id,
              tipo: "PRONTUARIO_GERADO",
              observacoes: `Prontuário gerado automaticamente. Report ID: ${prontReportId}`,
              evidencias_urls: [],
              criado_por_login: lancadorLogin,
              criado_por_nome: lancadorNome,
              criado_por_id: isUuid(user?.id) ? user.id : null,
              extra: { report_id: prontReportId, lancamento_id: lanc.id },
            });
          }
        } catch (ePr) {
          await supabase.from("diesel_acompanhamento_eventos").insert({
            acompanhamento_id: acomp.id,
            tipo: "PRONTUARIO_ERRO",
            observacoes: `Falha ao gerar prontuário automaticamente: ${String(ePr?.message || ePr)}`,
            evidencias_urls: [],
            criado_por_login: lancadorLogin,
            criado_por_nome: lancadorNome,
            criado_por_id: isUuid(user?.id) ? user.id : null,
            extra: { lancamento_id: lanc.id },
          });

          setOkMsg("Acompanhamento lançado. O prontuário falhou — você pode tentar gerar manualmente.");
        }

        if (!okMsg) setOkMsg("Acompanhamento lançado com sucesso.");

        // se quiser abrir o pdf automaticamente, chama gerarProntuarioAcomp (que também abre modal)
        // (somente se não estiver em loading e se não houve erro)
        try {
          await gerarProntuarioAcomp();
        } catch {
          // silencioso: já mostramos mensagens de prontuário no card
        }

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

      const meritSnap = meritRow
        ? {
            motorista: meritRow?.motorista ?? null,
            linha_com_mais_horas: meritRow?.linha_com_mais_horas ?? null,
            kml_linha_com_mais_horas: meritRow?.kml_linha_com_mais_horas ?? null,
            meta_linha: meritRow?.meta_linha ?? null,
            kml_meta_linha_mais_horas: meritRow?.kml_meta_linha_mais_horas ?? null,
          }
        : {};

      const resumoTotaisSnap = resumoTotais || { dias: 0, km: 0, litros: 0, kml: 0 };
      const resumoDiasSnap = Array.isArray(resumoDias) ? resumoDias : [];
      const resumoVeiculosSnap = Array.isArray(resumoVeiculos) ? resumoVeiculos : [];

      // 1) diesel_lancamentos
      const payloadLancamento = {
        motorista_chapa: chapa,
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
        kml_meta: String(kmlMeta || "").trim() ? safeNumber(kmlMeta) : null,

        evidencias_urls: evidenciasUrls,

        meritocracia: meritSnap,
        resumo_totais: resumoTotaisSnap,
        resumo_dias: resumoDiasSnap,
        resumo_veiculos: resumoVeiculosSnap,

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
        motorista_chapa: chapa,
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
          meritocracia: meritSnap,
          resumo_totais: resumoTotaisSnap,
          resumo_dias: resumoDiasSnap,
          resumo_veiculos: resumoVeiculosSnap,
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
                  disabled={!String(motorista?.chapa || motorista?.nome || "").trim() || saving || prontLoading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  onClick={gerarProntuarioAcomp}
                  title="Gera/Regera o prontuário (PDF) para este motorista"
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
              <div className="text-xs text-slate-500 mt-1">Status e abertura do PDF.</div>
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
                        {prontRow?.periodo_inicio || prontRow?.periodo_fim ? (
                          <>
                            {" "}
                            • {String(prontRow.periodo_inicio || "—")} → {String(prontRow.periodo_fim || "—")}
                          </>
                        ) : null}
                        {prontPdfPathUsed ? (
                          <div className="mt-1 text-[11px] text-slate-500 break-all">PDF path: {prontPdfPathUsed}</div>
                        ) : null}
                      </div>
                    )}

                    {prontUrlsLoading && <div className="mt-2 text-sm text-slate-700">Preparando arquivo do bucket…</div>}
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
                  Clique em <b>Gerar prontuário (PDF)</b> para abrir o documento.
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
              <CampoPrefixo
                value={prefixo}
                onChange={setPrefixo}
                onChangeCluster={setCluster}
                disabled={saving}
                label="Prefixo"
              />
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

            {/* Monitoramento */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">Tempo de monitoramento</label>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50"
                value={`${diasMonitoramento} dias`}
                readOnly
              />
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

            {/* Meta */}
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-700 mb-1 font-semibold">KM/L Meta (meritocracia)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-slate-50"
                  placeholder={metaLoading ? "Buscando..." : "—"}
                  value={kmlMeta}
                  readOnly
                />
                <div className="text-xs text-slate-500 whitespace-nowrap">
                  {metaLoading ? "Carregando..." : metaErr ? "Erro" : meritRow ? "OK" : "—"}
                </div>
              </div>
              {metaErr && <div className="mt-1 text-xs text-red-700">{metaErr}</div>}
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

            {/* Meritocracia card */}
            <div className="md:col-span-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Meritocracia (mês do PERÍODO FIM)</div>
                  <div className="text-xs text-slate-500">
                    {metaLoading ? "Consultando..." : metaErr ? "Erro" : meritRow ? "OK" : "—"}
                  </div>
                </div>

                {!meritRow && !metaLoading && !metaErr && (
                  <div className="mt-2 text-sm text-slate-600">
                    Informe a chapa e a data de fim do período para puxar a meritocracia do mês.
                  </div>
                )}

                {meritRow && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Chapa</div>
                      <div className="text-sm font-semibold text-slate-900">{meritRow?.motorista ?? "—"}</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Linha que mais trabalhou</div>
                      <div className="text-sm font-semibold text-slate-900">{meritRow?.linha_com_mais_horas ?? "—"}</div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">KM/L na linha</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {Number(meritRow?.kml_linha_com_mais_horas || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Meta da linha</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {Number(meritRow?.meta_linha || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                      <div className="text-xs text-slate-500">Meta do motorista</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {Number(meritRow?.kml_meta_linha_mais_horas || 0).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Resumo card */}
            <div className="md:col-span-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Resumo do período (premiação)</div>
                  <div className="text-xs text-slate-500">{resumoLoading ? "Consultando..." : resumoErr ? "Erro" : "OK"}</div>
                </div>

                {resumoErr ? (
                  <div className="mt-2 text-sm text-red-700">{resumoErr}</div>
                ) : (
                  <>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-2">
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">Dias</div>
                        <div className="text-sm font-semibold text-slate-900">{resumoTotais?.dias ?? 0}</div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">KM rodado</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {Number(resumoTotais?.km || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">Combustível</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {Number(resumoTotais?.litros || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                      <div className="rounded-xl bg-white border border-slate-200 p-3">
                        <div className="text-xs text-slate-500">KM/L (período)</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {Number(resumoTotais?.kml || 0).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                    </div>

                    {(resumoDias || []).length > 0 && (
                      <div className="mt-3 overflow-auto border border-slate-200 rounded-xl bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="text-left px-3 py-2">Dia</th>
                              <th className="text-left px-3 py-2">Linhas (no dia)</th>
                              <th className="text-left px-3 py-2">Veículos (no dia)</th>
                              <th className="text-right px-3 py-2">KM</th>
                              <th className="text-right px-3 py-2">Comb.</th>
                              <th className="text-right px-3 py-2">KM/L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumoDias.map((d, idx) => (
                              <tr key={`${d?.dia || idx}`} className="border-t border-slate-200">
                                <td className="px-3 py-2 whitespace-nowrap">{d?.dia || "—"}</td>
                                <td className="px-3 py-2">
                                  {Array.isArray(d?.linhas) ? d.linhas.join(", ") : d?.linha || "—"}
                                </td>
                                <td className="px-3 py-2">
                                  {Array.isArray(d?.veiculos) ? d.veiculos.join(", ") : d?.veiculo || "—"}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(d?.km || 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(d?.litros || 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(d?.kml || 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(resumoDias || []).length === 0 && (resumoVeiculos || []).length > 0 && (
                      <div className="mt-3 overflow-auto border border-slate-200 rounded-xl bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="text-left px-3 py-2">Veículo</th>
                              <th className="text-right px-3 py-2">Dias</th>
                              <th className="text-right px-3 py-2">KM</th>
                              <th className="text-right px-3 py-2">Comb.</th>
                              <th className="text-right px-3 py-2">KM/L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resumoVeiculos.map((v) => (
                              <tr key={v.veiculo} className="border-t border-slate-200">
                                <td className="px-3 py-2">{v.veiculo}</td>
                                <td className="px-3 py-2 text-right">{v.dias}</td>
                                <td className="px-3 py-2 text-right">
                                  {Number(v.km || 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(v.litros || 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {Number(v.kml || 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!resumoLoading &&
                      !resumoErr &&
                      String(motorista?.chapa || "").trim() &&
                      String(periodoInicio || "").trim() &&
                      String(periodoFim || "").trim() &&
                      (resumoDias || []).length === 0 &&
                      (resumoVeiculos || []).length === 0 && (
                        <div className="mt-2 text-sm text-slate-600">Nenhum dado encontrado para o período.</div>
                      )}
                  </>
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
                Viewer seguro (Signed URL)
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
              <iframe
                title="ProntuarioPDF"
                src={prontPdfUrl}
                className="w-full h-full"
                style={{ background: "transparent" }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
