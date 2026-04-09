import React, { useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaSync,
  FaDownload,
  FaSearch,
  FaChartLine,
  FaRoad,
  FaBus,
  FaTools,
  FaExclamationTriangle,
  FaInfoCircle,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
} from "react-icons/fa";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { supabase } from "../supabase";

const SUPABASE_B_URL =
  import.meta.env.VITE_SUPABASE_B_URL ||
  import.meta.env.VITE_SUPA_BASE_BCNT_URL ||
  import.meta.env.VITE_SUPA_BASE_URL;

const SUPABASE_B_ANON_KEY =
  import.meta.env.VITE_SUPABASE_B_ANON_KEY ||
  import.meta.env.VITE_SUPA_BASE_BCNT_ANON_KEY ||
  import.meta.env.VITE_SUPA_BASE_ANON_KEY;

const supabaseB =
  SUPABASE_B_URL && SUPABASE_B_ANON_KEY
    ? createClient(SUPABASE_B_URL, SUPABASE_B_ANON_KEY)
    : null;

const MKBF_META = 7000;
const TIPOS_GRAFICO = ["RECOLHEU", "SOS", "AVARIA", "TROCA", "IMPROCEDENTE"];

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normalize(v) {
  return String(v || "").trim().toUpperCase();
}

function safeDateStr(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (s.includes("T")) return s.split("T")[0];
  if (s.includes(" ")) return s.split(" ")[0];
  if (s.includes("/")) {
    const p = s.split("/");
    if (p.length === 3) {
      return `${p[2].slice(0, 4)}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
    }
  }
  return s;
}

function parseDateOnly(v) {
  const s = safeDateStr(v);
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateBr(v) {
  const s = safeDateStr(v);
  if (!s) return "-";
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
}

function fmtNum(v, dec = 2) {
  return n(v).toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtInt(v) {
  return Math.round(n(v)).toLocaleString("pt-BR");
}

function fmtPct(v) {
  return `${fmtNum(v, 1)}%`;
}

function monthKey(date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  const meses = [
    "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
    "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
  ];
  return `${meses[n(m) - 1] || m}/${String(y).slice(2)}`;
}

function firstDayOfMonth(key) {
  return key ? new Date(`${key}-01T00:00:00`) : null;
}

function lastDayOfMonth(key) {
  const start = firstDayOfMonth(key);
  if (!start) return null;
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function deriveCluster(prefixo) {
  const v = normalize(prefixo);
  if (!v) return "OUTROS";
  if (v.startsWith("2216")) return "C8";
  if (v.startsWith("2222")) return "C9";
  if (v.startsWith("2224")) return "C10";
  if (v.startsWith("2425")) return "C11";
  if (v.startsWith("W")) return "C6";
  return "OUTROS";
}

function normalizeTipo(oc) {
  const o = normalize(oc);
  if (!o) return "";
  if (["RA", "R.A", "R.A."].includes(o)) return "RECOLHEU";
  if (o.includes("RECOLH")) return "RECOLHEU";
  if (o.includes("IMPRO")) return "IMPROCEDENTE";
  if (o.includes("TROC")) return "TROCA";
  if (o === "S.O.S") return "SOS";
  if (o.includes("AVARI")) return "AVARIA";
  if (o.includes("SEGUIU")) return "SEGUIU VIAGEM";
  return o;
}

function isOcorrenciaValidaParaMkbf(oc) {
  const tipo = normalizeTipo(oc);
  return !!tipo && tipo !== "SEGUIU VIAGEM";
}

function variancePct(atual, anterior) {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

function statusBadge(status) {
  const s = normalize(status);
  if (s === "FECHADO") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "ABERTO") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function EvolucaoBadge({ value, invert = false }) {
  const val = n(value);
  if (val > 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${invert ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
        <FaArrowUp size={10} /> {fmtPct(Math.abs(val))}
      </span>
    );
  }
  if (val < 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${invert ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
        <FaArrowDown size={10} /> {fmtPct(Math.abs(val))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
      <FaEquals size={10} /> 0,0%
    </span>
  );
}

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) return;
  const cols = Object.keys(dados[0]).filter((k) => typeof dados[0][k] !== "object");
  const csv = [
    cols.join(";"),
    ...dados.map((row) =>
      cols.map((col) => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function fetchAllPeriod({ table, select, dateField, startDate, endDate, pageSize = 1000, maxRows = 200000 }) {
  if (!supabaseB) throw new Error("Supabase B não configurado.");
  let all = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseB
      .from(table)
      .select(select)
      .gte(dateField, startDate)
      .lte(dateField, endDate)
      .order(dateField, { ascending: true })
      .range(from, to);

    if (error) throw error;

    const chunk = data || [];
    all = all.concat(chunk);

    if (chunk.length < pageSize) break;
    if (all.length >= maxRows) {
      all = all.slice(0, maxRows);
      break;
    }

    from += pageSize;
  }

  return all;
}

function CardKPI({ title, value, sub, icon, tone = "blue" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <p className="text-2xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
          <p className="text-xs mt-2 text-slate-600 font-semibold">{sub}</p>
        </div>
        <div className="text-xl mt-1">{icon}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-black transition ${
        active
          ? "bg-slate-800 text-white border-slate-800 shadow"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

export default function SOS_Resumo() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [kmRows, setKmRows] = useState([]);
  const [sosRows, setSosRows] = useState([]);

  const [abaAtiva, setAbaAtiva] = useState("VISAO_GERAL");
  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  async function carregarTudo() {
    setLoading(true);
    setErro("");
    try {
      const hoje = new Date();
      const inicioHist = addMonths(new Date(hoje.getFullYear(), hoje.getMonth(), 1), -11);
      const fimHist = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      const iniStr = monthKey(inicioHist) + "-01";
      const fimStr = safeDateStr(fimHist.toISOString());

      const [kmData, sosData] = await Promise.all([
        fetchAllPeriod({
          table: "km_rodado_diario",
          select: "data, km_total",
          dateField: "data",
          startDate: iniStr,
          endDate: fimStr,
        }),
        fetchAllPeriod({
          table: "sos_acionamentos",
          select: "id, numero_sos, data_sos, hora_sos, veiculo, linha, ocorrencia, status, problema_encontrado, setor_manutencao",
          dateField: "data_sos",
          startDate: iniStr,
          endDate: fimStr,
        }),
      ]);

      setKmRows(kmData || []);
      setSosRows(sosData || []);
    } catch (e) {
      console.error(e);
      setErro(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  const kmProcessado = useMemo(() => {
    const map = new Map();
    (kmRows || []).forEach((r) => {
      const data = safeDateStr(r.data);
      if (!data) return;
      map.set(data, n(map.get(data)) + n(r.km_total));
    });
    return [...map.entries()]
      .map(([data, km_total]) => ({ data, km_total }))
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [kmRows]);

  const sosProcessado = useMemo(() => {
    return (sosRows || [])
      .map((r) => {
        const data_sos = safeDateStr(r.data_sos);
        const tipo_norm = normalizeTipo(r.ocorrencia);
        return {
          ...r,
          data_sos,
          tipo_norm,
          valida_mkbf: isOcorrenciaValidaParaMkbf(r.ocorrencia),
          linha: normalize(r.linha) || "N/D",
          veiculo: String(r.veiculo || "").trim() || "N/D",
          status: normalize(r.status) || "N/D",
          problema_encontrado: String(r.problema_encontrado || "").trim() || "N/D",
          setor_manutencao: String(r.setor_manutencao || "").trim() || "N/D",
          cluster: deriveCluster(r.veiculo),
          mes_key: data_sos ? data_sos.slice(0, 7) : "",
        };
      })
      .filter((r) => r.data_sos);
  }, [sosRows]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set([
      ...kmProcessado.map((r) => String(r.data).slice(0, 7)),
      ...sosProcessado.map((r) => r.mes_key),
    ].filter(Boolean));
    return [...set].sort();
  }, [kmProcessado, sosProcessado]);

  useEffect(() => {
    if (!mesReferencia && mesesDisponiveis.length) {
      setMesReferencia(mesesDisponiveis[mesesDisponiveis.length - 1]);
    }
  }, [mesReferencia, mesesDisponiveis]);

  const mesComparacao = useMemo(() => {
    const idx = mesesDisponiveis.indexOf(mesReferencia);
    return idx > 0 ? mesesDisponiveis[idx - 1] : "";
  }, [mesReferencia, mesesDisponiveis]);

  const linhaOptions = useMemo(
    () => [...new Set(sosProcessado.map((r) => r.linha).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sosProcessado]
  );

  const setorOptions = useMemo(
    () => [...new Set(sosProcessado.map((r) => r.setor_manutencao).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sosProcessado]
  );

  const clusterOptions = useMemo(
    () => [...new Set(sosProcessado.map((r) => r.cluster).filter(Boolean))].sort(),
    [sosProcessado]
  );

  const tipoOptions = useMemo(
    () => [...new Set(sosProcessado.map((r) => r.tipo_norm).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [sosProcessado]
  );

  const sosFiltrado = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return sosProcessado.filter((r) => {
      if (mesReferencia && ![mesReferencia, mesComparacao].includes(r.mes_key)) return false;
      if (filtroLinha && r.linha !== filtroLinha) return false;
      if (filtroSetor && r.setor_manutencao !== filtroSetor) return false;
      if (filtroTipo && r.tipo_norm !== filtroTipo) return false;
      if (filtroCluster && r.cluster !== filtroCluster) return false;
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (!q) return true;
      return [
        r.numero_sos,
        r.veiculo,
        r.linha,
        r.tipo_norm,
        r.problema_encontrado,
        r.setor_manutencao,
        r.status,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [sosProcessado, mesReferencia, mesComparacao, filtroLinha, filtroSetor, filtroTipo, filtroCluster, filtroStatus, busca]);

  const sosReferencia = useMemo(() => sosFiltrado.filter((r) => r.mes_key === mesReferencia), [sosFiltrado, mesReferencia]);
  const sosComparacao = useMemo(() => sosFiltrado.filter((r) => r.mes_key === mesComparacao), [sosFiltrado, mesComparacao]);

  const kmMesMap = useMemo(() => {
    const map = new Map();
    kmProcessado.forEach((r) => {
      const key = String(r.data).slice(0, 7);
      map.set(key, n(map.get(key)) + n(r.km_total));
    });
    return map;
  }, [kmProcessado]);

  const resumoAtual = useMemo(() => {
    const kmTotal = n(kmMesMap.get(mesReferencia));
    const interv = sosReferencia.filter((r) => r.valida_mkbf).length;
    const mkbf = interv > 0 ? kmTotal / interv : 0;
    const porTipoMap = {};
    TIPOS_GRAFICO.forEach((t) => (porTipoMap[t] = 0));
    sosReferencia.forEach((r) => {
      if (TIPOS_GRAFICO.includes(r.tipo_norm)) porTipoMap[r.tipo_norm] += 1;
    });
    return { kmTotal, interv, mkbf, porTipoMap };
  }, [kmMesMap, mesReferencia, sosReferencia]);

  const resumoAnt = useMemo(() => {
    const kmTotal = n(kmMesMap.get(mesComparacao));
    const interv = sosComparacao.filter((r) => r.valida_mkbf).length;
    const mkbf = interv > 0 ? kmTotal / interv : 0;
    const porTipoMap = {};
    TIPOS_GRAFICO.forEach((t) => (porTipoMap[t] = 0));
    sosComparacao.forEach((r) => {
      if (TIPOS_GRAFICO.includes(r.tipo_norm)) porTipoMap[r.tipo_norm] += 1;
    });
    return { kmTotal, interv, mkbf, porTipoMap };
  }, [kmMesMap, mesComparacao, sosComparacao]);

  const aderenciaMetaPct = useMemo(() => (MKBF_META > 0 ? (resumoAtual.mkbf / MKBF_META) * 100 : 0), [resumoAtual.mkbf]);

  const diarioAtual = useMemo(() => {
    if (!mesReferencia) return [];
    const start = firstDayOfMonth(mesReferencia);
    const end = lastDayOfMonth(mesReferencia);
    if (!start || !end) return [];

    const mapInterv = new Map();
    sosReferencia.filter((r) => r.valida_mkbf).forEach((r) => {
      mapInterv.set(r.data_sos, n(mapInterv.get(r.data_sos)) + 1);
    });

    return kmProcessado
      .filter((r) => {
        const d = parseDateOnly(r.data);
        return d && d >= start && d <= end;
      })
      .map((r) => {
        const intervencoes = n(mapInterv.get(r.data));
        const mkbf = intervencoes > 0 ? n(r.km_total) / intervencoes : 0;
        return {
          data: r.data,
          dia: fmtDateBr(r.data).slice(0, 5),
          km_total: n(r.km_total),
          intervencoes,
          mkbf,
        };
      });
  }, [mesReferencia, kmProcessado, sosReferencia]);

  const historico12m = useMemo(() => {
    return mesesDisponiveis.slice(-12).map((mes) => {
      const kmTotal = n(kmMesMap.get(mes));
      const interv = sosProcessado.filter((r) => r.mes_key === mes && r.valida_mkbf).length;
      return {
        mes,
        mesLabel: monthLabelFromKey(mes),
        kmTotal,
        intervencoes: interv,
        mkbf: interv > 0 ? kmTotal / interv : 0,
        meta: MKBF_META,
      };
    });
  }, [mesesDisponiveis, kmMesMap, sosProcessado]);

  const tabelaLinhas = useMemo(() => {
    const linhas = [...new Set(sosReferencia.map((r) => r.linha))];
    return linhas
      .map((linha) => {
        const atual = sosReferencia.filter((r) => r.linha === linha && r.valida_mkbf);
        const anterior = sosComparacao.filter((r) => r.linha === linha && r.valida_mkbf);
        const atualTotal = atual.length;
        const antTotal = anterior.length;
        const avaria = atual.filter((r) => r.tipo_norm === "AVARIA").length;
        const recolheu = atual.filter((r) => r.tipo_norm === "RECOLHEU").length;
        const troca = atual.filter((r) => r.tipo_norm === "TROCA").length;
        const improcedente = atual.filter((r) => r.tipo_norm === "IMPROCEDENTE").length;
        const defeitoTop = atual.length
          ? Object.entries(atual.reduce((acc, r) => {
              acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
              return acc;
            }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D"
          : "N/D";

        return {
          linha,
          atual: atualTotal,
          anterior: antTotal,
          variacao_pct: variancePct(atualTotal, antTotal),
          avaria,
          recolheu,
          troca,
          improcedente,
          defeitoTop,
        };
      })
      .sort((a, b) => b.atual - a.atual);
  }, [sosReferencia, sosComparacao]);

  const tabelaVeiculos = useMemo(() => {
    const map = new Map();
    sosReferencia.filter((r) => r.valida_mkbf).forEach((r) => {
      const key = r.veiculo;
      if (!map.has(key)) {
        map.set(key, {
          veiculo: key,
          cluster: r.cluster,
          linhaTop: r.linha,
          total: 0,
          avaria: 0,
          recolheu: 0,
          troca: 0,
          setorTop: "N/D",
          defeitoTop: "N/D",
          detalheSetor: {},
          detalheDefeito: {},
        });
      }
      const item = map.get(key);
      item.total += 1;
      if (r.tipo_norm === "AVARIA") item.avaria += 1;
      if (r.tipo_norm === "RECOLHEU") item.recolheu += 1;
      if (r.tipo_norm === "TROCA") item.troca += 1;
      item.detalheSetor[r.setor_manutencao] = n(item.detalheSetor[r.setor_manutencao]) + 1;
      item.detalheDefeito[r.problema_encontrado] = n(item.detalheDefeito[r.problema_encontrado]) + 1;
    });

    return [...map.values()]
      .map((r) => ({
        ...r,
        setorTop: Object.entries(r.detalheSetor).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        defeitoTop: Object.entries(r.detalheDefeito).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      }))
      .sort((a, b) => b.total - a.total);
  }, [sosReferencia]);

  const tabelaSetores = useMemo(() => {
    const map = new Map();
    sosReferencia.filter((r) => r.valida_mkbf).forEach((r) => {
      const key = r.setor_manutencao;
      if (!map.has(key)) {
        map.set(key, {
          setor: key,
          total: 0,
          avaria: 0,
          recolheu: 0,
          linhas: new Set(),
          veiculos: new Set(),
          defeitos: {},
        });
      }
      const item = map.get(key);
      item.total += 1;
      if (r.tipo_norm === "AVARIA") item.avaria += 1;
      if (r.tipo_norm === "RECOLHEU") item.recolheu += 1;
      item.linhas.add(r.linha);
      item.veiculos.add(r.veiculo);
      item.defeitos[r.problema_encontrado] = n(item.defeitos[r.problema_encontrado]) + 1;
    });

    return [...map.values()]
      .map((r) => ({
        setor: r.setor,
        total: r.total,
        avaria: r.avaria,
        recolheu: r.recolheu,
        linhas: r.linhas.size,
        veiculos: r.veiculos.size,
        defeitoTop: Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      }))
      .sort((a, b) => b.total - a.total);
  }, [sosReferencia]);

  const top5Linhas3m = useMemo(() => {
    if (!mesReferencia) return [];
    const ref = firstDayOfMonth(mesReferencia);
    if (!ref) return [];
    const months3 = [addMonths(ref, -2), addMonths(ref, -1), ref].map(monthKey);
    const base = sosProcessado.filter((r) => months3.includes(r.mes_key) && r.valida_mkbf);
    const counts = new Map();
    base.forEach((r) => {
      if (!counts.has(r.linha)) counts.set(r.linha, []);
      counts.get(r.linha).push(r);
    });
    return [...counts.entries()]
      .map(([linha, itens]) => ({
        linha,
        total: itens.length,
        maiorDefeito:
          Object.entries(itens.reduce((acc, r) => {
            acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
            return acc;
          }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [mesReferencia, sosProcessado]);

  const top5Veiculos3m = useMemo(() => {
    if (!mesReferencia) return [];
    const ref = firstDayOfMonth(mesReferencia);
    if (!ref) return [];
    const months3 = [addMonths(ref, -2), addMonths(ref, -1), ref].map(monthKey);
    const base = sosProcessado.filter((r) => months3.includes(r.mes_key) && r.valida_mkbf);
    const counts = new Map();
    base.forEach((r) => {
      if (!counts.has(r.veiculo)) counts.set(r.veiculo, []);
      counts.get(r.veiculo).push(r);
    });
    return [...counts.entries()]
      .map(([veiculo, itens]) => {
        const porMes = Object.fromEntries(months3.map((m) => [monthLabelFromKey(m), 0]));
        itens.forEach((r) => { porMes[monthLabelFromKey(r.mes_key)] = n(porMes[monthLabelFromKey(r.mes_key)]) + 1; });
        const topDefeitos = Object.entries(itens.reduce((acc, r) => {
          acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
          return acc;
        }, {}))
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, v]) => `${k} (${v})`)
          .join(" | ");
        return {
          veiculo,
          total: itens.length,
          cluster: itens[0]?.cluster || "OUTROS",
          ...porMes,
          topDefeitos: topDefeitos || "N/D",
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [mesReferencia, sosProcessado]);

  const graficoTipos = useMemo(() => {
    return TIPOS_GRAFICO.map((tipo) => ({
      tipo,
      anterior: n(resumoAnt.porTipoMap?.[tipo]),
      atual: n(resumoAtual.porTipoMap?.[tipo]),
    }));
  }, [resumoAtual, resumoAnt]);

  const exportAtual = () => {
    if (abaAtiva === "VISAO_GERAL") {
      exportarCSV(
        historico12m.map((r) => ({
          Mês: r.mesLabel,
          KM: fmtInt(r.kmTotal),
          Intervenções: fmtInt(r.intervencoes),
          MKBF: fmtNum(r.mkbf),
          Meta: fmtNum(r.meta),
        })),
        "SOS_Resumo_VisaoGeral"
      );
    }
    if (abaAtiva === "DIARIO") {
      exportarCSV(
        diarioAtual.map((r) => ({
          Data: fmtDateBr(r.data),
          KM: fmtInt(r.km_total),
          Intervenções: fmtInt(r.intervencoes),
          MKBF: fmtNum(r.mkbf),
        })),
        "SOS_Resumo_Diario"
      );
    }
    if (abaAtiva === "LINHAS") {
      exportarCSV(
        tabelaLinhas.map((r) => ({
          Linha: r.linha,
          Atual: r.atual,
          Anterior: r.anterior,
          "Variação %": fmtNum(r.variacao_pct, 1),
          Avaria: r.avaria,
          Recolheu: r.recolheu,
          Troca: r.troca,
          Improcedente: r.improcedente,
          "Maior Defeito": r.defeitoTop,
        })),
        "SOS_Resumo_Linhas"
      );
    }
    if (abaAtiva === "VEICULOS") {
      exportarCSV(
        tabelaVeiculos.map((r) => ({
          Veículo: r.veiculo,
          Cluster: r.cluster,
          Total: r.total,
          Avaria: r.avaria,
          Recolheu: r.recolheu,
          Troca: r.troca,
          "Setor Top": r.setorTop,
          "Defeito Top": r.defeitoTop,
        })),
        "SOS_Resumo_Veiculos"
      );
    }
    if (abaAtiva === "SETORES") {
      exportarCSV(
        tabelaSetores.map((r) => ({
          Setor: r.setor,
          Total: r.total,
          Avaria: r.avaria,
          Recolheu: r.recolheu,
          Linhas: r.linhas,
          Veículos: r.veiculos,
          "Defeito Top": r.defeitoTop,
        })),
        "SOS_Resumo_Setores"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
              <FaBolt /> Resumo SOS / Manutenção
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">Painel SOS_Resumo</h1>
            <p className="text-sm text-slate-500 mt-1">
              Metodologia espelhada no painel de diesel, adaptada para SOS, MKBF, linhas, veículos, setores e defeitos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportAtual}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition"
            >
              <FaDownload /> Baixar Excel
            </button>
            <button
              onClick={() => setMostrarExplicacao((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition"
            >
              <FaInfoCircle /> {mostrarExplicacao ? "Ocultar Cálculos" : "Entender Cálculos"}
            </button>
            <button
              onClick={carregarTudo}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition"
            >
              <FaSync /> Atualizar
            </button>
          </div>
        </div>

        {mostrarExplicacao && (
          <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm space-y-2">
            <p><strong>MKBF:</strong> KM total do mês dividido pelas intervenções válidas do mês.</p>
            <p><strong>Intervenções válidas:</strong> entram SOS, RECOLHEU, AVARIA, TROCA e IMPROCEDENTE. "SEGUIU VIAGEM" fica fora do MKBF.</p>
            <p><strong>Comparativo:</strong> sempre compara o mês de referência com o mês imediatamente anterior.</p>
            <p><strong>Linhas, veículos e setores:</strong> usam a mesma base filtrada da referência para manter os cards coerentes com o resultado visível.</p>
            <p><strong>Top 5 de 3 meses:</strong> consolida mês atual + 2 meses anteriores para encontrar reincidência estrutural.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mt-4">
          <div className="xl:col-span-2 relative">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar SOS, veículo, linha, defeito, setor..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <select value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Mês referência</option>
            {mesesDisponiveis.map((m) => <option key={m} value={m}>{monthLabelFromKey(m)}</option>)}
          </select>

          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todas as linhas</option>
            {linhaOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os setores</option>
            {setorOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os tipos</option>
            {tipoOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          <select value={filtroCluster} onChange={(e) => setFiltroCluster(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os clusters</option>
            {clusterOptions.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os status</option>
            <option value="ABERTO">ABERTO</option>
            <option value="FECHADO">FECHADO</option>
          </select>

          <button
            onClick={() => {
              setBusca("");
              setFiltroLinha("");
              setFiltroSetor("");
              setFiltroTipo("");
              setFiltroCluster("");
              setFiltroStatus("");
            }}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 font-black text-slate-700"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {erro && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 font-semibold">
          Erro ao carregar dados: {erro}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <CardKPI
          title="MKBF"
          value={fmtNum(resumoAtual.mkbf)}
          sub={`Meta ${fmtNum(MKBF_META)} | ${monthLabelFromKey(mesReferencia)}`}
          icon={<FaChartLine />}
          tone="blue"
        />
        <CardKPI
          title="Intervenções"
          value={fmtInt(resumoAtual.interv)}
          sub="Ocorrências válidas para o indicador"
          icon={<FaExclamationTriangle />}
          tone="rose"
        />
        <CardKPI
          title="KM Rodado"
          value={fmtInt(resumoAtual.kmTotal)}
          sub="Base km_rodado_diario do mês"
          icon={<FaRoad />}
          tone="emerald"
        />
        <CardKPI
          title="Aderência Meta"
          value={fmtPct(aderenciaMetaPct)}
          sub="Percentual do MKBF realizado sobre a meta"
          icon={<FaBolt />}
          tone="amber"
        />
        <CardKPI
          title="Top Defeito"
          value={tabelaSetores[0]?.defeitoTop || top5Linhas3m[0]?.maiorDefeito || "N/D"}
          sub="Maior pressão na fotografia filtrada"
          icon={<FaTools />}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">MKBF vs mês anterior</p>
            <p className="text-xl font-black text-slate-800 mt-1">{fmtNum(resumoAnt.mkbf)} → {fmtNum(resumoAtual.mkbf)}</p>
          </div>
          <EvolucaoBadge value={variancePct(resumoAtual.mkbf, resumoAnt.mkbf)} />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Intervenções vs mês anterior</p>
            <p className="text-xl font-black text-slate-800 mt-1">{fmtInt(resumoAnt.interv)} → {fmtInt(resumoAtual.interv)}</p>
          </div>
          <EvolucaoBadge value={variancePct(resumoAtual.interv, resumoAnt.interv)} invert />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">KM vs mês anterior</p>
            <p className="text-xl font-black text-slate-800 mt-1">{fmtInt(resumoAnt.kmTotal)} → {fmtInt(resumoAtual.kmTotal)}</p>
          </div>
          <EvolucaoBadge value={variancePct(resumoAtual.kmTotal, resumoAnt.kmTotal)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={abaAtiva === "VISAO_GERAL"} onClick={() => setAbaAtiva("VISAO_GERAL")} icon={<FaChartLine />}>Visão Geral</TabButton>
        <TabButton active={abaAtiva === "DIARIO"} onClick={() => setAbaAtiva("DIARIO")} icon={<FaRoad />}>Diário</TabButton>
        <TabButton active={abaAtiva === "LINHAS"} onClick={() => setAbaAtiva("LINHAS")} icon={<FaBus />}>Linhas</TabButton>
        <TabButton active={abaAtiva === "VEICULOS"} onClick={() => setAbaAtiva("VEICULOS")} icon={<FaBus />}>Veículos</TabButton>
        <TabButton active={abaAtiva === "SETORES"} onClick={() => setAbaAtiva("SETORES")} icon={<FaTools />}>Setores & Defeitos</TabButton>
      </div>

      {abaAtiva === "VISAO_GERAL" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-slate-800">Histórico 12 meses - MKBF</h3>
                <span className="text-xs font-bold text-slate-500">Meta fixa {fmtNum(MKBF_META)}</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historico12m}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mesLabel" />
                    <YAxis />
                    <Tooltip formatter={(v) => fmtNum(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="mkbf" name="MKBF" strokeWidth={3} />
                    <Line type="monotone" dataKey="meta" name="Meta" strokeDasharray="6 4" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-slate-800">Tipos de ocorrência</h3>
                <span className="text-xs font-bold text-slate-500">Mês atual x anterior</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficoTipos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tipo" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="anterior" name="Anterior" />
                    <Bar dataKey="atual" name="Atual" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <h3 className="text-lg font-black text-slate-800 mb-3">Top 5 linhas - últimos 3 meses</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-3 py-3 text-left">Linha</th>
                      <th className="px-3 py-3 text-left">Intervenções</th>
                      <th className="px-3 py-3 text-left">Maior defeito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Linhas3m.map((r) => (
                      <tr key={r.linha} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-black text-slate-800">{r.linha}</td>
                        <td className="px-3 py-3">{fmtInt(r.total)}</td>
                        <td className="px-3 py-3">{r.maiorDefeito}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <h3 className="text-lg font-black text-slate-800 mb-3">Top 5 veículos - últimos 3 meses</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-3 py-3 text-left">Veículo</th>
                      <th className="px-3 py-3 text-left">Cluster</th>
                      <th className="px-3 py-3 text-left">Total</th>
                      {top5Veiculos3m[0] && Object.keys(top5Veiculos3m[0]).filter((k) => k.includes("/")).map((m) => (
                        <th key={m} className="px-3 py-3 text-left">{m}</th>
                      ))}
                      <th className="px-3 py-3 text-left">Top defeitos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Veiculos3m.map((r) => (
                      <tr key={r.veiculo} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                        <td className="px-3 py-3">{r.cluster}</td>
                        <td className="px-3 py-3">{fmtInt(r.total)}</td>
                        {Object.keys(r).filter((k) => k.includes("/")).map((m) => (
                          <td key={m} className="px-3 py-3">{fmtInt(r[m])}</td>
                        ))}
                        <td className="px-3 py-3">{r.topDefeitos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === "DIARIO" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Intervenções por dia</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diarioAtual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="intervencoes" name="Intervenções">
                    {diarioAtual.map((_, i) => <Cell key={i} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">MKBF diário</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={diarioAtual}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis />
                  <Tooltip formatter={(v) => fmtNum(v)} />
                  <Line type="monotone" dataKey="mkbf" name="MKBF" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 xl:col-span-2">
            <h3 className="text-lg font-black text-slate-800 mb-3">Detalhe diário</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                  <tr>
                    <th className="px-3 py-3 text-left">Data</th>
                    <th className="px-3 py-3 text-left">KM</th>
                    <th className="px-3 py-3 text-left">Intervenções</th>
                    <th className="px-3 py-3 text-left">MKBF</th>
                  </tr>
                </thead>
                <tbody>
                  {diarioAtual.map((r) => (
                    <tr key={r.data} className="border-b last:border-b-0">
                      <td className="px-3 py-3 font-semibold">{fmtDateBr(r.data)}</td>
                      <td className="px-3 py-3">{fmtInt(r.km_total)}</td>
                      <td className="px-3 py-3">{fmtInt(r.intervencoes)}</td>
                      <td className="px-3 py-3 font-black text-slate-800">{fmtNum(r.mkbf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === "LINHAS" && (
        <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
          <h3 className="text-lg font-black text-slate-800 mb-3">Leitura por linha</h3>
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-3 py-3 text-left">Linha</th>
                <th className="px-3 py-3 text-left">Atual</th>
                <th className="px-3 py-3 text-left">Anterior</th>
                <th className="px-3 py-3 text-left">Variação</th>
                <th className="px-3 py-3 text-left">Avaria</th>
                <th className="px-3 py-3 text-left">Recolheu</th>
                <th className="px-3 py-3 text-left">Troca</th>
                <th className="px-3 py-3 text-left">Improcedente</th>
                <th className="px-3 py-3 text-left">Maior defeito</th>
              </tr>
            </thead>
            <tbody>
              {tabelaLinhas.map((r) => (
                <tr key={r.linha} className="border-b last:border-b-0">
                  <td className="px-3 py-3 font-black text-slate-800">{r.linha}</td>
                  <td className="px-3 py-3">{fmtInt(r.atual)}</td>
                  <td className="px-3 py-3">{fmtInt(r.anterior)}</td>
                  <td className="px-3 py-3"><EvolucaoBadge value={r.variacao_pct} invert /></td>
                  <td className="px-3 py-3">{fmtInt(r.avaria)}</td>
                  <td className="px-3 py-3">{fmtInt(r.recolheu)}</td>
                  <td className="px-3 py-3">{fmtInt(r.troca)}</td>
                  <td className="px-3 py-3">{fmtInt(r.improcedente)}</td>
                  <td className="px-3 py-3">{r.defeitoTop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abaAtiva === "VEICULOS" && (
        <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
          <h3 className="text-lg font-black text-slate-800 mb-3">Top veículos do mês</h3>
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
              <tr>
                <th className="px-3 py-3 text-left">Veículo</th>
                <th className="px-3 py-3 text-left">Cluster</th>
                <th className="px-3 py-3 text-left">Total</th>
                <th className="px-3 py-3 text-left">Avaria</th>
                <th className="px-3 py-3 text-left">Recolheu</th>
                <th className="px-3 py-3 text-left">Troca</th>
                <th className="px-3 py-3 text-left">Setor Top</th>
                <th className="px-3 py-3 text-left">Defeito Top</th>
              </tr>
            </thead>
            <tbody>
              {tabelaVeiculos.map((r) => (
                <tr key={r.veiculo} className="border-b last:border-b-0">
                  <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                  <td className="px-3 py-3">{r.cluster}</td>
                  <td className="px-3 py-3">{fmtInt(r.total)}</td>
                  <td className="px-3 py-3">{fmtInt(r.avaria)}</td>
                  <td className="px-3 py-3">{fmtInt(r.recolheu)}</td>
                  <td className="px-3 py-3">{fmtInt(r.troca)}</td>
                  <td className="px-3 py-3">{r.setorTop}</td>
                  <td className="px-3 py-3">{r.defeitoTop}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {abaAtiva === "SETORES" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Leitura por setor</h3>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Setor</th>
                  <th className="px-3 py-3 text-left">Total</th>
                  <th className="px-3 py-3 text-left">Avaria</th>
                  <th className="px-3 py-3 text-left">Recolheu</th>
                  <th className="px-3 py-3 text-left">Linhas</th>
                  <th className="px-3 py-3 text-left">Veículos</th>
                  <th className="px-3 py-3 text-left">Defeito Top</th>
                </tr>
              </thead>
              <tbody>
                {tabelaSetores.map((r) => (
                  <tr key={r.setor} className="border-b last:border-b-0">
                    <td className="px-3 py-3 font-black text-slate-800">{r.setor}</td>
                    <td className="px-3 py-3">{fmtInt(r.total)}</td>
                    <td className="px-3 py-3">{fmtInt(r.avaria)}</td>
                    <td className="px-3 py-3">{fmtInt(r.recolheu)}</td>
                    <td className="px-3 py-3">{fmtInt(r.linhas)}</td>
                    <td className="px-3 py-3">{fmtInt(r.veiculos)}</td>
                    <td className="px-3 py-3">{r.defeitoTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Detalhe bruto filtrado</h3>
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Data</th>
                  <th className="px-3 py-3 text-left">SOS</th>
                  <th className="px-3 py-3 text-left">Veículo</th>
                  <th className="px-3 py-3 text-left">Linha</th>
                  <th className="px-3 py-3 text-left">Tipo</th>
                  <th className="px-3 py-3 text-left">Setor</th>
                  <th className="px-3 py-3 text-left">Problema</th>
                  <th className="px-3 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {sosReferencia.slice(0, 200).map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-3">{fmtDateBr(r.data_sos)}</td>
                    <td className="px-3 py-3 font-semibold">{r.numero_sos || "-"}</td>
                    <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                    <td className="px-3 py-3">{r.linha}</td>
                    <td className="px-3 py-3">{r.tipo_norm}</td>
                    <td className="px-3 py-3">{r.setor_manutencao}</td>
                    <td className="px-3 py-3">{r.problema_encontrado}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-lg border text-xs font-black ${statusBadge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border font-black text-slate-800">
            Carregando SOS_Resumo...
          </div>
        </div>
      )}
    </div>
  );
}
