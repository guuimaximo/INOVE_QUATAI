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
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
} from "react-icons/fa";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../supabase";

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

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
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
  return direction === "asc" ? (
    <span className="text-blue-600 ml-2 text-[10px]">▲</span>
  ) : (
    <span className="text-blue-600 ml-2 text-[10px]">▼</span>
  );
}

function EvolucaoBadge({ value, invert = false }) {
  const val = n(value);
  const positivo = invert ? val < 0 : val > 0;
  const negativo = invert ? val > 0 : val < 0;

  if (positivo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
        <FaArrowUp size={10} /> {fmtNum(Math.abs(val), 2)}
      </span>
    );
  }

  if (negativo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-rose-50 text-rose-700 border-rose-200">
        <FaArrowDown size={10} /> {fmtNum(Math.abs(val), 2)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
      <FaEquals size={10} /> 0,00
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
  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroInstrutor, setFiltroInstrutor] = useState("");
  const [filtroDataIni, setFiltroDataIni] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "impacto", direction: "desc" });

  async function carregarPremiacao() {
    if (!supabaseA) {
      throw new Error("Supabase A não configurado nas variáveis VITE_SUPA_BASE_BCNT_URL e VITE_SUPA_BASE_BCNT_ANON_KEY.");
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
          litros_ideais,
          minutos_em_viagem
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
      .limit(3000);

    if (error) throw error;
    return data || [];
  }

  async function carregarEventos() {
    const { data, error } = await supabase
      .from("diesel_acompanhamento_eventos")
      .select("id, acompanhamento_id, created_at, tipo, observacoes, extra")
      .in("tipo", ["PRONTUARIO_10", "PRONTUARIO_20", "PRONTUARIO_30"])
      .order("created_at", { ascending: false })
      .limit(5000);

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
      const litrosDespMeta = metaLinha > 0 && litrosIdeais > 0 && comb > litrosIdeais ? comb - litrosIdeais : 0;

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
        fabricante: String(r.fabricante || "").trim(),
        Km: km,
        Comb: comb,
        kml,
        Meta_Linha: metaLinha,
        Litros_Esperados: litrosIdeais,
        Litros_Desp_Meta: litrosDespMeta,
        Minutos: n(r.minutos_em_viagem),
      };
    });

    return base.filter((r) => {
      if (!r.Date) return false;
      if (!(r.Km > 0 && r.Comb > 0)) return false;
      if (!r.Cluster) return false;
      if (!(r.kml >= 1.5 && r.kml <= 5)) return false;
      return true;
    });
  }, [rowsBase, mapaFuncionarios]);

  const mesesDisponiveis = useMemo(() => {
    return [...new Set(dataset.map((r) => r.Mes_Ano).filter(Boolean))].sort();
  }, [dataset]);

  const mesAtual = useMemo(() => (mesesDisponiveis.length ? mesesDisponiveis[mesesDisponiveis.length - 1] : ""), [mesesDisponiveis]);
  const mesAnterior = useMemo(() => (mesesDisponiveis.length >= 2 ? mesesDisponiveis[mesesDisponiveis.length - 2] : ""), [mesesDisponiveis]);

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
    return [...new Set(acompanhamentos.map((a) => String(a.instrutor_nome || "").trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
  }, [acompanhamentos]);

  const datasetFiltrado = useMemo(() => {
    return dataset.filter((r) => {
      if (filtroLinha && r.linha !== filtroLinha) return false;
      if (filtroCluster && r.Cluster !== filtroCluster) return false;
      if (filtroDataIni && r.dateOnly < filtroDataIni) return false;
      if (filtroDataFim && r.dateOnly > filtroDataFim) return false;

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
  }, [dataset, filtroLinha, filtroCluster, filtroDataIni, filtroDataFim, busca]);

  const rowsAtual = useMemo(() => datasetFiltrado.filter((r) => r.Mes_Ano === mesAtual), [datasetFiltrado, mesAtual]);
  const rowsAnterior = useMemo(() => datasetFiltrado.filter((r) => r.Mes_Ano === mesAnterior), [datasetFiltrado, mesAnterior]);

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
    const linhas = [...new Set(datasetFiltrado.map((r) => r.linha).filter(Boolean))];

    return linhas
      .map((linha) => {
        const atual = mapaLinhaMes.get(`${linha}__${mesAtual}`) || { Km: 0, Comb: 0, Litros_Esperados: 0, Litros_Desp_Meta: 0 };
        const ant = mapaLinhaMes.get(`${linha}__${mesAnterior}`) || { Km: 0, Comb: 0, Litros_Esperados: 0, Litros_Desp_Meta: 0 };

        const kmlAtual = atual.Comb > 0 ? atual.Km / atual.Comb : 0;
        const kmlAnterior = ant.Comb > 0 ? ant.Km / ant.Comb : 0;
        const metaPonderada = atual.Litros_Esperados > 0 ? atual.Km / atual.Litros_Esperados : 0;
        const variacaoPct = kmlAnterior > 0 ? ((kmlAtual - kmlAnterior) / kmlAnterior) * 100 : 0;

        return {
          id: linha,
          linha,
          KML_Anterior: kmlAnterior,
          KML_Atual: kmlAtual,
          Variacao_Pct: variacaoPct,
          Meta_Ponderada: metaPonderada,
          Desperdicio: atual.Litros_Desp_Meta,
          Km: atual.Km,
          Comb: atual.Comb,
        };
      })
      .sort((a, b) => b.Desperdicio - a.Desperdicio);
  }, [datasetFiltrado, mapaLinhaMes, mesAtual, mesAnterior]);

  const refGrupoAtual = useMemo(() => {
    const map = new Map();
    rowsAtual.forEach((r) => {
      const key = `${r.linha}__${r.Cluster}`;
      if (!map.has(key)) map.set(key, { Km: 0, Comb: 0 });
      const item = map.get(key);
      item.Km += r.Km;
      item.Comb += r.Comb;
    });
    return map;
  }, [rowsAtual]);

  const rowsAtualComRef = useMemo(() => {
    return rowsAtual.map((r) => {
      const ref = refGrupoAtual.get(`${r.linha}__${r.Cluster}`) || { Km: 0, Comb: 0 };
      const KML_Ref = ref.Comb > 0 ? ref.Km / ref.Comb : 0;
      const Litros_Desperdicio = KML_Ref > 0 && r.kml < KML_Ref ? r.Comb - r.Km / KML_Ref : 0;
      return {
        ...r,
        KML_Ref,
        Litros_Desperdicio,
      };
    });
  }, [rowsAtual, refGrupoAtual]);

  const mapaKmLinhaAtual = useMemo(() => {
    const map = new Map();
    rowsAtualComRef.forEach((r) => {
      map.set(r.linha, n(map.get(r.linha)) + r.Km);
    });
    return map;
  }, [rowsAtualComRef]);

  const topVeiculos = useMemo(() => {
    const map = new Map();
    rowsAtualComRef.forEach((r) => {
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
  }, [rowsAtualComRef]);

  const topMotoristas = useMemo(() => {
    const map = new Map();
    rowsAtualComRef.forEach((r) => {
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
        const kmTotalLinha = n(mapaKmLinhaAtual.get(r.linha));
        return {
          ...r,
          KML_Real: r.Comb > 0 ? r.Km / r.Comb : 0,
          KML_Meta: r.count > 0 ? r.KML_Ref / r.count : 0,
          Meta_Linha: r.count > 0 ? r.Meta_Linha / r.count : 0,
          Impacto_Pct: kmTotalLinha > 0 ? (r.Km / kmTotalLinha) * 100 : 0,
        };
      })
      .sort((a, b) => b.Litros_Desp_Meta - a.Litros_Desp_Meta);
  }, [rowsAtualComRef, mapaKmLinhaAtual]);

  const acompanhamentosTratados = useMemo(() => {
    return (acompanhamentos || []).map((a) => {
      const iniMin = parseHoraToMin(a.intervencao_hora_inicio);
      const fimMin = parseHoraToMin(a.intervencao_hora_fim);
      const duracaoMin = iniMin != null && fimMin != null && fimMin >= iniMin ? fimMin - iniMin : 0;
      return {
        ...a,
        status_norm: statusNorm(a.status),
        linha_resolvida: getLinhaFocoAcompanhamento(a),
        data_ref: dateOnly(a.dt_inicio_monitoramento || a.created_at),
        duracao_min: duracaoMin,
      };
    });
  }, [acompanhamentos]);

  const acompanhamentosFiltrados = useMemo(() => {
    return acompanhamentosTratados.filter((a) => {
      if (filtroLinha && a.linha_resolvida !== filtroLinha) return false;
      if (filtroCluster) {
        const c = normalize(a.cluster_foco || a.metadata?.cluster_foco);
        if (c !== filtroCluster) return false;
      }
      if (filtroInstrutor && String(a.instrutor_nome || "").trim() !== filtroInstrutor) return false;
      if (filtroDataIni && a.data_ref < filtroDataIni) return false;
      if (filtroDataFim && a.data_ref > filtroDataFim) return false;

      const q = busca.toLowerCase().trim();
      if (!q) return true;

      return (
        String(a.motorista_nome || "").toLowerCase().includes(q) ||
        String(a.motorista_chapa || "").toLowerCase().includes(q) ||
        String(a.linha_resolvida || "").toLowerCase().includes(q) ||
        String(a.instrutor_nome || "").toLowerCase().includes(q)
      );
    });
  }, [acompanhamentosTratados, filtroLinha, filtroCluster, filtroInstrutor, filtroDataIni, filtroDataFim, busca]);

  const eventosTratados = useMemo(() => {
    const mapaAcomp = new Map(acompanhamentosTratados.map((a) => [a.id, a]));

    return (eventos || []).map((ev) => {
      const extra = ev?.extra && typeof ev.extra === "object" ? ev.extra : {};
      const comparativo = extra?.comparativo && typeof extra.comparativo === "object" ? extra.comparativo : {};
      const antes = comparativo?.antes_periodo && typeof comparativo.antes_periodo === "object" ? comparativo.antes_periodo : {};
      const depois = comparativo?.depois_periodo && typeof comparativo.depois_periodo === "object" ? comparativo.depois_periodo : {};
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
      };
    });
  }, [eventos, acompanhamentosTratados]);

  const eventosFiltrados = useMemo(() => {
    return eventosTratados.filter((e) => {
      if (filtroLinha && e.linha_foco !== filtroLinha) return false;
      if (filtroInstrutor && e.instrutor_nome !== filtroInstrutor) return false;
      const d = dateOnly(e.created_at_dt);
      if (filtroDataIni && d < filtroDataIni) return false;
      if (filtroDataFim && d > filtroDataFim) return false;

      const q = busca.toLowerCase().trim();
      if (!q) return true;

      return (
        String(e.motorista_nome || "").toLowerCase().includes(q) ||
        String(e.motorista_chapa || "").toLowerCase().includes(q) ||
        String(e.linha_foco || "").toLowerCase().includes(q)
      );
    });
  }, [eventosTratados, filtroLinha, filtroInstrutor, filtroDataIni, filtroDataFim, busca]);

  const checkpointResumo = useMemo(() => {
    const rows = eventosFiltrados;
    return {
      total: rows.length,
      melhoraramKml: rows.filter((r) => n(r.delta_kml) > 0).length,
      pioraramKml: rows.filter((r) => n(r.delta_kml) < 0).length,
      estavelKml: rows.filter((r) => n(r.delta_kml) === 0).length,
      reduziramDesperdicio: rows.filter((r) => n(r.delta_desperdicio) < 0).length,
      aumentaramDesperdicio: rows.filter((r) => n(r.delta_desperdicio) > 0).length,
      mediaDeltaKml: rows.length ? rows.reduce((acc, r) => acc + n(r.delta_kml), 0) / rows.length : 0,
      mediaDeltaDesp: rows.length ? rows.reduce((acc, r) => acc + n(r.delta_desperdicio), 0) / rows.length : 0,
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
        delta_desperdicio: r.qtd_motoristas ? r.delta_desperdicio / r.qtd_motoristas : 0,
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
        media_minutos: r.total_acompanhamentos ? r.total_minutos / r.total_acompanhamentos : 0,
        qtd_linhas: r.linhas.size,
      }))
      .sort((a, b) => b.total_minutos - a.total_minutos);
  }, [acompanhamentosFiltrados]);

  const tempoPorDia = useMemo(() => {
    const map = new Map();
    acompanhamentosFiltrados.forEach((r) => {
      const key = `${r.data_ref}__${r.instrutor_nome || 'Sem instrutor'}`;
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
        media_minutos: r.total_acompanhamentos ? r.total_minutos / r.total_acompanhamentos : 0,
      }))
      .sort((a, b) => {
        if (a.data_ref === b.data_ref) return String(a.instrutor_nome).localeCompare(String(b.instrutor_nome), "pt-BR");
        return String(b.data_ref).localeCompare(String(a.data_ref));
      });
  }, [acompanhamentosFiltrados]);

  const totalDesperdicioMeta = useMemo(() => rowsAtualComRef.reduce((acc, r) => acc + n(r.Litros_Desp_Meta), 0), [rowsAtualComRef]);
  const kmlAtualGeral = useMemo(() => {
    const km = rowsAtualComRef.reduce((acc, r) => acc + n(r.Km), 0);
    const comb = rowsAtualComRef.reduce((acc, r) => acc + n(r.Comb), 0);
    return comb > 0 ? km / comb : 0;
  }, [rowsAtualComRef]);
  const kmlAnteriorGeral = useMemo(() => {
    const km = rowsAnterior.reduce((acc, r) => acc + n(r.Km), 0);
    const comb = rowsAnterior.reduce((acc, r) => acc + n(r.Comb), 0);
    return comb > 0 ? km / comb : 0;
  }, [rowsAnterior]);
  const variacaoGeral = useMemo(() => (kmlAnteriorGeral > 0 ? ((kmlAtualGeral - kmlAnteriorGeral) / kmlAnteriorGeral) * 100 : 0), [kmlAtualGeral, kmlAnteriorGeral]);
  const totalMinutosAcompanhamentos = useMemo(() => acompanhamentosFiltrados.reduce((acc, r) => acc + n(r.duracao_min), 0), [acompanhamentosFiltrados]);

  const cards = useMemo(() => ({
    linhas: tabelaLinhas.length,
    motoristas: topMotoristas.length,
    veiculos: topVeiculos.length,
    acompanhamentos: acompanhamentosFiltrados.length,
    checkpoints: eventosFiltrados.length,
  }), [tabelaLinhas, topMotoristas, topVeiculos, acompanhamentosFiltrados, eventosFiltrados]);

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
      if (typeof va === "string") return String(va).localeCompare(String(vb), "pt-BR") * dir;
      return (va - vb) * dir;
    });
    return arr;
  }, [topMotoristas, sortConfig]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <FaBolt className="text-yellow-500" /> Análise Gerencial Diesel
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Painel analítico direto do banco, sem depender do snapshot do Python.
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
            <p className="text-xs text-gray-500 mt-1">mês atual: {mesAtual || "-"}</p>
          </div>
          <FaRoad className="text-4xl text-blue-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-violet-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Ranking Motoristas</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.motoristas)}</p>
            <p className="text-xs text-gray-500 mt-1">KM/L atual: {fmtNum(kmlAtualGeral)}</p>
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
            <p className="text-xs text-gray-500 mt-1">tempo total: {formatMinutes(totalMinutosAcompanhamentos)}</p>
          </div>
          <FaClock className="text-4xl text-amber-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Checkpoints</p>
            <p className="text-2xl font-black text-slate-800">{fmtInt(cards.checkpoints)}</p>
            <p className="text-xs text-gray-500 mt-1">Δ KM/L: {fmtNum(checkpointResumo.mediaDeltaKml)}</p>
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
              setSortConfig({ key: key === "LINHAS" ? "Desperdicio" : "Litros_Desp_Meta", direction: "desc" });
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
        )}

        <div className="w-full md:w-auto flex items-center gap-2 bg-slate-50 border rounded-lg p-1">
          <input
            type="date"
            value={filtroDataIni}
            onChange={(e) => setFiltroDataIni(e.target.value)}
            className="p-1.5 bg-transparent text-sm outline-none text-slate-600 font-medium flex-1"
          />
          <span className="text-gray-400 font-bold text-xs">até</span>
          <input
            type="date"
            value={filtroDataFim}
            onChange={(e) => setFiltroDataFim(e.target.value)}
            className="p-1.5 bg-transparent text-sm outline-none text-slate-600 font-medium flex-1"
          />
        </div>
      </div>

      {abaAtiva === "LINHAS" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">KM/L Atual</p>
              <p className="text-2xl font-black text-slate-800">{fmtNum(kmlAtualGeral)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">KM/L Anterior</p>
              <p className="text-2xl font-black text-slate-800">{fmtNum(kmlAnteriorGeral)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">Variação</p>
              <p className="text-2xl font-black text-slate-800">{fmtNum(variacaoGeral)}%</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">Desperdício Meta</p>
              <p className="text-2xl font-black text-slate-800">{fmtNum(totalDesperdicioMeta)} L</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <table className="w-full text-left min-w-[1100px]">
              <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
                <tr>
                  {[
                    ["linha", "Linha"],
                    ["KML_Anterior", "KM/L Ant."],
                    ["KML_Atual", "KM/L Atual"],
                    ["Variacao_Pct", "Var.%"],
                    ["Meta_Ponderada", "Meta"],
                    ["Desperdicio", "Desperdício"],
                    ["Km", "KM"],
                    ["Comb", "Comb."],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => handleSort(key)}
                    >
                      <div className="flex items-center">
                        {label}
                        <SortIcon active={sortConfig.key === key} direction={sortConfig.direction} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linhasTabelaOrdenada.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-4 font-black text-slate-900">{row.linha}</td>
                    <td className="px-4 py-4">{fmtNum(row.KML_Anterior)}</td>
                    <td className="px-4 py-4">{fmtNum(row.KML_Atual)}</td>
                    <td className="px-4 py-4"><EvolucaoBadge value={row.Variacao_Pct} /></td>
                    <td className="px-4 py-4">{fmtNum(row.Meta_Ponderada)}</td>
                    <td className="px-4 py-4 font-bold text-rose-700">{fmtNum(row.Desperdicio)} L</td>
                    <td className="px-4 py-4">{fmtInt(row.Km)}</td>
                    <td className="px-4 py-4">{fmtNum(row.Comb)} L</td>
                  </tr>
                ))}
                {linhasTabelaOrdenada.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                      Nenhuma linha encontrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {abaAtiva === "MOTORISTAS" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left min-w-[1250px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
              <tr>
                {[
                  ["Motorista", "Motorista"],
                  ["chapa", "Chapa"],
                  ["linha", "Linha"],
                  ["Cluster", "Cluster"],
                  ["KML_Real", "KM/L Real"],
                  ["KML_Meta", "KM/L Ref"],
                  ["Litros_Desp_Meta", "Desperdício"],
                  ["Impacto_Pct", "Impacto %"],
                  ["Km", "KM"],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort(key)}
                  >
                    <div className="flex items-center">
                      {label}
                      <SortIcon active={sortConfig.key === key} direction={sortConfig.direction} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {motoristasOrdenados.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="font-black text-slate-900">{row.Motorista}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {row.chapa}
                    </span>
                  </td>
                  <td className="px-4 py-4">{row.linha}</td>
                  <td className="px-4 py-4">{row.Cluster}</td>
                  <td className="px-4 py-4">{fmtNum(row.KML_Real)}</td>
                  <td className="px-4 py-4">{fmtNum(row.KML_Meta)}</td>
                  <td className="px-4 py-4 font-bold text-rose-700">{fmtNum(row.Litros_Desp_Meta)} L</td>
                  <td className="px-4 py-4">{fmtNum(row.Impacto_Pct)}%</td>
                  <td className="px-4 py-4">{fmtInt(row.Km)}</td>
                </tr>
              ))}
              {motoristasOrdenados.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum motorista encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {abaAtiva === "CARROS" && (
        <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
          <table className="w-full text-left min-w-[1200px]">
            <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
              <tr>
                {[
                  ["veiculo", "Carro"],
                  ["linha", "Linha"],
                  ["Cluster", "Cluster"],
                  ["KML_Real", "KM/L Real"],
                  ["KML_Meta", "KM/L Ref"],
                  ["Litros_Desp_Meta", "Desperdício"],
                  ["Km", "KM"],
                  ["Comb", "Comb."],
                ].map(([key, label]) => (
                  <th
                    key={key}
                    className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort(key)}
                  >
                    <div className="flex items-center">
                      {label}
                      <SortIcon active={sortConfig.key === key} direction={sortConfig.direction} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {veiculosOrdenados.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 font-black text-slate-900">{row.veiculo}</td>
                  <td className="px-4 py-4">{row.linha}</td>
                  <td className="px-4 py-4">{row.Cluster}</td>
                  <td className="px-4 py-4">{fmtNum(row.KML_Real)}</td>
                  <td className="px-4 py-4">{fmtNum(row.KML_Meta)}</td>
                  <td className="px-4 py-4 font-bold text-rose-700">{fmtNum(row.Litros_Desp_Meta)} L</td>
                  <td className="px-4 py-4">{fmtInt(row.Km)}</td>
                  <td className="px-4 py-4">{fmtNum(row.Comb)} L</td>
                </tr>
              ))}
              {veiculosOrdenados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                    Nenhum carro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {abaAtiva === "ACOMPANHAMENTOS" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">Melhoraram KM/L</p>
              <p className="text-2xl font-black text-slate-800">{fmtInt(checkpointResumo.melhoraramKml)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">Pioraram KM/L</p>
              <p className="text-2xl font-black text-slate-800">{fmtInt(checkpointResumo.pioraramKml)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">Reduziram desperdício</p>
              <p className="text-2xl font-black text-slate-800">{fmtInt(checkpointResumo.reduziramDesperdicio)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <p className="text-sm text-gray-500 font-bold">Δ Desperdício Médio</p>
              <p className="text-2xl font-black text-slate-800">{fmtNum(checkpointResumo.mediaDeltaDesp)} L</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="px-4 py-4 border-b bg-slate-50 font-extrabold text-slate-800">Resumo por Instrutor</div>
            <table className="w-full text-left min-w-[1000px]">
              <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4">Instrutor</th>
                  <th className="px-4 py-4">Acomp.</th>
                  <th className="px-4 py-4">Tempo Total</th>
                  <th className="px-4 py-4">Tempo Médio</th>
                  <th className="px-4 py-4">Em Monitor.</th>
                  <th className="px-4 py-4">Em Análise</th>
                  <th className="px-4 py-4">Concluídos</th>
                  <th className="px-4 py-4">Linhas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resumoInstrutor.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-4 font-black text-slate-900">{row.instrutor_nome}</td>
                    <td className="px-4 py-4">{fmtInt(row.total_acompanhamentos)}</td>
                    <td className="px-4 py-4">{formatMinutes(row.total_minutos)}</td>
                    <td className="px-4 py-4">{formatMinutes(row.media_minutos)}</td>
                    <td className="px-4 py-4">{fmtInt(row.em_monitoramento)}</td>
                    <td className="px-4 py-4">{fmtInt(row.em_analise)}</td>
                    <td className="px-4 py-4">{fmtInt(row.concluidos)}</td>
                    <td className="px-4 py-4">{fmtInt(row.qtd_linhas)}</td>
                  </tr>
                ))}
                {resumoInstrutor.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                      Nenhum instrutor encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="px-4 py-4 border-b bg-slate-50 font-extrabold text-slate-800">Tempo por Dia</div>
            <table className="w-full text-left min-w-[900px]">
              <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Instrutor</th>
                  <th className="px-4 py-4">Acomp.</th>
                  <th className="px-4 py-4">Tempo Total</th>
                  <th className="px-4 py-4">Tempo Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tempoPorDia.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-4">{fmtDateBr(row.data_ref)}</td>
                    <td className="px-4 py-4 font-black text-slate-900">{row.instrutor_nome}</td>
                    <td className="px-4 py-4">{fmtInt(row.total_acompanhamentos)}</td>
                    <td className="px-4 py-4">{formatMinutes(row.total_minutos)}</td>
                    <td className="px-4 py-4">{formatMinutes(row.media_minutos)}</td>
                  </tr>
                ))}
                {tempoPorDia.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-bold">
                      Nenhum registro de tempo encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="px-4 py-4 border-b bg-slate-50 font-extrabold text-slate-800">Checkpoints por Linha</div>
            <table className="w-full text-left min-w-[1250px]">
              <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4">Linha</th>
                  <th className="px-4 py-4">Tipo</th>
                  <th className="px-4 py-4">Qtd</th>
                  <th className="px-4 py-4">Antes KM/L</th>
                  <th className="px-4 py-4">Depois KM/L</th>
                  <th className="px-4 py-4">Δ KM/L</th>
                  <th className="px-4 py-4">Δ Desperdício</th>
                  <th className="px-4 py-4">Melhorou</th>
                  <th className="px-4 py-4">Piorou</th>
                  <th className="px-4 py-4">Estável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {resumoPorLinhaCheckpoint.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-4 font-black text-slate-900">{row.linha_foco}</td>
                    <td className="px-4 py-4">{row.tipo}</td>
                    <td className="px-4 py-4">{fmtInt(row.qtd_motoristas)}</td>
                    <td className="px-4 py-4">{fmtNum(row.antes_kml)}</td>
                    <td className="px-4 py-4">{fmtNum(row.depois_kml)}</td>
                    <td className="px-4 py-4"><EvolucaoBadge value={row.delta_kml} /></td>
                    <td className="px-4 py-4"><EvolucaoBadge value={row.delta_desperdicio} invert /></td>
                    <td className="px-4 py-4">{fmtInt(row.melhorou)}</td>
                    <td className="px-4 py-4">{fmtInt(row.piorou)}</td>
                    <td className="px-4 py-4">{fmtInt(row.sem_evolucao)}</td>
                  </tr>
                ))}
                {resumoPorLinhaCheckpoint.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500 font-bold">
                      Nenhum checkpoint encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
            <div className="px-4 py-4 border-b bg-slate-50 font-extrabold text-slate-800">Acompanhamentos</div>
            <table className="w-full text-left min-w-[1200px]">
              <thead className="bg-white text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4">Data</th>
                  <th className="px-4 py-4">Motorista</th>
                  <th className="px-4 py-4">Linha</th>
                  <th className="px-4 py-4">Instrutor</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Tempo</th>
                  <th className="px-4 py-4">KM/L Inicial</th>
                  <th className="px-4 py-4">KM/L Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {acompanhamentosFiltrados.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-4">{fmtDateBr(row.data_ref)}</td>
                    <td className="px-4 py-4">
                      <div className="font-black text-slate-900">{row.motorista_nome || "-"}</div>
                      <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded w-fit mt-1 border border-slate-200">
                        {row.motorista_chapa || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-4">{row.linha_resolvida}</td>
                    <td className="px-4 py-4">{row.instrutor_nome || "-"}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 whitespace-nowrap ${statusBadgeClass(row.status_norm)}`}>
                        {row.status_norm}
                      </span>
                    </td>
                    <td className="px-4 py-4">{formatMinutes(row.duracao_min)}</td>
                    <td className="px-4 py-4">{fmtNum(row.kml_inicial)}</td>
                    <td className="px-4 py-4">{fmtNum(row.kml_meta)}</td>
                  </tr>
                ))}
                {acompanhamentosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-bold">
                      Nenhum acompanhamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
