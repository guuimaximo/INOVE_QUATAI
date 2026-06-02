import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  FaBusAlt,
  FaPlus,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUsers,
  FaTrash,
  FaSync,
} from "react-icons/fa";
import {
  deleteEspecialFromGoogle,
  isGoogleConnected,
  syncEspecialToGoogle,
} from "../../utils/googleCalendar";

const STATUS_COLORS = {
  Agendado: "bg-purple-100 text-purple-800 border-purple-200",
  Realizado: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Cancelado: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function ControleEspecialCentral() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [especiais, setEspeciais] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [filtroBusca, setFiltroBusca] = useState("");

  useEffect(() => {
    carregar();
  }, []);

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
    return especiais.filter((e) => {
      if (filtroStatus !== "Todos" && e.status !== filtroStatus) return false;
      if (q) {
        const blob = [
          e.ida_destino_local,
          e.ida_local_saida,
          e.volta_destino_local,
          e.observacoes,
          e.criado_por_nome,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [especiais, filtroStatus, filtroBusca]);

  const contadores = useMemo(() => {
    const r = { Agendado: 0, Realizado: 0, Cancelado: 0 };
    especiais.forEach((e) => {
      r[e.status] = (r[e.status] || 0) + 1;
    });
    return r;
  }, [especiais]);

  const handleExcluir = async (e) => {
    if (!confirm(`Excluir o especial de ${e.data}?`)) return;
    try {
      await deleteEspecialFromGoogle(e.id, e.google_event_id).catch(() => {});
      const { error } = await supabase.from("especiais").delete().eq("id", e.id);
      if (error) throw error;
      carregar();
    } catch (err) {
      alert("Erro: " + (err.message || err));
    }
  };

  const handleReenviar = async (e) => {
    if (!isGoogleConnected()) {
      alert("Conecte com Google Agenda primeiro.");
      return;
    }
    try {
      const res = await syncEspecialToGoogle(e, e.emails_extras || []);
      await supabase
        .from("especiais")
        .update({ google_event_id: res.eventId })
        .eq("id", e.id);
      alert("Evento reenviado pro Google Agenda.");
      carregar();
    } catch (err) {
      alert("Erro ao reenviar: " + (err.message || err));
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
              className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition flex flex-wrap items-start gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex flex-col items-center justify-center flex-none">
                <div className="text-[9px] font-black uppercase">
                  {fmtMes(e.data)}
                </div>
                <div className="text-lg font-black leading-none">{fmtDia(e.data)}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${
                      STATUS_COLORS[e.status] || STATUS_COLORS.Agendado
                    }`}
                  >
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

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleReenviar(e)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                  title="Reenviar pro Google Agenda"
                >
                  <FaSync />
                </button>
                <button
                  onClick={() => handleExcluir(e)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                  title="Excluir"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
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
