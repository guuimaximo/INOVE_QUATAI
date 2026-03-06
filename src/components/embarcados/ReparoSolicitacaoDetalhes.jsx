import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUser,
  FaWrench,
  FaImage,
} from "react-icons/fa";

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

function EmptyPhoto() {
  return (
    <div className="w-full h-80 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 text-sm font-bold">
      Sem foto
    </div>
  );
}

export default function ReparoSolicitacaoDetalhes() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);

    const { data, error } = await supabase
      .from("embarcados_solicitacoes_reparo")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) console.error(error);
    setRow(data || null);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 text-center font-black text-slate-500">
        Carregando detalhes...
      </div>
    );
  }

  if (!row) {
    return (
      <div className="p-6 text-center font-black text-slate-500">
        Solicitação não encontrada.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <button
                onClick={() => navigate("/embarcados-reparos")}
                className="mb-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-black"
              >
                <FaArrowLeft />
                Voltar
              </button>

              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Detalhes da solicitação
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 mt-1">
                {row.problema}
              </h1>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                {row.tipo_embarcado} • Veículo {row.veiculo || "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span
                className={`px-4 py-2 rounded-full text-xs font-black uppercase ${prioridadeClass(
                  row.prioridade
                )}`}
              >
                {prioridadeLabel(row.prioridade)}
              </span>
              <span
                className={`px-4 py-2 rounded-full text-xs font-black uppercase ${statusClass(
                  row.status
                )}`}
              >
                {statusLabel(row.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaCalendarAlt />
                  Criado em
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {formatDateTimeBR(row.created_at)}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaMapMarkerAlt />
                  Local do problema
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {row.local_problema || "-"}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaUser />
                  Solicitante
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {row.solicitante || "-"}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2">
                  <FaWrench />
                  Executado por
                </div>
                <div className="mt-2 text-sm font-black text-slate-900">
                  {row.executado_por || "-"}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="text-[10px] font-black uppercase text-slate-500">
                Descrição da solicitação
              </div>
              <div className="mt-3 text-sm font-semibold text-slate-700 whitespace-pre-wrap min-h-[120px]">
                {row.descricao || "Sem descrição detalhada."}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Observação da execução
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-700 whitespace-pre-wrap min-h-[120px]">
                  {row.observacao_execucao || "Sem observação de execução."}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Fechamento
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-700 space-y-2">
                  <div>
                    <span className="font-black text-slate-900">Data execução:</span>{" "}
                    {formatDateTimeBR(row.data_execucao)}
                  </div>
                  <div>
                    <span className="font-black text-slate-900">Data fechamento:</span>{" "}
                    {formatDateTimeBR(row.data_fechamento)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2 mb-3">
              <FaImage />
              Evidência
            </div>

            {row.foto_url ? (
              <img
                src={row.foto_url}
                alt="Evidência"
                className="w-full h-80 object-cover rounded-2xl border bg-white"
              />
            ) : (
              <EmptyPhoto />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
