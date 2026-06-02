import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaBusAlt,
  FaPlus,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUsers,
  FaTrash,
  FaSync,
  FaWhatsapp,
  FaCheckCircle,
  FaTimes,
  FaPencilAlt,
  FaUndo,
  FaClock,
  FaStickyNote,
  FaUserEdit,
} from "react-icons/fa";
import {
  deleteEspecialFromGoogle,
  syncEspecialToGoogle,
} from "../../utils/googleCalendar";
import { buildMensagemWhatsAppEspecial, copyToClipboard } from "./EspecialCommon";

const STATUS_COLORS = {
  Agendado: "bg-purple-100 text-purple-800 border-purple-200",
  Realizado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Cancelado: "bg-slate-100 text-slate-500 border-slate-200",
};

const STATUS_ORDEM = { Agendado: 0, Cancelado: 1, Realizado: 2 };

export default function ControleEspecialCentral() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const isAdmin = String(user?.nivel || "").toLowerCase() === "administrador";

  const [loading, setLoading] = useState(true);
  const [especiais, setEspeciais] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => { carregar(); }, []);

  const carregar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("especiais")
      .select("*")
      .order("data", { ascending: false });
    if (error) console.error(error);
    setEspeciais(data || []);
    setLoading(false);
  };

  const lista = useMemo(() => {
    const q = filtroBusca.trim().toLowerCase();
    const filtrada = especiais.filter((e) => {
      if (filtroStatus !== "Todos" && e.status !== filtroStatus) return false;
      if (q) {
        const blob = [
          e.ida_destino_local, e.ida_local_saida, e.volta_destino_local,
          e.observacoes, e.criado_por_nome,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    // Ordem: Agendado primeiro, Realizado por último; dentro do grupo, por data desc
    return filtrada.sort((a, b) => {
      const oa = STATUS_ORDEM[a.status] ?? 99;
      const ob = STATUS_ORDEM[b.status] ?? 99;
      if (oa !== ob) return oa - ob;
      return String(b.data || "").localeCompare(String(a.data || ""));
    });
  }, [especiais, filtroStatus, filtroBusca]);

  const contadores = useMemo(() => {
    const r = { Agendado: 0, Realizado: 0, Cancelado: 0 };
    especiais.forEach((e) => { r[e.status] = (r[e.status] || 0) + 1; });
    return r;
  }, [especiais]);

  const handleExcluir = async (e) => {
    if (!isAdmin) return alert("Apenas Administradores podem excluir.");
    if (!confirm(`Excluir o especial de ${e.data}? Isso também apaga do Google Agenda.`)) return;
    try {
      await deleteEspecialFromGoogle(e.id, e.google_event_id).catch(() => {});
      const { error } = await supabase.from("especiais").delete().eq("id", e.id);
      if (error) throw error;
      setDetalhe(null);
      carregar();
    } catch (err) {
      alert("Erro: " + (err.message || err));
    }
  };

  const handleReenviar = async (e) => {
    try {
      const res = await syncEspecialToGoogle(e, e.emails_extras || []);
      await supabase.from("especiais")
        .update({ google_event_id: res.eventId })
        .eq("id", e.id);
      alert(`Evento ${res.action === "created" ? "criado" : "atualizado"} no Google Agenda.`);
      carregar();
    } catch (err) {
      alert("Erro ao reenviar: " + (err.message || err));
    }
  };

  const handleWhats = async (e) => {
    const msg = buildMensagemWhatsAppEspecial(e);
    await copyToClipboard(msg);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const handleSetStatus = async (e, novoStatus) => {
    try {
      const { error } = await supabase
        .from("especiais")
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq("id", e.id);
      if (error) throw error;
      setDetalhe((d) => (d ? { ...d, status: novoStatus } : d));
      carregar();
    } catch (err) {
      alert("Erro: " + (err.message || err));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center">
            <FaBusAlt size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800">Controle de Especial</h1>
            <p className="text-sm text-slate-500">Viagens especiais cadastradas</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/controle-especial/lancamento")}
          className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-black flex items-center gap-2 shadow-md"
        >
          <FaPlus /> Novo Especial
        </button>
      </div>

      {/* Cards de contadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card label="TOTAL" value={especiais.length} color="bg-slate-50 text-slate-800" />
        <Card label="AGENDADOS" value={contadores.Agendado || 0} color="bg-purple-50 text-purple-700" />
        <Card label="REALIZADOS" value={contadores.Realizado || 0} color="bg-emerald-50 text-emerald-700" />
        <Card label="CANCELADOS" value={contadores.Cancelado || 0} color="bg-slate-100 text-slate-500" />
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
          placeholder="Buscar por destino, local, responsável..."
          className="flex-1 min-w-[240px] bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold"
        >
          <option>Todos</option>
          <option>Agendado</option>
          <option>Realizado</option>
          <option>Cancelado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-slate-400 py-10">Carregando...</div>
        ) : lista.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <FaBusAlt className="mx-auto text-slate-300 mb-3" size={36} />
            <div className="text-slate-600 font-bold">Nenhum especial cadastrado</div>
            <div className="text-xs text-slate-400 mt-1">Clique em "Novo Especial" para começar.</div>
          </div>
        ) : (
          lista.map((e) => (
            <div
              key={e.id}
              onClick={() => setDetalhe(e)}
              className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-purple-300 transition flex flex-wrap items-start gap-4 cursor-pointer ${e.status === "Realizado" ? "opacity-70" : ""}`}
              title="Clique para ver detalhes"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex flex-col items-center justify-center flex-none">
                <div className="text-[9px] font-black uppercase">{fmtMes(e.data)}</div>
                <div className="text-lg font-black leading-none">{fmtDia(e.data)}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[e.status] || STATUS_COLORS.Agendado}`}>
                    {e.status}
                  </span>
                  {e.google_event_id && (
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      ● No Google Agenda
                    </span>
                  )}
                  <span className="text-xs text-slate-400">por {e.criado_por_nome || "—"}</span>
                </div>
                <div className="text-sm font-black text-slate-800 truncate">
                  {e.ida_destino_local || "Sem destino"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <FaCalendarAlt className="text-purple-500 mt-0.5" />
                    <span>
                      Ida <b>{(e.ida_hora_saida || "").substring(0, 5)}</b> · Volta <b>{(e.volta_hora_saida || "").substring(0, 5)}</b>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FaMapMarkerAlt className="text-purple-500 mt-0.5" />
                    <span className="truncate">{e.ida_local_saida || "—"}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <FaUsers className="text-purple-500 mt-0.5" />
                    <span>
                      {(e.emails_extras || []).length} convidado{(e.emails_extras || []).length === 1 ? "" : "s"} · {e.qtd_onibus || 1} ônibus
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
                <button
                  onClick={() => handleWhats(e)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                  title="Compartilhar no WhatsApp"
                >
                  <FaWhatsapp />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleExcluir(e)}
                    className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                    title="Excluir (Admin)"
                  >
                    <FaTrash />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Popup de detalhes */}
      {detalhe && (
        <PopupDetalhes
          especial={detalhe}
          isAdmin={isAdmin}
          onClose={() => setDetalhe(null)}
          onEditar={() => {
            setDetalhe(null);
            navigate(`/controle-especial/lancamento?id=${detalhe.id}`);
          }}
          onReenviar={() => handleReenviar(detalhe)}
          onWhats={() => handleWhats(detalhe)}
          onExcluir={() => handleExcluir(detalhe)}
          onSetStatus={(s) => handleSetStatus(detalhe, s)}
        />
      )}
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div className={`rounded-xl border border-slate-200 px-4 py-3 ${color}`}>
      <div className="text-[10px] font-black uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-black">{value}</div>
    </div>
  );
}

const MESES = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
function fmtMes(s) {
  if (!s) return "";
  const m = Number(String(s).substring(5, 7));
  return MESES[m - 1] || "";
}
function fmtDia(s) {
  if (!s) return "";
  return String(s).substring(8, 10);
}
function fmtDataLonga(s) {
  if (!s) return "—";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}
function fmtHora(s) {
  if (!s) return "—";
  return String(s).substring(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────
function PopupDetalhes({ especial, isAdmin, onClose, onEditar, onReenviar, onWhats, onExcluir, onSetStatus }) {
  const e = especial;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        onClick={(ev) => ev.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border-t-4 border-purple-600"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex flex-col items-center justify-center flex-none">
              <div className="text-[9px] font-black uppercase">{fmtMes(e.data)}</div>
              <div className="text-lg font-black leading-none">{fmtDia(e.data)}</div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_COLORS[e.status] || STATUS_COLORS.Agendado}`}>
                  {e.status}
                </span>
                {e.google_event_id && (
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                    ● No Google Agenda
                  </span>
                )}
              </div>
              <div className="text-base font-black text-slate-800 leading-tight">
                {e.ida_destino_local || "Sem destino"}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                <FaUserEdit /> Cadastrado por {e.criado_por_nome || "—"}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 flex-none">
            <FaTimes />
          </button>
        </div>

        {/* Corpo scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Bloco icon={<FaCalendarAlt />} label="Data" valor={fmtDataLonga(e.data)} />
            <Bloco icon={<FaClock />} label="Ida → Volta" valor={`${fmtHora(e.ida_hora_saida)} → ${fmtHora(e.volta_hora_saida)}`} />
            <Bloco icon={<FaBusAlt />} label="Ônibus" valor={e.qtd_onibus || 1} />
          </div>

          {/* Motoristas */}
          {!!(e.motoristas || []).filter((m) => m?.chapa || m?.nome).length && (
            <Section title="👨‍✈️ Motoristas">
              <div className="space-y-1.5">
                {(e.motoristas || []).filter((m) => m?.chapa || m?.nome).map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      ÔN {i + 1}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {[m.chapa, m.nome].filter(Boolean).join(" - ") || "—"}
                    </span>
                    {m.prefixo && (
                      <span className="text-xs text-slate-500 ml-auto">Prefixo {m.prefixo}</span>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* IDA */}
          <Section title="🚌 IDA" color="bg-blue-50 border-blue-200">
            <Line label="Saída" valor={`${fmtHora(e.ida_hora_saida)} · ${e.ida_local_saida || "—"}`} />
            {e.ida_end_saida && <SmallEnd valor={e.ida_end_saida} />}
            {(e.ida_paradas || []).filter((p) => p?.local || p?.endereco).map((p, i) => (
              <div key={i}>
                <Line label={`Parada ${i + 1}`} valor={p.local || "—"} />
                {p.endereco && <SmallEnd valor={p.endereco} />}
              </div>
            ))}
            <Line label="Destino" valor={e.ida_destino_local || "—"} />
            {e.ida_end_destino && <SmallEnd valor={e.ida_end_destino} />}
          </Section>

          {/* VOLTA */}
          <Section title="🚌 VOLTA" color="bg-amber-50 border-amber-200">
            <Line label="Saída" valor={`${fmtHora(e.volta_hora_saida)} · ${e.volta_local_saida || "—"}`} />
            {e.volta_end_saida && <SmallEnd valor={e.volta_end_saida} />}
            {(e.volta_paradas || []).filter((p) => p?.local || p?.endereco).map((p, i) => (
              <div key={i}>
                <Line label={`Parada ${i + 1}`} valor={p.local || "—"} />
                {p.endereco && <SmallEnd valor={p.endereco} />}
              </div>
            ))}
            <Line label="Destino" valor={e.volta_destino_local || "—"} />
            {e.volta_end_destino && <SmallEnd valor={e.volta_end_destino} />}
          </Section>

          {/* Observações */}
          {e.observacoes && (
            <Section title="📝 Observações">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{e.observacoes}</p>
            </Section>
          )}

          {/* Convidados */}
          {!!(e.emails_extras || []).length && (
            <Section title={`📧 Convidados (${(e.emails_extras || []).length})`}>
              <div className="flex flex-wrap gap-1.5">
                {(e.emails_extras || []).map((em) => (
                  <span key={em} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
                    {em}
                  </span>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer ações */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {e.status !== "Realizado" && (
              <button
                onClick={() => onSetStatus("Realizado")}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2"
              >
                <FaCheckCircle /> Marcar Realizado
              </button>
            )}
            {e.status === "Realizado" && (
              <button
                onClick={() => onSetStatus("Agendado")}
                className="px-4 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-black flex items-center gap-2"
              >
                <FaUndo /> Reabrir
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onWhats}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-600 text-xs font-bold flex items-center gap-1"
              title="WhatsApp"
            >
              <FaWhatsapp />
            </button>
            <button
              onClick={onReenviar}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 text-xs font-bold flex items-center gap-1"
              title="Atualizar no Google Agenda"
            >
              <FaSync /> Reprocessar
            </button>
            <button
              onClick={onEditar}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-2"
            >
              <FaPencilAlt /> Editar
            </button>
            {isAdmin && (
              <button
                onClick={onExcluir}
                className="px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center gap-1"
                title="Excluir (Admin)"
              >
                <FaTrash />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, color = "bg-white border-slate-200" }) {
  return (
    <div className={`rounded-xl border p-3 ${color}`}>
      <div className="text-xs font-black text-slate-700 mb-2">{title}</div>
      {children}
    </div>
  );
}
function Line({ label, valor }) {
  return (
    <div className="flex gap-2 text-sm text-slate-700">
      <span className="text-slate-500 font-bold min-w-[80px]">{label}:</span>
      <span className="flex-1 min-w-0">{valor}</span>
    </div>
  );
}
function SmallEnd({ valor }) {
  return <div className="text-xs text-slate-500 ml-[90px] -mt-1 mb-1">{valor}</div>;
}
function Bloco({ icon, label, valor }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
      <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
        {icon} {label}
      </div>
      <div className="text-sm font-black text-slate-800 mt-0.5">{valor}</div>
    </div>
  );
}
