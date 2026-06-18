import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaQuestionCircle,
  FaTimesCircle,
  FaTrash,
  FaWrench,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection } from "../../components/InovePage";

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistencia Tecnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistencia Tecnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
  );
}

function ScoreBar({ score, label }) {
  if (score == null || score < 0) return <span className="text-sm text-slate-400">-</span>;
  const pct = Math.min(score, 100);
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      {label && <p className="mb-1 text-xs font-bold uppercase text-slate-500">{label}</p>}
      <div className="flex items-center gap-3">
        <div className="h-3 w-32 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-2xl font-black text-slate-700">{score}</span>
      </div>
    </div>
  );
}

function InfoField({ label, value, full }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value || "-"}</p>
    </div>
  );
}

function JsonList({ label, items }) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="col-span-full">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-slate-700">
            {String(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const MAPA_STATUS_COLOR = {
  COMPATIVEL: "bg-emerald-100 text-emerald-700",
  PARCIALMENTE_COMPATIVEL: "bg-amber-100 text-amber-700",
  INCOMPATIVEL: "bg-rose-100 text-rose-700",
  NAO_VISIVEL: "bg-slate-100 text-slate-500",
};

function MapaFacialVisual({ mapa }) {
  if (!mapa || typeof mapa !== "object") return null;
  const entries = Object.entries(mapa);
  if (entries.length === 0) return null;

  return (
    <div className="col-span-full">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">Mapa Facial Visual</p>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3 lg:grid-cols-4">
        {entries.map(([key, val]) => {
          const status = String(val).toUpperCase().replace(/ /g, "_");
          const colors = MAPA_STATUS_COLOR[status] || MAPA_STATUS_COLOR.NAO_VISIVEL;
          return (
            <div key={key} className={`rounded-xl px-3 py-2 ${colors}`}>
              <p className="text-[10px] font-bold uppercase">{key.replace(/_/g, " ")}</p>
              <p className="text-xs font-black">{String(val)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapaFacialTecnico({ mapa }) {
  if (!mapa || typeof mapa !== "object") return null;
  const entries = Object.entries(mapa);
  if (entries.length === 0) return null;

  return (
    <div className="col-span-full">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">Mapa Facial Tecnico (Face Mesh)</p>
      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
        {entries.map(([key, val]) => {
          const status = val?.status || "NAO_VISIVEL";
          const colors = MAPA_STATUS_COLOR[status] || MAPA_STATUS_COLOR.NAO_VISIVEL;
          return (
            <div key={key} className={`rounded-xl px-3 py-2 ${colors}`}>
              <p className="text-[10px] font-bold uppercase">{key.replace(/_/g, " ")}</p>
              <p className="text-xs font-black">{status}</p>
              {val?.distancia != null && <p className="text-[10px]">dist: {val.distancia}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BiometriaDetalhes({ detalhes }) {
  if (!detalhes || !Array.isArray(detalhes) || detalhes.length === 0) return null;

  return (
    <div className="col-span-full">
      <p className="mb-2 text-xs font-bold uppercase text-slate-500">Detalhes Biometria por Variante</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 font-bold text-slate-600">Variante</th>
              <th className="px-3 py-2 font-bold text-slate-600">Faces</th>
              <th className="px-3 py-2 font-bold text-slate-600">Similaridade</th>
              <th className="px-3 py-2 font-bold text-slate-600">Score</th>
            </tr>
          </thead>
          <tbody>
            {detalhes.map((d, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold">{d.variante}</td>
                <td className="px-3 py-2">{d.faces_detectadas}</td>
                <td className="px-3 py-2">{d.melhor_similaridade ?? "-"}</td>
                <td className="px-3 py-2 font-black">{d.score ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VarianteLista({ variantes }) {
  if (!variantes || !Array.isArray(variantes) || variantes.length === 0) return null;

  return (
    <div className="col-span-full">
      <p className="text-xs font-bold uppercase text-slate-500">Variantes Face Mesh Analisadas</p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {variantes.map((item, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black text-slate-800">{item.variante || "-"}</span>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black text-slate-700">
                Score {item.score_face_mesh ?? "-"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Cadastro: {item.rosto_cadastro ? "sim" : "nao"} | Camera: {item.rosto_camera ? "sim" : "nao"} | Rostos na camera: {item.quantidade_rostos_camera ?? 0}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TextoCorto({ value, lines = 3 }) {
  if (!value) return <span className="text-sm text-slate-400">-</span>;
  return (
    <p
      className="mt-1 rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700"
      style={{
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {value}
    </p>
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
      const { data, error } = await supabase.from("vision_inspecoes").select("*").eq("id", id).single();
      if (!error && data) setRow(data);
      setLoading(false);
    })();
  }, [id]);

  const excluir = async () => {
    if (!window.confirm("Excluir este laudo?")) return;
    await supabase.from("vision_inspecoes").delete().eq("id", id);
    navigate("/monitoramento");
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  if (!row) return <div className="p-8 text-center text-slate-400">Laudo nao encontrado.</div>;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/monitoramento")}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FaArrowLeft /> Voltar
        </button>
        <button
          onClick={excluir}
          className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-50"
        >
          <FaTrash /> Excluir
        </button>
      </div>

      <InovePageHeader
        eyebrow="Laudo de Inspecao"
        title={row.nome || "Sem nome"}
        description={`Registro ${row.registro} - ${row.data_hora_evento || "-"}${row.prefixo ? ` | Prefixo ${row.prefixo}` : ""}`}
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
          <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-blue-600">Foto Camera</p>
          {row.img_camera_url ? (
            <img src={row.img_camera_url} alt="Camera" className="mx-auto max-h-96 rounded-2xl border shadow" />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">Sem imagem</div>
          )}
        </div>
      </div>

      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Ponto de Controle</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <InfoField label="Prefixo" value={row.prefixo} />
          <InfoField label="Codigo Usuario" value={row.codigo_usuario} />
          <InfoField label="Codigo Cartao" value={row.codigo_cartao} />
          <InfoField label="Tipo Cartao" value={row.tipo_cartao} />
        </div>
      </InoveSection>

      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Resultado da Analise</h2>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <ScoreBar score={row.score} label="Score Final" />
          <ScoreBar score={row.score_biometrico} label="Score Biometrico" />
          <ScoreBar score={row.score_face_mesh} label="Face Mesh" />
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">ArcFace</p>
            <p className="mt-1 text-2xl font-black text-slate-700">{row.similaridade_arcface ?? "-"}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <InfoField label="Categoria" value={row.categoria} />
          <InfoField label="Confianca" value={row.confianca} />
          <InfoField label="Rosto Visivel" value={row.rosto_visivel ? "Sim" : "Nao"} />
          <InfoField label="Quantidade Rostos Camera" value={row.quantidade_rostos_camera} />
          <InfoField label="Qualidade Camera" value={row.qualidade_imagem_camera} />
          <InfoField label="Categoria Biometrica" value={row.categoria_biometrica} />
          <InfoField label="Confianca Biometrica" value={row.confianca_biometrica} />
          <InfoField label="Decisao Biometrica" value={row.decisao_biometrica} />
          <InfoField label="Melhor Variante" value={row.melhor_variante_biometrica} />
          <InfoField label="Recomendacao Operacional" value={row.recomendacao_operacional} />
          <InfoField label="Pontos Compativeis" value={row.pontos_compativeis} />
          <InfoField label="Pontos Divergentes" value={row.pontos_divergentes} />
          <InfoField label="Pontos Nao Visiveis" value={row.pontos_nao_visiveis} />
        </div>
      </InoveSection>

      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Laudo Pericial</h2>
        <div className="grid gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Descricao Profissional</p>
            <TextoCorto value={row.descricao_profissional} lines={3} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Motivo</p>
            <TextoCorto value={row.motivo} lines={2} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-slate-500">Motivo Face Mesh</p>
            <TextoCorto value={row.motivo_face_mesh} lines={2} />
          </div>
          <JsonList label="Indicios de Semelhanca" items={row.indicios_semelhanca} />
          <JsonList label="Indicios de Diferenca" items={row.indicios_diferenca} />
          <JsonList label="Limitacoes" items={row.limitacoes} />
        </div>
      </InoveSection>

      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Mapa Facial</h2>
        <div className="grid gap-4">
          {row.mapa_facial_visual_url ? (
            <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-blue-600">Mapa Facial Visual</p>
              <img src={row.mapa_facial_visual_url} alt="Mapa facial visual" className="w-full rounded-2xl border" />
            </div>
          ) : null}
          <MapaFacialVisual mapa={row.mapa_facial_visual} />
          <MapaFacialTecnico mapa={row.mapa_facial_tecnico} />
        </div>
      </InoveSection>

      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">camera_</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <InfoField label="camera_enquadramento" value={row.camera_enquadramento} />
          <InfoField label="camera_area_rosto_percentual" value={row.camera_area_rosto_percentual} />
          <InfoField label="camera_posicao_rosto" value={row.camera_posicao_rosto} />
          <InfoField label="camera_avaliacao" value={row.avaliacao_camera} full />
          <InfoField label="camera_recomendacao" value={row.camera_recomendacao || row.recomendacao_camera} full />
          <JsonList label="camera_problemas_enquadramento" items={row.problemas_enquadramento_camera} />
        </div>
      </InoveSection>

      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Dados do Cartao</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <InfoField label="Codigo Usuario" value={row.codigo_usuario} />
          <InfoField label="Codigo Cartao" value={row.codigo_cartao} />
          <InfoField label="Tipo Cartao" value={row.tipo_cartao} />
          <InfoField label="Status Cartao" value={row.status_cartao} />
          <InfoField label="Status Inspecao" value={row.status_inspecao} />
          <InfoField label="Data/Hora Evento" value={row.data_hora_evento} />
        </div>
      </InoveSection>
    </div>
  );
}
