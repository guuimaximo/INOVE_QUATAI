import React, { useEffect, useMemo, useState } from "react";
import {
  FaBolt,
  FaSync,
  FaFilePdf,
  FaFilter,
  FaSearch,
  FaRoad,
  FaTruck,
  FaUser,
  FaClipboardList,
  FaCalendarAlt,
  FaDatabase,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaChartLine,
  FaArrowUp,
  FaArrowDown,
  FaEquals,
} from "react-icons/fa";
import { supabase } from "../supabase";

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function getPublicUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const base = import.meta.env.VITE_SUPABASE_URL;
  const bucket = "relatorios";
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${base}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

function normalizar(v) {
  return String(v || "").trim().toUpperCase();
}

function fmtDateBr(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

function getDateOnly(v) {
  if (!v) return "";
  try {
    return String(v).split("T")[0].split(" ")[0];
  } catch {
    return "";
  }
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

function CardResumo({ titulo, valor, subtitulo, icon: Icon, destaque = "slate" }) {
  const mapa = {
    slate: "bg-slate-50 border-slate-200 text-slate-800",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    cyan: "bg-cyan-50 border-cyan-200 text-cyan-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
  };

  return (
    <div className={clsx("rounded-2xl border p-4 shadow-sm", mapa[destaque] || mapa.slate)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">{titulo}</p>
          <p className="text-2xl font-black mt-1">{valor}</p>
          {subtitulo ? <p className="text-xs mt-1 opacity-80">{subtitulo}</p> : null}
        </div>
        {Icon ? (
          <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center border">
            <Icon size={16} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BlocoSecao({ titulo, subtitulo, icon: Icon, children, right }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-slate-50 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {Icon ? <Icon className="text-slate-600" /> : null}
            <h3 className="text-base font-extrabold text-slate-800">{titulo}</h3>
          </div>
          {subtitulo ? <p className="text-xs text-slate-500 mt-1">{subtitulo}</p> : null}
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TabelaPadrao({ columns, rows, emptyText = "Sem dados disponíveis" }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="bg-white border-b text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "px-4 py-3 font-extrabold whitespace-nowrap",
                  col.align === "right" ? "text-right" : "text-left"
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx(
                      "px-4 py-3 whitespace-nowrap",
                      col.align === "right" ? "text-right" : "text-left",
                      col.className
                    )}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function DesempenhoDieselAnalise() {
  const [loading, setLoading] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [acompanhamentos, setAcompanhamentos] = useState([]);

  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroCheckpoint, setFiltroCheckpoint] = useState("");
  const [filtroInstrutor, setFiltroInstrutor] = useState("");
  const [filtroDataAcompIni, setFiltroDataAcompIni] = useState("");
  const [filtroDataAcompFim, setFiltroDataAcompFim] = useState("");
  const [abaInterna, setAbaInterna] = useState("linhas");

  async function carregar() {
    setLoading(true);
    try {
      const { data: ult } = await supabase
        .from("diesel_analise_gerencial_snapshot")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: hist } = await supabase
        .from("diesel_analise_gerencial_snapshot")
        .select("id, report_id, periodo_label, mes_atual_nome, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: acomp } = await supabase
        .from("diesel_acompanhamentos")
        .select(
          `
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
            motivo
          `
        )
        .order("created_at", { ascending: false })
        .limit(2000);

      setSnapshot(ult || null);
      setHistorico(hist || []);
      setAcompanhamentos(acomp || []);
    } catch (e) {
      alert("Erro ao carregar análise: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const linhas = useMemo(() => {
    const base = snapshot?.tabela_linhas || [];
    return [...new Set(base.map((r) => normalizar(r.linha)).filter(Boolean))].sort();
  }, [snapshot]);

  const clusters = useMemo(() => {
    const base = [
      ...(snapshot?.top_veiculos || []),
      ...(snapshot?.top_motoristas || []),
    ];
    return [...new Set(base.map((r) => normalizar(r.Cluster)).filter(Boolean))].sort();
  }, [snapshot]);

  const instrutores = useMemo(() => {
    return [
      ...new Set(
        (acompanhamentos || [])
          .map((r) => String(r.instrutor_nome || "").trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [acompanhamentos]);

  const tabelaLinhasFiltrada = useMemo(() => {
    let rows = [...(snapshot?.tabela_linhas || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha) === filtroLinha);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter((r) => String(r.linha || "").toLowerCase().includes(q));
    }

    return rows;
  }, [snapshot, filtroLinha, busca]);

  const topVeiculosFiltrado = useMemo(() => {
    let rows = [...(snapshot?.top_veiculos || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha) === filtroLinha);
    }

    if (filtroCluster) {
      rows = rows.filter((r) => normalizar(r.Cluster) === filtroCluster);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          String(r.veiculo || "").toLowerCase().includes(q) ||
          String(r.linha || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [snapshot, filtroLinha, filtroCluster, busca]);

  const topMotoristasFiltrado = useMemo(() => {
    let rows = [...(snapshot?.top_motoristas || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha) === filtroLinha);
    }

    if (filtroCluster) {
      rows = rows.filter((r) => normalizar(r.Cluster) === filtroCluster);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          String(r.Motorista || "").toLowerCase().includes(q) ||
          String(r.linha || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [snapshot, filtroLinha, filtroCluster, busca]);

  const checkpointTabelaFiltrada = useMemo(() => {
    let rows = [...(snapshot?.checkpoint_tabela || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha_foco) === filtroLinha);
    }

    if (filtroCheckpoint) {
      rows = rows.filter((r) => normalizar(r.tipo) === filtroCheckpoint);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          String(r.motorista_nome || "").toLowerCase().includes(q) ||
          String(r.motorista_chapa || "").toLowerCase().includes(q) ||
          String(r.linha_foco || "").toLowerCase().includes(q)
      );
    }

    return rows;
  }, [snapshot, filtroLinha, filtroCheckpoint, busca]);

  const acompanhamentosFiltrados = useMemo(() => {
    let rows = [...(acompanhamentos || [])];

    if (filtroLinha) {
      rows = rows.filter((r) => normalizar(r.linha_foco) === filtroLinha);
    }

    if (filtroInstrutor) {
      rows = rows.filter((r) => String(r.instrutor_nome || "").trim() === filtroInstrutor);
    }

    if (filtroDataAcompIni) {
      rows = rows.filter((r) => {
        const d = getDateOnly(r.dt_inicio_monitoramento || r.created_at);
        return d && d >= filtroDataAcompIni;
      });
    }

    if (filtroDataAcompFim) {
      rows = rows.filter((r) => {
        const d = getDateOnly(r.dt_inicio_monitoramento || r.created_at);
        return d && d <= filtroDataAcompFim;
      });
    }

    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          String(r.motorista_nome || "").toLowerCase().includes(q) ||
          String(r.motorista_chapa || "").toLowerCase().includes(q) ||
          String(r.linha_foco || "").toLowerCase().includes(q) ||
          String(r.instrutor_nome || "").toLowerCase().includes(q)
      );
    }

    return rows.map((r) => {
      const iniMin = parseHoraToMin(r.intervencao_hora_inicio);
      const fimMin = parseHoraToMin(r.intervencao_hora_fim);
      const duracaoMin =
        iniMin != null && fimMin != null && fimMin >= iniMin ? fimMin - iniMin : 0;

      return {
        ...r,
        data_ref: getDateOnly(r.dt_inicio_monitoramento || r.created_at),
        duracao_min: duracaoMin,
      };
    });
  }, [
    acompanhamentos,
    filtroLinha,
    filtroInstrutor,
    filtroDataAcompIni,
    filtroDataAcompFim,
    busca,
  ]);

  const resumoInstrutor = useMemo(() => {
    const map = new Map();

    acompanhamentosFiltrados.forEach((r) => {
      const key = String(r.instrutor_nome || "Sem instrutor").trim() || "Sem instrutor";

      if (!map.has(key)) {
        map.set(key, {
          instrutor_nome: key,
          total_acompanhamentos: 0,
          total_minutos: 0,
          media_minutos: 0,
          em_monitoramento: 0,
          em_analise: 0,
          concluidos: 0,
          linhas: new Set(),
        });
      }

      const item = map.get(key);
      item.total_acompanhamentos += 1;
      item.total_minutos += n(r.duracao_min);
      if (normalizar(r.status) === "EM_MONITORAMENTO") item.em_monitoramento += 1;
      if (normalizar(r.status) === "EM_ANALISE") item.em_analise += 1;
      if (["OK", "ENCERRADO", "ATAS"].includes(normalizar(r.status))) item.concluidos += 1;
      if (r.linha_foco) item.linhas.add(r.linha_foco);
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
      const data = r.data_ref || "Sem data";
      const instrutor = String(r.instrutor_nome || "Sem instrutor").trim() || "Sem instrutor";
      const key = `${data}__${instrutor}`;

      if (!map.has(key)) {
        map.set(key, {
          data_ref: data,
          instrutor_nome: instrutor,
          total_acompanhamentos: 0,
          total_minutos: 0,
          media_minutos: 0,
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
        if (a.data_ref === b.data_ref) {
          return a.instrutor_nome.localeCompare(b.instrutor_nome, "pt-BR");
        }
        return String(b.data_ref).localeCompare(String(a.data_ref));
      });
  }, [acompanhamentosFiltrados]);

  const checkpointResumo = useMemo(() => {
    const rows = checkpointTabelaFiltrada || [];

    const melhoraramKml = rows.filter((r) => n(r.delta_kml) > 0).length;
    const pioraramKml = rows.filter((r) => n(r.delta_kml) < 0).length;
    const estavelKml = rows.filter((r) => n(r.delta_kml) === 0).length;

    const reduziramDesperdicio = rows.filter((r) => n(r.delta_desperdicio) < 0).length;
    const aumentaramDesperdicio = rows.filter((r) => n(r.delta_desperdicio) > 0).length;
    const estavelDesperdicio = rows.filter((r) => n(r.delta_desperdicio) === 0).length;

    const mediaDeltaKml =
      rows.length > 0
        ? rows.reduce((acc, r) => acc + n(r.delta_kml), 0) / rows.length
        : 0;

    const mediaDeltaDesp =
      rows.length > 0
        ? rows.reduce((acc, r) => acc + n(r.delta_desperdicio), 0) / rows.length
        : 0;

    return {
      total: rows.length,
      melhoraramKml,
      pioraramKml,
      estavelKml,
      reduziramDesperdicio,
      aumentaramDesperdicio,
      estavelDesperdicio,
      mediaDeltaKml,
      mediaDeltaDesp,
    };
  }, [checkpointTabelaFiltrada]);

  const resumo = snapshot?.resumo || {};
  const cobertura = resumo?.cobertura || {};
  const instrutorKpis = resumo?.instrutor_kpis || {};
  const checkpointKpis = snapshot?.checkpoint_kpis || resumo?.checkpoint_kpis || {};
  const pdfUrl = getPublicUrl(snapshot?.arquivo_pdf_path);

  const totalMinutosAcompanhamentos = useMemo(
    () => acompanhamentosFiltrados.reduce((acc, r) => acc + n(r.duracao_min), 0),
    [acompanhamentosFiltrados]
  );

  const mediaMinutosAcompanhamentos = useMemo(
    () =>
      acompanhamentosFiltrados.length
        ? totalMinutosAcompanhamentos / acompanhamentosFiltrados.length
        : 0,
    [acompanhamentosFiltrados, totalMinutosAcompanhamentos]
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-slate-900 text-white">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center border border-white/10">
                <FaBolt size={20} />
              </div>
              <div>
                <h2 className="text-2xl font-black">Análise Gerencial Diesel</h2>
                <p className="text-sm text-slate-300">
                  Painel analítico consolidado da última geração do relatório
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm inline-flex items-center gap-2"
                >
                  <FaFilePdf /> Abrir PDF
                </a>
              )}

              <button
                onClick={carregar}
                className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center"
                title="Atualizar"
              >
                <FaSync className={clsx(loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t flex flex-wrap items-center gap-3 text-sm">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border">
            <FaCalendarAlt className="text-slate-500" />
            <span className="text-slate-500 font-bold">Período:</span>
            <span className="font-extrabold text-slate-800">{snapshot?.periodo_label || "-"}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border">
            <FaDatabase className="text-slate-500" />
            <span className="text-slate-500 font-bold">Mês ref.:</span>
            <span className="font-extrabold text-slate-800">{snapshot?.mes_atual_nome || "-"}</span>
          </div>

          <div
            className={clsx(
              "inline-flex items-center gap-2 px-3 py-2 rounded-xl border",
              snapshot
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            )}
          >
            {snapshot ? <FaCheckCircle /> : <FaExclamationTriangle />}
            <span className="font-bold">{snapshot ? "Snapshot carregado" : "Sem snapshot disponível"}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="relative md:col-span-2">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar linha, veículo, motorista, chapa ou instrutor..."
              className="pl-9 pr-3 py-2.5 border rounded-xl w-full text-sm outline-none"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaFilter className="text-slate-400 ml-2" />
            <select
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todas as linhas</option>
              {linhas.map((ln) => (
                <option key={ln} value={ln}>
                  {ln}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaFilter className="text-slate-400 ml-2" />
            <select
              value={filtroCluster}
              onChange={(e) => setFiltroCluster(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todos os clusters</option>
              {clusters.map((cl) => (
                <option key={cl} value={cl}>
                  {cl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaClipboardList className="text-slate-400 ml-2" />
            <select
              value={filtroCheckpoint}
              onChange={(e) => setFiltroCheckpoint(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todos checkpoints</option>
              <option value="PRONTUARIO_10">PRONTUÁRIO 10</option>
              <option value="PRONTUARIO_20">PRONTUÁRIO 20</option>
              <option value="PRONTUARIO_30">PRONTUÁRIO 30</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
            <FaUser className="text-slate-400 ml-2" />
            <select
              value={filtroInstrutor}
              onChange={(e) => setFiltroInstrutor(e.target.value)}
              className="p-2.5 bg-transparent text-sm outline-none w-full"
            >
              <option value="">Todos os instrutores</option>
              {instrutores.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2 flex gap-3">
            <input
              type="date"
              value={filtroDataAcompIni}
              onChange={(e) => setFiltroDataAcompIni(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
            <input
              type="date"
              value={filtroDataAcompFim}
              onChange={(e) => setFiltroDataAcompFim(e.target.value)}
              className="w-full border rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          <div className="md:col-span-4 flex flex-wrap gap-2">
            {[
              { key: "linhas", label: "Análise de Linhas" },
              { key: "motoristas", label: "Ranking de Motoristas" },
              { key: "carros", label: "Ranking de Carros" },
              { key: "acompanhamentos", label: "Acompanhamentos" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setAbaInterna(tab.key)}
                className={clsx(
                  "px-4 py-2.5 rounded-xl text-sm font-extrabold transition-colors",
                  abaInterna === tab.key
                    ? "bg-slate-900 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardResumo
          titulo="Cobertura"
          valor={n(cobertura.perc_cobertura || cobertura.percentual || 0).toFixed(1) + "%"}
          subtitulo="Cobertura geral do relatório"
          icon={FaChartLine}
          destaque="cyan"
        />
        <CardResumo
          titulo="Checkpoints"
          valor={n(checkpointKpis.total || snapshot?.checkpoint_tabela?.length || 0).toFixed(0)}
          subtitulo="Total de checkpoints"
          icon={FaClipboardList}
          destaque="violet"
        />
        <CardResumo
          titulo="Acompanhamentos"
          valor={n(acompanhamentosFiltrados.length).toFixed(0)}
          subtitulo="Base filtrada de acompanhamentos"
          icon={FaRoad}
          destaque="amber"
        />
        <CardResumo
          titulo="Tempo total"
          valor={formatMinutes(totalMinutosAcompanhamentos)}
          subtitulo={`Média: ${formatMinutes(mediaMinutosAcompanhamentos)}`}
          icon={FaClock}
          destaque="emerald"
        />
      </div>

      {abaInterna === "linhas" && (
        <BlocoSecao
          titulo="Análise de Linhas"
          subtitulo={`Total filtrado: ${tabelaLinhasFiltrada.length}`}
          icon={FaRoad}
        >
          <TabelaPadrao
            rows={tabelaLinhasFiltrada}
            columns={[
              { key: "linha", label: "Linha", render: (r) => <span className="font-extrabold">{r.linha}</span> },
              { key: "Cluster", label: "Cluster" },
              {
                key: "KM_Total",
                label: "KM",
                align: "right",
                render: (r) => n(r.KM_Total || r.km_total || r.KM).toFixed(0),
              },
              {
                key: "KML_Real",
                label: "KML Real",
                align: "right",
                render: (r) => n(r.KML_Real || r.kml_real).toFixed(2),
              },
              {
                key: "Meta_Linha",
                label: "Meta",
                align: "right",
                render: (r) => n(r.Meta_Linha || r.kml_meta).toFixed(2),
              },
              {
                key: "Litros_Desp_Meta",
                label: "Desp.",
                align: "right",
                className: "font-extrabold text-rose-700",
                render: (r) => n(r.Litros_Desp_Meta || r.desperdicio || r.perda_litros).toFixed(0),
              },
            ]}
          />
        </BlocoSecao>
      )}

      {abaInterna === "motoristas" && (
        <BlocoSecao
          titulo="Ranking de Motoristas"
          subtitulo={`Total filtrado: ${topMotoristasFiltrado.length}`}
          icon={FaUser}
        >
          <TabelaPadrao
            rows={topMotoristasFiltrado}
            columns={[
              { key: "Motorista", label: "Motorista", render: (r) => <span className="font-extrabold">{r.Motorista}</span> },
              { key: "Cluster", label: "Cluster" },
              { key: "linha", label: "Linha" },
              { key: "KML_Real", label: "KML", align: "right", render: (r) => n(r.KML_Real).toFixed(2) },
              { key: "Meta_Linha", label: "Meta", align: "right", render: (r) => n(r.Meta_Linha).toFixed(2) },
              {
                key: "Litros_Desp_Meta",
                label: "Desp.",
                align: "right",
                className: "font-extrabold text-rose-700",
                render: (r) => n(r.Litros_Desp_Meta).toFixed(0),
              },
            ]}
          />
        </BlocoSecao>
      )}

      {abaInterna === "carros" && (
        <BlocoSecao
          titulo="Ranking de Carros"
          subtitulo={`Total filtrado: ${topVeiculosFiltrado.length}`}
          icon={FaTruck}
        >
          <TabelaPadrao
            rows={topVeiculosFiltrado}
            columns={[
              { key: "veiculo", label: "Carro", render: (r) => <span className="font-extrabold">{r.veiculo}</span> },
              { key: "Cluster", label: "Cluster" },
              { key: "linha", label: "Linha" },
              { key: "KML_Real", label: "KML", align: "right", render: (r) => n(r.KML_Real).toFixed(2) },
              { key: "Meta_Linha", label: "Meta", align: "right", render: (r) => n(r.Meta_Linha).toFixed(2) },
              {
                key: "Litros_Desp_Meta",
                label: "Desp.",
                align: "right",
                className: "font-extrabold text-rose-700",
                render: (r) => n(r.Litros_Desp_Meta).toFixed(0),
              },
            ]}
          />
        </BlocoSecao>
      )}

      {abaInterna === "acompanhamentos" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
            <CardResumo
              titulo="Melhoraram KM/L"
              valor={String(checkpointResumo.melhoraramKml)}
              subtitulo="Δ KML maior que zero"
              icon={FaArrowUp}
              destaque="emerald"
            />
            <CardResumo
              titulo="Pioraram KM/L"
              valor={String(checkpointResumo.pioraramKml)}
              subtitulo="Δ KML menor que zero"
              icon={FaArrowDown}
              destaque="rose"
            />
            <CardResumo
              titulo="Estáveis KM/L"
              valor={String(checkpointResumo.estavelKml)}
              subtitulo="Δ KML igual a zero"
              icon={FaEquals}
              destaque="slate"
            />
            <CardResumo
              titulo="Reduziram desperdício"
              valor={String(checkpointResumo.reduziramDesperdicio)}
              subtitulo="Δ Desp. menor que zero"
              icon={FaArrowDown}
              destaque="emerald"
            />
            <CardResumo
              titulo="Aumentaram desperdício"
              valor={String(checkpointResumo.aumentaramDesperdicio)}
              subtitulo="Δ Desp. maior que zero"
              icon={FaArrowUp}
              destaque="rose"
            />
            <CardResumo
              titulo="Média Δ KML"
              valor={checkpointResumo.mediaDeltaKml.toFixed(2)}
              subtitulo={`Média Δ Desp.: ${checkpointResumo.mediaDeltaDesp.toFixed(1)} L`}
              icon={FaChartLine}
              destaque="violet"
            />
          </div>

          <BlocoSecao
            titulo="Checkpoints"
            subtitulo={`Total: ${snapshot?.checkpoint_tabela?.length || 0} | Filtrados: ${checkpointTabelaFiltrada.length}`}
            icon={FaClipboardList}
          >
            <TabelaPadrao
              rows={checkpointTabelaFiltrada}
              columns={[
                { key: "created_at_dt", label: "Data", render: (r) => String(r.created_at_dt || "").slice(0, 10) },
                { key: "tipo", label: "Tipo", render: (r) => <span className="font-extrabold">{r.tipo}</span> },
                {
                  key: "motorista_nome",
                  label: "Motorista",
                  render: (r) => (
                    <span>
                      {r.motorista_nome} <span className="text-slate-400">({r.motorista_chapa})</span>
                    </span>
                  ),
                },
                { key: "linha_foco", label: "Linha" },
                {
                  key: "kml_antes",
                  label: "KM/L Antes",
                  align: "right",
                  render: (r) =>
                    n(
                      r.kml_antes ??
                        r.kml_real_antes ??
                        r.kml_pre ??
                        r.kml_anterior ??
                        r.kml_base
                    ).toFixed(2),
                },
                {
                  key: "kml_depois",
                  label: "KM/L Após",
                  align: "right",
                  render: (r) =>
                    n(
                      r.kml_depois ??
                        r.kml_real_depois ??
                        r.kml_pos ??
                        r.kml_atual ??
                        r.kml_final
                    ).toFixed(2),
                },
                {
                  key: "delta_kml",
                  label: "Δ KML",
                  align: "right",
                  className: "font-extrabold",
                  render: (r) => {
                    const v = n(r.delta_kml);
                    return (
                      <span className={v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-slate-700"}>
                        {v > 0 ? "+" : ""}
                        {v.toFixed(2)}
                      </span>
                    );
                  },
                },
                {
                  key: "delta_desperdicio",
                  label: "Δ Desp.",
                  align: "right",
                  className: "font-extrabold",
                  render: (r) => {
                    const v = n(r.delta_desperdicio);
                    return (
                      <span className={v < 0 ? "text-emerald-700" : v > 0 ? "text-rose-700" : "text-slate-700"}>
                        {v > 0 ? "+" : ""}
                        {v.toFixed(1)}
                      </span>
                    );
                  },
                },
                { key: "conclusao", label: "Conclusão", render: (r) => <span className="font-bold">{r.conclusao}</span> },
              ]}
            />
          </BlocoSecao>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <CardResumo
              titulo="Instrutores"
              valor={n(resumoInstrutor.length).toFixed(0)}
              subtitulo="Total com atividade no filtro"
              icon={FaUser}
              destaque="cyan"
            />
            <CardResumo
              titulo="Tempo total"
              valor={formatMinutes(totalMinutosAcompanhamentos)}
              subtitulo="Tempo somado das intervenções"
              icon={FaClock}
              destaque="amber"
            />
            <CardResumo
              titulo="Média por acompanhamento"
              valor={formatMinutes(mediaMinutosAcompanhamentos)}
              subtitulo="Tempo médio por registro"
              icon={FaChartLine}
              destaque="violet"
            />
            <CardResumo
              titulo="KPI snapshot"
              valor={n(instrutorKpis.concluidos || 0).toFixed(0)}
              subtitulo="Concluídos no snapshot"
              icon={FaCheckCircle}
              destaque="emerald"
            />
          </div>

          <BlocoSecao
            titulo="Resumo por Instrutor"
            subtitulo={`Instrutores filtrados: ${resumoInstrutor.length}`}
            icon={FaUser}
          >
            <TabelaPadrao
              rows={resumoInstrutor}
              columns={[
                {
                  key: "instrutor_nome",
                  label: "Instrutor",
                  render: (r) => <span className="font-extrabold">{r.instrutor_nome}</span>,
                },
                {
                  key: "total_acompanhamentos",
                  label: "Acompanhamentos",
                  align: "right",
                  render: (r) => n(r.total_acompanhamentos).toFixed(0),
                },
                {
                  key: "total_minutos",
                  label: "Tempo Total",
                  align: "right",
                  render: (r) => formatMinutes(r.total_minutos),
                },
                {
                  key: "media_minutos",
                  label: "Média",
                  align: "right",
                  render: (r) => formatMinutes(r.media_minutos),
                },
                {
                  key: "em_monitoramento",
                  label: "Em Monitoramento",
                  align: "right",
                  render: (r) => n(r.em_monitoramento).toFixed(0),
                },
                {
                  key: "em_analise",
                  label: "Em Análise",
                  align: "right",
                  render: (r) => n(r.em_analise).toFixed(0),
                },
                {
                  key: "concluidos",
                  label: "Concluídos",
                  align: "right",
                  render: (r) => n(r.concluidos).toFixed(0),
                },
                {
                  key: "qtd_linhas",
                  label: "Linhas",
                  align: "right",
                  render: (r) => n(r.qtd_linhas).toFixed(0),
                },
              ]}
            />
          </BlocoSecao>

          <BlocoSecao
            titulo="Tempo por Dia"
            subtitulo={`Linhas diárias: ${tempoPorDia.length}`}
            icon={FaCalendarAlt}
          >
            <TabelaPadrao
              rows={tempoPorDia}
              columns={[
                { key: "data_ref", label: "Data", render: (r) => fmtDateBr(r.data_ref) },
                {
                  key: "instrutor_nome",
                  label: "Instrutor",
                  render: (r) => <span className="font-extrabold">{r.instrutor_nome}</span>,
                },
                {
                  key: "total_acompanhamentos",
                  label: "Qtd.",
                  align: "right",
                  render: (r) => n(r.total_acompanhamentos).toFixed(0),
                },
                {
                  key: "total_minutos",
                  label: "Tempo Total",
                  align: "right",
                  render: (r) => formatMinutes(r.total_minutos),
                },
                {
                  key: "media_minutos",
                  label: "Tempo Médio",
                  align: "right",
                  render: (r) => formatMinutes(r.media_minutos),
                },
              ]}
            />
          </BlocoSecao>

          <BlocoSecao
            titulo="Detalhamento dos Acompanhamentos"
            subtitulo={`Total filtrado: ${acompanhamentosFiltrados.length}`}
            icon={FaRoad}
          >
            <TabelaPadrao
              rows={acompanhamentosFiltrados}
              columns={[
                {
                  key: "data_ref",
                  label: "Data",
                  render: (r) => fmtDateBr(r.data_ref || r.created_at),
                },
                {
                  key: "instrutor_nome",
                  label: "Instrutor",
                  render: (r) => <span className="font-extrabold">{r.instrutor_nome || "-"}</span>,
                },
                {
                  key: "motorista_nome",
                  label: "Motorista",
                  render: (r) => (
                    <span>
                      {r.motorista_nome || "-"}{" "}
                      <span className="text-slate-400">({r.motorista_chapa || "-"})</span>
                    </span>
                  ),
                },
                { key: "linha_foco", label: "Linha", render: (r) => r.linha_foco || "-" },
                { key: "status", label: "Status", render: (r) => r.status || "-" },
                {
                  key: "duracao_min",
                  label: "Tempo",
                  align: "right",
                  render: (r) => formatMinutes(r.duracao_min),
                },
                {
                  key: "kml_inicial",
                  label: "KML Inicial",
                  align: "right",
                  render: (r) => n(r.kml_inicial).toFixed(2),
                },
                {
                  key: "teste_kml",
                  label: "Teste KML",
                  align: "right",
                  render: (r) => n(r.teste_kml).toFixed(2),
                },
                {
                  key: "kml_meta",
                  label: "Meta",
                  align: "right",
                  render: (r) => n(r.kml_meta).toFixed(2),
                },
              ]}
            />
          </BlocoSecao>
        </>
      )}

      <BlocoSecao
        titulo="Histórico de Snapshots"
        subtitulo="Últimas análises salvas no banco"
        icon={FaCalendarAlt}
      >
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {historico.length === 0 ? (
            <div className="text-sm text-slate-400">Sem histórico disponível.</div>
          ) : (
            historico.map((r) => (
              <div key={r.id} className="border rounded-2xl p-4 bg-slate-50">
                <div className="text-sm font-black text-slate-800">Relatório #{r.report_id}</div>
                <div className="text-xs text-slate-500 mt-2">{r.periodo_label || "-"}</div>
                <div className="text-xs text-slate-500">{r.mes_atual_nome || "-"}</div>
                <div className="text-xs text-slate-400 mt-2">{fmtDateBr(r.created_at)}</div>
              </div>
            ))
          )}
        </div>
      </BlocoSecao>
    </div>
  );
}
