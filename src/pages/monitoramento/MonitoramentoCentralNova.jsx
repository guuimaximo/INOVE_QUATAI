import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCalendarAlt,
  FaCamera,
  FaChartBar,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaCode,
  FaDownload,
  FaList,
  FaQuestionCircle,
  FaSearch,
  FaSortAmountDown,
  FaSortAmountUp,
  FaToggleOff,
  FaToggleOn,
  FaTimesCircle,
  FaTrash,
  FaWrench,
} from "react-icons/fa";
import * as XLSX from "xlsx";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection, InoveStatCard } from "../../components/InovePage";

const PAGE_SIZE = 200;
const STATE_KEY = "inove.monitoramento.state.v2";
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
].join(", ");
const SUMMARY_COLUMNS =
  "dt_evento,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,total_rostos_camera,score_medio,score_medio_biometrico,score_medio_face_mesh,prefixos_distintos";
const MONTHS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistencia Tecnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

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
  } catch {}
}

function toIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (!value || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonthIso(isoDate) {
  const d = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return toIsoDate(new Date());
  return toIsoDate(new Date(d.getFullYear(), d.getMonth(), 1));
}

function shiftMonthIso(isoMonth, delta) {
  const d = isoMonth ? new Date(`${isoMonth}T00:00:00`) : new Date();
  if (Number.isNaN(d.getTime())) return startOfMonthIso(toIsoDate(new Date()));
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

function formatDateBR(isoDate) {
  const m = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : isoDate || "-";
}

function formatMonthLabel(isoMonth) {
  const d = new Date(`${isoMonth || ""}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "-" : `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMonthGrid(isoMonth) {
  const base = new Date(`${isoMonth}T00:00:00`);
  if (Number.isNaN(base.getTime())) return [];
  const year = base.getFullYear();
  const month = base.getMonth();
  const firstWeekDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekDay; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(toIsoDate(new Date(year, month, day)));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getCalendarTone(item) {
  if (!item || !item.total_laudos) return { cell: "border-rose-200 bg-rose-50 text-rose-700", pill: "bg-rose-100 text-rose-700", label: "Sem laudo" };
  if (item.inspecionado) return { cell: "border-emerald-200 bg-emerald-50 text-emerald-700", pill: "bg-emerald-100 text-emerald-700", label: "Fechado" };
  return { cell: "border-amber-200 bg-amber-50 text-amber-700", pill: "bg-amber-100 text-amber-700", label: "Pendente" };
}

function applyMonitoramentoFilters(rows, { search, filtroAcao, filtroCategoria, sortField, sortAsc }) {
  let list = rows;
  if (filtroAcao) list = list.filter((r) => r.acao_prevista === filtroAcao);
  if (filtroCategoria) list = list.filter((r) => r.categoria === filtroCategoria);
  if (search?.trim()) {
    const q = search.toLowerCase();
    list = list.filter((r) => (r.nome || "").toLowerCase().includes(q) || (r.codigo_cartao || "").includes(q) || (r.codigo_usuario || "").includes(q) || (r.registro || "").includes(q));
  }
  return [...list].sort((a, b) => {
    const va = a[sortField] ?? "";
    const vb = b[sortField] ?? "";
    if (typeof va === "number" && typeof vb === "number") return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
}

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistencia Tecnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
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

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition ${
        active ? "bg-slate-900 text-white shadow-lg shadow-slate-200" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function DashboardTab({ rows }) {
  const stats = useMemo(() => {
    const s = { similar: 0, irregular: 0, inconclusivo: 0, tecnica: 0, total: rows.length, facesTotal: 0, facesCount: 0 };
    const cats = {};
    rows.forEach((r) => {
      if (r.acao_prevista === "Confirmar Similaridade") s.similar += 1;
      else if (r.acao_prevista === "Confirmar Irregularidade") s.irregular += 1;
      else if (r.acao_prevista === "Confirmar Inconclusivo") s.inconclusivo += 1;
      else s.tecnica += 1;
      const key = r.categoria_biometrica || "N/A";
      cats[key] = (cats[key] || 0) + 1;
      if (r.quantidade_rostos_camera != null) {
        s.facesTotal += Number(r.quantidade_rostos_camera) || 0;
        s.facesCount += 1;
      }
    });
    return { ...s, cats, facesMedia: s.facesCount ? (s.facesTotal / s.facesCount).toFixed(1) : "0.0" };
  }, [rows]);

  const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <InoveStatCard title="Similaridade" value={`${stats.similar} (${pct(stats.similar)}%)`} icon={<FaCheckCircle />} tone="emerald" />
        <InoveStatCard title="Irregularidade" value={`${stats.irregular} (${pct(stats.irregular)}%)`} icon={<FaTimesCircle />} tone="rose" />
        <InoveStatCard title="Inconclusivo" value={`${stats.inconclusivo} (${pct(stats.inconclusivo)}%)`} icon={<FaQuestionCircle />} tone="amber" />
        <InoveStatCard title="Erro Tecnico" value={stats.tecnica} icon={<FaWrench />} tone="slate" />
        <InoveStatCard title="Rostos na Camera" value={`${stats.facesTotal} total | media ${stats.facesMedia}`} icon={<FaCamera />} tone="indigo" />
      </div>
      <InoveSection>
        <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Biometria ArcFace</h3>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(stats.cats)
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
  );
}

function PromptTab() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("vision_config").select("valor").eq("chave", "prompt_gemini").single();
      setPrompt(data?.valor || "Aguardando sincronizacao do bot para publicar o prompt.");
      setLoading(false);
    })();
  }, []);
  if (loading) return <p className="py-12 text-center text-sm text-slate-400">Carregando prompt...</p>;
  return (
    <InoveSection>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Prompt Gemini Vision</h3>
      </div>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">{prompt}</pre>
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
  const [diaFiltro, setDiaFiltro] = useState(() => persistedState.diaFiltro || "");
  const [diaAplicado, setDiaAplicado] = useState(() => persistedState.diaAplicado || "");
  const [resumoDia, setResumoDia] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonthIso(persistedState.calendarMonth || persistedState.diaAplicado || persistedState.diaFiltro || toIsoDate(new Date())));
  const [calendarDays, setCalendarDays] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [savingInspected, setSavingInspected] = useState(false);
  const realtimeChannelRef = useRef(null);
  const reloadTimerRef = useRef(null);
  const rowLimitRef = useRef(Math.max(PAGE_SIZE, Number(persistedState.rowLimit) || PAGE_SIZE));
  const deferredSearch = useDeferredValue(search);
  const selectedDay = diaAplicado || diaFiltro;

  const fetchDayData = useCallback(async (day, limit = rowLimitRef.current, options = {}) => {
    const { background = false } = options;
    if (!day) {
      setRows([]);
      setResumoDia(null);
      setHasMore(false);
      if (!background) setLoading(false);
      return;
    }
    const safeLimit = Math.max(PAGE_SIZE, Number(limit) || PAGE_SIZE);
    if (!background) setLoading(true);
    try {
      const [rowsResp, resumoResp] = await Promise.all([
        supabase.from("vw_monitoramento_inspecoes_base").select(VISUAL_COLUMNS).eq("dt_evento", day).order("created_at", { ascending: false }).range(0, safeLimit),
        supabase.from("vw_monitoramento_inspecoes_diario").select(SUMMARY_COLUMNS).eq("dt_evento", day).maybeSingle(),
      ]);
      if (rowsResp.error) {
        console.error("Erro ao carregar monitoramento:", rowsResp.error);
        return;
      }
      const loadedRows = rowsResp.data || [];
      setRows(loadedRows.length > safeLimit ? loadedRows.slice(0, safeLimit) : loadedRows);
      setHasMore(loadedRows.length > safeLimit);
      setResumoDia(!resumoResp.error ? resumoResp.data || null : null);
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const fetchCalendarData = useCallback(async (monthIso, options = {}) => {
    const { background = false } = options;
    if (!monthIso) {
      setCalendarDays([]);
      if (!background) setLoadingCalendar(false);
      return;
    }
    const monthDate = new Date(`${monthIso}T00:00:00`);
    const end = toIsoDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    if (!background) setLoadingCalendar(true);
    try {
      const { data, error } = await supabase
        .from("vw_monitoramento_inspecoes_calendario")
        .select("dt_evento,total_laudos,total_similaridade,total_irregularidade,total_inconclusivo,total_tecnica,score_medio,score_medio_biometrico,score_medio_face_mesh,prefixos_distintos,inspecionado")
        .gte("dt_evento", monthIso)
        .lte("dt_evento", end)
        .order("dt_evento", { ascending: true });
      if (error) {
        console.error("Erro ao carregar calendario:", error);
        setCalendarDays([]);
        return;
      }
      setCalendarDays(Array.isArray(data) ? data : []);
    } finally {
      if (!background) setLoadingCalendar(false);
    }
  }, []);

  useEffect(() => {
    writePersistedState({ search, filtroAcao, filtroCategoria, sortField, sortAsc, tab, diaFiltro, diaAplicado, calendarMonth, rowLimit: rowLimitRef.current });
  }, [search, filtroAcao, filtroCategoria, sortField, sortAsc, tab, diaFiltro, diaAplicado, calendarMonth]);

  useEffect(() => {
    if (!selectedDay) {
      setRows([]);
      setResumoDia(null);
      setHasMore(false);
      setLoading(false);
      return;
    }
    fetchDayData(selectedDay, rowLimitRef.current);
  }, [selectedDay, fetchDayData, persistedState.rowLimit]);

  useEffect(() => {
    fetchCalendarData(calendarMonth);
  }, [calendarMonth, fetchCalendarData]);

  useEffect(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    const scheduleReload = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => {
        if (selectedDay) fetchDayData(selectedDay, rowLimitRef.current, { background: true });
        fetchCalendarData(calendarMonth, { background: true });
      }, 700);
    };
    realtimeChannelRef.current = supabase.channel("vision-inspecoes-monitoramento").on("postgres_changes", { event: "*", schema: "public", table: "vision_inspecoes" }, scheduleReload).subscribe();
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
      reloadTimerRef.current = null;
      realtimeChannelRef.current = null;
    };
  }, [fetchDayData, fetchCalendarData, selectedDay, calendarMonth]);

  const filtered = useMemo(
    () => applyMonitoramentoFilters(rows, { search: deferredSearch, filtroAcao, filtroCategoria, sortField, sortAsc }),
    [rows, deferredSearch, filtroAcao, filtroCategoria, sortField, sortAsc]
  );

  const stats = useMemo(() => {
    const s = { similar: 0, irregular: 0, inconclusivo: 0, tecnica: 0 };
    rows.forEach((r) => {
      if (r.acao_prevista === "Confirmar Similaridade") s.similar += 1;
      else if (r.acao_prevista === "Confirmar Irregularidade") s.irregular += 1;
      else if (r.acao_prevista === "Confirmar Inconclusivo") s.inconclusivo += 1;
      else s.tecnica += 1;
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

  const selecionarDia = (day) => {
    if (!day) return;
    rowLimitRef.current = PAGE_SIZE;
    setSelected(new Set());
    setDiaFiltro(day);
    setDiaAplicado(day);
    setCalendarMonth(startOfMonthIso(day));
  };

  const limparFiltroDia = () => {
    setDiaFiltro("");
    setDiaAplicado("");
    setRows([]);
    setResumoDia(null);
    setSelected(new Set());
    setHasMore(false);
    rowLimitRef.current = PAGE_SIZE;
  };

  const toggleDiaInspecionado = async (forcedValue) => {
    if (!selectedDay || savingInspected) return;
    setSavingInspected(true);
    const current = calendarDays.find((item) => item.dt_evento === selectedDay);
    const nextValue = typeof forcedValue === "boolean" ? forcedValue : !Boolean(current?.inspecionado);
    try {
      const { error } = await supabase.from("monitoramento_dias").upsert({ dt_evento: selectedDay, inspecionado: nextValue, updated_at: new Date().toISOString() }, { onConflict: "dt_evento" });
      if (error) throw error;
      await fetchCalendarData(calendarMonth, { background: true });
    } catch (error) {
      console.error("Erro ao atualizar status do dia:", error);
      window.alert("Nao foi possivel atualizar o status do dia agora.");
    } finally {
      setSavingInspected(false);
    }
  };

  const loadMore = () => {
    if (loading || loadingMore || !hasMore || !selectedDay) return;
    const nextLimit = rowLimitRef.current + PAGE_SIZE;
    rowLimitRef.current = nextLimit;
    setLoadingMore(true);
    fetchDayData(selectedDay, nextLimit, { background: true }).finally(() => setLoadingMore(false));
  };

  const excluirSelecionados = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Excluir ${selected.size} laudo(s)?`)) return;
    setDeleting(true);
    await supabase.from("vision_inspecoes").delete().in("id", Array.from(selected));
    setSelected(new Set());
    if (selectedDay) await fetchDayData(selectedDay, rowLimitRef.current);
    setDeleting(false);
  };

  const exportarExcel = async () => {
    if (exporting || !selectedDay) return;
    setExporting(true);
    try {
      let from = 0;
      const pageSize = 1000;
      let exportBase = [];
      let hasMoreData = true;
      while (hasMoreData) {
        const { data, error } = await supabase.from("vw_monitoramento_inspecoes_base").select(VISUAL_COLUMNS).eq("dt_evento", selectedDay).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
        if (error) throw error;
        const chunk = data || [];
        exportBase = exportBase.concat(chunk);
        hasMoreData = chunk.length === pageSize;
        from += pageSize;
      }

      const exportRows = applyMonitoramentoFilters(exportBase, { search: deferredSearch, filtroAcao, filtroCategoria, sortField, sortAsc }).map((row) => ({
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
      }));

      if (!exportRows.length) {
        window.alert("Nenhum laudo encontrado para exportar com os filtros atuais.");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Monitoramento");
      worksheet["!cols"] = Object.keys(exportRows[0]).map((key) => ({ wch: Math.min(Math.max(String(key).length + 2, 14), 28) }));
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
  const calendarGrid = useMemo(() => buildMonthGrid(calendarMonth), [calendarMonth]);
  const calendarMap = useMemo(() => new Map(calendarDays.map((item) => [item.dt_evento, item])), [calendarDays]);
  const selectedDayData = selectedDay ? calendarMap.get(selectedDay) || null : null;
  const selectedDayTone = getCalendarTone(selectedDayData);

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
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-600">Calendario de monitoramento</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Escolha o dia e acompanhe o status da analise</h2>
                <p className="mt-1 text-sm text-slate-600">Vermelho sem laudo, amarelo com laudo pendente e verde quando o dia foi inspecionado e fechado.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCalendarMonth(shiftMonthIso(calendarMonth, -1))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                  <FaChevronLeft /> Mes anterior
                </button>
                <button type="button" onClick={() => setCalendarMonth(startOfMonthIso(toIsoDate(new Date())))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                  Hoje
                </button>
                <button type="button" onClick={() => setCalendarMonth(shiftMonthIso(calendarMonth, 1))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50">
                  Proximo mes <FaChevronRight />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <InoveStatCard title="Total do dia" value={selectedDay ? (resumoDia?.total_laudos ?? rows.length) : "—"} icon={<FaCalendarAlt />} tone="blue" />
              <InoveStatCard title="Similaridade" value={selectedDay ? (resumoDia?.total_similaridade ?? stats.similar) : "—"} icon={<FaCheckCircle />} tone="emerald" />
              <InoveStatCard title="Irregularidade" value={selectedDay ? (resumoDia?.total_irregularidade ?? stats.irregular) : "—"} icon={<FaTimesCircle />} tone="rose" />
              <InoveStatCard title="Inconclusivo" value={selectedDay ? (resumoDia?.total_inconclusivo ?? stats.inconclusivo) : "—"} icon={<FaQuestionCircle />} tone="amber" />
              <InoveStatCard title="Tecnica" value={selectedDay ? (resumoDia?.total_tecnica ?? stats.tecnica) : "—"} icon={<FaWrench />} tone="slate" />
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900">{formatMonthLabel(calendarMonth)}</p>
                  <p className="text-xs text-slate-500">Clique em um dia para carregar os laudos daquele periodo.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-black ${selectedDayTone.pill}`}>{selectedDayTone.label}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{loadingCalendar ? "Atualizando calendario..." : `${calendarDays.length} dia(s) com dados`}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((label) => <span key={label}>{label}</span>)}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {calendarGrid.map((day, index) => {
                  if (!day) return <div key={`blank-${index}`} className="min-h-[92px] rounded-2xl border border-dashed border-slate-100 bg-slate-50/40" />;
                  const item = calendarMap.get(day);
                  const tone = getCalendarTone(item);
                  const active = selectedDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => selecionarDia(day)}
                      className={`min-h-[92px] rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? "ring-2 ring-blue-400 ring-offset-1" : ""} ${tone.cell}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black">{day.slice(8, 10)}</p>
                          <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-80">{item?.total_laudos ? `${item.total_laudos} laudo(s)` : "Sem laudo"}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${tone.pill}`}>{tone.label}</span>
                      </div>
                      <div className="mt-3 space-y-1 text-[11px] font-bold opacity-90">
                        {item?.score_medio != null ? <p>Score medio: {item.score_medio}</p> : <p>Sem indicadores</p>}
                        {active ? <p className="text-[10px] uppercase tracking-[0.18em]">Selecionado</p> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Legenda</p>
                  <p className="mt-1 text-sm text-slate-600">Status visual do calendario e controle de fechamento do dia.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-black text-rose-700">Sem laudo</span>
                  <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700">Laudo pendente</span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">Dia fechado</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Dia selecionado</label>
                  <input
                    type="date"
                    value={diaFiltro}
                    onChange={(e) => {
                      const nextDay = e.target.value;
                      setDiaFiltro(nextDay);
                      if (!nextDay) {
                        setDiaAplicado("");
                        setRows([]);
                        setResumoDia(null);
                        setSelected(new Set());
                        setHasMore(false);
                        rowLimitRef.current = PAGE_SIZE;
                        return;
                      }
                      selecionarDia(nextDay);
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => toggleDiaInspecionado()}
                  disabled={!selectedDay || savingInspected}
                  className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${selectedDayData?.inspecionado ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
                >
                  {selectedDayData?.inspecionado ? <FaToggleOn /> : <FaToggleOff />}
                  {savingInspected ? "Salvando..." : selectedDayData?.inspecionado ? "Dia inspecionado: ON" : "Dia inspecionado: OFF"}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Dia aplicado: {selectedDay ? formatDateBR(selectedDay) : "nenhum"}</span>
                <button type="button" onClick={limparFiltroDia} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 transition hover:bg-slate-50">Limpar dia</button>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Filtros do dia</p>
                  <p className="mt-1 text-sm text-slate-600">Escolha o que quer ver em Acoes e Categorias.</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">{selectedDay ? `${rows.length} registro(s) carregado(s)` : "Selecione um dia"}</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={filtroAcao} onChange={(e) => setFiltroAcao(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  <option value="">Todas as acoes</option>
                  <option value="Confirmar Similaridade">Similaridade</option>
                  <option value="Confirmar Irregularidade">Irregularidade</option>
                  <option value="Confirmar Inconclusivo">Inconclusivo</option>
                  <option value="Inconsistencia Tecnica">Inconsistencia Tecnica</option>
                </select>
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                  <option value="">Todas as categorias</option>
                  <option value="PESSOA_VISIVEL_SIMILAR">Similar</option>
                  <option value="PESSOA_VISIVEL_DIFERENTE">Diferente</option>
                  <option value="SEM_PESSOA">Sem Pessoa</option>
                  <option value="INCONCLUSIVO">Inconclusivo</option>
                  <option value="ERRO">Erro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-5 text-white shadow-lg">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">Resumo rapido</p>
              <h3 className="mt-2 text-2xl font-black">O painel carrega somente o dia escolhido</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">Isso reduz o peso da tela com milhares de registros por dia e deixa o monitoramento mais previsivel para operar.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="Dia selecionado" value={selectedDay ? formatDateBR(selectedDay) : "nenhum"} tone="slate" />
                <MiniMetric label="Filtro salvo" value={tab} tone="blue" />
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Atalhos</p>
              <div className="mt-3 space-y-2">
                <button type="button" onClick={() => selecionarDia(toIsoDate(new Date()))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-100">Abrir o dia de hoje</button>
                <button type="button" onClick={() => toggleDiaInspecionado(false)} disabled={!selectedDay || savingInspected} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Marcar dia como nao inspecionado</button>
                <button type="button" onClick={() => toggleDiaInspecionado(true)} disabled={!selectedDay || savingInspected} className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">Marcar dia como inspecionado</button>
              </div>
            </div>
          </div>
        </div>
      </InoveSection>

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon={<FaChartBar />} label="Dashboard" />
        <TabButton active={tab === "laudos"} onClick={() => setTab("laudos")} icon={<FaList />} label="Laudos" />
        <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")} icon={<FaCode />} label="Prompt Gemini" />
      </div>

      {tab === "prompt" && <PromptTab />}
      {selectedDay ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <InoveStatCard title="Total do dia" value={resumoDia?.total_laudos ?? rows.length} icon={<FaCalendarAlt />} tone="blue" />
            <InoveStatCard title="Similaridade" value={resumoDia?.total_similaridade ?? stats.similar} icon={<FaCheckCircle />} tone="emerald" />
            <InoveStatCard title="Irregularidade" value={resumoDia?.total_irregularidade ?? stats.irregular} icon={<FaTimesCircle />} tone="rose" />
            <InoveStatCard title="Inconclusivo" value={resumoDia?.total_inconclusivo ?? stats.inconclusivo} icon={<FaQuestionCircle />} tone="amber" />
            <InoveStatCard title="Tecnica" value={resumoDia?.total_tecnica ?? stats.tecnica} icon={<FaWrench />} tone="slate" />
          </div>

          <InoveSection>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500">Resumo do dia</h3>
                <p className="mt-1 text-sm text-slate-500">Os indicadores abaixo vem da view diaria e servem como leitura rapida antes de abrir os laudos.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[340px] lg:grid-cols-3">
                <MiniMetric label="Score medio" value={resumoDia?.score_medio ?? "—"} tone="blue" />
                <MiniMetric label="Score bio" value={resumoDia?.score_medio_biometrico ?? "—"} tone="emerald" />
                <MiniMetric label="Face Mesh" value={resumoDia?.score_medio_face_mesh ?? "—"} tone="amber" />
              </div>
            </div>
          </InoveSection>

          {tab === "dashboard" && <DashboardTab rows={rows} />}

          {tab === "laudos" && (
            <InoveSection className="overflow-hidden">
              <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-4 md:p-5">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(15,23,42,0.06),transparent_28%)]" />
                <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.7fr))] lg:items-end">
                  <div className="space-y-1.5">
                    <p className="text-xs font-black uppercase tracking-[0.26em] text-blue-600">Painel Operacional</p>
                    <h2 className="text-2xl font-black text-slate-900">Fila de monitoramento e busca inteligente</h2>
                    <p className="max-w-3xl text-sm leading-relaxed text-slate-600">O painel mostra os laudos do dia selecionado, as metricas principais e os filtros mais usados sem pesar a navegacao.</p>
                  </div>
                  <MiniMetric label="Carregados" value={rows.length} tone="blue" />
                  <MiniMetric label="Visiveis" value={filtered.length} tone="emerald" />
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
                <button type="button" onClick={() => setFiltroAcao((prev) => (prev ? "" : "Confirmar Similaridade"))} className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-semibold outline-none transition hover:bg-slate-50">Acao: {filtroAcao || "todas"}</button>
                <button type="button" onClick={() => setFiltroCategoria((prev) => (prev ? "" : "PESSOA_VISIVEL_SIMILAR"))} className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-sm font-semibold outline-none transition hover:bg-slate-50">Categoria: {filtroCategoria || "todas"}</button>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Ordenar</span>
                  {[{ field: "created_at", label: "Data" }, { field: "score", label: "Score" }, { field: "score_biometrico", label: "Biometria" }, { field: "nome", label: "Nome" }].map((s) => (
                    <button key={s.field} type="button" onClick={() => toggleSort(s.field)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${sortField === s.field ? "bg-slate-900 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
                      {s.label} {sortField === s.field && <SortIcon className="text-[10px]" />}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selected.size > 0 && (
                    <button type="button" onClick={excluirSelecionados} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">
                      <FaTrash /> {deleting ? "Excluindo..." : `Excluir (${selected.size})`}
                    </button>
                  )}
                  <button type="button" onClick={exportarExcel} disabled={exporting || loading || !selectedDay} className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">
                    <FaDownload /> {exporting ? "Gerando Excel..." : "Baixar Excel"}
                  </button>
                  <button type="button" onClick={loadMore} disabled={loading || loadingMore || !hasMore} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                    {loadingMore ? "Carregando mais..." : hasMore ? `Carregar mais ${PAGE_SIZE}` : "Tudo carregado"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-500">Mostrando {rows.length} laudo(s) carregado(s){hasMore ? " e ainda ha mais resultados." : "."}</p>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Filtros salvos ao sair e voltar</p>
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
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={selectAll} className="h-4 w-4 rounded border-slate-300" />
                    <span className="text-xs text-slate-400">{filtered.length} laudos</span>
                  </div>
                  {filtered.map((row) => (
                    <div key={row.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                      <div className="flex gap-4 p-4">
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="mt-1 h-4 w-4 flex-shrink-0 rounded border-slate-300" />
                        <button type="button" onClick={() => navigate(`/monitoramento/${row.id}`)} className="flex min-w-0 flex-1 items-stretch gap-4 text-left">
                          <div className="flex gap-2">
                            {row.img_cadastro_url ? <img src={row.img_cadastro_url} alt="" className="h-16 w-16 rounded-2xl border border-slate-200 object-cover ring-1 ring-white transition group-hover:scale-[1.02]" loading="lazy" decoding="async" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400"><FaCamera /></div>}
                            {row.img_camera_url ? <img src={row.img_camera_url} alt="" className="h-16 w-16 rounded-2xl border border-slate-200 object-cover ring-1 ring-white transition group-hover:scale-[1.02]" loading="lazy" decoding="async" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-slate-400"><FaCamera /></div>}
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="truncate text-base font-black text-slate-900">{row.nome || "Sem nome"}</p>
                                <p className="text-xs font-medium text-slate-500"><span className="font-bold text-slate-700">{row.registro || "Sem registro"}</span><span className="mx-2 text-slate-300">|</span>{row.data_hora_evento || "-"}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge acao={row.acao_prevista} />
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{row.categoria || "SEM CATEGORIA"}</span>
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
            <p className="text-sm font-bold text-slate-800">Selecione um dia no calendario para liberar os indicadores e os laudos.</p>
            <p className="mt-1 text-sm text-slate-500">Enquanto isso, a tela nao carrega registros pesados desnecessariamente.</p>
          </div>
        </InoveSection>
      )}
    </div>
  );
}
