import React, { useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaSync,
  FaSearch,
  FaRoad,
  FaTruck,
  FaUser,
  FaClipboardList,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaInfoCircle,
  FaArrowDown as FaDownload,
} from "react-icons/fa";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

import AnaliseLinhasModal from "../components/desempenho/resumo/AnaliseLinhasModal";
import RankingMotoristasModal from "../components/desempenho/resumo/RankingMotoristasModal";
import RankingCarrosModal from "../components/desempenho/resumo/RankingCarrosModal";
import AcompanhamentosModal from "../components/desempenho/resumo/AcompanhamentosModal";

const SUPABASE_A_URL = import.meta.env.VITE_SUPA_BASE_BCNT_URL;
const SUPABASE_A_ANON_KEY = import.meta.env.VITE_SUPA_BASE_BCNT_ANON_KEY;

const supabaseA =
  SUPABASE_A_URL && SUPABASE_A_ANON_KEY
    ? createClient(SUPABASE_A_URL, SUPABASE_A_ANON_KEY)
    : null;

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normalize(v) {
  return String(v || "").trim().toUpperCase();
}

function dateOnly(v) {
  if (!v) return "";
  return String(v).split("T")[0].split(" ")[0];
}

function safeDateStr(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (s.includes("T")) return s.split("T")[0];
  if (s.includes(" ")) return s.split(" ")[0];
  if (s.includes("/")) {
    const p = s.split("/");
    if (p.length === 3) return `${p[2].substring(0, 4)}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  }
  return s;
}

function fmtDateBr(v) {
  if (!v) return "-";
  const s = safeDateStr(v);
  if (!s) return "-";
  const p = s.split("-");
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return String(v);
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

function parseHoraToMin(hora) {
  const txt = String(hora || "").trim();
  if (!txt) return null;
  const parts = txt.split(":");
  if (parts.length < 2) return null;
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  const ss = Number(parts[2] || 0);
  if (![hh, mm, ss].every(Number.isFinite)) return null;
  return hh * 60 + mm + ss / 60;
}

function formatMinutes(mins) {
  const total = Math.max(0, Math.round(n(mins)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}min`;
}

function deriveCluster(prefixo) {
  const v = normalize(prefixo);
  if (!v) return null;
  if (["W511", "W513", "W515"].includes(v)) return null;
  if (v.startsWith("2216")) return "C8";
  if (v.startsWith("2222")) return "C9";
  if (v.startsWith("2224")) return "C10";
  if (v.startsWith("2425")) return "C11";
  if (v.startsWith("W")) return "C6";
  return null;
}

function extractChapa(motorista) {
  const s = String(motorista || "").trim();
  if (!s) return "N/D";
  const match = s.match(/\b(\d{3,10})\b/);
  return match?.[1] || s;
}

function statusNorm(v) {
  const s = normalize(v);
  if (!s) return "AGUARDANDO_INSTRUTOR";
  if (s === "AGUARDANDO INSTRUTOR") return "AGUARDANDO_INSTRUTOR";
  if (s === "AG_ACOMPANHAMENTO") return "AGUARDANDO_INSTRUTOR";
  if (s === "CONCLUIDO") return "OK";
  if (s === "TRATATIVA") return "ATAS";
  return s;
}

function getLinhaFocoAcompanhamento(item) {
  const meta = item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
  const linhaMeta = String(meta?.linha_foco || "").trim();
  if (linhaMeta) return linhaMeta.toUpperCase();

  const linhaDireta = String(item?.linha_foco || "").trim();
  if (linhaDireta) return linhaDireta.toUpperCase();

  const motivo = String(item?.motivo || "");
  const match = motivo.match(/linha\s+([a-z0-9]+)/i);
  return match?.[1] ? match[1].toUpperCase() : "SEM LINHA";
}

function statusBadgeClass(status) {
  const st = statusNorm(status);
  if (st === "AGUARDANDO_INSTRUTOR") return "bg-amber-50 text-amber-700 border-amber-200";
  if (st === "EM_MONITORAMENTO") return "bg-blue-50 text-blue-700 border-blue-200";
  if (st === "EM_ANALISE") return "bg-violet-50 text-violet-700 border-violet-200";
  if (st === "ATAS") return "bg-rose-50 text-rose-700 border-rose-200";
  if (st === "OK" || st === "ENCERRADO") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function SortIcon({ active, direction }) {
  if (!active) return <span className="text-gray-300 ml-2 text-[10px]">↕</span>;
  return direction === "asc" ? <span className="text-blue-600 ml-2 text-[10px]">▲</span> : <span className="text-blue-600 ml-2 text-[10px]">▼</span>;
}

function EvolucaoBadge({ value, invert = false, percent = false }) {
  const val = n(value);
  const txt = `${fmtNum(Math.abs(val), 2)}${percent ? "%" : ""}`;

  if (val > 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${invert ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
        <FaArrowUp size={10} /> {txt}
      </span>
    );
  }
  if (val < 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${invert ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
        <FaArrowDown size={10} /> {txt}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
      <FaEquals size={10} /> 0,00{percent ? "%" : ""}
    </span>
  );
}

function aggregatePeriodo(rows) {
  const km = rows.reduce((acc, r) => acc + n(r.Km), 0);
  const comb = rows.reduce((acc, r) => acc + n(r.Comb), 0);

  const litrosMeta = rows.reduce((acc, r) => {
    const litrosEsperados = n(r.Litros_Esperados);
    if (litrosEsperados > 0) return acc + litrosEsperados;
    const metaLinha = n(r.Meta_Linha);
    if (metaLinha > 0 && n(r.Km) > 0) return acc + n(r.Km) / metaLinha;
    return acc;
  }, 0);

  const kml = comb > 0 ? km / comb : 0;
  const desperdicio = Math.max(0, comb - litrosMeta);

  return { km, comb, litrosMeta, kml, desperdicio };
}

function agruparPorDiaStr(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const d = safeDateStr(r.dateOnly);
    if (!d) return;
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(r);
  });

  return [...map.entries()]
    .map(([d, itens]) => ({ diaStr: d, rows: itens }))
    .sort((a, b) => a.diaStr.localeCompare(b.diaStr));
}

function exportarParaExcel(dados, nomeArquivo) {
  if (!dados || !dados.length) return;
  const processarValor = (valor) => {
    if (valor == null) return "";
    if (typeof valor === 'object') return ""; 
    return String(valor).replace(/"/g, '""');
  };
  const colunas = Object.keys(dados[0]).filter(col => typeof dados[0][col] !== 'object');
  const linhas = dados.map(row => colunas.map(col => `"${processarValor(row[col])}"`).join(";"));
  const csv = [colunas.join(";"), ...linhas].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${nomeArquivo}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function DesempenhoDieselAnalise() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [rowsBase, setRowsBase] = useState([]);
  const [acompanhamentos, setAcompanhamentos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);

  const [abaAtiva, setAbaAtiva] = useState("LINHAS");
  const [subAcompanhamento, setSubAcompanhamento] = useState("RESUMO_INSTRUTOR");

  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroInstrutor, setFiltroInstrutor] = useState("");
  const [filtroProntuario, setFiltroProntuario] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroConclusao, setFiltroConclusao] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");

  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

  const [sortLinhas, setSortLinhas] = useState({ key: "Desperdicio", direction: "desc" });
  const [sortMotoristas, setSortMotoristas] = useState({ key: "Litros_Desp_Meta", direction: "desc" });
  const [sortCarros, setSortCarros] = useState({ key: "Litros_Desp_Meta", direction: "desc" });

  async function carregarPremiacao() {
    if (!supabaseA) throw new Error("Supabase A não configurado.");
    const pageSize = 1000;
    let start = 0;
    let all = [];
    while (true) {
      const end = start + pageSize - 1;
      const { data, error } = await supabaseA
        .from("premiacao_diaria_atualizada")
        .select("id_premiacao_diaria, dia, ano, mes, anomes, motorista, linha, prefixo, fabricante, cluster, km_rodado, litros_consumidos, km_l, meta_kml_usada, litros_ideais")
        .order("dia", { ascending: false })
        .range(start, end);
      if (error) throw error;
      const chunk = data || [];
      all = all.concat(chunk);
      if (chunk.length < pageSize) break;
      start += pageSize;
      if (all.length >= 50000) break;
    }
    return all;
  }

  async function carregarFuncionarios() {
    if (!supabaseA) return [];
    const pageSize = 1000;
    let start = 0;
    let all = [];
    while (true) {
      const end = start + pageSize - 1;
      const { data, error } = await supabaseA.from("funcionarios").select("nr_cracha, nm_funcionario").range(start, end);
      if (error) throw error;
      const chunk = data || [];
      all = all.concat(chunk);
      if (chunk.length < pageSize) break;
      start += pageSize;
      if (all.length >= 10000) break;
    }
    return all;
  }

  async function carregarAcompanhamentos() {
    const { data, error } = await supabase
      .from("diesel_acompanhamentos")
      .select("id, created_at, motorista_chapa, motorista_nome, linha_foco, cluster_foco, status, instrutor_login, instrutor_nome, dt_inicio_monitoramento, intervencao_hora_inicio, intervencao_hora_fim, motivo, metadata")
      .order("created_at", { ascending: false })
      .limit(6000);
    if (error) throw error;
    return data || [];
  }

  async function carregarTudo() {
    setLoading(true);
    setErro("");
    try {
      const [premiacao, acomp, funcs] = await Promise.all([
        carregarPremiacao(),
        carregarAcompanhamentos(),
        carregarFuncionarios(),
      ]);
      setRowsBase(premiacao);
      setAcompanhamentos(acomp);
      setFuncionarios(funcs);
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

  const mapaFuncionarios = useMemo(() => {
    const map = new Map();
    (funcionarios || []).forEach((f) => {
      const chave = String(f?.nr_cracha || "").trim();
      const nome = String(f?.nm_funcionario || "").trim().toUpperCase();
      if (chave) map.set(chave, nome);
    });
    return map;
  }, [funcionarios]);

  const dataset = useMemo(() => {
    const base = (rowsBase || []).map((r) => {
      const dStr = safeDateStr(r.dia);
      const km = n(r.km_rodado);
      const comb = n(r.litros_consumidos);
      const kml = comb > 0 ? km / comb : 0;
      const clusterOrig = normalize(r.cluster);
      const cluster = clusterOrig || deriveCluster(r.prefixo);
      const motoristaRaw = String(r.motorista || "").trim() || "SEM_MOTORISTA";
      const chapa = extractChapa(motoristaRaw);
      const motoristaNome = mapaFuncionarios.get(chapa) || motoristaRaw;
      const metaLinha = n(r.meta_kml_usada);
      const litrosIdeais = n(r.litros_ideais);
      const litrosDespMeta = metaLinha > 0 && litrosIdeais > 0 && comb > litrosIdeais ? comb - litrosIdeais : 0;

      return {
        id: r.id_premiacao_diaria,
        dateOnly: dStr,
        Mes_Ano: dStr ? dStr.slice(0, 7) : "",
        Motorista: motoristaRaw,
        motoristaNome,
        chapa,
        veiculo: String(r.prefixo || "").trim(),
        linha: normalize(r.linha),
        Cluster: cluster,
        Km: km,
        Comb: comb,
        kml,
        Meta_Linha: metaLinha,
        Litros_Esperados: litrosIdeais,
        Litros_Desp_Meta: litrosDespMeta,
      };
    });

    return base.filter((r) => r.dateOnly && r.Km > 0 && r.Comb > 0 && r.kml >= 1.5 && r.kml <= 5);
  }, [rowsBase, mapaFuncionarios]);

  const mesesDisponiveis = useMemo(() => {
    return [...new Set(dataset.map((r) => r.Mes_Ano).filter(Boolean))].sort();
  }, [dataset]);

  useEffect(() => {
    if (!mesReferencia && mesesDisponiveis.length) {
      setMesReferencia(mesesDisponiveis[mesesDisponiveis.length - 1]);
    }
  }, [mesReferencia, mesesDisponiveis]);

  const mesComparacao = useMemo(() => {
    if (!mesReferencia) return "";
    const idx = mesesDisponiveis.indexOf(mesReferencia);
    return idx > 0 ? mesesDisponiveis[idx - 1] : "";
  }, [mesReferencia, mesesDisponiveis]);

  const linhasUnicas = useMemo(() => {
    const set = new Set();
    dataset.forEach((r) => set.add(r.linha));
    acompanhamentos.forEach((a) => set.add(getLinhaFocoAcompanhamento(a)));
    return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dataset, acompanhamentos]);

  const clustersUnicos = useMemo(() => {
    const set = new Set(dataset.map((r) => r.Cluster).filter(Boolean));
    acompanhamentos.forEach((a) => {
      const c = normalize(a.cluster_foco || a.metadata?.cluster_foco);
      if (c) set.add(c);
    });
    return [...set].filter(Boolean).sort();
  }, [dataset, acompanhamentos]);

  const instrutoresUnicos = useMemo(() => {
    return [...new Set(acompanhamentos.map((a) => String(a.instrutor_nome || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [acompanhamentos]);

  const datasetFiltrado = useMemo(() => {
    return dataset.filter((r) => {
      if (filtroLinha && r.linha !== filtroLinha) return false;
      if (filtroCluster && r.Cluster !== filtroCluster) return false;
      if (mesReferencia && ![mesReferencia, mesComparacao].includes(r.Mes_Ano)) return false;

      const q = busca.toLowerCase().trim();
      if (!q) return true;

      return (
        String(r.linha || "").toLowerCase().includes(q) ||
        String(r.veiculo || "").toLowerCase().includes(q) ||
        String(r.motoristaNome || "").toLowerCase().includes(q) ||
        String(r.chapa || "").toLowerCase().includes(q) ||
        String(r.Cluster || "").toLowerCase().includes(q)
      );
    });
  }, [dataset, filtroLinha, filtroCluster, mesReferencia, mesComparacao, busca]);

  const rowsReferencia = useMemo(() => datasetFiltrado.filter((r) => r.Mes_Ano === mesReferencia), [datasetFiltrado, mesReferencia]);
  const rowsComparacao = useMemo(() => datasetFiltrado.filter((r) => r.Mes_Ano === mesComparacao), [datasetFiltrado, mesComparacao]);

  const mapaLinhaMes = useMemo(() => {
    const map = new Map();
    datasetFiltrado.forEach((r) => {
      const key = `${r.linha}__${r.Mes_Ano}`;
      if (!map.has(key)) map.set(key, { Km: 0, Comb: 0, Litros_Esperados: 0, Litros_Desp_Meta: 0 });
      const item = map.get(key);
      item.Km += r.Km;
      item.Comb += r.Comb;
      item.Litros_Esperados += r.Litros_Esperados;
      item.Litros_Desp_Meta += r.Litros_Desp_Meta;
    });
    return map;
  }, [datasetFiltrado]);

  const tabelaLinhas = useMemo(() => {
    const linhas = [...new Set(rowsReferencia.map((r) => r.linha).filter(Boolean))];
    return linhas
      .map((linha) => {
        const ref = mapaLinhaMes.get(`${linha}__${mesReferencia}`) || { Km: 0, Comb: 0, Litros_Esperados: 0, Litros_Desp_Meta: 0 };
        const comp = mapaLinhaMes.get(`${linha}__${mesComparacao}`) || { Km: 0, Comb: 0, Litros_Esperados: 0, Litros_Desp_Meta: 0 };
        const kmlReferencia = ref.Comb > 0 ? ref.Km / ref.Comb : 0;
        const kmlComparacao = comp.Comb > 0 ? comp.Km / comp.Comb : 0;
        const metaPonderada = ref.Litros_Esperados > 0 ? ref.Km / ref.Litros_Esperados : 0;
        const variacaoPct = kmlComparacao > 0 ? ((kmlReferencia - kmlComparacao) / kmlComparacao) * 100 : 0;
        return {
          id: linha, linha, KML_Anterior: kmlComparacao, KML_Atual: kmlReferencia, Variacao_Pct: variacaoPct,
          Meta_Ponderada: metaPonderada, Desperdicio: ref.Litros_Desp_Meta, Km: ref.Km, Comb: ref.Comb,
        };
      })
      .sort((a, b) => b.Desperdicio - a.Desperdicio);
  }, [rowsReferencia, mapaLinhaMes, mesReferencia, mesComparacao]);

  const refGrupoReferencia = useMemo(() => {
    const map = new Map();
    rowsReferencia.forEach((r) => {
      const key = `${r.linha}__${r.Cluster}`;
      if (!map.has(key)) map.set(key, { Km: 0, Comb: 0 });
      const item = map.get(key);
      item.Km += r.Km;
      item.Comb += r.Comb;
    });
    return map;
  }, [rowsReferencia]);

  const rowsReferenciaComRef = useMemo(() => {
    return rowsReferencia.map((r) => {
      const ref = refGrupoReferencia.get(`${r.linha}__${r.Cluster}`) || { Km: 0, Comb: 0 };
      const KML_Ref = ref.Comb > 0 ? ref.Km / ref.Comb : 0;
      const Litros_Desperdicio = KML_Ref > 0 && r.kml < KML_Ref ? r.Comb - r.Km / KML_Ref : 0;
      return { ...r, KML_Ref, Litros_Desperdicio };
    });
  }, [rowsReferencia, refGrupoReferencia]);

  const mapaKmLinhaReferencia = useMemo(() => {
    const map = new Map();
    rowsReferenciaComRef.forEach((r) => map.set(r.linha, n(map.get(r.linha)) + r.Km));
    return map;
  }, [rowsReferenciaComRef]);

  const topVeiculos = useMemo(() => {
    const map = new Map();
    rowsReferenciaComRef.forEach((r) => {
      const key = `${r.veiculo}__${r.Cluster}__${r.linha}`;
      if (!map.has(key)) map.set(key, { id: key, veiculo: r.veiculo, Cluster: r.Cluster, linha: r.linha, Litros_Desperdicio: 0, Litros_Desp_Meta: 0, Km: 0, Comb: 0, KML_Ref: 0, Meta_Linha: 0, linhasCount: 0 });
      const item = map.get(key);
      item.Litros_Desperdicio += r.Litros_Desperdicio;
      item.Litros_Desp_Meta += r.Litros_Desp_Meta;
      item.Km += r.Km;
      item.Comb += r.Comb;
      item.KML_Ref += r.KML_Ref;
      item.Meta_Linha += r.Meta_Linha;
      item.linhasCount += 1;
    });
    return [...map.values()]
      .map((r) => ({ ...r, KML_Real: r.Comb > 0 ? r.Km / r.Comb : 0, KML_Meta: r.linhasCount > 0 ? r.KML_Ref / r.linhasCount : 0, Meta_Linha: r.linhasCount > 0 ? r.Meta_Linha / r.linhasCount : 0 }))
      .sort((a, b) => b.Litros_Desp_Meta - a.Litros_Desp_Meta);
  }, [rowsReferenciaComRef]);

  const topMotoristas = useMemo(() => {
    const map = new Map();
    rowsReferenciaComRef.forEach((r) => {
      const key = `${r.chapa}__${r.linha}__${r.Cluster}`;
      if (!map.has(key)) map.set(key, { id: key, Motorista: r.motoristaNome, chapa: r.chapa, Cluster: r.Cluster, linha: r.linha, Litros_Desperdicio: 0, Litros_Desp_Meta: 0, Km: 0, Comb: 0, KML_Ref: 0, Meta_Linha: 0, count: 0 });
      const item = map.get(key);
      item.Litros_Desperdicio += r.Litros_Desperdicio;
      item.Litros_Desp_Meta += r.Litros_Desp_Meta;
      item.Km += r.Km;
      item.Comb += r.Comb;
      item.KML_Ref += r.KML_Ref;
      item.Meta_Linha += r.Meta_Linha;
      item.count += 1;
    });
    return [...map.values()]
      .map((r) => {
        const kmTotalLinha = n(mapaKmLinhaReferencia.get(r.linha));
        return { ...r, KML_Real: r.Comb > 0 ? r.Km / r.Comb : 0, KML_Meta: r.count > 0 ? r.KML_Ref / r.count : 0, Meta_Linha: r.count > 0 ? r.Meta_Linha / r.count : 0, Impacto_Pct: kmTotalLinha > 0 ? (r.Km / kmTotalLinha) * 100 : 0 };
      })
      .sort((a, b) => b.Litros_Desp_Meta - a.Litros_Desp_Meta);
  }, [rowsReferenciaComRef, mapaKmLinhaReferencia]);

  const acompanhamentosComEvolucao = useMemo(() => {
    return acompanhamentos
      .filter((a) => a.dt_inicio_monitoramento)
      .map((a) => {
        const iniMin = parseHoraToMin(a.intervencao_hora_inicio);
        const fimMin = parseHoraToMin(a.intervencao_hora_fim);
        const duracaoMin = iniMin != null && fimMin != null && fimMin >= iniMin ? fimMin - iniMin : 0;
        
        const dtInicioStr = safeDateStr(a.dt_inicio_monitoramento);
        const chapa = String(a.motorista_chapa || "").trim();

        const aBase = {
          ...a,
          status_norm: statusNorm(a.status),
          linha_resolvida: getLinhaFocoAcompanhamento(a),
          data_ref: dtInicioStr,
          duracao_min: duracaoMin,
        };

        if (!chapa) return { ...aBase, checkpoint_tipo: "SEM_DADOS", conclusao_checkpoint: "SEM_DADOS" };

        const baseMotorista = dataset.filter((r) => String(r.chapa || "").trim() === chapa);
        const diasAgrupados = agruparPorDiaStr(baseMotorista);

        if (!diasAgrupados.length) return { ...aBase, checkpoint_tipo: "SEM_DADOS", conclusao_checkpoint: "SEM_DADOS" };

        const diasAntesDisp = diasAgrupados.filter((d) => d.diaStr < dtInicioStr);
        const diasDepoisDisp = diasAgrupados.filter((d) => d.diaStr >= dtInicioStr);

        const maxPossivel = Math.min(diasAntesDisp.length, diasDepoisDisp.length);

        let janela = 0;
        if (maxPossivel >= 30) janela = 30;
        else if (maxPossivel >= 20) janela = 20;
        else if (maxPossivel >= 10) janela = 10;
        else if (maxPossivel >= 5) janela = 5;
        else if (maxPossivel >= 3) janela = 3;

        if (janela === 0) return { ...aBase, checkpoint_tipo: "SEM_DADOS", conclusao_checkpoint: "SEM_DADOS" };

        const diasAntes = diasAntesDisp.slice(-janela);
        const diasDepois = diasDepoisDisp.slice(0, janela);

        const antes = aggregatePeriodo(diasAntes.flatMap((d) => d.rows));
        const depois = aggregatePeriodo(diasDepois.flatMap((d) => d.rows));

        const antesKml = n(antes.kml);
        const depoisKml = n(depois.kml);
        const deltaKml = depoisKml - antesKml;

        const kmTotalAntes = n(antes.km);
        const litrosIdeaisAntes = n(antes.litrosMeta);
        const antesDesp = n(antes.desperdicio);

        let desperdicioAjustado = null;
        let deltaDesperdicio = null;

        if (depoisKml > 0 && kmTotalAntes > 0) {
          const litrosSimulados = kmTotalAntes / depoisKml;
          desperdicioAjustado = Math.max(0, litrosSimulados - litrosIdeaisAntes);
          deltaDesperdicio = desperdicioAjustado - antesDesp;
        }

        let conclusao = "SEM_EVOLUCAO";
        if (desperdicioAjustado != null && antesDesp != null) {
          if (deltaKml > 0 && deltaDesperdicio <= 0) conclusao = "MELHOROU";
          else if (deltaKml < 0 && deltaDesperdicio >= 0) conclusao = "PIOROU";
          else if (deltaKml > 0) conclusao = "MELHOROU";
          else if (deltaKml < 0) conclusao = "PIOROU";
        }

        let labelCalculado = "SEM_DADOS";
        if (janela === 30) labelCalculado = "PRONTUARIO_30";
        else if (janela === 20) labelCalculado = "PRONTUARIO_20";
        else if (janela === 10) labelCalculado = "PRONTUARIO_10";
        else labelCalculado = `CHECKPOINT_${janela}D`;

        return {
          ...aBase,
          status_calculo: "OK",
          janela_aplicada: janela,
          checkpoint_tipo: labelCalculado,
          antes_kml: antesKml,
          depois_kml: depoisKml,
          delta_kml: deltaKml,
          antes_desp: antesDesp,
          depois_desp: desperdicioAjustado,
          delta_desperdicio: deltaDesperdicio,
          conclusao_checkpoint: conclusao,
          km_antes: kmTotalAntes,
          litros_antes: n(antes.comb),
          meta_kml_antes: litrosIdeaisAntes > 0 ? kmTotalAntes / litrosIdeaisAntes : 0,
          km_depois: n(depois.km),
          litros_depois: n(depois.comb),
          meta_kml_depois: n(depois.litrosMeta) > 0 ? n(depois.km) / n(depois.litrosMeta) : 0,
          desp_real_antes: antesDesp,
          desp_real_depois: n(depois.desperdicio),
          desp_ajustado_depois: desperdicioAjustado,
        };
      })
      .filter((a) => {
        if (filtroLinha && a.linha_resolvida !== filtroLinha) return false;
        if (filtroCluster) {
          const c = normalize(a.cluster_foco || a.metadata?.cluster_foco);
          if (c !== filtroCluster) return false;
        }
        if (filtroInstrutor && String(a.instrutor_nome || "").trim() !== filtroInstrutor) return false;
        if (filtroStatus && a.status_norm !== filtroStatus) return false;
        if (filtroProntuario && a.checkpoint_tipo !== filtroProntuario) return false;
        if (mesReferencia) {
          const mesItem = a.data_ref ? String(a.data_ref).slice(0, 7) : "";
          if (mesItem !== mesReferencia) return false;
        }
        if (filtroConclusao && a.conclusao_checkpoint !== filtroConclusao) return false;
        const q = busca.toLowerCase().trim();
        if (!q) return true;
        return (
          String(a.motorista_nome || "").toLowerCase().includes(q) ||
          String(a.motorista_chapa || "").toLowerCase().includes(q) ||
          String(a.linha_resolvida || "").toLowerCase().includes(q) ||
          String(a.instrutor_nome || "").toLowerCase().includes(q)
        );
      });
  }, [acompanhamentos, dataset, filtroLinha, filtroCluster, filtroInstrutor, filtroStatus, filtroProntuario, mesReferencia, filtroConclusao, busca]);

  const checkpointResumo = useMemo(() => {
    const rows = acompanhamentosComEvolucao.filter((r) => r.checkpoint_tipo !== "SEM_DADOS" && (r.delta_kml != null || r.delta_desperdicio != null));
    return {
      total: rows.length,
      melhoraramKml: rows.filter((r) => n(r.delta_kml) > 0).length,
      pioraramKml: rows.filter((r) => n(r.delta_kml) < 0).length,
      estavelKml: rows.filter((r) => n(r.delta_kml) === 0).length,
      reduziramDesperdicio: rows.filter((r) => n(r.depois_desp) < n(r.antes_desp)).length,
      aumentaramDesperdicio: rows.filter((r) => n(r.depois_desp) > n(r.antes_desp)).length,
      mediaDeltaKml: rows.length ? rows.reduce((acc, r) => acc + n(r.delta_kml), 0) / rows.length : 0,
      mediaDeltaDesp: rows.length ? rows.reduce((acc, r) => acc + n(r.delta_desperdicio), 0) / rows.length : 0,
    };
  }, [acompanhamentosComEvolucao]);

  const resumoPorLinhaCheckpoint = useMemo(() => {
    const map = new Map();
    acompanhamentosComEvolucao
      .filter((r) => r.checkpoint_tipo !== "SEM_DADOS" && (r.delta_kml != null || r.delta_desperdicio != null))
      .forEach((r) => {
        const key = `${r.linha_resolvida}__${r.checkpoint_tipo}`;
        if (!map.has(key)) map.set(key, { id: key, linha_foco: r.linha_resolvida, tipo: r.checkpoint_tipo, qtd_motoristas: 0, antes_kml: 0, depois_kml: 0, delta_kml: 0, antes_desp: 0, depois_desp: 0, melhorou: 0, piorou: 0, sem_evolucao: 0, motoristas: [] });
        const item = map.get(key);
        item.qtd_motoristas += 1;
        item.antes_kml += n(r.antes_kml);
        item.depois_kml += n(r.depois_kml);
        item.delta_kml += n(r.delta_kml);
        item.antes_desp += n(r.antes_desp);
        item.depois_desp += n(r.depois_desp);
        if (r.conclusao_checkpoint === "MELHOROU") item.melhorou += 1;
        else if (r.conclusao_checkpoint === "PIOROU") item.piorou += 1;
        else item.sem_evolucao += 1;

        // Repassando os dados crus corretamente para o modal
        item.motoristas.push({
          nome: r.motorista_nome || r.motorista_chapa,
          chapa: r.motorista_chapa,
          antes_kml: n(r.antes_kml),
          depois_kml: n(r.depois_kml),
          delta_kml: n(r.delta_kml),
          antes_desp: n(r.antes_desp),
          depois_desp: n(r.depois_desp),
          delta_desperdicio: n(r.delta_desperdicio),
          conclusao: r.conclusao_checkpoint,
          data_ref: r.data_ref,
          checkpoint_tipo: r.checkpoint_tipo,
          janela_aplicada: r.janela_aplicada,
          km_antes: r.km_antes,
          litros_antes: r.litros_antes,
          meta_kml_antes: r.meta_kml_antes,
          km_depois: r.km_depois,
          litros_depois: r.litros_depois,
          meta_kml_depois: r.meta_kml_depois,
          desp_real_antes: r.desp_real_antes,
          desp_real_depois: r.desp_real_depois,
          desp_ajustado_depois: r.desp_ajustado_depois,
        });
      });
    return [...map.values()]
      .map((r) => ({ ...r, antes_kml: r.qtd_motoristas ? r.antes_kml / r.qtd_motoristas : 0, depois_kml: r.qtd_motoristas ? r.depois_kml / r.qtd_motoristas : 0, delta_kml: r.qtd_motoristas ? r.delta_kml / r.qtd_motoristas : 0, antes_desp: r.qtd_motoristas ? r.antes_desp / r.qtd_motoristas : 0, depois_desp: r.qtd_motoristas ? r.depois_desp / r.qtd_motoristas : 0, delta_desperdicio: r.qtd_motoristas ? (r.depois_desp - r.antes_desp) / r.qtd_motoristas : 0 }))
      .sort((a, b) => a.delta_desperdicio - b.delta_desperdicio);
  }, [acompanhamentosComEvolucao]);

  const resumoInstrutor = useMemo(() => {
    const map = new Map();
    acompanhamentosComEvolucao.forEach((r) => {
      const key = String(r.instrutor_nome || "Sem instrutor").trim() || "Sem instrutor";
      if (!map.has(key)) map.set(key, { id: key, instrutor_nome: key, total_acompanhamentos: 0, total_minutos: 0, em_monitoramento: 0, em_analise: 0, concluidos: 0, linhas: new Set() });
      const item = map.get(key);
      item.total_acompanhamentos += 1;
      item.total_minutos += n(r.duracao_min);
      if (r.status_norm === "EM_MONITORAMENTO") item.em_monitoramento += 1;
      if (r.status_norm === "EM_ANALISE") item.em_analise += 1;
      if (["OK", "ENCERRADO", "ATAS"].includes(r.status_norm)) item.concluidos += 1;
      if (r.linha_resolvida) item.linhas.add(r.linha_resolvida);
    });
    return [...map.values()]
      .map((r) => ({ ...r, media_minutos: r.total_acompanhamentos ? r.total_minutos / r.total_acompanhamentos : 0, qtd_linhas: r.linhas.size }))
      .sort((a, b) => b.total_minutos - a.total_minutos);
  }, [acompanhamentosComEvolucao]);

  const tempoPorDia = useMemo(() => {
    const map = new Map();
    acompanhamentosComEvolucao.forEach((r) => {
      const key = `${r.data_ref}__${r.instrutor_nome || "Sem instrutor"}`;
      if (!map.has(key)) map.set(key, { id: key, data_ref: r.data_ref, instrutor_nome: r.instrutor_nome || "Sem instrutor", total_acompanhamentos: 0, total_minutos: 0 });
      const item = map.get(key);
      item.total_acompanhamentos += 1;
      item.total_minutos += n(r.duracao_min);
    });
    return [...map.values()]
      .map((r) => ({ ...r, media_minutos: r.total_acompanhamentos ? r.total_minutos / r.total_acompanhamentos : 0 }))
      .sort((a, b) => {
        if (a.data_ref === b.data_ref) return String(a.instrutor_nome).localeCompare(String(b.instrutor_nome), "pt-BR");
        return String(b.data_ref).localeCompare(String(a.data_ref));
      });
  }, [acompanhamentosComEvolucao]);

  const totalDesperdicioMeta = useMemo(() => rowsReferenciaComRef.reduce((acc, r) => acc + n(r.Litros_Desp_Meta), 0), [rowsReferenciaComRef]);
  const kmlReferenciaGeral = useMemo(() => {
    const km = rowsReferenciaComRef.reduce((acc, r) => acc + n(r.Km), 0);
    const comb = rowsReferenciaComRef.reduce((acc, r) => acc + n(r.Comb), 0);
    return comb > 0 ? km / comb : 0;
  }, [rowsReferenciaComRef]);
  const kmlComparacaoGeral = useMemo(() => {
    const km = rowsComparacao.reduce((acc, r) => acc + n(r.Km), 0);
    const comb = rowsComparacao.reduce((acc, r) => acc + n(r.Comb), 0);
    return comb > 0 ? km / comb : 0;
  }, [rowsComparacao]);
  const variacaoGeral = useMemo(() => (!kmlComparacaoGeral ? 0 : ((kmlReferenciaGeral - kmlComparacaoGeral) / kmlComparacaoGeral) * 100), [kmlReferenciaGeral, kmlComparacaoGeral]);

  function ordenarLista(lista, sortConfigAtual) {
    const { key, direction } = sortConfigAtual;
    return [...lista].sort((a, b) => {
      const va = a?.[key], vb = b?.[key];
      const na = Number(va), nb = Number(vb);
      const ambosNumericos = Number.isFinite(na) && Number.isFinite(nb);
      let cmp = ambosNumericos ? na - nb : String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR", { numeric: true, sensitivity: "base" });
      return direction === "asc" ? cmp : -cmp;
    });
  }

  const linhasTabelaOrdenada = useMemo(() => ordenarLista(tabelaLinhas, sortLinhas), [tabelaLinhas, sortLinhas]);
  const motoristasOrdenados = useMemo(() => ordenarLista(topMotoristas, sortMotoristas), [topMotoristas, sortMotoristas]);
  const veiculosOrdenados = useMemo(() => ordenarLista(topVeiculos, sortCarros), [topVeiculos, sortCarros]);

  function toggleSort(setter, key) {
    setter((prev) => ({ key, direction: prev.key === key ? (prev.direction === "asc" ? "desc" : "asc") : "desc" }));
  }

  const headerSubAcompanhamento = {
    RESUMO_INSTRUTOR: { titulo: "Resumo por Instrutor", subtitulo: "Visão consolidada de volume, tempo e distribuição." },
    TEMPO_DIA: { titulo: "Tempo por Dia", subtitulo: "Tempo consumido por instrutor em cada dia." },
    CHECKPOINT_LINHA: { titulo: "Check Point por Linha", subtitulo: "Evolução e lista de motoristas avaliados." },
    ACOMPANHAMENTOS: { titulo: "Acompanhamentos", subtitulo: "Detalhamento individual e evolução." },
  };

  const abas = [
    { key: "LINHAS", label: "Análise de Linhas", icon: <FaRoad /> },
    { key: "MOTORISTAS", label: "Ranking de Motoristas", icon: <FaUser /> },
    { key: "CARROS", label: "Ranking de Carros", icon: <FaTruck /> },
    { key: "ACOMPANHAMENTOS", label: "Acompanhamentos", icon: <FaClipboardList /> },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <FaBolt /> Análise Diesel
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">Painel de Análises</h1>
            <p className="text-sm text-slate-500 mt-1">A página atua como container. Toda a renderização fica nos 4 componentes.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (abaAtiva === "LINHAS") exportarParaExcel(linhasTabelaOrdenada, "Analise_Linhas");
                if (abaAtiva === "MOTORISTAS") exportarParaExcel(motoristasOrdenados, "Ranking_Motoristas");
                if (abaAtiva === "CARROS") exportarParaExcel(veiculosOrdenados, "Ranking_Carros");
                if (abaAtiva === "ACOMPANHAMENTOS") {
                  if (subAcompanhamento === "RESUMO_INSTRUTOR") exportarParaExcel(resumoInstrutor, "Resumo_Instrutor");
                  if (subAcompanhamento === "TEMPO_DIA") exportarParaExcel(tempoPorDia, "Tempo_Por_Dia");
                  if (subAcompanhamento === "CHECKPOINT_LINHA") exportarParaExcel(resumoPorLinhaCheckpoint, "Checkpoint_Linha");
                  if (subAcompanhamento === "ACOMPANHAMENTOS") exportarParaExcel(acompanhamentosComEvolucao, "Acompanhamentos_Detalhado");
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition"
            >
              <FaDownload /> Baixar Excel
            </button>

            <button onClick={() => setMostrarExplicacao(!mostrarExplicacao)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition">
              <FaInfoCircle /> {mostrarExplicacao ? "Ocultar Cálculos" : "Entender Cálculos"}
            </button>

            <button onClick={carregarTudo} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition">
              <FaSync /> Atualizar
            </button>
          </div>
        </div>

        {mostrarExplicacao && (
          <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm">
            <h3 className="font-bold text-base mb-2">Como a Evolução é Calculada?</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>D0 Obrigatório:</strong> Apenas acompanhamentos com data base geram análise matemática.</li>
              <li><strong>Histórico Global:</strong> Usa todas as linhas operadas para consolidar a meta ponderada em litros.</li>
              <li><strong>Janela Simétrica:</strong> Apenas dias trabalhados. Máximo espelhamento possível: 30, 20, 10, 5 ou 3 dias simétricos de cada lado.</li>
              <li><strong>Desperdício Ajustado:</strong> Simula os litros do "Antes" aplicando a habilidade de KM/L do "Depois" no volume de KM do "Antes".</li>
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mt-5">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar linha, carro, motorista..." className="w-full pl-10 pr-3 py-2.5 rounded-lg border bg-white" />
          </div>
          <select value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
            <option value="">Selecione o mês</option>
            {mesesDisponiveis.map((mes) => <option key={mes} value={mes}>{mes}</option>)}
          </select>
          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
            <option value="">Todas as linhas</option>
            {linhasUnicas.map((linha) => <option key={linha} value={linha}>{linha}</option>)}
          </select>
          <select value={filtroCluster} onChange={(e) => setFiltroCluster(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
            <option value="">Todos os clusters</option>
            {clustersUnicos.map((cluster) => <option key={cluster} value={cluster}>{cluster}</option>)}
          </select>

          {abaAtiva === "ACOMPANHAMENTOS" && (
            <>
              <select value={filtroInstrutor} onChange={(e) => setFiltroInstrutor(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
                <option value="">Todos os instrutores</option>
                {instrutoresUnicos.map((instrutor) => <option key={instrutor} value={instrutor}>{instrutor}</option>)}
              </select>
              <select value={filtroProntuario} onChange={(e) => setFiltroProntuario(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
                <option value="">Todos os prontuários</option>
                <option value="PRONTUARIO_10">PRONTUARIO_10</option>
                <option value="PRONTUARIO_20">PRONTUARIO_20</option>
                <option value="PRONTUARIO_30">PRONTUARIO_30</option>
                <option value="CHECKPOINT_3D">CHECKPOINT_3D</option>
                <option value="CHECKPOINT_5D">CHECKPOINT_5D</option>
              </select>
              <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
                <option value="">Todos os status</option>
                <option value="AGUARDANDO_INSTRUTOR">AGUARDANDO_INSTRUTOR</option>
                <option value="EM_MONITORAMENTO">EM_MONITORAMENTO</option>
                <option value="EM_ANALISE">EM_ANALISE</option>
                <option value="OK">OK</option>
                <option value="ENCERRADO">ENCERRADO</option>
                <option value="ATAS">ATAS</option>
              </select>
              <select value={filtroConclusao} onChange={(e) => setFiltroConclusao(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-white">
                <option value="">Todas as conclusões</option>
                <option value="MELHOROU">MELHOROU</option>
                <option value="PIOROU">PIOROU</option>
                <option value="SEM_EVOLUCAO">SEM_EVOLUCAO</option>
                <option value="SEM_DADOS">SEM_DADOS</option>
              </select>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
        {abas.map((aba) => (
          <button key={aba.key} onClick={() => setAbaAtiva(aba.key)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition ${abaAtiva === aba.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}>
            {aba.icon} {aba.label}
          </button>
        ))}
      </div>

      {erro && <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 font-bold">{erro}</div>}
      {loading ? (
        <div className="bg-white rounded-xl border shadow-sm p-10 text-center text-slate-500 font-bold">Carregando dados...</div>
      ) : (
        <>
          {abaAtiva === "LINHAS" && <AnaliseLinhasModal kmlReferenciaGeral={kmlReferenciaGeral} kmlComparacaoGeral={kmlComparacaoGeral} variacaoGeral={variacaoGeral} totalDesperdicioMeta={totalDesperdicioMeta} linhasTabelaOrdenada={linhasTabelaOrdenada} sortConfig={sortLinhas} handleSort={(key) => toggleSort(setSortLinhas, key)} fmtNum={fmtNum} fmtInt={fmtInt} EvolucaoBadge={EvolucaoBadge} SortIcon={SortIcon} />}
          {abaAtiva === "MOTORISTAS" && <RankingMotoristasModal motoristasOrdenados={motoristasOrdenados} sortConfig={sortMotoristas} handleSort={(key) => toggleSort(setSortMotoristas, key)} fmtNum={fmtNum} SortIcon={SortIcon} />}
          {abaAtiva === "CARROS" && <RankingCarrosModal veiculosOrdenados={veiculosOrdenados} sortConfig={sortCarros} handleSort={(key) => toggleSort(setSortCarros, key)} fmtNum={fmtNum} SortIcon={SortIcon} />}
          {abaAtiva === "ACOMPANHAMENTOS" && <AcompanhamentosModal subAcompanhamento={subAcompanhamento} setSubAcompanhamento={setSubAcompanhamento} headerSubAcompanhamento={headerSubAcompanhamento} checkpointResumo={checkpointResumo} resumoInstrutor={resumoInstrutor} tempoPorDia={tempoPorDia} resumoPorLinhaCheckpoint={resumoPorLinhaCheckpoint} acompanhamentosComEvolucao={acompanhamentosComEvolucao} fmtNum={fmtNum} fmtInt={fmtInt} fmtDateBr={fmtDateBr} formatMinutes={formatMinutes} statusBadgeClass={statusBadgeClass} EvolucaoBadge={EvolucaoBadge} />}
        </>
      )}
    </div>
  );
}
