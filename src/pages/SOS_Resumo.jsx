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
  FaChartPie,
  FaCogs,
  FaClipboardList,
  FaWrench,
  FaUserTie,
  FaClock,
} from "react-icons/fa";
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
  LabelList,
  ComposedChart,
  Area,
} from "recharts";
import { supabase } from "../supabase";

const MKBF_META = 7000;
const TIPOS_GRAFICO = ["RECOLHEU", "SOS", "AVARIA", "TROCA", "IMPROCEDENTE"];

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function s(v) {
  return String(v || "").trim();
}

function normalize(v) {
  return s(v).toUpperCase();
}

function safeDateStr(v) {
  if (!v) return "";
  const txt = s(v);
  if (!txt) return "";
  if (txt.includes("T")) return txt.split("T")[0];
  if (txt.includes(" ")) return txt.split(" ")[0];

  const br = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    return `${yyyy}-${mm}-${dd}`;
  }
  return txt;
}

function parseDateOnly(v) {
  const dt = safeDateStr(v);
  if (!dt) return null;
  const d = new Date(`${dt}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(dateA, dateB) {
  const a = parseDateOnly(dateA);
  const b = parseDateOnly(dateB);
  if (!a || !b) return null;
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / 86400000);
}

function calcDiffHours(startDate, startTime, endDate) {
  const d1 = safeDateStr(startDate);
  const d2 = safeDateStr(endDate);
  const h1 = s(startTime);

  if (!d1 || !d2) return 0;

  const start = new Date(`${d1}T${h1 || "00:00:00"}`);
  const end = new Date(`${d2}T23:59:59`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const hours = (end.getTime() - start.getTime()) / 36e5;
  return hours > 0 ? hours : 0;
}

function fmtDateBr(v) {
  const dt = safeDateStr(v);
  if (!dt) return "-";
  const p = dt.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dt;
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

function fmtHoras(v) {
  const h = n(v);
  if (h < 1 && h > 0) return `${fmtNum(h * 60, 0)} min`;
  return `${fmtNum(h, 1)} h`;
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

function faixaDias(v) {
  const x = n(v);
  if (!x) return "Sem informação";
  if (x <= 7) return "0-7 dias";
  if (x <= 15) return "8-15 dias";
  if (x <= 30) return "16-30 dias";
  if (x <= 60) return "31-60 dias";
  return "60+ dias";
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

function CardKPI({ title, value, sub, icon, tone = "blue", className = "" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="flex flex-col justify-between h-full">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="text-2xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
            <p className="text-xs mt-1 text-slate-600 font-semibold">{sub}</p>
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
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

function EvolucaoBadge({ value, invert = false }) {
  const val = n(value);

  if (val > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
          invert
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}
      >
        <FaArrowUp size={10} /> {fmtPct(Math.abs(val))}
      </span>
    );
  }

  if (val < 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
          invert
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-rose-50 text-rose-700 border-rose-200"
        }`}
      >
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

export default function SOS_Resumo() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [kmRows, setKmRows] = useState([]);
  const [sosRows, setSosRows] = useState([]);

  const [abaAtiva, setAbaAtiva] = useState("EXECUTIVO");
  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroControlabilidade, setFiltroControlabilidade] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  async function carregarTudo() {
    setLoading(true);
    setErro("");

    try {
      const dataCorte = new Date();
      dataCorte.setMonth(dataCorte.getMonth() - 13);
      const dataCorteStr = dataCorte.toISOString().split('T')[0];

      async function fetchAllPeriod(table, dateField) {
        let allData = [];
        let start = 0;
        const limit = 5000;
        
        while (true) {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .gte(dateField, dataCorteStr)
            .order(dateField, { ascending: false })
            .range(start, start + limit - 1);
            
          if (error) {
            console.error(`Erro buscando ${table}:`, error);
            break; 
          }
          if (!data || data.length === 0) break;
          
          allData = allData.concat(data);
          if (data.length < limit) break; 
          start += limit;
        }
        return allData;
      }

      // IMPORTANTE: Busca por created_at garante que até chamados sem data_sos não fiquem de fora da malha
      const [sosData, kmData] = await Promise.all([
        fetchAllPeriod("sos_acionamentos", "created_at"),
        fetchAllPeriod("km_rodado_diario", "data").catch((e) => {
          console.warn("Aviso: Tabela km_rodado_diario indisponível ou vazia.", e);
          return [];
        })
      ]);

      setSosRows(sosData || []);
      setKmRows(kmData || []);
    } catch (e) {
      console.error("Erro fatal ao carregar dados:", e);
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
      .sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [kmRows]);

  const sosProcessado = useMemo(() => {
    return (sosRows || [])
      .map((r) => {
        const data_sos = safeDateStr(r.data_sos || r.created_at);
        if (!data_sos) return null;

        const tipo_norm = normalizeTipo(r.ocorrencia);
        const classificacao = normalize(r.classificacao_controlabilidade);
        const diasPrev =
          n(r.dias_ultima_preventiva) > 0
            ? n(r.dias_ultima_preventiva)
            : Math.max(0, n(diffDays(data_sos, r.data_ultima_preventiva)));
        const diasInsp =
          n(r.dias_ultima_inspecao) > 0
            ? n(r.dias_ultima_inspecao)
            : Math.max(0, n(diffDays(data_sos, r.data_ultima_inspecao)));

        const tempo_solucao_horas = calcDiffHours(
          r.data_sos || r.created_at,
          r.hora_sos,
          r.data_encerramento || r.data_fechamento
        );

        // CORREÇÃO DA REGRA DE CONTROLAVEL: Exige match exato para evitar falso positivo do "NÃO CONTROLÁVEL"
        const isControlavel = classificacao === "CONTROLÁVEL" || classificacao === "CONTROLAVEL";

        return {
          ...r,
          data_sos,
          tipo_norm,
          valida_mkbf: isOcorrenciaValidaParaMkbf(r.ocorrencia),
          linha: normalize(r.linha) || "N/D",
          veiculo: String(r.veiculo || "").trim() || "N/D",
          motorista: normalize(r.motorista_nome) || normalize(r.motorista) || "N/D",
          status: normalize(r.status) || "N/D",
          problema_encontrado: String(r.problema_encontrado || "").trim() || "N/D",
          setor_manutencao: String(r.setor_manutencao || "").trim() || "N/D",
          grupo_manutencao: String(r.grupo_manutencao || "").trim() || "N/D",
          cluster: deriveCluster(r.veiculo),
          classificacao_controlabilidade: classificacao,
          controlavel: isControlavel,
          dias_ultima_preventiva_calc: diasPrev || 0,
          dias_ultima_inspecao_calc: diasInsp || 0,
          faixa_preventiva: faixaDias(diasPrev),
          faixa_inspecao: faixaDias(diasInsp),
          mes_key: data_sos.slice(0, 7),
          tempo_solucao_horas,
        };
      })
      .filter(Boolean);
  }, [sosRows]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(
      [
        ...kmProcessado.map((r) => String(r.data).slice(0, 7)),
        ...sosProcessado.map((r) => r.mes_key),
      ].filter(Boolean)
    );
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
    () => [...new Set(sosProcessado.map((r) => r.linha).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR")),
    [sosProcessado]
  );

  const setorOptions = useMemo(
    () =>
      [...new Set(sosProcessado.map((r) => r.setor_manutencao).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR")
      ),
    [sosProcessado]
  );

  const clusterOptions = useMemo(
    () => [...new Set(sosProcessado.map((r) => r.cluster).filter(Boolean))].sort(),
    [sosProcessado]
  );

  const tipoOptions = useMemo(
    () =>
      [...new Set(sosProcessado.map((r) => r.tipo_norm).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "pt-BR")
      ),
    [sosProcessado]
  );

  const baseFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return sosProcessado.filter((r) => {
      if (mesReferencia && ![mesReferencia, mesComparacao].includes(r.mes_key)) return false;
      if (filtroLinha && r.linha !== filtroLinha) return false;
      if (filtroSetor && r.setor_manutencao !== filtroSetor) return false;
      if (filtroTipo && r.tipo_norm !== filtroTipo) return false;
      if (filtroCluster && r.cluster !== filtroCluster) return false;
      if (filtroStatus && r.status !== normalize(filtroStatus)) return false;
      
      if (filtroControlabilidade === "CONTROLÁVEL" && !r.controlavel) return false;
      if (filtroControlabilidade === "NÃO CONTROLÁVEL" && r.controlavel) return false;

      if (!q) return true;

      return [
        r.numero_sos,
        r.veiculo,
        r.motorista,
        r.linha,
        r.tipo_norm,
        r.problema_encontrado,
        r.setor_manutencao,
        r.status,
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [
    sosProcessado,
    busca,
    mesReferencia,
    mesComparacao,
    filtroLinha,
    filtroSetor,
    filtroTipo,
    filtroCluster,
    filtroStatus,
    filtroControlabilidade,
  ]);

  const baseRef = useMemo(
    () => baseFiltrada.filter((r) => r.mes_key === mesReferencia),
    [baseFiltrada, mesReferencia]
  );

  const baseComp = useMemo(
    () => baseFiltrada.filter((r) => r.mes_key === mesComparacao),
    [baseFiltrada, mesComparacao]
  );

  const kmMesMap = useMemo(() => {
    const map = new Map();
    kmProcessado.forEach((r) => {
      const key = String(r.data).slice(0, 7);
      map.set(key, n(map.get(key)) + n(r.km_total));
    });
    return map;
  }, [kmProcessado]);

  const baseRefOrdenada = useMemo(() => {
    return [...baseRef].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)));
  }, [baseRef]);

  const reincidenciaCalcRef = useMemo(() => {
    const porVeiculo = new Map();

    baseRefOrdenada.forEach((r) => {
      if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
      porVeiculo.get(r.veiculo).push(r);
    });

    let totalReincVeiculo = 0;
    let totalReincTecnica = 0;
    let totalReincSetorial = 0;
    let somaIntervalos = 0;
    let qtdIntervalos = 0;

    const detalhesVeiculo = [];

    porVeiculo.forEach((eventos, veiculo) => {
      const sorted = [...eventos].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)));
      let reincVeiculo = 0;
      let reincTecnica = 0;
      let reincSetorial = 0;
      let intervaloSoma = 0;
      let intervaloQtd = 0;

      for (let i = 1; i < sorted.length; i += 1) {
        const atual = sorted[i];
        const anterior = sorted[i - 1];
        const delta = diffDays(atual.data_sos, anterior.data_sos);

        if (delta != null) {
          intervaloSoma += delta;
          intervaloQtd += 1;
          somaIntervalos += delta;
          qtdIntervalos += 1;

          if (delta <= 30) {
            reincVeiculo += 1;
            totalReincVeiculo += 1;

            if (
              normalize(atual.problema_encontrado) === normalize(anterior.problema_encontrado) &&
              normalize(atual.problema_encontrado) !== "N/D"
            ) {
              reincTecnica += 1;
              totalReincTecnica += 1;
            }

            if (
              normalize(atual.setor_manutencao) === normalize(anterior.setor_manutencao) &&
              normalize(atual.setor_manutencao) !== "N/D"
            ) {
              reincSetorial += 1;
              totalReincSetorial += 1;
            }
          }
        }
      }

      detalhesVeiculo.push({
        veiculo,
        cluster: sorted[0]?.cluster || "OUTROS",
        linhaTop: sorted[sorted.length - 1]?.linha || "N/D",
        totalSOS: sorted.length,
        reincVeiculo,
        reincTecnica,
        reincSetorial,
        intervaloMedio: intervaloQtd > 0 ? intervaloSoma / intervaloQtd : 0,
        defeitoTop:
          Object.entries(
            sorted.reduce((acc, r) => {
              acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        setorTop:
          Object.entries(
            sorted.reduce((acc, r) => {
              acc[r.setor_manutencao] = n(acc[r.setor_manutencao]) + 1;
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      });
    });

    const veiculosComSOS = detalhesVeiculo.length;
    const veiculosReincidentes = detalhesVeiculo.filter((v) => v.reincVeiculo > 0).length;
    const taxaReincidencia = veiculosComSOS > 0 ? (veiculosReincidentes / veiculosComSOS) * 100 : 0;
    const intervaloMedioGeral = qtdIntervalos > 0 ? somaIntervalos / qtdIntervalos : 0;

    return {
      totalReincVeiculo,
      totalReincTecnica,
      totalReincSetorial,
      veiculosComSOS,
      veiculosReincidentes,
      taxaReincidencia,
      intervaloMedioGeral,
      detalhesVeiculo: detalhesVeiculo.sort((a, b) => b.reincVeiculo - a.reincVeiculo || b.totalSOS - a.totalSOS),
    };
  }, [baseRefOrdenada]);

  const resumoAtual = useMemo(() => {
    const kmTotal = n(kmMesMap.get(mesReferencia));
    
    // CORREÇÃO CRÍTICA: Total analisado é o tamanho da base preenchida/filtrada e não apenas os que têm 'ocorrência' confirmada
    const interv = baseRef.length; 
    const validasParaMkbf = baseRef.filter((r) => r.valida_mkbf).length;
    const mkbf = validasParaMkbf > 0 ? kmTotal / validasParaMkbf : 0;

    const countControlaveis = baseRef.filter((r) => r.controlavel).length;

    const porTipoMap = {};
    TIPOS_GRAFICO.forEach((t) => (porTipoMap[t] = 0));
    baseRef.forEach((r) => {
      if (TIPOS_GRAFICO.includes(r.tipo_norm)) porTipoMap[r.tipo_norm] += 1;
    });

    const mediaPrev =
      baseRef.filter((r) => n(r.dias_ultima_preventiva_calc) > 0).reduce((acc, r) => acc + n(r.dias_ultima_preventiva_calc), 0) /
      Math.max(1, baseRef.filter((r) => n(r.dias_ultima_preventiva_calc) > 0).length);

    const mediaInsp =
      baseRef.filter((r) => n(r.dias_ultima_inspecao_calc) > 0).reduce((acc, r) => acc + n(r.dias_ultima_inspecao_calc), 0) /
      Math.max(1, baseRef.filter((r) => n(r.dias_ultima_inspecao_calc) > 0).length);

    const mediaFechamento =
      baseRef.filter((r) => r.tempo_solucao_horas > 0).reduce((acc, r) => acc + r.tempo_solucao_horas, 0) /
      Math.max(1, baseRef.filter((r) => r.tempo_solucao_horas > 0).length);

    return {
      kmTotal,
      interv,
      countControlaveis,
      mkbf,
      porTipoMap,
      mediaPrev,
      mediaInsp,
      mediaFechamento,
      ...reincidenciaCalcRef,
    };
  }, [kmMesMap, mesReferencia, baseRef, reincidenciaCalcRef]);

  const resumoComp = useMemo(() => {
    const kmTotal = n(kmMesMap.get(mesComparacao));
    const interv = baseComp.length;
    const validasParaMkbf = baseComp.filter((r) => r.valida_mkbf).length;
    const mkbf = validasParaMkbf > 0 ? kmTotal / validasParaMkbf : 0;

    const countControlaveis = baseComp.filter((r) => r.controlavel).length;

    const porTipoMap = {};
    TIPOS_GRAFICO.forEach((t) => (porTipoMap[t] = 0));
    baseComp.forEach((r) => {
      if (TIPOS_GRAFICO.includes(r.tipo_norm)) porTipoMap[r.tipo_norm] += 1;
    });

    const porVeiculo = new Map();
    [...baseComp]
      .sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)))
      .forEach((r) => {
        if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
        porVeiculo.get(r.veiculo).push(r);
      });

    let veiculosReincidentes = 0;
    porVeiculo.forEach((eventos) => {
      let reinc = false;
      for (let i = 1; i < eventos.length; i += 1) {
        const delta = diffDays(eventos[i].data_sos, eventos[i - 1].data_sos);
        if (delta != null && delta <= 30) {
          reinc = true;
          break;
        }
      }
      if (reinc) veiculosReincidentes += 1;
    });

    const veiculosComSOS = porVeiculo.size;
    const taxaReincidencia = veiculosComSOS > 0 ? (veiculosReincidentes / veiculosComSOS) * 100 : 0;

    const mediaFechamento =
      baseComp.filter((r) => r.tempo_solucao_horas > 0).reduce((acc, r) => acc + r.tempo_solucao_horas, 0) /
      Math.max(1, baseComp.filter((r) => r.tempo_solucao_horas > 0).length);

    return { kmTotal, interv, countControlaveis, mkbf, porTipoMap, taxaReincidencia, mediaFechamento };
  }, [kmMesMap, mesComparacao, baseComp]);

  const historico12m = useMemo(() => {
    return mesesDisponiveis.slice(-12).map((mes) => {
      const baseMes = sosProcessado.filter((r) => {
        if (r.mes_key !== mes) return false;
        if (filtroControlabilidade === "CONTROLÁVEL" && !r.controlavel) return false;
        if (filtroControlabilidade === "NÃO CONTROLÁVEL" && r.controlavel) return false;
        return true;
      });

      const kmTotal = n(kmMesMap.get(mes));
      const intervTotal = baseMes.length;
      const validasParaMkbf = baseMes.filter((r) => r.valida_mkbf).length;
      const mkbf = validasParaMkbf > 0 ? kmTotal / validasParaMkbf : 0;

      const porVeiculo = new Map();
      [...baseMes]
        .sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)))
        .forEach((r) => {
          if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
          porVeiculo.get(r.veiculo).push(r);
        });

      let veiculosReincidentes = 0;
      porVeiculo.forEach((eventos) => {
        let reinc = false;
        for (let i = 1; i < eventos.length; i += 1) {
          const delta = diffDays(eventos[i].data_sos, eventos[i - 1].data_sos);
          if (delta != null && delta <= 30) {
            reinc = true;
            break;
          }
        }
        if (reinc) veiculosReincidentes += 1;
      });

      const taxaReincidencia = porVeiculo.size > 0 ? (veiculosReincidentes / porVeiculo.size) * 100 : 0;

      return {
        mes,
        mesLabel: monthLabelFromKey(mes),
        intervTotal,
        reincidentes: veiculosReincidentes,
        taxaReincidencia,
        kmTotal,
        mkbf,
        meta: MKBF_META,
      };
    });
  }, [mesesDisponiveis, sosProcessado, kmMesMap, filtroControlabilidade]);

  const graficoTipos = useMemo(() => {
    return TIPOS_GRAFICO.map((tipo) => ({
      tipo,
      anterior: n(resumoComp.porTipoMap?.[tipo]),
      atual: n(resumoAtual.porTipoMap?.[tipo]),
    }));
  }, [resumoAtual, resumoComp]);

  const graficoFaixaPreventiva = useMemo(() => {
    const counts = {};
    ["0-7 dias", "8-15 dias", "16-30 dias", "31-60 dias", "60+ dias", "Sem informação"].forEach(
      (f) => (counts[f] = 0)
    );
    baseRef.forEach((r) => {
      counts[r.faixa_preventiva] = n(counts[r.faixa_preventiva]) + 1;
    });
    return Object.entries(counts).map(([faixa, total]) => ({ faixa, total }));
  }, [baseRef]);

  const graficoFaixaInspecao = useMemo(() => {
    const counts = {};
    ["0-7 dias", "8-15 dias", "16-30 dias", "31-60 dias", "60+ dias", "Sem informação"].forEach(
      (f) => (counts[f] = 0)
    );
    baseRef.forEach((r) => {
      counts[r.faixa_inspecao] = n(counts[r.faixa_inspecao]) + 1;
    });
    return Object.entries(counts).map(([faixa, total]) => ({ faixa, total }));
  }, [baseRef]);

  const tabelaLinhas = useMemo(() => {
    const linhas = [...new Set(baseRef.map((r) => r.linha))];

    return linhas
      .map((linha) => {
        const atual = baseRef.filter((r) => r.linha === linha);
        const anterior = baseComp.filter((r) => r.linha === linha);

        const porVeiculo = new Map();
        [...atual]
          .sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)))
          .forEach((r) => {
            if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
            porVeiculo.get(r.veiculo).push(r);
          });

        let veiculosReincidentes = 0;
        porVeiculo.forEach((eventos) => {
          let reinc = false;
          for (let i = 1; i < eventos.length; i += 1) {
            const delta = diffDays(eventos[i].data_sos, eventos[i - 1].data_sos);
            if (delta != null && delta <= 30) {
              reinc = true;
              break;
            }
          }
          if (reinc) veiculosReincidentes += 1;
        });

        const defeitoTop =
          Object.entries(
            atual.reduce((acc, r) => {
              acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D";

        return {
          linha,
          totalAtual: atual.length,
          totalAnterior: anterior.length,
          variacao_pct: variancePct(atual.length, anterior.length),
          veiculosReincidentes,
          taxaReincidencia:
            porVeiculo.size > 0 ? (veiculosReincidentes / porVeiculo.size) * 100 : 0,
          defeitoTop,
          setorTop:
            Object.entries(
              atual.reduce((acc, r) => {
                acc[r.setor_manutencao] = n(acc[r.setor_manutencao]) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        };
      })
      .sort((a, b) => b.veiculosReincidentes - a.veiculosReincidentes || b.totalAtual - a.totalAtual);
  }, [baseRef, baseComp]);

  const tabelaVeiculos = useMemo(() => reincidenciaCalcRef.detalhesVeiculo, [reincidenciaCalcRef]);

  const tabelaSetores = useMemo(() => {
    const map = new Map();
    baseRef.forEach((r) => {
      const key = r.setor_manutencao;
      if (!map.has(key)) {
        map.set(key, {
          setor: key,
          total: 0,
          linhas: new Set(),
          veiculos: new Set(),
          defeitos: {},
          reincTecnica: 0,
          reincSetorial: 0,
        });
      }
      const item = map.get(key);
      item.total += 1;
      item.linhas.add(r.linha);
      item.veiculos.add(r.veiculo);
      item.defeitos[r.problema_encontrado] = n(item.defeitos[r.problema_encontrado]) + 1;
    });

    const porVeiculoSetor = new Map();
    [...baseRef]
      .sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)))
      .forEach((r) => {
        const key = `${r.veiculo}__${r.setor_manutencao}`;
        if (!porVeiculoSetor.has(key)) porVeiculoSetor.set(key, []);
        porVeiculoSetor.get(key).push(r);
      });

    porVeiculoSetor.forEach((eventos, key) => {
      let reinc = 0;
      for (let i = 1; i < eventos.length; i += 1) {
        const delta = diffDays(eventos[i].data_sos, eventos[i - 1].data_sos);
        if (delta != null && delta <= 30) reinc += 1;
      }
      const setor = key.split("__")[1];
      if (map.has(setor)) {
        map.get(setor).reincSetorial += reinc;
      }
    });

    return [...map.values()]
      .map((r) => ({
        setor: r.setor,
        total: r.total,
        linhas: r.linhas.size,
        veiculos: r.veiculos.size,
        reincSetorial: r.reincSetorial,
        defeitoTop:
          Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      }))
      .sort((a, b) => b.reincSetorial - a.reincSetorial || b.total - a.total);
  }, [baseRef]);

  const tabelaDefeitos = useMemo(() => {
    const map = new Map();
    baseRef.forEach((r) => {
      const key = r.problema_encontrado;
      if (!map.has(key)) {
        map.set(key, {
          defeito: key,
          total: 0,
          veiculos: new Set(),
          setores: new Set(),
          linhas: new Set(),
          diasPrevSoma: 0,
          diasPrevQtd: 0,
          diasInspSoma: 0,
          diasInspQtd: 0,
        });
      }
      const item = map.get(key);
      item.total += 1;
      item.veiculos.add(r.veiculo);
      item.setores.add(r.setor_manutencao);
      item.linhas.add(r.linha);
      if (n(r.dias_ultima_preventiva_calc) > 0) {
        item.diasPrevSoma += n(r.dias_ultima_preventiva_calc);
        item.diasPrevQtd += 1;
      }
      if (n(r.dias_ultima_inspecao_calc) > 0) {
        item.diasInspSoma += n(r.dias_ultima_inspecao_calc);
        item.diasInspQtd += 1;
      }
    });

    const porVeiculoDefeito = new Map();
    [...baseRef]
      .sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos)))
      .forEach((r) => {
        const key = `${r.veiculo}__${r.problema_encontrado}`;
        if (!porVeiculoDefeito.has(key)) porVeiculoDefeito.set(key, []);
        porVeiculoDefeito.get(key).push(r);
      });

    const reincPorDefeito = new Map();
    porVeiculoDefeito.forEach((eventos, key) => {
      let reinc = 0;
      for (let i = 1; i < eventos.length; i += 1) {
        const delta = diffDays(eventos[i].data_sos, eventos[i - 1].data_sos);
        if (delta != null && delta <= 30) reinc += 1;
      }
      const defeito = key.split("__")[1];
      reincPorDefeito.set(defeito, n(reincPorDefeito.get(defeito)) + reinc);
    });

    return [...map.values()]
      .map((r) => ({
        defeito: r.defeito,
        total: r.total,
        veiculos: r.veiculos.size,
        setores: r.setores.size,
        linhas: r.linhas.size,
        reincTecnica: n(reincPorDefeito.get(r.defeito)),
        mediaPrev: r.diasPrevQtd > 0 ? r.diasPrevSoma / r.diasPrevQtd : 0,
        mediaInsp: r.diasInspQtd > 0 ? r.diasInspSoma / r.diasInspQtd : 0,
      }))
      .sort((a, b) => b.reincTecnica - a.reincTecnica || b.total - a.total);
  }, [baseRef]);

  const tabelaMotoristas = useMemo(() => {
    const map = new Map();
    baseRef.forEach((r) => {
      const key = r.motorista;
      if (!map.has(key)) {
        map.set(key, {
          motorista: key,
          total: 0,
          veiculos: new Set(),
          linhas: new Set(),
          defeitos: {},
        });
      }
      const item = map.get(key);
      item.total += 1;
      item.veiculos.add(r.veiculo);
      item.linhas.add(r.linha);
      item.defeitos[r.problema_encontrado] = n(item.defeitos[r.problema_encontrado]) + 1;
    });

    return [...map.values()]
      .map((r) => ({
        motorista: r.motorista,
        total: r.total,
        veiculos: r.veiculos.size,
        linhas: r.linhas.size,
        defeitoTop: Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      }))
      .sort((a, b) => b.total - a.total);
  }, [baseRef]);

  const top5Veiculos3m = useMemo(() => {
    if (!mesReferencia) return [];
    const ref = firstDayOfMonth(mesReferencia);
    if (!ref) return [];
    const months3 = [addMonths(ref, -2), addMonths(ref, -1), ref].map(monthKey);

    const base = sosProcessado.filter((r) => {
      if (!months3.includes(r.mes_key)) return false;
      if (filtroControlabilidade === "CONTROLÁVEL" && !r.controlavel) return false;
      if (filtroControlabilidade === "NÃO CONTROLÁVEL" && r.controlavel) return false;
      return true;
    });

    const counts = new Map();

    base.forEach((r) => {
      if (!counts.has(r.veiculo)) counts.set(r.veiculo, []);
      counts.get(r.veiculo).push(r);
    });

    return [...counts.entries()]
      .map(([veiculo, itens]) => {
        const porMes = Object.fromEntries(months3.map((m) => [monthLabelFromKey(m), 0]));
        itens.forEach((r) => {
          porMes[monthLabelFromKey(r.mes_key)] = n(porMes[monthLabelFromKey(r.mes_key)]) + 1;
        });

        const topDefeitos = Object.entries(
          itens.reduce((acc, r) => {
            acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
            return acc;
          }, {})
        )
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
  }, [mesReferencia, sosProcessado, filtroControlabilidade]);

  const leituraAnalitica = useMemo(() => {
    const linhaTop = tabelaLinhas[0]?.linha || "N/D";
    const defeitoTop = tabelaDefeitos[0]?.defeito || "N/D";
    const setorTop = tabelaSetores[0]?.setor || "N/D";
    const faixaPrevTop =
      [...graficoFaixaPreventiva].sort((a, b) => b.total - a.total)[0]?.faixa || "N/D";
    const faixaInspTop =
      [...graficoFaixaInspecao].sort((a, b) => b.total - a.total)[0]?.faixa || "N/D";

    return [
      `A pressão do mês está concentrada na linha ${linhaTop}, com ${fmtInt(
        tabelaLinhas[0]?.totalAtual || 0
      )} SOS analisados e ${fmtInt(tabelaLinhas[0]?.veiculosReincidentes || 0)} veículos reincidentes.`,
      `O defeito mais recorrente é "${defeitoTop}", puxado principalmente pelo setor ${setorTop}.`,
      `A faixa mais crítica após preventiva ficou em ${faixaPrevTop}, enquanto após inspeção a maior concentração ficou em ${faixaInspTop}.`,
      `O intervalo médio entre SOS do mesmo veículo está em ${fmtNum(
        resumoAtual.intervaloMedioGeral || 0,
        1
      )} dias, com taxa de reincidência de ${fmtPct(resumoAtual.taxaReincidencia || 0)}.`,
    ];
  }, [
    tabelaLinhas,
    tabelaDefeitos,
    tabelaSetores,
    graficoFaixaPreventiva,
    graficoFaixaInspecao,
    resumoAtual.intervaloMedioGeral,
    resumoAtual.taxaReincidencia,
  ]);

  const exportAtual = () => {
    if (abaAtiva === "EXECUTIVO") {
      exportarCSV(
        historico12m.map((r) => ({
          Mês: r.mesLabel,
          "Total SOS": fmtInt(r.intervTotal),
          "Veículos Reincidentes": fmtInt(r.reincidentes),
          "Taxa Reincidência %": fmtNum(r.taxaReincidencia, 1),
          KM: fmtInt(r.kmTotal),
          MKBF: fmtNum(r.mkbf),
          Meta: fmtNum(r.meta),
        })),
        "SOS_Resumo_Executivo"
      );
    }

    if (abaAtiva === "REINCIDENCIA") {
      exportarCSV(
        tabelaVeiculos.map((r) => ({
          Veículo: r.veiculo,
          Cluster: r.cluster,
          Linha: r.linhaTop,
          "SOS Total": r.totalSOS,
          "Reinc. Veículo": r.reincVeiculo,
          "Reinc. Técnica": r.reincTecnica,
          "Reinc. Setorial": r.reincSetorial,
          "Intervalo Médio": fmtNum(r.intervaloMedio, 1),
          "Defeito Top": r.defeitoTop,
          "Setor Top": r.setorTop,
        })),
        "SOS_Resumo_Reincidencia"
      );
    }

    if (abaAtiva === "PREV_INSPEC") {
      exportarCSV(
        baseRef.map((r) => ({
          Data: fmtDateBr(r.data_sos),
          SOS: r.numero_sos || "-",
          Veículo: r.veiculo,
          Linha: r.linha,
          Defeito: r.problema_encontrado,
          Setor: r.setor_manutencao,
          "Dias após Preventiva": r.dias_ultima_preventiva_calc,
          "Faixa Preventiva": r.faixa_preventiva,
          "Dias após Inspeção": r.dias_ultima_inspecao_calc,
          "Faixa Inspeção": r.faixa_inspecao,
        })),
        "SOS_Resumo_Prev_Inspec"
      );
    }

    if (abaAtiva === "LINHAS") {
      exportarCSV(
        tabelaLinhas.map((r) => ({
          Linha: r.linha,
          "SOS Atual": r.totalAtual,
          "SOS Anterior": r.totalAnterior,
          "Variação %": fmtNum(r.variacao_pct, 1),
          "Veículos Reincidentes": r.veiculosReincidentes,
          "Taxa Reincidência %": fmtNum(r.taxaReincidencia, 1),
          "Defeito Top": r.defeitoTop,
          "Setor Top": r.setorTop,
        })),
        "SOS_Resumo_Linhas"
      );
    }

    if (abaAtiva === "VEICULOS") {
      exportarCSV(
        tabelaVeiculos.map((r) => ({
          Veículo: r.veiculo,
          Cluster: r.cluster,
          Linha: r.linhaTop,
          "SOS Total": r.totalSOS,
          "Reinc. Veículo": r.reincVeiculo,
          "Reinc. Técnica": r.reincTecnica,
          "Reinc. Setorial": r.reincSetorial,
          "Intervalo Médio": fmtNum(r.intervaloMedio, 1),
          "Defeito Top": r.defeitoTop,
          "Setor Top": r.setorTop,
        })),
        "SOS_Resumo_Veiculos"
      );
    }

    if (abaAtiva === "SETORES") {
      exportarCSV(
        tabelaSetores.map((r) => ({
          Setor: r.setor,
          Total: r.total,
          Linhas: r.linhas,
          Veículos: r.veiculos,
          "Reincidência Setorial": r.reincSetorial,
          "Defeito Top": r.defeitoTop,
        })),
        "SOS_Resumo_Setores"
      );
    }

    if (abaAtiva === "DEFEITOS") {
      exportarCSV(
        tabelaDefeitos.map((r) => ({
          Defeito: r.defeito,
          Total: r.total,
          Veículos: r.veiculos,
          Setores: r.setores,
          Linhas: r.linhas,
          "Reincidência Técnica": r.reincTecnica,
          "Média após Preventiva": fmtNum(r.mediaPrev, 1),
          "Média após Inspeção": fmtNum(r.mediaInsp, 1),
        })),
        "SOS_Resumo_Defeitos"
      );
    }

    if (abaAtiva === "MOTORISTAS") {
      exportarCSV(
        tabelaMotoristas.map((r) => ({
          Motorista: r.motorista,
          Total: r.total,
          Veículos: r.veiculos,
          Linhas: r.linhas,
          "Defeito Top": r.defeitoTop,
        })),
        "SOS_Resumo_Motoristas"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
              <FaBolt /> Resumo SOS / Reincidência / Controláveis
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">
              PAINEL DE INTERVENÇÕES
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Visão analítica focada em reincidência, pós-preventiva, pós-inspeção e
              robustez da manutenção.
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
            <p>
              <strong>Base da tela:</strong> Traz a base consolidada de todos os SOS válidos, filtrada de acordo com as seleções abaixo.
            </p>
            <p>
              <strong>Reincidência operacional:</strong> mesmo veículo com novo SOS em até 30 dias.
            </p>
            <p>
              <strong>Reincidência técnica:</strong> mesmo veículo + mesmo defeito em até 30 dias.
            </p>
            <p>
              <strong>Reincidência setorial:</strong> mesmo veículo + mesmo setor em até 30 dias.
            </p>
            <p>
              <strong>Pós-preventiva e pós-inspeção:</strong> usa os dias registrados no tratamento ou recalcula pela diferença entre a data do SOS e a data da última preventiva/inspeção.
            </p>
            <p>
              <strong>Tempo Médio de Fechamento:</strong> Diferença em horas entre a abertura do SOS (data/hora) e a data de encerramento da etiqueta.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mt-4">
          <div className="xl:col-span-2 relative">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar SOS, veículo, linha, defeito, motorista..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <select
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Mês referência</option>
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>
                {monthLabelFromKey(m)}
              </option>
            ))}
          </select>

          <select
            value={filtroLinha}
            onChange={(e) => setFiltroLinha(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Todas as linhas</option>
            {linhaOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filtroSetor}
            onChange={(e) => setFiltroSetor(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Todos os setores</option>
            {setorOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Todos os tipos</option>
            {tipoOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <select
            value={filtroCluster}
            onChange={(e) => setFiltroCluster(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Todos os clusters</option>
            {clusterOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Todos os status</option>
            <option value="ABERTO">ABERTO</option>
            <option value="EM ANDAMENTO">EM ANDAMENTO</option>
            <option value="FECHADO">FECHADO</option>
          </select>

          <select
            value={filtroControlabilidade}
            onChange={(e) => setFiltroControlabilidade(e.target.value)}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold"
          >
            <option value="">Todas classificações</option>
            <option value="CONTROLÁVEL">Controlável</option>
            <option value="NÃO CONTROLÁVEL">Não Controlável</option>
          </select>

          <button
            onClick={() => {
              setBusca("");
              setFiltroLinha("");
              setFiltroSetor("");
              setFiltroTipo("");
              setFiltroCluster("");
              setFiltroStatus("");
              setFiltroControlabilidade("");
            }}
            className="px-3 py-3 rounded-xl border border-slate-200 bg-slate-800 text-white font-black hover:bg-slate-700 transition"
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

      {/* GRADE HARMONIZADA: 7 KPIs distribuídos em 2 linhas simétricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI
          title="Total SOS Analisado"
          value={fmtInt(resumoAtual.interv)}
          sub={filtroControlabilidade ? `Filtro: ${filtroControlabilidade}` : "Todos os SOS"}
          icon={<FaExclamationTriangle />}
          tone="rose"
          className="md:col-span-2 xl:col-span-2"
        />
        <CardKPI
          title="Tempo Médio Fechamento"
          value={fmtHoras(resumoAtual.mediaFechamento)}
          sub="Desde abertura da etiqueta"
          icon={<FaClock />}
          tone="slate"
        />
        <CardKPI
          title="Veículos Reincidentes"
          value={fmtInt(resumoAtual.veiculosReincidentes)}
          sub="Mesmo veículo em até 30 dias"
          icon={<FaBus />}
          tone="violet"
        />
        <CardKPI
          title="Taxa Reincidência"
          value={fmtPct(resumoAtual.taxaReincidencia)}
          sub="Sobre veículos da base atual"
          icon={<FaChartLine />}
          tone="amber"
        />
        <CardKPI
          title="MKBF"
          value={fmtNum(resumoAtual.mkbf)}
          sub={`Meta ${fmtNum(MKBF_META)}`}
          icon={<FaBolt />}
          tone="blue"
        />
        <CardKPI
          title="Dias após Preventiva"
          value={fmtNum(resumoAtual.mediaPrev, 1)}
          sub="Média do mês"
          icon={<FaWrench />}
          tone="emerald"
        />
        <CardKPI
          title="Dias entre SOS"
          value={fmtNum(resumoAtual.intervaloMedioGeral, 1)}
          sub="Intervalo médio do veículo"
          icon={<FaRoad />}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {leituraAnalitica.map((txt, i) => (
          <div key={i} className="bg-white rounded-2xl border shadow-sm p-4">
            <p className="text-sm text-slate-700 font-semibold leading-6">{txt}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              MKBF vs mês anterior
            </p>
            <p className="text-xl font-black text-slate-800 mt-1">
              {fmtNum(resumoComp.mkbf)} → {fmtNum(resumoAtual.mkbf)}
            </p>
          </div>
          <EvolucaoBadge value={variancePct(resumoAtual.mkbf, resumoComp.mkbf)} />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              Total vs mês anterior
            </p>
            <p className="text-xl font-black text-slate-800 mt-1">
              {fmtInt(resumoComp.interv)} → {fmtInt(resumoAtual.interv)}
            </p>
          </div>
          <EvolucaoBadge value={variancePct(resumoAtual.interv, resumoComp.interv)} invert />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              Reincidência vs mês anterior
            </p>
            <p className="text-xl font-black text-slate-800 mt-1">
              {fmtPct(resumoComp.taxaReincidencia)} → {fmtPct(resumoAtual.taxaReincidencia)}
            </p>
          </div>
          <EvolucaoBadge
            value={variancePct(resumoAtual.taxaReincidencia, resumoComp.taxaReincidencia)}
            invert
          />
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              Tempo Médio vs mês anterior
            </p>
            <p className="text-xl font-black text-slate-800 mt-1">
              {fmtHoras(resumoComp.mediaFechamento)} → {fmtHoras(resumoAtual.mediaFechamento)}
            </p>
          </div>
          <EvolucaoBadge
            value={variancePct(resumoAtual.mediaFechamento, resumoComp.mediaFechamento)}
            invert
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={abaAtiva === "EXECUTIVO"} onClick={() => setAbaAtiva("EXECUTIVO")} icon={<FaChartPie />}>
          Executivo
        </TabButton>
        <TabButton active={abaAtiva === "REINCIDENCIA"} onClick={() => setAbaAtiva("REINCIDENCIA")} icon={<FaClipboardList />}>
          Reincidência
        </TabButton>
        <TabButton active={abaAtiva === "PREV_INSPEC"} onClick={() => setAbaAtiva("PREV_INSPEC")} icon={<FaWrench />}>
          Preventiva / Inspeção
        </TabButton>
        <TabButton active={abaAtiva === "LINHAS"} onClick={() => setAbaAtiva("LINHAS")} icon={<FaBus />}>
          Linhas
        </TabButton>
        <TabButton active={abaAtiva === "VEICULOS"} onClick={() => setAbaAtiva("VEICULOS")} icon={<FaBus />}>
          Veículos
        </TabButton>
        <TabButton active={abaAtiva === "SETORES"} onClick={() => setAbaAtiva("SETORES")} icon={<FaCogs />}>
          Setores
        </TabButton>
        <TabButton active={abaAtiva === "DEFEITOS"} onClick={() => setAbaAtiva("DEFEITOS")} icon={<FaTools />}>
          Defeitos
        </TabButton>
        <TabButton active={abaAtiva === "MOTORISTAS"} onClick={() => setAbaAtiva("MOTORISTAS")} icon={<FaUserTie />}>
          Motoristas
        </TabButton>
      </div>

      {abaAtiva === "EXECUTIVO" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-slate-800">Histórico 12 meses</h3>
                <span className="text-xs font-bold text-slate-500">SOS + reincidência</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={historico12m} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                    <Tooltip cursor={{ fill: 'transparent', stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="intervTotal" fillOpacity={1} fill="url(#colorTotal)" stroke="none" />
                    <Line type="monotone" dataKey="intervTotal" name="Total SOS" stroke="#cbd5e1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="reincidentes" name="Veículos Reincidentes" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }}>
                      <LabelList dataKey="reincidentes" position="top" formatter={(v) => fmtInt(v)} style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-slate-800">Evolução Histórica do MKBF</h3>
                <span className="text-xs font-bold text-slate-500">Visão mensal</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={historico12m} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMkbf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} domain={[0, 'auto']} />
                    <Tooltip cursor={{ fill: 'transparent', stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }} formatter={(v) => fmtNum(v)} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="mkbf" fillOpacity={1} fill="url(#colorMkbf)" stroke="none" />
                    <Line type="monotone" dataKey="mkbf" name="MKBF" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }}>
                      <LabelList dataKey="mkbf" position="top" formatter={(v) => fmtNum(v, 0)} style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} />
                    </Line>
                    <Line type="step" dataKey="meta" name="Meta" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-black text-slate-800">Tipos de ocorrência</h3>
                <span className="text-xs font-bold text-slate-500">Mês atual x anterior</span>
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficoTipos} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="tipo" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="anterior" name="Anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={25} />
                    <Bar dataKey="atual" name="Atual" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={25}>
                      <LabelList dataKey="atual" position="top" style={{ fill: "#1e293b", fontSize: 11, fontWeight: "bold" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <h3 className="text-lg font-black text-slate-800 mb-3">
                Top 5 veículos - últimos 3 meses
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-3 py-3 text-left">Veículo</th>
                      <th className="px-3 py-3 text-left">Cluster</th>
                      <th className="px-3 py-3 text-left">Total</th>
                      {top5Veiculos3m[0] &&
                        Object.keys(top5Veiculos3m[0])
                          .filter((k) => k.includes("/"))
                          .map((m) => (
                            <th key={m} className="px-3 py-3 text-left">
                              {m}
                            </th>
                          ))}
                      <th className="px-3 py-3 text-left">Top defeitos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Veiculos3m.map((r) => (
                      <tr key={r.veiculo} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                        <td className="px-3 py-3">{r.cluster}</td>
                        <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td>
                        {Object.keys(r)
                          .filter((k) => k.includes("/"))
                          .map((m) => (
                            <td key={m} className="px-3 py-3">
                              {fmtInt(r[m])}
                            </td>
                          ))}
                        <td className="px-3 py-3 text-slate-600">{r.topDefeitos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {abaAtiva === "REINCIDENCIA" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top linhas reincidentes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaLinhas.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="linha" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="veiculosReincidentes" name="Veículos Reincidentes" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="veiculosReincidentes" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top veículos reincidentes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaVeiculos.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="veiculo" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="reincVeiculo" name="Reincidência Veículo" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                  <Bar dataKey="reincTecnica" name="Reincidência Técnica" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20}>
                    <LabelList dataKey="reincTecnica" position="top" style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 xl:col-span-2 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Detalhe por veículo</h3>
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Veículo</th>
                  <th className="px-3 py-3 text-left">Cluster</th>
                  <th className="px-3 py-3 text-left">Linha</th>
                  <th className="px-3 py-3 text-left">SOS Total</th>
                  <th className="px-3 py-3 text-left">Reinc. Veículo</th>
                  <th className="px-3 py-3 text-left">Reinc. Técnica</th>
                  <th className="px-3 py-3 text-left">Reinc. Setorial</th>
                  <th className="px-3 py-3 text-left">Intervalo Médio</th>
                  <th className="px-3 py-3 text-left">Defeito Top</th>
                  <th className="px-3 py-3 text-left">Setor Top</th>
                </tr>
              </thead>
              <tbody>
                {tabelaVeiculos.map((r) => (
                  <tr key={r.veiculo} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                    <td className="px-3 py-3">{r.cluster}</td>
                    <td className="px-3 py-3">{r.linhaTop}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.totalSOS)}</td>
                    <td className="px-3 py-3 text-slate-600">{fmtInt(r.reincVeiculo)}</td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincTecnica)}</td>
                    <td className="px-3 py-3 text-slate-600">{fmtInt(r.reincSetorial)}</td>
                    <td className="px-3 py-3">{fmtNum(r.intervaloMedio, 1)}</td>
                    <td className="px-3 py-3">{r.defeitoTop}</td>
                    <td className="px-3 py-3">{r.setorTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "PREV_INSPEC" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Faixa após preventiva</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoFaixaPreventiva} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="faixa" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="total" name="SOS" fill="#10b981" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="total" position="top" style={{ fill: "#10b981", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Faixa após inspeção</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoFaixaInspecao} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="faixa" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="total" name="SOS" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="total" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 xl:col-span-2 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">
              Base detalhada pós-preventiva / pós-inspeção
            </h3>
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Data</th>
                  <th className="px-3 py-3 text-left">SOS</th>
                  <th className="px-3 py-3 text-left">Veículo</th>
                  <th className="px-3 py-3 text-left">Linha</th>
                  <th className="px-3 py-3 text-left">Defeito</th>
                  <th className="px-3 py-3 text-left">Setor</th>
                  <th className="px-3 py-3 text-left">Dias Pós Prev.</th>
                  <th className="px-3 py-3 text-left">Faixa Prev.</th>
                  <th className="px-3 py-3 text-left">Dias Pós Insp.</th>
                  <th className="px-3 py-3 text-left">Faixa Insp.</th>
                </tr>
              </thead>
              <tbody>
                {baseRef.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3">{fmtDateBr(r.data_sos)}</td>
                    <td className="px-3 py-3 font-semibold">{r.numero_sos || "-"}</td>
                    <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                    <td className="px-3 py-3">{r.linha}</td>
                    <td className="px-3 py-3">{r.problema_encontrado}</td>
                    <td className="px-3 py-3">{r.setor_manutencao}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{fmtInt(r.dias_ultima_preventiva_calc)}</td>
                    <td className="px-3 py-3">{r.faixa_preventiva}</td>
                    <td className="px-3 py-3 font-semibold text-blue-600">{fmtInt(r.dias_ultima_inspecao_calc)}</td>
                    <td className="px-3 py-3">{r.faixa_inspecao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "LINHAS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Linhas com mais ocorrências</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaLinhas.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="linha" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalAtual" name="Volume de SOS" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="totalAtual" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Leitura detalhada por linha</h3>
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Linha</th>
                  <th className="px-3 py-3 text-left">SOS Atual</th>
                  <th className="px-3 py-3 text-left">SOS Anterior</th>
                  <th className="px-3 py-3 text-left">Variação</th>
                  <th className="px-3 py-3 text-left">Veíc. Reincidentes</th>
                  <th className="px-3 py-3 text-left">Taxa Reinc.</th>
                  <th className="px-3 py-3 text-left">Defeito Top</th>
                  <th className="px-3 py-3 text-left">Setor Top</th>
                </tr>
              </thead>
              <tbody>
                {tabelaLinhas.map((r) => (
                  <tr key={r.linha} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.linha}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.totalAtual)}</td>
                    <td className="px-3 py-3">{fmtInt(r.totalAnterior)}</td>
                    <td className="px-3 py-3">
                      <EvolucaoBadge value={r.variacao_pct} invert />
                    </td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.veiculosReincidentes)}</td>
                    <td className="px-3 py-3">{fmtPct(r.taxaReincidencia)}</td>
                    <td className="px-3 py-3">{r.defeitoTop}</td>
                    <td className="px-3 py-3">{r.setorTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "VEICULOS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Veículos ofensores</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaVeiculos.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="veiculo" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalSOS" name="Volume de SOS" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="totalSOS" position="top" style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Consolidado por veículo</h3>
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Veículo</th>
                  <th className="px-3 py-3 text-left">Cluster</th>
                  <th className="px-3 py-3 text-left">Linha</th>
                  <th className="px-3 py-3 text-left">SOS Total</th>
                  <th className="px-3 py-3 text-left">Reinc. Veículo</th>
                  <th className="px-3 py-3 text-left">Reinc. Técnica</th>
                  <th className="px-3 py-3 text-left">Reinc. Setorial</th>
                  <th className="px-3 py-3 text-left">Intervalo Médio</th>
                  <th className="px-3 py-3 text-left">Defeito Top</th>
                  <th className="px-3 py-3 text-left">Setor Top</th>
                </tr>
              </thead>
              <tbody>
                {tabelaVeiculos.map((r) => (
                  <tr key={r.veiculo} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                    <td className="px-3 py-3">{r.cluster}</td>
                    <td className="px-3 py-3">{r.linhaTop}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.totalSOS)}</td>
                    <td className="px-3 py-3">{fmtInt(r.reincVeiculo)}</td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincTecnica)}</td>
                    <td className="px-3 py-3">{fmtInt(r.reincSetorial)}</td>
                    <td className="px-3 py-3">{fmtNum(r.intervaloMedio, 1)}</td>
                    <td className="px-3 py-3">{r.defeitoTop}</td>
                    <td className="px-3 py-3">{r.setorTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "SETORES" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Distribuição por Setor</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaSetores.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="setor" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" name="Volume de SOS" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="total" position="top" style={{ fill: "#8b5cf6", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Consolidado por setor</h3>
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Setor</th>
                  <th className="px-3 py-3 text-left">Total</th>
                  <th className="px-3 py-3 text-left">Linhas</th>
                  <th className="px-3 py-3 text-left">Veículos</th>
                  <th className="px-3 py-3 text-left">Reinc. Setorial</th>
                  <th className="px-3 py-3 text-left">Defeito Top</th>
                </tr>
              </thead>
              <tbody>
                {tabelaSetores.map((r) => (
                  <tr key={r.setor} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.setor}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td>
                    <td className="px-3 py-3">{fmtInt(r.linhas)}</td>
                    <td className="px-3 py-3">{fmtInt(r.veiculos)}</td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincSetorial)}</td>
                    <td className="px-3 py-3">{r.defeitoTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "DEFEITOS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Defeitos</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaDefeitos.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="defeito" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" name="Volume de SOS" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="total" position="top" style={{ fill: "#0f766e", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Consolidado por defeito</h3>
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Defeito</th>
                  <th className="px-3 py-3 text-left">Total</th>
                  <th className="px-3 py-3 text-left">Veículos</th>
                  <th className="px-3 py-3 text-left">Setores</th>
                  <th className="px-3 py-3 text-left">Linhas</th>
                  <th className="px-3 py-3 text-left">Reinc. Técnica</th>
                  <th className="px-3 py-3 text-left">Média Pós Prev.</th>
                  <th className="px-3 py-3 text-left">Média Pós Insp.</th>
                </tr>
              </thead>
              <tbody>
                {tabelaDefeitos.map((r) => (
                  <tr key={r.defeito} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.defeito}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td>
                    <td className="px-3 py-3">{fmtInt(r.veiculos)}</td>
                    <td className="px-3 py-3">{fmtInt(r.setores)}</td>
                    <td className="px-3 py-3">{fmtInt(r.linhas)}</td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincTecnica)}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{fmtNum(r.mediaPrev, 1)}</td>
                    <td className="px-3 py-3 font-semibold text-blue-600">{fmtNum(r.mediaInsp, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "MOTORISTAS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Motoristas</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaMotoristas.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="motorista" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" name="Volume de SOS" fill="#eab308" radius={[4, 4, 0, 0]} barSize={35}>
                    <LabelList dataKey="total" position="top" style={{ fill: "#eab308", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Detalhamento por Motorista</h3>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Motorista</th>
                  <th className="px-3 py-3 text-left">Total de SOS</th>
                  <th className="px-3 py-3 text-left">Veículos Distintos</th>
                  <th className="px-3 py-3 text-left">Linhas Distintas</th>
                  <th className="px-3 py-3 text-left">Principal Defeito Relatado</th>
                </tr>
              </thead>
              <tbody>
                {tabelaMotoristas.map((r) => (
                  <tr key={r.motorista} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.motorista}</td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td>
                    <td className="px-3 py-3">{fmtInt(r.veiculos)}</td>
                    <td className="px-3 py-3">{fmtInt(r.linhas)}</td>
                    <td className="px-3 py-3">{r.defeitoTop}</td>
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
            Carregando PAINEL DE INTERVENÇÕES...
          </div>
        </div>
      )}
    </div>
  );
}
