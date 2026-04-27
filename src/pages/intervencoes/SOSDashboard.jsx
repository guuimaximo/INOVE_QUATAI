import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "../../supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import { FaDownload, FaSyncAlt } from "react-icons/fa";

const COLORS = {
  SOS: "#DC2626",
  RECOLHEU: "#EAB308",
  AVARIA: "#2563EB",
  TROCA: "#EA580C",
  IMPROCEDENTE: "#9333EA",
  "SEGUIU VIAGEM": "#16A34A",
};

const TIPOS_GRAFICO = ["RECOLHEU", "SOS", "AVARIA", "TROCA", "IMPROCEDENTE"];

const TIPOS_TABELA = [
  "SOS",
  "RECOLHEU",
  "AVARIA",
  "TROCA",
  "IMPROCEDENTE",
  "SEGUIU VIAGEM",
];

const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutos

function todayYMD_SP() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

function monthRange(ym) {
  if (!ym) return { start: "", end: "" };
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return { start: "", end: "" };

  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));

  const toYMD = (d) => {
    const yy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  return { start: toYMD(first), end: toYMD(last) };
}

function normalizeTipo(oc) {
  const o = String(oc || "").toUpperCase().trim();
  if (!o) return "";

  if (o === "RA" || o === "R.A" || o === "R.A.") return "RECOLHEU";
  if (o.includes("RECOLH")) return "RECOLHEU";
  if (o.includes("IMPRO")) return "IMPROCEDENTE";
  if (o.includes("TROC")) return "TROCA";
  if (o === "S.O.S") return "SOS";
  if (o.includes("AVARI")) return "AVARIA";
  if (o.includes("SEGUIU")) return "SEGUIU VIAGEM";
  if (TIPOS_TABELA.includes(o)) return o;

  return o;
}

function labelOcorrenciaTabela(oc) {
  const n = normalizeTipo(oc);
  return n ? n : "FECHAR ETIQUETA";
}

function isOcorrenciaValidaParaMKBF(oc) {
  const tipo = normalizeTipo(oc);
  if (!tipo) return false;
  if (tipo === "SEGUIU VIAGEM") return false;
  return true;
}

async function fetchAllPeriodo({ dataInicio, dataFim }) {
  const PAGE = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const { data, error } = await supabase
      .from("sos_acionamentos")
      .select("*")
      .gte("data_sos", dataInicio)
      .lte("data_sos", dataFim)
      .order("data_sos", { ascending: true })
      .order("hora_sos", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;

    const rows = data || [];
    all = all.concat(rows);

    if (rows.length < PAGE) break;
    from += PAGE;
  }

  return all;
}

async function enterFullscreen(el) {
  try {
    const target = el || document.documentElement;
    if (document.fullscreenElement) return;

    if (target.requestFullscreen) return await target.requestFullscreen();
    if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen();
  } catch (e) {
    console.warn("Fullscreen bloqueado:", e);
  }
}

async function exitFullscreen() {
  try {
    if (!document.fullscreenElement) return;

    if (document.exitFullscreen) return await document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
  } catch (e) {
    console.warn("Exit fullscreen bloqueado:", e);
  }
}

export default function SOSDashboard() {
  const fsRef = useRef(null);

  const [mesRef, setMesRef] = useState(() => todayYMD_SP().slice(0, 7));
  const { start: defaultIni, end: defaultFim } = useMemo(
    () => monthRange(mesRef),
    [mesRef]
  );
  const [dataInicio, setDataInicio] = useState(defaultIni);
  const [dataFim, setDataFim] = useState(defaultFim);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [series, setSeries] = useState([]);
  const [cards, setCards] = useState({ totalPeriodo: 0, porTipo: {} });
  const [doDia, setDoDia] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [kmPeriodo, setKmPeriodo] = useState(0);
  const [ocorrenciasValidasPeriodo, setOcorrenciasValidasPeriodo] = useState(0);
  const [mkbfPeriodo, setMkbfPeriodo] = useState(0);

  const [modoExibicao, setModoExibicao] = useState(false);
  const [realtimeOn, setRealtimeOn] = useState(false);
  const [autoRefreshOn, setAutoRefreshOn] = useState(true);

  const debounceRef = useRef(null);
  const channelRef = useRef(null);
  const pollingRef = useRef(null);
  const modoRef = useRef(false);
  const fetchingRef = useRef(false);

  const hoje = todayYMD_SP();
  const acumuladoDia = useMemo(() => (doDia || []).length, [doDia]);

  const PRINT_CSS = `
    @media print {
      .print-tight { padding: 8px !important; }
      .print-tight .print-gap { gap: 8px !important; }
      .print-tight .print-chart-wrap { height: 220px !important; }
      .print-tight table { font-size: 11px !important; }
      .print-tight th, .print-tight td { padding-top: 6px !important; padding-bottom: 6px !important; }
    }
  `;

  useEffect(() => {
    const { start, end } = monthRange(mesRef);
    setDataInicio(start);
    setDataFim(end);
  }, [mesRef]);

  const fetchDashboard = useCallback(
    async (origem = "manual") => {
      if (!dataInicio || !dataFim) return;
      if (fetchingRef.current) return;

      fetchingRef.current = true;
      setLoading(true);
      setErro("");

      try {
        const { data: periodoData, error: periodoErr } = await supabase
          .from("sos_acionamentos")
          .select("id, data_sos, ocorrencia")
          .gte("data_sos", dataInicio)
          .lte("data_sos", dataFim);

        if (periodoErr) throw periodoErr;

        const { data: kmData, error: kmErr } = await supabase
          .from("km_rodado_diario")
          .select("km_total, data")
          .gte("data", dataInicio)
          .lte("data", dataFim);

        if (kmErr) throw kmErr;

        const kmSum = (kmData || []).reduce(
          (acc, r) => acc + (Number(r.km_total) || 0),
          0
        );

        const ocorrValidas = (periodoData || []).reduce((acc, r) => {
          return acc + (isOcorrenciaValidaParaMKBF(r.ocorrencia) ? 1 : 0);
        }, 0);

        setKmPeriodo(kmSum);
        setOcorrenciasValidasPeriodo(ocorrValidas);
        setMkbfPeriodo(ocorrValidas > 0 ? kmSum / ocorrValidas : 0);

        const { data: diaData, error: diaErr } = await supabase
          .from("sos_acionamentos")
          .select(
            "id, numero_sos, data_sos, hora_sos, veiculo, motorista_nome, linha, reclamacao_motorista, ocorrencia, status"
          )
          .eq("data_sos", hoje)
          .order("hora_sos", { ascending: true });

        if (diaErr) throw diaErr;

        const byDay = new Map();
        (periodoData || []).forEach((r) => {
          const day = r.data_sos;
          if (!day) return;

          const tipo = normalizeTipo(r.ocorrencia);
          if (!tipo || !TIPOS_GRAFICO.includes(tipo)) return;

          if (!byDay.has(day)) {
            const base = { day };
            TIPOS_GRAFICO.forEach((t) => (base[t] = 0));
            byDay.set(day, base);
          }

          byDay.get(day)[tipo] = (byDay.get(day)[tipo] || 0) + 1;
        });

        const chart = Array.from(byDay.values())
          .filter((row) => TIPOS_GRAFICO.some((t) => (row[t] || 0) > 0))
          .sort((a, b) => String(a.day).localeCompare(String(b.day)));

        const porTipo = {};
        TIPOS_GRAFICO.forEach((t) => (porTipo[t] = 0));

        (periodoData || []).forEach((r) => {
          const tipo = normalizeTipo(r.ocorrencia);
          if (!tipo || !TIPOS_GRAFICO.includes(tipo)) return;
          porTipo[tipo] = (porTipo[tipo] || 0) + 1;
        });

        const totalPeriodo = Object.values(porTipo).reduce(
          (acc, v) => acc + (v || 0),
          0
        );

        setSeries(chart);
        setCards({ totalPeriodo, porTipo });
        setDoDia(diaData || []);
        setLastUpdate(new Date());

        console.log(`[SOSDashboard] Atualizado via: ${origem}`);
      } catch (e) {
        setErro(e?.message || "Erro ao carregar dashboard.");
        setSeries([]);
        setCards({ totalPeriodo: 0, porTipo: {} });
        setDoDia([]);
        setKmPeriodo(0);
        setOcorrenciasValidasPeriodo(0);
        setMkbfPeriodo(0);
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    },
    [dataInicio, dataFim, hoje]
  );

  function scheduleReload() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchDashboard("realtime"), 600);
  }

  function setupRealtime() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (!realtimeOn) return;

    channelRef.current = supabase
      .channel("realtime-sos_acionamentos-dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_acionamentos" },
        () => scheduleReload()
      )
      .subscribe();
  }

  function setupAutoRefresh() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (!autoRefreshOn) return;

    pollingRef.current = setInterval(() => {
      fetchDashboard("auto-5min");
    }, AUTO_REFRESH_MS);
  }

  useEffect(() => {
    fetchDashboard("init");
  }, [fetchDashboard]);

  useEffect(() => {
    setupRealtime();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeOn]);

  useEffect(() => {
    setupAutoRefresh();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshOn, fetchDashboard]);

  useEffect(() => {
    modoRef.current = modoExibicao;
  }, [modoExibicao]);

  useEffect(() => {
    const onFsChange = () => {
      const isFs = !!document.fullscreenElement;
      if (!isFs && modoRef.current) setModoExibicao(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const toggleModoExibicao = useCallback(async () => {
    const el = fsRef.current;
    if (!modoRef.current) {
      setModoExibicao(true);
      setRealtimeOn(true);
      setAutoRefreshOn(true);
      setTimeout(() => enterFullscreen(el), 50);
    } else {
      await exitFullscreen();
      setModoExibicao(false);
    }
  }, []);

  async function exportExcelPeriodo() {
    if (!dataInicio || !dataFim) return;
    setLoading(true);
    setErro("");
    try {
      const rowsPeriodo = await fetchAllPeriodo({ dataInicio, dataFim });
      const wb = XLSX.utils.book_new();

      const wsPeriodo = XLSX.utils.json_to_sheet(
        (rowsPeriodo || []).map((r) => ({
          ...r,
          ocorrencia_exibida: labelOcorrenciaTabela(r.ocorrencia),
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsPeriodo, "Intervencoes_periodo");

      const wsSerie = XLSX.utils.json_to_sheet(series || []);
      XLSX.utils.book_append_sheet(wb, wsSerie, "Grafico_por_dia");

      const resumo = [
        { chave: "Periodo_inicio", valor: dataInicio },
        { chave: "Periodo_fim", valor: dataFim },
        { chave: "Total_periodo", valor: cards.totalPeriodo || 0 },
        ...Object.entries(cards.porTipo || {}).map(([k, v]) => ({
          chave: k,
          valor: v,
        })),
        { chave: "KM_rodado_periodo", valor: Number(kmPeriodo || 0) },
        {
          chave: "Ocorrencias_validas_MKBF",
          valor: Number(ocorrenciasValidasPeriodo || 0),
        },
        { chave: "MKBF_periodo", valor: Number(mkbfPeriodo || 0) },
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumo);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `Intervencoes_${dataInicio}_a_${dataFim}_${stamp}.xlsx`);
    } catch (e) {
      setErro(e?.message || "Erro ao gerar Excel do período.");
    } finally {
      setLoading(false);
    }
  }

  const totalKPI = cards.totalPeriodo || 0;

  const shell =
    "w-full h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 text-slate-900 overflow-hidden flex flex-col";
  const panel =
    "rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-50 backdrop-blur-sm";
  const titleText =
    "text-sm font-semibold text-slate-800 uppercase tracking-wide";
  const smallText = "text-xs text-slate-600";

  const abertas = useMemo(() => {
    return (doDia || [])
      .filter((r) => (r?.status || "").toLowerCase() === "aberto" || !r?.ocorrencia)
      .map((r) => r?.numero_sos)
      .filter(Boolean);
  }, [doDia]);

  const ExibicaoLayout = (
    <div className="w-full h-full flex flex-col gap-3 p-4 overflow-hidden print-gap">
      <div className="flex items-center justify-between shrink-0">
        <div className={titleText}>Dashboard SOS - Modo Exibição</div>
        <button
          onClick={toggleModoExibicao}
          className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-xs font-semibold text-white"
          type="button"
        >
          Sair
        </button>
      </div>

      <div
        className="grid grid-cols-12 gap-3 min-h-0"
        style={{ minHeight: 0, height: "42%" }}
      >
        <div className="col-span-3 min-h-0">
          <div className={`${panel} h-full min-h-0 overflow-hidden p-2`}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-semibold text-slate-700 uppercase">
                OCORRÊNCIA
              </div>
              <div className="text-xs font-semibold text-slate-700 uppercase text-right">
                TOTAL
              </div>
            </div>

            <div className="min-h-0 overflow-auto pr-1 space-y-1">
              <div className="space-y-1">
                {TIPOS_GRAFICO.map((t) => (
                  <div
                    key={t}
                    className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
                    style={{
                      background: "rgba(0,0,0,0.03)",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <span className="min-w-0 flex-1 pr-2 text-[11px] text-slate-800 truncate">
                      {t}
                    </span>
                    <span
                      className="shrink-0 tabular-nums text-[11px] font-extrabold"
                      style={{ color: COLORS[t] || "#1e293b" }}
                    >
                      {cards.porTipo?.[t] || 0}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className={`${panel} p-2`}>
                  <div className="text-xs text-slate-600 font-semibold">
                    OCORRÊNCIAS
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {ocorrenciasValidasPeriodo || 0}
                  </div>
                </div>

                <div className={`${panel} p-2`}>
                  <div className="text-xs text-slate-600 font-semibold">
                    KM TOTAL
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {Number(kmPeriodo || 0).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-1.5">
                <div className={`${panel} p-2`}>
                  <div className="text-xs text-slate-600 font-semibold">
                    MKBF
                  </div>
                  <div className="text-xl font-extrabold text-slate-900">
                    {Number(mkbfPeriodo || 0).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Ocorr:{" "}
                    <span className="font-semibold text-slate-900">
                      {ocorrenciasValidasPeriodo || 0}
                    </span>
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={realtimeOn}
                      onChange={(e) => setRealtimeOn(e.target.checked)}
                    />
                    Tempo real
                  </label>

                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={autoRefreshOn}
                      onChange={(e) => setAutoRefreshOn(e.target.checked)}
                    />
                    Auto review 5 min
                  </label>
                </div>
              </div>

              <div className="text-[10px] text-slate-500">
                {lastUpdate
                  ? `Atualizado: ${lastUpdate.toLocaleTimeString("pt-BR")}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-9 min-h-0">
          <div
            className={`${panel} w-full h-full flex flex-col min-h-0 overflow-hidden`}
          >
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <div className="text-xs font-semibold text-slate-800 uppercase">
                  Intervenções por dia
                </div>
                <div className="text-xs text-slate-600">
                  Acumulado do dia:{" "}
                  <span className="font-bold text-slate-900">
                    {acumuladoDia}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={mesRef}
                  onChange={(e) => setMesRef(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 outline-none"
                >
                  {Array.from({ length: 12 }).map((_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - i);
                    const ym = `${d.getFullYear()}-${String(
                      d.getMonth() + 1
                    ).padStart(2, "0")}`;
                    return (
                      <option key={ym} value={ym}>
                        {ym}
                      </option>
                    );
                  })}
                </select>

                <div className="text-xs text-slate-600">
                  {new Date().toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 w-full mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={series}
                  margin={{ top: 10, right: 5, left: -25, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.1)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 8, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    dy={5}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 8, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={25}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.05)" }}
                    contentStyle={{
                      background: "#f8fafc",
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    labelStyle={{
                      color: "#1e293b",
                      marginBottom: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={20}
                    iconType="circle"
                    iconSize={6}
                    wrapperStyle={{
                      fontSize: "10px",
                      color: "#64748b",
                      paddingTop: "2px",
                    }}
                  />
                  {TIPOS_GRAFICO.map((t) => (
                    <Bar
                      key={t}
                      dataKey={t}
                      stackId="a"
                      fill={COLORS[t]}
                      maxBarSize={60}
                    >
                      <LabelList
                        dataKey={t}
                        position="center"
                        formatter={(v) => (v > 0 ? v : "")}
                        fill="#ffffff"
                        fontSize={9}
                        fontWeight="bold"
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-12 gap-3 min-h-0"
        style={{ minHeight: 0, height: "53%" }}
      >
        <div className="col-span-3 min-h-0">
          <div className={`${panel} h-full min-h-0 overflow-hidden`}>
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs font-semibold text-slate-800 uppercase">
                Etiquetas em aberto
              </div>
              <div className="text-xs font-bold text-slate-700">
                ({abertas.length})
              </div>
            </div>

            <div className="p-3 min-h-0 overflow-auto">
              {abertas.length === 0 ? (
                <div className="text-sm text-slate-500">Nenhuma etiqueta.</div>
              ) : (
                <div className="space-y-2">
                  {abertas.map((n) => (
                    <div
                      key={n}
                      className="text-lg font-semibold text-slate-900 tabular-nums"
                    >
                      {n}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-9 min-h-0">
          <div className={`${panel} w-full h-full flex flex-col min-h-0 overflow-hidden`}>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="font-semibold text-slate-800 text-sm">
                Intervenções do dia
              </div>
              <div className="px-2 py-0.5 rounded bg-slate-200 text-xs font-bold text-slate-700">
                Total hoje: {doDia.length}
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="sticky top-0 bg-slate-100 z-10 text-xs uppercase font-semibold text-slate-600">
                  <tr>
                    <th className="py-3 px-4">Etiqueta</th>
                    <th className="py-3 px-4">Carro</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Hora</th>
                    <th className="py-3 px-4">Reclamação</th>
                    <th className="py-3 px-4 text-right">Tipo Ocorrência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : doDia.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">
                        Nenhuma intervenção hoje.
                      </td>
                    </tr>
                  ) : (
                    doDia.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:opacity-80 transition-colors"
                        style={{
                          backgroundColor:
                            ((r.status || "").toLowerCase() === "aberto" || !r.ocorrencia)
                              ? "#FEF3C7"
                              : "transparent",
                        }}
                      >
                        <td className="py-2.5 px-4 font-mono text-slate-800">
                          {r.numero_sos || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700">
                          {r.veiculo || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {r.data_sos || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {r.hora_sos ? String(r.hora_sos).slice(0, 8) : "-"}
                        </td>
                        <td
                          className="py-2.5 px-4 text-slate-800 truncate max-w-[420px]"
                          title={r.reclamacao_motorista}
                        >
                          {r.reclamacao_motorista || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span
                            className="font-bold text-xs uppercase tracking-wide px-2 py-1 rounded border-2"
                            style={{
                              color: COLORS[normalizeTipo(r.ocorrencia)] || "#1e293b",
                              borderColor:
                                COLORS[normalizeTipo(r.ocorrencia)] || "#cbd5e1",
                              backgroundColor:
                                (COLORS[normalizeTipo(r.ocorrencia)] || "#cbd5e1") + "15",
                            }}
                          >
                            {labelOcorrenciaTabela(r.ocorrencia)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const NormalLayout = (
    <div
      className="max-w-[1400px] mx-auto p-2 flex flex-col h-full gap-3 print-gap"
      style={{ minHeight: 0 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={mesRef}
            onChange={(e) => setMesRef(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const ym = `${y}-${m}`;
              return (
                <option key={ym} value={ym}>
                  {ym}
                </option>
              );
            })}
          </select>

          <div className={smallText}>
            Período:{" "}
            <span className="font-semibold text-slate-900">{dataInicio}</span>{" "}
            até <span className="font-semibold text-slate-900">{dataFim}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboard("manual")}
            className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
            disabled={loading}
          >
            <FaSyncAlt />
            {loading ? "..." : "Recarregar"}
          </button>

          <button
            onClick={exportExcelPeriodo}
            className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-60"
            disabled={loading}
          >
            <FaDownload />
            Excel
          </button>

          <button
            onClick={toggleModoExibicao}
            className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
            type="button"
          >
            Modo Exibição
          </button>
        </div>
      </div>

      {erro && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {erro}
        </div>
      )}

      <div className="grid grid-cols-12 gap-3 min-h-0" style={{ minHeight: 0 }}>
        <div className="col-span-4 min-h-0">
          <div className={`${panel} h-full min-h-0 overflow-hidden p-3`}>
            <div className="flex items-center justify-between mb-2">
              <div className={titleText}>OCORRÊNCIA</div>
              <div className={`${titleText} text-right`}>TOTAL</div>
            </div>

            <div className="min-h-0 overflow-auto pr-1">
              <div className="space-y-2">
                {TIPOS_GRAFICO.map((t) => (
                  <div
                    key={t}
                    className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
                    style={{
                      background: "rgba(0,0,0,0.03)",
                      border: "1px solid rgba(0,0,0,0.08)",
                    }}
                  >
                    <span className="text-xs text-slate-800">{t}</span>
                    <span
                      className="text-xs font-bold"
                      style={{ color: COLORS[t] }}
                    >
                      {cards.porTipo?.[t] || 0}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <div className={`${panel} p-2`}>
                  <div className="text-xs text-slate-600 font-semibold">
                    TOTAL
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {totalKPI}
                  </div>
                </div>

                <div className={`${panel} p-2`}>
                  <div className="text-xs text-slate-600 font-semibold">
                    KM TOTAL
                  </div>
                  <div className="text-lg font-extrabold text-slate-900">
                    {Number(kmPeriodo || 0).toLocaleString("pt-BR", {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-1.5">
                <div className={`${panel} p-2`}>
                  <div className="text-xs text-slate-600 font-semibold">
                    MKBF
                  </div>
                  <div className="text-xl font-extrabold text-slate-900">
                    {Number(mkbfPeriodo || 0).toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Ocorr:{" "}
                    <span className="font-semibold text-slate-900">
                      {ocorrenciasValidasPeriodo || 0}
                    </span>
                  </div>

                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={realtimeOn}
                      onChange={(e) => setRealtimeOn(e.target.checked)}
                    />
                    Tempo real
                  </label>

                  <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={autoRefreshOn}
                      onChange={(e) => setAutoRefreshOn(e.target.checked)}
                    />
                    Auto review 5 min
                  </label>

                  <div className="text-[11px] text-slate-500 mt-2">
                    {lastUpdate
                      ? `Atualizado: ${lastUpdate.toLocaleString("pt-BR", {
                          timeZone: "America/Sao_Paulo",
                        })}`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-8 min-h-0">
          <div className={`${panel} h-full min-h-0 overflow-hidden p-3`}>
            <div className="flex items-start justify-between">
              <div>
                <div className={titleText}>Intervenções por dia</div>
                <div className={smallText}>
                  Acumulado do dia ({hoje}):{" "}
                  <span className="font-semibold text-slate-900">
                    {acumuladoDia}
                  </span>
                </div>
              </div>
              <div className={smallText}>
                {lastUpdate
                  ? lastUpdate.toLocaleTimeString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })
                  : "—"}
              </div>
            </div>

            <div
              className="print-chart-wrap"
              style={{
                width: "100%",
                height: "clamp(240px, 32vh, 380px)",
                marginTop: 6,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(0,0,0,0.10)"
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(0,0,0,0.04)" }}
                    contentStyle={{
                      background: "#ffffff",
                      border: "1px solid rgba(0,0,0,0.12)",
                      color: "#0f172a",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#334155" }}
                  />
                  <Legend verticalAlign="bottom" height={28} />
                  {TIPOS_GRAFICO.map((t) => (
                    <Bar key={t} dataKey={t} stackId="a" fill={COLORS[t]}>
                      <LabelList
                        dataKey={t}
                        position="center"
                        formatter={(v) => (v > 0 ? v : "")}
                        fill="#ffffff"
                        fontSize={12}
                        fontWeight="bold"
                      />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {!loading && series.length === 0 && (
              <div className="mt-2 text-sm text-slate-600">
                Nenhum registro válido para o gráfico neste período.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className={`${panel} h-full min-h-0 overflow-hidden`}>
          <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className={titleText}>Intervenções do dia</div>
            <div className={smallText}>
              Total hoje:{" "}
              <span className="font-semibold text-slate-900">
                {doDia.length}
              </span>
            </div>
          </div>

          <div
            className="min-h-0 overflow-auto"
            style={{ height: "calc(100% - 42px)" }}
          >
            <table className="min-w-full text-sm text-slate-700">
              <thead className="sticky top-0 bg-slate-100">
                <tr className="text-slate-600 text-xs uppercase font-semibold">
                  <th className="py-2 px-3 text-left">ETIQUETA</th>
                  <th className="py-2 px-3 text-left">CARRO</th>
                  <th className="py-2 px-3 text-left">DATA</th>
                  <th className="py-2 px-3 text-left">HORA</th>
                  <th className="py-2 px-3 text-left">RECLAMAÇÃO</th>
                  <th className="py-2 px-3 text-left">TIPO OCORRÊNCIA</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-slate-500">
                      Carregando...
                    </td>
                  </tr>
                ) : doDia.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-slate-500">
                      Nenhuma intervenção encontrada para hoje.
                    </td>
                  </tr>
                ) : (
                  doDia.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-slate-200 hover:opacity-80 transition-colors"
                      style={{
                        backgroundColor:
                          ((r.status || "").toLowerCase() === "aberto" || !r.ocorrencia)
                            ? "#FEF3C7"
                            : "transparent",
                      }}
                    >
                      <td className="py-2 px-3">{r.numero_sos ?? "—"}</td>
                      <td className="py-2 px-3">{r.veiculo ?? "—"}</td>
                      <td className="py-2 px-3">{r.data_sos ?? "—"}</td>
                      <td className="py-2 px-3">
                        {r.hora_sos ? String(r.hora_sos).slice(0, 8) : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {r.reclamacao_motorista ?? "—"}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="font-bold text-xs uppercase tracking-wide px-2 py-1 rounded border"
                          style={{
                            color:
                              COLORS[normalizeTipo(r.ocorrencia)] || "#0f172a",
                            borderColor:
                              COLORS[normalizeTipo(r.ocorrencia)] || "#cbd5e1",
                            backgroundColor:
                              (COLORS[normalizeTipo(r.ocorrencia)] ||
                                "#cbd5e1") + "15",
                          }}
                        >
                          {labelOcorrenciaTabela(r.ocorrencia)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div ref={fsRef} className={`${shell} print-tight`} style={{ minHeight: 0 }}>
        {modoExibicao ? ExibicaoLayout : NormalLayout}
      </div>
    </>
  );
}
