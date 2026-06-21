import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft, FaCar, FaCheckCircle, FaClipboardList, FaTools } from "react-icons/fa";
import { supabase } from "../../supabase";
import { MonitoramentoFrame, MonitoramentoSection, MonitoramentoStatCard } from "./MonitoramentoShell";

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR") : String(value);
}

function formatPercent(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1).replace(".", ",")}%` : String(value);
}

function badgeTone(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("subir") || text.includes("abaixar") || text.includes("mover") || text.includes("revisar")) return "amber";
  if (text.includes("sem ajuste")) return "emerald";
  if (text.includes("inconsistencia")) return "rose";
  return "slate";
}

export default function MonitoramentoVeiculoDetalhe() {
  const { prefixo } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentRows, setRecentRows] = useState([]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const decodedPrefixo = decodeURIComponent(prefixo || "");
      const [summaryResult, detailResult] = await Promise.all([
        supabase
          .from("vw_monitoramento_inspecoes_veiculos")
          .select("*")
          .eq("prefixo", decodedPrefixo)
          .maybeSingle(),
        supabase
          .from("vw_monitoramento_inspecoes_base")
          .select(
            "id,created_at,dt_evento,nome,veiculo,prefixo_resolvido,score,score_biometrico,score_face_mesh,acao_prevista,categoria,camera_enquadramento,camera_posicao_rosto,camera_area_rosto_percentual,qualidade_imagem_camera,camera_recomendacao,descricao_profissional,problemas_enquadramento_camera,quantidade_rostos_camera,rosto_visivel"
          )
          .eq("prefixo_resolvido", decodedPrefixo)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (!alive) return;

      if (summaryResult.error) {
        console.error("Erro ao carregar resumo do veiculo:", summaryResult.error);
        setSummary(null);
      } else {
        setSummary(summaryResult.data || null);
      }

      if (detailResult.error) {
        console.error("Erro ao carregar detalhes do veiculo:", detailResult.error);
        setRecentRows([]);
      } else {
        setRecentRows(Array.isArray(detailResult.data) ? detailResult.data : []);
      }

      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [prefixo]);

  const stats = useMemo(() => {
    const total = recentRows.length;
    const similares = recentRows.filter((row) => row.acao_prevista === "Confirmar Similaridade").length;
    const inconclusivos = recentRows.filter((row) => row.acao_prevista === "Confirmar Inconclusivo").length;
    const tecnicas = recentRows.filter((row) => row.acao_prevista === "Inconsistencia Tecnica").length;

    return { total, similares, inconclusivos, tecnicas };
  }, [recentRows]);

  const diagnosticoDireto = useMemo(() => {
    const total = recentRows.length;
    const semRosto = recentRows.filter((row) => Number(row.quantidade_rostos_camera || 0) === 0).length;
    const muitosSemRosto = total > 0 && semRosto / total >= 0.6;
    const posicao = String(summary?.ultima_camera_posicao || "").toLowerCase();
    const enquadramento = String(summary?.ultima_camera_enquadramento || "").toLowerCase();
    const recomendacao = summary?.ultima_recomendacao_camera || summary?.ultima_descricao_profissional || summary?.problema_principal || "-";

    if (muitosSemRosto) {
      return {
        titulo: "Problema técnico provável",
        acao: "A câmera nao esta pegando o rosto com consistencia. O ajuste mais provavel e de posicao / inclinacao da camera.",
        detalhe: `Em ${semRosto} de ${total} laudos o rosto nao apareceu.`,
      };
    }

    if (posicao.includes("baixo") || posicao.includes("alto")) {
      return {
        titulo: "Ajuste de posicao",
        acao: posicao.includes("baixo")
          ? "Abaixar a camera ou inclinar para baixo para trazer o rosto para o centro."
          : "Subir a camera ou inclinar para cima para centralizar melhor o rosto.",
        detalhe: recomendacao,
      };
    }

    if (posicao.includes("esquerda") || posicao.includes("direita")) {
      return {
        titulo: "Ajuste lateral",
        acao: posicao.includes("esquerda")
          ? "Mover a camera para a esquerda ou reposicionar o carro para levar o rosto ao centro."
          : "Mover a camera para a direita ou reposicionar o carro para levar o rosto ao centro.",
        detalhe: recomendacao,
      };
    }

    if (enquadramento.includes("inadequado")) {
      return {
        titulo: "Enquadramento ruim",
        acao: "Ajustar enquadramento e campo de visao da camera.",
        detalhe: recomendacao,
      };
    }

    return {
      titulo: "Leitura inconclusiva",
      acao: "Ainda nao ha indicio forte o suficiente para cravar um ajuste unico.",
      detalhe: recomendacao,
    };
  }, [recentRows, summary]);

  const title = summary?.prefixo || decodeURIComponent(prefixo || "");

  return (
    <MonitoramentoFrame
      title="Detalhe do veículo"
      icon={<FaCar className="text-lg" />}
      activeTab="veiculos"
      description="Aqui aparece o resumo técnico do carro que você clicou. A ideia é mostrar por que ele entrou na fila e qual ajuste faz sentido."
      actions={
        <button
          type="button"
          onClick={() => navigate("/monitoramento/veiculos")}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FaArrowLeft /> Voltar
        </button>
      }
    >
      <MonitoramentoSection title={title || "Veículo"} subtitle="Resumo do veículo selecionado">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MonitoramentoStatCard title="Acerto" value={formatPercent(summary?.acertividade)} tone="emerald" />
          <MonitoramentoStatCard title="Laudos" value={formatNumber(summary?.total_laudos)} tone="blue" />
          <MonitoramentoStatCard title="Com problema" value={formatNumber(summary?.total_com_problema_camera)} tone="amber" />
          <MonitoramentoStatCard title="Prioridade" value={formatNumber(summary?.prioridade_camera)} tone="rose" />
        </div>
      </MonitoramentoSection>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <MonitoramentoSection title="Leitura operacional" subtitle="O que a fila está dizendo para mexer">
        <div className="grid gap-3 md:grid-cols-2">
          <DetailBox label="Problema principal" value={summary?.problema_principal || "-"} tone={badgeTone(summary?.problema_principal)} />
          <DetailBox label="Ação sugerida" value={summary?.acao_sugerida || "-"} tone={badgeTone(summary?.acao_sugerida)} />
          <DetailBox label="Última recomendação" value={summary?.ultima_recomendacao_camera || "-"} tone="slate" />
          <DetailBox label="Resumo técnico" value={summary?.ultima_descricao_profissional || "-"} tone="slate" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection title="Diagnóstico direto" subtitle="Sem mistério: o que isso quer dizer na prática">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailBox label="Leitura" value={diagnosticoDireto.titulo} tone={badgeTone(diagnosticoDireto.titulo)} />
          <DetailBox label="O que fazer" value={diagnosticoDireto.acao} tone="amber" />
          <DetailBox label="Base da leitura" value={diagnosticoDireto.detalhe} tone="slate" />
        </div>
      </MonitoramentoSection>

      <MonitoramentoSection title="Sinais recentes" subtitle="Última leitura do bot e os indícios de câmera">
        <div className="grid gap-3 md:grid-cols-2">
            <DetailBox label="Enquadramento" value={summary?.ultima_camera_enquadramento || "-"} tone="slate" />
            <DetailBox label="Qualidade" value={summary?.ultima_qualidade_camera || "-"} tone="slate" />
            <DetailBox label="Posição do rosto" value={summary?.ultima_camera_posicao || "-"} tone="slate" />
            <DetailBox
              label="Área do rosto"
              value={summary?.ultima_camera_area_rosto_percentual != null ? `${summary.ultima_camera_area_rosto_percentual}%` : "-"}
              tone="slate"
            />
          </div>
        </MonitoramentoSection>
      </div>

      <MonitoramentoSection title="Últimos 200 laudos" subtitle="Amostra usada para decidir se o carro entra na fila">
        <div className="grid gap-3 md:grid-cols-3">
          <MonitoramentoStatCard title="Total" value={formatNumber(stats.total)} tone="blue" />
          <MonitoramentoStatCard title="Similares" value={formatNumber(stats.similares)} tone="emerald" />
          <MonitoramentoStatCard title="Inconclusivos/Técnicos" value={formatNumber(stats.inconclusivos + stats.tecnicas)} tone="amber" />
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-semibold text-slate-400">
              Carregando detalhes...
            </div>
          ) : recentRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm font-semibold text-slate-500">
              Nenhum laudo recente encontrado para este veículo.
            </div>
          ) : (
            recentRows.slice(0, 12).map((row) => (
              <div key={row.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">{row.nome || row.veiculo || "-"}</p>
                    <p className="text-xs text-slate-500">
                      {row.dt_evento || "-"} | {row.categoria || "-"} | {row.acao_prevista || "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    <span className="rounded-full border border-slate-200 px-2 py-1">Score {formatNumber(row.score)}</span>
                    <span className="rounded-full border border-slate-200 px-2 py-1">Biometria {formatNumber(row.score_biometrico)}</span>
                    <span className="rounded-full border border-slate-200 px-2 py-1">ArcFace {formatNumber(row.score_face_mesh)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </MonitoramentoSection>
    </MonitoramentoFrame>
  );
}

function DetailBox({ label, value, tone = "slate" }) {
  const tones = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    rose: "border-rose-100 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  return (
    <div className={`rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-base font-bold leading-snug text-slate-900">{value}</p>
    </div>
  );
}
