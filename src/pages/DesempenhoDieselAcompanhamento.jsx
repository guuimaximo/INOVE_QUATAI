import React, { useEffect, useMemo, useState, useContext } from "react";
import {
  FaBolt,
  FaSync,
  FaClock,
  FaRoad,
  FaSearch,
  FaFilter,
  FaFilePdf,
  FaPlay,
  FaTrash,
  FaEye,
  FaChartLine,
  FaClipboardList,
  FaGavel,
} from "react-icons/fa";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";

import ModalLancamentoIntervencao from "../components/desempenho/ModalLancamentoIntervencao";
import ModalProntuarioUnificado from "../components/desempenho/ModalProntuarioUnificado";
import ModalCheckpointAnalise from "../components/desempenho/ModalCheckpointAnalise";
import DesempenhoDieselAnalise from "./DesempenhoDieselAnalise";

// =============================================================================
// HELPERS
// =============================================================================
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clsx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function normalizeStatus(s) {
  const st = String(s || "").toUpperCase().trim();
  if (!st) return "AGUARDANDO_INSTRUTOR";
  if (st === "AGUARDANDO INSTRUTOR") return "AGUARDANDO_INSTRUTOR";
  if (st === "CONCLUIDO") return "AGUARDANDO_INSTRUTOR";
  if (st === "AG_ACOMPANHAMENTO") return "AGUARDANDO_INSTRUTOR";
  if (st === "TRATATIVA") return "ATAS";
  return st;
}

function getStatusView(item) {
  return normalizeStatus(item?.status_ciclo || item?.status || "");
}

function getFoco(item) {
  if (item?.motivo) return String(item.motivo).trim();

  const m = item?.metadata || {};
  if (m?.foco) return String(m.foco).trim();

  const cl = m?.cluster_foco;
  const ln = m?.linha_foco;
  if (cl && ln) return `${cl} - Linha ${ln}`;
  if (ln) return `Linha ${ln}`;

  return "Geral";
}

function extrairLinhaDoMotivo(motivo) {
  const txt = String(motivo || "").trim();
  if (!txt) return null;

  const match = txt.match(/linha\s*([a-z0-9]+)$/i);
  if (match?.[1]) return match[1].toUpperCase();

  return null;
}

function getLinhaApenas(item) {
  const linhaMotivo = extrairLinhaDoMotivo(item?.motivo);
  if (linhaMotivo) return linhaMotivo;

  const linhaMeta = String(item?.metadata?.linha_foco || "").trim();
  if (linhaMeta) return linhaMeta.toUpperCase();

  return "Sem Linha";
}

function getPdfUrl(item) {
  return item?.arquivo_pdf_url || item?.arquivo_pdf_path || null;
}

function formatarDataHoraBR(val, isApenasData = false) {
  if (!val) return "-";
  try {
    if (isApenasData) {
      const str = String(val).split("T")[0].split(" ")[0];
      const parts = str.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return str;
    }
    return new Date(val).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return String(val);
  }
}

function buildNomeSobrenome(u) {
  const nome = String(u?.nome || "").trim();
  const sobrenome = String(u?.sobrenome || "").trim();
  const nomeCompleto = String(u?.nome_completo || "").trim();

  if (nomeCompleto) return nomeCompleto;
  if (nome && sobrenome) return `${nome} ${sobrenome}`;
  if (nome) return nome;
  return null;
}

function getEtapaLabel(item) {
  const fase = String(item?.fase_monitoramento || "").toUpperCase();
  if (fase === "1_DE_3") return "1 de 3";
  if (fase === "2_DE_3") return "2 de 3";
  if (fase === "3_DE_3") return "3 de 3";
  if (fase === "FIM_MONITORAMENTO") return "Fim";
  return "-";
}

function getProntuarioPendenteLabel(item) {
  const p = String(item?.prontuario_pendente || "").toUpperCase();
  if (p === "PRONTUARIO_10") return "10 dias";
  if (p === "PRONTUARIO_20") return "20 dias";
  if (p === "PRONTUARIO_30") return "30 dias";
  return "-";
}

function getProntuarioStatus(item) {
  if (item?.prontuario_pendente) return "PENDENTE";
  if (item?.prontuario_30_gerado_em) return "30 GERADO";
  if (item?.prontuario_20_gerado_em) return "20 GERADO";
  if (item?.prontuario_10_gerado_em) return "10 GERADO";
  return "SEM PRONTUÁRIO";
}

function getDecisionCheckpoint(item) {
  if (item?.prontuario_pendente) return item.prontuario_pendente;
  if (item?.prontuario_30_gerado_em) return "PRONTUARIO_30";
  if (item?.prontuario_20_gerado_em) return "PRONTUARIO_20";
  if (item?.prontuario_10_gerado_em) return "PRONTUARIO_10";
  return null;
}

function statusBadgeClass(status) {
  const st = normalizeStatus(status);
  if (st === "AGUARDANDO_INSTRUTOR") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (st === "EM_MONITORAMENTO") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (st === "EM_ANALISE") {
    return "bg-violet-50 text-violet-700 border-violet-200";
  }
  if (st === "ATAS") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (st === "OK" || st === "ENCERRADO") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function CardTopo({ titulo, valor, subtitulo, destaque = "slate", filtrado }) {
  const mapa = {
    amber: "border-amber-200 bg-amber-50/40",
    blue: "border-blue-200 bg-blue-50/40",
    rose: "border-rose-200 bg-rose-50/40",
    emerald: "border-emerald-200 bg-emerald-50/40",
    slate: "border-slate-200 bg-slate-50/40",
  };

  const corNumero = {
    amber: "text-amber-700",
    blue: "text-blue-700",
    rose: "text-rose-700",
    emerald: "text-emerald-700",
    slate: "text-slate-700",
  };

  return (
    <div className={clsx("rounded-2xl border p-4 shadow-sm", mapa[destaque] || mapa.slate)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{titulo}</p>
          <div className="flex items-end gap-2 flex-wrap mt-1">
            <p className={clsx("text-3xl font-black", corNumero[destaque] || corNumero.slate)}>{valor}</p>
            <span className="text-[11px] px-2 py-1 rounded-full border bg-white text-slate-500 font-bold">
              filtrado: {filtrado}
            </span>
          </div>
          {subtitulo ? <p className="text-xs text-slate-500 mt-1">{subtitulo}</p> : null}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function DesempenhoDieselAcompanhamento() {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);

  const [userRoleData, setUserRoleData] = useState({
    nivel: null,
    nome_completo: null,
  });
  const podeExcluir = ["Administrador", "Gestor"].includes(userRoleData.nivel);

  const [busca, setBusca] = useState("");
  const [abaPrincipal, setAbaPrincipal] = useState("analise");
  const [abaStatus, setAbaStatus] = useState("AGUARDANDO");

  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroDataIni, setFiltroDataIni] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "data",
    direction: "desc",
  });

  const [modalLancarOpen, setModalLancarOpen] = useState(false);
  const [modalVisaoGeralOpen, setModalVisaoGeralOpen] = useState(false);
  const [modalCheckpointOpen, setModalCheckpointOpen] = useState(false);

  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [checkpointTipo, setCheckpointTipo] = useState(null);

  useEffect(() => {
    async function carregarPermissaoUsuario() {
      const login = user?.login || user?.email;
      if (!login) return;

      try {
        const { data } = await supabase
          .from("usuarios_aprovadores")
          .select("nivel, nome, sobrenome, nome_completo")
          .eq("login", login)
          .maybeSingle();

        if (data) {
          setUserRoleData({
            nivel: data.nivel,
            nome_completo:
              data.nome_completo ||
              [data.nome, data.sobrenome].filter(Boolean).join(" ") ||
              data.nome,
          });
        }
      } catch (e) {
        console.error("Erro ao buscar permissões:", e);
      }
    }

    carregarPermissaoUsuario();
  }, [user]);

  async function carregarOrdens() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("v_diesel_acompanhamentos_ciclo")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(800);

      if (error) throw error;
      setLista(data || []);
    } catch (e) {
      alert("Erro ao carregar: " + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarOrdens();
  }, []);

  const listaComFiltrosSemAba = useMemo(() => {
    return (lista || []).filter((item) => {
      const st = getStatusView(item);

      if (filtroStatus && st !== filtroStatus) return false;

      const q = busca.toLowerCase().trim();
      if (q) {
        const nome = String(item.motorista_nome || "").toLowerCase();
        const chapa = String(item.motorista_chapa || "");
        if (!nome.includes(q) && !chapa.includes(q)) return false;
      }

      if (filtroLinha && getLinhaApenas(item) !== filtroLinha) return false;

      const dataRef =
        abaStatus === "AGUARDANDO"
          ? item.created_at
          : item.dt_inicio_monitoramento || item.created_at;

      if (filtroDataIni || filtroDataFim) {
        if (!dataRef) return false;
        const dFormat = String(dataRef).split("T")[0].split(" ")[0];
        if (filtroDataIni && dFormat < filtroDataIni) return false;
        if (filtroDataFim && dFormat > filtroDataFim) return false;
      }

      return true;
    });
  }, [
    lista,
    busca,
    filtroLinha,
    filtroStatus,
    filtroDataIni,
    filtroDataFim,
    abaStatus,
  ]);

  const countAguardando = lista.filter(
    (i) => getStatusView(i) === "AGUARDANDO_INSTRUTOR"
  ).length;

  const countMonitoramento = lista.filter(
    (i) => getStatusView(i) === "EM_MONITORAMENTO"
  ).length;

  const countProntuariosPendentes = lista.filter(
    (i) => !!i?.prontuario_pendente
  ).length;

  const countEmAnalise = lista.filter((i) => {
    const st = getStatusView(i);
    return ["EM_ANALISE", "OK", "ENCERRADO", "ATAS"].includes(st);
  }).length;

  const countAguardandoFiltrado = listaComFiltrosSemAba.filter(
    (i) => getStatusView(i) === "AGUARDANDO_INSTRUTOR"
  ).length;

  const countMonitoramentoFiltrado = listaComFiltrosSemAba.filter(
    (i) => getStatusView(i) === "EM_MONITORAMENTO"
  ).length;

  const countProntuariosPendentesFiltrado = listaComFiltrosSemAba.filter(
    (i) => !!i?.prontuario_pendente
  ).length;

  const countEmAnaliseFiltrado = listaComFiltrosSemAba.filter((i) => {
    const st = getStatusView(i);
    return ["EM_ANALISE", "OK", "ENCERRADO", "ATAS"].includes(st);
  }).length;

  const handleExcluir = async (id) => {
    if (!podeExcluir) {
      alert("Apenas Gestores ou Administradores podem excluir ordens de acompanhamento.");
      return;
    }

    const confirm = window.confirm(
      "ATENÇÃO! Tem certeza que deseja excluir este acompanhamento definitivamente?"
    );
    if (!confirm) return;

    try {
      await supabase
        .from("diesel_checklist_respostas")
        .delete()
        .eq("acompanhamento_id", id);

      const { error } = await supabase
        .from("diesel_acompanhamentos")
        .delete()
        .eq("id", id);

      if (error) throw error;

      alert("Acompanhamento excluído com sucesso!");
      carregarOrdens();
    } catch (e) {
      alert("Erro ao excluir: " + (e?.message || String(e)));
    }
  };

  const handleLancar = (item) => {
    setItemSelecionado(item);
    setModalLancarOpen(true);
  };

  const abrirVisaoGeral = (item) => {
    setItemSelecionado(item);
    setModalVisaoGeralOpen(true);
  };

  const abrirCheckpoint = (item, tipo) => {
    setItemSelecionado(item);
    setCheckpointTipo(tipo);
    setModalCheckpointOpen(true);
  };

  const abrirPDF = (item) => {
    const url = getPdfUrl(item);
    if (!url) {
      alert("PDF não disponível para este registro.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const linhasUnicas = useMemo(() => {
    const lns = lista
      .map((i) => getLinhaApenas(i))
      .filter(Boolean)
      .map((x) => String(x).trim().toUpperCase());

    return [...new Set(lns)].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lista]);

  const statusUnicos = useMemo(() => {
    const sts = lista.map((i) => getStatusView(i)).filter(Boolean);
    return [...new Set(sts)].sort();
  }, [lista]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return <span className="text-gray-300 ml-2 text-[10px]">↕</span>;
    }
    return sortConfig.direction === "asc" ? (
      <span className="text-blue-600 ml-2 text-[10px]">▲</span>
    ) : (
      <span className="text-blue-600 ml-2 text-[10px]">▼</span>
    );
  };

  const listaFiltrada = useMemo(() => {
    let result = (lista || []).filter((item) => {
      const st = getStatusView(item);

      let matchAba = false;
      if (abaStatus === "AGUARDANDO") {
        matchAba = st === "AGUARDANDO_INSTRUTOR";
      } else if (abaStatus === "MONITORAMENTO") {
        matchAba = st === "EM_MONITORAMENTO";
      } else if (abaStatus === "ANALISE") {
        matchAba = ["EM_ANALISE", "OK", "ENCERRADO", "ATAS"].includes(st);
      }
      if (!matchAba) return false;

      if (filtroStatus && st !== filtroStatus) return false;

      const q = busca.toLowerCase().trim();
      if (q) {
        const nome = String(item.motorista_nome || "").toLowerCase();
        const chapa = String(item.motorista_chapa || "");
        if (!nome.includes(q) && !chapa.includes(q)) return false;
      }

      if (filtroLinha && getLinhaApenas(item) !== filtroLinha) return false;

      const dataRef =
        abaStatus === "AGUARDANDO"
          ? item.created_at
          : item.dt_inicio_monitoramento || item.created_at;

      if (filtroDataIni || filtroDataFim) {
        if (!dataRef) return false;
        const dFormat = String(dataRef).split("T")[0].split(" ")[0];
        if (filtroDataIni && dFormat < filtroDataIni) return false;
        if (filtroDataFim && dFormat > filtroDataFim) return false;
      }

      return true;
    });

    result.sort((a, b) => {
      let valA, valB;
      const { key, direction } = sortConfig;

      if (key === "data") {
        valA =
          abaStatus === "AGUARDANDO"
            ? a.created_at
            : a.dt_inicio_monitoramento || a.created_at;
        valB =
          abaStatus === "AGUARDANDO"
            ? b.created_at
            : b.dt_inicio_monitoramento || b.created_at;
      } else if (key === "motorista") {
        valA = a.motorista_nome;
        valB = b.motorista_nome;
      } else if (key === "foco") {
        valA = getFoco(a);
        valB = getFoco(b);
      } else if (key === "status") {
        valA = getStatusView(a);
        valB = getStatusView(b);
      } else if (key === "etapa") {
        valA = a.fase_monitoramento || "";
        valB = b.fase_monitoramento || "";
      } else {
        valA = "";
        valB = "";
      }

      valA = valA || "";
      valB = valB || "";

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    lista,
    busca,
    abaStatus,
    filtroLinha,
    filtroStatus,
    filtroDataIni,
    filtroDataFim,
    sortConfig,
  ]);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-lg">
            <FaBolt size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Ordens de Acompanhamento</h2>
            <p className="text-sm text-slate-500">Gestão de ordens, checkpoints e análises pós-acompanhamento.</p>
          </div>
        </div>

        <button
          onClick={carregarOrdens}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-full"
          title="Atualizar"
        >
          <FaSync className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setAbaPrincipal("analise")}
            className={clsx(
              "px-4 py-3 rounded-xl text-sm font-extrabold transition-colors",
              abaPrincipal === "analise"
                ? "bg-slate-900 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Aba 1 · Análise
          </button>

          <button
            onClick={() => setAbaPrincipal("sugestoes")}
            className={clsx(
              "px-4 py-3 rounded-xl text-sm font-extrabold transition-colors",
              abaPrincipal === "sugestoes"
                ? "bg-slate-900 text-white shadow"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            Aba 2 · Sugestões de Acompanhamento
          </button>
        </div>
      </div>

      {abaPrincipal === "analise" ? (
        <DesempenhoDieselAnalise />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <CardTopo
              titulo="Aguardando instrutor"
              valor={countAguardando}
              filtrado={countAguardandoFiltrado}
              subtitulo="Fila atual"
              destaque="amber"
            />

            <CardTopo
              titulo="Em andamento"
              valor={countMonitoramento}
              filtrado={countMonitoramentoFiltrado}
              subtitulo="Monitoramentos ativos"
              destaque="blue"
            />

            <CardTopo
              titulo="Prontuários pendentes"
              valor={countProntuariosPendentes}
              filtrado={countProntuariosPendentesFiltrado}
              subtitulo="Checkpoint aguardando análise"
              destaque="rose"
            />

            <CardTopo
              titulo="Concluídos / análise"
              valor={countEmAnalise}
              filtrado={countEmAnaliseFiltrado}
              subtitulo="Processos finalizados"
              destaque="emerald"
            />
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAbaStatus("AGUARDANDO")}
                className={clsx(
                  "px-4 py-3 rounded-xl text-sm font-extrabold transition-colors",
                  abaStatus === "AGUARDANDO"
                    ? "bg-amber-500 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                📋 Aguardando
              </button>

              <button
                onClick={() => setAbaStatus("MONITORAMENTO")}
                className={clsx(
                  "px-4 py-3 rounded-xl text-sm font-extrabold transition-colors",
                  abaStatus === "MONITORAMENTO"
                    ? "bg-blue-600 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                🛣️ Monitoramento
              </button>

              <button
                onClick={() => setAbaStatus("ANALISE")}
                className={clsx(
                  "px-4 py-3 rounded-xl text-sm font-extrabold transition-colors",
                  abaStatus === "ANALISE"
                    ? "bg-violet-700 text-white shadow"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                🧠 Análise Final
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-4 relative">
                <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar motorista..."
                  className="pl-9 pr-3 py-2.5 border rounded-xl w-full text-sm outline-none"
                />
              </div>

              <div className="lg:col-span-2 flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
                <FaFilter className="text-slate-400 ml-2" />
                <select
                  value={filtroLinha}
                  onChange={(e) => setFiltroLinha(e.target.value)}
                  className="p-2.5 bg-transparent text-sm outline-none w-full"
                >
                  <option value="">Todas Linhas</option>
                  {linhasUnicas.map((ln) => (
                    <option key={ln} value={ln}>
                      {ln}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2 flex items-center gap-2 bg-slate-50 border rounded-xl px-2">
                <FaFilter className="text-slate-400 ml-2" />
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="p-2.5 bg-transparent text-sm outline-none w-full"
                >
                  <option value="">Todos Status</option>
                  {statusUnicos.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <input
                  type="date"
                  value={filtroDataIni}
                  onChange={(e) => setFiltroDataIni(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm"
                />
              </div>

              <div className="lg:col-span-2">
                <input
                  type="date"
                  value={filtroDataFim}
                  onChange={(e) => setFiltroDataFim(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort("data")}>
                      Data Geração <SortIcon columnKey="data" />
                    </th>
                    <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort("motorista")}>
                      Motorista <SortIcon columnKey="motorista" />
                    </th>
                    <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort("foco")}>
                      Foco <SortIcon columnKey="foco" />
                    </th>
                    <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort("etapa")}>
                      Etapa <SortIcon columnKey="etapa" />
                    </th>
                    <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort("status")}>
                      Status <SortIcon columnKey="status" />
                    </th>
                    <th className="px-4 py-3 text-left">Prontuário</th>
                    <th className="px-4 py-3 text-left">Ações</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {listaFiltrada.map((item) => {
                    const status = getStatusView(item);
                    const decisionTipo = getDecisionCheckpoint(item);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                          {formatarDataHoraBR(
                            abaStatus === "AGUARDANDO"
                              ? item.created_at
                              : item.dt_inicio_monitoramento || item.created_at
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-extrabold text-slate-800">{item.motorista_nome || "-"}</div>
                          <div className="text-xs text-slate-400 mt-1">{item.motorista_chapa || "-"}</div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border text-xs font-bold">
                            {getFoco(item)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 text-slate-700 border text-xs font-bold">
                            {abaStatus === "AGUARDANDO" ? "-" : getEtapaLabel(item)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={clsx(
                              "inline-flex items-center px-2 py-1 rounded-lg border text-xs font-bold",
                              statusBadgeClass(status)
                            )}
                          >
                            {status.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg border text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-200 w-fit">
                              {getProntuarioStatus(item)}
                            </span>

                            {item?.prontuario_pendente ? (
                              <span className="text-[11px] text-amber-700 font-bold">
                                Pendente: {getProntuarioPendenteLabel(item)}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => abrirPDF(item)}
                              className="flex items-center justify-center p-2 bg-white border border-rose-200 text-rose-600 rounded hover:bg-rose-50 shadow-sm transition-all"
                              title="Abrir PDF"
                            >
                              <FaFilePdf size={14} />
                            </button>

                            {abaStatus === "AGUARDANDO" && (
                              <button
                                onClick={() => handleLancar(item)}
                                className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded font-bold text-xs shadow-sm transition-all transform hover:scale-105 whitespace-nowrap"
                              >
                                <FaPlay size={10} /> LANÇAR
                              </button>
                            )}

                            {abaStatus === "AGUARDANDO" && podeExcluir && (
                              <button
                                onClick={() => handleExcluir(item.id)}
                                className="flex items-center justify-center p-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 shadow-sm transition-all"
                                title="Excluir Definitivamente"
                              >
                                <FaTrash size={14} />
                              </button>
                            )}

                            {(abaStatus === "MONITORAMENTO" || abaStatus === "ANALISE") && (
                              <button
                                onClick={() => abrirVisaoGeral(item)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded font-bold text-xs shadow-sm hover:bg-slate-700 transition-all whitespace-nowrap"
                              >
                                <FaEye size={12} /> Detalhes
                              </button>
                            )}

                            {abaStatus === "ANALISE" && decisionTipo && status !== "OK" && (
                              <button
                                onClick={() => abrirCheckpoint(item, decisionTipo)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-violet-700 text-white rounded font-bold text-xs shadow-sm hover:bg-violet-800 transition-all whitespace-nowrap"
                              >
                                <FaGavel size={12} /> Decisão
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {listaFiltrada.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        <div className="text-sm font-bold">Nenhum registro encontrado nesta aba.</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modalLancarOpen && itemSelecionado && (
        <ModalLancamentoIntervencao
          item={itemSelecionado}
          user={user}
          userRoleData={userRoleData}
          onClose={() => setModalLancarOpen(false)}
          onSaved={carregarOrdens}
          buildNomeSobrenome={buildNomeSobrenome}
        />
      )}

      {modalVisaoGeralOpen && itemSelecionado && (
        <ModalProntuarioUnificado
          item={itemSelecionado}
          onClose={() => setModalVisaoGeralOpen(false)}
          onOpenCheckpoint={abrirCheckpoint}
        />
      )}

      {modalCheckpointOpen && itemSelecionado && checkpointTipo && (
        <ModalCheckpointAnalise
          item={itemSelecionado}
          checkpointTipo={checkpointTipo}
          onClose={() => {
            setModalCheckpointOpen(false);
            setCheckpointTipo(null);
          }}
          onSaved={async () => {
            await carregarOrdens();
            setModalVisaoGeralOpen(false);
            setModalCheckpointOpen(false);
            setCheckpointTipo(null);
          }}
        />
      )}
    </div>
  );
}
