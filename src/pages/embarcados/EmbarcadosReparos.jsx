import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  FaPlus,
  FaSearch,
  FaSync,
  FaWrench,
  FaEye,
  FaTools,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
} from "react-icons/fa";
import ReparoSolicitacaoNovaModal from "../../components/embarcados/ReparoSolicitacaoNovaModal";

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
const STATUS = ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS", "CONCLUIDA", "CANCELADA"];

function formatDateTimeBR(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

function statusLabel(status) {
  switch (status) {
    case "EM_ANALISE":
      return "EM ANÁLISE";
    case "EM_EXECUCAO":
      return "EM EXECUÇÃO";
    case "AG_PECAS":
      return "AG. PEÇAS";
    case "CONCLUIDA":
      return "CONCLUÍDA";
    case "CANCELADA":
      return "CANCELADA";
    default:
      return status || "-";
  }
}

function prioridadeLabel(p) {
  switch (p) {
    case "MEDIA":
      return "MÉDIA";
    case "CRITICA":
      return "CRÍTICA";
    default:
      return p || "-";
  }
}

function statusClass(status) {
  switch (status) {
    case "ABERTA":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "EM_ANALISE":
      return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
    case "EM_EXECUCAO":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    case "AG_PECAS":
      return "bg-purple-50 text-purple-700 ring-1 ring-purple-200";
    case "CONCLUIDA":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    case "CANCELADA":
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
}

function prioridadeClass(p) {
  switch (p) {
    case "CRITICA":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    case "ALTA":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    case "MEDIA":
      return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
    case "BAIXA":
      return "bg-green-50 text-green-700 ring-1 ring-green-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
}

function countAbertas(rows) {
  return rows.filter((x) =>
    ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS"].includes(x.status)
  ).length;
}

export default function EmbarcadosReparos() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");
  const [showNovaSolicitacao, setShowNovaSolicitacao] = useState(false);

  async function carregar() {
    setLoading(true);

    const { data, error } = await supabase
      .from("embarcados_solicitacoes_reparo")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Erro ao carregar solicitações.");
      setRows([]);
    } else {
      setRows(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const txt = busca.trim().toLowerCase();

    return (rows || []).filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroPrioridade && r.prioridade !== filtroPrioridade) return false;

      if (!txt) return true;

      const blob = [
        r.veiculo,
        r.tipo_embarcado,
        r.problema,
        r.descricao,
        r.local_problema,
        r.prioridade,
        r.status,
        r.solicitante,
        r.executado_por,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(txt);
    });
  }, [rows, busca, filtroStatus, filtroPrioridade]);

  const resumo = useMemo(() => {
    const total = filtrados.length;
    const abertas = countAbertas(filtrados);
    const concluidas = filtrados.filter((x) => x.status === "CONCLUIDA").length;
    const criticas = filtrados.filter((x) => x.prioridade === "CRITICA").length;

    return { total, abertas, concluidas, criticas };
  }, [filtrados]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1700px] space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black tracking-[0.18em] text-slate-500 uppercase">
                Gestão de embarcados
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                Solicitação de Reparo - Embarcados
              </h1>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                Acompanhe, filtre e abra novas solicitações de reparo dos embarcados.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={carregar}
                className="h-[44px] px-4 rounded-2xl bg-white border border-slate-300 text-slate-800 font-black text-sm hover:bg-slate-50 flex items-center gap-2"
              >
                <FaSync />
                Atualizar
              </button>

              <button
                onClick={() => setShowNovaSolicitacao(true)}
                className="h-[44px] px-4 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-500 flex items-center gap-2"
              >
                <FaPlus />
                Nova solicitação
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-500">Total</div>
                <div className="text-2xl font-black text-slate-900 mt-1">{resumo.total}</div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <FaTools />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-500">Abertas</div>
                <div className="text-2xl font-black text-blue-700 mt-1">{resumo.abertas}</div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <FaClock />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-500">Concluídas</div>
                <div className="text-2xl font-black text-green-700 mt-1">{resumo.concluidas}</div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-green-50 text-green-700 flex items-center justify-center">
                <FaCheckCircle />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-500">Críticas</div>
                <div className="text-2xl font-black text-red-700 mt-1">{resumo.criticas}</div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-700 flex items-center justify-center">
                <FaExclamationTriangle />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Buscar
              </label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-2.5 bg-white">
                <FaSearch className="text-slate-400" />
                <input
                  className="w-full outline-none text-sm font-semibold"
                  placeholder="Veículo, problema, solicitante..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Status
              </label>
              <select
                className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm font-bold bg-white"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {STATUS.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">
                Prioridade
              </label>
              <select
                className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm font-bold bg-white"
                value={filtroPrioridade}
                onChange={(e) => setFiltroPrioridade(e.target.value)}
              >
                <option value="">Todas</option>
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {prioridadeLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Criado em
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Veículo
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Problema
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Prioridade
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600">
                    Solicitante
                  </th>
                  <th className="px-4 py-3 text-[11px] font-black uppercase text-slate-600 text-center">
                    Ações
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center font-black text-slate-500">
                      Carregando solicitações...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center font-black text-slate-500">
                      Nenhuma solicitação encontrada.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((r) => {
                    const finalizada = ["CONCLUIDA", "CANCELADA"].includes(r.status);

                    return (
                      <tr
                        key={r.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition"
                      >
                        <td className="px-4 py-3 font-semibold whitespace-nowrap text-slate-700">
                          {formatDateTimeBR(r.created_at)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-black text-slate-900">{r.veiculo || "-"}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-black text-slate-800">{r.tipo_embarcado || "-"}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-[340px]">
                            <div className="font-semibold text-slate-800 truncate" title={r.problema}>
                              {r.problema || "-"}
                            </div>
                            <div
                              className="text-xs text-slate-500 truncate mt-1"
                              title={r.local_problema}
                            >
                              {r.local_problema || "Sem local informado"}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-3 py-1.5 rounded-full text-[11px] font-black uppercase ${prioridadeClass(
                              r.prioridade
                            )}`}
                          >
                            {prioridadeLabel(r.prioridade)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-3 py-1.5 rounded-full text-[11px] font-black uppercase ${statusClass(
                              r.status
                            )}`}
                          >
                            {statusLabel(r.status)}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {r.solicitante || "-"}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-2 flex-wrap">
                            <button
                              onClick={() => navigate(`/embarcados-reparos/${r.id}`)}
                              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-2 shadow-sm"
                            >
                              <FaEye />
                              Detalhes
                            </button>

                            {!finalizada && (
                              <button
                                onClick={() => navigate(`/embarcados-reparos/${r.id}/executar`)}
                                className="px-3 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-xs font-black flex items-center gap-2 shadow-sm"
                              >
                                <FaWrench />
                                Executar serviço
                              </button>
                            )}
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

        <ReparoSolicitacaoNovaModal
          open={showNovaSolicitacao}
          onClose={() => setShowNovaSolicitacao(false)}
          onSuccess={carregar}
        />
      </div>
    </div>
  );
}
