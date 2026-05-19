import React, { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
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
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";

import ModalLancamentoIntervencao from "../../components/desempenho/ModalLancamentoIntervencao";
import ModalProntuarioUnificado from "../../components/desempenho/ModalProntuarioUnificado";
import ModalCheckpointAnalise from "../../components/desempenho/ModalCheckpointAnalise";
import { formatDateBR, resolveAcompanhamentoContext } from "../../utils/dieselAcompanhamento";

const GH_USER = import.meta.env.VITE_GITHUB_USER;
const GH_REPO = import.meta.env.VITE_GITHUB_REPO;
const GH_TOKEN = import.meta.env.VITE_GITHUB_TOKEN;
const GH_REF = "main";
const WF_ACOMP = "ordem-acompanhamento.yml";

// =============================================================================
// HELPERS
// =============================================================================
function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
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

  const cl = m?.cluster_foco || item?.cluster_foco;
  const ln = m?.linha_foco || item?.linha_foco;
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
  const linhaContexto = resolveAcompanhamentoContext(item).linha;
  if (linhaContexto) return linhaContexto;

  const linhaMotivo = extrairLinhaDoMotivo(item?.motivo);
  if (linhaMotivo) return linhaMotivo;

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

function isCheckpointFinal30(tipo) {
  return String(tipo || "").toUpperCase() === "PRONTUARIO_30";
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

function isEmAnalise(item) {
  const st = getStatusView(item);
  return ["EM_ANALISE", "OK", "ENCERRADO", "ATAS"].includes(st);
}

async function dispatchGitHubWorkflow(workflowFile, inputs) {
  if (!GH_USER || !GH_REPO || !GH_TOKEN) {
    throw new Error("Credenciais GitHub ausentes.");
  }

  const safeInputs = {};
  for (const key in inputs) {
    safeInputs[key] = String(inputs[key] || "");
  }

  const url = `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GH_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: GH_REF, inputs: safeInputs }),
  });

  if (response.status !== 204) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Erro GitHub: ${response.status}`);
  }
}

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function DesempenhoDieselAcompanhamento() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);
  const [sessaoResumoByAcomp, setSessaoResumoByAcomp] = useState({});

  const [userRoleData, setUserRoleData] = useState({
    nivel: null,
    nome_completo: null,
  });
  const podeExcluir = ["Administrador", "Gestor"].includes(userRoleData.nivel);

  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("AGUARDANDO");
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
  const [loadingReprocessarPendentes, setLoadingReprocessarPendentes] = useState(false);

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
      const rows = data || [];
      setLista(rows);

      const acompanhamentoIds = rows.map((item) => item.id).filter(Boolean);
      if (acompanhamentoIds.length === 0) {
        setSessaoResumoByAcomp({});
        return;
      }

      const { data: sessoes, error: erroSessoes } = await supabase
        .from("diesel_acompanhamento_sessoes")
        .select("acompanhamento_id, iniciado_em, encerrado_em, data_sessao")
        .in("acompanhamento_id", acompanhamentoIds);

      if (erroSessoes) {
        console.error("Erro ao carregar resumo de sessoes:", erroSessoes);
        setSessaoResumoByAcomp({});
        return;
      }

      const resumo = {};
      (sessoes || []).forEach((sessao) => {
        const key = sessao.acompanhamento_id;
        if (!key) return;

        if (!resumo[key]) {
          resumo[key] = { total: 0, abertas: 0, ultimaData: null };
        }

        resumo[key].total += 1;
        if (!sessao.encerrado_em) resumo[key].abertas += 1;

        const ref =
          sessao.encerrado_em ||
          sessao.iniciado_em ||
          sessao.data_sessao ||
          null;

        if (ref && (!resumo[key].ultimaData || ref > resumo[key].ultimaData)) {
          resumo[key].ultimaData = ref;
        }
      });

      setSessaoResumoByAcomp(resumo);
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
        abaAtiva === "AGUARDANDO"
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
    abaAtiva,
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

  const countEmAnalise = lista.filter((i) => isEmAnalise(i)).length;

  const countAguardandoFiltrado = listaComFiltrosSemAba.filter(
    (i) => getStatusView(i) === "AGUARDANDO_INSTRUTOR"
  ).length;

  const countMonitoramentoFiltrado = listaComFiltrosSemAba.filter(
    (i) => getStatusView(i) === "EM_MONITORAMENTO"
  ).length;

  const countProntuariosPendentesFiltrado = listaComFiltrosSemAba.filter(
    (i) => !!i?.prontuario_pendente
  ).length;

  const prontuariosPendentes = useMemo(
    () =>
      lista.filter(
        (item) => !!item?.prontuario_pendente && String(item?.motorista_chapa || "").trim()
      ),
    [lista]
  );

  const prontuariosPendentesUnicos = useMemo(() => {
    const map = new Map();
    prontuariosPendentes.forEach((item) => {
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    });
    return [...map.values()];
  }, [prontuariosPendentes]);

  const countEmAnaliseFiltrado = listaComFiltrosSemAba.filter((i) => isEmAnalise(i)).length;

  const handleExcluir = async (id) => {
    if (!podeExcluir) {
      alert(
        "Apenas Gestores ou Administradores podem excluir ordens de acompanhamento."
      );
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

  const handleReprocessarPendentes = async () => {
    if (loadingReprocessarPendentes) return;

    const pendentes = prontuariosPendentesUnicos;
    if (!pendentes.length) {
      alert("Nao existem prontuarios pendentes para reprocessar.");
      return;
    }

    const confirmou = window.confirm(
      `Confirma o reprocessamento de ${pendentes.length} prontuario(s) pendente(s)?`
    );
    if (!confirmou) return;

    setLoadingReprocessarPendentes(true);
    try {
      const { data: lote, error: errL } = await supabase
        .from("acompanhamento_lotes")
        .insert({
          status: "PROCESSANDO",
          qtd: pendentes.length,
          extra: {
            origem: "diesel_acompanhamento_pendentes",
            gerado_em: new Date().toISOString(),
            tipo: "prontuarios_pendentes_reprocesso",
          },
        })
        .select("id")
        .single();

      if (errL) throw errL;

      const itens = pendentes.map((item) => ({
        lote_id: lote.id,
        motorista_chapa: String(item.motorista_chapa || "").trim(),
        extra: {
          acompanhamento_id: item.id,
          motorista_nome: item.motorista_nome || null,
          prontuario_pendente: item.prontuario_pendente || null,
        },
      }));

      const { error: errI } = await supabase
        .from("acompanhamento_lote_itens")
        .insert(itens);
      if (errI) throw errI;

      await dispatchGitHubWorkflow(WF_ACOMP, {
        ordem_batch_id: String(lote.id),
        qtd: String(pendentes.length),
      });

      alert(`Lote #${lote.id} enviado para reprocessar ${pendentes.length} pendente(s).`);
      await carregarOrdens();
    } catch (e) {
      console.error(e);
      alert(e?.message || "Erro ao reprocessar prontuarios pendentes.");
    } finally {
      setLoadingReprocessarPendentes(false);
    }
  };

  const abrirCheckpoint = (item, tipo) => {
    const checkpointNormalizado = String(tipo || "").toUpperCase();
    const prontuarioPendente = String(item?.prontuario_pendente || "").toUpperCase();

    if (item?.id && prontuarioPendente && prontuarioPendente === checkpointNormalizado) {
      navigate(
        `/desempenho-diesel-checkpoint/${item.id}?checkpoint=${encodeURIComponent(checkpointNormalizado)}`
      );
      return;
    }

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
      if (abaAtiva === "AGUARDANDO") {
        matchAba = st === "AGUARDANDO_INSTRUTOR";
      } else if (abaAtiva === "MONITORAMENTO") {
        matchAba = st === "EM_MONITORAMENTO";
      } else if (abaAtiva === "ANALISE") {
        matchAba = isEmAnalise(item);
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
        abaAtiva === "AGUARDANDO"
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
          abaAtiva === "AGUARDANDO"
            ? a.created_at
            : a.dt_inicio_monitoramento || a.created_at;
        valB =
          abaAtiva === "AGUARDANDO"
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
    abaAtiva,
    filtroLinha,
    filtroStatus,
    filtroDataIni,
    filtroDataFim,
    sortConfig,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-5 font-sans text-slate-800">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200">
            <FaBolt className="text-amber-500" /> Operacao Diesel
          </div>
          <h1 className="mt-3 text-2xl font-black flex items-center gap-2 text-slate-800">
            <FaBolt className="text-yellow-500" /> Ordens de Acompanhamento
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-semibold">
            Gestão de ordens, checkpoints e análises pós-acompanhamento.
          </p>
        </div>

        <button
          onClick={carregarOrdens}
          className="px-4 py-2 rounded-xl bg-slate-800 text-white font-black hover:bg-slate-700 transition flex items-center gap-2 text-sm w-full md:w-auto justify-center"
        >
          <FaSync className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 h-full">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-700/80">Aguardando</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-2xl font-black text-slate-800">{countAguardando}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                filtrado: {countAguardandoFiltrado}
              </span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/80 border border-white/90 flex items-center justify-center text-amber-700">
            <FaClock className="text-lg" />
          </div>
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 h-full">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-blue-700/80">Monitoramento</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-2xl font-black text-slate-800">{countMonitoramento}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                filtrado: {countMonitoramentoFiltrado}
              </span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/80 border border-white/90 flex items-center justify-center text-blue-700">
            <FaRoad className="text-lg" />
          </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 h-full">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-rose-700/80">Prontuários Pendentes</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-2xl font-black text-slate-800">{countProntuariosPendentes}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                filtrado: {countProntuariosPendentesFiltrado}
              </span>
            </div>
            <div className="mt-3">
              <button
                onClick={handleReprocessarPendentes}
                disabled={loadingReprocessarPendentes || countProntuariosPendentes === 0}
                className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-black hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed transition inline-flex items-center gap-2"
              >
                <FaSync className={loadingReprocessarPendentes ? "animate-spin" : ""} />
                Reprocessar todos
              </button>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/80 border border-white/90 flex items-center justify-center text-rose-700">
            <FaClipboardList className="text-lg" />
          </div>
          </div>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 h-full">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-violet-700/80">Em Análise</p>
            <div className="flex items-end gap-2 flex-wrap">
              <p className="text-2xl font-black text-slate-800">{countEmAnalise}</p>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                filtrado: {countEmAnaliseFiltrado}
              </span>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-white/80 border border-white/90 flex items-center justify-center text-violet-700">
            <FaChartLine className="text-lg" />
          </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-2">
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl w-fit gap-1">
        <button
          onClick={() => {
            setAbaAtiva("AGUARDANDO");
            setSortConfig({ key: "data", direction: "desc" });
          }}
          className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
            abaAtiva === "AGUARDANDO"
              ? "bg-white shadow-sm text-amber-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📋 Aguardando
        </button>

        <button
          onClick={() => {
            setAbaAtiva("MONITORAMENTO");
            setSortConfig({ key: "data", direction: "desc" });
          }}
          className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
            abaAtiva === "MONITORAMENTO"
              ? "bg-white shadow-sm text-blue-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🛣️ Monitoramento
        </button>

        <button
          onClick={() => {
            setAbaAtiva("ANALISE");
            setSortConfig({ key: "data", direction: "desc" });
          }}
          className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
            abaAtiva === "ANALISE"
              ? "bg-white shadow-sm text-violet-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🧠 Análise Final
        </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Busca</label>
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar motorista ou chapa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Linha</label>
            <select
              value={filtroLinha}
              onChange={(e) => setFiltroLinha(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todas as linhas</option>
              <option value="Sem Linha">Sem Linha</option>
              {linhasUnicas
                .filter((x) => x !== "Sem Linha")
                .map((ln) => (
                  <option key={ln} value={ln}>
                    {ln}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Status</label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="">Todos os status</option>
              {statusUnicos.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">Período</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={filtroDataIni}
                onChange={(e) => setFiltroDataIni(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center md:justify-end">
            <button
              onClick={() => {
                setBusca("");
                setFiltroLinha("");
                setFiltroStatus("");
                setFiltroDataIni("");
                setFiltroDataFim("");
              }}
              className="px-4 py-2 rounded-xl font-black text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Limpar filtros
            </button>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 font-bold text-sm">
              <FaFilter /> {listaFiltrada.length} registro(s)
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left min-w-[1180px]">
          <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider select-none">
            <tr>
              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("data")}
              >
                <div className="flex items-center">
                  {abaAtiva === "AGUARDANDO" ? "Data Geração" : "Data Acomp."}
                  <SortIcon columnKey="data" />
                </div>
              </th>

              <th
                className="px-4 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("motorista")}
              >
                <div className="flex items-center">
                  Motorista <SortIcon columnKey="motorista" />
                </div>
              </th>

              <th
                className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("foco")}
              >
                <div className="flex items-center justify-center">
                  Foco <SortIcon columnKey="foco" />
                </div>
              </th>

              <th
                className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("etapa")}
              >
                <div className="flex items-center justify-center">
                  Etapa <SortIcon columnKey="etapa" />
                </div>
              </th>

              <th
                className="px-4 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center justify-center">
                  Status <SortIcon columnKey="status" />
                </div>
              </th>

              <th className="px-4 py-4 text-center">Sessões</th>
              <th className="px-4 py-4 text-center">Prontuário</th>
              <th className="px-4 py-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {listaFiltrada.map((item) => {
              const status = getStatusView(item);
              const foco = getFoco(item);
              const resumoSessoes = sessaoResumoByAcomp[item.id] || null;

              const dataRef =
                abaAtiva === "AGUARDANDO"
                  ? item.created_at
                  : item.dt_inicio_monitoramento || item.created_at;

              const isTimestamp = abaAtiva === "AGUARDANDO";
              const dataFormatada = formatarDataHoraBR(dataRef, !isTimestamp);
              const decisionTipo = getDecisionCheckpoint(item);

              return (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 text-gray-500 font-mono text-sm whitespace-nowrap">
                    {dataFormatada}
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-black text-slate-900 text-sm md:text-base">
                      {item.motorista_nome || "-"}
                    </div>
                    <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded w-fit mt-1 border border-slate-200">
                      {item.motorista_chapa || "-"}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold border whitespace-nowrap">
                      {foco}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                        {getEtapaLabel(item)}
                      </span>
                      {item?.dias_decorridos != null && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                          {n(item.dias_decorridos)} dias
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 whitespace-nowrap ${statusBadgeClass(
                        status
                      )}`}
                    >
                      {status}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    {resumoSessoes ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200 whitespace-nowrap">
                          {resumoSessoes.total} registro(s)
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap border ${
                            resumoSessoes.abertas > 0
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}
                        >
                          {resumoSessoes.abertas > 0
                            ? `${resumoSessoes.abertas} em aberto`
                            : "todas encerradas"}
                        </span>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {resumoSessoes.ultimaData
                            ? `ult. ${formatDateBR(resumoSessoes.ultimaData)}`
                            : "-"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">
                        Sem sessões
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {item?.prontuario_pendente ? (
                        <button
                          onClick={() =>
                            abrirCheckpoint(item, item.prontuario_pendente)
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-rose-600 text-white border-rose-600 hover:bg-rose-700 transition-all"
                        >
                          Realizar {getProntuarioPendenteLabel(item)}
                        </button>
                      ) : (
                        <span className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          {getProntuarioStatus(item)}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap justify-center gap-2 items-center min-w-[260px]">
                      <button
                        onClick={() => abrirPDF(item)}
                        className="flex items-center justify-center p-2 bg-white border border-rose-200 text-rose-600 rounded hover:bg-rose-50 shadow-sm transition-all"
                        title="Abrir PDF"
                      >
                        <FaFilePdf size={14} />
                      </button>

                      {abaAtiva === "AGUARDANDO" && (
                        <button
                          onClick={() => handleLancar(item)}
                          className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded font-bold text-xs shadow-sm transition-all transform hover:scale-105 whitespace-nowrap"
                        >
                          <FaPlay size={10} /> LANÇAR
                        </button>
                      )}

                      {abaAtiva === "AGUARDANDO" && podeExcluir && (
                        <button
                          onClick={() => handleExcluir(item.id)}
                          className="flex items-center justify-center p-2 bg-white border border-red-200 text-red-600 rounded hover:bg-red-50 shadow-sm transition-all"
                          title="Excluir Definitivamente"
                        >
                          <FaTrash size={14} />
                        </button>
                      )}

                      {(abaAtiva === "MONITORAMENTO" ||
                        abaAtiva === "ANALISE") && (
                        <button
                          onClick={() => abrirVisaoGeral(item)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded font-bold text-xs shadow-sm hover:bg-slate-700 transition-all whitespace-nowrap"
                        >
                          <FaEye size={12} /> Detalhes
                        </button>
                      )}

                      {abaAtiva === "ANALISE" &&
                        isCheckpointFinal30(decisionTipo) &&
                        status !== "OK" && (
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
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  <div className="text-sm font-bold">
                    Nenhum registro encontrado nesta aba.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
          onSessionSaved={carregarOrdens}
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
