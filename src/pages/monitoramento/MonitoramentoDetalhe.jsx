import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaQuestionCircle,
  FaTimesCircle,
  FaWrench,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { InovePageHeader } from "../../components/InovePage";

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistência Técnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistência Técnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
  );
}

function ScoreBar({ score }) {
  if (score == null || score < 0) return <span className="text-sm text-slate-400">—</span>;
  const pct = Math.min(score, 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-3">
      <div className="h-3 w-32 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-2xl font-black text-slate-700">{score}</span>
    </div>
  );
}

export default function MonitoramentoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vision_inspecoes")
        .select("*")
        .eq("id", id)
        .single();
      if (!error && data) setRow(data);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  if (!row) return <div className="p-8 text-center text-slate-400">Laudo não encontrado.</div>;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/monitoramento")}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FaArrowLeft /> Voltar
        </button>
      </div>

      <InovePageHeader
        eyebrow="Laudo de Inspeção"
        title={row.nome || "Sem nome"}
        description={`Registro ${row.registro} • ${row.data_hora_evento || "—"}`}
        icon={<FaExclamationTriangle className="text-xl" />}
        tone="blue"
        actions={<Badge acao={row.acao_prevista} />}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-blue-600">Foto Cadastro</p>
          {row.img_cadastro_url ? (
            <img src={row.img_cadastro_url} alt="Cadastro" className="mx-auto max-h-96 rounded-2xl border shadow" />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">Sem imagem</div>
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-blue-600">Foto Câmera</p>
          {row.img_camera_url ? (
            <img src={row.img_camera_url} alt="Câmera" className="mx-auto max-h-96 rounded-2xl border shadow" />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">Sem imagem</div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-900">Resultado da Análise</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Score</p>
            <div className="mt-1"><ScoreBar score={row.score} /></div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Categoria</p>
            <p className="mt-1 text-sm font-black text-slate-800">{row.categoria || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Confiança</p>
            <p className="mt-1 text-sm font-black text-slate-800">{row.confianca || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Rosto Visível</p>
            <p className="mt-1 text-sm font-black text-slate-800">{row.rosto_visivel ? "Sim" : "Não"}</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-slate-500">Motivo</p>
          <p className="mt-1 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{row.motivo || "—"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-black text-slate-900">Dados do Cartão</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Código Usuário</p>
            <p className="mt-1 text-sm font-semibold">{row.codigo_usuario || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Código Cartão</p>
            <p className="mt-1 text-sm font-semibold">{row.codigo_cartao || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Tipo Cartão</p>
            <p className="mt-1 text-sm font-semibold">{row.tipo_cartao || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Status Cartão</p>
            <p className="mt-1 text-sm font-semibold">{row.status_cartao || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Status Inspeção</p>
            <p className="mt-1 text-sm font-semibold">{row.status_inspecao || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Data/Hora Evento</p>
            <p className="mt-1 text-sm font-semibold">{row.data_hora_evento || "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
