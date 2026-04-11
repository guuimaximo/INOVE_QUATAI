// src/pages/SOSCentral.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaSearch,
  FaEye,
  FaTimes,
  FaLock,
  FaEdit,
  FaSave,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaBus,
  FaCalendarAlt,
  FaTools,
  FaInbox,
  FaWrench,
  FaRoad,
} from "react-icons/fa";

/* =======================
   AJUSTES GERAIS
======================= */
const OCORRENCIAS_CARDS = [
  "SOS",
  "RECOLHEU",
  "TROCA",
  "AVARIA",
  "IMPROCEDENTE",
  "SEGUIU VIAGEM",
];

const DATE_FIELD = "data_sos";

function pickBestDate(row) {
  return (
    row?.[DATE_FIELD] ||
    row?.data_sos ||
    row?.data_fechamento ||
    row?.data_encerramento ||
    row?.created_at ||
    null
  );
}

function parseToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, dd, mm, yyyy] = br;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const isoDate = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const [, yyyy, mm, dd] = isoDate;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateBR(value) {
  const d = parseToDate(value);
  return d ? d.toLocaleDateString("pt-BR") : "—";
}

function monthRange(yyyyMm) {
  if (!yyyyMm) return { start: "", end: "" };
  const [y, m] = yyyyMm.split("-").map(Number);
  const pad2 = (n) => String(n).padStart(2, "0");
  const start = `${y}-${pad2(m)}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${pad2(m)}-${pad2(lastDay)}`;
  return { start, end };
}

function calcularDiasDecorridos(dataInicio, dataFim) {
    if (!dataInicio || !dataFim) return null;
    const dt1 = new Date(`${dataInicio}T00:00:00`);
    const dt2 = new Date(`${dataFim}T00:00:00`);
    if (Number.isNaN(dt1.getTime()) || Number.isNaN(dt2.getTime())) return null;
    
    dt1.setHours(0, 0, 0, 0);
    dt2.setHours(0, 0, 0, 0);
    
    const diffMs = dt2.getTime() - dt1.getTime();
    return Math.max(0, Math.floor(diffMs / 86400000));
}

/* =======================
   STATUS E TAGS
======================= */
const cores = {
  SOS: "bg-rose-600 text-white",
  RECOLHEU: "bg-blue-600 text-white",
  TROCA: "bg-amber-400 text-amber-900",
  AVARIA: "bg-slate-700 text-white",
  IMPROCEDENTE: "bg-purple-600 text-white",
  "SEGUIU VIAGEM": "bg-emerald-600 text-white",
};

function StatusTag({ status }) {
  const s = String(status || "").toUpperCase().trim();
  if (s === "ABERTO") return <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">AG. OPERAÇÃO</span>;
  if (s === "EM ANDAMENTO") return <span className="bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">AG. MANUTENÇÃO</span>;
  if (s === "FECHADO") return <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">FECHADO</span>;
  return null;
}

function OcorrenciaTag({ ocorrencia }) {
  const o = (ocorrencia || "").toUpperCase();
  const estilo = cores[o] || "bg-slate-200 text-slate-700";
  return (
    <span className={`${estilo} px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm`}>
      {o || "—"}
    </span>
  );
}

/* --- Modal de Login --- */
function LoginModal({ onConfirm, onCancel, title = "Acesso Restrito" }) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("*")
      .eq("login", login)
      .eq("senha", senha)
      .eq("ativo", true)
      .single();
    setLoading(false);

    if (error || !data) {
      alert("Login ou senha incorretos!");
      return;
    }
    onConfirm({ nome: data.nome, login: data.login });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-[60] animate-in fade-in duration-200 p-4">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-3">
            <FaLock size={20} />
          </div>
          <h2 className="text-xl font-black text-slate-800 text-center">{title}</h2>
          <p className="text-xs text-slate-500 text-center mt-1">Insira suas credenciais de aprovação para editar</p>
        </div>
        
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Login"
            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
          <input
            type="password"
            placeholder="Senha"
            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">
            Cancelar
          </button>
          <button onClick={handleLogin} disabled={loading} className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-md disabled:opacity-70">
            {loading ? "Verificando..." : "Entrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Modal de Detalhes do SOS --- */
function DetalheSOSModal({ sos, onClose, onAtualizar }) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  
  // Histórico puxado dinamicamente da tabela 'preventivas'
  const [historicoPrev, setHistoricoPrev] = useState(null);
  const [historicoInsp, setHistoricoInsp] = useState(null);
  const [buscandoHistorico, setBuscandoHistorico] = useState(false);

  useEffect(() => {
    if (sos) setFormData(sos);
  }, [sos]);

  // Busca os colaboradores e dados complementares na tabela de preventivas
  useEffect(() => {
    async function fetchLinkedPreventivas() {
      if (formData.os_ultima_preventiva) {
        const { data } = await supabase
          .from("preventivas")
          .select("*")
          .eq("numero_os", formData.os_ultima_preventiva)
          .limit(1)
          .maybeSingle();
        setHistoricoPrev(data);
      }
      if (formData.os_ultima_inspecao) {
        const { data } = await supabase
          .from("preventivas")
          .select("*")
          .eq("numero_os", formData.os_ultima_inspecao)
          .limit(1)
          .maybeSingle();
        setHistoricoInsp(data);
      }
    }
    fetchLinkedPreventivas();
  }, [formData.os_ultima_preventiva, formData.os_ultima_inspecao]);

  function solicitarLogin() {
    setLoginModalOpen(true);
  }

  async function onLoginConfirm() {
    setLoginModalOpen(false);
    setEditMode(true);
  }

  async function handlePuxarHistorico() {
    setBuscandoHistorico(true);
    const { data: prevData } = await supabase
      .from("preventivas")
      .select("*")
      .eq("prefixo", sos.veiculo)
      .eq("tipo", "Preventiva - 10.000")
      .order("data_realizacao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: inspData } = await supabase
      .from("preventivas")
      .select("*")
      .eq("prefixo", sos.veiculo)
      .eq("tipo", "Inspeção - 5.000")
      .order("data_realizacao", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!prevData && !inspData) {
      alert("Nenhum histórico de preventiva ou inspeção encontrado para este veículo.");
    } else {
      setFormData((prev) => ({
        ...prev,
        os_ultima_preventiva: prevData?.numero_os || prev.os_ultima_preventiva,
        os_ultima_inspecao: inspData?.numero_os || prev.os_ultima_inspecao,
      }));
      // Como os useEffect escutam o numero_os (os_ultima_preventiva), eles já vão disparar e alimentar historicoPrev/Insp automaticamente
      alert("OS atreladas com sucesso! Salve para confirmar.");
    }
    setBuscandoHistorico(false);
  }

  async function salvarAlteracoes() {
    // Agora usando EXCLUSIVAMENTE a data que vier da tabela preventivas (sem fallback para o formData antigo)
    const dataPrev = historicoPrev?.data_realizacao || null;
    const dataInsp = historicoInsp?.data_realizacao || null;
    const dataSosFormatada = formData.data_sos ? formData.data_sos.split('T')[0] : null;

    const payload = {
      ...formData,
      km_veiculo_sos: formData.km_veiculo_sos ? Number(formData.km_veiculo_sos) : null,
      dias_ultima_preventiva: calcularDiasDecorridos(dataPrev, dataSosFormatada),
      dias_ultima_inspecao: calcularDiasDecorridos(dataInsp, dataSosFormatada),
      atualizado_em: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("sos_acionamentos")
      .update(payload)
      .eq("id", sos.id);

    if (error) {
      alert("Erro ao salvar: " + error.message);
      return;
    }

    alert("Alterações salvas com sucesso ✅");
    onAtualizar(true);
    setEditMode(false);
    onClose();
  }

  const renderField = (label, field, multiline = false, type = "text", readOnly = false) => (
    <div className="flex flex-col">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</label>
      {editMode && !readOnly ? (
        multiline ? (
          <textarea
            className="border border-slate-300 p-2.5 rounded-lg w-full text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none transition"
            rows="2"
            value={formData[field] || ""}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          />
        ) : (
          <input
            type={type}
            className="border border-slate-300 p-2.5 rounded-lg w-full text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none transition"
            value={formData[field] || ""}
            onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          />
        )
      ) : (
        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-sm font-bold text-slate-800 min-h-[42px] flex items-center">
          {formData[field] ? (type === 'date' ? formatDateBR(formData[field]) : formData[field]) : "—"}
        </div>
      )}
    </div>
  );

  const renderControlabilidadeField = () => (
    <div className="flex flex-col md:col-span-2">
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Classificação de Controlabilidade</label>
      {editMode ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, classificacao_controlabilidade: "Não Controlável" })}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
              formData.classificacao_controlabilidade === "Não Controlável"
                ? "bg-amber-400 border-amber-500 text-amber-900 shadow-sm"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Não controlável
          </button>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, classificacao_controlabilidade: "Controlável" })}
            className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${
              formData.classificacao_controlabilidade === "Controlável"
                ? "bg-rose-600 border-rose-700 text-white shadow-sm"
                : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Controlável
          </button>
        </div>
      ) : (
        <div className="mt-1">
          {formData.classificacao_controlabilidade === "Não Controlável" ? (
            <span className="inline-flex bg-amber-100 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">
              Não controlável
            </span>
          ) : formData.classificacao_controlabilidade === "Controlável" ? (
            <span className="inline-flex bg-rose-100 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">
              Controlável
            </span>
          ) : (
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-sm font-bold text-slate-800">—</div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center p-5 border-b bg-white relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-50"></div>
          <div className="relative flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-lg shadow-sm">
              <FaEye size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Detalhes SOS <span className="text-blue-600">#{sos.numero_sos}</span>
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <StatusTag status={sos.status} />
                <OcorrenciaTag ocorrencia={sos.ocorrencia} />
              </div>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            {!editMode ? (
              <button onClick={solicitarLogin} className="bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition active:scale-95">
                <FaEdit /> Editar
              </button>
            ) : (
              <button onClick={salvarAlteracoes} className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition active:scale-95">
                <FaSave /> Salvar
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition">
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/50 flex-1">
          
          {/* Seção 1: Dados da Ocorrência */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
              <FaBus className="text-slate-400" /> Informações da Ocorrência
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderField("Criado em", "created_at", false, "date", true)}
              {renderField("Plantonista", "plantonista", false, "text", true)}
              {renderField("Data SOS", "data_sos", false, "date", true)}
              {renderField("Hora SOS", "hora_sos", false, "text", true)}
              {renderField("Veículo", "veiculo", false, "text", true)}
              {renderField("Linha", "linha", false, "text", true)}
              {renderField("Motorista", "motorista_nome", false, "text", true)}
              {renderField("Local", "local_ocorrencia", false, "text", true)}
              {renderField("Tabela Operacional", "tabela_operacional", false, "text", true)}
              <div className="md:col-span-3">
                {renderField("Reclamação do Motorista", "reclamacao_motorista", true, "text", true)}
              </div>
            </div>
          </div>

          {/* Seção 2: Tratamento e Manutenção */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
              <FaTools className="text-blue-500" /> Tratamento e Execução
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderField("Setor Manutenção", "setor_manutencao")}
              {renderField("Grupo Manutenção", "grupo_manutencao")}
              {renderField("Problema Encontrado", "problema_encontrado")}
              
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                {renderField("Mecânico Apontado", "mecanico_executor")}
                {renderField("Responsável (Solucionador)", "solucionador")}
                <div className="md:col-span-2">
                  {renderField("Solução Aplicada", "solucao", true)}
                </div>
                {renderField("OS Corretiva", "numero_os_corretiva")}
                {renderControlabilidadeField()}
              </div>
            </div>
          </div>

          {/* Seção 3: Snapshot de Preventiva e Inspeção */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-2 gap-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FaWrench className="text-emerald-500" /> Histórico Atrelado (Tabela de Preventivas)
              </h3>
              
              {editMode && (
                <button
                  onClick={handlePuxarHistorico}
                  disabled={buscandoHistorico}
                  className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                >
                  {buscandoHistorico ? "Buscando..." : "Puxar OS Automaticamente"}
                </button>
              )}
            </div>

            <div className="mb-5 flex flex-col md:w-1/3">
              {/* Mantém a edição do KM Atual do form */}
              {renderField("KM Atual do Veículo (Hora do SOS)", "km_veiculo_sos", false, "number")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box Preventiva */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-700 text-sm border-b pb-1 flex justify-between">
                  <span>Última Preventiva (10k)</span>
                  <span className="text-blue-600">OS: {formData.os_ultima_preventiva || "—"}</span>
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-1 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">Data</span>
                    <span className="font-black text-slate-800">
                      {historicoPrev?.data_realizacao ? formatDateBR(historicoPrev.data_realizacao) : "—"}
                    </span>
                  </div>
                  <div className="col-span-1 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">KM Época</span>
                    <span className="font-black text-slate-800">
                      {historicoPrev?.km_veiculo || "—"}
                    </span>
                  </div>
                  
                  {/* Dados buscados dinamicamente da tabela Preventivas */}
                  <div className="col-span-2 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">Mecânico</span>
                    <span className="font-black text-slate-800">{historicoPrev?.mecanico || "—"}</span>
                  </div>
                  <div className="col-span-2 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">Eletricista</span>
                    <span className="font-black text-slate-800">{historicoPrev?.eletricista || "—"}</span>
                  </div>
                  <div className="col-span-2 text-xs flex gap-4">
                    <div className="flex-1">
                      <span className="block font-bold text-slate-500 uppercase">Funilaria</span>
                      <span className="font-black text-slate-800">{historicoPrev?.funilaria || "—"}</span>
                    </div>
                    <div className="flex-1">
                      <span className="block font-bold text-slate-500 uppercase">Borracharia</span>
                      <span className="font-black text-slate-800">{historicoPrev?.borracharia || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Box Inspeção */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-700 text-sm border-b pb-1 flex justify-between">
                  <span>Última Inspeção (5k)</span>
                  <span className="text-emerald-600">OS: {formData.os_ultima_inspecao || "—"}</span>
                </h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-1 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">Data</span>
                    <span className="font-black text-slate-800">
                      {historicoInsp?.data_realizacao ? formatDateBR(historicoInsp.data_realizacao) : "—"}
                    </span>
                  </div>
                  <div className="col-span-1 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">KM Época</span>
                    <span className="font-black text-slate-800">
                      {historicoInsp?.km_veiculo || "—"}
                    </span>
                  </div>

                  {/* Dados buscados dinamicamente da tabela Preventivas */}
                  <div className="col-span-2 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">Mecânico</span>
                    <span className="font-black text-slate-800">{historicoInsp?.mecanico || "—"}</span>
                  </div>
                  <div className="col-span-2 text-xs">
                    <span className="block font-bold text-slate-500 uppercase">Eletricista</span>
                    <span className="font-black text-slate-800">{historicoInsp?.eletricista || "—"}</span>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-3 text-center">
              * Estes dados representam a situação da última revisão do veículo. Se as informações não aparecerem, é porque a OS correspondente não consta na base de Preventivas do Supabase.
            </p>
          </div>

        </div>
      </div>

      {loginModalOpen && (
        <LoginModal
          onConfirm={onLoginConfirm}
          onCancel={() => setLoginModalOpen(false)}
        />
      )}
    </div>
  );
}

/* --- Página Principal: CENTRAL SOS --- */
export default function SOSCentral() {
  const PAGE_SIZE = 200;

  const [sosList, setSosList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState(null);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [mesRef, setMesRef] = useState("");
  const [ocorrenciaFiltro, setOcorrenciaFiltro] = useState("");

  const [sortBy, setSortBy] = useState(DATE_FIELD);
  const [sortAsc, setSortAsc] = useState(false);

  const [page, setPage] = useState(0);

  function buildQuery() {
    let query = supabase.from("sos_acionamentos").select("*");

    if (mesRef) {
      const { start, end } = monthRange(mesRef);
      if (start) query = query.gte(DATE_FIELD, start);
      if (end) query = query.lte(DATE_FIELD, end);
    }

    if (dataInicio) query = query.gte(DATE_FIELD, dataInicio);
    if (dataFim) query = query.lte(DATE_FIELD, dataFim);

    if (ocorrenciaFiltro) {
      query = query.ilike("ocorrencia", ocorrenciaFiltro);
    }

    query = query.order(sortBy, { ascending: sortAsc, nullsFirst: false });

    return query;
  }

  async function carregarSOS(reset = false) {
    if (reset) {
      setLoading(true);
      setPage(0);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await buildQuery().range(from, to);

    if (error) {
      console.error(error.message);
      setLoading(false);
      setLoadingMore(false);
      return;
    }

    const newRows = data || [];
    const merged = reset ? newRows : [...sosList, ...newRows];
    setSosList(merged);
    setHasMore(newRows.length === PAGE_SIZE);
    setPage(currentPage + 1);
    setLoading(false);
    setLoadingMore(false);
  }

  useEffect(() => {
    carregarSOS(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregarSOS(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim, mesRef, sortBy, sortAsc, ocorrenciaFiltro]);

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return sosList;

    return sosList.filter((s) => {
      return (
        s.numero_sos?.toString().toLowerCase().includes(termo) ||
        s.veiculo?.toLowerCase().includes(termo) ||
        s.motorista_nome?.toLowerCase().includes(termo) ||
        s.ocorrencia?.toLowerCase().includes(termo)
      );
    });
  }, [busca, sosList]);

  const counts = useMemo(() => {
    const obj = {};
    OCORRENCIAS_CARDS.forEach((key) => {
      obj[key] = filtrados.filter(
        (item) => String(item.ocorrencia || "").toUpperCase().trim() === key
      ).length;
    });
    return obj;
  }, [filtrados]);

  function toggleSort(field) {
    if (sortBy === field) {
      setSortAsc((v) => !v);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  }

  function SortIcon({ field }) {
    if (sortBy !== field) return <FaSort className="inline ml-2 opacity-30" />;
    return sortAsc ? (
      <FaSortUp className="inline ml-2" />
    ) : (
      <FaSortDown className="inline ml-2" />
    );
  }

  function handleCardClick(card) {
    setOcorrenciaFiltro((prev) => (prev === card ? "" : card));
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Cabeçalho */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 md:p-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black border border-blue-200 mb-2">
          <FaTools /> Histórico Operacional
        </div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-800">Central de Intervenções</h1>
        <p className="text-sm text-slate-500 mt-1">Consulte todos os acionamentos de SOS e intervenções de frota.</p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {OCORRENCIAS_CARDS.map((key) => (
          <CardResumo
            key={key}
            titulo={key}
            valor={counts[key] || 0}
            cor={cores[key]}
            ativo={ocorrenciaFiltro === key}
            onClick={() => handleCardClick(key)}
          />
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white shadow-sm border rounded-2xl p-5 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar SOS, veículo, motorista..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none text-sm font-semibold text-slate-700"
          />
        </div>

        <input
          type="month"
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
          className="border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 text-sm font-semibold text-slate-700"
          title="Filtrar por mês"
        />

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 text-sm font-semibold text-slate-700"
          />
          <span className="text-slate-400 font-bold">até</span>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 text-sm font-semibold text-slate-700"
          />
        </div>

        <select
          value={ocorrenciaFiltro}
          onChange={(e) => setOcorrenciaFiltro(e.target.value)}
          className="border border-slate-300 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-200 text-sm font-semibold text-slate-700"
        >
          <option value="">Todas as ocorrências</option>
          {OCORRENCIAS_CARDS.map((oc) => (
            <option key={oc} value={oc}>{oc}</option>
          ))}
        </select>

        <button
          onClick={() => carregarSOS(true)}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm active:scale-95"
        >
          Aplicar
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white shadow-sm border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[11px] tracking-wider border-b">
              <tr>
                <ThSortable label="OS/SOS" onClick={() => toggleSort("numero_sos")}>
                  <SortIcon field="numero_sos" />
                </ThSortable>
                <ThSortable label="Data" onClick={() => toggleSort(DATE_FIELD)}>
                  <SortIcon field={DATE_FIELD} />
                </ThSortable>
                <ThSortable label="Prefixo" onClick={() => toggleSort("veiculo")}>
                  <SortIcon field="veiculo" />
                </ThSortable>
                <ThSortable label="Motorista" onClick={() => toggleSort("motorista_nome")}>
                  <SortIcon field="motorista_nome" />
                </ThSortable>
                <ThSortable label="Ocorrência" onClick={() => toggleSort("ocorrencia")}>
                  <SortIcon field="ocorrencia" />
                </ThSortable>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-blue-600">
                      <svg className="animate-spin h-8 w-8 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-bold text-slate-500">Buscando registros...</span>
                    </div>
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <FaInbox size={48} className="mb-4 text-slate-300" />
                      <p className="text-lg font-bold text-slate-600">Nenhum SOS encontrado</p>
                      <p className="text-sm mt-1">Altere os filtros para buscar novamente.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtrados.map((s) => {
                  const st = String(s.status || "").toUpperCase().trim();
                  const isPendente = st === "ABERTO" || st === "EM ANDAMENTO";

                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${isPendente ? "bg-rose-50/30 hover:bg-rose-50" : "hover:bg-slate-50"}`}
                    >
                      <td className="px-6 py-4 font-black text-slate-700">#{s.numero_sos}</td>
                      <td className="px-6 py-4 font-medium text-slate-600">{formatDateBR(pickBestDate(s))}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border shadow-sm">
                          <FaBus className="text-slate-400 text-xs" /> {s.veiculo}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{s.motorista_nome}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <OcorrenciaTag ocorrencia={s.ocorrencia} />
                          <StatusTag status={s.status} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          className="bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-600 text-slate-600 px-4 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 mx-auto transition-all shadow-sm active:scale-95"
                          onClick={() => setSelected(s)}
                        >
                          <FaEye /> Abrir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && hasMore && (
          <div className="p-5 border-t bg-slate-50 flex justify-center">
            <button
              onClick={() => carregarSOS(false)}
              disabled={loadingMore}
              className="bg-white border border-slate-300 text-slate-700 px-6 py-2.5 rounded-xl font-bold hover:bg-slate-100 disabled:opacity-50 transition shadow-sm"
            >
              {loadingMore ? "Carregando..." : "Carregar mais registros"}
            </button>
          </div>
        )}
      </div>

      {selected && (
        <DetalheSOSModal
          sos={selected}
          onClose={() => setSelected(null)}
          onAtualizar={() => {
            carregarSOS(true);
          }}
        />
      )}
    </div>
  );
}

/* --- Helpers UI --- */
function ThSortable({ label, onClick, children }) {
  return (
    <th
      className="px-6 py-4 text-left cursor-pointer select-none hover:bg-slate-200 transition group"
      onClick={onClick}
      title="Clique para ordenar"
    >
      <span className="flex items-center gap-1">
        {label} <span className="group-hover:text-blue-500 transition-colors">{children}</span>
      </span>
    </th>
  );
}

function CardResumo({ titulo, valor, cor, ativo, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${cor} rounded-2xl shadow-sm p-4 text-center transition-all duration-200 border-2 border-transparent w-full relative overflow-hidden group ${
        ativo ? "ring-4 ring-blue-500/30 scale-[1.02] border-white/50" : "opacity-90 hover:opacity-100 hover:-translate-y-1"
      }`}
    >
      <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <h3 className="text-[11px] font-black uppercase tracking-wider opacity-80">{titulo}</h3>
      <p className="text-3xl font-black mt-1 tracking-tight">{valor}</p>
    </button>
  );
}
