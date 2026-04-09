// src/pages/SOSResumo.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaTools,
  FaSync,
  FaSearch,
  FaBus,
  FaRoute,
  FaWrench,
  FaClipboardList,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaInfoCircle,
  FaArrowDown as FaDownload,
  FaExclamationTriangle,
  FaClock,
  FaShieldAlt,
} from "react-icons/fa";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  Legend,
  Cell,
} from "recharts";

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
  const txt = String(v).trim();
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
  const d = safeDateStr(v);
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return null;
  const dt = new Date(y, m - 1, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function diffDays(a, b) {
  const da = parseDateOnly(a);
  const db = parseDateOnly(b);
  if (!da || !db) return null;
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.floor((da.getTime() - db.getTime()) / 86400000);
}

function fmtDateBr(v) {
  const d = safeDateStr(v);
  if (!d) return "-";
  const p = d.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return d;
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

function fmtPct(v, dec = 1) {
  return `${fmtNum(v, dec)}%`;
}

function fmtHoras(v) {
  const total = n(v);
  if (!total) return "0h";
  if (total < 1) return `${fmtInt(total * 60)} min`;
  return `${fmtNum(total, 2)} h`;
}

function monthStart(yyyyMm) {
  if (!yyyyMm) return "";
  return `${yyyyMm}-01`;
}

function monthEnd(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${yyyyMm}-${String(last).padStart(2, "0")}`;
}

function previousMonth(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-").map(Number);
  const dt = new Date(y, m - 2, 1);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function monthLabelPt(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-").map(Number);
  const nomes = [
    "",
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  return `${nomes[m] || ""}/${String(y).slice(2)}`;
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

function isOcorrenciaValida(oc) {
  const tipo = normalizeTipo(oc);
  return !!tipo && tipo !== "SEGUIU VIAGEM";
}

function parseHoraToMinutes(hora) {
  const txt = s(hora);
  if (!txt) return null;
  const parts = txt.split(":");
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  const ss = Number(parts[2] || 0);
  if (![hh, mm, ss].every(Number.isFinite)) return null;
  return hh * 60 + mm + ss / 60;
}

function horaFaixa(hora) {
  const mins = parseHoraToMinutes(hora);
  if (mins == null) return "Sem hora";
  const h = Math.floor(mins / 60);
  return `${String(h).padStart(2, "0")}:00`;
}

function calcTempoSolucaoHoras(dataSOS, horaSOS, dataFim) {
  const iniDate = safeDateStr(dataSOS);
  const fimDate = safeDateStr(dataFim);

  if (!iniDate || !fimDate) return 0;

  const start = new Date(`${iniDate}T${s(horaSOS) || "00:00:00"}`);
  const end = new Date(`${fimDate}T23:59:59`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const hours = (end.getTime() - start.getTime()) / 36e5;
  return hours > 0 ? hours : 0;
}

function calcVariacaoPct(atual, anterior) {
  const a = n(atual);
  const b = n(anterior);
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

function exportarParaExcel(dados, nomeArquivo) {
  if (!dados?.length) return;
  const cols = Object.keys(dados[0]);
  const linhas = dados.map((row) =>
    cols.map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(";")
  );
  const csv = [cols.join(";"), ...linhas].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function SortIcon({ active, direction }) {
  if (!active) return <span className="text-gray-300 ml-2 text-[10px]">↕</span>;
  return direction === "asc" ? (
    <span className="text-blue-600 ml-2 text-[10px]">▲</span>
  ) : (
    <span className="text-blue-600 ml-2 text-[10px]">▼</span>
  );
}

function EvolucaoBadge({ value, invert = false }) {
  const val = n(value);
  const txt = `${fmtNum(Math.abs(val), 1)}%`;

  if (val > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
          invert
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}
      >
        <FaArrowUp size={10} /> {txt}
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
        <FaArrowDown size={10} /> {txt}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
      <FaEquals size={10} /> 0,0%
    </span>
  );
}

function CardKPI({ icon: Icon, title, value, aux, badge }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {title}
          </div>
          <div className="text-2xl font-black text-slate-800 mt-1">{value}</div>
          {aux ? <div className="text-xs text-slate-500 mt-1">{aux}</div> : null}
        </div>
        <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-slate-700">
          <Icon />
        </div>
      </div>
      {badge ? <div className="mt-3">{badge}</div> : null}
    </div>
  );
}

function TableCard({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between gap-3">
        <h3 className="font-black text-slate-800">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ThSortable({ label, sortKey, sortConfig, onSort }) {
  return (
    <th
      className="text-left px-3 py-2 cursor-pointer select-none"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon
          active={sortConfig.key === sortKey}
          direction={sortConfig.direction}
        />
      </span>
    </th>
  );
}

export default function SOSResumo() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [rowsBase, setRowsBase] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("EXECUTIVO");

  const [busca, setBusca] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroOcorrencia, setFiltroOcorrencia] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  const [sortReinc, setSortReinc] = useState({ key: "qtde_sos", direction: "desc" });
  const [sortVeic, setSortVeic] = useState({ key: "int_ref", direction: "desc" });
  const [sortLinha, setSortLinha] = useState({ key: "int_ref", direction: "desc" });
  const [sortDefeito, setSortDefeito] = useState({ key: "total", direction: "desc" });

  async function carregarTudo() {
    setLoading(true);
    setErro("");
    try {
      const { data, error } = await supabase
        .from("sos_acionamentos")
        .select("*")
        .order("data_sos", { ascending: false })
        .limit(50000);

      if (error) throw error;
      setRowsBase(data || []);
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

  const dataset = useMemo(() => {
    return (rowsBase || [])
      .map((r) => {
        const dataSOS = safeDateStr(r.data_sos || r.created_at);
        const mesAno = dataSOS ? dataSOS.slice(0, 7) : "";
        const tipo_norm = normalizeTipo(r.ocorrencia);
        const valida_mkbf = isOcorrenciaValida(r.ocorrencia);
        const classificacao = s(r.classificacao_controlabilidade);
        const controlavel = normalize(classificacao) === normalize("Controlável");
        const tempo_solucao_horas = calcTempoSolucaoHoras(
          r.data_sos || r.created_at,
          r.hora_sos,
          r.data_encerramento || r.data_fechamento
        );

        const dias_pos_preventiva = diffDays(dataSOS, r.data_ultima_preventiva);
        const dias_pos_inspecao = diffDays(dataSOS, r.data_ultima_inspecao);

        const km_preventiva = Number(r.km_rodado_preventiva);
        const km_inspecao = Number(r.km_rodado_inspecao);

        return {
          ...r,
          dataSOS,
          Mes_Ano: mesAno,
          tipo_norm,
          valida_mkbf,
          controlavel,
          veiculo_norm: s(r.veiculo) || "N/D",
          linha_norm: normalize(r.linha) || "N/D",
          setor_norm: s(r.setor_manutencao) || "N/D",
          defeito_norm: s(r.problema_encontrado) || "N/D",
          classificacao_norm: classificacao || "N/D",
          faixa_horaria: horaFaixa(r.hora_sos),
          tempo_solucao_horas,
          dias_pos_preventiva,
          dias_pos_inspecao,
          km_rodado_preventiva_num: Number.isFinite(km_preventiva) ? km_preventiva : null,
          km_rodado_inspecao_num: Number.isFinite(km_inspecao) ? km_inspecao : null,
        };
      })
      .filter((r) => r.dataSOS && r.controlavel);
  }, [rowsBase]);

  const mesesDisponiveis = useMemo(() => {
    return [...new Set(dataset.map((r) => r.Mes_Ano).filter(Boolean))].sort();
  }, [dataset]);

  useEffect(() => {
    if (!mesReferencia && mesesDisponiveis.length) {
      setMesReferencia(mesesDisponiveis[mesesDisponiveis.length - 1]);
    }
  }, [mesReferencia, mesesDisponiveis]);

  const mesComparacao = useMemo(() => previousMonth(mesReferencia), [mesReferencia]);
  const mes2Atras = useMemo(() => previousMonth(mesComparacao), [mesComparacao]);

  const linhasUnicas = useMemo(() => {
    return [...new Set(dataset.map((r) => r.linha_norm).filter(Boolean))].sort();
  }, [dataset]);

  const setoresUnicos = useMemo(() => {
    return [...new Set(dataset.map((r) => r.setor_norm).filter(Boolean))].sort();
  }, [dataset]);

  const ocorrenciasUnicas = useMemo(() => {
    return [...new Set(dataset.map((r) => r.tipo_norm).filter(Boolean))].sort();
  }, [dataset]);

  const datasetFiltrado = useMemo(() => {
    const q = busca.toLowerCase().trim();

    return dataset.filter((r) => {
      if (mesReferencia && ![mesReferencia, mesComparacao, mes2Atras].includes(r.Mes_Ano)) return false;
      if (filtroLinha && r.linha_norm !== filtroLinha) return false;
      if (filtroSetor && r.setor_norm !== filtroSetor) return false;
      if (filtroOcorrencia && r.tipo_norm !== filtroOcorrencia) return false;

      if (!q) return true;

      return (
        String(r.numero_sos || "").toLowerCase().includes(q) ||
        String(r.veiculo_norm || "").toLowerCase().includes(q) ||
        String(r.motorista_nome || "").toLowerCase().includes(q) ||
        String(r.linha_norm || "").toLowerCase().includes(q) ||
        String(r.setor_norm || "").toLowerCase().includes(q) ||
        String(r.defeito_norm || "").toLowerCase().includes(q) ||
        String(r.tipo_norm || "").toLowerCase().includes(q)
      );
    });
  }, [dataset, busca, mesReferencia, mesComparacao, mes2Atras, filtroLinha, filtroSetor, filtroOcorrencia]);

  const rowsRef = useMemo(
    () => datasetFiltrado.filter((r) => r.Mes_Ano === mesReferencia),
    [datasetFiltrado, mesReferencia]
  );
  const rowsComp = useMemo(
    () => datasetFiltrado.filter((r) => r.Mes_Ano === mesComparacao),
    [datasetFiltrado, mesComparacao]
  );
  const rows3m = useMemo(
    () => datasetFiltrado.filter((r) => [mes2Atras, mesComparacao, mesReferencia].includes(r.Mes_Ano)),
    [datasetFiltrado, mes2Atras, mesComparacao, mesReferencia]
  );

  const datasetReinc = useMemo(() => {
    const byVehicle = new Map();

    [...rows3m]
      .sort((a, b) => {
        if (a.veiculo_norm !== b.veiculo_norm) return a.veiculo_norm.localeCompare(b.veiculo_norm);
        return a.dataSOS.localeCompare(b.dataSOS);
      })
      .forEach((r) => {
        const key = r.veiculo_norm;
        if (!byVehicle.has(key)) byVehicle.set(key, []);
        byVehicle.get(key).push(r);
      });

    const out = [];

    byVehicle.forEach((items, veiculo) => {
      let prev = null;

      items.forEach((curr) => {
        const diasEntreSOS = prev ? diffDays(curr.dataSOS, prev.dataSOS) : null;
        const mesmoDefeito = prev ? normalize(curr.defeito_norm) === normalize(prev.defeito_norm) : false;

        out.push({
          ...curr,
          veiculo_reinc: veiculo,
          data_anterior: prev?.dataSOS || "",
          defeito_anterior: prev?.defeito_norm || "",
          dias_entre_sos: diasEntreSOS,
          reinc_7d: diasEntreSOS != null && diasEntreSOS <= 7,
          reinc_15d: diasEntreSOS != null && diasEntreSOS <= 15,
          mesmo_defeito_reincidente: !!(mesmoDefeito && diasEntreSOS != null && diasEntreSOS <= 15),
        });

        prev = curr;
      });
    });

    return out;
  }, [rows3m]);

  const reincRef = useMemo(
    () => datasetReinc.filter((r) => r.Mes_Ano === mesReferencia),
    [datasetReinc, mesReferencia]
  );

  const resumoAtual = useMemo(() => {
    const total = rowsRef.length;
    const tempoMedio = total
      ? rowsRef.reduce((acc, r) => acc + n(r.tempo_solucao_horas), 0) / total
      : 0;

    const reinc7 = reincRef.filter((r) => r.reinc_7d).length;
    const reinc15 = reincRef.filter((r) => r.reinc_15d).length;
    const mesmoDefeito = reincRef.filter((r) => r.mesmo_defeito_reincidente).length;

    const veiculosRef = [...new Set(rowsRef.map((r) => r.veiculo_norm))].filter(Boolean);
    const veiculosReincidentes = [...new Set(reincRef.filter((r) => r.reinc_15d).map((r) => r.veiculo_norm))];
    const taxaVeicReinc = veiculosRef.length ? (veiculosReincidentes.length / veiculosRef.length) * 100 : 0;

    const diasPosPreventivaValidos = rowsRef
      .map((r) => r.dias_pos_preventiva)
      .filter((v) => v != null && v >= 0);

    const diasPosInspecaoValidos = rowsRef
      .map((r) => r.dias_pos_inspecao)
      .filter((v) => v != null && v >= 0);

    const diasEntreSOSValidos = reincRef
      .map((r) => r.dias_entre_sos)
      .filter((v) => v != null && v >= 0);

    const mediaPosPreventiva = diasPosPreventivaValidos.length
      ? diasPosPreventivaValidos.reduce((a, b) => a + b, 0) / diasPosPreventivaValidos.length
      : 0;

    const mediaPosInspecao = diasPosInspecaoValidos.length
      ? diasPosInspecaoValidos.reduce((a, b) => a + b, 0) / diasPosInspecaoValidos.length
      : 0;

    const mediaEntreSOS = diasEntreSOSValidos.length
      ? diasEntreSOSValidos.reduce((a, b) => a + b, 0) / diasEntreSOSValidos.length
      : 0;

    return {
      total,
      tempoMedio,
      reinc7,
      reinc15,
      mesmoDefeito,
      taxaVeicReinc,
      mediaPosPreventiva,
      mediaPosInspecao,
      mediaEntreSOS,
    };
  }, [rowsRef, reincRef]);

  const resumoAnterior = useMemo(() => {
    const reincComp = datasetReinc.filter((r) => r.Mes_Ano === mesComparacao);
    const total = rowsComp.length;
    const tempoMedio = total
      ? rowsComp.reduce((acc, r) => acc + n(r.tempo_solucao_horas), 0) / total
      : 0;

    const reinc7 = reincComp.filter((r) => r.reinc_7d).length;
    const reinc15 = reincComp.filter((r) => r.reinc_15d).length;
    const mesmoDefeito = reincComp.filter((r) => r.mesmo_defeito_reincidente).length;

    const veiculosComp = [...new Set(rowsComp.map((r) => r.veiculo_norm))].filter(Boolean);
    const veiculosReincComp = [...new Set(reincComp.filter((r) => r.reinc_15d).map((r) => r.veiculo_norm))];
    const taxaVeicReinc = veiculosComp.length ? (veiculosReincComp.length / veiculosComp.length) * 100 : 0;

    const diasPosPreventivaValidos = rowsComp
      .map((r) => r.dias_pos_preventiva)
      .filter((v) => v != null && v >= 0);

    const diasPosInspecaoValidos = rowsComp
      .map((r) => r.dias_pos_inspecao)
      .filter((v) => v != null && v >= 0);

    const diasEntreSOSValidos = reincComp
      .map((r) => r.dias_entre_sos)
      .filter((v) => v != null && v >= 0);

    const mediaPosPreventiva = diasPosPreventivaValidos.length
      ? diasPosPreventivaValidos.reduce((a, b) => a + b, 0) / diasPosPreventivaValidos.length
      : 0;

    const mediaPosInspecao = diasPosInspecaoValidos.length
      ? diasPosInspecaoValidos.reduce((a, b) => a + b, 0) / diasPosInspecaoValidos.length
      : 0;

    const mediaEntreSOS = diasEntreSOSValidos.length
      ? diasEntreSOSValidos.reduce((a, b) => a + b, 0) / diasEntreSOSValidos.length
      : 0;

    return {
      total,
      tempoMedio,
      reinc7,
      reinc15,
      mesmoDefeito,
      taxaVeicReinc,
      mediaPosPreventiva,
      mediaPosInspecao,
      mediaEntreSOS,
    };
  }, [rowsComp, datasetReinc, mesComparacao]);

  const cards = useMemo(() => {
    return [
      {
        title: "SOS Controláveis",
        value: fmtInt(resumoAtual.total),
        aux: `Mês ${monthLabelPt(mesReferencia)}`,
        icon: FaTools,
        badge: <EvolucaoBadge value={calcVariacaoPct(resumoAtual.total, resumoAnterior.total)} invert />,
      },
      {
        title: "Reincidência 7 dias",
        value: fmtInt(resumoAtual.reinc7),
        aux: "Novo SOS até 7 dias",
        icon: FaSync,
        badge: <EvolucaoBadge value={calcVariacaoPct(resumoAtual.reinc7, resumoAnterior.reinc7)} invert />,
      },
      {
        title: "Reincidência 15 dias",
        value: fmtInt(resumoAtual.reinc15),
        aux: "Novo SOS até 15 dias",
        icon: FaBus,
        badge: <EvolucaoBadge value={calcVariacaoPct(resumoAtual.reinc15, resumoAnterior.reinc15)} invert />,
      },
      {
        title: "Mesmo defeito",
        value: fmtInt(resumoAtual.mesmoDefeito),
        aux: "Reincidência do mesmo defeito",
        icon: FaExclamationTriangle,
        badge: (
          <EvolucaoBadge
            value={calcVariacaoPct(resumoAtual.mesmoDefeito, resumoAnterior.mesmoDefeito)}
            invert
          />
        ),
      },
      {
        title: "Dias pós-preventiva",
        value: fmtNum(resumoAtual.mediaPosPreventiva, 1),
        aux: "Média até o SOS",
        icon: FaClipboardList,
        badge: (
          <EvolucaoBadge
            value={calcVariacaoPct(resumoAtual.mediaPosPreventiva, resumoAnterior.mediaPosPreventiva)}
            invert
          />
        ),
      },
      {
        title: "Dias pós-inspeção",
        value: fmtNum(resumoAtual.mediaPosInspecao, 1),
        aux: "Média até o SOS",
        icon: FaShieldAlt,
        badge: (
          <EvolucaoBadge
            value={calcVariacaoPct(resumoAtual.mediaPosInspecao, resumoAnterior.mediaPosInspecao)}
            invert
          />
        ),
      },
      {
        title: "Dias entre SOS",
        value: fmtNum(resumoAtual.mediaEntreSOS, 1),
        aux: "Intervalo médio por veículo",
        icon: FaClock,
        badge: (
          <EvolucaoBadge
            value={calcVariacaoPct(resumoAtual.mediaEntreSOS, resumoAnterior.mediaEntreSOS)}
            invert
          />
        ),
      },
      {
        title: "Tempo médio solução",
        value: fmtHoras(resumoAtual.tempoMedio),
        aux: "Abertura até fechamento",
        icon: FaWrench,
        badge: (
          <EvolucaoBadge
            value={calcVariacaoPct(resumoAtual.tempoMedio, resumoAnterior.tempoMedio)}
            invert
          />
        ),
      },
    ];
  }, [resumoAtual, resumoAnterior, mesReferencia]);

  const kpisExecutivos = useMemo(() => {
    const topDefeito = rowsRef.reduce((acc, r) => {
      acc[r.defeito_norm] = n(acc[r.defeito_norm]) + 1;
      return acc;
    }, {});
    const topSetor = rowsRef.reduce((acc, r) => {
      acc[r.setor_norm] = n(acc[r.setor_norm]) + 1;
      return acc;
    }, {});
    const topVeiculo = rowsRef.reduce((acc, r) => {
      acc[r.veiculo_norm] = n(acc[r.veiculo_norm]) + 1;
      return acc;
    }, {});
    const topLinha = rowsRef.reduce((acc, r) => {
      acc[r.linha_norm] = n(acc[r.linha_norm]) + 1;
      return acc;
    }, {});

    const pickTop = (obj) => {
      const entries = Object.entries(obj);
      if (!entries.length) return { nome: "N/D", total: 0 };
      const [nome, total] = entries.sort((a, b) => b[1] - a[1])[0];
      return { nome, total };
    };

    return {
      topDefeito: pickTop(topDefeito),
      topSetor: pickTop(topSetor),
      topVeiculo: pickTop(topVeiculo),
      topLinha: pickTop(topLinha),
    };
  }, [rowsRef]);

  const chartMensal3m = useMemo(() => {
    const meses = [mes2Atras, mesComparacao, mesReferencia].filter(Boolean);
    return meses.map((m) => {
      const rows = rows3m.filter((r) => r.Mes_Ano === m);
      const reinc15 = datasetReinc.filter((r) => r.Mes_Ano === m && r.reinc_15d).length;
      return {
        mes: monthLabelPt(m),
        controlaveis: rows.length,
        reinc15,
      };
    });
  }, [rows3m, mes2Atras, mesComparacao, mesReferencia, datasetReinc]);

  const chartHorario = useMemo(() => {
    const map = new Map();

    rows3m.forEach((r) => {
      const key = r.faixa_horaria || "Sem hora";
      if (!map.has(key)) {
        map.set(key, { faixa: key, total_3m: 0, ref: 0 });
      }
      const item = map.get(key);
      item.total_3m += 1;
      if (r.Mes_Ano === mesReferencia) item.ref += 1;
    });

    return [...map.values()]
      .sort((a, b) => a.faixa.localeCompare(b.faixa))
      .filter((r) => r.faixa !== "Sem hora" || r.total_3m > 0);
  }, [rows3m, mesReferencia]);

  const topLinhasFlash = useMemo(() => {
    const map = new Map();

    rows3m.forEach((r) => {
      const key = r.linha_norm;
      if (!map.has(key)) {
        map.set(key, { linha: key, int_total: 0, int_ref: 0, defeitos: {} });
      }
      const item = map.get(key);
      item.int_total += 1;
      if (r.Mes_Ano === mesReferencia) item.int_ref += 1;
      item.defeitos[r.defeito_norm] = n(item.defeitos[r.defeito_norm]) + 1;
    });

    return [...map.values()]
      .map((r) => {
        const topDefeito = Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D";
        return { ...r, top_defeito: topDefeito };
      })
      .sort((a, b) => b.int_ref - a.int_ref || b.int_total - a.int_total)
      .slice(0, 10);
  }, [rows3m, mesReferencia]);

  const topVeiculosFlash = useMemo(() => {
    const map = new Map();

    rows3m.forEach((r) => {
      const key = r.veiculo_norm;
      if (!map.has(key)) {
        map.set(key, {
          veiculo: key,
          int_total: 0,
          int_ref: 0,
          defeitos: {},
          setores: {},
          por_mes: {},
        });
      }
      const item = map.get(key);
      item.int_total += 1;
      if (r.Mes_Ano === mesReferencia) item.int_ref += 1;
      item.defeitos[r.defeito_norm] = n(item.defeitos[r.defeito_norm]) + 1;
      item.setores[r.setor_norm] = n(item.setores[r.setor_norm]) + 1;
      item.por_mes[r.Mes_Ano] = n(item.por_mes[r.Mes_Ano]) + 1;
    });

    return [...map.values()]
      .map((r) => ({
        ...r,
        top_defeito: Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        top_setor: Object.entries(r.setores).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        mes_m2: n(r.por_mes[mes2Atras]),
        mes_m1: n(r.por_mes[mesComparacao]),
        mes_ref: n(r.por_mes[mesReferencia]),
      }))
      .sort((a, b) => b.int_ref - a.int_ref || b.int_total - a.int_total)
      .slice(0, 10);
  }, [rows3m, mesReferencia, mesComparacao, mes2Atras]);

  const clusterRows = useMemo(() => {
    const deriveCluster = (veiculo) => {
      const v = normalize(veiculo);
      if (!v) return "OUTROS";
      if (v.startsWith("2216")) return "C8";
      if (v.startsWith("2222")) return "C9";
      if (v.startsWith("2224")) return "C10";
      if (v.startsWith("2425")) return "C11";
      if (v.startsWith("W")) return "C6";
      return "OUTROS";
    };

    const map = new Map();

    rows3m.forEach((r) => {
      const c = deriveCluster(r.veiculo_norm);
      if (!map.has(c)) {
        map.set(c, {
          cluster: c,
          [mes2Atras]: 0,
          [mesComparacao]: 0,
          [mesReferencia]: 0,
          veiculosRef: new Set(),
        });
      }
      const item = map.get(c);
      item[r.Mes_Ano] = n(item[r.Mes_Ano]) + 1;
      if (r.Mes_Ano === mesReferencia) item.veiculosRef.add(r.veiculo_norm);
    });

    return [...map.values()]
      .map((r) => ({
        cluster: r.cluster,
        mes2: n(r[mes2Atras]),
        mes1: n(r[mesComparacao]),
        mesRef: n(r[mesReferencia]),
        frotaRef: r.veiculosRef.size,
        intVeicRef: r.veiculosRef.size ? n(r[mesReferencia]) / r.veiculosRef.size : 0,
      }))
      .sort((a, b) => b.mesRef - a.mesRef);
  }, [rows3m, mes2Atras, mesComparacao, mesReferencia]);

  const faixasTempo = useMemo(() => {
    const montar = (arr, campo) => {
      const buckets = {
        "0-7": 0,
        "8-15": 0,
        "16-30": 0,
        "31+": 0,
        "Sem base": 0,
      };

      arr.forEach((r) => {
        const v = r[campo];
        if (v == null || v < 0) {
          buckets["Sem base"] += 1;
        } else if (v <= 7) {
          buckets["0-7"] += 1;
        } else if (v <= 15) {
          buckets["8-15"] += 1;
        } else if (v <= 30) {
          buckets["16-30"] += 1;
        } else {
          buckets["31+"] += 1;
        }
      });

      return Object.entries(buckets).map(([faixa, total]) => ({ faixa, total }));
    };

    return {
      preventiva: montar(rowsRef, "dias_pos_preventiva"),
      inspecao: montar(rowsRef, "dias_pos_inspecao"),
      entreSOS: montar(reincRef, "dias_entre_sos"),
    };
  }, [rowsRef, reincRef]);

  const consolidadoReinc = useMemo(() => {
    const map = new Map();

    reincRef.forEach((r) => {
      const key = r.veiculo_reinc || r.veiculo_norm;
      if (!map.has(key)) {
        map.set(key, {
          veiculo: key,
          qtde_sos: 0,
          reinc_7d: 0,
          reinc_15d: 0,
          mesmo_defeito: 0,
          ultimo_sos: "",
          sos_anterior: "",
          dias_medio_entre: 0,
          dias_count: 0,
          top_defeito: {},
          linha: {},
        });
      }

      const item = map.get(key);
      item.qtde_sos += 1;
      if (r.reinc_7d) item.reinc_7d += 1;
      if (r.reinc_15d) item.reinc_15d += 1;
      if (r.mesmo_defeito_reincidente) item.mesmo_defeito += 1;
      item.ultimo_sos = r.dataSOS || item.ultimo_sos;
      item.sos_anterior = r.data_anterior || item.sos_anterior;

      if (r.dias_entre_sos != null && r.dias_entre_sos >= 0) {
        item.dias_medio_entre += r.dias_entre_sos;
        item.dias_count += 1;
      }

      item.top_defeito[r.defeito_norm] = n(item.top_defeito[r.defeito_norm]) + 1;
      item.linha[r.linha_norm] = n(item.linha[r.linha_norm]) + 1;
    });

    return [...map.values()].map((r) => ({
      ...r,
      dias_medio_entre: r.dias_count ? r.dias_medio_entre / r.dias_count : 0,
      top_defeito: Object.entries(r.top_defeito).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      linha_top: Object.entries(r.linha).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
    }));
  }, [reincRef]);

  const sortedReinc = useMemo(() => {
    const rows = [...consolidadoReinc];
    rows.sort((a, b) => {
      const av = a[sortReinc.key];
      const bv = b[sortReinc.key];
      const dir = sortReinc.direction === "asc" ? 1 : -1;
      if (typeof av === "string") return av.localeCompare(String(bv || "")) * dir;
      return (n(av) - n(bv)) * dir;
    });
    return rows;
  }, [consolidadoReinc, sortReinc]);

  const sortedVeic = useMemo(() => {
    const rows = [...topVeiculosFlash];
    rows.sort((a, b) => {
      const av = a[sortVeic.key];
      const bv = b[sortVeic.key];
      const dir = sortVeic.direction === "asc" ? 1 : -1;
      if (typeof av === "string") return av.localeCompare(String(bv || "")) * dir;
      return (n(av) - n(bv)) * dir;
    });
    return rows;
  }, [topVeiculosFlash, sortVeic]);

  const sortedLinha = useMemo(() => {
    const rows = [...topLinhasFlash];
    rows.sort((a, b) => {
      const av = a[sortLinha.key];
      const bv = b[sortLinha.key];
      const dir = sortLinha.direction === "asc" ? 1 : -1;
      if (typeof av === "string") return av.localeCompare(String(bv || "")) * dir;
      return (n(av) - n(bv)) * dir;
    });
    return rows;
  }, [topLinhasFlash, sortLinha]);

  const rankingDefeitos = useMemo(() => {
    const map = new Map();

    rowsRef.forEach((r) => {
      const key = r.defeito_norm;
      if (!map.has(key)) {
        map.set(key, {
          defeito: key,
          total: 0,
          setor: {},
          linha: {},
          preventiva7: 0,
          inspecao7: 0,
        });
      }
      const item = map.get(key);
      item.total += 1;
      item.setor[r.setor_norm] = n(item.setor[r.setor_norm]) + 1;
      item.linha[r.linha_norm] = n(item.linha[r.linha_norm]) + 1;
      if (r.dias_pos_preventiva != null && r.dias_pos_preventiva <= 7) item.preventiva7 += 1;
      if (r.dias_pos_inspecao != null && r.dias_pos_inspecao <= 7) item.inspecao7 += 1;
    });

    return [...map.values()].map((r) => ({
      ...r,
      top_setor: Object.entries(r.setor).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      top_linha: Object.entries(r.linha).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
    }));
  }, [rowsRef]);

  const sortedDefeitos = useMemo(() => {
    const rows = [...rankingDefeitos];
    rows.sort((a, b) => {
      const av = a[sortDefeito.key];
      const bv = b[sortDefeito.key];
      const dir = sortDefeito.direction === "asc" ? 1 : -1;
      if (typeof av === "string") return av.localeCompare(String(bv || "")) * dir;
      return (n(av) - n(bv)) * dir;
    });
    return rows;
  }, [rankingDefeitos, sortDefeito]);

  function toggleSort(current, setter, key) {
    if (current.key === key) {
      setter({ key, direction: current.direction === "asc" ? "desc" : "asc" });
    } else {
      setter({ key, direction: "desc" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <FaTools /> Resumo SOS
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">
              SOSResumo
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Painel executivo e analítico de SOS controláveis com visão de flash report.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                exportarParaExcel(
                  rowsRef.map((r) => ({
                    Número: r.numero_sos,
                    Data: fmtDateBr(r.dataSOS),
                    Prefixo: r.veiculo_norm,
                    Linha: r.linha_norm,
                    Ocorrência: r.tipo_norm,
                    Setor: r.setor_norm,
                    Problema: r.defeito_norm,
                    "Dias pós Preventiva": r.dias_pos_preventiva ?? "",
                    "Dias pós Inspeção": r.dias_pos_inspecao ?? "",
                    "Tempo Solução (h)": fmtNum(r.tempo_solucao_horas, 2),
                  })),
                  "SOSResumo_Base_Controlaveis"
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition"
            >
              <FaDownload /> Baixar Excel
            </button>

            <button
              onClick={() => setMostrarExplicacao(!mostrarExplicacao)}
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
          <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm">
            <h3 className="font-bold text-base mb-2">Metodologia do SOSResumo</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>O painel considera apenas registros classificados como <strong>Controlável</strong>.</li>
              <li>As ocorrências são normalizadas no front para consolidar RECOLHEU, SOS, TROCA, AVARIA e IMPROCEDENTE.</li>
              <li>O comparativo principal usa <strong>mês referência x mês anterior</strong>.</li>
              <li>Os gráficos de linha, horário, veículo e cluster seguem a mesma leitura do flash report.</li>
              <li>Reincidência é calculada por veículo, usando <strong>dias entre SOS</strong>, com flags de <strong>7 dias</strong>, <strong>15 dias</strong> e <strong>mesmo defeito</strong>.</li>
              <li>Os indicadores de pós-preventiva e pós-inspeção usam a diferença entre <strong>data_sos</strong> e as datas informadas no tratamento.</li>
            </ul>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="xl:col-span-2">
            <label className="text-xs font-bold text-slate-500">Busca</label>
            <div className="mt-1 relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Número, prefixo, linha, setor, problema..."
                className="w-full border rounded-xl pl-10 pr-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Mês referência</label>
            <select
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
            >
              {mesesDisponiveis.map((m) => (
                <option key={m} value={m}>
                  {monthLabelPt(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Ocorrência</label>
            <select
              value={filtroOcorrencia}
              onChange={(e) => setFiltroOcorrencia(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Todas</option>
              {ocorrenciasUnicas.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Linha</label>
            <select
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Todas</option>
              {linhasUnicas.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500">Setor</label>
            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Todos</option>
              {setoresUnicos.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {erro ? (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-2xl p-4">
          {erro}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((card) => (
          <CardKPI key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <CardKPI
          icon={FaExclamationTriangle}
          title="Principal defeito"
          value={kpisExecutivos.topDefeito.nome}
          aux={`${fmtInt(kpisExecutivos.topDefeito.total)} ocorrências`}
        />
        <CardKPI
          icon={FaWrench}
          title="Principal setor"
          value={kpisExecutivos.topSetor.nome}
          aux={`${fmtInt(kpisExecutivos.topSetor.total)} ocorrências`}
        />
        <CardKPI
          icon={FaBus}
          title="Pior veículo"
          value={kpisExecutivos.topVeiculo.nome}
          aux={`${fmtInt(kpisExecutivos.topVeiculo.total)} ocorrências`}
        />
        <CardKPI
          icon={FaRoute}
          title="Linha mais ofensora"
          value={kpisExecutivos.topLinha.nome}
          aux={`${fmtInt(kpisExecutivos.topLinha.total)} ocorrências`}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-2">
        <div className="flex flex-wrap gap-2">
          {[
            ["EXECUTIVO", "Executivo"],
            ["REINCIDENCIA", "Reincidência"],
            ["PREVENTIVA", "Preventiva / Inspeção"],
            ["OFENSORES", "Ofensores"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setAbaAtiva(key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                abaAtiva === key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border shadow-sm p-10 text-center text-slate-500">
          Carregando dados...
        </div>
      ) : null}

      {!loading && abaAtiva === "EXECUTIVO" && (
        <div className="space-y-6">
          <TableCard title="Evolução mensal de SOS controláveis e reincidência 15 dias">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartMensal3m}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="controlaveis" name="Controláveis" strokeWidth={3} />
                  <Line type="monotone" dataKey="reinc15" name="Reincidência 15d" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TableCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TableCard title="Faixa horária — 3 meses x mês atual">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartHorario}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="faixa" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_3m" name="3 meses" />
                    <Bar dataKey="ref" name={monthLabelPt(mesReferencia)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TableCard>

            <TableCard title="Cluster — 3 meses e intervenção por veículo">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2">Cluster</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mes2Atras)}</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mesComparacao)}</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mesReferencia)}</th>
                      <th className="text-right px-3 py-2">Frota mês</th>
                      <th className="text-right px-3 py-2">Int/veículo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clusterRows.map((r) => (
                      <tr key={r.cluster} className="border-t">
                        <td className="px-3 py-2 font-bold">{r.cluster}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.mes2)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.mes1)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.mesRef)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.frotaRef)}</td>
                        <td className="px-3 py-2 text-right">{fmtNum(r.intVeicRef, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TableCard title="Top linhas — visão flash report">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2">Linha</th>
                      <th className="text-right px-3 py-2">3 meses</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mesReferencia)}</th>
                      <th className="text-left px-3 py-2">Maior defeito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinhasFlash.slice(0, 5).map((r) => (
                      <tr key={r.linha} className="border-t">
                        <td className="px-3 py-2 font-bold">{r.linha}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.int_total)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.int_ref)}</td>
                        <td className="px-3 py-2">{r.top_defeito}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCard>

            <TableCard title="Top veículos — visão flash report">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2">Veículo</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mes2Atras)}</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mesComparacao)}</th>
                      <th className="text-right px-3 py-2">{monthLabelPt(mesReferencia)}</th>
                      <th className="text-left px-3 py-2">Top defeito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVeiculosFlash.slice(0, 5).map((r) => (
                      <tr key={r.veiculo} className="border-t">
                        <td className="px-3 py-2 font-bold">{r.veiculo}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.mes_m2)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.mes_m1)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.mes_ref)}</td>
                        <td className="px-3 py-2">{r.top_defeito}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {!loading && abaAtiva === "REINCIDENCIA" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TableCard title="Faixa de dias entre SOS">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixasTempo.entreSOS}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="faixa" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Qtde" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TableCard>

            <TableCard title="Consolidado de reincidência">
              <div className="grid grid-cols-2 gap-3">
                <CardKPI icon={FaSync} title="Reinc. 7 dias" value={fmtInt(resumoAtual.reinc7)} />
                <CardKPI icon={FaBus} title="Reinc. 15 dias" value={fmtInt(resumoAtual.reinc15)} />
                <CardKPI icon={FaExclamationTriangle} title="Mesmo defeito" value={fmtInt(resumoAtual.mesmoDefeito)} />
                <CardKPI icon={FaClock} title="% veículos reincidentes" value={fmtPct(resumoAtual.taxaVeicReinc, 1)} />
              </div>
            </TableCard>
          </div>

          <TableCard title="Veículos reincidentes">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <ThSortable label="Veículo" sortKey="veiculo" sortConfig={sortReinc} onSort={(k) => toggleSort(sortReinc, setSortReinc, k)} />
                    <ThSortable label="SOS" sortKey="qtde_sos" sortConfig={sortReinc} onSort={(k) => toggleSort(sortReinc, setSortReinc, k)} />
                    <ThSortable label="Reinc. 7d" sortKey="reinc_7d" sortConfig={sortReinc} onSort={(k) => toggleSort(sortReinc, setSortReinc, k)} />
                    <ThSortable label="Reinc. 15d" sortKey="reinc_15d" sortConfig={sortReinc} onSort={(k) => toggleSort(sortReinc, setSortReinc, k)} />
                    <ThSortable label="Mesmo defeito" sortKey="mesmo_defeito" sortConfig={sortReinc} onSort={(k) => toggleSort(sortReinc, setSortReinc, k)} />
                    <ThSortable label="Dias médios" sortKey="dias_medio_entre" sortConfig={sortReinc} onSort={(k) => toggleSort(sortReinc, setSortReinc, k)} />
                    <th className="text-left px-3 py-2">Linha top</th>
                    <th className="text-left px-3 py-2">Defeito top</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReinc.map((r) => (
                    <tr key={r.veiculo} className="border-t">
                      <td className="px-3 py-2 font-bold">{r.veiculo}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.qtde_sos)}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.reinc_7d)}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.reinc_15d)}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.mesmo_defeito)}</td>
                      <td className="px-3 py-2 text-right">{fmtNum(r.dias_medio_entre, 1)}</td>
                      <td className="px-3 py-2">{r.linha_top}</td>
                      <td className="px-3 py-2">{r.top_defeito}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>
      )}

      {!loading && abaAtiva === "PREVENTIVA" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <TableCard title="Faixa pós-preventiva">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixasTempo.preventiva}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="faixa" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Qtde" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TableCard>

            <TableCard title="Faixa pós-inspeção">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={faixasTempo.inspecao}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="faixa" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="Qtde" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TableCard>

            <TableCard title="Indicadores consolidados">
              <div className="grid grid-cols-1 gap-3">
                <CardKPI icon={FaClipboardList} title="Dias médios pós-preventiva" value={fmtNum(resumoAtual.mediaPosPreventiva, 1)} />
                <CardKPI icon={FaShieldAlt} title="Dias médios pós-inspeção" value={fmtNum(resumoAtual.mediaPosInspecao, 1)} />
                <CardKPI icon={FaClock} title="Dias médios entre SOS" value={fmtNum(resumoAtual.mediaEntreSOS, 1)} />
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {!loading && abaAtiva === "OFENSORES" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TableCard title="Top veículos">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <ThSortable label="Veículo" sortKey="veiculo" sortConfig={sortVeic} onSort={(k) => toggleSort(sortVeic, setSortVeic, k)} />
                      <ThSortable label="3 meses" sortKey="int_total" sortConfig={sortVeic} onSort={(k) => toggleSort(sortVeic, setSortVeic, k)} />
                      <ThSortable label={monthLabelPt(mesReferencia)} sortKey="int_ref" sortConfig={sortVeic} onSort={(k) => toggleSort(sortVeic, setSortVeic, k)} />
                      <th className="text-left px-3 py-2">Top defeito</th>
                      <th className="text-left px-3 py-2">Top setor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedVeic.map((r) => (
                      <tr key={r.veiculo} className="border-t">
                        <td className="px-3 py-2 font-bold">{r.veiculo}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.int_total)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.int_ref)}</td>
                        <td className="px-3 py-2">{r.top_defeito}</td>
                        <td className="px-3 py-2">{r.top_setor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCard>

            <TableCard title="Top linhas">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <ThSortable label="Linha" sortKey="linha" sortConfig={sortLinha} onSort={(k) => toggleSort(sortLinha, setSortLinha, k)} />
                      <ThSortable label="3 meses" sortKey="int_total" sortConfig={sortLinha} onSort={(k) => toggleSort(sortLinha, setSortLinha, k)} />
                      <ThSortable label={monthLabelPt(mesReferencia)} sortKey="int_ref" sortConfig={sortLinha} onSort={(k) => toggleSort(sortLinha, setSortLinha, k)} />
                      <th className="text-left px-3 py-2">Top defeito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedLinha.map((r) => (
                      <tr key={r.linha} className="border-t">
                        <td className="px-3 py-2 font-bold">{r.linha}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.int_total)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(r.int_ref)}</td>
                        <td className="px-3 py-2">{r.top_defeito}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TableCard>
          </div>

          <TableCard title="Ranking de defeitos">
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <ThSortable label="Defeito" sortKey="defeito" sortConfig={sortDefeito} onSort={(k) => toggleSort(sortDefeito, setSortDefeito, k)} />
                    <ThSortable label="Total" sortKey="total" sortConfig={sortDefeito} onSort={(k) => toggleSort(sortDefeito, setSortDefeito, k)} />
                    <th className="text-left px-3 py-2">Top setor</th>
                    <th className="text-left px-3 py-2">Top linha</th>
                    <th className="text-right px-3 py-2">Até 7d pós-prev.</th>
                    <th className="text-right px-3 py-2">Até 7d pós-insp.</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDefeitos.map((r) => (
                    <tr key={r.defeito} className="border-t">
                      <td className="px-3 py-2 font-bold">{r.defeito}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.total)}</td>
                      <td className="px-3 py-2">{r.top_setor}</td>
                      <td className="px-3 py-2">{r.top_linha}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.preventiva7)}</td>
                      <td className="px-3 py-2 text-right">{fmtInt(r.inspecao7)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableCard>
        </div>
      )}
    </div>
  );
}
