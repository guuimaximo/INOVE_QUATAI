import React, { useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaSync,
  FaSearch,
  FaFilter,
  FaRoad,
  FaTruck,
  FaUser,
  FaClipboardList,
  FaClock,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
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

function fmtDateBr(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      const p = dateOnly(v).split("-");
      return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(v);
    }
    return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return String(v);
  }
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

function parseDateValue(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function monthLabelFromDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
  const meta =
    item?.metadata && typeof item.metadata === "object" ? item.metadata : {};
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
  if (st === "AGUARDANDO_INSTRUTOR")
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (st === "EM_MONITORAMENTO")
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (st === "EM_ANALISE")
    return "bg-violet-50 text-violet-700 border-violet-200";
  if (st === "ATAS") return "bg-rose-50 text-rose-700 border-rose-200";
  if (st === "OK" || st === "ENCERRADO")
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function SortIcon({ active, direction }) {
  if (!active) return <span className="text-gray-300 ml-2 text-[10px]">↕</span>;
  return direction === "asc" ? (
    <span className="text-blue-600 ml-2 text-[10px]">▲</span>
  ) : (
    <span className="text-blue-600 ml-2 text-[10px]">▼</span>
  );
}

function EvolucaoBadge({ value, invert = false, percent = false }) {
  const val = n(value);
  const positivo = invert ? val < 0 : val > 0;
  const negativo = invert ? val > 0 : val < 0;
  const txt = `${fmtNum(Math.abs(val), 2)}${percent ? "%" : ""}`;

  if (positivo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <FaArrowUp size={10} /> {txt}
      </span>
    );
  }

  if (negativo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200">
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

export default function DesempenhoDieselAnalise() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [rowsBase, setRowsBase] = useState([]);
  const [acompanhamentos, setAcompanhamentos] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);

  const [abaAtiva, setAbaAtiva] = useState("LINHAS");
  const [subAcompanhamento, setSubAcompanhamento] = useState("RESUMO_INSTRUTOR");

  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroInstrutor, setFiltroInstrutor] = useState("");
  const [filtroProntuario, setFiltroProntuario] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "Desperdicio",
    direction: "desc",
  });

  async function carregarPremiacao() {
    if (!supabaseA) {
      throw new Error(
        "Supabase A não configurado nas variáveis VITE_SUPA_BASE_BCNT_URL e VITE_SUPA_BASE_BCNT_ANON_KEY."
      );
    }

    const pageSize = 1000;
    let start = 0;
    let all = [];

    while (true) {
      const end = start + pageSize - 1;
      const { data, error } = await supabaseA
        .from("premiacao_diaria_atualizada")
        .select(`
          id_premiacao_diaria,
          dia,
          ano,
          mes,
          anomes,
          motorista,
          linha,
          prefixo,
          fabricante,
          cluster,
          km_rodado,
          litros_consumidos,
          km_l,
          meta_kml_usada,
          litros_ideais
        `)
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
      const { data, error } = await supabaseA
        .from("funcionarios")
        .select("nr_cracha, nm_funcionario")
        .range(start, end);

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
      .select(`
        id,
        created_at,
        motorista_chapa,
        motorista_nome,
        linha_foco,
        cluster_foco,
        status,
        instrutor_login,
        instrutor_nome,
        dt_inicio_monitoramento,
        dt_fim_real,
        dt_fim_planejado,
        intervencao_hora_inicio,
        intervencao_hora_fim,
        teste_kml,
        kml_inicial,
        kml_real,
        kml_meta,
        perda_litros,
        motivo,
        metadata,
        prontuario_10_gerado_em,
        prontuario_20_gerado_em,
        prontuario_30_gerado_em
      `)
      .order("created_at", { ascending: false })
      .limit(6000);

    if (error) throw error;
    return data || [];
  }

  async function carregarEventos() {
    const { data, error } = await supabase
      .from("diesel_acompanhamento_eventos")
      .select("id, acompanhamento_id, created_at, tipo, observacoes, extra")
      .in("tipo", ["PRONTUARIO_10", "PRONTUARIO_20", "PRONTUARIO_30"])
      .order("created_at", { ascending: false })
      .limit(8000);

    if (error) throw error;
    return data || [];
  }

  async function carregarTudo() {
    setLoading(true);
    setErro("");
    try {
      const [premiacao, acomp, evts, funcs] = await Promise.all([
        carregarPremiacao(),
        carregarAcompanhamentos(),
        carregarEventos(),
        carregarFuncionarios(),
      ]);

      setRowsBase(premiacao);
      setAcompanhamentos(acomp);
      setEventos(evts);
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
      const date = parseDateValue(r.dia);
      const km = n(r.km_rodado);
      const comb = n(r.litros_consumidos);
      const kml = comb > 0 ? km / comb : 0;
      const clusterOrig = normalize(r.cluster);
      const cluster = clusterOrig || deriveCluster(r.prefixo);
      const motoristaRaw = String(r.motorista || "").trim() || "SEM_MOTORISTA";
      const chapa = extractChapa(motoristaRaw);
      const nomeDb = mapaFuncionarios.get(chapa);
      const motoristaNome = nomeDb || motoristaRaw;
      const metaLinha = n(r.meta_kml_usada);
      const litrosIdeais = n(r.litros_ideais);
      const litrosDespMeta =
        metaLinha > 0 && litrosIdeais > 0 && comb > litrosIdeais
          ? comb - litrosIdeais
          : 0;

      return {
        id: r.id_premiacao_diaria,
        Date: date,
        dateOnly: dateOnly(r.dia),
        Mes_Ano: date ? monthLabelFromDate(date) : "",
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

    return base.filter(
      (r) => r.Date && r.Km > 0 && r.Comb > 0 && r.Cluster && r.kml >= 1.5 && r.kml <= 5
    );
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
    return [...new Set(dataset.map((r) => r.Cluster).filter(Boolean))].sort();
  }, [dataset]);

  const instrutoresUnicos = useMemo(() => {
    return [
      ...new Set(
        acompanhamentos
          .map((a) => String(a.instrutor_nome || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [acompanhamentos]);

  const datasetFiltrado = useMemo(() => {
    return dataset.filter((r) => {
      if (filtroLinha && r.linha !== filtroLinha) return false;
      if (filtroCluster && r.Cluster !== filtroCluster) return false;
      if (mesReferencia && ![mesReferencia, mesComparacao].includes(r.Mes_Ano))
        return false;

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

  const rowsReferencia = useMemo(
    () => datasetFiltrado.filter((r) => r.Mes_Ano === mesReferencia),
    [datasetFiltrado, mesReferencia]
  );

  const rowsComparacao = useMemo(
    () => datasetFiltrado.filter((r) => r.Mes_Ano === mesComparacao),
    [datasetFiltrado, mesComparacao]
  );

  const mapaLinhaMes = useMemo(() => {
    const map = new Map();
    datasetFiltrado.forEach((r) => {
      const key = `${r.linha}__${r.Mes_Ano}`;
      if (!map.has(key))
        map.set(key, {
          Km: 0,
          Comb: 0,
          Litros_Esperados: 0,
          Litros_Desp_Meta: 0,
        });
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
        const ref =
          mapaLinhaMes.get(`${linha}__${mesReferencia}`) || {
            Km: 0,
            Comb: 0,
            Litros_Esperados: 0,
            Litros_Desp_Meta: 0,
          };
        const comp =
          mapaLinhaMes.get(`${linha}__${mesComparacao}`) || {
            Km: 0,
            Comb: 0,
            Litros_Esperados: 0,
            Litros_Desp_Meta: 0,
          };

        const kmlReferencia = ref.Comb > 0 ? ref.Km / ref.Comb : 0;
        const kmlComparacao = comp.Comb > 0 ? comp.Km / comp.Comb : 0;
        const metaPonderada =
          ref.Litros_Esperados > 0 ? ref.Km / ref.Litros_Esperados : 0;
        const variacaoPct =
          kmlComparacao > 0
            ? ((kmlReferencia - kmlComparacao) / kmlComparacao) * 100
            : 0;

        return {
          id: linha,
          linha,
          KML_Anterior: kmlComparacao,
          KML_Atual: kmlReferencia,
          Variacao_Pct: variacaoPct,
          Meta_Ponderada: metaPonderada,
          Desperdicio: ref.Litros_Desp_Meta,
          Km: ref.Km,
          Comb: ref.Comb,
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
      const ref = refGrupoReferencia.get(`${r.linha}__${r.Cluster}`) || {
        Km: 0,
        Comb: 0,
      };
      const KML_Ref = ref.Comb > 0 ? ref.Km / ref.Comb : 0;
      const Litros_Desperdicio =
        KML_Ref > 0 && r.kml < KML_Ref ? r.Comb - r.Km / KML_Ref : 0;

      return {
        ...r,
        KML_Ref,
        Litros_Desperdicio,
      };
    });
  }, [rowsReferencia, refGrupoReferencia]);

  const mapaKmLinhaReferencia = useMemo(() => {
    const map = new Map();
    rowsReferenciaComRef.forEach((r) => {
      map.set(r.linha, n(map.get(r.linha)) + r.Km);
    });
    return map;
  }, [rowsReferenciaComRef]);

  const topVeiculos = useMemo(() => {
    const map = new Map();
    rowsReferenciaComRef.forEach((r) => {
      const key = `${r.veiculo}__${r.Cluster}__${r.linha}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          veiculo: r.veiculo,
          Cluster: r.Cluster,
          linha: r.linha,
          Litros_Desperdicio: 0,
          Litros_Desp_Meta: 0,
          Km: 0,
          Comb: 0,
          KML_Ref: 0,
          Meta_Linha: 0,
          linhasCount: 0,
        });
      }
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
      .map((r) => ({
        ...r,
        KML_Real: r.Comb > 0 ? r.Km / r.Comb : 0,
        KML_Meta: r.linhasCount > 0 ? r.KML_Ref / r.linhasCount : 0,
        Meta_Linha: r.linhasCount > 0 ? r.Meta_Linha / r.linhasCount : 0,
      }))
      .sort((a, b) => b.Litros_Desp_Meta - a.Litros_Desp_Meta);
  }, [rowsReferenciaComRef]);

  const topMotoristas = useMemo(() => {
    const map = new Map();
    rowsReferenciaComRef.forEach((r) => {
      const key = `${r.chapa}__${r.linha}__${r.Cluster}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          Motorista: r.motoristaNome,
          chapa: r.chapa,
          Cluster: r.Cluster,
          linha: r.linha,
          Litros_Desperdicio: 0,
          Litros_Desp_Meta: 0,
          Km: 0,
          Comb: 0,
          KML_Ref: 0,
          Meta_Linha: 0,
          count: 0,
        });
      }
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
        return {
          ...r,
          KML_Real: r.Comb > 0 ? r.Km / r.Comb : 0,
          KML_Meta: r.count > 0 ? r.KML_Ref / r.count : 0,
          Meta_Linha: r.count > 0 ? r.Meta_Linha / r.count : 0,
          Impacto_Pct: kmTotalLinha > 0 ? (r.Km / kmTotalLinha) * 100 : 0,
        };
      })
      .sort((a, b) => b.Litros_Desp_Meta - a.Litros_Desp_Meta);
  }, [rowsReferenciaComRef, mapaKmLinhaReferencia]);

  const acompanhamentosTratados = useMemo(() => {
    return (acompanhamentos || []).map((a) => {
      const iniMin = parseHoraToMin(a.intervencao_hora_inicio);
      const fimMin = parseHoraToMin(a.intervencao_hora_fim);
      const duracaoMin =
        iniMin != null && fimMin != null && fimMin >= iniMin ? fimMin - iniMin : 0;

      return {
        ...a,
        status_norm: statusNorm(a.status),
        linha_resolvida: getLinhaFocoAcompanhamento(a),
        data_ref: dateOnly(a.dt_inicio_monitoramento || a.created_at),
        duracao_min: duracaoMin,
      };
    });
  }, [acompanhamentos]);

  const eventosTratados = useMemo(() => {
    const mapaAcomp = new Map(acompanhamentosTratados.map((a) => [a.id, a]));

    return (eventos || []).map((ev) => {
      const extra = ev?.extra && typeof ev.extra === "object" ? ev.extra : {};
      const comparativo =
        extra?.comparativo && typeof extra.comparativo === "object"
          ? extra.comparativo
          : {};
      const antes =
        comparativo?.antes_periodo &&
        typeof comparativo.antes_periodo === "object"
          ? comparativo.antes_periodo
          : {};
      const depois =
        comparativo?.depois_periodo &&
        typeof comparativo.depois_periodo === "object"
          ? comparativo.depois_periodo
          : {};
      const acomp = mapaAcomp.get(ev.acompanhamento_id);

      return {
        ...ev,
        created_at_dt: ev.created_at,
        tipo: normalize(ev.tipo),
        motorista_nome: acomp?.motorista_nome || "-",
        motorista_chapa: acomp?.motorista_chapa || "-",
        linha_foco: acomp?.linha_resolvida || "SEM LINHA",
        instrutor_nome: acomp?.instrutor_nome || "",
        conclusao: normalize(comparativo?.conclusao || "SEM_EVOLUCAO"),
        delta_kml: n(comparativo?.delta_kml),
        delta_desperdicio: n(comparativo?.delta_desperdicio),
        antes_kml: n(antes?.kml_real),
        depois_kml: n(depois?.kml_real),
        antes_desp: n(antes?.desperdicio),
        depois_desp: n(depois?.desperdicio),
        acompanhamento_id: ev.acompanhamento_id,
      };
    });
  }, [eventos, acompanhamentosTratados]);

  const acompanhamentosFiltrados = useMemo(() => {
    return acompanhamentosTratados.filter((a) => {
      if (filtroLinha && a.linha_resolvida !== filtroLinha) return false;
      if (filtroCluster) {
        const c = normalize(a.cluster_foco || a.metadata?.cluster_foco);
        if (c !== filtroCluster) return false;
      }
      if (filtroInstrutor && String(a.instrutor_nome || "").trim() !== filtroInstrutor)
        return false;
      if (mesReferencia) {
        const mesItem = a.data_ref ? String(a.data_ref).slice(0, 7) : "";
        if (mesItem !== mesReferencia) return false;
      }

      const q = busca.toLowerCase().trim();
      if (!q) return true;

      return (
        String(a.motorista_nome || "").toLowerCase().includes(q) ||
        String(a.motorista_chapa || "").toLowerCase().includes(q) ||
        String(a.linha_resolvida || "").toLowerCase().includes(q) ||
        String(a.instrutor_nome || "").toLowerCase().includes(q)
      );
    });
  }, [
    acompanhamentosTratados,
    filtroLinha,
    filtroCluster,
    filtroInstrutor,
    mesReferencia,
    busca,
  ]);

  const eventosFiltrados = useMemo(() => {
    return eventosTratados.filter((e) => {
      if (filtroLinha && e.linha_foco !== filtroLinha) return false;
      if (filtroInstrutor && e.instrutor_nome !== filtroInstrutor) return false;
      if (filtroProntuario && e.tipo !== filtroProntuario) return false;
      if (mesReferencia) {
        const mesItem = dateOnly(e.created_at_dt).slice(0, 7);
        if (mesItem !== mesReferencia) return false;
      }

      const q = busca.toLowerCase().trim();
      if (!q) return true;

      return (
        String(e.motorista_nome || "").toLowerCase().includes(q) ||
        String(e.motorista_chapa || "").toLowerCase().includes(q) ||
        String(e.linha_foco || "").toLowerCase().includes(q)
      );
    });
  }, [
    eventosTratados,
    filtroLinha,
    filtroInstrutor,
    filtroProntuario,
    mesReferencia,
    busca,
  ]);

  const checkpointResumo = useMemo(() => {
    const rows = eventosFiltrados;
    return {
      total: rows.length,
      melhoraramKml: rows.filter((r) => n(r.delta_kml) > 0).length,
      pioraramKml: rows.filter((r) => n(r.delta_kml) < 0).length,
      estavelKml: rows.filter((r) => n(r.delta_kml) === 0).length,
      reduziramDesperdicio: rows.filter((r) => n(r.delta_desperdicio) < 0).length,
      aumentaramDesperdicio: rows.filter((r) => n(r.delta_desperdicio) > 0).length,
      mediaDeltaKml: rows.length
        ? rows.reduce((acc, r) => acc + n(r.delta_kml), 0) / rows.length
        : 0,
      mediaDeltaDesp: rows.length
        ? rows.reduce((acc, r) => acc + n(r.delta_desperdicio), 0) / rows.length
        : 0,
    };
  }, [eventosFiltrados]);

  const resumoPorLinhaCheckpoint = useMemo(() => {
    const map = new Map();

    eventosFiltrados.forEach((r) => {
      const key = `${r.linha_foco}__${r.tipo}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          linha_foco: r.linha_foco,
          tipo: r.tipo,
          qtd_motoristas: 0,
          antes_kml: 0,
          depois_kml: 0,
          delta_kml: 0,
          antes_desp: 0,
          depois_desp: 0,
          delta_desperdicio: 0,
          melhorou: 0,
          piorou: 0,
          sem_evolucao: 0,
        });
      }

      const item = map.get(key);
      item.qtd_motoristas += 1;
      item.antes_kml += r.antes_kml;
      item.depois_kml += r.depois_kml;
      item.delta_kml += r.delta_kml;
      item.antes_desp += r.antes_desp;
      item.depois_desp += r.depois_desp;
      item.delta_desperdicio += r.delta_desperdicio;

      if (r.conclusao === "MELHOROU") item.melhorou += 1;
      else if (r.conclusao === "PIOROU") item.piorou += 1;
      else item.sem_evolucao += 1;
    });

    return [...map.values()]
      .map((r) => ({
        ...r,
        antes_kml: r.qtd_motoristas ? r.antes_kml / r.qtd_motoristas : 0,
        depois_kml: r.qtd_motoristas ? r.depois_kml / r.qtd_motoristas : 0,
        delta_kml: r.qtd_motoristas ? r.delta_kml / r.qtd_motoristas : 0,
        antes_desp: r.qtd_motoristas ? r.antes_desp / r.qtd_motoristas : 0,
        depois_desp: r.qtd_motoristas ? r.depois_desp / r.qtd_motoristas : 0,
        delta_desperdicio: r.qtd_motoristas
          ? r.delta_desperdicio / r.qtd_motoristas
          : 0,
      }))
      .sort((a, b) => a.delta_desperdicio - b.delta_desperdicio);
  }, [eventosFiltrados]);

  const resumoInstrutor = useMemo(() => {
    const map = new Map();

    acompanhamentosFiltrados.forEach((r) => {
      const key = String(r.instrutor_nome || "Sem instrutor").trim() || "Sem instrutor";
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          instrutor_nome: key,
          total_acompanhamentos: 0,
          total_minutos: 0,
          em_monitoramento: 0,
          em_analise: 0,
          concluidos: 0,
          linhas: new Set(),
        });
      }

      const item = map.get(key);
      item.total_acompanhamentos += 1;
      item.total_minutos += n(r.duracao_min);
      if (r.status_norm === "EM_MONITORAMENTO") item.em_monitoramento += 1;
      if (r.status_norm === "EM_ANALISE") item.em_analise += 1;
      if (["OK", "ENCERRADO", "ATAS"].includes(r.status_norm)) item.concluidos += 1;
      if (r.linha_resolvida) item.linhas.add(r.linha_resolvida);
    });

    return [...map.values()]
      .map((r) => ({
        ...r,
        media_minutos: r.total_acompanhamentos
          ? r.total_minutos / r.total_acompanhamentos
          : 0,
        qtd_linhas: r.linhas.size,
      }))
      .sort((a, b) => b.total_minutos - a.totalMinutos);
  }, [acompanhamentosFiltrados]);

  const tempoPorDia = useMemo(() => {
    const map = new Map();

    acompanhamentosFiltrados.forEach((r) => {
      const key = `${r.data_ref}__${r.instrutor_nome || "Sem instrutor"}`;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          data_ref: r.data_ref,
          instrutor_nome: r.instrutor_nome || "Sem instrutor",
          total_acompanhamentos: 0,
          total_minutos: 0,
        });
      }
      const item = map.get(key);
      item.total_acompanhamentos += 1;
      item.total_minutos += n(r.duracao_min);
    });

    return [...map.values()]
      .map((r) => ({
        ...r,
        media_minutos: r.total_acompanhamentos
          ? r.total_minutos / r.total_acompanhamentos
          : 0,
      }))
      .sort((a, b) => {
        if (a.data_ref === b.data_ref)
          return String(a.instrutor_nome).localeCompare(
            String(b.instrutor_nome),
            "pt-BR"
          );
        return String(b.data_ref).localeCompare(String(a.data_ref));
      });
  }, [acompanhamentosFiltrados]);

  const mapaUltimoCheckpoint = useMemo(() => {
    const map = new Map();

    eventosFiltrados.forEach((ev) => {
      const atual = map.get(ev.acompanhamento_id);
      if (!atual || String(ev.created_at_dt) > String(atual.created_at_dt)) {
        map.set(ev.acompanhamento_id, ev);
      }
    });

    return map;
  }, [eventosFiltrados]);

  const acompanhamentosComEvolucao = useMemo(() => {
    return acompanhamentosFiltrados.map((a) => {
      const cp = mapaUltimoCheckpoint.get(a.id);
      return {
        ...a,
        checkpoint_tipo: cp?.tipo || "",
        antes_kml: cp?.antes_kml ?? null,
        depois_kml: cp?.depois_kml ?? null,
        delta_kml: cp?.delta_kml ?? null,
        antes_desp: cp?.antes_desp ?? null,
        depois_desp: cp?.depois_desp ?? null,
        delta_desperdicio: cp?.delta_desperdicio ?? null,
        conclusao_checkpoint: cp?.conclusao || "",
      };
    });
  }, [acompanhamentosFiltrados, mapaUltimoCheckpoint]);

  const totalDesperdicioMeta = useMemo(() => {
    return rowsReferenciaComRef.reduce((acc, r) => acc + n(r.Litros_Desp_Meta), 0);
  }, [rowsReferenciaComRef]);

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

  const variacaoGeral = useMemo(() => {
    return kmlComparacaoGeral > 0
      ? ((kmlReferenciaGeral - kmlComparacaoGeral) / kmlComparacaoGeral) * 100
      : 0;
  }, [kmlReferenciaGeral, kmlComparacaoGeral]);

  const totalMinutosAcompanhamentos = useMemo(() => {
    return acompanhamentosFiltrados.reduce((acc, r) => acc + n(r.duracao_min), 0);
  }, [acompanhamentosFiltrados]);

  const cards = useMemo(
    () => ({
      linhas: tabelaLinhas.length,
      motoristas: topMotoristas.length,
      veiculos: topVeiculos.length,
      acompanhamentos: acompanhamentosFiltrados.length,
      checkpoints: eventosFiltrados.length,
    }),
    [
      tabelaLinhas,
      topMotoristas,
      topVeiculos,
      acompanhamentosFiltrados,
      eventosFiltrados,
    ]
  );

  function handleSort(key) {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  const linhasTabelaOrdenada = useMemo(() => {
    const arr = [...tabelaLinhas];
    arr.sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const va = a[sortConfig.key] ?? 0;
      const vb = b[sortConfig.key] ?? 0;
      if (typeof va === "string") return va.localeCompare(vb, "pt-BR") * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [tabelaLinhas, sortConfig]);

  const veiculosOrdenados = useMemo(() => {
    const arr = [...topVeiculos];
    arr.sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const va = a[sortConfig.key] ?? 0;
      const vb = b[sortConfig.key] ?? 0;
      if (typeof va === "string") return va.localeCompare(vb, "pt-BR") * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [topVeiculos, sortConfig]);

  const motoristasOrdenados = useMemo(() => {
    const arr = [...topMotoristas];
    arr.sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const va = a[sortConfig.key] ?? 0;
      const vb = b[sortConfig.key] ?? 0;
      if (typeof va === "string")
        return String(va).localeCompare(String(vb), "pt-BR") * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [topMotoristas, sortConfig]);

  const headerSubAcompanhamento = {
    RESUMO_INSTRUTOR: {
      titulo: "Resumo por Instrutor",
      subtitulo:
        "Consolida volume, tempo gasto, status e linhas atendidas no mês de referência.",
    },
    TEMPO_DIA: {
      titulo: "Tempo por Dia",
      subtitulo:
        "Mostra o esforço diário por instrutor, com quantidade de acompanhamentos, tempo total e tempo médio.",
    },
    CHECKPOINT_LINHA: {
      titulo: "Check Point por Linha",
      subtitulo:
        "Compara antes x pós acompanhamento por tipo de prontuário, com Δ KM/L, Δ desperdício e resultado operacional.",
    },
    ACOMPANHAMENTOS: {
      titulo: "Acompanhamentos",
      subtitulo:
        "Lista todas as ordens do mês, inclusive finalizadas, com evolução operacional e status final.",
    },
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[96rem] mx-auto min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <FaBolt className="text-yellow-500" /> Análise Gerencial Diesel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Painel analítico por mês fechado.
          </p>
        </div>

        <button
          onClick={carregarTudo}
          className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 flex items-center gap-2 text-sm font-bold w-full md:w-auto justify-center"
        >
          <FaSync className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {erro ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-bold">
          {erro}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Linhas</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.linhas)}</p>
            <p className="text-xs text-gray-500 mt-1">referência: {mesReferencia || "-"}</p>
          </div>
          <FaRoad className="text-4xl text-blue-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-violet-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Ranking Motoristas</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.motoristas)}</p>
            <p className="text-xs text-gray-500 mt-1">KM/L ref.: {fmtNum(kmlReferenciaGeral)}</p>
          </div>
          <FaUser className="text-4xl text-violet-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-cyan-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Ranking Carros</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.veiculos)}</p>
            <p className="text-xs text-gray-500 mt-1">desp.: {fmtNum(totalDesperdicioMeta)} L</p>
          </div>
          <FaTruck className="text-4xl text-cyan-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Acompanhamentos</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.acompanhamentos)}</p>
            <p className="text-xs text-gray-500 mt-1">
              tempo total: {formatMinutes(totalMinutosAcompanhamentos)}
            </p>
          </div>
          <FaClock className="text-4xl text-amber-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Checkpoints</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.checkpoints)}</p>
            <p className="text-xs text-gray-500 mt-1">comparação: {mesComparacao || "-"}</p>
          </div>
          <FaClipboardList className="text-4xl text-emerald-50" />
        </div>
      </div>

      <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-lg w-fit gap-1">
        {[
          ["LINHAS", "📈 Análise de Linhas"],
          ["MOTORISTAS", "👤 Ranking de Motoristas"],
          ["CARROS", "🚌 Ranking de Carros"],
          ["ACOMPANHAMENTOS", "🧭 Acompanhamentos"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setAbaAtiva(key);
              setSortConfig({
                key: key === "LINHAS" ? "Desperdicio" : "Litros_Desp_Meta",
                direction: "desc",
              });
            }}
            className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
              abaAtiva === key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-center bg-white p-3 md:p-4 rounded-lg border shadow-sm">
        <div className="relative w-full md:flex-1">
          <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar linha, motorista, carro, chapa..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="w-full md:w-auto flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
          <FaFilter className="text-gray-400 ml-2" />
          <select
            value={filtroLinha}
            onChange={(e) => setFiltroLinha(e.target.value)}
            className="p-2.5 bg-transparent text-sm outline-none flex-1 md:w-40 font-medium text-slate-600"
          >
            <option value="">Todas Linhas</option>
            {linhasUnicas.map((ln) => (
              <option key={ln} value={ln}>
                {ln}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-auto flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
          <FaFilter className="text-gray-400 ml-2" />
          <select
            value={filtroCluster}
            onChange={(e) => setFiltroCluster(e.target.value)}
            className="p-2.5 bg-transparent text-sm outline-none flex-1 md:w-32 font-medium text-slate-600"
          >
            <option value="">Todos Clusters</option>
            {clustersUnicos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {abaAtiva === "ACOMPANHAMENTOS" && (
          <>
            <div className="w-full md:w-auto flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
              <FaFilter className="text-gray-400 ml-2" />
              <select
                value={filtroInstrutor}
                onChange={(e) => setFiltroInstrutor(e.target.value)}
                className="p-2.5 bg-transparent text-sm outline-none flex-1 md:w-44 font-medium text-slate-600"
              >
                <option value="">Todos Instrutores</option>
                {instrutoresUnicos.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-auto flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
              <FaFilter className="text-gray-400 ml-2" />
              <select
                value={filtroProntuario}
                onChange={(e) => setFiltroProntuario(e.target.value)}
                className="p-2.5 bg-transparent text-sm outline-none flex-1 md:w-40 font-medium text-slate-600"
              >
                <option value="">Todos Prontuários</option>
                <option value="PRONTUARIO_10">Prontuário 10</option>
                <option value="PRONTUARIO_20">Prontuário 20</option>
                <option value="PRONTUARIO_30">Prontuário 30</option>
              </select>
            </div>
          </>
        )}

        <div className="w-full md:w-auto flex items-center gap-2 bg-slate-50 border rounded-lg px-2">
          <FaFilter className="text-gray-400 ml-2" />
          <select
            value={mesReferencia}
            onChange={(e) => setMesReferencia(e.target.value)}
            className="p-2.5 bg-transparent text-sm outline-none flex-1 md:w-40 font-medium text-slate-600"
          >
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Mês de Referência</p>
          <p className="text-xl font-black text-slate-800">{mesReferencia || "-"}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <p className="text-sm text-gray-500 font-bold">Mês de Comparação</p>
          <p className="text-xl font-black text-slate-800">{mesComparacao || "-"}</p>
        </div>
      </div>

      {abaAtiva === "LINHAS" && (
        <AnaliseLinhasModal
          kmlReferenciaGeral={kmlReferenciaGeral}
          kmlComparacaoGeral={kmlComparacaoGeral}
          variacaoGeral={variacaoGeral}
          totalDesperdicioMeta={totalDesperdicioMeta}
          linhasTabelaOrdenada={linhasTabelaOrdenada}
          sortConfig={sortConfig}
          handleSort={handleSort}
          fmtNum={fmtNum}
          fmtInt={fmtInt}
          EvolucaoBadge={EvolucaoBadge}
          SortIcon={SortIcon}
        />
      )}

      {abaAtiva === "MOTORISTAS" && (
        <RankingMotoristasModal
          motoristasOrdenados={motoristasOrdenados}
          sortConfig={sortConfig}
          handleSort={handleSort}
          fmtNum={fmtNum}
          SortIcon={SortIcon}
        />
      )}

      {abaAtiva === "CARROS" && (
        <RankingCarrosModal
          veiculosOrdenados={veiculosOrdenados}
          sortConfig={sortConfig}
          handleSort={handleSort}
          fmtNum={fmtNum}
          SortIcon={SortIcon}
        />
      )}

      {abaAtiva === "ACOMPANHAMENTOS" && (
        <AcompanhamentosModal
          subAcompanhamento={subAcompanhamento}
          setSubAcompanhamento={setSubAcompanhamento}
          headerSubAcompanhamento={headerSubAcompanhamento}
          checkpointResumo={checkpointResumo}
          resumoInstrutor={resumoInstrutor}
          tempoPorDia={tempoPorDia}
          resumoPorLinhaCheckpoint={resumoPorLinhaCheckpoint}
          acompanhamentosComEvolucao={acompanhamentosComEvolucao}
          fmtNum={fmtNum}
          fmtDateBr={fmtDateBr}
          formatMinutes={formatMinutes}
          statusBadgeClass={statusBadgeClass}
          EvolucaoBadge={EvolucaoBadge}
        />
      )}
    </div>
  );
}
