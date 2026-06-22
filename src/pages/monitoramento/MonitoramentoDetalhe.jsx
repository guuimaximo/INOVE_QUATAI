import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaExclamationTriangle,
  FaDownload,
  FaImage,
  FaQuestionCircle,
  FaTimesCircle,
  FaTrash,
  FaWrench,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { InovePageHeader, InoveSection } from "../../components/InovePage";
import { gerarLaudoInovePdf } from "../../utils/monitoramentoLaudoPdf";

// Nome legivel da variante de imagem usada pela biometria (sem jargao tecnico).
function nomeVarianteLegivel(variante) {
  if (!variante) return "";
  const mapa = {
    camera_original: "Imagem original",
    camera_melhorada: "Imagem melhorada",
    camera_clahe: "Contraste realcado",
    camera_pb_equalizada: "Preto e branco equalizado",
    camera_tratada_biometria: "Imagem tratada",
    camera_tratada_biometria_clahe: "Imagem tratada (contraste)",
    camera_crop_rosto_arcface: "Recorte do rosto",
    camera_crop_rosto_arcface_tratado: "Recorte do rosto (tratado)",
    camera_crop_rosto_arcface_melhorado: "Recorte do rosto (melhorado)",
    camera_crop_rosto_arcface_clahe: "Recorte do rosto (contraste)",
    camera_crop_inferior_total: "Recorte inferior",
    camera_crop_direita_inferior: "Recorte direita-inferior",
    camera_crop_esquerda_inferior: "Recorte esquerda-inferior",
    camera_crop_centro_direita: "Recorte centro-direita",
    camera_crop_direita_baixa_fechado: "Recorte direita-baixa",
    camera_zoom_regiao_pessoa: "Zoom na pessoa",
  };
  return mapa[variante] || variante;
}

// Veredito em linguagem clara para quem audita.
function vereditoLegivel(categoria) {
  const c = String(categoria || "").toUpperCase();
  if (c.includes("SIMILAR")) return { texto: "Mesma pessoa", desc: "Compatibilidade facial confirmada", tone: "emerald", icon: <FaCheckCircle /> };
  if (c.includes("DIFERENTE")) return { texto: "Pessoa diferente", desc: "Possivel irregularidade", tone: "rose", icon: <FaTimesCircle /> };
  if (c.includes("SEM_PESSOA") || c.includes("SEM_FACE")) return { texto: "Sem rosto comparavel", desc: "Nao foi possivel comparar", tone: "slate", icon: <FaQuestionCircle /> };
  return { texto: "Inconclusivo", desc: "Evidencias insuficientes para confirmar", tone: "amber", icon: <FaQuestionCircle /> };
}

// Interpreta a similaridade ArcFace (0 a 1) em texto util ao analista.
function interpretarSimilaridade(sim) {
  if (sim == null || sim === "") return { texto: "Nao disponivel", tone: "slate", pct: 0 };
  const s = Number(sim);
  if (!Number.isFinite(s)) return { texto: "Nao disponivel", tone: "slate", pct: 0 };
  const pct = Math.max(0, Math.min(100, Math.round(s * 100)));
  if (s >= 0.45) return { texto: "Alta compatibilidade — provavelmente a mesma pessoa", tone: "emerald", pct };
  if (s >= 0.35) return { texto: "Compatibilidade moderada — analise visual recomendada", tone: "amber", pct };
  if (s >= 0.15) return { texto: "Baixa compatibilidade — identidade incerta", tone: "amber", pct };
  return { texto: "Incompativel — provavelmente pessoa diferente", tone: "rose", pct };
}

const ACAO_TONE = {
  "Confirmar Similaridade": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-300", icon: <FaCheckCircle /> },
  "Confirmar Irregularidade": { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-300", icon: <FaTimesCircle /> },
  "Confirmar Inconclusivo": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: <FaQuestionCircle /> },
  "Inconsistencia Tecnica": { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", icon: <FaWrench /> },
};

const TONE_CLASSES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

function Badge({ acao }) {
  const t = ACAO_TONE[acao] || ACAO_TONE["Inconsistencia Tecnica"];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-black ${t.bg} ${t.text} ${t.border}`}>
      {t.icon} {acao}
    </span>
  );
}

function InfoField({ label, value, full }) {
  return (
    <div className={full ? "col-span-full" : ""}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value || value === 0 ? value : "-"}</p>
    </div>
  );
}

function JsonList({ label, items, tone = "slate" }) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  const dot = tone === "rose" ? "text-rose-400" : tone === "emerald" ? "text-emerald-500" : "text-slate-400";
  return (
    <div>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <span className={`mt-1 ${dot}`}>•</span>
            <span>{String(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Paragrafo({ value }) {
  if (!value) return null;
  return <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{value}</p>;
}

function MediaCard({ title, subtitle, url, fallbackLabel = "Sem imagem", tone = "blue" }) {
  const tones = { blue: "text-blue-600", emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600", slate: "text-slate-500" };
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className={`text-xs font-black uppercase tracking-widest ${tones[tone] || tones.blue}`}>{title}</p>
          {subtitle ? <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p> : null}
        </div>
        <FaImage className={`${tones[tone] || tones.blue}`} />
      </div>
      {url ? (
        <img src={url} alt={title} className="mx-auto max-h-96 w-full rounded-2xl border object-contain bg-slate-50" />
      ) : (
        <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">{fallbackLabel}</div>
      )}
    </div>
  );
}

function DecisionCard({ label, value, full = false, tone = "slate" }) {
  return (
    <div className={`${full ? "col-span-full" : ""} rounded-2xl border p-4 shadow-sm ${TONE_CLASSES[tone] || TONE_CLASSES.slate}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900">{value || "-"}</p>
    </div>
  );
}

export default function MonitoramentoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvandoPdf, setSalvandoPdf] = useState(false);
  const [lista, setLista] = useState([]);

  const dia = useMemo(() => new URLSearchParams(location.search).get("dia"), [location.search]);
  const backTarget = useMemo(() => (dia ? `/monitoramento/dia/${dia}` : "/monitoramento"), [dia]);

  // Carrega o laudo atual.
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from("vision_inspecoes").select("*").eq("id", id).single();
      if (!error && data) setRow(data);
      setLoading(false);
    })();
  }, [id]);

  // Carrega a sequencia de laudos para navegar com as setas.
  // Usa a view (que tem dt_evento); a tabela crua vision_inspecoes nao tem essa coluna.
  useEffect(() => {
    (async () => {
      let q = supabase
        .from("vw_monitoramento_inspecoes_base")
        .select("id,nome")
        .order("created_at", { ascending: false });
      if (dia) q = q.eq("dt_evento", dia);
      else q = q.limit(500);
      const { data, error } = await q;
      if (error) {
        console.error("Erro ao carregar sequencia de laudos:", error);
        return;
      }
      if (Array.isArray(data)) setLista(data);
    })();
  }, [dia]);

  const idx = useMemo(() => lista.findIndex((l) => String(l.id) === String(id)), [lista, id]);
  const irPara = useCallback(
    (delta) => {
      if (idx < 0) return;
      const alvo = lista[idx + delta];
      if (!alvo) return;
      navigate(`/monitoramento/${alvo.id}${dia ? `?dia=${dia}` : ""}`);
    },
    [idx, lista, dia, navigate],
  );

  // Setas do teclado para navegar.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") irPara(-1);
      if (e.key === "ArrowRight") irPara(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [irPara]);

  const excluir = async () => {
    if (!window.confirm("Excluir este laudo?")) return;
    await supabase.from("vision_inspecoes").delete().eq("id", id);
    navigate(backTarget);
  };

  const baixarPdf = async () => {
    if (!row || salvandoPdf) return;
    setSalvandoPdf(true);
    try {
      await gerarLaudoInovePdf(row);
    } finally {
      setSalvandoPdf(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando...</div>;
  if (!row) return <div className="p-8 text-center text-slate-400">Laudo nao encontrado.</div>;

  const veredito = vereditoLegivel(row.categoria);
  const sim = interpretarSimilaridade(row.similaridade_arcface);
  const imagemTratadaUrl = row.img_camera_tratada_url || row.img_camera_url;
  const varianteUsadaLabel = nomeVarianteLegivel(row.variante_imagem_usada_biometria || row.melhor_variante_biometrica);
  const cropUsadoUrl = row.img_crop_biometria_url;
  const temNav = idx >= 0 && lista.length > 1;

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* Barra de acoes */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate(backTarget)}
          className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FaArrowLeft /> Voltar
        </button>
        <button
          onClick={baixarPdf}
          disabled={salvandoPdf}
          className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaDownload /> {salvandoPdf ? "Gerando PDF..." : "Baixar PDF"}
        </button>
        <button
          onClick={excluir}
          className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-50"
        >
          <FaTrash /> Excluir
        </button>
      </div>

      {/* Navegacao entre laudos com legenda em cima */}
      {temNav && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            onClick={() => irPara(-1)}
            disabled={idx <= 0}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FaChevronLeft /> Anterior
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Laudo {idx + 1} de {lista.length}
            </p>
            <p className="truncate text-sm font-black text-slate-800">{row.nome || "Sem nome"}</p>
          </div>
          <button
            onClick={() => irPara(1)}
            disabled={idx >= lista.length - 1}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Proximo <FaChevronRight />
          </button>
        </div>
      )}

      <InovePageHeader
        eyebrow="Laudo de Inspecao"
        title={row.nome || "Sem nome"}
        description={`Registro ${row.registro || "-"} · ${row.data_hora_evento || "-"}${row.prefixo || row.veiculo ? ` · Prefixo ${row.prefixo || row.veiculo}` : ""}`}
        icon={<FaExclamationTriangle className="text-xl" />}
        tone="blue"
        actions={<Badge acao={row.acao_prevista} />}
      />

      {/* Veredito em destaque */}
      <InoveSection>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className={`rounded-3xl border-2 p-5 ${TONE_CLASSES[veredito.tone]}`}>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">Veredito</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-2xl">{veredito.icon}</span>
              <div>
                <p className="text-2xl font-black leading-tight">{veredito.texto}</p>
                <p className="text-sm font-semibold opacity-80">{veredito.desc}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black">Confianca: {row.confianca || "-"}</span>
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black">Acao: {row.recomendacao_operacional || row.acao_prevista || "-"}</span>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Compatibilidade facial (ArcFace)</p>
            <p className="mt-1 text-3xl font-black text-slate-800">{row.similaridade_arcface ?? "-"}</p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${sim.tone === "emerald" ? "bg-emerald-500" : sim.tone === "amber" ? "bg-amber-500" : sim.tone === "rose" ? "bg-rose-500" : "bg-slate-400"}`}
                style={{ width: `${sim.pct}%` }}
              />
            </div>
            <p className={`mt-2 text-sm font-semibold ${sim.tone === "rose" ? "text-rose-600" : sim.tone === "emerald" ? "text-emerald-600" : "text-slate-600"}`}>
              {sim.texto}
            </p>
          </div>
        </div>
      </InoveSection>

      {/* Imagens / evidencias */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MediaCard title="Foto Cadastro" subtitle="Referencia do cadastro" url={row.img_cadastro_url} tone="blue" />
        <MediaCard title="Foto Camera" subtitle="Captura usada na analise" url={row.img_camera_url} tone="slate" />
        <MediaCard title="Imagem Tratada" subtitle={varianteUsadaLabel || "Tratada para biometria"} url={imagemTratadaUrl} tone="emerald" />
        <MediaCard title="Rosto Comparado" subtitle="Recorte exato avaliado" url={cropUsadoUrl} fallbackLabel="Sem recorte de rosto" tone="amber" />
      </div>

      {/* Parecer */}
      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Parecer</h2>
        <div className="grid gap-4">
          <Paragrafo value={row.descricao_profissional} />
          {row.motivo ? (
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Motivo da decisao</p>
              <Paragrafo value={row.motivo} />
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <JsonList label="Indicios de semelhanca" items={row.indicios_semelhanca} tone="emerald" />
            <JsonList label="Indicios de diferenca" items={row.indicios_diferenca} tone="rose" />
          </div>
          <JsonList label="Limitacoes da analise" items={row.limitacoes} />
        </div>
      </InoveSection>

      {/* Camera / enquadramento */}
      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Camera e enquadramento</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <InfoField label="Enquadramento" value={row.camera_enquadramento || row.avaliacao_camera} />
          <InfoField label="Qualidade da imagem" value={row.qualidade_imagem_camera} />
          <InfoField label="Area do rosto" value={row.camera_area_rosto_percentual != null ? `${row.camera_area_rosto_percentual}%` : "-"} />
          <InfoField label="Rostos na cena" value={row.quantidade_rostos_camera} />
          <InfoField label="Imagem usada na biometria" value={varianteUsadaLabel} />
          <div className="col-span-full">
            <p className="text-xs font-bold uppercase text-slate-500">Recomendacao para a camera</p>
            <Paragrafo value={row.camera_recomendacao || row.recomendacao_camera} />
          </div>
          <JsonList label="Problemas de enquadramento" items={row.problemas_enquadramento_camera} tone="rose" />
        </div>
      </InoveSection>

      {/* Identificacao / cartao */}
      <InoveSection>
        <h2 className="mb-4 text-lg font-black text-slate-900">Identificacao</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <InfoField label="Prefixo / Veiculo" value={row.prefixo || row.veiculo} />
          <InfoField label="Codigo do usuario" value={row.codigo_usuario} />
          <InfoField label="Codigo do cartao" value={row.codigo_cartao} />
          <InfoField label="Tipo do cartao" value={row.tipo_cartao} />
          <InfoField label="Status do cartao" value={row.status_cartao} />
          <InfoField label="Data/hora do evento" value={row.data_hora_evento} />
        </div>
      </InoveSection>
    </div>
  );
}
