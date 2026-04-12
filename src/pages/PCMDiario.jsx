// src/pages/PCMDiario.jsx
import { useState, useEffect, useCallback, useContext, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";
import {
  FaDownload,
  FaArrowLeft,
  FaTruckLoading,
  FaSearch,
  FaFilter,
  FaEdit,
  FaTimes,
  FaSave,
  FaCheckCircle,
  FaCalendarAlt,
  FaBus,
  FaTools,
  FaWrench,
  FaBolt,
  FaExclamationTriangle,
  FaClock,
  FaChartPie,
  FaSkullCrossbones,
  FaClipboardList
} from "react-icons/fa";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/* ============================
   CONSTANTES E CONFIG
============================ */

const SETORES = ["GARANTIA", "MANUTENÇÃO", "SUPRIMENTOS"];
const OBS_OPCOES = ["AG. CHEGADA DE PEÇAS", "AG. EXECUÇÃO DO SERVIÇO", "AG. GARANTIA"];

const CATEGORIAS = [
  { value: "GNS", label: "GNS", color: "border-red-300 bg-red-100", badge: "bg-red-600 text-white" },
  { value: "FAIXA_AMARELA", label: "Faixa Amarela", color: "border-amber-300 bg-amber-100", badge: "bg-amber-500 text-white" },
  { value: "NOITE", label: "Noturno", color: "border-slate-300 bg-white", badge: "bg-slate-800 text-white" },
  { value: "PENDENTES", label: "Pendentes", color: "border-slate-400 bg-slate-200", badge: "bg-slate-600 text-white" },
  { value: "VENDA", label: "Venda", color: "border-blue-300 bg-blue-100", badge: "bg-blue-600 text-white" },
];

/* ============================
   HELPERS
============================ */

function getCategoriaStyle(cat) {
  const found = CATEGORIAS.find((c) => c.value === cat);
  return found || { value: cat, label: cat, color: "border-slate-300 bg-slate-100", badge: "bg-slate-500 text-white" };
}

function getBadgeInlineStyle(catValue) {
  switch (catValue) {
    case 'GNS': return { backgroundColor: '#dc2626', color: '#ffffff' }; 
    case 'FAIXA_AMARELA': return { backgroundColor: '#f59e0b', color: '#ffffff' }; 
    case 'NOITE': return { backgroundColor: '#1e293b', color: '#ffffff' }; 
    case 'PENDENTES': return { backgroundColor: '#475569', color: '#ffffff' }; 
    case 'VENDA': return { backgroundColor: '#2563eb', color: '#ffffff' }; 
    default: return { backgroundColor: '#64748b', color: '#ffffff' }; 
  }
}

function formatBRDate(dt) {
  try {
    if (!dt) return "-";
    return new Date(dt).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

function daysBetween(inicioISO) {
  try {
    if (!inicioISO) return 0;
    const d0 = new Date(inicioISO);
    const diff = Date.now() - d0.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
}

function buildDiff(before, after, keys) {
  const diff = {};
  keys.forEach((k) => {
    const a = before?.[k] ?? null;
    const b = after?.[k] ?? null;
    if (String(a ?? "") !== String(b ?? "")) {
      diff[k] = { de: a, para: b };
    }
  });
  return diff;
}

function canEditPCM(dataRefISO) {
  try {
    if (!dataRefISO) return false;
    const ref = new Date(`${dataRefISO}T00:00:00`);
    const deadline = new Date(ref);
    deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(10, 0, 0, 0); // Fechamento cravado às 10:00 da manhã do dia seguinte
    return Date.now() <= deadline.getTime();
  } catch {
    return false;
  }
}

/* ============================
   COMPONENTES UI GERAIS
============================ */

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
            {sub && <p className="text-[11px] mt-1 font-bold opacity-80">{sub}</p>}
          </div>
        </div>
        <div className="text-xl mt-1 opacity-80">{icon}</div>
      </div>
    </div>
  );
}

function MultiSelectChips({ label, options, values, onChange }) {
  const set = new Set(values || []);

  function toggle(v) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <div className="text-[10px] font-black text-slate-500 uppercase mr-1">{label}:</div>}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
            set.has(opt.value) ? "bg-slate-800 text-white border-slate-800 shadow" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          {opt.label}
        </button>
      ))}
      {(values || []).length > 0 && (
        <button onClick={() => onChange([])} className="px-3 py-1.5 rounded-lg text-[11px] font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
          Limpar
        </button>
      )}
    </div>
  );
}

/* ============================
   MODAL EDITAR VEÍCULO
============================ */

function EditarVeiculoModal({ open, onClose, veiculo, prefixos, onSalvar }) {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ frota: "", setor: "", ordem_servico: "", descricao: "", observacao: "", categoria: "" });

  useEffect(() => {
    if (!open || !veiculo) return;
    setDraft({
      frota: veiculo.frota || "",
      setor: veiculo.setor || "MANUTENÇÃO",
      ordem_servico: String(veiculo.ordem_servico || ""),
      descricao: veiculo.descricao || "",
      observacao: veiculo.observacao || "",
      categoria: veiculo.categoria || "GNS",
    });
  }, [open, veiculo]);

  const opcoesCategoriaPermitidas = useMemo(() => {
    const atual = veiculo?.categoria;
    if (atual === "PENDENTES") return ["PENDENTES", "GNS", "FAIXA_AMARELA", "NOITE"];
    if (atual === "NOITE") return ["NOITE", "GNS"];
    if (atual === "GNS") return ["GNS", "FAIXA_AMARELA", "PENDENTES", "NOITE"];
    if (atual === "FAIXA_AMARELA") return ["FAIXA_AMARELA", "GNS", "PENDENTES", "NOITE"];
    if (atual === "VENDA") return ["VENDA", "GNS", "FAIXA_AMARELA", "PENDENTES", "NOITE"];
    return ["GNS", "FAIXA_AMARELA", "PENDENTES", "NOITE", "VENDA"];
  }, [veiculo]);

  if (!open || !veiculo) return null;

  async function handleSalvar() {
    const os = String(draft.ordem_servico || "").trim();
    if (!draft.frota) return alert("Frota é obrigatória.");
    if (!os) return alert("Ordem de Serviço é obrigatória.");
    if (!draft.setor) return alert("Setor é obrigatório.");
    if (!draft.observacao) return alert("Selecione uma Observação.");

    const payloadUpdate = {
      frota: draft.frota,
      setor: draft.setor,
      ordem_servico: os,
      descricao: draft.descricao,
      observacao: draft.observacao,
      categoria: draft.categoria,
    };

    const diff = buildDiff(veiculo, payloadUpdate, ["frota", "setor", "ordem_servico", "descricao", "observacao", "categoria"]);
    if (!Object.keys(diff).length) return alert("Nenhuma alteração para salvar.");

    setSaving(true);
    try {
      const deCat = veiculo.categoria || null;
      const paraCat = payloadUpdate.categoria || null;
      const acao = deCat !== paraCat ? "MOVER_CATEGORIA" : "EDITAR";
      await onSalvar(payloadUpdate, acao, deCat, paraCat, diff);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-5 border-b bg-white relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-transparent opacity-50"></div>
          <div className="relative flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2.5 rounded-lg shadow-sm"><FaEdit size={20} /></div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Editar Veículo <span className="text-blue-600">{veiculo.frota}</span></h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
                  Atual: {veiculo.categoria || "-"}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="relative text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition"><FaTimes size={20} /></button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50">
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Frota</label>
            <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200" value={draft.frota} onChange={(e) => setDraft({ ...draft, frota: e.target.value })}>
              <option value="">Selecione...</option>
              {prefixos.map((p) => (<option key={p.codigo} value={p.codigo}>{p.codigo}</option>))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Setor</label>
            <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200" value={draft.setor} onChange={(e) => setDraft({ ...draft, setor: e.target.value })}>
              {SETORES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Ordem de Serviço</label>
            <input className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200" type="text" inputMode="numeric" value={draft.ordem_servico} onChange={(e) => setDraft({ ...draft, ordem_servico: e.target.value.replace(/\D/g, "") })} placeholder="Somente números" required />
          </div>
          <div className="flex flex-col">
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Observação</label>
            <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200" value={draft.observacao} onChange={(e) => setDraft({ ...draft, observacao: e.target.value })}>
              <option value="">Selecione...</option>
              {OBS_OPCOES.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
          </div>
          <div className="flex flex-col md:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Descrição</label>
            <input className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-200" type="text" value={draft.descricao} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })} placeholder="Defeito relatado..." />
          </div>
          <div className="flex flex-col md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-100">
            <label className="text-[11px] font-bold text-blue-800 uppercase mb-1">Nova Categoria</label>
            <select className="border border-blue-200 rounded-xl px-3 py-2.5 text-sm font-bold text-blue-900 outline-none focus:ring-2 focus:ring-blue-300" value={draft.categoria} onChange={(e) => setDraft({ ...draft, categoria: e.target.value })}>
              {opcoesCategoriaPermitidas.map((c) => (<option key={c} value={c}>{getCategoriaStyle(c).label}</option>))}
            </select>
            <p className="text-[10px] text-blue-600 font-semibold mt-2">* O timer de dias na categoria será reiniciado caso o veículo mude de status.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t bg-white flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl font-black text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 transition">Cancelar</button>
          <button onClick={handleSalvar} disabled={saving} className="px-5 py-2.5 rounded-xl font-black text-sm bg-blue-600 text-white hover:bg-blue-700 shadow-md transition flex items-center gap-2">
            <FaSave /> {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================
   PAGE: PCMDiario
============================ */

export default function PCMDiario() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [veiculos, setVeiculos] = useState([]);
  const [prefixos, setPrefixos] = useState([]);
  const [pcmInfo, setPcmInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ NOVO: Automação Inteligente de Turno baseado no Relógio
  const [turnoAtivo, setTurnoAtivo] = useState(() => {
    const hora = new Date().getHours();
    // Das 10h até as 19h59 (O turno é DIA)
    // Das 20h até as 09h59 da manhã do dia seguinte (O turno é NOITE)
    return (hora >= 10 && hora < 20) ? "DIA" : "NOITE";
  });

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategorias, setFiltroCategorias] = useState([]);
  const [filtroSetores, setFiltroSetores] = useState([]);
  const [filtroTurnos, setFiltroTurnos] = useState([]);
  const [filtroCluster, setFiltroCluster] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState("TODOS");

  const reportRef = useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editVeiculo, setEditVeiculo] = useState(null);

  const [form, setForm] = useState({ frota: "", setor: "MANUTENÇÃO", descricao: "", categoria: "GNS", ordem_servico: "", observacao: "" });

  const pcmEditavel = useMemo(() => canEditPCM(pcmInfo?.data_referencia), [pcmInfo?.data_referencia]);

  const buscarDados = useCallback(async () => {
    setLoading(true);
    const [resPcm, resVeiculos, resPrefixos] = await Promise.all([
      supabase.from("pcm_diario").select("*").eq("id", id).single(),
      supabase.from("veiculos_pcm").select("*").eq("pcm_id", id).is("data_saida", null).order("data_entrada", { ascending: true }),
      supabase.from("prefixos").select("codigo, cluster").order("codigo"),
    ]);

    if (resPcm?.data) setPcmInfo(resPcm.data);
    if (resPrefixos?.data) setPrefixos(resPrefixos.data);

    const mapClusterByCodigo = new Map();
    (resPrefixos?.data || []).forEach((p) => {
      const cod = String(p?.codigo || "").trim();
      if (cod) mapClusterByCodigo.set(cod, String(p?.cluster || "").trim());
    });

    const veicsComCluster = (resVeiculos?.data || []).map((v) => ({
      ...v,
      cluster: mapClusterByCodigo.get(String(v?.frota || "").trim()) || "",
    }));

    setVeiculos(veicsComCluster);
    setLoading(false);
  }, [id]);

  useEffect(() => { buscarDados(); }, [buscarDados]);

  async function gravarHistorico({ veiculo_pcm_id, pcm_id, frota, acao, de_categoria, para_categoria, alteracoes }) {
    await supabase.from("veiculos_pcm_historico").insert([{
      veiculo_pcm_id, pcm_id, frota, acao, de_categoria, para_categoria,
      alteracoes: alteracoes || {}, executado_por: user?.nome || "Sistema",
    }]);
  }

  async function lancarVeiculo() {
    if (!pcmEditavel) return alert("PCM fechado: permitido editar somente até 10:00 do dia seguinte.");

    const os = String(form.ordem_servico || "").trim();
    if (!form.frota || !form.descricao) return alert("Preencha Frota e Descrição.");
    if (!os || !/^\d+$/.test(os)) return alert("Ordem de Serviço deve conter somente números.");
    if (!form.setor || !form.observacao) return alert("Setor e Observação são obrigatórios.");

    const { data: jaExiste } = await supabase.from("veiculos_pcm").select("id").eq("pcm_id", id).eq("frota", form.frota).is("data_saida", null).limit(1);
    if (jaExiste && jaExiste.length > 0) return alert(`A frota ${form.frota} já está lançada neste PCM.`);

    // Setando a data de entrada E a data de mudança de categoria juntas no lançamento inicial.
    const now = new Date().toISOString();
    const payload = { pcm_id: id, ...form, ordem_servico: os, lancado_por: user?.nome || "Sistema", lancado_no_turno: turnoAtivo, data_entrada: now, data_mudanca_categoria: now };
    const { data: inserted, error } = await supabase.from("veiculos_pcm").insert([payload]).select("*").single();

    if (error) return alert("Erro ao lançar veículo.");

    await gravarHistorico({ veiculo_pcm_id: inserted?.id, pcm_id: id, frota: inserted?.frota, acao: "LANCAR", para_categoria: inserted?.categoria, alteracoes: { lancamento: true }});
    setForm({ ...form, frota: "", descricao: "", ordem_servico: "", observacao: "" });
    buscarDados();
  }

  async function liberarVeiculo(v) {
    if (!pcmEditavel) return alert("PCM fechado: não é permitido liberar veículos.");
    if (!confirm(`Confirmar liberação da frota ${v.frota}?`)) return;

    await supabase.from("veiculos_pcm").update({ data_saida: new Date().toISOString(), liberado_por: user?.nome || "Sistema" }).eq("id", v.id);
    await gravarHistorico({ veiculo_pcm_id: v.id, pcm_id: id, frota: v.frota, acao: "LIBERAR", de_categoria: v.categoria, para_categoria: v.categoria, alteracoes: { liberado_por: user?.nome || "Sistema" }});
    buscarDados();
  }

  async function salvarEdicaoVeiculo(payloadUpdate, acao, deCat, paraCat, diff) {
    if (!pcmEditavel) return alert("PCM fechado.");

    const v = editVeiculo;
    if (!v?.id) return;

    if (payloadUpdate.frota && payloadUpdate.frota !== v.frota) {
      const { data: dup } = await supabase.from("veiculos_pcm").select("id").eq("pcm_id", id).eq("frota", payloadUpdate.frota).is("data_saida", null).limit(1);
      if (dup && dup.length > 0) return alert(`A frota ${payloadUpdate.frota} já existe.`);
    }

    if (acao === "MOVER_CATEGORIA") {
      payloadUpdate.data_mudanca_categoria = new Date().toISOString();
    }

    const { error } = await supabase.from("veiculos_pcm").update(payloadUpdate).eq("id", v.id);
    if (error) return alert("Erro ao salvar alterações.");

    await gravarHistorico({ veiculo_pcm_id: v.id, pcm_id: id, frota: payloadUpdate.frota || v.frota, acao, de_categoria: deCat, para_categoria: paraCat, alteracoes: diff });
    buscarDados();
  }

  const clustersDisponiveis = useMemo(() => Array.from(new Set((prefixos || []).map(p => String(p?.cluster || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [prefixos]);

  const veiculosFiltrados = useMemo(() => {
    const txt = filtroTexto.trim().toLowerCase();
    const orderCat = { GNS: 0, FAIXA_AMARELA: 1, NOITE: 2, PENDENTES: 3, VENDA: 4 };

    return (veiculos || []).filter((v) => {
      if (abaAtiva !== "TODOS" && v.categoria !== abaAtiva) return false;
      if (filtroCategorias.length && !filtroCategorias.includes(v.categoria)) return false;
      if (filtroSetores.length && !filtroSetores.includes(v.setor)) return false;
      if (filtroTurnos.length && !filtroTurnos.includes(v.lancado_no_turno)) return false;
      if (filtroCluster.length && !filtroCluster.includes(String(v.cluster || ""))) return false;
      if (!txt) return true;
      return [v.frota, v.descricao, v.ordem_servico, v.setor, v.lancado_por, v.observacao, v.cluster].filter(Boolean).join(" ").toLowerCase().includes(txt);
    }).sort((a, b) => {
      if (orderCat[a.categoria] !== orderCat[b.categoria]) return (orderCat[a.categoria] ?? 99) - (orderCat[b.categoria] ?? 99);
      return daysBetween(b.data_mudanca_categoria || b.data_entrada) - daysBetween(a.data_mudanca_categoria || a.data_entrada);
    });
  }, [veiculos, filtroTexto, filtroCategorias, filtroSetores, filtroTurnos, filtroCluster, abaAtiva]);

  // ============================================
  // LÓGICA DE DADOS TÁTICOS (Comando Diário)
  // ============================================
  const { resumoStatus, taticalData } = useMemo(() => {
    const base = veiculosFiltrados.length ? veiculosFiltrados : veiculos;
    const total = (base || []).length;
    
    // Resumo Top Cards
    const byCat = { GNS: 0, FAIXA_AMARELA: 0, NOITE: 0, VENDA: 0, PENDENTES: 0 };
    let alertas24h = 0;
    let alertas48h = 0;

    // Táticos
    const motivos = {};
    const slaCriticoList = [];
    const defeitosFreq = {};

    (base || []).forEach((v) => {
      // 1. Contagem Simples
      if (byCat[v.categoria] !== undefined) byCat[v.categoria]++;
      
      // 2. Análise de SLA (Baseado no dia que entrou na CATEGORIA)
      const diasCat = daysBetween(v.data_mudanca_categoria || v.data_entrada);
      if (diasCat >= 1) alertas24h++;
      if (diasCat >= 2) {
        alertas48h++;
        slaCriticoList.push({ ...v, diasCat });
      }

      // 3. Raio-X do Pátio (Motivos de Parada)
      const obs = v.observacao || "NÃO CLASSIFICADO";
      motivos[obs] = (motivos[obs] || 0) + 1;

      // 4. Termômetro de Defeitos
      let def = String(v.descricao || "").toUpperCase().trim();
      if (def.length > 20) def = def.substring(0, 30) + "..."; 
      if (def) {
        defeitosFreq[def] = (defeitosFreq[def] || 0) + 1;
      }
    });

    const arrMotivos = Object.entries(motivos).map(([k,v]) => ({ name: k, val: v })).sort((a,b) => b.val - a.val);
    const arrSla = slaCriticoList.sort((a,b) => b.diasCat - a.diasCat).slice(0, 4); 
    const arrDefeitos = Object.entries(defeitosFreq).map(([k,v]) => ({ name: k, val: v })).sort((a,b) => b.val - a.val).slice(0, 4);

    return { 
      resumoStatus: { total, alertas24h, alertas48h, ...byCat },
      taticalData: { motivos: arrMotivos, sla: arrSla, defeitos: arrDefeitos }
    };
  }, [veiculos, veiculosFiltrados]);

  // ============================================
  // GERADOR PDF
  // ============================================
  async function baixarPdfPCM() {
    try {
      if (!reportRef.current) return;
      const scale = 2; 
      const canvas = await html2canvas(reportRef.current, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });

      const trElements = Array.from(reportRef.current.querySelectorAll("tr"));
      const containerRect = reportRef.current.getBoundingClientRect();
      const cutPoints = trElements.map(tr => Math.floor((tr.getBoundingClientRect().bottom - containerRect.top) * scale));
      cutPoints.push(canvas.height);

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 6;
      
      const printableW = pageW - margin * 2;
      const printableH = pageH - margin * 2;
      const mmPerPx = printableW / canvas.width;
      const maxPageHeightPx = Math.floor(printableH / mmPerPx);

      let y = 0, pageIndex = 0;

      while (y < canvas.height) {
        const targetY = y + maxPageHeightPx;
        let cutY = canvas.height;
        if (targetY < canvas.height) {
          const validCuts = cutPoints.filter(cp => cp <= targetY && cp > y);
          cutY = validCuts.length > 0 ? validCuts[validCuts.length - 1] : targetY; 
        }

        const sliceH = cutY - y;
        if (sliceH <= 0) break;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext("2d");
        
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        if (pageIndex > 0) doc.addPage();
        doc.addImage(pageCanvas.toDataURL("image/png", 1.0), "PNG", margin, margin, printableW, sliceH * mmPerPx, undefined, "FAST");

        y = cutY;
        pageIndex += 1;
      }
      doc.save(`PCM_${pcmInfo?.data_referencia || "diario"}.pdf`);
    } catch (err) { 
      alert("Erro ao gerar PDF."); 
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-6">
      
      {/* HEADER PREMIUM */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row justify-between md:items-end gap-4">
        <div>
          <button onClick={() => navigate("/pcm-inicio")} className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition">
            <FaArrowLeft /> Voltar para Painel
          </button>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-black border border-blue-200 tracking-wider">
            <FaTools /> Lançamento Diário
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 mt-2 uppercase tracking-tight">Painel PCM</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 font-semibold">
            Data de Referência: <span className="font-black text-slate-700">{pcmInfo?.data_referencia || "-"}</span>
            {pcmEditavel ? (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ml-2">Editável</span>
            ) : (
              <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ml-2">Fechado</span>
            )}
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <div className="flex bg-slate-100 rounded-xl overflow-hidden border border-slate-200 p-1 shadow-inner">
            <button className={`px-4 py-2 rounded-lg text-xs font-black transition ${turnoAtivo === "DIA" ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setTurnoAtivo("DIA")}>TURNO DIA</button>
            <button className={`px-4 py-2 rounded-lg text-xs font-black transition ${turnoAtivo === "NOITE" ? "bg-white text-slate-800 shadow" : "text-slate-500 hover:text-slate-700"}`} onClick={() => setTurnoAtivo("NOITE")}>TURNO NOITE</button>
          </div>
          <button onClick={baixarPdfPCM} className="bg-slate-800 text-white px-5 py-2.5 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-slate-700 shadow-md transition-all active:scale-95">
            <FaDownload /> Baixar PDF
          </button>
        </div>
      </div>

      {/* KPIs TÁTICOS DIÁRIOS (Refinados para ação imediata) */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <CardKPI title="Total Em Aberto" value={resumoStatus.total} icon={<FaBus />} tone="blue" />
        <CardKPI title="GNS" value={resumoStatus.GNS} icon={<FaExclamationTriangle />} tone="rose" />
        <CardKPI title="Faixa Amarela" value={resumoStatus.FAIXA_AMARELA} icon={<FaTools />} tone="amber" />
        <CardKPI title="Pendentes" value={resumoStatus.PENDENTES} icon={<FaWrench />} tone="slate" />
        <CardKPI title="Alerta > 24H" value={resumoStatus.alertas24h} sub="Dias na Categoria" icon={<FaClock />} tone="amber" />
        <CardKPI title="SLA Estourado > 48h" value={resumoStatus.alertas48h} sub="Dias na Categoria" icon={<FaSkullCrossbones />} tone="rose" />
      </div>

      {/* FORMULÁRIO DE LANÇAMENTO */}
      {pcmEditavel && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4 border-b pb-2">
            <FaTruckLoading className="text-blue-600" /> Novo Lançamento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Frota</label>
              <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none" value={form.frota} onChange={(e) => setForm({ ...form, frota: e.target.value })}>
                <option value="">Selecione...</option>
                {prefixos.map((p) => (<option key={p.codigo} value={p.codigo}>{p.codigo}</option>))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Categoria</label>
              <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Setor</label>
              <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none" value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })}>
                {SETORES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Ordem Serviço (Nº)</label>
              <input className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none" type="text" inputMode="numeric" value={form.ordem_servico} onChange={(e) => setForm({ ...form, ordem_servico: e.target.value.replace(/\D/g, "") })} placeholder="123456" />
            </div>
            <div className="flex flex-col md:col-span-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Descrição do Defeito</label>
              <input className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none" type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Problema relatado..." />
            </div>
            <button onClick={lancarVeiculo} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 font-black flex items-center justify-center gap-2 shadow-md transition active:scale-95 h-[42px]">
              <FaTruckLoading /> Lançar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 uppercase mb-1">Observação Base</label>
              <select className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 outline-none" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })}>
                <option value="">Selecione a observação...</option>
                {OBS_OPCOES.map((o) => (<option key={o} value={o}>{o}</option>))}
              </select>
            </div>
            <div className="flex items-end justify-end">
              <p className="text-xs text-slate-400 font-semibold">Os veículos lançados herdam o turno ativo <strong className="text-slate-600">({turnoAtivo})</strong>.</p>
            </div>
          </div>
        </div>
      )}

      {/* FILTROS E ABAS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-4">
          <div className="relative w-full md:w-96">
            <FaSearch className="absolute left-3 top-3 text-slate-400" />
            <input className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-200 outline-none" value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} placeholder="Pesquisar OS, frota, defeito..." />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <FaFilter className="text-slate-400 mr-1" />
            <MultiSelectChips options={clustersDisponiveis.map(c => ({ value: c, label: `Cluster ${c}` }))} values={filtroCluster} onChange={setFiltroCluster} />
            <MultiSelectChips options={CATEGORIAS} values={filtroCategorias} onChange={setFiltroCategorias} />
            <MultiSelectChips options={SETORES.map(s => ({ value: s, label: s }))} values={filtroSetores} onChange={setFiltroSetores} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <button className={`px-5 py-2 rounded-xl text-xs font-black transition ${abaAtiva === "TODOS" ? "bg-slate-800 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`} onClick={() => setAbaAtiva("TODOS")}>TODOS</button>
          {CATEGORIAS.map(c => (
            <button key={c.value} className={`px-5 py-2 rounded-xl text-xs font-black transition ${abaAtiva === c.value ? "bg-slate-800 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`} onClick={() => setAbaAtiva(c.value)}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* BLOCO INVISÍVEL PARA IMPRESSÃO DO PDF - AQUI EU COLOQUEI A TABELA DENTRO DO PDF JUNTO COM A ANÁLISE TÁTICA */}
      <div className="fixed -left-[99999px] top-0 pointer-events-none opacity-0">
        <div ref={reportRef} className="bg-white w-[1400px] p-6 text-black font-sans">
          
          {/* TOPO PDF */}
          <div className="mb-5 border-2 border-slate-800 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <div className="text-2xl font-black uppercase tracking-tight">PCM - Planejamento Diário e Controle</div>
                <div className="text-sm font-semibold mt-1">Data de Referência: <span className="font-black">{pcmInfo?.data_referencia || "-"}</span></div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase font-bold opacity-80">Veículos em Aberto</div>
                <div className="text-4xl font-black">{veiculosFiltrados.length}</div>
              </div>
            </div>
          </div>

          {/* PAINEL TÁTICO PDF (RAIO-X) */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            
            {/* Raio-X Gargalo */}
            <div className="border-2 border-slate-200 rounded-xl p-4">
              <h3 className="text-[11px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2"><FaChartPie /> Raio-X do Pátio (Motivos)</h3>
              <div className="space-y-2">
                {taticalData.motivos.map((m, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-700 truncate w-3/4">{m.name}</span>
                    <span className="text-xs font-black text-blue-600">{m.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA Crítico */}
            <div className="border-2 border-rose-200 rounded-xl p-4 bg-rose-50">
              <h3 className="text-[11px] font-black text-rose-800 uppercase mb-3 flex items-center gap-2"><FaSkullCrossbones /> SLA Crítico {'>'} 48H</h3>
              <div className="space-y-2">
                {taticalData.sla.length === 0 ? <div className="text-xs font-bold text-rose-400">Nenhum veículo em SLA Crítico</div> : 
                  taticalData.sla.map((v, i) => (
                    <div key={i} className="flex justify-between items-center bg-white px-3 py-1.5 rounded border border-rose-100">
                      <span className="text-xs font-black text-slate-800">{v.frota}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-500">{v.categoria}</span>
                        <span className="text-xs font-black text-rose-600 bg-rose-100 px-2 rounded">{v.diasCat}d</span>
                      </div>
                    </div>
                ))}
              </div>
            </div>

            {/* Termômetro Defeitos */}
            <div className="border-2 border-slate-200 rounded-xl p-4">
              <h3 className="text-[11px] font-black text-slate-500 uppercase mb-3 flex items-center gap-2"><FaClipboardList /> Termômetro (Sintomas Top 4)</h3>
              <div className="space-y-2">
                {taticalData.defeitos.map((d, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-700 truncate w-4/5">{d.name}</span>
                    <span className="text-xs font-black text-slate-600">{d.val}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* TABELA PDF COM CORES CORRIGIDAS */}
          <table className="w-full text-left text-sm border-collapse border-2 border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-[10px] uppercase text-slate-700 border-b-2 border-slate-300 font-black">
                <th className="p-3 border-r border-slate-300">Cluster</th>
                <th className="p-3 border-r border-slate-300">Frota</th>
                <th className="p-3 border-r border-slate-300">Entrada</th>
                <th className="p-3 border-r border-slate-300 text-center">Dias (Cat)</th>
                <th className="p-3 border-r border-slate-300">Categoria</th>
                <th className="p-3 border-r border-slate-300 w-[400px]">Descrição</th>
                <th className="p-3 border-r border-slate-300">O.S</th>
                <th className="p-3 border-r border-slate-300">Setor</th>
                <th className="p-3 border-r border-slate-300">Resp. Lançamento</th>
                <th className="p-3 w-[250px]">Observação</th>
              </tr>
            </thead>
            <tbody>
              {veiculosFiltrados.map((v) => {
                const catStyle = getCategoriaStyle(v.categoria);
                const diasCat = daysBetween(v.data_mudanca_categoria || v.data_entrada);
                
                return (
                  <tr key={v.id} className={`border-b border-slate-300 font-medium ${catStyle.color}`}>
                    <td className="p-3 border-r border-slate-300 text-[10px] font-black uppercase text-slate-600">{v.cluster || "-"}</td>
                    <td className="p-3 text-lg font-black border-r border-slate-300 text-slate-900">{v.frota}</td>
                    <td className="p-3 border-r border-slate-300 text-slate-800">{formatBRDate(v.data_entrada)}</td>
                    <td className="p-3 text-center font-black border-r border-slate-300 text-lg text-slate-900">{diasCat}</td>
                    <td className="p-3 border-r border-slate-300">
                      <div style={{ display: 'inline-block', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', ...getBadgeInlineStyle(v.categoria) }}>
                        {catStyle.label}
                      </div>
                    </td>
                    <td className="p-3 text-[11px] uppercase leading-tight border-r border-slate-300 text-slate-800">{v.descricao}</td>
                    <td className="p-3 font-bold border-r border-slate-300 text-slate-900">{v.ordem_servico || "-"}</td>
                    <td className="p-3 text-[10px] font-black border-r border-slate-300 text-slate-700 uppercase">{v.setor}</td>
                    <td className="p-3 text-[10px] italic border-r border-slate-300 text-slate-700">{v.lancado_por || "-"}</td>
                    <td className="p-3 text-[10px] font-bold uppercase text-slate-800">{v.observacao || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-4 text-right text-[10px] text-slate-500 font-bold">Relatório Oficial - Gestão da Frota</div>
        </div>
      </div>

      {/* PAINEL TÁTICO NA TELA */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><FaChartPie /> Raio-X do Pátio (Status de Operação)</h3>
          <div className="space-y-3">
            {taticalData.motivos.map((m, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">{m.name}</span>
                <span className="text-sm font-black text-blue-600 bg-blue-100 px-3 py-1 rounded-lg">{m.val}</span>
              </div>
            ))}
            {taticalData.motivos.length === 0 && <div className="text-xs font-bold text-slate-400">Pátio limpo!</div>}
          </div>
        </div>

        <div className="bg-rose-50 rounded-2xl border border-rose-200 p-5 shadow-sm">
          <h3 className="text-xs font-black text-rose-800 uppercase mb-4 flex items-center gap-2"><FaSkullCrossbones /> Alerta de SLA {'>'} 48H</h3>
          <div className="space-y-3">
            {taticalData.sla.length === 0 ? <div className="text-xs font-bold text-rose-400">Nenhum veículo em SLA Crítico</div> : 
              taticalData.sla.map((v, i) => (
                <div key={i} className="flex justify-between items-center bg-white px-4 py-2.5 rounded-xl border border-rose-100 shadow-sm">
                  <span className="text-sm font-black text-slate-800">{v.frota}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${getCategoriaStyle(v.categoria).badge}`}>{v.categoria}</span>
                    <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-1 rounded">{v.diasCat} dias</span>
                  </div>
                </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-black text-slate-500 uppercase mb-4 flex items-center gap-2"><FaClipboardList /> Termômetro (Top Defeitos Abertos Hoje)</h3>
          <div className="space-y-3">
            {taticalData.defeitos.map((d, i) => (
              <div key={i} className="flex justify-between items-center bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700 truncate w-3/4">{d.name}</span>
                <span className="text-sm font-black text-slate-600 bg-slate-200 px-3 py-1 rounded-lg">{d.val}</span>
              </div>
            ))}
            {taticalData.defeitos.length === 0 && <div className="text-xs font-bold text-slate-400">Nenhum relato hoje</div>}
          </div>
        </div>
      </div>

      {/* RELATÓRIO VISUAL (TABELA NA TELA) */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Lista de Veículos Abertos</h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Ordenação: Categorias Ofensoras e Maior Tempo na Categoria</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse min-w-[1200px]">
            <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4 font-black">Frota</th>
                <th className="p-4 text-center font-black">Dias (Timer)</th>
                <th className="p-4 font-black">Categoria</th>
                <th className="p-4 font-black w-[300px]">Defeito Reportado</th>
                <th className="p-4 font-black">OS</th>
                <th className="p-4 font-black">Setor</th>
                <th className="p-4 font-black">Turno</th>
                <th className="p-4 font-black">Responsável</th>
                <th className="p-4 font-black w-[200px]">Observação</th>
                <th className="p-4 text-center font-black">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-slate-50/30">
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-400 font-bold">Carregando lista...</td></tr>
              ) : veiculosFiltrados.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-400 font-bold">Nenhum veículo atende aos filtros atuais.</td></tr>
              ) : (
                veiculosFiltrados.map((v) => {
                  const catStyle = getCategoriaStyle(v.categoria);
                  const diasTotal = daysBetween(v.data_entrada);
                  const diasCat = daysBetween(v.data_mudanca_categoria || v.data_entrada);

                  return (
                    <tr key={v.id} className={`border-b border-slate-200 hover:bg-slate-100 transition-colors ${catStyle.color}`}>
                      <td className="p-4">
                        <div className="text-lg font-black text-slate-800">{v.frota}</div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">{v.cluster || "Sem Cluster"}</div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-xl font-black text-slate-800">{diasCat}d</div>
                        {diasTotal !== diasCat && (
                          <div className="text-[10px] font-black text-slate-400 uppercase mt-0.5" title={`Dias desde a entrada original: ${diasTotal}`}>Total PCM: {diasTotal}d</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm ${catStyle.badge}`}>
                          {catStyle.label}
                        </span>
                      </td>
                      <td className="p-4 text-[11px] font-semibold text-slate-600 uppercase">{v.descricao}</td>
                      <td className="p-4 font-bold text-slate-700">{v.ordem_servico || "-"}</td>
                      <td className="p-4 text-[10px] font-black text-slate-600 uppercase">{v.setor}</td>
                      <td className="p-4 text-[10px] font-black text-slate-600"><span className="bg-slate-200/50 px-2 py-1 rounded">{v.lancado_no_turno || "-"}</span></td>
                      <td className="p-4 text-[10px] font-bold text-slate-500 italic">{v.lancado_por || "-"}</td>
                      <td className="p-4 text-[10px] font-bold text-slate-600 uppercase">{v.observacao || "-"}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => liberarVeiculo(v)}
                            disabled={!pcmEditavel}
                            className={`p-2.5 rounded-xl shadow-sm transition-transform ${!pcmEditavel ? "bg-slate-300 text-white cursor-not-allowed" : "bg-emerald-500 hover:bg-emerald-400 text-white hover:scale-105 active:scale-95"}`}
                            title={!pcmEditavel ? "Fechado" : "Liberar Veículo (Dar Saída)"}
                          >
                            <FaCheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => { if (pcmEditavel) { setEditVeiculo(v); setEditOpen(true); } }}
                            disabled={!pcmEditavel}
                            className={`p-2.5 rounded-xl shadow-sm transition-transform ${!pcmEditavel ? "bg-slate-300 text-white cursor-not-allowed" : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105 active:scale-95"}`}
                            title={!pcmEditavel ? "Fechado" : "Editar ou Mover"}
                          >
                            <FaEdit size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL EDITAR */}
      <EditarVeiculoModal
        open={editOpen}
        veiculo={editVeiculo}
        prefixos={prefixos}
        onClose={() => { setEditOpen(false); setEditVeiculo(null); }}
        onSalvar={salvarEdicaoVeiculo}
      />
    </div>
  );
}
