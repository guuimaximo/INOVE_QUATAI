import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import {
  FaBolt,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlay,
  FaFilePdf,
  FaSync,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaInfoCircle,
  FaTimes,
  FaChartLine,
  FaListAlt,
  FaFilter,
  FaSearch,
} from "react-icons/fa";
import { supabase } from "../../supabase";

// =============================================================================
// CONFIGURAÇÕES E ENV
// =============================================================================
const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";

const WF_GERENCIAL = "relatorio_gerencial.yml";
const WF_ACOMP = "ordem-acompanhamento.yml";

const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET_NAME = "relatorios";

// =============================================================================
// HELPERS
// =============================================================================
function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function fmtDateInput(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPublicUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;
  return `${SUPABASE_BASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${cleanPath}`;
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function normalizarLinha(v) {
  return String(v || "").trim().toUpperCase();
}

async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) throw new Error("Credenciais GitHub ausentes.");
  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: GH_REF, inputs }),
  });

  if (response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Erro GitHub: ${response.status}`);
  }
  return true;
}

function StatusBadge({ status }) {
  if (status === "CONCLUIDO") {
    return <span className="px-2 py-1 rounded text-xs font-bold bg-emerald-100 text-emerald-700">OK</span>;
  }
  if (status === "ERRO") {
    return <span className="px-2 py-1 rounded text-xs font-bold bg-rose-100 text-rose-700">ERRO</span>;
  }
  return (
    <span className="px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700">
      {status || "PROCESSANDO"}
    </span>
  );
}

const SimpleLineChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-xs text-slate-400 py-10">Sem dados gráficos disponíveis</div>;
  }

  const width = 500;
  const height = 180;
  const padding = 30;

  const allValues = data.flatMap((d) => [d.real, d.meta]);
  const maxVal = (Math.max(...allValues) || 5) * 1.05;
  const minVal = (Math.min(...allValues) || 0) * 0.95;
  const range = maxVal - minVal || 1;

  const getX = (i) => padding + (i / Math.max(1, data.length - 1)) * (width - 2 * padding);
  const getY = (val) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

  const pointsReal = data.map((d, i) => `${getX(i)},${getY(d.real)}`).join(" ");
  const pointsMeta = data.map((d, i) => `${getX(i)},${getY(d.meta)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto border bg-white rounded-lg font-sans">
      {[0, 0.5, 1].map((pct, i) => {
        const y = height - padding - pct * (height - 2 * padding);
        return <line key={i} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
      })}

      <polyline fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,4" points={pointsMeta} />
      <polyline fill="none" stroke="#dc2626" strokeWidth="2" points={pointsReal} />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={getX(i)} cy={getY(d.real)} r="3" fill="#dc2626" />
          <text x={getX(i)} y={getY(d.real) - 10} textAnchor="middle" fontSize="10" fill="#dc2626" fontWeight="bold">
            {n(d.real).toFixed(2)}
          </text>

          <text x={getX(i)} y={getY(d.meta) + 15} textAnchor="middle" fontSize="9" fill="#64748b">
            Ref: {n(d.meta).toFixed(2)}
          </text>

          <text x={getX(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#475569" fontWeight="500">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

export default function DesempenhoDieselAgente() {
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const hoje = useMemo(() => new Date(), []);
  const primeiroDiaPeriodo = useMemo(() => new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1), [hoje]);

  const [periodoInicio, setPeriodoInicio] = useState(fmtDateInput(primeiroDiaPeriodo));
  const [periodoFim, setPeriodoFim] = useState(fmtDateInput(hoje));
  const [userSession, setUserSession] = useState(null);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  const [loadingGerencial, setLoadingGerencial] = useState(false);
  const [loadingProntuarios, setLoadingProntuarios] = useState(false);

  const [ultimoGerencial, setUltimoGerencial] = useState(null);
  const [ultimaAnalise, setUltimaAnalise] = useState(null);
  const [sugestoes, setSugestoes] = useState([]);
  const [selected, setSelected] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "combustivel_desperdicado", direction: "desc" });

  const [busca, setBusca] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");

  const [viewingDetails, setViewingDetails] = useState(null);
  const [modalContent, setModalContent] = useState({ raioX: [], chartData: [] });

  const validarPeriodo = useCallback(() => {
    if (!periodoInicio || !periodoFim) return true;
    return periodoInicio <= periodoFim;
  }, [periodoInicio, periodoFim]);

  async function carregarTela() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!mountedRef.current) return;
      setUserSession(sess?.session || null);

      const { data: rel } = await supabase
        .from("relatorios_gerados")
        .select("*")
        .eq("tipo", "diesel_gerencial")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mountedRef.current) return;
      setUltimoGerencial(rel || null);

      const { data: ultAnalise } = await supabase
        .from("diesel_analise_gerencial_snapshot")
        .select("id, report_id, periodo_label, mes_atual_nome, created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mountedRef.current) return;
      setUltimaAnalise(ultAnalise || null);

      const { data: sug } = await supabase.from("v_sugestoes_acompanhamento_30d").select("*").limit(500);

      const { data: acompanhamentos } = await supabase
        .from("diesel_acompanhamentos")
        .select("motorista_chapa, status")
        .not("status", "in", '("OK","ENCERRADO","ATAS")');

      const mapStatusAtivo = {};
      if (acompanhamentos) {
        acompanhamentos.forEach((a) => {
          mapStatusAtivo[a.motorista_chapa] = a.status;
        });
      }

      const sugestoesComStatus = (sug || []).map((s) => ({
        ...s,
        status_atual: mapStatusAtivo[s.motorista_chapa] || null,
      }));

      if (!mountedRef.current) return;
      setSugestoes(sugestoesComStatus);
    } catch (e) {
      if (!mountedRef.current) return;
      setErro("Erro ao carregar: " + (e?.message || String(e)));
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTela();
  }, []);

  const openModal = async (motorista) => {
    let detalhes = motorista.detalhes_json || null;
    let nomeFallback = motorista.motorista_nome || null;

    if (!detalhes) {
      const mesRef = motorista.mes_ref || new Date().toISOString().slice(0, 7);

      const { data } = await supabase
        .from("diesel_sugestoes_acompanhamento")
        .select("detalhes_json, motorista_nome")
        .eq("chapa", motorista.motorista_chapa)
        .eq("mes_ref", mesRef)
        .maybeSingle();

      if (data?.detalhes_json) detalhes = data.detalhes_json;
      if (!nomeFallback && data?.motorista_nome) nomeFallback = data.motorista_nome;
    }

    setViewingDetails({ ...motorista, motorista_nome: nomeFallback });

    if (detalhes) {
      setModalContent({
        raioX: detalhes.raio_x || [],
        chartData: detalhes.grafico_semanal || [],
      });
    } else {
      setModalContent({ raioX: [], chartData: [] });
    }
  };

  const linhasUnicas = useMemo(() => {
    const linhas = (sugestoes || [])
      .map((r) => normalizarLinha(r.linha_mais_rodada))
      .filter(Boolean);

    return [...new Set(linhas)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [sugestoes]);

  const sugestoesFiltradas = useMemo(() => {
    return (sugestoes || []).filter((r) => {
      const linha = normalizarLinha(r.linha_mais_rodada);
      const nome = String(r.motorista_nome || "").toLowerCase();
      const chapa = String(r.motorista_chapa || "").toLowerCase();
      const q = busca.toLowerCase().trim();

      if (filtroLinha && linha !== filtroLinha) return false;

      if (q) {
        const linhaTexto = linha.toLowerCase();
        if (!nome.includes(q) && !chapa.includes(q) && !linhaTexto.includes(q)) return false;
      }

      return true;
    });
  }, [sugestoes, busca, filtroLinha]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedSugestoes = useMemo(() => {
    const items = [...sugestoesFiltradas];

    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        const nums = ["km_percorrido", "combustivel_consumido", "kml_realizado", "kml_meta", "combustivel_desperdicado"];
        if (nums.includes(sortConfig.key)) {
          aVal = n(aVal);
          bVal = n(bVal);
        } else {
          aVal = String(aVal || "").toLowerCase();
          bVal = String(bVal || "").toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [sugestoesFiltradas, sortConfig]);

  const ThSortable = ({ label, columnKey, align = "left" }) => (
    <th className={`p-3 cursor-pointer hover:bg-slate-100 text-${align}`} onClick={() => handleSort(columnKey)}>
      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {sortConfig.key !== columnKey ? (
          <FaSort className="text-slate-300" />
        ) : sortConfig.direction === "asc" ? (
          <FaSortUp className="text-cyan-600" />
        ) : (
          <FaSortDown className="text-cyan-600" />
        )}
      </div>
    </th>
  );

  const dispararGerencial = async () => {
    if (loadingGerencial) return;
    setLoadingGerencial(true);

    setErro(null);
    setSucesso(null);
    try {
      const { data: record, error } = await supabase
        .from("relatorios_gerados")
        .insert({
          tipo: "diesel_gerencial",
          status: "PROCESSANDO",
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          solicitante_login: userSession?.user?.email || "sistema",
          solicitante_nome: userSession?.user?.user_metadata?.full_name,
        })
        .select("id")
        .single();

      if (error) throw error;

      await dispatchGitHubWorkflow(WF_GERENCIAL, {
        report_id: String(record.id),
        periodo_inicio: periodoInicio,
        periodo_fim: periodoFim,
        report_tipo: "diesel_gerencial",
      });

      setSucesso(`Relatório #${record.id} enviado.`);
      setTimeout(carregarTela, 2000);
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      if (!mountedRef.current) return;
      setLoadingGerencial(false);
    }
  };

  const gerarFormulariosSelecionados = async () => {
    if (loadingProntuarios) return;
    setLoadingProntuarios(true);

    setErro(null);
    setSucesso(null);

    const selecionados = sugestoesFiltradas.filter((r) => selected[r.motorista_chapa]);
    if (!selecionados.length) {
      setErro("Selecione pelo menos 1 motorista.");
      setLoadingProntuarios(false);
      return;
    }

    try {
      const { data: lote, error: errL } = await supabase
        .from("acompanhamento_lotes")
        .insert({
          status: "PROCESSANDO",
          qtd: selecionados.length,
          extra: { origem: "v_sugestoes_acompanhamento_30d", gerado_em: new Date().toISOString() },
        })
        .select("id")
        .single();

      if (errL) throw errL;

      const itens = selecionados.map((r) => ({
        lote_id: lote.id,
        motorista_chapa: r.motorista_chapa,
        linha_mais_rodada: r.linha_mais_rodada ?? null,
        km_percorrido: n(r.km_percorrido),
        combustivel_consumido: n(r.combustivel_consumido),
        kml_realizado: n(r.kml_realizado),
        kml_meta: n(r.kml_meta),
        combustivel_desperdicado: n(r.combustivel_desperdicado),
        extra: { motorista_nome: r.motorista_nome ?? null },
      }));

      const { error: errI } = await supabase.from("acompanhamento_lote_itens").insert(itens);
      if (errI) throw errI;

      await dispatchGitHubWorkflow(WF_ACOMP, {
        ordem_batch_id: String(lote.id),
        qtd: String(selecionados.length),
      });

      setSucesso(`Lote #${lote.id} enviado. Processando...`);
      setSelected({});
      setTimeout(carregarTela, 2500);
    } catch (err) {
      setErro(err?.message || String(err));
    } finally {
      if (!mountedRef.current) return;
      setLoadingProntuarios(false);
    }
  };

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);

  const allChecked = useMemo(() => {
    const disponiveis = sugestoesFiltradas.filter((r) => !r.status_atual);
    return disponiveis.length > 0 && disponiveis.every((r) => selected[r.motorista_chapa]);
  }, [sugestoesFiltradas, selected]);

  const toggleAll = () => {
    if (allChecked) {
      const novo = { ...selected };
      sugestoesFiltradas.forEach((r) => {
        delete novo[r.motorista_chapa];
      });
      setSelected(novo);
    } else {
      const m = { ...selected };
      sugestoesFiltradas.forEach((r) => {
        if (!r.status_atual) m[r.motorista_chapa] = true;
      });
      setSelected(m);
    }
  };

  const toggleOne = (chapa) => setSelected((p) => ({ ...p, [chapa]: !p[chapa] }));

  const totalKm = modalContent.raioX?.reduce((acc, r) => acc + n(r.km), 0) || 0;
  const totalLitros = modalContent.raioX?.reduce((acc, r) => acc + n(r.litros), 0) || 0;
  const totalDesperdicio = modalContent.raioX?.reduce((acc, r) => acc + n(r.desperdicio), 0) || 0;

  const kmlGeralReal = totalLitros > 0 ? totalKm / totalLitros : 0;

  const litrosTeoricosTotal =
    modalContent.raioX?.reduce((acc, r) => {
      const metaLinha = n(r.kml_meta);
      return acc + (metaLinha > 0 ? n(r.km) / metaLinha : 0);
    }, 0) || 0;

  const kmlGeralMeta = litrosTeoricosTotal > 0 ? totalKm / litrosTeoricosTotal : 0;

  const ultimoPdfUrl = getPublicUrl(ultimoGerencial?.arquivo_pdf_path);
  const ultimaAnaliseLabel = ultimaAnalise
    ? `Última análise gerada: Relatório #${ultimaAnalise.report_id || "-"} · ${ultimaAnalise.mes_atual_nome || ultimaAnalise.periodo_label || "-"} · ${ultimaAnalise.created_at ? new Date(ultimaAnalise.created_at).toLocaleDateString() : "-"}`
    : "Nenhuma análise gerada até o momento.";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto relative">
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <FaBolt size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Agente Diesel</h2>
            <p className="text-sm text-slate-500">Sugestões de Acompanhamento</p>
          </div>
        </div>
        <button onClick={carregarTela} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" title="Atualizar">
          <FaSync className={clsx(loading && "animate-spin")} />
        </button>
      </div>

      {(sucesso || erro) && (
        <div
          className={clsx(
            "p-4 rounded-xl border flex items-center gap-3",
            sucesso ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
          )}
        >
          {sucesso ? <FaCheckCircle /> : <FaExclamationTriangle />}
          <div>
            <p className="font-bold text-sm">{sucesso ? "Sucesso" : "Atenção"}</p>
            <p className="text-xs">{sucesso || erro}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4">
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-700">Relatório Gerencial</h3>
            <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-1 rounded font-bold">MENSAL</span>
          </div>
        </div>

        <div className="flex items-center justify-between bg-slate-50 border rounded-xl px-4 py-3 gap-4 flex-wrap">
          <div className="text-sm">
            <span className="text-slate-500 font-bold">Último Relatório: </span>
            {ultimoGerencial ? (
              <>
                <span className="font-extrabold text-slate-800">#{ultimoGerencial.id}</span>
                <span className="text-slate-500 text-xs ml-2">
                  {ultimoGerencial.created_at ? new Date(ultimoGerencial.created_at).toLocaleDateString() : "-"}
                </span>
                <span className="ml-3">
                  <StatusBadge status={ultimoGerencial.status} />
                </span>
              </>
            ) : (
              <span className="text-slate-500">Nenhum registro encontrado</span>
            )}
          </div>

          {ultimoGerencial?.status === "CONCLUIDO" && ultimoPdfUrl && (
            <a
              href={ultimoPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-700 font-extrabold inline-flex items-center gap-2 hover:underline"
            >
              <FaFilePdf /> Abrir PDF
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="text-xs font-bold text-slate-500">Início</label>
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500">Fim</label>
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={dispararGerencial}
            disabled={!validarPeriodo() || loadingGerencial}
            className={clsx(
              "w-full py-3 rounded-xl flex justify-center gap-2 font-bold text-sm transition-colors",
              "bg-cyan-600 text-white hover:bg-cyan-700 disabled:bg-slate-300"
            )}
          >
            <FaPlay className={clsx(loadingGerencial && "animate-spin")} /> {loadingGerencial ? "ENVIANDO..." : "DISPARAR RELATÓRIO"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-rose-200 bg-rose-50 shadow-sm p-4">
        <div className="text-sm font-extrabold text-rose-700">{ultimaAnaliseLabel}</div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
          <div>
            <h3 className="font-extrabold text-slate-800">Sugestões de Acompanhamento (30 dias)</h3>
            <p className="text-xs text-slate-500">
              Total: <b>{sugestoes.length}</b> | Filtrados: <b>{sugestoesFiltradas.length}</b>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-600">
              Selecionados: <b>{selectedCount}</b>
            </div>
            <button
              onClick={gerarFormulariosSelecionados}
              disabled={selectedCount === 0 || loadingProntuarios}
              className={clsx(
                "px-4 py-2 rounded-xl font-extrabold text-sm transition-colors inline-flex items-center gap-2",
                selectedCount === 0 || loadingProntuarios
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              <FaSync className={clsx(loadingProntuarios && "animate-spin")} />
              {loadingProntuarios ? "GERANDO..." : "Gerar formulários"}
            </button>
          </div>
        </div>

        <div className="p-4 border-b bg-white">
          <div className="flex flex-col md:flex-row gap-3 items-center">
            <div className="relative w-full md:flex-1">
              <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por chapa, nome ou linha..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none focus:border-cyan-500 font-medium"
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
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-slate-500 bg-white border-b sticky top-0 z-10">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input type="checkbox" checked={!!allChecked} onChange={toggleAll} />
                </th>
                <th className="p-3 w-10"></th>
                <ThSortable label="Chapa" columnKey="motorista_chapa" />
                <ThSortable label="Nome" columnKey="motorista_nome" />
                <ThSortable label="Status" columnKey="status_atual" />
                <ThSortable label="Linha" columnKey="linha_mais_rodada" />
                <ThSortable label="KM" columnKey="km_percorrido" align="right" />
                <ThSortable label="Real" columnKey="kml_realizado" align="right" />
                <ThSortable label="Meta" columnKey="kml_meta" align="right" />
                <ThSortable label="Desperdício" columnKey="combustivel_desperdicado" align="right" />
              </tr>
            </thead>

            <tbody className="divide-y">
              {sortedSugestoes.map((r) => {
                const isOcupado = !!r.status_atual;
                const statusFormatado =
                  r.status_atual === "AGUARDANDO_INSTRUTOR"
                    ? "AGUARDANDO INSTRUTOR"
                    : r.status_atual === "EM_MONITORAMENTO"
                    ? "EM MONITORAMENTO"
                    : r.status_atual;

                return (
                  <tr key={r.motorista_chapa} className="hover:bg-slate-50">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!selected[r.motorista_chapa]}
                        onChange={() => toggleOne(r.motorista_chapa)}
                        disabled={isOcupado}
                        className={isOcupado ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
                        title={isOcupado ? "Motorista já possui um acompanhamento em andamento" : ""}
                      />
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => openModal(r)} className="text-slate-400 hover:text-cyan-600" title="Ver detalhes completos">
                        <FaInfoCircle size={18} />
                      </button>
                    </td>
                    <td className="p-3 font-bold text-slate-800">{r.motorista_chapa}</td>
                    <td className="p-3 text-slate-600 text-xs truncate max-w-[240px]" title={r.motorista_nome}>
                      {r.motorista_nome || "-"}
                    </td>

                    <td className="p-3">
                      {isOcupado ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                          {statusFormatado}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200">
                          LIVRE
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-slate-700">{r.linha_mais_rodada || "-"}</td>
                    <td className="p-3 text-right">{n(r.km_percorrido).toFixed(0)}</td>
                    <td className="p-3 text-right font-bold">{n(r.kml_realizado).toFixed(2)}</td>
                    <td className="p-3 text-right text-slate-500">{n(r.kml_meta).toFixed(2)}</td>
                    <td className="p-3 text-right text-rose-700 font-bold">{n(r.combustivel_desperdicado).toFixed(0)} L</td>
                  </tr>
                );
              })}

              {sortedSugestoes.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 font-medium">
                    Nenhum registro encontrado com os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col">
            <div className="bg-slate-800 text-white p-5 flex justify-between items-start sticky top-0 z-20">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <FaBolt className="text-yellow-400" /> Auditoria de Eficiência
                </h3>
                <p className="text-slate-300 text-sm mt-1">
                  {viewingDetails.motorista_chapa} - {viewingDetails.motorista_nome || "-"}
                </p>
                <div className="text-xs text-slate-400 mt-1">Dados processados pela IA no momento da sugestão.</div>
              </div>
              <button onClick={() => setViewingDetails(null)} className="text-slate-400 hover:text-white p-2 hover:bg-slate-700 rounded-full transition">
                <FaTimes size={20} />
              </button>
            </div>

            <div className="p-6 space-y-8 flex-1">
              {!modalContent.raioX || modalContent.raioX.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-3 border-2 border-dashed rounded-xl bg-slate-50">
                  <FaExclamationTriangle className="text-3xl text-slate-300" />
                  <p>Detalhes não disponíveis para este registro.</p>
                  <span className="text-xs">Execute o relatório novamente para gerar os dados detalhados.</span>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-700 border-b pb-2">
                      <FaListAlt />
                      <h4 className="font-bold text-sm uppercase">1. Raio-X da Operação</h4>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100 text-slate-500 font-bold uppercase">
                          <tr>
                            <th className="p-2 text-left">Linha</th>
                            <th className="p-2 text-left">Cluster</th>
                            <th className="p-2 text-right">KM</th>
                            <th className="p-2 text-right">Litros</th>
                            <th className="p-2 text-right">Real</th>
                            <th className="p-2 text-right">Meta</th>
                            <th className="p-2 text-right">Desp.</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y">
                          {modalContent.raioX.map((row, idx) => (
                            <tr key={idx} className={n(row.desperdicio) > 10 ? "bg-rose-50" : ""}>
                              <td className="p-2 font-bold text-slate-700">{row.linha}</td>
                              <td className="p-2 text-slate-500">{row.cluster}</td>
                              <td className="p-2 text-right">{n(row.km).toFixed(0)}</td>
                              <td className="p-2 text-right">{n(row.litros).toFixed(0)}</td>
                              <td className="p-2 text-right font-bold">{n(row.kml_real).toFixed(2)}</td>
                              <td className="p-2 text-right text-slate-500">{n(row.kml_meta).toFixed(2)}</td>
                              <td className={clsx("p-2 text-right font-bold", n(row.desperdicio) > 0 ? "text-rose-600" : "text-emerald-600")}>
                                {n(row.desperdicio).toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>

                        <tfoot className="bg-slate-800 text-white font-bold border-t-2 border-slate-900">
                          <tr>
                            <td colSpan={2} className="p-2 text-right uppercase text-slate-300">
                              TOTAL
                            </td>
                            <td className="p-2 text-right">{totalKm.toFixed(0)}</td>
                            <td className="p-2 text-right">{totalLitros.toFixed(0)}</td>
                            <td className="p-2 text-right text-yellow-400">{kmlGeralReal.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-300">{kmlGeralMeta.toFixed(2)}</td>
                            <td className="p-2 text-right bg-rose-900/50 text-rose-300">{totalDesperdicio.toFixed(1)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-slate-700 border-b pb-2">
                      <FaChartLine />
                      <h4 className="font-bold text-sm uppercase">2. Evolução Semanal</h4>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <SimpleLineChart data={modalContent.chartData} />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-4 border-t flex justify-end">
                <button
                  onClick={() => setViewingDetails(null)}
                  className="px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Fechar Análise
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
