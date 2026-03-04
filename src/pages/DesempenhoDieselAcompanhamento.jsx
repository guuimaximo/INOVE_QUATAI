import React, { useMemo, useState, useEffect, useContext } from "react";
import {
  FaBolt,
  FaSearch,
  FaFilePdf,
  FaSync,
  FaClock,
  FaHistory,
  FaClipboardList,
  FaRoad,
  FaSave,
  FaTimes,
  FaPlay,
  FaCheck,
  FaChartLine,
  FaTimes as FaX,
  FaQuestionCircle,
  FaTrash,
  FaEye,
} from "react-icons/fa";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";
import ResumoLancamentoInstrutor from "../components/desempenho/ResumoLancamentoInstrutor";
import ResumoAnalise from "../components/desempenho/ResumoAnalise";

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

function hasLancamento(item) {
  if (!item) return false;
  return Boolean(
    item?.intervencao_hora_inicio ||
      item?.dt_inicio_monitoramento ||
      item?.instrutor_login ||
      item?.instrutor_nome ||
      item?.intervencao_checklist ||
      (item?.intervencao_media_teste != null &&
        String(item?.intervencao_media_teste) !== "")
  );
}

function getFoco(item) {
  if (item?.motivo) return item.motivo;

  const m = item?.metadata;
  if (m?.foco) return m.foco;

  const cl = m?.cluster_foco;
  const ln = m?.linha_foco;
  if (cl && ln) return `${cl} - Linha ${ln}`;
  if (ln) return `Linha ${ln}`;

  return "Geral";
}

function getPdfUrl(item) {
  return item?.arquivo_pdf_url || item?.arquivo_pdf_path || null;
}

function spDateISO(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysISO(isoYMD, days) {
  const [y, m, d] = isoYMD.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function calcDiaXdeY(item) {
  const status = normalizeStatus(item?.status);
  if (status !== "EM_MONITORAMENTO") return null;

  const dtIni = item?.dt_inicio_monitoramento;
  const dias = n(item?.dias_monitoramento) || 10;
  if (!dtIni) return null;

  try {
    let str = String(dtIni).trim();
    let ano, mes, dia;

    if (str.includes("/")) {
      const p = str.split(" ")[0].split("/");
      dia = Number(p[0]);
      mes = Number(p[1]) - 1;
      ano = Number(p[2]);
    } else if (str.includes("-")) {
      const p = str.split("T")[0].split("-");
      ano = Number(p[0]);
      mes = Number(p[1]) - 1;
      dia = Number(p[2]);
    } else {
      return null;
    }

    if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return null;

    const utcIni = Date.UTC(ano, mes, dia);
    const hoje = new Date();
    const utcHoje = Date.UTC(
      hoje.getFullYear(),
      hoje.getMonth(),
      hoje.getDate()
    );

    const diffDays =
      Math.floor((utcHoje - utcIni) / (1000 * 60 * 60 * 24)) + 1;

    if (isNaN(diffDays)) return null;

    const diaCorrente = Math.min(Math.max(diffDays, 1), dias);
    return { dia: diaCorrente, dias };
  } catch {
    return null;
  }
}

function normGrupo(g) {
  const s = String(g || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, "_");

  if (
    s === "CONDUCAO_INTELIGENTE" ||
    s === "CONDUCAO" ||
    s === "CHECKLIST_CONDUCAO" ||
    s === "CONDUCAO_INTELIGENTE_"
  )
    return "CONDUCAO_INTELIGENTE";

  if (
    s === "AVALIACAO_TECNICA" ||
    s === "AVALIACAO" ||
    s === "TECNICA" ||
    s === "AVAL_TECNICA" ||
    s === "AVALIACAO_TECNICA_"
  )
    return "AVALIACAO_TECNICA";

  return s;
}

function isAtivo(v) {
  if (v === true) return true;
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "t" || s === "1" || s === "sim" || s === "yes";
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

// =============================================================================
// OPÇÕES / NÍVEIS
// =============================================================================
const TEC_OPCOES = [
  {
    value: "SIM",
    label: "Sim",
    icon: FaCheck,
    cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  {
    value: "NAO",
    label: "Não",
    icon: FaX,
    cls: "bg-rose-50 border-rose-200 text-rose-700",
  },
  {
    value: "DUVIDAS",
    label: "Dúvidas",
    icon: FaQuestionCircle,
    cls: "bg-amber-50 border-amber-200 text-amber-700",
  },
];

const NIVEIS = {
  1: {
    label: "Nível 1 (Leve)",
    dias: 5,
    color: "bg-blue-50 border-blue-200 text-blue-700",
  },
  2: {
    label: "Nível 2 (Médio)",
    dias: 10,
    color: "bg-amber-50 border-amber-200 text-amber-700",
  },
  3: {
    label: "Nível 3 (Crítico)",
    dias: 15,
    color: "bg-rose-50 border-rose-200 text-rose-700",
  },
};

// =============================================================================
// COMPONENTE PRINCIPAL
// =============================================================================
export default function DesempenhoDieselAcompanhamento() {
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [lista, setLista] = useState([]);

  // Permissões
  const [userRoleData, setUserRoleData] = useState({ nivel: null, nome_completo: null });
  const podeExcluir = ["Administrador", "Gestor"].includes(userRoleData.nivel);

  // Itens do checklist (dinâmico)
  const [itensConducao, setItensConducao] = useState([]);
  const [itensTecnica, setItensTecnica] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [itensError, setItensError] = useState("");

  // Filtros & Abas
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("AGUARDANDO");

  // Modais
  const [modalLancarOpen, setModalLancarOpen] = useState(false);
  const [modalVisaoGeralOpen, setModalVisaoGeralOpen] = useState(false); // NOVO MODAL UNIFICADO
  
  // Modais Legado mantidos para compatibilidade do código
  const [modalConsultaOpen, setModalConsultaOpen] = useState(false);
  const [modalDetalhesOpen, setModalDetalhesOpen] = useState(false);
  const [modalAnaliseOpen, setModalAnaliseOpen] = useState(false);
  
  const [itemSelecionado, setItemSelecionado] = useState(null);

  // Histórico
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // Formulário
  const [form, setForm] = useState({
    horaInicio: "",
    horaFim: "",
    kmInicio: "",
    kmFim: "",
    mediaTeste: "",
    nivel: 2,
    obs: "",
    checklistConducao: {},
    avaliacaoTecnica: {},
  });

  // =============================================================================
  // CARGA DE DADOS DO USUÁRIO
  // =============================================================================
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

  // =============================================================================
  // CARGA DE ITENS DO CHECKLIST (SUPABASE) - COM PONTUAÇÕES
  // =============================================================================
  async function carregarItensChecklist() {
    setLoadingItens(true);
    setItensError("");
    try {
      const { data, error } = await supabase
        .from("diesel_checklist_itens")
        .select(`
          id, ordem, grupo, codigo, descricao, ajuda, tipo_resposta, ativo,
          pontos_true_100, pontos_false_100, pontos_max_100,
          opcao_score_sim, opcao_score_duvidas, opcao_score_nao
        `)
        .order("ordem", { ascending: true });

      if (error) throw error;

      const ativos = (data || []).filter((x) => isAtivo(x.ativo));

      const condu = ativos
        .map((x) => ({ ...x, grupo_norm: normGrupo(x.grupo) }))
        .filter((x) => x.grupo_norm === "CONDUCAO_INTELIGENTE")
        .sort((a, b) => n(a.ordem) - n(b.ordem));

      const tec = ativos
        .map((x) => ({ ...x, grupo_norm: normGrupo(x.grupo) }))
        .filter((x) => x.grupo_norm === "AVALIACAO_TECNICA")
        .sort((a, b) => n(a.ordem) - n(b.ordem));

      setItensConducao(condu);
      setItensTecnica(tec);

      if (condu.length === 0 || tec.length === 0) {
        const grupos = Array.from(
          new Set((ativos || []).map((x) => String(x.grupo || "").trim()))
        );
        console.log("[diesel_checklist_itens] grupos encontrados:", grupos);
      }
    } catch (e) {
      console.error("Erro ao carregar itens checklist:", e?.message || e);
      setItensConducao([]);
      setItensTecnica([]);
      setItensError(e?.message ? String(e.message) : String(e));
    } finally {
      setLoadingItens(false);
    }
  }

  useEffect(() => {
    carregarItensChecklist();
  }, []);

  function buildEmptyRespostas(conducaoList, tecnicaList) {
    const c = {};
    (conducaoList || []).forEach((it) => (c[it.codigo] = null));
    const t = {};
    (tecnicaList || []).forEach((it) => (t[it.codigo] = ""));
    return { c, t };
  }

  // =============================================================================
  // CARGA DE ORDENS
  // =============================================================================
  async function carregarOrdens() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("diesel_acompanhamentos")
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

  // =============================================================================
  // CONTADORES
  // =============================================================================
  const countAguardando = lista.filter(
    (i) => normalizeStatus(i.status) === "AGUARDANDO_INSTRUTOR"
  ).length;

  const countMonitoramento = lista.filter(
    (i) => normalizeStatus(i.status) === "EM_MONITORAMENTO"
  ).length;

  const countConcluido = lista.filter((i) =>
    ["OK", "ENCERRADO", "ATAS"].includes(normalizeStatus(i.status))
  ).length;

  // =============================================================================
  // AÇÕES
  // =============================================================================
  const handleConsultar = async (item) => {
    setItemSelecionado(item);
    setModalConsultaOpen(true);
    setLoadingHist(true);

    try {
      const { data, error } = await supabase
        .from("diesel_acompanhamentos")
        .select("*")
        .eq("motorista_chapa", item.motorista_chapa)
        .neq("id", item.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setHistorico(data || []);
    } catch {
      setHistorico([]);
    } finally {
      setLoadingHist(false);
    }
  };

  const handleDetalhes = (item) => {
    setItemSelecionado(item);
    setModalDetalhesOpen(true);
  };

  const abrirVisaoGeral = async (item) => {
    setItemSelecionado(item);
    setModalVisaoGeralOpen(true);
    setLoadingHist(true);

    try {
      const { data, error } = await supabase
        .from("diesel_acompanhamentos")
        .select("*")
        .eq("motorista_chapa", item.motorista_chapa)
        .neq("id", item.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setHistorico(data || []);
    } catch {
      setHistorico([]);
    } finally {
      setLoadingHist(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!podeExcluir) {
      alert("Apenas Gestores ou Administradores podem excluir ordens de acompanhamento.");
      return;
    }
    const confirm = window.confirm("ATENÇÃO! Tem certeza que deseja excluir este acompanhamento definitivamente?");
    if (!confirm) return;

    try {
      await supabase.from("diesel_checklist_respostas").delete().eq("acompanhamento_id", id);
      const { error } = await supabase.from("diesel_acompanhamentos").delete().eq("id", id);
      if (error) throw error;
      
      alert("Acompanhamento excluído com sucesso!");
      carregarOrdens();
    } catch (e) {
      alert("Erro ao excluir: " + (e?.message || String(e)));
    }
  };

  const handleLancar = async (item) => {
    setItemSelecionado(item);

    if (!loadingItens && (itensConducao.length === 0 && itensTecnica.length === 0)) {
      await carregarItensChecklist();
    }

    const { c, t } = buildEmptyRespostas(itensConducao, itensTecnica);

    setForm({
      horaInicio: "",
      horaFim: "",
      kmInicio: "",
      kmFim: "",
      mediaTeste: "",
      nivel: 2,
      obs: "",
      checklistConducao: c,
      avaliacaoTecnica: t,
    });

    setModalLancarOpen(true);
  };

  const setConducao = (codigo, val) =>
    setForm((prev) => ({
      ...prev,
      checklistConducao: { ...prev.checklistConducao, [codigo]: val },
    }));

  const setTecnica = (codigo, val) =>
    setForm((prev) => ({
      ...prev,
      avaliacaoTecnica: { ...prev.avaliacaoTecnica, [codigo]: val },
    }));

  // =============================================================================
  // SALVAR (ATUALIZA ACOMPANHAMENTO + GRAVA RESPOSTAS)
  // =============================================================================
  const salvarIntervencao = async () => {
    if (!itemSelecionado?.id) return;
    if (!form.horaInicio || !form.kmInicio || !form.mediaTeste) {
      alert("Preencha: Hora Início, KM Início e Média do Teste.");
      return;
    }

    const dias = NIVEIS[form.nivel]?.dias || 10;
    const inicioISO = spDateISO(new Date());
    const fimISO = addDaysISO(inicioISO, dias - 1);

    // AUDITORIA (AuthContext)
    const instrutorLogin = user?.login || user?.email || null;
    const instrutorNome = buildNomeSobrenome(user) || userRoleData?.nome_completo || instrutorLogin;

    // CÁLCULO DA NOTA
    let notaTotal = 0;
    const mapByCodigo = new Map();
    [...itensConducao, ...itensTecnica].forEach((it) => mapByCodigo.set(it.codigo, it));

    Object.entries(form.checklistConducao || {}).forEach(([codigo, val]) => {
      const it = mapByCodigo.get(codigo);
      if (!it) return;
      if (val === true) notaTotal += n(it.pontos_true_100);
      if (val === false) notaTotal += n(it.pontos_false_100);
    });

    Object.entries(form.avaliacaoTecnica || {}).forEach(([codigo, val]) => {
      const it = mapByCodigo.get(codigo);
      if (!it) return;
      const maxPts = n(it.pontos_max_100);
      if (val === "SIM") notaTotal += maxPts * n(it.opcao_score_sim);
      if (val === "DUVIDAS") notaTotal += maxPts * n(it.opcao_score_duvidas);
      if (val === "NAO") notaTotal += maxPts * n(it.opcao_score_nao);
    });

    const notaFinal = Math.round(Math.max(0, Math.min(100, notaTotal)));

    try {
      const intervencaoChecklist = {
        versao: "FORM_ACOMPANHAMENTO_TELEMETRIA_v2",
        itens: {
          ...(form.checklistConducao || {}),
          ...(form.avaliacaoTecnica || {}),
        },
        conducao: form.checklistConducao || {},
        tecnica: form.avaliacaoTecnica || {},
        nota_calculada: notaFinal,
      };

      const payload = {
        status: "EM_MONITORAMENTO",
        nivel: form.nivel,
        dias_monitoramento: dias,
        dt_inicio_monitoramento: inicioISO,
        dt_fim_previsao: fimISO,
        instrutor_login: instrutorLogin,
        instrutor_nome: instrutorNome,
        intervencao_hora_inicio: form.horaInicio,
        intervencao_hora_fim: form.horaFim || null,
        intervencao_km_inicio: n(form.kmInicio),
        intervencao_km_fim: form.kmFim ? n(form.kmFim) : null,
        intervencao_media_teste: n(form.mediaTeste),
        intervencao_checklist: intervencaoChecklist,
        intervencao_obs: form.obs || null,
        intervencao_nota: notaFinal, 
        updated_at: new Date().toISOString(),
      };

      const { error: errUpd } = await supabase
        .from("diesel_acompanhamentos")
        .update(payload)
        .eq("id", itemSelecionado.id);

      if (errUpd) throw errUpd;

      // Apaga respostas anteriores
      const { error: errDel } = await supabase
        .from("diesel_checklist_respostas")
        .delete()
        .eq("acompanhamento_id", itemSelecionado.id);

      if (errDel) throw errDel;

      const rows = [];

      Object.entries(form.checklistConducao || {}).forEach(([codigo, val]) => {
        const it = mapByCodigo.get(codigo);
        if (!it?.id) return;
        if (val === true || val === false) {
          rows.push({
            acompanhamento_id: itemSelecionado.id,
            checklist_item_id: it.id,
            valor_bool: val,
            valor_text: null,
            versao: "FORM_ACOMPANHAMENTO_TELEMETRIA_v2",
            respondido_por_login: instrutorLogin,
            respondido_por_nome: instrutorNome,
            origem: "LANCAMENTO_INSTRUTOR",
            updated_at: new Date().toISOString(),
          });
        }
      });

      Object.entries(form.avaliacaoTecnica || {}).forEach(([codigo, val]) => {
        const it = mapByCodigo.get(codigo);
        if (!it?.id) return;
        const v = String(val || "").trim();
        if (v) {
          rows.push({
            acompanhamento_id: itemSelecionado.id,
            checklist_item_id: it.id,
            valor_bool: null,
            valor_text: v,
            versao: "FORM_ACOMPANHAMENTO_TELEMETRIA_v2",
            respondido_por_login: instrutorLogin,
            respondido_por_nome: instrutorNome,
            origem: "LANCAMENTO_INSTRUTOR",
            updated_at: new Date().toISOString(),
          });
        }
      });

      if (rows.length > 0) {
        const { error: errIns } = await supabase
          .from("diesel_checklist_respostas")
          .insert(rows);

        if (errIns) throw errIns;
      }

      setModalLancarOpen(false);
      await carregarOrdens();
      alert(`Monitoramento iniciado com sucesso!\nNota Final do Check-list: ${notaFinal}/100`);
    } catch (e) {
      alert("Erro ao salvar: " + (e?.message || String(e)));
    }
  };

  // =============================================================================
  // FILTROS COM ABAS
  // =============================================================================
  const listaFiltrada = useMemo(() => {
    const q = busca.toLowerCase().trim();

    return (lista || []).filter((item) => {
      const nome = String(item.motorista_nome || "").toLowerCase();
      const chapa = String(item.motorista_chapa || "");
      const matchTexto = !q || nome.includes(q) || chapa.includes(q);
      const st = normalizeStatus(item.status);

      if (abaAtiva === "AGUARDANDO") return matchTexto && st === "AGUARDANDO_INSTRUTOR";
      if (abaAtiva === "MONITORAMENTO") return matchTexto && st === "EM_MONITORAMENTO";
      if (abaAtiva === "CONCLUIDOS") return matchTexto && ["OK", "ENCERRADO", "ATAS"].includes(st);
      return matchTexto;
    });
  }, [lista, busca, abaAtiva]);

  const abrirPDF = (item) => {
    const url = getPdfUrl(item);
    if (!url) {
      alert("PDF não disponível para este registro.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <FaBolt className="text-yellow-500" /> Gestão de Ordens de Acompanhamento
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Ordens geradas automaticamente — prontas para ação do instrutor.
          </p>
        </div>

        <button
          onClick={carregarOrdens}
          className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50 flex items-center gap-2 text-sm font-bold w-full md:w-auto justify-center"
          title="Atualizar"
        >
          <FaSync className={loading ? "animate-spin" : ""} /> Atualizar
        </button>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Aguardando</p>
            <p className="text-2xl font-black text-slate-800">{countAguardando}</p>
          </div>
          <FaClock className="text-4xl text-amber-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Monitoramento</p>
            <p className="text-2xl font-black text-slate-800">{countMonitoramento}</p>
          </div>
          <FaRoad className="text-4xl text-blue-50" />
        </div>

        <div className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-sm text-gray-500 font-bold">Concluídos / Atas</p>
            <p className="text-2xl font-black text-slate-800">{countConcluido}</p>
          </div>
          <FaCheck className="text-4xl text-emerald-50" />
        </div>
      </div>

      {/* TABS RESPONSIVAS */}
      <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-lg w-fit gap-1">
        <button
          onClick={() => setAbaAtiva("AGUARDANDO")}
          className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
            abaAtiva === "AGUARDANDO"
              ? "bg-white shadow-sm text-amber-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          📋 Aguardando
        </button>
        <button
          onClick={() => setAbaAtiva("MONITORAMENTO")}
          className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
            abaAtiva === "MONITORAMENTO"
              ? "bg-white shadow-sm text-blue-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          🛣️ Monitoramento
        </button>
        <button
          onClick={() => setAbaAtiva("CONCLUIDOS")}
          className={`px-4 md:px-6 py-2 rounded-md text-sm md:text-base font-bold transition-all ${
            abaAtiva === "CONCLUIDOS"
              ? "bg-white shadow-sm text-emerald-700"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          ✅ Concluídos
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex gap-4 mb-2 items-center bg-white p-3 md:p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar Motorista..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 p-2.5 border rounded-lg w-full text-sm outline-none focus:border-blue-500 font-medium"
          />
        </div>

        <div className="ml-auto text-sm text-gray-500 font-medium hidden md:block">
          Mostrando <b>{listaFiltrada.length}</b> registros
        </div>
      </div>

      {/* TABELA RESPONSIVA */}
      <div className="bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead className="bg-slate-50 text-slate-600 font-extrabold border-b text-xs md:text-sm uppercase tracking-wider">
            <tr>
              <th className="px-4 py-4">{abaAtiva === "AGUARDANDO" ? "Data Geração" : "Data Acomp."}</th>
              <th className="px-4 py-4">Motorista</th>
              <th className="px-4 py-4 text-center">Foco</th>
              <th className="px-4 py-4 text-center">Status Atual</th>
              <th className="px-4 py-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {listaFiltrada.map((item) => {
              const status = normalizeStatus(item.status);
              const foco = getFoco(item);
              const diaXY = calcDiaXdeY(item);
              const dataExibicao = abaAtiva === "AGUARDANDO" ? item.created_at : item.dt_inicio_monitoramento;

              return (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-4 py-4 text-gray-500 font-mono text-sm whitespace-nowrap">
                    {dataExibicao ? new Date(dataExibicao).toLocaleDateString() : "-"}
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-black text-slate-900 text-sm md:text-base">{item.motorista_nome || "-"}</div>
                    <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-0.5 rounded w-fit mt-1 border border-slate-200">
                      {item.motorista_chapa || "-"}
                    </div>
                    {n(item.perda_litros) >= 80 && (
                      <div className="mt-1 inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded border bg-rose-50 border-rose-200 text-rose-700">
                        PRIORIDADE ALTA
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 text-center">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold border whitespace-nowrap">
                      {foco}
                    </span>
                  </td>

                  <td className="px-4 py-4 text-center">
                    {status === "AGUARDANDO_INSTRUTOR" ? (
                      <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold border border-amber-200 inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                        <FaClock /> AGUARDANDO
                      </span>
                    ) : status === "EM_MONITORAMENTO" ? (
                      <div className="flex flex-col items-center">
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-xs font-bold border border-blue-200 whitespace-nowrap">
                          MONITORAMENTO
                        </span>
                        {diaXY ? (
                          <span className="text-[10px] font-bold text-gray-500 mt-1 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                            Dia {diaXY.dia} / {diaXY.dias}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 mt-1 whitespace-nowrap">
                            Monitoramento ativo
                          </span>
                        )}
                      </div>
                    ) : (
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 whitespace-nowrap ${
                          status === "ATAS"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {status === "ATAS" ? <FaX /> : <FaCheck />} {status}
                      </span>
                    )}
                  </td>

                  <td className="px-4 py-4">
                    {/* BOTÕES LADO A LADO E FLEX-WRAP PARA TABLET */}
                    <div className="flex flex-wrap justify-center gap-2 items-center min-w-[120px]">
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

                      {(abaAtiva === "MONITORAMENTO" || abaAtiva === "CONCLUIDOS") && (
                        <button
                          onClick={() => abrirVisaoGeral(item)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white rounded font-bold text-xs shadow-sm hover:bg-slate-700 transition-all whitespace-nowrap"
                          title="Visão Geral do Prontuário e Histórico"
                        >
                          <FaEye size={12} /> Prontuário
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {listaFiltrada.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="text-sm font-bold">Nenhum registro encontrado nesta aba.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =========================================================================================
          NOVO MODAL UNIFICADO: VISÃO GERAL (Prontuário + Detalhes + Análise + Histórico)
      ========================================================================================= */}
      {modalVisaoGeralOpen && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50 sticky top-0 z-10">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FaClipboardList /> Prontuário Unificado de Acompanhamento
              </h3>
              <button onClick={() => setModalVisaoGeralOpen(false)}>
                <FaTimes className="text-gray-400 hover:text-red-500 text-xl" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* CABEÇALHO DO MOTORISTA */}
              <div className="p-4 bg-slate-100 rounded-lg border flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Motorista</div>
                  <div className="font-black text-slate-800 text-lg">{itemSelecionado.motorista_nome || "-"}</div>
                  <div className="font-mono text-slate-500 text-sm">{itemSelecionado.motorista_chapa || "-"}</div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Foco Principal</div>
                  <div className="font-bold text-slate-700 bg-white px-3 py-1 rounded border shadow-sm inline-block">
                    {getFoco(itemSelecionado)}
                  </div>
                </div>
              </div>

              {/* CONTEÚDO DIVIDIDO EM DUAS COLUNAS EM TELAS MAIORES */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* LADO ESQUERDO: DETALHES DA ORDEM SELECIONADA */}
                <div className="lg:col-span-2 border rounded-lg p-4 md:p-5 bg-white shadow-sm">
                  <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <FaEye className="text-blue-600" /> Resumo da Ordem Atual
                  </h4>
                  {normalizeStatus(itemSelecionado.status) === "EM_MONITORAMENTO" ? (
                    <ResumoLancamentoInstrutor item={itemSelecionado} />
                  ) : (
                    <ResumoAnalise item={itemSelecionado} />
                  )}
                </div>

                {/* LADO DIREITO: HISTÓRICO DO MOTORISTA */}
                <div className="border rounded-lg p-4 md:p-5 bg-slate-50 shadow-sm h-fit">
                  <h4 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <FaHistory className="text-slate-500" /> Histórico Pregresso
                  </h4>
                  
                  {loadingHist ? (
                    <div className="text-sm text-slate-500 font-medium">Buscando ocorrências...</div>
                  ) : historico.length === 0 ? (
                    <div className="text-sm text-slate-500 font-medium">Nenhum registro anterior encontrado.</div>
                  ) : (
                    <div className="space-y-3">
                      {historico.map((h) => (
                        <div key={h.id} className="p-3 border rounded-lg bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-bold text-slate-700 text-sm">
                              {h.created_at ? new Date(h.created_at).toLocaleDateString() : "-"}
                            </div>
                            <div className="font-bold text-[10px] px-2 py-0.5 bg-slate-100 border text-slate-600 rounded">
                              {normalizeStatus(h.status)}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500 leading-relaxed">
                            Foco: {getFoco(h)} <br />
                            Nível: {h.nivel ?? "-"} • Dias: {h.dias_monitoramento ?? "-"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================================
          MODAIS LEGADO MANTIDOS EXATAMENTE COMO ESTAVAM PARA PRESERVAR A INTEGRIDADE DO CÓDIGO
      ========================================================================================= */}
      
      {/* MODAL DETALHES (Antigo) */}
      {modalDetalhesOpen && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FaClipboardList /> Detalhes do Lançamento
              </h3>
              <button onClick={() => setModalDetalhesOpen(false)}>
                <FaTimes className="text-gray-400 hover:text-red-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg border bg-slate-50">
                <div className="text-sm">
                  <span className="font-bold text-slate-700">Motorista:</span>{" "}
                  {itemSelecionado.motorista_nome || "-"}{" "}
                  <span className="text-slate-400 font-mono">
                    ({itemSelecionado.motorista_chapa || "-"})
                  </span>
                </div>
                <div className="text-sm">
                  <span className="font-bold text-slate-700">Foco:</span>{" "}
                  {getFoco(itemSelecionado)}
                </div>
              </div>

              <ResumoLancamentoInstrutor item={itemSelecionado} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL ANÁLISE (Antigo) */}
      {modalAnaliseOpen && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FaChartLine className="text-purple-600" /> Análise Final do Monitoramento
              </h3>
              <button onClick={() => setModalAnaliseOpen(false)}>
                <FaTimes className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 text-sm bg-slate-100 p-3 rounded border">
                <span className="font-bold text-slate-700">Motorista:</span>{" "}
                {itemSelecionado.motorista_nome || "-"}{" "}
                <span className="font-mono text-slate-500">
                  ({itemSelecionado.motorista_chapa || "-"})
                </span>
              </div>
              <ResumoAnalise item={itemSelecionado} />
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONSULTA (Antigo) */}
      {modalConsultaOpen && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FaHistory /> Histórico do Motorista
              </h3>
              <button onClick={() => setModalConsultaOpen(false)}>
                <FaTimes className="text-gray-400 hover:text-red-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg border bg-slate-50">
                <div className="text-sm">
                  <span className="font-bold text-slate-700">Motorista:</span>{" "}
                  {itemSelecionado.motorista_nome || "-"}{" "}
                  <span className="text-slate-400 font-mono">
                    ({itemSelecionado.motorista_chapa || "-"})
                  </span>
                </div>
              </div>

              {loadingHist ? (
                <div className="p-3 rounded border bg-slate-50 text-sm text-slate-500">
                  Carregando histórico...
                </div>
              ) : historico.length === 0 ? (
                <div className="p-3 rounded border bg-slate-50 text-sm text-slate-500">
                  Nenhum histórico encontrado.
                </div>
              ) : (
                <div className="space-y-2">
                  {historico.map((h) => (
                    <div key={h.id} className="p-3 border rounded bg-white">
                      <div className="text-sm font-bold text-slate-800">
                        {h.created_at ? new Date(h.created_at).toLocaleString() : "-"} •{" "}
                        {normalizeStatus(h.status)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Foco: {getFoco(h)} • Nível {h.nivel ?? "-"} • {h.dias_monitoramento ?? "-"} dias
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================================
          MODAL LANÇAR (Permanece Intacto)
      ========================================================================================= */}
      {modalLancarOpen && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center p-5 border-b bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                <FaRoad /> Lançar Intervenção Técnica
              </h3>
              <button onClick={() => setModalLancarOpen(false)}>
                <FaTimes className="text-gray-400 hover:text-red-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {itensError ? (
                <div className="p-3 rounded border bg-rose-50 text-sm text-rose-700">
                  Erro ao carregar checklist: <b>{itensError}</b>
                </div>
              ) : null}

              <div className="p-4 border rounded-lg bg-gray-50">
                <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                  <FaClock /> Dados da Viagem de Teste (Prova)
                </h4>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500">Hora Início *</label>
                    <input
                      type="time"
                      value={form.horaInicio}
                      onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500">Hora Fim</label>
                    <input
                      type="time"
                      value={form.horaFim}
                      onChange={(e) => setForm({ ...form, horaFim: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500">KM Início *</label>
                    <input
                      type="number"
                      value={form.kmInicio}
                      onChange={(e) => setForm({ ...form, kmInicio: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-500">KM Fim</label>
                    <input
                      type="number"
                      value={form.kmFim}
                      onChange={(e) => setForm({ ...form, kmFim: e.target.value })}
                      className="w-full p-2 border rounded text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-xs font-bold text-blue-600">
                    MÉDIA REALIZADA NO TESTE (KM/L) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mediaTeste}
                    onChange={(e) => setForm({ ...form, mediaTeste: e.target.value })}
                    className="w-full p-2 border border-blue-300 rounded text-sm font-bold text-blue-800 bg-blue-50"
                    placeholder="Ex: 2.80"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                  <FaClipboardList /> Checklist de Condução (Resumo Operacional)
                </h4>

                {loadingItens ? (
                  <div className="p-3 rounded border bg-slate-50 text-sm text-slate-500">
                    Carregando checklist...
                  </div>
                ) : itensConducao.length === 0 ? (
                  <div className="p-3 rounded border bg-amber-50 text-sm text-amber-700">
                    Nenhum item encontrado para o grupo <b>CONDUCAO_INTELIGENTE</b>.
                    <div className="mt-1 text-[11px] text-amber-700/80">
                      (Se você já inseriu no banco, é quase certeza que o campo <b>grupo</b> está com
                      texto diferente. O código agora está tolerante, então se ainda estiver vazio,
                      o problema tende a ser RLS/SELECT ou a tabela está vazia mesmo.)
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {itensConducao.map((it) => {
                      const val = form.checklistConducao?.[it.codigo];
                      return (
                        <div key={it.id} className="p-3 border rounded-lg bg-white">
                          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-extrabold text-slate-700">
                                {String(it.ordem).padStart(2, "0")} • {it.descricao}
                              </div>
                              {it.ajuda ? (
                                <div className="text-sm text-slate-600">{it.ajuda}</div>
                              ) : null}
                            </div>

                            <div className="flex gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setConducao(it.codigo, true)}
                                className={`px-3 py-2 rounded border text-xs font-bold transition ${
                                  val === true
                                    ? "bg-emerald-600 text-white border-emerald-700"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                SIM
                              </button>

                              <button
                                type="button"
                                onClick={() => setConducao(it.codigo, false)}
                                className={`px-3 py-2 rounded border text-xs font-bold transition ${
                                  val === false
                                    ? "bg-rose-600 text-white border-rose-700"
                                    : "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                                }`}
                              >
                                NÃO
                              </button>
                            </div>
                          </div>

                          {val === null && (
                            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                              Selecione SIM ou NÃO
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-700 text-sm mb-3">
                  Avaliação Técnica (Sistemas)
                </h4>

                {loadingItens ? (
                  <div className="p-3 rounded border bg-slate-50 text-sm text-slate-500">
                    Carregando avaliação técnica...
                  </div>
                ) : itensTecnica.length === 0 ? (
                  <div className="p-3 rounded border bg-amber-50 text-sm text-amber-700">
                    Nenhum item encontrado para o grupo <b>AVALIACAO_TECNICA</b>.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {itensTecnica.map((q) => {
                      const v = form.avaliacaoTecnica?.[q.codigo] || "";
                      return (
                        <div key={q.id} className="p-3 border rounded-lg bg-gray-50">
                          <div className="text-sm text-slate-700 font-semibold mb-2">
                            {String(q.ordem).padStart(2, "0")} • {q.descricao}
                          </div>
                          {q.ajuda ? (
                            <div className="text-xs text-slate-500 mb-2">{q.ajuda}</div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {TEC_OPCOES.map((op) => {
                              const Icon = op.icon;
                              const active = v === op.value;
                              return (
                                <button
                                  key={op.value}
                                  type="button"
                                  onClick={() => setTecnica(q.codigo, op.value)}
                                  className={`px-3 py-2 rounded border text-xs font-bold transition inline-flex items-center gap-2 ${
                                    active
                                      ? "bg-slate-900 text-white border-slate-900"
                                      : `${op.cls} hover:brightness-95`
                                  }`}
                                >
                                  <Icon /> {op.label}
                                </button>
                              );
                            })}
                          </div>

                          {!v && (
                            <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                              Selecione uma opção
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-700 text-sm mb-3">
                  Definir Nível (Contrato)
                </h4>

                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setForm({ ...form, nivel: lvl })}
                      className={`p-3 rounded-lg border text-center transition ${
                        form.nivel === lvl
                          ? "ring-2 ring-offset-1 ring-slate-400 bg-white"
                          : NIVEIS[lvl].color
                      }`}
                      type="button"
                    >
                      <div className="font-bold">{NIVEIS[lvl].label}</div>
                      <div className="text-xs opacity-80">{NIVEIS[lvl].dias} dias</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">
                  Observação do Instrutor (opcional)
                </label>
                <textarea
                  rows={3}
                  value={form.obs}
                  onChange={(e) => setForm({ ...form, obs: e.target.value })}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="Ex.: ajustes aplicados e pontos observados..."
                />
              </div>

              <button
                onClick={salvarIntervencao}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md flex justify-center items-center gap-2 transition"
              >
                <FaSave /> SALVAR E INICIAR MONITORAMENTO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
