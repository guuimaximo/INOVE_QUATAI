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
  FaBus,
  FaTools,
  FaWrench,
  FaRoad,
  FaUserCog,
  FaBolt,
  FaDownload,
  FaInfoCircle,
  FaSync,
  FaExclamationTriangle,
  FaClock,
  FaChartLine,
  FaChartPie,
  FaClipboardList,
  FaCogs,
  FaUserTie,
  FaArrowUp,
  FaArrowDown,
  FaEquals
} from "react-icons/fa";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  LabelList,
  ComposedChart,
  Area,
} from "recharts";

/* =======================
   AJUSTES GERAIS
======================= */
const MKBF_META = 7000;
const TIPOS_GRAFICO = ["RECOLHEU", "SOS", "AVARIA", "TROCA", "IMPROCEDENTE"];
const DATE_FIELD = "data_sos";

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
  const txt = s(v);
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

function parseDateOnly(v) {
  const dt = safeDateStr(v);
  if (!dt) return null;
  const d = new Date(`${dt}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function diffDays(dateA, dateB) {
  const a = parseDateOnly(dateA);
  const b = parseDateOnly(dateB);
  if (!a || !b) return null;
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / 86400000);
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

function fmtDateBr(v) {
  const dt = safeDateStr(v);
  if (!dt) return "-";
  const p = dt.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dt;
}

function fmtNum(v, dec = 2) {
  return n(v).toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function fmtInt(v) {
  return Math.round(n(v)).toLocaleString("pt-BR");
}

function fmtPct(v) {
  return `${fmtNum(v, 1)}%`;
}

function fmtHoras(v) {
  const h = n(v);
  if (h < 1 && h > 0) return `${fmtNum(h * 60, 0)} min`;
  return `${fmtNum(h, 1)} h`;
}

function monthKey(date) {
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelFromKey(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  return `${meses[n(m) - 1] || m}/${String(y).slice(2)}`;
}

function firstDayOfMonth(key) {
  return key ? new Date(`${key}-01T00:00:00`) : null;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function deriveCluster(prefixo) {
  const v = normalize(prefixo);
  if (!v) return "OUTROS";
  if (v.startsWith("2216")) return "C8";
  if (v.startsWith("2222")) return "C9";
  if (v.startsWith("2224")) return "C10";
  if (v.startsWith("2425")) return "C11";
  if (v.startsWith("W")) return "C6";
  return "OUTROS";
}

function normalizeTipo(oc) {
  const o = normalize(oc);
  if (!o) return "";
  if (["RA", "R.A", "R.A."].includes(o)) return "RECOLHEU";
  if (o.includes("RECOLH")) return "RECOLHEU";
  if (o.includes("IMPRO")) return "IMPROCEDENTE";
  if (o.includes("TROC")) return "TROCA";
  if (o === "S.O.S") return "SOS";
  if (o.includes("AVARI")) return "AVARIA";
  if (o.includes("SEGUIU")) return "SEGUIU VIAGEM";
  return o;
}

function isOcorrenciaValidaParaMkbf(oc) {
  const tipo = normalizeTipo(oc);
  return !!tipo && tipo !== "SEGUIU VIAGEM";
}

function variancePct(atual, anterior) {
  if (!anterior) return 0;
  return ((atual - anterior) / anterior) * 100;
}

function faixaDias(v) {
  const x = n(v);
  if (!x && x !== 0) return "Sem informação";
  if (x <= 7) return "0-7 dias";
  if (x <= 15) return "8-15 dias";
  if (x <= 30) return "16-30 dias";
  if (x <= 60) return "31-60 dias";
  return "60+ dias";
}

function mapSetorToRole(setor, grupo) {
  const s = normalize(setor);
  const g = normalize(grupo);
  if (s.includes("ELÉTRICA") || s.includes("ELETRICA") || g.includes("ELÉTRICA") || g.includes("ELETRICA")) return "eletricista";
  if (s.includes("BORRACHARIA") || g.includes("PNEU")) return "borracharia";
  if (s.includes("FUNILARIA") || s.includes("CARROCERIA") || g.includes("CARROCERIA")) return "funilaria";
  return "mecanico";
}

function exportarCSV(dados, nomeArquivo) {
  if (!dados?.length) return;
  const cols = Object.keys(dados[0]).filter((k) => typeof dados[0][k] !== "object");
  const csv = [
    cols.join(";"),
    ...dados.map((row) =>
      cols.map((col) => `"${String(row[col] ?? "").replace(/"/g, '""')}"`).join(";")
    ),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

/* =======================
   COMPONENTES UI GERAIS
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

function EvolucaoBadge({ value, invert = false }) {
  const val = n(value);
  if (val > 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${invert ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
        <FaArrowUp size={10} /> {fmtPct(Math.abs(val))}
      </span>
    );
  }
  if (val < 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border ${invert ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
        <FaArrowDown size={10} /> {fmtPct(Math.abs(val))}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
      <FaEquals size={10} /> 0,0%
    </span>
  );
}

function CardKPI({ title, value, sub, icon, tone = "blue", className = "" }) {
  const tones = {
    blue: "from-blue-50 to-cyan-50 border-blue-200 text-blue-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-orange-50 border-amber-200 text-amber-700",
    rose: "from-rose-50 to-pink-50 border-rose-200 text-rose-700",
    violet: "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700",
    slate: "from-slate-50 to-gray-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 h-full">
        <div className="flex flex-col justify-between h-full">
          <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
          <div>
            <p className="text-2xl md:text-3xl font-black mt-2 text-slate-800">{value}</p>
            <p className="text-xs mt-1 text-slate-600 font-semibold">{sub}</p>
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-black transition ${
        active ? "bg-slate-800 text-white border-slate-800 shadow" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

/* --- Modal de Login --- */
function LoginModal({ onConfirm, onCancel, title = "Acesso Restrito" }) {
  // ... (Mesmo componente LoginModal)
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
          <input type="text" placeholder="Login" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none" value={login} onChange={(e) => setLogin(e.target.value)} />
          <input type="password" placeholder="Senha" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-200 outline-none" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onCancel} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition">Cancelar</button>
          <button onClick={handleLogin} disabled={loading} className="px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition shadow-md disabled:opacity-70">{loading ? "Verificando..." : "Entrar"}</button>
        </div>
      </div>
    </div>
  );
}

/* --- Modal de Detalhes do SOS --- */
function DetalheSOSModal({ sos, onClose, onAtualizar }) {
  // ... (Mesmo componente DetalheSOSModal que você já tinha)
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [historicoPrev, setHistoricoPrev] = useState(null);
  const [historicoInsp, setHistoricoInsp] = useState(null);
  const [buscandoHistorico, setBuscandoHistorico] = useState(false);

  useEffect(() => { if (sos) setFormData(sos); }, [sos]);

  useEffect(() => {
    async function fetchLinkedPreventivas() {
      if (formData.os_ultima_preventiva) {
        const { data } = await supabase.from("preventivas").select("*").eq("numero_os", formData.os_ultima_preventiva).limit(1).maybeSingle();
        setHistoricoPrev(data);
      }
      if (formData.os_ultima_inspecao) {
        const { data } = await supabase.from("preventivas").select("*").eq("numero_os", formData.os_ultima_inspecao).limit(1).maybeSingle();
        setHistoricoInsp(data);
      }
    }
    fetchLinkedPreventivas();
  }, [formData.os_ultima_preventiva, formData.os_ultima_inspecao]);

  function solicitarLogin() { setLoginModalOpen(true); }
  async function onLoginConfirm() { setLoginModalOpen(false); setEditMode(true); }

  async function handlePuxarHistorico() {
    setBuscandoHistorico(true);
    const { data: prevData } = await supabase.from("preventivas").select("*").eq("prefixo", sos.veiculo).eq("tipo", "Preventiva - 10.000").order("data_realizacao", { ascending: false }).limit(1).maybeSingle();
    const { data: inspData } = await supabase.from("preventivas").select("*").eq("prefixo", sos.veiculo).eq("tipo", "Inspeção - 5.000").order("data_realizacao", { ascending: false }).limit(1).maybeSingle();

    if (!prevData && !inspData) {
      alert("Nenhum histórico de preventiva ou inspeção encontrado para este veículo.");
    } else {
      setFormData((prev) => ({
        ...prev,
        os_ultima_preventiva: prevData?.numero_os || prev.os_ultima_preventiva,
        os_ultima_inspecao: inspData?.numero_os || prev.os_ultima_inspecao,
      }));
      alert("OS atreladas com sucesso! Salve para confirmar.");
    }
    setBuscandoHistorico(false);
  }

  async function salvarAlteracoes() {
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

    const { error } = await supabase.from("sos_acionamentos").update(payload).eq("id", sos.id);
    if (error) { alert("Erro ao salvar: " + error.message); return; }

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
          <textarea className="border border-slate-300 p-2.5 rounded-lg w-full text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none transition" rows="2" value={formData[field] || ""} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} />
        ) : (
          <input type={type} className="border border-slate-300 p-2.5 rounded-lg w-full text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none transition" value={formData[field] || ""} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} />
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
          <button type="button" onClick={() => setFormData({ ...formData, classificacao_controlabilidade: "Não Controlável" })} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${formData.classificacao_controlabilidade === "Não Controlável" ? "bg-amber-400 border-amber-500 text-amber-900 shadow-sm" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"}`}>Não controlável</button>
          <button type="button" onClick={() => setFormData({ ...formData, classificacao_controlabilidade: "Controlável" })} className={`px-4 py-2 rounded-lg text-sm font-bold border transition ${formData.classificacao_controlabilidade === "Controlável" ? "bg-rose-600 border-rose-700 text-white shadow-sm" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"}`}>Controlável</button>
        </div>
      ) : (
        <div className="mt-1">
          {formData.classificacao_controlabilidade === "Não Controlável" ? (
            <span className="inline-flex bg-amber-100 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">Não controlável</span>
          ) : formData.classificacao_controlabilidade === "Controlável" ? (
            <span className="inline-flex bg-rose-100 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider">Controlável</span>
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
        <div className="flex justify-between items-center p-5 border-b bg-white relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-50"></div>
          <div className="relative flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-lg shadow-sm"><FaEye size={20} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Detalhes SOS <span className="text-blue-600">#{sos.numero_sos}</span></h2>
              <div className="flex items-center gap-2 mt-1"><StatusTag status={sos.status} /><OcorrenciaTag ocorrencia={sos.ocorrencia} /></div>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            {!editMode ? (
              <button onClick={solicitarLogin} className="bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition active:scale-95"><FaEdit /> Editar</button>
            ) : (
              <button onClick={salvarAlteracoes} className="bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-md transition active:scale-95"><FaSave /> Salvar</button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition"><FaTimes size={20} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto bg-slate-50/50 flex-1">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2"><FaBus className="text-slate-400" /> Informações da Ocorrência</h3>
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
              <div className="md:col-span-3">{renderField("Reclamação do Motorista", "reclamacao_motorista", true, "text", true)}</div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2"><FaTools className="text-blue-500" /> Tratamento e Execução</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderField("Setor Manutenção", "setor_manutencao")}
              {renderField("Grupo Manutenção", "grupo_manutencao")}
              {renderField("Problema Encontrado", "problema_encontrado")}
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                {renderField("Mecânico Apontado", "mecanico_executor")}
                {renderField("Responsável (Solucionador)", "solucionador")}
                <div className="md:col-span-2">{renderField("Solução Aplicada", "solucao", true)}</div>
                {renderField("OS Corretiva", "numero_os_corretiva")}
                {renderControlabilidadeField()}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-2 gap-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><FaWrench className="text-emerald-500" /> Histórico Atrelado (Tabela de Preventivas)</h3>
              {editMode && (
                <button onClick={handlePuxarHistorico} disabled={buscandoHistorico} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 disabled:opacity-50">
                  {buscandoHistorico ? "Buscando..." : "Puxar OS Automaticamente"}
                </button>
              )}
            </div>

            <div className="mb-5 flex flex-col md:w-1/3">
              {renderField("KM Atual do Veículo (Hora do SOS)", "km_veiculo_sos", false, "number")}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-700 text-sm border-b pb-1 flex justify-between"><span>Última Preventiva (10k)</span><span className="text-blue-600">OS: {formData.os_ultima_preventiva || "—"}</span></h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-1 text-xs"><span className="block font-bold text-slate-500 uppercase">Data</span><span className="font-black text-slate-800">{historicoPrev?.data_realizacao ? formatDateBR(historicoPrev.data_realizacao) : "—"}</span></div>
                  <div className="col-span-1 text-xs"><span className="block font-bold text-slate-500 uppercase">KM Época</span><span className="font-black text-slate-800">{historicoPrev?.km_veiculo || "—"}</span></div>
                  <div className="col-span-2 text-xs"><span className="block font-bold text-slate-500 uppercase">Mecânico</span><span className="font-black text-slate-800">{historicoPrev?.mecanico || "—"}</span></div>
                  <div className="col-span-2 text-xs"><span className="block font-bold text-slate-500 uppercase">Eletricista</span><span className="font-black text-slate-800">{historicoPrev?.eletricista || "—"}</span></div>
                  <div className="col-span-2 text-xs flex gap-4">
                    <div className="flex-1"><span className="block font-bold text-slate-500 uppercase">Funilaria</span><span className="font-black text-slate-800">{historicoPrev?.funilaria || "—"}</span></div>
                    <div className="flex-1"><span className="block font-bold text-slate-500 uppercase">Borracharia</span><span className="font-black text-slate-800">{historicoPrev?.borracharia || "—"}</span></div>
                  </div>
                </div>
              </div>
              
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-bold text-slate-700 text-sm border-b pb-1 flex justify-between"><span>Última Inspeção (5k)</span><span className="text-emerald-600">OS: {formData.os_ultima_inspecao || "—"}</span></h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="col-span-1 text-xs"><span className="block font-bold text-slate-500 uppercase">Data</span><span className="font-black text-slate-800">{historicoInsp?.data_realizacao ? formatDateBR(historicoInsp.data_realizacao) : "—"}</span></div>
                  <div className="col-span-1 text-xs"><span className="block font-bold text-slate-500 uppercase">KM Época</span><span className="font-black text-slate-800">{historicoInsp?.km_veiculo || "—"}</span></div>
                  <div className="col-span-2 text-xs"><span className="block font-bold text-slate-500 uppercase">Mecânico</span><span className="font-black text-slate-800">{historicoInsp?.mecanico || "—"}</span></div>
                  <div className="col-span-2 text-xs"><span className="block font-bold text-slate-500 uppercase">Eletricista</span><span className="font-black text-slate-800">{historicoInsp?.eletricista || "—"}</span></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-3 text-center">* Estes dados representam a situação da última revisão do veículo.</p>
          </div>
        </div>
      </div>
      {loginModalOpen && <LoginModal onConfirm={onLoginConfirm} onCancel={() => setLoginModalOpen(false)} />}
    </div>
  );
}

/* --- Página Principal: CENTRAL SOS --- */
export default function SOSCentral() {
  const PAGE_SIZE = 200;

  const [sosRows, setSosRows] = useState([]); 
  const [sosList, setSosList] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [prevRows, setPrevRows] = useState([]);
  const [kmRows, setKmRows] = useState([]);

  const [busca, setBusca] = useState("");
  const [selected, setSelected] = useState(null);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const [mesRef, setMesRef] = useState("");
  const [ocorrenciaFiltro, setOcorrenciaFiltro] = useState("");
  const [filtroLinha, setFiltroLinha] = useState("");
  const [filtroSetor, setFiltroSetor] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroCluster, setFiltroCluster] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroControlabilidade, setFiltroControlabilidade] = useState("");
  
  const [abaAtiva, setAbaAtiva] = useState("EXECUTIVO");
  const [mostrarExplicacao, setMostrarExplicacao] = useState(false);
  const [mesReferencia, setMesReferencia] = useState("");

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
    if (ocorrenciaFiltro) query = query.ilike("ocorrencia", ocorrenciaFiltro);
    query = query.order(sortBy, { ascending: sortAsc, nullsFirst: false });
    return query;
  }

  async function fetchAllData(table, orderField) {
    let allRecords = [];
    let start = 0;
    const limit = 1000; 
    while (true) {
      const { data, error } = await supabase.from(table).select("*").order(orderField, { ascending: false }).range(start, start + limit - 1);
      if (error) { console.error(`Erro ao buscar dados de ${table}:`, error); break; }
      if (!data || data.length === 0) break;
      allRecords = allRecords.concat(data);
      if (data.length < limit) break; 
      start += limit;
    }
    return allRecords;
  }

  async function carregarTudo() {
    setLoading(true);
    setPage(0);
    setHasMore(true);
    try {
      const [sosData, kmData, preventivaData] = await Promise.all([
        fetchAllData("sos_acionamentos", "data_sos"),
        fetchAllData("km_rodado_diario", "data").catch(() => []),
        fetchAllData("preventivas", "data_realizacao").catch(() => [])
      ]);
      setSosRows(sosData || []);
      setKmRows(kmData || []);
      setPrevRows(preventivaData || []);
    } catch (e) {
      console.error(e);
    }
    carregarSOS(true, true);
  }

  async function carregarSOS(reset = false, skipLoadingState = false) {
    if (reset) {
      if (!skipLoadingState) setLoading(true);
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

  useEffect(() => { carregarTudo(); }, []);
  useEffect(() => { carregarSOS(true); }, [dataInicio, dataFim, mesRef, sortBy, sortAsc, ocorrenciaFiltro]);

  const kmProcessado = useMemo(() => {
    const map = new Map();
    (kmRows || []).forEach((r) => {
      const data = safeDateStr(r.data);
      if (!data) return;
      map.set(data, n(map.get(data)) + n(r.km_total));
    });
    return [...map.entries()].map(([data, km_total]) => ({ data, km_total })).sort((a, b) => String(a.data).localeCompare(String(b.data)));
  }, [kmRows]);

  const sosProcessado = useMemo(() => {
    const mapPrev = new Map();
    (prevRows || []).forEach(p => mapPrev.set(s(p.numero_os), p));

    const extractName = (val) => {
      if (!val) return null;
      const str = String(val);
      return str.includes(' - ') ? (str.split(' - ')[1] || str).trim() : str.trim();
    };

    return (sosRows || [])
      .map((r) => {
        const data_sos = safeDateStr(r.data_sos || r.created_at);
        if (!data_sos) return null;

        const tipo_norm = normalizeTipo(r.ocorrencia);
        const classificacao = normalize(r.classificacao_controlabilidade);
        const roleResp = mapSetorToRole(r.setor_manutencao, r.grupo_manutencao);

        const dtPrevVinculada = mapPrev.get(s(r.os_ultima_preventiva));
        const dtInspVinculada = mapPrev.get(s(r.os_ultima_inspecao));

        const basePrev = dtPrevVinculada?.data_realizacao || r.data_ultima_preventiva;
        const baseInsp = dtInspVinculada?.data_realizacao || r.data_ultima_inspecao;

        const kmPrevVinc = dtPrevVinculada?.km_veiculo || r.km_rodado_preventiva || 0;
        const kmInspVinc = dtInspVinculada?.km_veiculo || r.km_rodado_inspecao || 0;

        const diasPrev = n(r.dias_ultima_preventiva) > 0 ? n(r.dias_ultima_preventiva) : Math.max(0, n(diffDays(data_sos, basePrev)));
        const diasInsp = n(r.dias_ultima_inspecao) > 0 ? n(r.dias_ultima_inspecao) : Math.max(0, n(diffDays(data_sos, baseInsp)));

        // ======= NOVA LÓGICA: QUEM FOI O ÚLTIMO A REVISAR? (PREV ou INSP) =======
        let isInspMaisRecente = false;
        if (baseInsp && basePrev) {
          isInspMaisRecente = diasInsp < diasPrev;
        } else if (baseInsp && !basePrev) {
          isInspMaisRecente = true;
        }

        const funcCru = isInspMaisRecente ? (dtInspVinculada?.[roleResp] || null) : (dtPrevVinculada?.[roleResp] || null);
        const responsavel_revisao = extractName(funcCru) || "Não Identificado";
        const tipo_revisao_atribuida = isInspMaisRecente ? "Inspeção" : "Preventiva";
        const dias_revisao_atribuida = isInspMaisRecente ? diasInsp : diasPrev;
        const km_vinc_revisao_atribuida = isInspMaisRecente ? kmInspVinc : kmPrevVinc;
        // =========================================================================

        const tempo_solucao_horas = calcDiffHours(r.data_sos || r.created_at, r.hora_sos, r.data_encerramento || r.data_fechamento);
        const isControlavel = classificacao === "CONTROLÁVEL" || classificacao === "CONTROLAVEL";
        const isNaoControlavel = classificacao === "NÃO CONTROLÁVEL" || classificacao === "NAO CONTROLAVEL";

        return {
          ...r,
          data_sos,
          tipo_norm,
          valida_mkbf: isOcorrenciaValidaParaMkbf(r.ocorrencia),
          linha: normalize(r.linha) || "N/D",
          veiculo: String(r.veiculo || "").trim() || "N/D",
          motorista: normalize(r.motorista_nome) || normalize(r.motorista) || "N/D",
          status: normalize(r.status) || "N/D",
          problema_encontrado: String(r.problema_encontrado || "").trim() || "N/D",
          setor_manutencao: String(r.setor_manutencao || "").trim() || "N/D",
          grupo_manutencao: String(r.grupo_manutencao || "").trim() || "N/D",
          cluster: deriveCluster(r.veiculo),
          classificacao_controlabilidade: classificacao,
          controlavel: isControlavel,
          nao_controlavel: isNaoControlavel,
          dias_ultima_preventiva_calc: diasPrev || 0,
          dias_ultima_inspecao_calc: diasInsp || 0,
          faixa_preventiva: faixaDias(diasPrev),
          faixa_inspecao: faixaDias(diasInsp),
          
          // Dados da Revisão que "quebrou"
          responsavel_revisao,
          tipo_revisao_atribuida,
          dias_revisao_atribuida,
          km_vinc_revisao_atribuida,
          funcao_responsavel: roleResp.toUpperCase(),
          
          mes_key: data_sos.slice(0, 7),
          tempo_solucao_horas,
        };
      })
      .filter(Boolean);
  }, [sosRows, prevRows]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set([...kmProcessado.map((r) => String(r.data).slice(0, 7)), ...sosProcessado.map((r) => r.mes_key)].filter(Boolean));
    return [...set].sort();
  }, [kmProcessado, sosProcessado]);

  useEffect(() => { if (!mesReferencia && mesesDisponiveis.length) { setMesReferencia(mesesDisponiveis[mesesDisponiveis.length - 1]); } }, [mesReferencia, mesesDisponiveis]);

  const mesComparacao = useMemo(() => {
    const idx = mesesDisponiveis.indexOf(mesReferencia);
    return idx > 0 ? mesesDisponiveis[idx - 1] : "";
  }, [mesReferencia, mesesDisponiveis]);

  const linhaOptions = useMemo(() => [...new Set(sosProcessado.map((r) => r.linha).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [sosProcessado]);
  const setorOptions = useMemo(() => [...new Set(sosProcessado.map((r) => r.setor_manutencao).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [sosProcessado]);
  const clusterOptions = useMemo(() => [...new Set(sosProcessado.map((r) => r.cluster).filter(Boolean))].sort(), [sosProcessado]);
  const tipoOptions = useMemo(() => [...new Set(sosProcessado.map((r) => r.tipo_norm).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR")), [sosProcessado]);

  const baseFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return sosProcessado.filter((r) => {
      if (mesReferencia && ![mesReferencia, mesComparacao].includes(r.mes_key)) return false;
      if (filtroLinha && r.linha !== filtroLinha) return false;
      if (filtroSetor && r.setor_manutencao !== filtroSetor) return false;
      if (filtroTipo && r.tipo_norm !== filtroTipo) return false;
      if (filtroCluster && r.cluster !== filtroCluster) return false;
      if (filtroStatus && r.status !== normalize(filtroStatus)) return false;
      if (filtroControlabilidade === "CONTROLÁVEL" && !r.controlavel) return false;
      if (filtroControlabilidade === "NÃO CONTROLÁVEL" && !r.nao_controlavel) return false;

      if (!q) return true;

      return [
        r.numero_sos,
        r.veiculo,
        r.motorista,
        r.linha,
        r.tipo_norm,
        r.problema_encontrado,
        r.setor_manutencao,
        r.status,
        r.responsavel_revisao
      ].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [
    sosProcessado,
    busca,
    mesReferencia,
    mesComparacao,
    filtroLinha,
    filtroSetor,
    filtroTipo,
    filtroCluster,
    filtroStatus,
    filtroControlabilidade,
  ]);

  const baseRef = useMemo(() => baseFiltrada.filter((r) => r.mes_key === mesReferencia), [baseFiltrada, mesReferencia]);
  const baseComp = useMemo(() => baseFiltrada.filter((r) => r.mes_key === mesComparacao), [baseFiltrada, mesComparacao]);

  const kmMesMap = useMemo(() => {
    const map = new Map();
    kmProcessado.forEach((r) => {
      const key = String(r.data).slice(0, 7);
      map.set(key, n(map.get(key)) + n(r.km_total));
    });
    return map;
  }, [kmProcessado]);

  const reincidenciaCalcRef = useMemo(() => {
    const porVeiculo = new Map();
    [...baseRef].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos))).forEach((r) => {
      if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
      porVeiculo.get(r.veiculo).push(r);
    });

    let totalReincVeiculo = 0;
    let totalReincTecnica = 0;
    let totalReincSetorial = 0;
    let somaIntervalos = 0;
    let qtdIntervalos = 0;
    const detalhesVeiculo = [];

    porVeiculo.forEach((eventos, veiculo) => {
      let reincVeiculo = 0;
      let reincTecnica = 0;
      let reincSetorial = 0;
      let intervaloSoma = 0;
      let intervaloQtd = 0;

      for (let i = 1; i < eventos.length; i += 1) {
        const atual = eventos[i];
        const anterior = eventos[i - 1];
        const delta = diffDays(atual.data_sos, anterior.data_sos);

        if (delta != null) {
          intervaloSoma += delta;
          intervaloQtd += 1;
          somaIntervalos += delta;
          qtdIntervalos += 1;

          if (delta <= 30) {
            reincVeiculo += 1;
            totalReincVeiculo += 1;

            if (atual.problema_encontrado === anterior.problema_encontrado && atual.problema_encontrado !== "N/D") {
              reincTecnica += 1;
              totalReincTecnica += 1;
            }

            if (atual.setor_manutencao === anterior.setor_manutencao && atual.setor_manutencao !== "N/D") {
              reincSetorial += 1;
              totalReincSetorial += 1;
            }
          }
        }
      }

      detalhesVeiculo.push({
        veiculo,
        cluster: eventos[0]?.cluster || "OUTROS",
        linhaTop: eventos[eventos.length - 1]?.linha || "N/D",
        totalSOS: eventos.length,
        reincVeiculo,
        reincTecnica,
        reincSetorial,
        intervaloMedio: intervaloQtd > 0 ? intervaloSoma / intervaloQtd : 0,
        defeitoTop: Object.entries(eventos.reduce((acc, r) => { acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        setorTop: Object.entries(eventos.reduce((acc, r) => { acc[r.setor_manutencao] = n(acc[r.setor_manutencao]) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      });
    });

    const veiculosComSOS = detalhesVeiculo.length;
    const veiculosReincidentes = detalhesVeiculo.filter((v) => v.reincVeiculo > 0).length;
    const taxaReincidencia = veiculosComSOS > 0 ? (veiculosReincidentes / veiculosComSOS) * 100 : 0;
    const intervaloMedioGeral = qtdIntervalos > 0 ? somaIntervalos / qtdIntervalos : 0;

    return {
      totalReincVeiculo,
      totalReincTecnica,
      totalReincSetorial,
      veiculosComSOS,
      veiculosReincidentes,
      taxaReincidencia,
      intervaloMedioGeral,
      detalhesVeiculo: detalhesVeiculo.sort((a, b) => b.reincVeiculo - a.reincVeiculo || b.totalSOS - a.totalSOS),
    };
  }, [baseRef]);

  const resumoAtual = useMemo(() => {
    const kmTotal = n(kmMesMap.get(mesReferencia));
    const interv = baseRef.length; 
    const validasParaMkbf = baseRef.filter((r) => r.valida_mkbf).length;
    const mkbf = validasParaMkbf > 0 ? kmTotal / validasParaMkbf : 0;

    const countControlaveis = baseRef.filter((r) => r.controlavel).length;

    const porTipoMap = {};
    TIPOS_GRAFICO.forEach((t) => (porTipoMap[t] = 0));
    baseRef.forEach((r) => {
      if (TIPOS_GRAFICO.includes(r.tipo_norm)) porTipoMap[r.tipo_norm] += 1;
    });

    const prevValidos = baseRef.filter((r) => n(r.dias_ultima_preventiva_calc) > 0);
    const inspValidos = baseRef.filter((r) => n(r.dias_ultima_inspecao_calc) > 0);

    const mediaPrev = prevValidos.reduce((acc, r) => acc + n(r.dias_ultima_preventiva_calc), 0) / Math.max(1, prevValidos.length);
    const mediaInsp = inspValidos.reduce((acc, r) => acc + n(r.dias_ultima_inspecao_calc), 0) / Math.max(1, inspValidos.length);

    const mediaFechamento =
      baseRef.filter((r) => r.tempo_solucao_horas > 0).reduce((acc, r) => acc + r.tempo_solucao_horas, 0) /
      Math.max(1, baseRef.filter((r) => r.tempo_solucao_horas > 0).length);

    return { kmTotal, interv, countControlaveis, mkbf, porTipoMap, mediaPrev, mediaInsp, mediaFechamento, ...reincidenciaCalcRef };
  }, [kmMesMap, mesReferencia, baseRef, reincidenciaCalcRef]);

  const resumoComp = useMemo(() => {
    const kmTotal = n(kmMesMap.get(mesComparacao));
    const interv = baseComp.length;
    const validasParaMkbf = baseComp.filter((r) => r.valida_mkbf).length;
    const mkbf = validasParaMkbf > 0 ? kmTotal / validasParaMkbf : 0;

    const porTipoMap = {};
    TIPOS_GRAFICO.forEach((t) => (porTipoMap[t] = 0));
    baseComp.forEach((r) => {
      if (TIPOS_GRAFICO.includes(r.tipo_norm)) porTipoMap[r.tipo_norm] += 1;
    });

    const porVeiculo = new Map();
    [...baseComp].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos))).forEach((r) => {
      if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
      porVeiculo.get(r.veiculo).push(r);
    });

    let veiculosReincidentes = 0;
    porVeiculo.forEach((eventos) => {
      let reinc = false;
      for (let i = 1; i < eventos.length; i += 1) {
        if (diffDays(eventos[i].data_sos, eventos[i - 1].data_sos) <= 30) {
          reinc = true; break;
        }
      }
      if (reinc) veiculosReincidentes += 1;
    });

    const taxaReincidencia = porVeiculo.size > 0 ? (veiculosReincidentes / porVeiculo.size) * 100 : 0;
    const mediaFechamento = baseComp.filter((r) => r.tempo_solucao_horas > 0).reduce((acc, r) => acc + r.tempo_solucao_horas, 0) / Math.max(1, baseComp.filter((r) => r.tempo_solucao_horas > 0).length);

    return { kmTotal, interv, mkbf, porTipoMap, taxaReincidencia, mediaFechamento };
  }, [kmMesMap, mesComparacao, baseComp]);

  const historico12m = useMemo(() => {
    return mesesDisponiveis.slice(-12).map((mes) => {
      const baseMes = sosProcessado.filter((r) => {
        if (r.mes_key !== mes) return false;
        if (filtroControlabilidade === "CONTROLÁVEL" && !r.controlavel) return false;
        if (filtroControlabilidade === "NÃO CONTROLÁVEL" && !r.nao_controlavel) return false;
        return true;
      });

      const kmTotal = n(kmMesMap.get(mes));
      const validasParaMkbf = baseMes.filter((r) => r.valida_mkbf).length;
      const mkbf = validasParaMkbf > 0 ? kmTotal / validasParaMkbf : 0;

      const porVeiculo = new Map();
      [...baseMes].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos))).forEach((r) => {
        if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
        porVeiculo.get(r.veiculo).push(r);
      });

      let veiculosReincidentes = 0;
      porVeiculo.forEach((eventos) => {
        let reinc = false;
        for (let i = 1; i < eventos.length; i += 1) {
          if (diffDays(eventos[i].data_sos, eventos[i - 1].data_sos) <= 30) {
            reinc = true; break;
          }
        }
        if (reinc) veiculosReincidentes += 1;
      });

      return {
        mes,
        mesLabel: monthLabelFromKey(mes),
        intervTotal: baseMes.length,
        reincidentes: veiculosReincidentes,
        taxaReincidencia: porVeiculo.size > 0 ? (veiculosReincidentes / porVeiculo.size) * 100 : 0,
        kmTotal,
        mkbf,
        meta: MKBF_META,
      };
    });
  }, [mesesDisponiveis, sosProcessado, kmMesMap, filtroControlabilidade]);

  const graficoTipos = useMemo(() => TIPOS_GRAFICO.map((tipo) => ({
    tipo, anterior: n(resumoComp.porTipoMap?.[tipo]), atual: n(resumoAtual.porTipoMap?.[tipo]),
  })), [resumoAtual, resumoComp]);

  const graficoFaixaPreventiva = useMemo(() => {
    const counts = { "0-7 dias":0, "8-15 dias":0, "16-30 dias":0, "31-60 dias":0, "60+ dias":0, "Sem informação":0 };
    baseRef.forEach((r) => counts[r.faixa_preventiva] = n(counts[r.faixa_preventiva]) + 1);
    return Object.entries(counts).map(([faixa, total]) => ({ faixa, total }));
  }, [baseRef]);

  const graficoFaixaInspecao = useMemo(() => {
    const counts = { "0-7 dias":0, "8-15 dias":0, "16-30 dias":0, "31-60 dias":0, "60+ dias":0, "Sem informação":0 };
    baseRef.forEach((r) => counts[r.faixa_inspecao] = n(counts[r.faixa_inspecao]) + 1);
    return Object.entries(counts).map(([faixa, total]) => ({ faixa, total }));
  }, [baseRef]);

  const tabelaLinhas = useMemo(() => {
    const linhas = [...new Set(baseRef.map((r) => r.linha))];
    return linhas.map((linha) => {
      const atual = baseRef.filter((r) => r.linha === linha);
      const anterior = baseComp.filter((r) => r.linha === linha);

      const porVeiculo = new Map();
      [...atual].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos))).forEach((r) => {
        if (!porVeiculo.has(r.veiculo)) porVeiculo.set(r.veiculo, []);
        porVeiculo.get(r.veiculo).push(r);
      });

      let veiculosReincidentes = 0;
      porVeiculo.forEach((eventos) => {
        let reinc = false;
        for (let i = 1; i < eventos.length; i += 1) {
          if (diffDays(eventos[i].data_sos, eventos[i - 1].data_sos) <= 30) {
            reinc = true; break;
          }
        }
        if (reinc) veiculosReincidentes += 1;
      });

      return {
        linha,
        totalAtual: atual.length,
        totalAnterior: anterior.length,
        variacao_pct: variancePct(atual.length, anterior.length),
        veiculosReincidentes,
        taxaReincidencia: porVeiculo.size > 0 ? (veiculosReincidentes / porVeiculo.size) * 100 : 0,
        defeitoTop: Object.entries(atual.reduce((acc, r) => { acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        setorTop: Object.entries(atual.reduce((acc, r) => { acc[r.setor_manutencao] = n(acc[r.setor_manutencao]) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
      };
    }).sort((a, b) => b.veiculosReincidentes - a.veiculosReincidentes || b.totalAtual - a.totalAtual);
  }, [baseRef, baseComp]);

  const tabelaVeiculos = useMemo(() => reincidenciaCalcRef.detalhesVeiculo, [reincidenciaCalcRef]);

  const tabelaSetores = useMemo(() => {
    const map = new Map();
    baseRef.forEach((r) => {
      const key = r.setor_manutencao;
      if (!map.has(key)) map.set(key, { setor: key, total: 0, linhas: new Set(), veiculos: new Set(), defeitos: {}, reincSetorial: 0 });
      const item = map.get(key);
      item.total += 1; item.linhas.add(r.linha); item.veiculos.add(r.veiculo); item.defeitos[r.problema_encontrado] = n(item.defeitos[r.problema_encontrado]) + 1;
    });

    const porVeiculoSetor = new Map();
    [...baseRef].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos))).forEach((r) => {
      const key = `${r.veiculo}__${r.setor_manutencao}`;
      if (!porVeiculoSetor.has(key)) porVeiculoSetor.set(key, []);
      porVeiculoSetor.get(key).push(r);
    });

    porVeiculoSetor.forEach((eventos, key) => {
      let reinc = 0;
      for (let i = 1; i < eventos.length; i += 1) {
        if (diffDays(eventos[i].data_sos, eventos[i - 1].data_sos) <= 30) reinc += 1;
      }
      const setor = key.split("__")[1];
      if (map.has(setor)) map.get(setor).reincSetorial += reinc;
    });

    return [...map.values()].map((r) => ({
      setor: r.setor, total: r.total, linhas: r.linhas.size, veiculos: r.veiculos.size, reincSetorial: r.reincSetorial,
      defeitoTop: Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
    })).sort((a, b) => b.reincSetorial - a.reincSetorial || b.total - a.total);
  }, [baseRef]);

  const tabelaDefeitos = useMemo(() => {
    const map = new Map();
    baseRef.forEach((r) => {
      const key = r.problema_encontrado;
      if (!map.has(key)) map.set(key, { defeito: key, total: 0, veiculos: new Set(), setores: new Set(), linhas: new Set(), diasPrevSoma: 0, diasPrevQtd: 0, diasInspSoma: 0, diasInspQtd: 0 });
      const item = map.get(key);
      item.total += 1; item.veiculos.add(r.veiculo); item.setores.add(r.setor_manutencao); item.linhas.add(r.linha);
      if (n(r.dias_ultima_preventiva_calc) > 0) { item.diasPrevSoma += n(r.dias_ultima_preventiva_calc); item.diasPrevQtd += 1; }
      if (n(r.dias_ultima_inspecao_calc) > 0) { item.diasInspSoma += n(r.dias_ultima_inspecao_calc); item.diasInspQtd += 1; }
    });

    const porVeiculoDefeito = new Map();
    [...baseRef].sort((a, b) => String(a.data_sos).localeCompare(String(b.data_sos))).forEach((r) => {
      const key = `${r.veiculo}__${r.problema_encontrado}`;
      if (!porVeiculoDefeito.has(key)) porVeiculoDefeito.set(key, []);
      porVeiculoDefeito.get(key).push(r);
    });

    const reincPorDefeito = new Map();
    porVeiculoDefeito.forEach((eventos, key) => {
      let reinc = 0;
      for (let i = 1; i < eventos.length; i += 1) {
        if (diffDays(eventos[i].data_sos, eventos[i - 1].data_sos) <= 30) reinc += 1;
      }
      const defeito = key.split("__")[1];
      reincPorDefeito.set(defeito, n(reincPorDefeito.get(defeito)) + reinc);
    });

    return [...map.values()].map((r) => ({
      defeito: r.defeito, total: r.total, veiculos: r.veiculos.size, setores: r.setores.size, linhas: r.linhas.size,
      reincTecnica: n(reincPorDefeito.get(r.defeito)),
      mediaPrev: r.diasPrevQtd > 0 ? r.diasPrevSoma / r.diasPrevQtd : 0,
      mediaInsp: r.diasInspQtd > 0 ? r.diasInspSoma / r.diasInspQtd : 0,
    })).sort((a, b) => b.reincTecnica - a.reincTecnica || b.total - a.total);
  }, [baseRef]);

  const tabelaMotoristas = useMemo(() => {
    const map = new Map();
    baseRef.forEach((r) => {
      const key = r.motorista;
      if (!map.has(key)) map.set(key, { motorista: key, total: 0, veiculos: new Set(), linhas: new Set(), defeitos: {} });
      const item = map.get(key);
      item.total += 1; item.veiculos.add(r.veiculo); item.linhas.add(r.linha); item.defeitos[r.problema_encontrado] = n(item.defeitos[r.problema_encontrado]) + 1;
    });

    return [...map.values()].map((r) => ({
      motorista: r.motorista, total: r.total, veiculos: r.veiculos.size, linhas: r.linhas.size,
      defeitoTop: Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
    })).sort((a, b) => b.total - a.total);
  }, [baseRef]);

  // =============== LÓGICA DE AVALIAÇÃO DE FUNCIONÁRIOS REAJUSTADA (PREV E INSP) ===============
  const tabelaFuncionarios = useMemo(() => {
    const map = new Map();

    const extractNameSafe = (val) => {
      if (!val) return null;
      const str = String(val);
      return str.includes(' - ') ? (str.split(' - ')[1] || str).trim() : str.trim();
    };

    // 1. Produtividade (Volume executado no Mês) -> Preventivas e Inspeções
    const prevsNoPeriodo = prevRows.filter(p => {
       if (mesReferencia && String(p.data_realizacao).slice(0,7) !== mesReferencia) return false;
       return true;
    });

    prevsNoPeriodo.forEach(p => {
      const m = extractNameSafe(p.mecanico);
      const e = extractNameSafe(p.eletricista);
      const f = extractNameSafe(p.funilaria);
      const b = extractNameSafe(p.borracharia);
      
      [m, e, f, b].forEach(nome => {
          if (nome) {
              if (!map.has(nome)) {
                  map.set(nome, { nome, revisoesFeitasMes: 0, sosAtribuidos: 0, sosPrecoce: 0, diasRevSoma: 0, diasRevQtd: 0, kmRevSoma: 0, kmRevQtd: 0, defeitos: {} });
              }
              map.get(nome).revisoesFeitasMes += 1;
          }
      });
    });

    // 2. Avaliação da Quebra (Filtrada)
    // baseRef JÁ ESTÁ FILTRADA pelos botões da tela (Controlável, Setor, etc).
    // O SOS que entrar aqui, entra na conta do cara que fez a última revisão.
    baseRef.forEach((r) => {
      if (!r.responsavel_revisao || r.responsavel_revisao === "Não Identificado") return;

      const key = r.responsavel_revisao;
      if (!map.has(key)) {
        map.set(key, {
          nome: key,
          funcao: r.funcao_responsavel,
          revisoesFeitasMes: 0,
          sosAtribuidos: 0,
          sosPrecoce: 0,
          diasRevSoma: 0,
          diasRevQtd: 0,
          kmRevSoma: 0,
          kmRevQtd: 0,
          defeitos: {},
        });
      }

      const item = map.get(key);
      if (!item.funcao) item.funcao = r.funcao_responsavel;

      // Calcular o KM Rodado desde a última revisão (seja Prev ou Insp)
      let kmRodado = null;
      if (n(r.km_veiculo_sos) > 0 && n(r.km_vinc_revisao_atribuida) > 0) {
        kmRodado = Math.max(0, n(r.km_veiculo_sos) - n(r.km_vinc_revisao_atribuida));
      }

      const diasPosRev = r.dias_revisao_atribuida;
      const isInsp = r.tipo_revisao_atribuida === "Inspeção";

      // 3. Constantes de Ciclo (Outliers limit)
      // Se quebrou muito longe do que a revisão protege, não foi culpa da revisão.
      const MAX_KM = isInsp ? 6000 : 12000;
      const MAX_DIAS = isInsp ? 25 : 45;

      const kmValido = (kmRodado !== null && kmRodado <= MAX_KM);
      const diasValido = (diasPosRev <= MAX_DIAS);

      if (kmValido || diasValido) {
          item.sosAtribuidos += 1; // Esse SOS entra como culpa desse funcionário

          if (diasValido) {
              item.diasRevSoma += diasPosRev;
              item.diasRevQtd += 1;
          }

          if (kmValido) {
              item.kmRevSoma += kmRodado;
              item.kmRevQtd += 1;
          }

          // 4. Regra Mestra de Retrabalho Técnico
          // Menos de 15 dias ou menos de 3.000 KM rodados após o cara mexer.
          if (diasPosRev <= 15 || (kmValido && kmRodado <= 3000)) {
              item.sosPrecoce += 1;
          }

          item.defeitos[r.problema_encontrado] = n(item.defeitos[r.problema_encontrado]) + 1;
      }
    });

    return [...map.values()]
      .filter(r => r.revisoesFeitasMes > 0 || r.sosAtribuidos > 0)
      .map(r => {
        // Taxa de Retrabalho Técnico -> Dos SOS que caíram pra ele, qual % é precoce?
        const taxaRetrabalho = r.sosAtribuidos > 0 ? (r.sosPrecoce / r.sosAtribuidos) * 100 : 0;

        return {
          nome: r.nome,
          funcao: r.funcao || "Múltiplas",
          revisoesFeitasMes: r.revisoesFeitasMes,
          sosAtribuidos: r.sosAtribuidos,
          sosPrecoce: r.sosPrecoce,
          taxaRetrabalho: taxaRetrabalho,
          mediaDiasQuebra: r.diasRevQtd > 0 ? (r.diasRevSoma / r.diasRevQtd) : 0,
          mediaKmQuebra: r.kmRevQtd > 0 ? (r.kmRevSoma / r.kmRevQtd) : 0,
          defeitoTop: Object.entries(r.defeitos).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/D",
        };
      })
      .sort((a, b) => b.sosPrecoce - a.sosPrecoce || b.sosAtribuidos - a.sosAtribuidos);
  }, [baseRef, prevRows, mesReferencia]);

  const top5Veiculos3m = useMemo(() => {
    if (!mesReferencia) return [];
    const ref = firstDayOfMonth(mesReferencia);
    if (!ref) return [];
    const months3 = [addMonths(ref, -2), addMonths(ref, -1), ref].map(monthKey);

    const base = sosProcessado.filter((r) => {
      if (!months3.includes(r.mes_key)) return false;
      if (filtroControlabilidade === "CONTROLÁVEL" && !r.controlavel) return false;
      if (filtroControlabilidade === "NÃO CONTROLÁVEL" && !r.nao_controlavel) return false;
      return true;
    });

    const counts = new Map();

    base.forEach((r) => {
      if (!counts.has(r.veiculo)) counts.set(r.veiculo, []);
      counts.get(r.veiculo).push(r);
    });

    return [...counts.entries()]
      .map(([veiculo, itens]) => {
        const porMes = Object.fromEntries(months3.map((m) => [monthLabelFromKey(m), 0]));
        itens.forEach((r) => {
          porMes[monthLabelFromKey(r.mes_key)] = n(porMes[monthLabelFromKey(r.mes_key)]) + 1;
        });

        const topDefeitos = Object.entries(
          itens.reduce((acc, r) => {
            acc[r.problema_encontrado] = n(acc[r.problema_encontrado]) + 1;
            return acc;
          }, {})
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k, v]) => `${k} (${v})`)
          .join(" | ");

        return {
          veiculo,
          total: itens.length,
          cluster: itens[0]?.cluster || "OUTROS",
          ...porMes,
          topDefeitos: topDefeitos || "N/D",
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [mesReferencia, sosProcessado, filtroControlabilidade]);

  const leituraAnalitica = useMemo(() => {
    const linhaTop = tabelaLinhas[0]?.linha || "N/D";
    const defeitoTop = tabelaDefeitos[0]?.defeito || "N/D";
    const setorTop = tabelaSetores[0]?.setor || "N/D";
    const funcTop = tabelaFuncionarios[0]?.nome || "N/D";

    return [
      `A pressão do mês está concentrada na linha ${linhaTop}, com ${fmtInt(
        tabelaLinhas[0]?.totalAtual || 0
      )} SOS analisados e ${fmtInt(tabelaLinhas[0]?.veiculosReincidentes || 0)} veículos reincidentes.`,
      `O defeito mais recorrente é "${defeitoTop}", puxado principalmente pelo setor ${setorTop}.`,
      `O colaborador com mais retrabalhos precoces (≤ 15 dias ou ≤ 3k km) foi ${funcTop} (Retrabalhos: ${fmtInt(tabelaFuncionarios[0]?.sosPrecoce || 0)}). Dos SOS atribuídos a ele, ${fmtPct(tabelaFuncionarios[0]?.taxaRetrabalho || 0)} foram precoces. Os veículos rodaram em média ${fmtInt(tabelaFuncionarios[0]?.mediaKmQuebra || 0)} km pós-revisão.`,
      `O intervalo médio entre SOS do mesmo veículo está em ${fmtNum(
        resumoAtual.intervaloMedioGeral || 0,
        1
      )} dias, com taxa de reincidência de ${fmtPct(resumoAtual.taxaReincidencia || 0)}.`,
    ];
  }, [
    tabelaLinhas,
    tabelaDefeitos,
    tabelaSetores,
    tabelaFuncionarios,
    resumoAtual.intervaloMedioGeral,
    resumoAtual.taxaReincidencia,
  ]);

  const exportAtual = () => {
    // ... Exports iguais, só ajustei a aba FUNCIONARIOS ...
    if (abaAtiva === "EXECUTIVO") {
      exportarCSV(
        historico12m.map((r) => ({
          Mês: r.mesLabel,
          "Total SOS": fmtInt(r.intervTotal),
          "Veículos Reincidentes": fmtInt(r.reincidentes),
          "Taxa Reincidência %": fmtNum(r.taxaReincidencia, 1),
          KM: fmtInt(r.kmTotal),
          MKBF: fmtNum(r.mkbf),
          Meta: fmtNum(r.meta),
        })),
        "SOS_Resumo_Executivo"
      );
    }
    if (abaAtiva === "REINCIDENCIA") {
      exportarCSV(
        tabelaVeiculos.map((r) => ({
          Veículo: r.veiculo,
          Cluster: r.cluster,
          Linha: r.linhaTop,
          "SOS Total": r.totalSOS,
          "Reinc. Veículo": r.reincVeiculo,
          "Reinc. Técnica": r.reincTecnica,
          "Reinc. Setorial": r.reincSetorial,
          "Intervalo Médio": fmtNum(r.intervaloMedio, 1),
          "Defeito Top": r.defeitoTop,
          "Setor Top": r.setorTop,
        })),
        "SOS_Resumo_Reincidencia"
      );
    }
    if (abaAtiva === "PREV_INSPEC") {
      exportarCSV(
        baseRef.map((r) => ({
          Data: fmtDateBr(r.data_sos),
          SOS: r.numero_sos || "-",
          Veículo: r.veiculo,
          Linha: r.linha,
          Defeito: r.problema_encontrado,
          Setor: r.setor_manutencao,
          "Responsável Últ. Revisão": r.responsavel_revisao,
          "Função": r.funcao_responsavel,
          "Dias após Preventiva": r.dias_ultima_preventiva_calc,
          "Faixa Preventiva": r.faixa_preventiva,
          "Dias após Inspeção": r.dias_ultima_inspecao_calc,
          "Faixa Inspeção": r.faixa_inspecao,
        })),
        "SOS_Resumo_Prev_Inspec"
      );
    }
    if (abaAtiva === "FUNCIONARIOS") {
      exportarCSV(
        tabelaFuncionarios.map((r) => ({
          Funcionário: r.nome,
          Função: r.funcao,
          "Volume Revisões no Mês": r.revisoesFeitasMes,
          "SOS Atribuídos no Mês": r.sosAtribuidos,
          "SOS Retrabalho Precoce": r.sosPrecoce,
          "Taxa de Retrabalho %": fmtNum(r.taxaRetrabalho, 1),
          "Média Dias Pós-Revisão": fmtNum(r.mediaDiasQuebra, 1),
          "Média KM Pós-Revisão": fmtInt(r.mediaKmQuebra),
          "Principal Defeito": r.defeitoTop,
        })),
        "SOS_Resumo_Funcionarios"
      );
    }
    if (abaAtiva === "LINHAS") {
      exportarCSV(
        tabelaLinhas.map((r) => ({
          Linha: r.linha,
          "SOS Atual": r.totalAtual,
          "SOS Anterior": r.totalAnterior,
          "Variação %": fmtNum(r.variacao_pct, 1),
          "Veículos Reincidentes": r.veiculosReincidentes,
          "Taxa Reincidência %": fmtNum(r.taxaReincidencia, 1),
          "Defeito Top": r.defeitoTop,
          "Setor Top": r.setorTop,
        })),
        "SOS_Resumo_Linhas"
      );
    }
    if (abaAtiva === "VEICULOS") {
      exportarCSV(
        tabelaVeiculos.map((r) => ({
          Veículo: r.veiculo,
          Cluster: r.cluster,
          Linha: r.linhaTop,
          "SOS Total": r.totalSOS,
          "Reinc. Veículo": r.reincVeiculo,
          "Reinc. Técnica": r.reincTecnica,
          "Reinc. Setorial": r.reincSetorial,
          "Intervalo Médio": fmtNum(r.intervaloMedio, 1),
          "Defeito Top": r.defeitoTop,
          "Setor Top": r.setorTop,
        })),
        "SOS_Resumo_Veiculos"
      );
    }
    if (abaAtiva === "SETORES") {
      exportarCSV(
        tabelaSetores.map((r) => ({
          Setor: r.setor,
          Total: r.total,
          Linhas: r.linhas,
          Veículos: r.veiculos,
          "Reincidência Setorial": r.reincSetorial,
          "Defeito Top": r.defeitoTop,
        })),
        "SOS_Resumo_Setores"
      );
    }
    if (abaAtiva === "DEFEITOS") {
      exportarCSV(
        tabelaDefeitos.map((r) => ({
          Defeito: r.defeito,
          Total: r.total,
          Veículos: r.veiculos,
          Setores: r.setores,
          Linhas: r.linhas,
          "Reincidência Técnica": r.reincTecnica,
          "Média após Preventiva": fmtNum(r.mediaPrev, 1),
          "Média após Inspeção": fmtNum(r.mediaInsp, 1),
        })),
        "SOS_Resumo_Defeitos"
      );
    }
    if (abaAtiva === "MOTORISTAS") {
      exportarCSV(
        tabelaMotoristas.map((r) => ({
          Motorista: r.motorista,
          Total: r.total,
          Veículos: r.veiculos,
          Linhas: r.linhas,
          "Defeito Top": r.defeitoTop,
        })),
        "SOS_Resumo_Motoristas"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border shadow-sm p-4 md:p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-black border border-amber-200">
              <FaBolt /> Resumo SOS / Reincidência / Controláveis
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-3">
              PAINEL DE INTERVENÇÕES
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Visão analítica focada em reincidência, pós-preventiva, pós-inspeção e
              robustez da manutenção.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={exportAtual} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition">
              <FaDownload /> Baixar Excel
            </button>

            <button onClick={() => setMostrarExplicacao((v) => !v)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-bold hover:bg-blue-200 transition">
              <FaInfoCircle /> {mostrarExplicacao ? "Ocultar Cálculos" : "Entender Cálculos"}
            </button>

            <button onClick={carregarTudo} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-700 transition">
              <FaSync /> Atualizar
            </button>
          </div>
        </div>

        {mostrarExplicacao && (
          <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm space-y-2">
            <p><strong>Base da tela:</strong> Traz a base consolidada de todos os SOS válidos, filtrada de acordo com as seleções abaixo.</p>
            <p><strong>Reincidência operacional:</strong> mesmo veículo com novo SOS em até 30 dias.</p>
            <p><strong>Reincidência técnica:</strong> mesmo veículo + mesmo defeito em até 30 dias.</p>
            <p><strong>Avaliação de Funcionário:</strong> O SOS agora é atribuído ao mecânico que executou a <strong>ÚLTIMA</strong> revisão (Preventiva ou Inspeção). "Revisões no Mês" indica apenas volume de produção. A <strong>Taxa de Retrabalho</strong> pega apenas os SOS Atribuídos (após passar nos seus filtros de tela) e calcula quantos quebraram em <strong>≤ 15 dias ou ≤ 3.000 KM</strong>.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 mt-4">
          <div className="xl:col-span-2 relative">
            <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar SOS, veículo, linha, defeito, motorista, avaliador..." className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>

          <select value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Mês referência</option>
            {mesesDisponiveis.map((m) => (<option key={m} value={m}>{monthLabelFromKey(m)}</option>))}
          </select>

          <select value={filtroLinha} onChange={(e) => setFiltroLinha(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todas as linhas</option>
            {linhaOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>

          <select value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os setores</option>
            {setorOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>

          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os tipos</option>
            {tipoOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <select value={filtroCluster} onChange={(e) => setFiltroCluster(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os clusters</option>
            {clusterOptions.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>

          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todos os status</option>
            <option value="ABERTO">ABERTO</option>
            <option value="EM ANDAMENTO">EM ANDAMENTO</option>
            <option value="FECHADO">FECHADO</option>
          </select>

          <select value={filtroControlabilidade} onChange={(e) => setFiltroControlabilidade(e.target.value)} className="px-3 py-3 rounded-xl border border-slate-200 bg-white font-semibold">
            <option value="">Todas classificações</option>
            <option value="CONTROLÁVEL">Controlável</option>
            <option value="NÃO CONTROLÁVEL">Não Controlável</option>
          </select>

          <button onClick={() => { setBusca(""); setFiltroLinha(""); setFiltroSetor(""); setFiltroTipo(""); setFiltroCluster(""); setFiltroStatus(""); setFiltroControlabilidade(""); }} className="px-3 py-3 rounded-xl border border-slate-200 bg-slate-800 text-white font-black hover:bg-slate-700 transition">
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CardKPI title="Total SOS Analisado" value={fmtInt(resumoAtual.interv)} sub={filtroControlabilidade ? `Filtro: ${filtroControlabilidade}` : "Todos os SOS"} icon={<FaExclamationTriangle />} tone="rose" className="md:col-span-2 xl:col-span-2" />
        <CardKPI title="Tempo Médio Fechamento" value={fmtHoras(resumoAtual.mediaFechamento)} sub="Desde abertura da etiqueta" icon={<FaClock />} tone="slate" />
        <CardKPI title="Veículos Reincidentes" value={fmtInt(resumoAtual.veiculosReincidentes)} sub="Mesmo veículo em até 30 dias" icon={<FaBus />} tone="violet" />
        <CardKPI title="Taxa Reincidência" value={fmtPct(resumoAtual.taxaReincidencia)} sub="Sobre veículos da base atual" icon={<FaChartLine />} tone="amber" />
        <CardKPI title="MKBF" value={fmtNum(resumoAtual.mkbf)} sub={`Meta ${fmtNum(MKBF_META)}`} icon={<FaBolt />} tone="blue" />
        <CardKPI title="Dias após Preventiva" value={fmtNum(resumoAtual.mediaPrev, 1)} sub="Média do mês" icon={<FaWrench />} tone="emerald" />
        <CardKPI title="Dias entre SOS" value={fmtNum(resumoAtual.intervaloMedioGeral, 1)} sub="Intervalo médio do veículo" icon={<FaRoad />} tone="violet" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {leituraAnalitica.map((txt, i) => (
          <div key={i} className="bg-white rounded-2xl border shadow-sm p-4"><p className="text-sm text-slate-700 font-semibold leading-6">{txt}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">MKBF vs mês anterior</p><p className="text-xl font-black text-slate-800 mt-1">{fmtNum(resumoComp.mkbf)} → {fmtNum(resumoAtual.mkbf)}</p></div>
          <EvolucaoBadge value={variancePct(resumoAtual.mkbf, resumoComp.mkbf)} />
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Total vs mês anterior</p><p className="text-xl font-black text-slate-800 mt-1">{fmtInt(resumoComp.interv)} → {fmtInt(resumoAtual.interv)}</p></div>
          <EvolucaoBadge value={variancePct(resumoAtual.interv, resumoComp.interv)} invert />
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Reincidência vs mês anterior</p><p className="text-xl font-black text-slate-800 mt-1">{fmtPct(resumoComp.taxaReincidencia)} → {fmtPct(resumoAtual.taxaReincidencia)}</p></div>
          <EvolucaoBadge value={variancePct(resumoAtual.taxaReincidencia, resumoComp.taxaReincidencia)} invert />
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-wider text-slate-500">Tempo Médio vs mês anterior</p><p className="text-xl font-black text-slate-800 mt-1">{fmtHoras(resumoComp.mediaFechamento)} → {fmtHoras(resumoAtual.mediaFechamento)}</p></div>
          <EvolucaoBadge value={variancePct(resumoAtual.mediaFechamento, resumoComp.mediaFechamento)} invert />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton active={abaAtiva === "EXECUTIVO"} onClick={() => setAbaAtiva("EXECUTIVO")} icon={<FaChartPie />}>Executivo</TabButton>
        <TabButton active={abaAtiva === "REINCIDENCIA"} onClick={() => setAbaAtiva("REINCIDENCIA")} icon={<FaClipboardList />}>Reincidência</TabButton>
        <TabButton active={abaAtiva === "PREV_INSPEC"} onClick={() => setAbaAtiva("PREV_INSPEC")} icon={<FaWrench />}>Preventiva / Inspeção</TabButton>
        <TabButton active={abaAtiva === "FUNCIONARIOS"} onClick={() => setAbaAtiva("FUNCIONARIOS")} icon={<FaUserCog />}>Avaliação de Técnicos</TabButton>
        <TabButton active={abaAtiva === "LINHAS"} onClick={() => setAbaAtiva("LINHAS")} icon={<FaBus />}>Linhas</TabButton>
        <TabButton active={abaAtiva === "VEICULOS"} onClick={() => setAbaAtiva("VEICULOS")} icon={<FaBus />}>Veículos</TabButton>
        <TabButton active={abaAtiva === "SETORES"} onClick={() => setAbaAtiva("SETORES")} icon={<FaCogs />}>Setores</TabButton>
        <TabButton active={abaAtiva === "DEFEITOS"} onClick={() => setAbaAtiva("DEFEITOS")} icon={<FaTools />}>Defeitos</TabButton>
        <TabButton active={abaAtiva === "MOTORISTAS"} onClick={() => setAbaAtiva("MOTORISTAS")} icon={<FaUserTie />}>Motoristas</TabButton>
      </div>

      {/* RENDERIZAÇÃO DAS ABAS */}
      {abaAtiva === "EXECUTIVO" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-black text-slate-800">Histórico 12 meses</h3><span className="text-xs font-bold text-slate-500">SOS + reincidência</span></div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={historico12m} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.5}/><stop offset="95%" stopColor="#cbd5e1" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                    <Tooltip cursor={{ fill: 'transparent', stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="intervTotal" fillOpacity={1} fill="url(#colorTotal)" stroke="none" />
                    <Line type="monotone" dataKey="intervTotal" name="Total SOS" stroke="#cbd5e1" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="reincidentes" name="Veículos Reincidentes" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }}>
                      <LabelList dataKey="reincidentes" position="top" formatter={(v) => fmtInt(v)} style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-black text-slate-800">Evolução Histórica do MKBF</h3><span className="text-xs font-bold text-slate-500">Visão mensal</span></div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={historico12m} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorMkbf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="mesLabel" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} domain={[0, 'auto']} />
                    <Tooltip cursor={{ fill: 'transparent', stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '3 3' }} formatter={(v) => fmtNum(v)} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="mkbf" fillOpacity={1} fill="url(#colorMkbf)" stroke="none" />
                    <Line type="monotone" dataKey="mkbf" name="MKBF" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }}>
                      <LabelList dataKey="mkbf" position="top" formatter={(v) => fmtNum(v, 0)} style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} />
                    </Line>
                    <Line type="step" dataKey="meta" name="Meta" stroke="#ef4444" strokeDasharray="5 5" strokeWidth={2} dot={false} activeDot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-lg font-black text-slate-800">Tipos de ocorrência</h3><span className="text-xs font-bold text-slate-500">Mês atual x anterior</span></div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={graficoTipos} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="tipo" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                    <Tooltip cursor={{ fill: '#f8fafc' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="anterior" name="Anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={25}><LabelList dataKey="anterior" position="top" style={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} /></Bar>
                    <Bar dataKey="atual" name="Atual" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={25}><LabelList dataKey="atual" position="top" style={{ fill: "#1e293b", fontSize: 11, fontWeight: "bold" }} /></Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-4">
              <h3 className="text-lg font-black text-slate-800 mb-3">Top 5 veículos - últimos 3 meses</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="px-3 py-3 text-left">Veículo</th><th className="px-3 py-3 text-left">Cluster</th><th className="px-3 py-3 text-left">Total</th>
                      {top5Veiculos3m[0] && Object.keys(top5Veiculos3m[0]).filter((k) => k.includes("/")).map((m) => (<th key={m} className="px-3 py-3 text-left">{m}</th>))}
                      <th className="px-3 py-3 text-left">Top defeitos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top5Veiculos3m.map((r) => (
                      <tr key={r.veiculo} className="border-b last:border-b-0">
                        <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td>
                        <td className="px-3 py-3">{r.cluster}</td>
                        <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td>
                        {Object.keys(r).filter((k) => k.includes("/")).map((m) => (<td key={m} className="px-3 py-3">{fmtInt(r[m])}</td>))}
                        <td className="px-3 py-3 text-slate-600">{r.topDefeitos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NOVA VISÃO DE FUNCIONÁRIOS (TAXA DE RETRABALHO SOBRE SOS FILTRADOS) */}
      {abaAtiva === "FUNCIONARIOS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Colaboradores (SOS Atribuídos vs Retrabalho Precoce)</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaFuncionarios.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="nome" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 10 }} dy={10} interval={0} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="sosAtribuidos" name="SOS Atribuídos" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={25}>
                    <LabelList dataKey="sosAtribuidos" position="top" style={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                  <Bar dataKey="sosPrecoce" name="Retrabalho Precoce (≤15d ou ≤3k)" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={25}>
                    <LabelList dataKey="sosPrecoce" position="top" style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Avaliação Pós-Revisão (Prev ou Insp) por Colaborador</h3>
            <table className="w-full min-w-[1300px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr>
                  <th className="px-3 py-3 text-left">Funcionário</th>
                  <th className="px-3 py-3 text-left">Função</th>
                  <th className="px-3 py-3 text-left">Volume de Revisões no Mês</th>
                  <th className="px-3 py-3 text-left">SOS Atribuídos no Mês</th>
                  <th className="px-3 py-3 text-left">SOS Retrabalho Precoce</th>
                  <th className="px-3 py-3 text-left">Taxa de Retrabalho Técnico</th>
                  <th className="px-3 py-3 text-left">Média Dias até Quebrar</th>
                  <th className="px-3 py-3 text-left">Média KM até Quebrar</th>
                  <th className="px-3 py-3 text-left">Principal Defeito Associado</th>
                </tr>
              </thead>
              <tbody>
                {tabelaFuncionarios.map((r) => (
                  <tr key={r.nome} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.nome}</td>
                    <td className="px-3 py-3"><span className="bg-slate-100 px-2 py-1 rounded font-bold text-slate-600 text-xs">{r.funcao}</span></td>
                    <td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.revisoesFeitasMes)}</td>
                    <td className="px-3 py-3 font-black text-blue-600">{fmtInt(r.sosAtribuidos)}</td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.sosPrecoce)}</td>
                    <td className="px-3 py-3 font-bold">{fmtPct(r.taxaRetrabalho)}</td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{fmtNum(r.mediaDiasQuebra, 1)} dias</td>
                    <td className="px-3 py-3 font-semibold text-blue-600">{fmtInt(r.mediaKmQuebra)} km</td>
                    <td className="px-3 py-3 text-slate-600">{r.defeitoTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEMAIS ABAS IGUAIS (Reincidência, Prev/Insp, Linhas, Veículos, Setores, Defeitos, Motoristas) */}
      {abaAtiva === "REINCIDENCIA" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top linhas reincidentes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaLinhas.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="linha" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="veiculosReincidentes" name="Veículos Reincidentes" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="veiculosReincidentes" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top veículos reincidentes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaVeiculos.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="veiculo" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="reincVeiculo" name="Reincidência Veículo" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20}><LabelList dataKey="reincVeiculo" position="top" style={{ fill: "#64748b", fontSize: 11, fontWeight: "bold" }} /></Bar>
                  <Bar dataKey="reincTecnica" name="Reincidência Técnica" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20}><LabelList dataKey="reincTecnica" position="top" style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 xl:col-span-2 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Detalhe por veículo</h3>
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Veículo</th><th className="px-3 py-3 text-left">Cluster</th><th className="px-3 py-3 text-left">Linha</th><th className="px-3 py-3 text-left">SOS Total</th><th className="px-3 py-3 text-left">Reinc. Veículo</th><th className="px-3 py-3 text-left">Reinc. Técnica</th><th className="px-3 py-3 text-left">Reinc. Setorial</th><th className="px-3 py-3 text-left">Intervalo Médio</th><th className="px-3 py-3 text-left">Defeito Top</th><th className="px-3 py-3 text-left">Setor Top</th></tr>
              </thead>
              <tbody>
                {tabelaVeiculos.map((r) => (
                  <tr key={r.veiculo} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td><td className="px-3 py-3">{r.cluster}</td><td className="px-3 py-3">{r.linhaTop}</td><td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.totalSOS)}</td><td className="px-3 py-3 text-slate-600">{fmtInt(r.reincVeiculo)}</td><td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincTecnica)}</td><td className="px-3 py-3 text-slate-600">{fmtInt(r.reincSetorial)}</td><td className="px-3 py-3">{fmtNum(r.intervaloMedio, 1)}</td><td className="px-3 py-3">{r.defeitoTop}</td><td className="px-3 py-3">{r.setorTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "PREV_INSPEC" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Faixa após preventiva</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoFaixaPreventiva} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="faixa" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="total" name="SOS" fill="#10b981" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="total" position="top" style={{ fill: "#10b981", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Faixa após inspeção</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graficoFaixaInspecao} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="faixa" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="total" name="SOS" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="total" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 xl:col-span-2 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Base detalhada pós-preventiva / pós-inspeção</h3>
            <table className="w-full min-w-[1200px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Data SOS</th><th className="px-3 py-3 text-left">Veículo</th><th className="px-3 py-3 text-left">Defeito</th><th className="px-3 py-3 text-left">Setor</th><th className="px-3 py-3 text-left">Resp. Última Revisão</th><th className="px-3 py-3 text-left">Dias Pós Prev.</th><th className="px-3 py-3 text-left">Faixa Prev.</th><th className="px-3 py-3 text-left">Dias Pós Insp.</th><th className="px-3 py-3 text-left">Faixa Insp.</th></tr>
              </thead>
              <tbody>
                {baseRef.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3">{fmtDateBr(r.data_sos)}</td><td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td><td className="px-3 py-3">{r.problema_encontrado}</td><td className="px-3 py-3">{r.setor_manutencao}</td>
                    <td className="px-3 py-3"><span className="font-semibold text-slate-700">{r.responsavel_revisao}</span> <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded ml-1">{r.tipo_revisao_atribuida}</span></td>
                    <td className="px-3 py-3 font-semibold text-emerald-600">{fmtInt(r.dias_ultima_preventiva_calc)}</td><td className="px-3 py-3">{r.faixa_preventiva}</td><td className="px-3 py-3 font-semibold text-blue-600">{fmtInt(r.dias_ultima_inspecao_calc)}</td><td className="px-3 py-3">{r.faixa_inspecao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "LINHAS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Linhas com mais ocorrências</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaLinhas.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="linha" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalAtual" name="Volume de SOS" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="totalAtual" position="top" style={{ fill: "#3b82f6", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Leitura detalhada por linha</h3>
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Linha</th><th className="px-3 py-3 text-left">SOS Atual</th><th className="px-3 py-3 text-left">SOS Anterior</th><th className="px-3 py-3 text-left">Variação</th><th className="px-3 py-3 text-left">Veíc. Reincidentes</th><th className="px-3 py-3 text-left">Taxa Reinc.</th><th className="px-3 py-3 text-left">Defeito Top</th><th className="px-3 py-3 text-left">Setor Top</th></tr>
              </thead>
              <tbody>
                {tabelaLinhas.map((r) => (
                  <tr key={r.linha} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.linha}</td><td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.totalAtual)}</td><td className="px-3 py-3">{fmtInt(r.totalAnterior)}</td>
                    <td className="px-3 py-3"><EvolucaoBadge value={r.variacao_pct} invert /></td>
                    <td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.veiculosReincidentes)}</td><td className="px-3 py-3">{fmtPct(r.taxaReincidencia)}</td><td className="px-3 py-3">{r.defeitoTop}</td><td className="px-3 py-3">{r.setorTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "VEICULOS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Veículos ofensores</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaVeiculos.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="veiculo" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="totalSOS" name="Volume de SOS" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="totalSOS" position="top" style={{ fill: "#f43f5e", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Consolidado por veículo</h3>
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Veículo</th><th className="px-3 py-3 text-left">Cluster</th><th className="px-3 py-3 text-left">Linha</th><th className="px-3 py-3 text-left">SOS Total</th><th className="px-3 py-3 text-left">Reinc. Veículo</th><th className="px-3 py-3 text-left">Reinc. Técnica</th><th className="px-3 py-3 text-left">Reinc. Setorial</th><th className="px-3 py-3 text-left">Intervalo Médio</th><th className="px-3 py-3 text-left">Defeito Top</th><th className="px-3 py-3 text-left">Setor Top</th></tr>
              </thead>
              <tbody>
                {tabelaVeiculos.map((r) => (
                  <tr key={r.veiculo} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.veiculo}</td><td className="px-3 py-3">{r.cluster}</td><td className="px-3 py-3">{r.linhaTop}</td><td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.totalSOS)}</td><td className="px-3 py-3">{fmtInt(r.reincVeiculo)}</td><td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincTecnica)}</td><td className="px-3 py-3">{fmtInt(r.reincSetorial)}</td><td className="px-3 py-3">{fmtNum(r.intervaloMedio, 1)}</td><td className="px-3 py-3">{r.defeitoTop}</td><td className="px-3 py-3">{r.setorTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "SETORES" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Distribuição por Setor</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaSetores.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="setor" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" name="Volume de SOS" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="total" position="top" style={{ fill: "#8b5cf6", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Consolidado por setor</h3>
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Setor</th><th className="px-3 py-3 text-left">Total</th><th className="px-3 py-3 text-left">Linhas</th><th className="px-3 py-3 text-left">Veículos</th><th className="px-3 py-3 text-left">Reinc. Setorial</th><th className="px-3 py-3 text-left">Defeito Top</th></tr>
              </thead>
              <tbody>
                {tabelaSetores.map((r) => (
                  <tr key={r.setor} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.setor}</td><td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td><td className="px-3 py-3">{fmtInt(r.linhas)}</td><td className="px-3 py-3">{fmtInt(r.veiculos)}</td><td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincSetorial)}</td><td className="px-3 py-3">{r.defeitoTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "DEFEITOS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Defeitos</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaDefeitos.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="defeito" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" name="Volume de SOS" fill="#0f766e" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="total" position="top" style={{ fill: "#0f766e", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Consolidado por defeito</h3>
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Defeito</th><th className="px-3 py-3 text-left">Total</th><th className="px-3 py-3 text-left">Veículos</th><th className="px-3 py-3 text-left">Setores</th><th className="px-3 py-3 text-left">Linhas</th><th className="px-3 py-3 text-left">Reinc. Técnica</th><th className="px-3 py-3 text-left">Média Pós Prev.</th><th className="px-3 py-3 text-left">Média Pós Insp.</th></tr>
              </thead>
              <tbody>
                {tabelaDefeitos.map((r) => (
                  <tr key={r.defeito} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.defeito}</td><td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td><td className="px-3 py-3">{fmtInt(r.veiculos)}</td><td className="px-3 py-3">{fmtInt(r.setores)}</td><td className="px-3 py-3">{fmtInt(r.linhas)}</td><td className="px-3 py-3 text-rose-600 font-semibold">{fmtInt(r.reincTecnica)}</td><td className="px-3 py-3 font-semibold text-emerald-600">{fmtNum(r.mediaPrev, 1)}</td><td className="px-3 py-3 font-semibold text-blue-600">{fmtNum(r.mediaInsp, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abaAtiva === "MOTORISTAS" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-lg font-black text-slate-800 mb-3">Top 10 Motoristas</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tabelaMotoristas.slice(0, 10)} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="motorista" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" name="Volume de SOS" fill="#eab308" radius={[4, 4, 0, 0]} barSize={35}><LabelList dataKey="total" position="top" style={{ fill: "#eab308", fontSize: 11, fontWeight: "bold" }} /></Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm p-4 overflow-x-auto">
            <h3 className="text-lg font-black text-slate-800 mb-3">Detalhamento por Motorista</h3>
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 border-b text-slate-600 uppercase tracking-wider text-xs">
                <tr><th className="px-3 py-3 text-left">Motorista</th><th className="px-3 py-3 text-left">Total de SOS</th><th className="px-3 py-3 text-left">Veículos Distintos</th><th className="px-3 py-3 text-left">Linhas Distintas</th><th className="px-3 py-3 text-left">Principal Defeito Relatado</th></tr>
              </thead>
              <tbody>
                {tabelaMotoristas.map((r) => (
                  <tr key={r.motorista} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="px-3 py-3 font-black text-slate-800">{r.motorista}</td><td className="px-3 py-3 font-bold text-slate-700">{fmtInt(r.total)}</td><td className="px-3 py-3">{fmtInt(r.veiculos)}</td><td className="px-3 py-3">{fmtInt(r.linhas)}</td><td className="px-3 py-3">{r.defeitoTop}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl border font-black text-slate-800">
            Carregando PAINEL DE INTERVENÇÕES...
          </div>
        </div>
      )}
    </div>
  );
}
