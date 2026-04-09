// src/pages/SOSResumo.jsx
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaTools,
  FaSearch,
  FaSync,
  FaInfoCircle,
  FaArrowDown as FaDownload,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
  FaExclamationTriangle,
  FaBus,
  FaWrench,
  FaLayerGroup,
  FaRoute,
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
} from "recharts";

const PAGE_ICON = FaTools;
const OCORRENCIAS_VALIDAS = ["RECOLHEU", "SOS", "AVARIA", "TROCA", "IMPROCEDENTE"];

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

function fmtPct(v) {
  return `${fmtNum(v, 1)}%`;
}

function fmtHoras(v) {
  const totalHoras = n(v);
  if (!totalHoras) return "0h";
  if (totalHoras < 1) return `${fmtNum(totalHoras * 60, 0)} min`;
  return `${fmtNum(totalHoras, 2)} h`;
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

function normalizeTipo(oc) {
  const o = normalize(oc);
  if (!o) return "";
  if (o === "RA" || o === "R.A" || o === "R.A.") return "RECOLHEU";
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
  if (!tipo) return false;
  if (tipo === "SEGUIU VIAGEM") return false;
  return true;
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

function varPct(atual, anterior) {
  const a = n(atual);
  const b = n(anterior);
  if (!b) return 0;
  return ((a - b) / b) * 100;
}

function EvolucaoBadge({ value, invert = false }) {
  const val = n(value);
  const abs = fmtNum(Math.abs(val), 1);

  if (val > 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${
          invert
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}
      >
        <FaArrowUp size={10} /> {abs}%
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
        <FaArrowDown size={10} /> {abs}%
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
      <FaEquals size={10} /> 0,0%
    </span>
  );
}

function exportarParaExcel(dados, nomeArquivo) {
  if (!dados || !dados.length) return;

  const processarValor = (valor) => {
    if (valor == null) return "";
    if (typeof valor === "object") return "";
    return String(valor).replace(/"/g, '""');
  };

  const colunas = Object.keys(dados[0]).filter((col) => typeof dados[0][col] !== "object");
  const linhas = dados.map((row) =>
    colunas.map((col) => `"${processarValor(row[col])}"`).join(";")
  );

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

export default function SOSResumo() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [rowsBase, setRowsBase] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("GERAL");

  const [busca, setBusca] = useState("");
  const [filtroOcorrencia, setFiltroOcorrencia] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroControlabilidade, setFiltroControlabilidade] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);

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
        const tipoNorm = normalizeTipo(r.ocorrencia);
        const valida = isOcorrenciaValida(r.ocorrencia);
        const tempoSolucaoHoras = calcDiffHours(
          r.data_sos || r.created_at,
          r.hora_sos,
          r.data_encerramento || r.data_fechamento
        );

        return {
          ...r,
          dataSOS,
          Mes_Ano: mesAno,
          tipo_norm: tipoNorm,
          valida_mkbf: valida,
          veiculo_norm: s(r.veiculo) || "N/D",
          linha_norm: normalize(r.linha) || "N/D",
          setor_norm: s(r.setor_manutencao) || "N/D",
          defeito_norm: s(r.problema_encontrado) || "N/D",
          classificacao_norm: s(r.classificacao_controlabilidade) || "N/D",
          tempo_solucao_horas: tempoSolucaoHoras,
        };
      })
      .filter((r) => r.dataSOS);
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

  const linhasUnicas = useMemo(() => {
    return [...new Set(dataset.map((r) => r.linha_norm).filter(Boolean))].sort();
  }, [dataset]);

  const setoresUnicos = useMemo(() => {
    return [...new Set(dataset.map((r) => r.setor_norm).filter(Boolean))].sort();
  }, [dataset]);

  const datasetFiltrado = useMemo(() => {
    const q = busca.toLowerCase().trim();

    return dataset.filter((r) => {
      if (mesReferencia && ![mesReferencia, mesComparacao].includes(r.Mes_Ano)) return false;
      if (filtroOcorrencia && r.tipo_norm !== filtroOcorrencia) return false;
      if (filtroSetor && r.setor_norm !== filtroSetor) return false;
      if (filtroLinha && r.linha_norm !== filtroLinha) return false;
      if (filtroControlabilidade && r.classificacao_norm !== filtroControlabilidade) return false;

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
  }, [
    dataset,
    busca,
    filtroOcorrencia,
    filtroSetor,
    filtroLinha,
    filtroControlabilidade,
    mesReferencia,
    mesComparacao,
  ]);

  const rowsReferencia = useMemo(
    () => datasetFiltrado.filter((r) => r.Mes_Ano === mesReferencia),
    [datasetFiltrado, mesReferencia]
  );

  const rowsComparacao = useMemo(
    () => datasetFiltrado.filter((r) => r.Mes_Ano === mesComparacao),
    [datasetFiltrado, mesComparacao]
  );

  const resumoAtual = useMemo(() => {
    const validas = rowsReferencia.filter((r) => r.valida_mkbf);
    const controlaveis = rowsReferencia.filter(
      (r) => r.classificacao_norm === "Controlável"
    );
    const naoControlaveis = rowsReferencia.filter(
      (r) => r.classificacao_norm === "Não Controlável"
    );
    const tempoMedio =
      rowsReferencia.length > 0
        ? rowsReferencia.reduce((acc, r) => acc + n(r.tempo_solucao_horas), 0) /
          rowsReferencia.length
        : 0;

    return {
      total: rowsReferencia.length,
      validas: validas.length,
      controlaveis: controlaveis.length,
      naoControlaveis: naoControlaveis.length,
      tempoMedio,
    };
  }, [rowsReferencia]);

  const resumoAnterior = useMemo(() => {
    const validas = rowsComparacao.filter((r) => r.valida_mkbf);
    const controlaveis = rowsComparacao.filter(
      (r) => r.classificacao_norm === "Controlável"
    );
    const naoControlaveis = rowsComparacao.filter(
      (r) => r.classificacao_norm === "Não Controlável"
    );
    const tempoMedio =
      rowsComparacao.length > 0
        ? rowsComparacao.reduce((acc, r) => acc + n(r.tempo_solucao_horas), 0) /
          rowsComparacao.length
        : 0;

    return {
      total: rowsComparacao.length,
      validas: validas.length,
      controlaveis: controlaveis.length,
      naoControlaveis: naoControlaveis.length,
      tempoMedio,
    };
  }, [rowsComparacao]);

  const cards = useMemo(() => {
    return [
      {
        title: "Total SOS",
        value: fmtInt(resumoAtual.total),
        aux: "Todas as intervenções do mês",
        icon: PAGE_ICON,
        badge: <EvolucaoBadge value={varPct(resumoAtual.total, resumoAnterior.total)} invert />,
      },
      {
        title: "Ocorrências válidas",
        value: fmtInt(resumoAtual.validas),
        aux: "Sem 'Seguiu Viagem'",
        icon: FaExclamationTriangle,
        badge: <EvolucaoBadge value={varPct(resumoAtual.validas, resumoAnterior.validas)} invert />,
      },
      {
        title: "Controláveis",
        value: fmtInt(resumoAtual.controlaveis),
        aux: "Classificação de tratativa",
        icon: FaWrench,
        badge: (
          <EvolucaoBadge
            value={varPct(resumoAtual.controlaveis, resumoAnterior.controlaveis)}
            invert
          />
        ),
      },
      {
        title: "Não Controláveis",
        value: fmtInt(resumoAtual.naoControlaveis),
        aux: "Classificação de tratativa",
        icon: FaLayerGroup,
        badge: (
          <EvolucaoBadge
            value={varPct(resumoAtual.naoControlaveis, resumoAnterior.naoControlaveis)}
            invert
          />
        ),
      },
      {
        title: "Tempo médio solução",
        value: fmtHoras(resumoAtual.tempoMedio),
        aux: "Da abertura ao fechamento",
        icon: FaSync,
        badge: (
          <EvolucaoBadge
            value={varPct(resumoAtual.tempoMedio, resumoAnterior.tempoMedio)}
            invert
          />
        ),
      },
    ];
  }, [resumoAtual, resumoAnterior]);

  const evolucaoDiaria = useMemo(() => {
    const map = new Map();

    rowsReferencia.forEach((r) => {
      const d = r.dataSOS;
      if (!d) return;
      if (!map.has(d)) {
        map.set(d, {
          data: d,
          dia: fmtDateBr(d).slice(0, 5),
          total: 0,
          controlavel: 0,
          naoControlavel: 0,
        });
      }
      const item = map.get(d);
      item.total += 1;
      if (r.classificacao_norm === "Controlável") item.controlavel += 1;
      if (r.classificacao_norm === "Não Controlável") item.naoControlavel += 1;
    });

    return [...map.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [rowsReferencia]);

  const comparativoOcorrencias = useMemo(() => {
    const tipos = [...new Set(OCORRENCIAS_VALIDAS)];

    return tipos.map((tipo) => {
      const atual = rowsReferencia.filter((r) => r.tipo_norm === tipo).length;
      const anterior = rowsComparacao.filter((r) => r.tipo_norm === tipo).length;
      return {
        tipo,
        anterior,
        atual,
        variacao: varPct(atual, anterior),
      };
    });
  }, [rowsReferencia, rowsComparacao]);

  const rankingLinhas = useMemo(() => {
    const map = new Map();

    rowsReferencia
      .filter((r) => r.valida_mkbf)
      .forEach((r) => {
        const key = r.linha_norm;
        if (!map.has(key)) {
          map.set(key, {
            linha: key,
            total: 0,
            controlavel: 0,
            naoControlavel: 0,
            topDefeitoMap: new Map(),
          });
        }
        const item = map.get(key);
        item.total += 1;
        if (r.classificacao_norm === "Controlável") item.controlavel += 1;
        if (r.classificacao_norm === "Não Controlável") item.naoControlavel += 1;
        item.topDefeitoMap.set(
          r.defeito_norm,
          n(item.topDefeitoMap.get(r.defeito_norm)) + 1
        );
      });

    return [...map.values()]
      .map((x) => {
        let topDefeito = "N/D";
        let topQtd = 0;
        x.topDefeitoMap.forEach((v, k) => {
          if (v > topQtd) {
            topQtd = v;
            topDefeito = k;
          }
        });
        return {
          linha: x.linha,
          total: x.total,
          controlavel: x.controlavel,
          naoControlavel: x.naoControlavel,
          topDefeito,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rowsReferencia]);

  const rankingVeiculos = useMemo(() => {
    const map = new Map();

    rowsReferencia
      .filter((r) => r.valida_mkbf)
      .forEach((r) => {
        const key = r.veiculo_norm;
        if (!map.has(key)) {
          map.set(key, {
            veiculo: key,
            linhaSet: new Set(),
            total: 0,
            controlavel: 0,
            naoControlavel: 0,
            topDefeitoMap: new Map(),
            topSetorMap: new Map(),
          });
        }
        const item = map.get(key);
        item.total += 1;
        item.linhaSet.add(r.linha_norm);
        if (r.classificacao_norm === "Controlável") item.controlavel += 1;
        if (r.classificacao_norm === "Não Controlável") item.naoControlavel += 1;
        item.topDefeitoMap.set(
          r.defeito_norm,
          n(item.topDefeitoMap.get(r.defeito_norm)) + 1
        );
        item.topSetorMap.set(
          r.setor_norm,
          n(item.topSetorMap.get(r.setor_norm)) + 1
        );
      });

    return [...map.values()]
      .map((x) => {
        let topDefeito = "N/D";
        let topSetor = "N/D";
        let maxDefeito = 0;
        let maxSetor = 0;

        x.topDefeitoMap.forEach((v, k) => {
          if (v > maxDefeito) {
            maxDefeito = v;
            topDefeito = k;
          }
        });

        x.topSetorMap.forEach((v, k) => {
          if (v > maxSetor) {
            maxSetor = v;
            topSetor = k;
          }
        });

        return {
          veiculo: x.veiculo,
          linhas: [...x.linhaSet].join(", "),
          total: x.total,
          controlavel: x.controlavel,
          naoControlavel: x.naoControlavel,
          topDefeito,
          topSetor,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rowsReferencia]);

  const rankingProblemas = useMemo(() => {
    const map = new Map();

    rowsReferencia
      .filter((r) => r.valida_mkbf)
      .forEach((r) => {
        const key = r.defeito_norm;
        if (!map.has(key)) {
          map.set(key, {
            defeito: key,
            total: 0,
            setorSet: new Set(),
            linhasSet: new Set(),
          });
        }
        const item = map.get(key);
        item.total += 1;
        item.setorSet.add(r.setor_norm);
        item.linhasSet.add(r.linha_norm);
      });

    return [...map.values()]
      .map((x) => ({
        defeito: x.defeito,
        total: x.total,
        setores: [...x.setorSet].join(", "),
        linhas: [...x.linhasSet].slice(0, 4).join(", "),
      }))
      .sort((a, b) => b.total - a.total);
  }, [rowsReferencia]);

  const rankingSetores = useMemo(() => {
    const map = new Map();

    rowsReferencia
      .filter((r) => r.valida_mkbf)
      .forEach((r) => {
        const key = r.setor_norm;
        if (!map.has(key)) {
          map.set(key, {
            setor: key,
            total: 0,
            topDefeitoMap: new Map(),
          });
        }
        const item = map.get(key);
        item.total += 1;
        item.topDefeitoMap.set(
          r.defeito_norm,
          n(item.topDefeitoMap.get(r.defeito_norm)) + 1
        );
      });

    return [...map.values()]
      .map((x) => {
        let topDefeito = "N/D";
        let topQtd = 0;
        x.topDefeitoMap.forEach((v, k) => {
          if (v > topQtd) {
            topQtd = v;
            topDefeito = k;
          }
        });
        return {
          setor: x.setor,
          total: x.total,
          topDefeito,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [rowsReferencia]);

  const reincidentes = useMemo(() => {
    return rankingVeiculos.filter((r) => r.total > 2).slice(0, 10);
  }, [rankingVeiculos]);

  const getGeralExport = () => {
    return rowsReferencia.map((r) => ({
      Número: r.numero_sos,
      Data: fmtDateBr(r.dataSOS),
      Prefixo: r.veiculo_norm,
      Linha: r.linha_norm,
      Motorista: r.motorista_nome || "",
      Ocorrência: r.tipo_norm,
      Setor: r.setor_norm,
      Grupo: r.grupo_manutencao || "",
      Problema: r.defeito_norm,
      Classificação: r.classificacao_norm,
      Solucionador: r.solucionador || "",
      "Tempo Solução (h)": fmtNum(r.tempo_solucao_horas, 2),
    }));
  };

  const getLinhasExport = () =>
    rankingLinhas.map((r) => ({
      Linha: r.linha,
      Total: r.total,
      Controlável: r.controlavel,
      "Não Controlável": r.naoControlavel,
      "Top Defeito": r.topDefeito,
    }));

  const getVeiculosExport = () =>
    rankingVeiculos.map((r) => ({
      Veículo: r.veiculo,
      Linhas: r.linhas,
      Total: r.total,
      Controlável: r.controlavel,
      "Não Controlável": r.naoControlavel,
      "Top Defeito": r.topDefeito,
      "Top Setor": r.topSetor,
    }));

  const getProblemasExport = () =>
    rankingProblemas.map((r) => ({
      Problema: r.defeito,
      Total: r.total,
      Setores: r.setores,
      Linhas: r.linhas,
    }));

  const getSetoresExport = () =>
    rankingSetores.map((r) => ({
      Setor: r.setor,
      Total: r.total,
      "Top Defeito": r.topDefeito,
    }));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
              <PAGE_ICON /> Resumo SOS
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">
              SOSResumo
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Painel analítico de intervenções com metodologia do flash report de manutenção.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (abaAtiva === "GERAL") exportarParaExcel(getGeralExport(), "SOSResumo_Geral");
                if (abaAtiva === "LINHAS") exportarParaExcel(getLinhasExport(), "SOSResumo_Linhas");
                if (abaAtiva === "VEICULOS") exportarParaExcel(getVeiculosExport(), "SOSResumo_Veiculos");
                if (abaAtiva === "PROBLEMAS") exportarParaExcel(getProblemasExport(), "SOSResumo_Problemas");
                if (abaAtiva === "SETORES") exportarParaExcel(getSetoresExport(), "SOSResumo_Setores");
              }}
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
            <h3 className="font-bold text-base mb-2">Como o SOSResumo calcula</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Ocorrência válida:</strong> entra no resumo técnico quando não é
                <strong> Seguiu Viagem</strong>.
              </li>
              <li>
                <strong>Comparativo mensal:</strong> compara o mês de referência com o mês anterior.
              </li>
              <li>
                <strong>Evolução diária:</strong> consolida o volume de SOS por dia do mês.
              </li>
              <li>
                <strong>Linhas, veículos, defeitos e setores:</strong> todos os rankings são
                consolidados em cima do mês de referência.
              </li>
              <li>
                <strong>Controlável x Não Controlável:</strong> usa diretamente o campo
                <strong> classificacao_controlabilidade</strong>.
              </li>
              <li>
                <strong>Tempo médio de solução:</strong> aproxima pela diferença entre abertura
                (`data_sos/hora_sos`) e fechamento (`data_encerramento` ou `data_fechamento`).
              </li>
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
                placeholder="Número, prefixo, motorista, linha, setor, problema..."
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
                  {m}
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
              {OCORRENCIAS_VALIDAS.map((o) => (
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

          <div>
            <label className="text-xs font-bold text-slate-500">Classificação</label>
            <select
              value={filtroControlabilidade}
              onChange={(e) => setFiltroControlabilidade(e.target.value)}
              className="mt-1 w-full border rounded-xl px-3 py-2.5 text-sm"
            >
              <option value="">Todas</option>
              <option value="Controlável">Controlável</option>
              <option value="Não Controlável">Não Controlável</option>
            </select>
          </div>
        </div>
      </div>

      {erro ? (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-2xl p-4">
          {erro}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <CardKPI key={card.title} {...card} />
        ))}
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-2">
        <div className="flex flex-wrap gap-2">
          {[
            ["GERAL", "Visão Geral"],
            ["LINHAS", "Ranking Linhas"],
            ["VEICULOS", "Ranking Veículos"],
            ["PROBLEMAS", "Ranking Problemas"],
            ["SETORES", "Ranking Setores"],
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

      {!loading && abaAtiva === "GERAL" && (
        <div className="space-y-6">
          <TableCard title="Evolução diária das intervenções">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucaoDiaria}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dia" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Total" strokeWidth={3} />
                  <Line type="monotone" dataKey="controlavel" name="Controlável" strokeWidth={2} />
                  <Line type="monotone" dataKey="naoControlavel" name="Não Controlável" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </TableCard>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TableCard title="Comparativo por ocorrência">
              <div className="space-y-3">
                {comparativoOcorrencias.map((r) => (
                  <div
                    key={r.tipo}
                    className="flex items-center justify-between p-3 rounded-xl border bg-slate-50"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{r.tipo}</div>
                      <div className="text-xs text-slate-500">
                        Anterior: {fmtInt(r.anterior)} • Atual: {fmtInt(r.atual)}
                      </div>
                    </div>
                    <EvolucaoBadge value={r.variacao} invert />
                  </div>
                ))}
              </div>
            </TableCard>

            <TableCard title="Top veículos reincidentes">
              <div className="space-y-3">
                {reincidentes.length === 0 ? (
                  <div className="text-sm text-slate-500">Nenhum veículo com mais de 2 SOS no mês.</div>
                ) : (
                  reincidentes.map((r) => (
                    <div
                      key={r.veiculo}
                      className="flex items-center justify-between p-3 rounded-xl border bg-slate-50"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{r.veiculo}</div>
                        <div className="text-xs text-slate-500">
                          Linhas: {r.linhas || "—"} • Top defeito: {r.topDefeito}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-slate-800">{fmtInt(r.total)}</div>
                        <div className="text-xs text-slate-500">intervenções</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TableCard>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <TableCard title="Top 10 linhas">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingLinhas.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="linha" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="SOS" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TableCard>

            <TableCard title="Top 10 setores">
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingSetores.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="setor" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="total" name="SOS" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TableCard>
          </div>
        </div>
      )}

      {!loading && abaAtiva === "LINHAS" && (
        <TableCard title="Ranking de Linhas" right={<span className="text-xs text-slate-500">{fmtInt(rankingLinhas.length)} linhas</span>}>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Linha</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Controlável</th>
                  <th className="text-right px-3 py-2">Não Controlável</th>
                  <th className="text-left px-3 py-2">Top Defeito</th>
                </tr>
              </thead>
              <tbody>
                {rankingLinhas.map((r) => (
                  <tr key={r.linha} className="border-t">
                    <td className="px-3 py-2 font-bold">{r.linha}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.total)}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.controlavel)}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.naoControlavel)}</td>
                    <td className="px-3 py-2">{r.topDefeito}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      )}

      {!loading && abaAtiva === "VEICULOS" && (
        <TableCard title="Ranking de Veículos" right={<span className="text-xs text-slate-500">{fmtInt(rankingVeiculos.length)} veículos</span>}>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Veículo</th>
                  <th className="text-left px-3 py-2">Linhas</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-right px-3 py-2">Controlável</th>
                  <th className="text-right px-3 py-2">Não Controlável</th>
                  <th className="text-left px-3 py-2">Top Defeito</th>
                  <th className="text-left px-3 py-2">Top Setor</th>
                </tr>
              </thead>
              <tbody>
                {rankingVeiculos.map((r) => (
                  <tr key={r.veiculo} className="border-t">
                    <td className="px-3 py-2 font-bold">{r.veiculo}</td>
                    <td className="px-3 py-2">{r.linhas}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.total)}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.controlavel)}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.naoControlavel)}</td>
                    <td className="px-3 py-2">{r.topDefeito}</td>
                    <td className="px-3 py-2">{r.topSetor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      )}

      {!loading && abaAtiva === "PROBLEMAS" && (
        <TableCard title="Ranking de Problemas" right={<span className="text-xs text-slate-500">{fmtInt(rankingProblemas.length)} problemas</span>}>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Problema</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Setores</th>
                  <th className="text-left px-3 py-2">Linhas</th>
                </tr>
              </thead>
              <tbody>
                {rankingProblemas.map((r) => (
                  <tr key={r.defeito} className="border-t">
                    <td className="px-3 py-2 font-bold">{r.defeito}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.total)}</td>
                    <td className="px-3 py-2">{r.setores}</td>
                    <td className="px-3 py-2">{r.linhas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      )}

      {!loading && abaAtiva === "SETORES" && (
        <TableCard title="Ranking de Setores" right={<span className="text-xs text-slate-500">{fmtInt(rankingSetores.length)} setores</span>}>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2">Setor</th>
                  <th className="text-right px-3 py-2">Total</th>
                  <th className="text-left px-3 py-2">Top Defeito</th>
                </tr>
              </thead>
              <tbody>
                {rankingSetores.map((r) => (
                  <tr key={r.setor} className="border-t">
                    <td className="px-3 py-2 font-bold">{r.setor}</td>
                    <td className="px-3 py-2 text-right">{fmtInt(r.total)}</td>
                    <td className="px-3 py-2">{r.topDefeito}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      )}
    </div>
  );
}
