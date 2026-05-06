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
import {
  FaDownload,
  FaSyncAlt,
  FaTv,
  FaCalendarAlt,
  FaInfoCircle,
  FaTimes,
  FaChartLine,
  FaClipboardList,
  FaBus,
  FaRoad,
  FaExclamationTriangle,
  FaClock,
  FaBolt,
  FaCheckCircle,
  FaFilter,
} from "react-icons/fa";

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

function formatDateBR(value) {
  if (!value) return "—";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(s.includes("T") ? s : `${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("pt-BR");
}

function fmtInt(v) {
  return Math.round(Number(v || 0)).toLocaleString("pt-BR");
}

function fmtNum(v, dec = 2) {
  return Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
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

function CardKPI({ title, value, sub, icon, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <p className="text-2xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
          {sub && <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>}
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function OcorrenciaBadge({ value }) {
  const tipo = labelOcorrenciaTabela(value);
  const color = COLORS[normalizeTipo(value)] || "#334155";

  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider"
      style={{ color, borderColor: color, backgroundColor: `${color}18` }}
    >
      {tipo}
    </span>
  );
}

function ExplicacaoModal({ onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[70] p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4 border-b pb-4 shrink-0">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <FaInfoCircle className="text-blue-600" /> Entender Regras do Dashboard SOS
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="overflow-y-auto pr-2 space-y-5 text-sm text-slate-700">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2">
              <FaFilter className="text-slate-500" /> Base de dados
            </h3>
            <p>
              A tela busca a tabela <strong>sos_acionamentos</strong> pelo período selecionado em
              <strong> data_sos</strong>. O painel do dia busca somente registros cuja data seja o dia atual no fuso de São Paulo.
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2">
              <FaChartLine className="text-blue-600" /> Gráfico por dia
            </h3>
            <p>
              O gráfico considera apenas os tipos principais definidos em <strong>TIPOS_GRAFICO</strong>:
              RECOLHEU, SOS, AVARIA, TROCA e IMPROCEDENTE. A ocorrência <strong>SEGUIU VIAGEM</strong> não entra no gráfico.
            </p>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <h3 className="font-black text-emerald-900 mb-2 flex items-center gap-2">
              <FaRoad className="text-emerald-600" /> MKBF
            </h3>
            <p>
              O MKBF é calculado como <strong>KM Total / Ocorrências válidas</strong>. A regra preservada é:
              ocorrência sem tipo não entra, e <strong>SEGUIU VIAGEM</strong> também não entra no MKBF.
            </p>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <h3 className="font-black text-amber-900 mb-2 flex items-center gap-2">
              <FaBolt className="text-amber-600" /> Atualização automática
            </h3>
            <p>
              O painel mantém as regras originais de <strong>Tempo Real</strong> via channel do Supabase e
              <strong> Auto review a cada 5 minutos</strong>. O modo exibição também preserva fullscreen.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition shadow-md active:scale-95"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SOSDashboard() {
  const fsRef = useRef(null);

  const [mesRef, setMesRef] = useState(() => todayYMD_SP().slice(0, 7));
  const { start: defaultIni, end: defaultFim } = useMemo(() => monthRange(mesRef), [mesRef]);
  const [dataInicio, setDataInicio] = useState(defaultIni);
  const [dataFim, setDataFim] = useState(defaultFim);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

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

        const kmSum = (kmData || []).reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);

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

        const totalPeriodo = Object.values(porTipo).reduce((acc, v) => acc + (v || 0), 0);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_acionamentos" }, () => scheduleReload())
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
        ...Object.entries(cards.porTipo || {}).map(([k, v]) => ({ chave: k, valor: v })),
        { chave: "KM_rodado_periodo", valor: Number(kmPeriodo || 0) },
        { chave: "Ocorrencias_validas_MKBF", valor: Number(ocorrenciasValidasPeriodo || 0) },
        { chave: "MKBF_periodo", valor: Number(mkbfPeriodo || 0) },
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumo);
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `Intervencoes_${dataInicio}_a_${dataFim}_${stamp}.xlsx`);
    } catch (e) {
      setErro(e?.message || "Erro ao gerar Excel do período.");
    } finally {
      setLoading(false);
    }
  }

  const totalKPI = cards.totalPeriodo || 0;

  const abertas = useMemo(() => {
    return (doDia || [])
      .filter((r) => (r?.status || "").toLowerCase() === "aberto" || !r?.ocorrencia)
      .map((r) => r?.numero_sos)
      .filter(Boolean);
  }, [doDia]);

  const mesesSelect = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const ym = `${y}-${m}`;
        return ym;
      }),
    []
  );

  const chartBlock = (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={series} margin={{ top: 25, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} dy={10} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
        />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "20px", fontSize: "12px", fontWeight: "bold" }} />
        {TIPOS_GRAFICO.map((t) => (
          <Bar key={t} dataKey={t} stackId="a" fill={COLORS[t]} radius={[4, 4, 0, 0]} maxBarSize={70}>
            <LabelList dataKey={t} position="center" formatter={(v) => (v > 0 ? v : "")} fill="#ffffff" fontSize={11} fontWeight="bold" />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );

  const tabelaDia = (
    <div className="overflow-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-black uppercase">Etiqueta</th>
            <th className="px-4 py-3 text-left text-xs font-black uppercase">Carro</th>
            <th className="px-4 py-3 text-left text-xs font-black uppercase">Data</th>
            <th className="px-4 py-3 text-left text-xs font-black uppercase">Hora</th>
            <th className="px-4 py-3 text-left text-xs font-black uppercase">Reclamação</th>
            <th className="px-4 py-3 text-right text-xs font-black uppercase">Tipo Ocorrência</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {loading ? (
            <tr>
              <td colSpan="6" className="px-4 py-10 text-center text-slate-500 font-bold">Carregando...</td>
            </tr>
          ) : doDia.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-4 py-10 text-center text-slate-500 font-bold">Nenhuma intervenção hoje.</td>
            </tr>
          ) : (
            doDia.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors" style={{ backgroundColor: ((r.status || "").toLowerCase() === "aberto" || !r.ocorrencia) ? "#FEF3C7" : "transparent" }}>
                <td className="px-4 py-3 font-black text-slate-800">{r.numero_sos || "—"}</td>
                <td className="px-4 py-3 font-bold text-slate-700">{r.veiculo || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateBR(r.data_sos)}</td>
                <td className="px-4 py-3 text-slate-600">{r.hora_sos ? String(r.hora_sos).slice(0, 8) : "—"}</td>
                <td className="px-4 py-3 text-slate-800 max-w-[460px] truncate" title={r.reclamacao_motorista}>{r.reclamacao_motorista || "—"}</td>
                <td className="px-4 py-3 text-right"><OcorrenciaBadge value={r.ocorrencia} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const ExibicaoLayout = (
    <div className="w-full h-full flex flex-col gap-3 p-4 overflow-hidden bg-slate-50 print-gap">
      <div className="flex items-center justify-between shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div>
          <div className="text-sm font-black text-slate-800 uppercase tracking-wide">Dashboard SOS - Modo Exibição</div>
          <div className="text-xs text-slate-500 font-semibold">Período: {formatDateBR(dataInicio)} até {formatDateBR(dataFim)}</div>
        </div>
        <button onClick={toggleModoExibicao} className="bg-rose-600 hover:bg-rose-700 px-4 py-2 rounded-xl text-xs font-black text-white" type="button">
          Sair
        </button>
      </div>

      <div className="grid grid-cols-12 gap-3 min-h-0" style={{ height: "42%" }}>
        <div className="col-span-3 min-h-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-black text-slate-600 uppercase">Ocorrência</div>
            <div className="text-xs font-black text-slate-600 uppercase">Total</div>
          </div>

          <div className="min-h-0 overflow-auto pr-1 space-y-2">
            {TIPOS_GRAFICO.map((t) => (
              <div key={t} className="flex items-center justify-between px-3 py-2 rounded-xl border bg-slate-50">
                <span className="min-w-0 flex-1 pr-2 text-[11px] font-black text-slate-800 truncate">{t}</span>
                <span className="shrink-0 tabular-nums text-[12px] font-black" style={{ color: COLORS[t] || "#1e293b" }}>
                  {cards.porTipo?.[t] || 0}
                </span>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="rounded-xl border bg-slate-50 p-2">
                <div className="text-[10px] text-slate-500 font-black uppercase">Ocorrências</div>
                <div className="text-lg font-black text-slate-900">{ocorrenciasValidasPeriodo || 0}</div>
              </div>
              <div className="rounded-xl border bg-slate-50 p-2">
                <div className="text-[10px] text-slate-500 font-black uppercase">KM Total</div>
                <div className="text-lg font-black text-slate-900">{fmtInt(kmPeriodo)}</div>
              </div>
            </div>

            <div className="rounded-xl border bg-blue-50 p-3">
              <div className="text-[10px] text-blue-700 font-black uppercase">MKBF</div>
              <div className="text-2xl font-black text-slate-900">{fmtNum(mkbfPeriodo, 2)}</div>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-700 font-bold">
                <input type="checkbox" className="h-4 w-4" checked={realtimeOn} onChange={(e) => setRealtimeOn(e.target.checked)} />
                Tempo real
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-700 font-bold">
                <input type="checkbox" className="h-4 w-4" checked={autoRefreshOn} onChange={(e) => setAutoRefreshOn(e.target.checked)} />
                Auto review 5 min
              </label>
            </div>

            <div className="text-[10px] text-slate-500">
              {lastUpdate ? `Atualizado: ${lastUpdate.toLocaleTimeString("pt-BR")}` : "—"}
            </div>
          </div>
        </div>

        <div className="col-span-9 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <div className="text-xs font-black text-slate-800 uppercase">Intervenções por dia</div>
              <div className="text-xs text-slate-600 font-semibold">Acumulado do dia: <span className="font-black text-slate-900">{acumuladoDia}</span></div>
            </div>
            <div className="text-xs font-bold text-slate-600">{new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>
          </div>
          <div className="flex-1 min-h-0 w-full p-2">{chartBlock}</div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3 min-h-0" style={{ height: "53%" }}>
        <div className="col-span-3 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="text-xs font-black text-slate-800 uppercase">Etiquetas em aberto</div>
            <div className="text-xs font-black text-slate-700">({abertas.length})</div>
          </div>
          <div className="p-4 min-h-0 overflow-auto">
            {abertas.length === 0 ? (
              <div className="text-sm text-slate-500 font-bold">Nenhuma etiqueta.</div>
            ) : (
              <div className="space-y-2">
                {abertas.map((n) => (
                  <div key={n} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-lg font-black text-slate-900 tabular-nums">{n}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-9 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div className="font-black text-slate-800 text-sm">Intervenções do dia</div>
            <div className="px-3 py-1 rounded-full bg-blue-50 text-xs font-black text-blue-700 border border-blue-200">Total hoje: {doDia.length}</div>
          </div>
          <div className="flex-1 overflow-auto">{tabelaDia}</div>
        </div>
      </div>
    </div>
  );

  const NormalLayout = (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5 overflow-auto print-gap">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <FaClipboardList /> Intervenções Operacionais
            </div>
            <h1 className="mt-3 text-2xl font-black text-slate-800">Dashboard SOS</h1>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
              <FaCalendarAlt /> Monitoramento de intervenções, etiquetas abertas, MKBF e ocorrências por dia.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={exportExcelPeriodo} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-60 transition shadow-sm">
              <FaDownload /> Exportar Excel
            </button>
            <button onClick={() => setMostrarExplicacao(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition">
              <FaInfoCircle /> Entender Regras
            </button>
            <button onClick={() => fetchDashboard("manual")} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-800 bg-slate-800 text-white font-black hover:bg-slate-700 disabled:opacity-60 transition">
              <FaSyncAlt className={loading ? "animate-spin" : ""} /> Atualizar
            </button>
            <button onClick={toggleModoExibicao} type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 transition">
              <FaTv /> Modo Exibição
            </button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1">Mês referência</label>
            <select value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none bg-white">
              {mesesSelect.map((ym) => <option key={ym} value={ym}>{ym}</option>)}
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1">Período calculado</label>
            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-sm font-black text-slate-700">
              {formatDateBR(dataInicio)} <span className="text-slate-400">até</span> {formatDateBR(dataFim)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-black text-slate-700">
                <input type="checkbox" className="h-4 w-4" checked={realtimeOn} onChange={(e) => setRealtimeOn(e.target.checked)} />
                Tempo real
              </label>
              <label className="flex items-center gap-2 text-xs font-black text-slate-700">
                <input type="checkbox" className="h-4 w-4" checked={autoRefreshOn} onChange={(e) => setAutoRefreshOn(e.target.checked)} />
                Auto 5 min
              </label>
            </div>
            <p className="mt-2 text-[10px] font-bold text-slate-500">
              {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Aguardando atualização"}
            </p>
          </div>
        </div>

        {erro && (
          <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-sm font-bold flex items-center gap-2">
            <FaExclamationTriangle /> {erro}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI title="Total do período" value={loading ? "-" : fmtInt(totalKPI)} sub="Somente tipos do gráfico" icon={<FaClipboardList />} tone="slate" />
        <CardKPI title="Ocorrências MKBF" value={loading ? "-" : fmtInt(ocorrenciasValidasPeriodo)} sub="Exclui Seguiu Viagem" icon={<FaCheckCircle />} tone="blue" />
        <CardKPI title="KM Total" value={loading ? "-" : fmtInt(kmPeriodo)} sub="Base km_rodado_diario" icon={<FaRoad />} tone="emerald" />
        <CardKPI title="MKBF" value={loading ? "-" : fmtNum(mkbfPeriodo, 2)} sub="KM / ocorrências válidas" icon={<FaChartLine />} tone="amber" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-1">
          <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
            <FaFilter className="text-slate-400" /> Ocorrências
          </h3>
          <div className="space-y-2">
            {TIPOS_GRAFICO.map((t) => (
              <div key={t} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[t] }} />
                  <span className="font-black text-xs text-slate-700 truncate">{t}</span>
                </div>
                <span className="font-black text-sm" style={{ color: COLORS[t] }}>{cards.porTipo?.[t] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm xl:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-800">Intervenções por dia</h3>
              <p className="text-xs text-slate-500 font-semibold">Ocorrências empilhadas por tipo no período selecionado</p>
            </div>
          </div>

          {!loading && series.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-sm font-bold text-slate-400">Nenhum registro válido para o gráfico neste período.</div>
          ) : (
            <div className="h-80 w-full print-chart-wrap">{chartBlock}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden xl:col-span-3">
          <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><FaClock className="text-amber-500" /> Etiquetas em aberto</h3>
            <span className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 text-xs font-black">{abertas.length}</span>
          </div>
          <div className="p-5 max-h-[420px] overflow-auto">
            {abertas.length === 0 ? (
              <div className="text-sm font-bold text-slate-400">Nenhuma etiqueta em aberto.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {abertas.map((n) => (
                  <div key={n} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-lg font-black text-slate-900 tabular-nums">{n}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden xl:col-span-9">
          <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2"><FaBus className="text-slate-400" /> Intervenções do dia</h3>
              <p className="text-xs font-semibold text-slate-500">Hoje: {formatDateBR(hoje)}</p>
            </div>
            <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 text-xs font-black">Total hoje: {doDia.length}</span>
          </div>
          {tabelaDia}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border border-slate-200 font-black text-slate-800">
            Carregando Dashboard SOS...
          </div>
        </div>
      )}

      {mostrarExplicacao && <ExplicacaoModal onClose={() => setMostrarExplicacao(false)} />}
    </div>
  );

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div ref={fsRef} className="w-full h-screen bg-slate-50 text-slate-900 overflow-hidden flex flex-col print-tight" style={{ minHeight: 0 }}>
        {modoExibicao ? ExibicaoLayout : NormalLayout}
      </div>
    </>
  );
}
