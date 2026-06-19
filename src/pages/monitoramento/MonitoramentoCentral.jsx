import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCamera,
  FaCheckCircle,
  FaChartBar,
  FaCode,
  FaCalendarAlt,
  FaList,
  FaDownload,
  FaQuestionCircle,
  FaSearch,
  FaSortAmountDown,
  FaSortAmountUp,
  FaTimesCircle,
  FaTrash,
  FaWrench,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection, InoveStatCard } from "../../components/InovePage";

const PAGE_SIZE = 200;
const STATE_KEY = "inove.monitoramento.state.v1";
const VISUAL_COLUMNS = [
  "id",
  "created_at",
  "dt_evento",
  "data_hora_evento",
  "nome",
  "registro",
  "acao_prevista",
  "categoria",
  "categoria_biometrica",
  "score",
  "score_biometrico",
  "similaridade_arcface",
  "quantidade_rostos_camera",
  "img_cadastro_url",
  "img_camera_url",
  "prefixo",
  "veiculo",
  "codigo_cartao",
  "codigo_usuario",
  "prefixo_resolvido",
  "camera_enquadramento",
  "camera_recomendacao",
  "recomendacao_camera",
  "problemas_enquadramento_camera",
].join(", ");

const SUMMARY_COLUMNS =
  "dt_evento,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,total_rostos_camera,score_medio,score_medio_biometrico,score_medio_face_mesh,prefixos_distintos";
const PREFIX_COLUMNS =
  "dt_evento,prefixo,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,score_medio,score_medio_biometrico,score_medio_face_mesh,total_rostos_camera";

function readPersistedState() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STATE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writePersistedState(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // Ignora falha de storage; o app continua funcional.
  }
}

function applyMonitoramentoFilters(rows, { search, filtroAcao, filtroCategoria, sortField, sortAsc }) {
  let list = rows;
  if (filtroAcao) list = list.filter((r) => r.acao_prevista === filtroAcao);
  if (filtroCategoria) list = list.filter((r) => r.categoria === filtroCategoria);

  if (search?.trim()) {
    const q = search.toLowerCase();
    list = list.filter(
      (r) =>
        (r.nome || "").toLowerCase().includes(q) ||
        (r.codigo_cartao || "").includes(q) ||
        (r.codigo_usuario || "").includes(q) ||
        (r.registro || "").includes(q)
    );
  }

  return [...list].sort((a, b) => {
    const va = a[sortField] ?? "";
    const vb = b[sortField] ?? "";
    if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
}

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistencia Tecnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistencia Tecnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score == null || score < 0) return <span className="text-xs text-slate-400">-</span>;
  const pct = Math.min(score, 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-black text-slate-700">{score}</span>
    </div>
  );
}

function MiniMetric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-2xl border px-3 py-2 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-0.5 text-sm font-black">{value}</p>
    </div>
  );
}

function parseEventoDate(row) {
  const raw = String(row?.data_hora_evento || "").trim();
  const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  if (row?.created_at) {
    const d = new Date(row.created_at);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return "";
}

function formatDateBR(isoDate) {
  if (!isoDate) return "-";
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function getPrefixo(row) {
  return (
    String(
      row?.prefixo_resolvido ||
        row?.prefixo ||
        row?.veiculo ||
        row?.codigo_cartao ||
        row?.codigo_usuario ||
        "SEM_PREFIXO"
    ).trim() || "SEM_PREFIXO"
  );
}

function getCameraIssue(row) {
  const arr = Array.isArray(row?.problemas_enquadramento_camera) ? row.problemas_enquadramento_camera : [];
  const tokens = arr.map((item) => String(item || "").toUpperCase());
  const texto = `${String(row?.camera_enquadramento || "")} ${String(row?.camera_recomendacao || row?.recomendacao_camera || "")}`.toUpperCase();
  const hasExact = (values) => tokens.some((t) => values.includes(t)) || values.some((v) => texto.includes(v));

  if (hasExact(["ROSTO_MUITO_BAIXO", "MUITO_BAIXO", "ROSTO_BAIXO", "BAIXO", "AJUSTAR_PARA_BAIXO", "PARA BAIXO"])) {
    return "muito_acima";
  }
  if (hasExact(["ROSTO_MUITO_ALTO", "MUITO_ALTO", "ROSTO_ALTO", "ALTO", "AJUSTAR_PARA_CIMA", "PARA CIMA"])) {
    return "muito_abaixo";
  }
  if (hasExact(["CORTADO", "INADEQUADO", "DISTANTE", "PEQUENO"])) {
    return "outro";
  }
  return "";
}

function IssuePill({ issue }) {
  const tone =
    issue === "muito_acima"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : issue === "muito_abaixo"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : issue === "outro"
          ? "bg-slate-100 text-slate-600 border-slate-200"
          : "bg-emerald-50 text-emerald-700 border-emerald-200";
  const label =
    issue === "muito_acima"
      ? "Camera muito acima"
      : issue === "muito_abaixo"
        ? "Camera muito abaixo"
        : issue === "outro"
          ? "Outros ajustes"
          : "Sem ajuste";
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tone}`}>{label}</span>;
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
          : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function DashboardTab({ rows }) {
  const stats = useMemo(() => {
    const s = { similar: 0, irregular: 0, inconclusivo: 0, tecnica: 0, total: rows.length };
    const scoreSum = { similar: 0, irregular: 0, inconclusivo: 0 };
    const scoreCnt = { similar: 0, irregular: 0, inconclusivo: 0 };
    const bioCats = {};
    const cameraEnqs = {};
    let facesTotal = 0;
    let facesComValor = 0;

    rows.forEach((r) => {
      const a = r.acao_prevista;
      if (a === "Confirmar Similaridade") {
        s.similar++;
        if (r.score > 0) {
          scoreSum.similar += r.score;
          scoreCnt.similar++;
        }
      } else if (a === "Confirmar Irregularidade") {
        s.irregular++;
        if (r.score > 0) {
          scoreSum.irregular += r.score;
          scoreCnt.irregular++;
        }
      } else if (a === "Confirmar Inconclusivo") {
        s.inconclusivo++;
        if (r.score > 0) {
          scoreSum.inconclusivo += r.score;
          scoreCnt.inconclusivo++;
        }
      } else {
        s.tecnica++;
      }

      const bc = r.categoria_biometrica || "N/A";
      bioCats[bc] = (bioCats[bc] || 0) + 1;

      const ce = r.camera_enquadramento || "N/A";
      cameraEnqs[ce] = (cameraEnqs[ce] || 0) + 1;

      if (r.quantidade_rostos_camera != null) {
        facesTotal += Number(r.quantidade_rostos_camera) || 0;
        facesComValor += 1;
      }
    });

    s.avgSimilar = scoreCnt.similar ? Math.round(scoreSum.similar / scoreCnt.similar) : 0;
    s.avgIrregular = scoreCnt.irregular ? Math.round(scoreSum.irregular / scoreCnt.irregular) : 0;
    s.avgInconclusivo = scoreCnt.inconclusivo ? Math.round(scoreSum.inconclusivo / scoreCnt.inconclusivo) : 0;
    s.facesTotal = facesTotal;
    s.facesMedia = facesComValor ? (facesTotal / facesComValor).toFixed(1) : "0.0";
    s.bioCats = bioCats;
    s.cameraEnqs = cameraEnqs;
    return s;
  }, [rows]);

  const pctSimilar = stats.total ? Math.round((stats.similar / stats.total) * 100) : 0;
  const pctIrregular = stats.total ? Math.round((stats.irregular / stats.total) * 100) : 0;
  const pctInconclusivo = stats.total ? Math.round((stats.inconclusivo / stats.total) * 100) : 0;
  const AVG_COLOR = {
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <InoveStatCard title="Similaridade" value={`${stats.similar} (${pctSimilar}%)`} icon={<FaCheckCircle />} tone="emerald" />
        <InoveStatCard title="Irregularidade" value={`${stats.irregular} (${pctIrregular}%)`} icon={<FaTimesCircle />} tone="rose" />
        <InoveStatCard title="Inconclusivo" value={`${stats.inconclusivo} (${pctInconclusivo}%)`} icon={<FaQuestionCircle />} tone="amber" />
        <InoveStatCard title="Erro Tecnico" value={stats.tecnica} icon={<FaWrench />} tone="slate" />
        <InoveStatCard title="Rostos na Camera" value={`${stats.facesTotal} total | media ${stats.facesMedia}`} icon={<FaCamera />} tone="indigo" />
      </div>

      <InoveSection>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Score Medio por Categoria</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Similaridade", avg: stats.avgSimilar, color: "emerald" },
            { label: "Irregularidade", avg: stats.avgIrregular, color: "rose" },
            { label: "Inconclusivo", avg: stats.avgInconclusivo, color: "amber" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-100 bg-white p-4 text-center">
              <p className="text-xs font-bold text-slate-500">{s.label}</p>
              <p className={`mt-1 text-3xl font-black ${AVG_COLOR[s.color] || "text-slate-600"}`}>{s.avg}</p>
            </div>
          ))}
        </div>
      </InoveSection>

      <div className="grid gap-4 md:grid-cols-2">
        <InoveSection>
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Biometria ArcFace</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.bioCats)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, cnt]) => (
                <div key={cat} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">{cat}</span>
                  <span className="text-sm font-black text-slate-800">{cnt}</span>
                </div>
              ))}
          </div>
        </InoveSection>
        <InoveSection>
          <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Enquadramento da Camera</h3>
          <div className="space-y-1.5">
            {Object.entries(stats.cameraEnqs)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, cnt]) => (
                <div key={cat} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs font-bold text-slate-600">{cat}</span>
                  <span className="text-sm font-black text-slate-800">{cnt}</span>
                </div>
              ))}
          </div>
        </InoveSection>
      </div>
    </div>
  );
}

function InsightsTab({ rows }) {
  const [filtroDia, setFiltroDia] = useState("");
  const [topN, setTopN] = useState(15);

  const rowsDoDia = useMemo(() => {
    if (!filtroDia) return rows;
    return rows.filter((r) => parseEventoDate(r) === filtroDia);
  }, [rows, filtroDia]);

  const stats = useMemo(() => {
    const total = rowsDoDia.length;
    const porPrefixo = new Map();
    const porPrefixoProblema = new Map();
    let totalAcima = 0;
    let totalAbaixo = 0;
    let totalOutros = 0;

    rowsDoDia.forEach((row) => {
      const prefixo = getPrefixo(row);
      const issue = getCameraIssue(row);
      const atual = porPrefixo.get(prefixo) || {
        prefixo,
        total: 0,
        muito_acima: 0,
        muito_abaixo: 0,
        outro: 0,
      };

      atual.total += 1;
      if (issue === "muito_acima") {
        atual.muito_acima += 1;
        totalAcima += 1;
      } else if (issue === "muito_abaixo") {
        atual.muito_abaixo += 1;
        totalAbaixo += 1;
      } else if (issue === "outro") {
        atual.outro += 1;
        totalOutros += 1;
      }
      porPrefixo.set(prefixo, atual);

      const chaveProblema = `${prefixo}::${issue || "sem_ajuste"}`;
      porPrefixoProblema.set(chaveProblema, (porPrefixoProblema.get(chaveProblema) || 0) + 1);
    });

    const ranking = Array.from(porPrefixo.values()).sort((a, b) => {
      const dif = (b.muito_acima + b.muito_abaixo + b.outro) - (a.muito_acima + a.muito_abaixo + a.outro);
      if (dif !== 0) return dif;
      return b.total - a.total;
    });

    const carrosComAjuste = ranking.filter((item) => item.muito_acima || item.muito_abaixo || item.outro);
    return {
      total,
      totalAcima,
      totalAbaixo,
      totalOutros,
      ranking,
      carrosComAjuste,
      porPrefixoProblema,
    };
  }, [rowsDoDia]);

  const maxRows = Math.max(1, Number(topN) || 15);
  const rankingVisivel = stats.ranking.slice(0, maxRows);
  const totalAjustes = stats.totalAcima + stats.totalAbaixo + stats.totalOutros;

  return (
    <div className="space-y-5">
      <InoveSection>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Insights por Prefixo</h3>
            <p className="mt-1 text-sm text-slate-500">
              Veja quais carros concentram cameras muito acima, muito abaixo ou outros ajustes de enquadramento.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="text-xs font-bold uppercase text-slate-500">
              <span className="mb-1 block">Dia do evento</span>
              <input
                type="date"
                value={filtroDia}
                onChange={(e) => setFiltroDia(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none"
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-500">
              <span className="mb-1 block">Top carros</span>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value) || 15)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold outline-none"
              >
                {[10, 15, 20, 30].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </InoveSection>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InoveStatCard title="Total do dia" value={stats.total} icon={<FaCalendarAlt />} tone="blue" />
        <InoveStatCard title="Camera muito acima" value={stats.totalAcima} icon={<FaTimesCircle />} tone="rose" />
        <InoveStatCard title="Camera muito abaixo" value={stats.totalAbaixo} icon={<FaWrench />} tone="amber" />
        <InoveStatCard title="Outros ajustes" value={stats.totalOutros} icon={<FaCamera />} tone="slate" />
      </div>

      <InoveSection>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">
          Carros com mais ocorrencias de ajuste
        </h3>
        {rankingVisivel.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum dado para o filtro selecionado.</p>
        ) : (
          <div className="space-y-2">
            {rankingVisivel.map((item) => {
              const ajuste = item.muito_acima + item.muito_abaixo + item.outro;
              const pctDoDia = stats.total ? Math.round((item.total / stats.total) * 100) : 0;
              const pctAjuste = stats.total ? Math.round((ajuste / stats.total) * 100) : 0;
              const dominante =
                item.muito_acima >= item.muito_abaixo && item.muito_acima >= item.outro
                  ? "muito_acima"
                  : item.muito_abaixo >= item.outro
                    ? "muito_abaixo"
                    : "outro";

              return (
                <div key={item.prefixo} className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-black text-slate-900">{item.prefixo}</p>
                      <p className="text-xs text-slate-500">
                        {item.total} imagens no dia{filtroDia ? ` ${formatDateBR(filtroDia)}` : ""} | {pctDoDia}% do total do dia
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <IssuePill issue={dominante} />
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                        Ajustes: {ajuste} ({pctAjuste}%)
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-xl bg-rose-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-rose-600">Muito acima</p>
                      <p className="text-xl font-black text-rose-700">{item.muito_acima}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-amber-600">Muito abaixo</p>
                      <p className="text-xl font-black text-amber-700">{item.muito_abaixo}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-slate-500">Outros</p>
                      <p className="text-xl font-black text-slate-700">{item.outro}</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-blue-600">Total</p>
                      <p className="text-xl font-black text-blue-700">{item.total}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </InoveSection>
    </div>
  );
}

function PromptTab() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("vision_config").select("valor").eq("chave", "prompt_gemini").single();
      if (data?.valor) setPrompt(data.valor);
      else setPrompt("Aguardando sincronizacao do bot para publicar o prompt.");
      setLoading(false);
    })();
  }, []);

  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Carregando prompt...</p>;

  return (
    <InoveSection>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Prompt Gemini Vision</h3>
      </div>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
        {prompt}
      </pre>
    </InoveSection>
  );
}

export default function MonitoramentoCentral() {
  const persistedState = useMemo(() => readPersistedState(), []);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => persistedState.search || "");
  const [filtroAcao, setFiltroAcao] = useState(() => persistedState.filtroAcao || "");
  const [filtroCategoria, setFiltroCategoria] = useState(() => persistedState.filtroCategoria || "");
  const [sortField, setSortField] = useState(() => persistedState.sortField || "created_at");
  const [sortAsc, setSortAsc] = useState(() => Boolean(persistedState.sortAsc));
  const [selected, setSelected] = useState(new Set());
  const [tab, setTab] = useState(() => persistedState.tab || "laudos");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [availableDays, setAvailableDays] = useState([]);
  const [diaFiltro, setDiaFiltro] = useState(() => persistedState.diaFiltro || "");
  const [diaAplicado, setDiaAplicado] = useState(() => persistedState.diaAplicado || "");
  const [resumoDia, setResumoDia] = useState(null);
  const [prefixosDia, setPrefixosDia] = useState([]);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [aplicandoFiltro, setAplicandoFiltro] = useState(false);
  const realtimeChannelRef = useRef(null);
  const reloadTimerRef = useRef(null);
  const rowLimitRef = useRef(Math.max(PAGE_SIZE, Number(persistedState.rowLimit) || PAGE_SIZE));
  const deferredSearch = useDeferredValue(search);

  const fetchAvailableDays = useCallback(async () => {
    const { data, error } = await supabase
      .from("vw_monitoramento_inspecoes_diario")
      .select("dt_evento,total_laudos")
      .order("dt_evento", { ascending: false });
    if (!error && Array.isArray(data)) {
      setAvailableDays(data);
    }
  }, []);

  const fetchDayData = useCallback(
    async (day, limit = rowLimitRef.current, options = {}) => {
      const { background = false } = options;
      if (!day) {
        setRows([]);
        setResumoDia(null);
        setPrefixosDia([]);
        setHasMore(false);
        setLoading(false);
        return;
      }

      const safeLimit = Math.max(PAGE_SIZE, Number(limit) || PAGE_SIZE);
      if (!background) {
        setLoading(true);
        setLoadingResumo(true);
      }

      try {
        const [rowsResp, resumoResp, prefixResp] = await Promise.all([
          supabase
            .from("vw_monitoramento_inspecoes_base")
            .select(VISUAL_COLUMNS)
            .eq("dt_evento", day)
            .order("created_at", { ascending: false })
            .range(0, safeLimit),
          supabase
            .from("vw_monitoramento_inspecoes_diario")
            .select(SUMMARY_COLUMNS)
            .eq("dt_evento", day)
            .maybeSingle(),
          supabase
            .from("vw_monitoramento_inspecoes_prefixos")
            .select(PREFIX_COLUMNS)
            .eq("dt_evento", day)
            .order("total_laudos", { ascending: false })
            .range(0, 50),
        ]);

        if (rowsResp.error) {
          console.error("Erro ao carregar monitoramento:", rowsResp.error);
          return;
        }

        const loadedRows = rowsResp.data || [];
        setRows(loadedRows.length > safeLimit ? loadedRows.slice(0, safeLimit) : loadedRows);
        setHasMore(loadedRows.length > safeLimit);
        setResumoDia(!resumoResp.error ? resumoResp.data || null : null);
        setPrefixosDia(!prefixResp.error ? prefixResp.data || [] : []);
      } finally {
        if (!background) {
          setLoading(false);
          setLoadingResumo(false);
        }
      }
    },
    []
  );

  const loadMore = () => {
    if (loading || loadingMore || !hasMore || !diaAplicado) return;
    const nextLimit = rowLimitRef.current + PAGE_SIZE;
    rowLimitRef.current = nextLimit;
    writePersistedState({
      search,
      filtroAcao,
      filtroCategoria,
      sortField,
      sortAsc,
      tab,
      diaFiltro,
      diaAplicado,
      rowLimit: nextLimit,
    });
    setLoadingMore(true);
    fetchDayData(diaAplicado, nextLimit, { background: true }).finally(() => setLoadingMore(false));
  };

  useEffect(() => {
    writePersistedState({
      search,
      filtroAcao,
      filtroCategoria,
      sortField,
      sortAsc,
      tab,
      diaFiltro,
      diaAplicado,
      rowLimit: rowLimitRef.current,
    });
  }, [search, filtroAcao, filtroCategoria, sortField, sortAsc, tab, diaFiltro, diaAplicado]);

  useEffect(() => {
    fetchAvailableDays();
  }, [fetchAvailableDays]);

  useEffect(() => {
    if (!diaAplicado) {
      setRows([]);
      setResumoDia(null);
      setPrefixosDia([]);
      setHasMore(false);
      setLoading(false);
      setLoadingResumo(false);
      return;
    }
    fetchDayData(diaAplicado, rowLimitRef.current);
  }, [diaAplicado, fetchDayData, persistedState.rowLimit]);

  useEffect(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const scheduleReload = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        if (diaAplicado) {
          fetchDayData(diaAplicado, rowLimitRef.current, { background: true });
        }
      }, 700);
    };

    realtimeChannelRef.current = supabase
      .channel("vision-inspecoes-monitoramento")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vision_inspecoes" },
        () => scheduleReload()
      )
      .subscribe();

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [fetchDayData, diaAplicado]);

  const filtered = useMemo(
    () =>
      applyMonitoramentoFilters(rows, {
        search: deferredSearch,
        filtroAcao,
        filtroCategoria,
        sortField,
        sortAsc,
      }),
    [rows, deferredSearch, filtroAcao, filtroCategoria, sortField, sortAsc]
  );

  const stats = useMemo(() => {
    const s = { similar: 0, irregular: 0, inconclusivo: 0, tecnica: 0 };
    rows.forEach((r) => {
      if (r.acao_prevista === "Confirmar Similaridade") s.similar++;
      else if (r.acao_prevista === "Confirmar Irregularidade") s.irregular++;
      else if (r.acao_prevista === "Confirmar Inconclusivo") s.inconclusivo++;
      else s.tecnica++;
    });
    return s;
  }, [rows]);

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const excluirSelecionados = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Excluir ${selected.size} laudo(s)?`)) return;
    setDeleting(true);
    const ids = Array.from(selected);
    await supabase.from("vision_inspecoes").delete().in("id", ids);
    setSelected(new Set());
    if (diaAplicado) {
      await fetchDayData(diaAplicado, rowLimitRef.current);
    }
    setDeleting(false);
  };

  const aplicarFiltroDia = async () => {
    if (!diaFiltro) {
      window.alert("Escolha um dia para carregar os indicadores e os laudos.");
      return;
    }
    setAplicandoFiltro(true);
    try {
      rowLimitRef.current = PAGE_SIZE;
      setSelected(new Set());
      setDiaAplicado(diaFiltro);
    } finally {
      setAplicandoFiltro(false);
    }
  };

  const limparFiltroDia = () => {
    setDiaFiltro("");
    setDiaAplicado("");
    setRows([]);
    setResumoDia(null);
    setPrefixosDia([]);
    setSelected(new Set());
    setHasMore(false);
    rowLimitRef.current = PAGE_SIZE;
  };

  const exportarExcel = async () => {
    if (exporting || !diaAplicado) return;
    setExporting(true);
    try {
      const pageSize = 1000;
      let from = 0;
      let exportBase = [];
      let hasMoreData = true;

      while (hasMoreData) {
        const { data, error } = await supabase
          .from("vw_monitoramento_inspecoes_base")
          .select(VISUAL_COLUMNS)
          .eq("dt_evento", diaAplicado)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) {
          throw error;
        }

        const chunk = data || [];
        exportBase = exportBase.concat(chunk);
        hasMoreData = chunk.length === pageSize;
        from += pageSize;
      }

      const exportRows = applyMonitoramentoFilters(exportBase, {
        search: deferredSearch,
        filtroAcao,
        filtroCategoria,
        sortField,
        sortAsc,
      }).map((row) => ({
        ID: row.id,
        "Criado em": row.created_at || "",
        "Data evento": row.data_hora_evento || "",
        Nome: row.nome || "",
        Registro: row.registro || "",
        Prefixo: row.prefixo || row.veiculo || "",
        Veiculo: row.veiculo || "",
        "Codigo cartao": row.codigo_cartao || "",
        "Codigo usuario": row.codigo_usuario || "",
        Acao: row.acao_prevista || "",
        Categoria: row.categoria || "",
        "Categoria biometrica": row.categoria_biometrica || "",
        Score: row.score ?? "",
        "Score biometrico": row.score_biometrico ?? "",
        ArcFace: row.similaridade_arcface ?? "",
        "Rostos camera": row.quantidade_rostos_camera ?? "",
        "Camera enquadramento": row.camera_enquadramento || "",
      }));

      if (exportRows.length === 0) {
        window.alert("Nenhum laudo encontrado para exportar com os filtros atuais.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monitoramento");
      worksheet["!cols"] = Object.keys(exportRows[0]).map((key) => ({
        wch: Math.min(Math.max(String(key).length + 2, 14), 28),
      }));

      const now = new Date();
      const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(workbook, `monitoramento_${stamp}.xlsx`);
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      window.alert("Nao foi possivel gerar o Excel agora.");
    } finally {
      setExporting(false);
    }
  };

  const SortIcon = sortAsc ? FaSortAmountUp : FaSortAmountDown;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <InovePageHeader
        eyebrow="Vision Web"
        title="Monitoramento de Inspecoes"
        description="Laudos de inspecao facial gerados pelo bot de analise automatica com Gemini Vision AI, InsightFace/ArcFace e Face Mesh."
        icon={<FaCamera className="text-xl" />}
        tone="blue"
      />

      <InoveSection className="overflow-hidden">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Filtro obrigatório</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Escolha um dia para carregar indicadores e laudos</h2>
            <p className="mt-1 text-sm text-slate-600">
              O painel só carrega a base do dia aplicado. Isso mantém a navegação leve mesmo com milhares de registros por dia.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dia</label>
            <input
              type="date"
              value={diaFiltro}
              onChange={(e) => setDiaFiltro(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
            <p className="text-xs text-slate-500">
              {availableDays.length > 0
                ? `${availableDays.length} dia(s) com monitoramento disponível.`
                : "Carregando dias disponíveis..."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={aplicarFiltroDia}
              disabled={aplicandoFiltro || !diaFiltro}
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aplicandoFiltro ? "Aplicando..." : "Aplicar filtro"}
            </button>
            <button
              type="button"
              onClick={limparFiltroDia}
              disabled={aplicandoFiltro && !diaAplicado}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
            Dia aplicado: {diaAplicado ? formatDateBR(diaAplicado) : "nenhum"}
          </span>
          <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
            Base carregada: {rows.length} registro(s)
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            Indicadores: {loadingResumo ? "carregando..." : diaAplicado ? "prontos" : "aguardando filtro"}
          </span>
        </div>
      </InoveSection>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<FaChartBar />} label="Dashboard" />
        <TabButton active={tab === "insights"} onClick={() => setTab("insights")} icon={<FaCalendarAlt />} label="Insights Prefixo" />
        <TabButton active={tab === "laudos"} onClick={() => setTab("laudos")} icon={<FaList />} label="Laudos" />
        <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")} icon={<FaCode />} label="Prompt Gemini" />
      </div>

      {tab === "prompt" && <PromptTab />}
      {diaAplicado ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            <InoveStatCard title="Total do dia" value={resumoDia?.total_laudos ?? rows.length} icon={<FaCalendarAlt />} tone="blue" />
            <InoveStatCard title="Similaridade" value={resumoDia?.total_similaridade ?? stats.similar} icon={<FaCheckCircle />} tone="emerald" />
            <InoveStatCard title="Irregularidade" value={resumoDia?.total_irregularidade ?? stats.irregular} icon={<FaTimesCircle />} tone="rose" />
            <InoveStatCard title="Inconclusivo" value={resumoDia?.total_inconclusivo ?? stats.inconclusivo} icon={<FaQuestionCircle />} tone="amber" />
            <InoveStatCard title="Tecnica" value={resumoDia?.total_tecnica ?? stats.tecnica} icon={<FaWrench />} tone="slate" />
            <InoveStatCard title="Prefixos" value={resumoDia?.prefixos_distintos ?? "—"} icon={<FaList />} tone="indigo" />
          </div>

          <InoveSection>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Resumo do dia</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Os indicadores abaixo vêm da view diária e servem como leitura rápida antes de abrir os laudos.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[340px] lg:grid-cols-3">
                <MiniMetric label="Score médio" value={resumoDia?.score_medio ?? "—"} tone="blue" />
                <MiniMetric label="Score bio" value={resumoDia?.score_medio_biometrico ?? "—"} tone="emerald" />
                <MiniMetric label="Face Mesh" value={resumoDia?.score_medio_face_mesh ?? "—"} tone="amber" />
              </div>
            </div>
          </InoveSection>

          <InoveSection>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Ranking por Prefixo</h3>
                <p className="mt-1 text-sm text-slate-500">Resumo diário por prefixo para identificar rapidamente onde concentrar a análise.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {prefixosDia.length} prefixo(s)
              </span>
            </div>
            {prefixosDia.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">Nenhum prefixo encontrado para o dia selecionado.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {prefixosDia.slice(0, 6).map((item) => (
                  <div key={item.prefixo} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-base font-black text-slate-900">{item.prefixo}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.total_laudos} laudo(s) no dia</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <MiniMetric label="Similar" value={item.total_similaridade ?? 0} tone="emerald" />
                      <MiniMetric label="Irregular" value={item.total_irregularidade ?? 0} tone="rose" />
                      <MiniMetric label="Inconclusivo" value={item.total_inconclusivo ?? 0} tone="amber" />
                      <MiniMetric label="Tecnica" value={item.total_tecnica ?? 0} tone="slate" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InoveSection>

          {tab === "dashboard" && <DashboardTab rows={rows} />}
          {tab === "insights" && <InsightsTab rows={rows} />}

          {tab === "laudos" && (
            <InoveSection className="overflow-hidden">
            <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4 md:p-5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.06),transparent_28%)]" />
              <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] lg:items-end">
                <div className="space-y-1.5">
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-blue-600">Painel Operacional</p>
                  <h2 className="text-2xl font-black text-slate-900">Fila de monitoramento e busca inteligente</h2>
                  <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                    O painel mostra os laudos recentes, as métricas principais e os filtros mais usados sem pesar a navegação.
                  </p>
                </div>
                <MiniMetric label="Carregados" value={rows.length} tone="blue" />
                <MiniMetric label="Visíveis" value={filtered.length} tone="emerald" />
                <MiniMetric label="Selecionados" value={selected.size} tone="rose" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_220px_220px]">
              <div className="relative">
                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, cartao, usuario ou registro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <select
                value={filtroAcao}
                onChange={(e) => setFiltroAcao(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Todas as acoes</option>
                <option value="Confirmar Similaridade">Similaridade</option>
                <option value="Confirmar Irregularidade">Irregularidade</option>
                <option value="Confirmar Inconclusivo">Inconclusivo</option>
                <option value="Inconsistencia Tecnica">Inconsistencia Tecnica</option>
              </select>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">Todas categorias</option>
                <option value="PESSOA_VISIVEL_SIMILAR">Similar</option>
                <option value="PESSOA_VISIVEL_DIFERENTE">Diferente</option>
                <option value="SEM_PESSOA">Sem Pessoa</option>
                <option value="INCONCLUSIVO">Inconclusivo</option>
                <option value="ERRO">Erro</option>
              </select>
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ordenar</span>
                {[
                  { field: "created_at", label: "Data" },
                  { field: "score", label: "Score" },
                  { field: "score_biometrico", label: "Biometria" },
                  { field: "nome", label: "Nome" },
                ].map((s) => (
                  <button
                    key={s.field}
                    onClick={() => toggleSort(s.field)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      sortField === s.field
                        ? "bg-slate-900 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    {s.label} {sortField === s.field && <SortIcon className="text-[10px]" />}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selected.size > 0 && (
                  <button
                    onClick={excluirSelecionados}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                    <FaTrash /> {deleting ? "Excluindo..." : `Excluir (${selected.size})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={exportarExcel}
                  disabled={exporting || loading || !diaAplicado}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaDownload /> {exporting ? "Gerando Excel..." : "Baixar Excel"}
                </button>
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loading || loadingMore || !hasMore}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? "Carregando mais..." : hasMore ? `Carregar mais ${PAGE_SIZE}` : "Tudo carregado"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">
                Mostrando {rows.length} laudo(s) carregado(s)
                {hasMore ? " e ainda ha mais resultados." : "."}
              </p>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                Filtros salvos ao sair e voltar
              </p>
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-slate-400">Carregando laudos...</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 py-14 text-center">
                <p className="text-sm font-bold text-slate-700">Nenhum laudo encontrado.</p>
                <p className="mt-1 text-sm text-slate-500">Tente ajustar os filtros ou ampliar a busca.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2 pb-1">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-xs text-slate-400">{filtered.length} laudos</span>
                </div>
                {filtered.map((row) => (
                  <div
                    key={row.id}
                    className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="flex gap-4 p-4">
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => navigate(`/monitoramento/${row.id}`)}
                        className="flex min-w-0 flex-1 items-stretch gap-4 text-left"
                      >
                        <div className="flex gap-2">
                          {row.img_cadastro_url ? (
                            <img
                              src={row.img_cadastro_url}
                              alt=""
                              className="h-16 w-16 rounded-2xl border border-slate-200 object-cover ring-1 ring-white transition group-hover:scale-[1.02]"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                              <FaCamera />
                            </div>
                          )}
                          {row.img_camera_url ? (
                            <img
                              src={row.img_camera_url}
                              alt=""
                              className="h-16 w-16 rounded-2xl border border-slate-200 object-cover ring-1 ring-white transition group-hover:scale-[1.02]"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                              <FaCamera />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-slate-900">{row.nome || "Sem nome"}</p>
                              <p className="text-xs font-medium text-slate-500">
                                <span className="font-bold text-slate-700">{row.registro || "Sem registro"}</span>
                                <span className="mx-2 text-slate-300">|</span>
                                {row.data_hora_evento || "-"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge acao={row.acao_prevista} />
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                                {row.categoria || "SEM CATEGORIA"}
                              </span>
                            </div>
                          </div>

                          <div className="grid gap-2 md:grid-cols-4">
                            <MiniMetric label="Score final" value={row.score ?? "-"} tone="blue" />
                            <MiniMetric label="Biometria" value={row.score_biometrico ?? "-"} tone="emerald" />
                            <MiniMetric label="ArcFace" value={row.similaridade_arcface ?? "-"} tone="amber" />
                            <MiniMetric label="Rostos" value={row.quantidade_rostos_camera ?? "-"} tone="slate" />
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </InoveSection>
          )}
        </>
      ) : tab === "prompt" ? null : (
        <InoveSection>
          <div className="py-12 text-center">
            <p className="text-sm font-bold text-slate-800">Selecione um dia e aplique o filtro para liberar os indicadores e os laudos.</p>
            <p className="mt-1 text-sm text-slate-500">Enquanto isso, a tela não carrega registros pesados desnecessariamente.</p>
          </div>
        </InoveSection>
      )}
    </div>
  );
}
