import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { supabase } from "../../supabase";
import {
  FaPlus,
  FaSave,
  FaTimes,
  FaSearch,
  FaSync,
  FaMicrochip,
  FaCamera,
  FaPlug,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaTools,
  FaExchangeAlt,
  FaUpload,
  FaEdit,
  FaEye,
  FaHistory,
  FaImage,
} from "react-icons/fa";
import EmbarcadosModuleTabs from "../../components/embarcados/EmbarcadosModuleTabs";
import { captureNativePhotoFile, isNativeCameraAvailable } from "../../utils/deviceMedia";

const TIPOS = [
  "TELEMETRIA",
  "CAMERAS",
  "VISION",
  "VALIDADOR",
  "CHIP_VALIDADOR",
  "GPS",
];

const STATUS_FILTRO = ["DISPONIVEL", "EM_VEICULO", "MANUTENCAO", "SUCATA"];
const BUCKET_FOTOS = "embarcados";

function sanitizeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_");
}

function formatDateTimeBR(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return "-";
  }
}

function normalizeStatus(status) {
  const s = String(status || "").toUpperCase();

  if (s === "INSTALADO" || s === "EM_VEICULO") return "EM_VEICULO";
  if (s === "MANUTENCAO") return "MANUTENCAO";
  if (s === "BAIXADO" || s === "SUCATA") return "SUCATA";
  if (s === "DISPONIVEL") return "DISPONIVEL";

  return "DISPONIVEL";
}

function statusLabel(status) {
  const s = normalizeStatus(status);
  if (s === "EM_VEICULO") return "EM VEÍCULO";
  if (s === "MANUTENCAO") return "MANUTENÇÃO";
  if (s === "SUCATA") return "SUCATA";
  return "DISPONÍVEL";
}

function statusClass(status) {
  const s = normalizeStatus(status);

  switch (s) {
    case "DISPONIVEL":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "EM_VEICULO":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "MANUTENCAO":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "SUCATA":
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
}

function tipoIcon(tipo) {
  switch (tipo) {
    case "TELEMETRIA":
    case "CHIP_VALIDADOR":
      return <FaMicrochip />;
    case "CAMERAS":
      return <FaCamera />;
    case "VISION":
      return <FaPlug />;
    case "VALIDADOR":
      return <FaCheckCircle />;
    case "GPS":
      return <FaMapMarkerAlt />;
    default:
      return <FaMicrochip />;
  }
}

function EmptyPhoto({ compact = false }) {
  return (
    <div
      className={`w-full ${
        compact ? "h-24" : "h-44"
      } rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-bold`}
    >
      Sem foto
    </div>
  );
}

function getValorAutomatico(item, ultimaManutencaoMap) {
  const status = normalizeStatus(item?.status_atual);

  if (status === "EM_VEICULO") {
    return item?.veiculo || item?.localizacao_valor || "-";
  }

  if (status === "MANUTENCAO") {
    const dt = ultimaManutencaoMap.get(item?.id);
    return dt ? `Entrou em ${formatDateTimeBR(dt)}` : item?.localizacao_valor || "Em manutenção";
  }

  if (status === "SUCATA") {
    return "Sucata";
  }

  return "Disponível";
}

function InlineEditor({
  registro,
  saving,
  onCancel,
  onSave,
  isNovo = false,
  ultimaManutencaoMap,
}) {
  const [form, setForm] = useState({
    tipo: "TELEMETRIA",
    numero_equipamento: "",
    foto_url: "",
    observacao: "",
    ativo: true,
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (registro) {
      setForm({
        tipo: registro.tipo || "TELEMETRIA",
        numero_equipamento: registro.numero_equipamento || "",
        foto_url: registro.foto_url || "",
        observacao: registro.observacao || "",
        ativo: registro.ativo ?? true,
      });
    } else {
      setForm({
        tipo: "TELEMETRIA",
        numero_equipamento: "",
        foto_url: "",
        observacao: "",
        ativo: true,
      });
    }
  }, [registro]);

  async function uploadFotoFile(file) {
    if (!file) return;

    try {
      setUploading(true);

      const nomeLimpo = sanitizeFileName(file.name);
      const ext = nomeLimpo.split(".").pop() || "jpg";
      const baseSemDuplicarExt = nomeLimpo.replace(/\.[^.]+$/, "");
      const filePath = `ativos/${form.tipo}/${Date.now()}_${baseSemDuplicarExt}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_FOTOS)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error(uploadError);
        alert(uploadError.message || "Erro ao enviar foto.");
        return;
      }

      const { data } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(filePath);

      setForm((prev) => ({
        ...prev,
        foto_url: data?.publicUrl || "",
      }));
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0];
    await uploadFotoFile(file);
    if (e.target) e.target.value = "";
  }

  async function handleCameraFoto() {
    try {
      const file = await captureNativePhotoFile({
        fileNamePrefix: `embarcado_${form.tipo}_${Date.now()}`,
        promptLabelHeader: "Foto do embarcado",
      });
      await uploadFotoFile(file);
    } catch (error) {
      alert(error?.message || "Nao foi possivel abrir a camera.");
    }
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.tipo) return alert("Tipo é obrigatório.");
    if (!form.numero_equipamento.trim()) {
      return alert("Número do equipamento é obrigatório.");
    }

    await onSave({
      tipo: form.tipo,
      numero_equipamento: form.numero_equipamento.trim(),
      foto_url: form.foto_url.trim(),
      observacao: form.observacao.trim(),
      ativo: !!form.ativo,
    });
  }

  const valorLocalizacao = isNovo
    ? "Disponível"
    : normalizeStatus(registro?.status_atual) === "EM_VEICULO"
    ? registro?.veiculo || "-"
    : normalizeStatus(registro?.status_atual) === "MANUTENCAO"
    ? getValorAutomatico(registro, ultimaManutencaoMap)
    : normalizeStatus(registro?.status_atual) === "SUCATA"
    ? "Sucata"
    : "Disponível";

  return (
    <form onSubmit={submit} className="bg-slate-50 border-t border-slate-200">
      <div className="p-5 grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-5">
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
            Foto do equipamento
          </div>

          {form.foto_url ? (
            <img
              src={form.foto_url}
              alt="Foto do embarcado"
              className="w-full h-48 object-cover rounded-2xl border bg-white"
            />
          ) : (
            <EmptyPhoto />
          )}

          <div className="flex flex-wrap gap-2">
            {isNativeCameraAvailable() ? (
              <button
                type="button"
                onClick={handleCameraFoto}
                disabled={uploading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-white hover:bg-black disabled:opacity-60"
              >
                <FaCamera />
                Camera
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
            >
              <FaUpload />
              {uploading ? "Enviando..." : "Anexar foto"}
            </button>

            {form.foto_url && (
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, foto_url: "" }))}
                className="px-3 py-2 rounded-xl bg-white border hover:bg-gray-50 text-sm font-black text-gray-700"
              >
                Remover
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleUploadFoto}
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Tipo
              </label>
              <select
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              >
                {TIPOS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Número do equipamento
              </label>
              <input
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-bold bg-white"
                value={form.numero_equipamento}
                onChange={(e) =>
                  setForm({ ...form, numero_equipamento: e.target.value })
                }
                placeholder="Ex: DVR-001 / GPS-120 / VAL-77"
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Status
              </label>
              <input
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-bold bg-white text-slate-700"
                value={isNovo ? "DISPONÍVEL" : statusLabel(registro?.status_atual)}
                disabled
              />
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Localização
              </label>
              <input
                className="w-full border rounded-xl px-3 py-2.5 text-sm font-bold bg-white text-slate-700"
                value={valorLocalizacao}
                disabled
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
              Observação
            </label>
            <textarea
              className="w-full border rounded-xl px-3 py-3 text-sm font-semibold min-h-[110px] bg-white"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Digite uma observação sobre o ativo..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={!!form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Registro ativo
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2.5 rounded-xl font-black text-sm bg-white border hover:bg-gray-50"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || uploading}
                className="px-4 py-2.5 rounded-xl font-black text-sm bg-slate-900 text-white hover:bg-black disabled:opacity-60 flex items-center gap-2"
              >
                <FaSave />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function EmbarcadosCentral() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalheEmbarcado, setDetalheEmbarcado] = useState(null);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [saving, setSaving] = useState(false);
  const [ultimaManutencaoMap, setUltimaManutencaoMap] = useState(new Map());

  const [modoNovo, setModoNovo] = useState(false);
  const [registroEdicao, setRegistroEdicao] = useState(null);

  const isNativeShell = Capacitor.isNativePlatform();
  const nativePageStyle = isNativeShell
    ? {
        paddingTop: "0.85rem",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.75rem)",
      }
    : undefined;

  async function carregar() {
    setLoading(true);

    const [resCentral, resMovs] = await Promise.all([
      supabase
        .from("v_embarcados_central")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("embarcados_movimentacoes")
        .select("embarcado_id, tipo_movimentacao, data_movimentacao")
        .in("tipo_movimentacao", ["ENVIO_MANUTENCAO"])
        .order("data_movimentacao", { ascending: false }),
    ]);

    if (resCentral.error) {
      console.error(resCentral.error);
      alert("Erro ao carregar embarcados.");
      setRows([]);
    } else {
      setRows(resCentral.data || []);
    }

    if (resMovs.error) {
      console.error(resMovs.error);
      setUltimaManutencaoMap(new Map());
    } else {
      const map = new Map();
      for (const mov of resMovs.data || []) {
        if (!map.has(mov.embarcado_id)) {
          map.set(mov.embarcado_id, mov.data_movimentacao);
        }
      }
      setUltimaManutencaoMap(map);
    }

    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const txt = busca.trim().toLowerCase();

    return (rows || []).filter((r) => {
      const statusNorm = normalizeStatus(r.status_atual);

      if (filtroTipo && r.tipo !== filtroTipo) return false;
      if (filtroStatus && statusNorm !== filtroStatus) return false;

      if (!txt) return true;

      const blob = [
        r.tipo,
        r.numero_equipamento,
        statusLabel(r.status_atual),
        r.veiculo,
        r.localizacao_valor,
        r.observacao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(txt);
    });
  }, [rows, busca, filtroTipo, filtroStatus]);

  const resumo = useMemo(() => {
    const total = filtrados.length;
    const disponiveis = filtrados.filter(
      (x) => normalizeStatus(x.status_atual) === "DISPONIVEL"
    ).length;
    const emVeiculo = filtrados.filter(
      (x) => normalizeStatus(x.status_atual) === "EM_VEICULO"
    ).length;
    const manutencao = filtrados.filter(
      (x) => normalizeStatus(x.status_atual) === "MANUTENCAO"
    ).length;
    const sucata = filtrados.filter(
      (x) => normalizeStatus(x.status_atual) === "SUCATA"
    ).length;

    return { total, disponiveis, emVeiculo, manutencao, sucata };
  }, [filtrados]);

  async function salvar(payload, registro = null) {
    try {
      setSaving(true);

      if (registro?.id) {
        const { error } = await supabase
          .from("embarcados")
          .update({
            tipo: payload.tipo,
            numero_equipamento: payload.numero_equipamento,
            foto_url: payload.foto_url,
            observacao: payload.observacao,
            ativo: payload.ativo,
          })
          .eq("id", registro.id);

        if (error) {
          console.error(error);
          alert(error.message || "Erro ao atualizar embarcado.");
          return;
        }
      } else {
        const { error } = await supabase.from("embarcados").insert([
          {
            tipo: payload.tipo,
            numero_equipamento: payload.numero_equipamento,
            foto_url: payload.foto_url,
            observacao: payload.observacao,
            ativo: payload.ativo,
            status_atual: "DISPONIVEL",
            localizacao_tipo: "ESTOQUE",
            localizacao_valor: "Disponível",
          },
        ]);

        if (error) {
          console.error(error);
          alert(error.message || "Erro ao cadastrar embarcado.");
          return;
        }
      }

      setRegistroEdicao(null);
      setModoNovo(false);
      await carregar();
    } finally {
      setSaving(false);
    }
  }

  function abrirNovo() {
    setRegistroEdicao(null);
    setModoNovo(true);
  }

  function abrirEdicao(item) {
    setModoNovo(false);
    setRegistroEdicao(item);
  }

  function irParaMovimentacao(item) {
    const veiculo = item?.veiculo || item?.localizacao_valor || "";
    const qs = veiculo ? `?veiculo=${encodeURIComponent(veiculo)}` : "";
    navigate(`/embarcados-movimentacoes${qs}`);
  }

  function irParaReparo(item) {
    const params = new URLSearchParams({ nova: "1" });
    const veiculo = item?.veiculo || item?.localizacao_valor || "";
    if (veiculo) params.set("veiculo", veiculo);
    if (item?.tipo) params.set("tipo", item.tipo);
    navigate(`/embarcados-reparos?${params.toString()}`);
  }

  async function abrirDetalhe(item) {
    if (!item?.id) return;

    const veiculo = item?.veiculo || item?.localizacao_valor || "";
    setDetalheEmbarcado({ embarcado: item, veiculo, loading: true, historico: [], reparos: [] });

    const [resHist, resRep] = await Promise.all([
      supabase
        .from("embarcados_movimentacoes")
        .select("*")
        .eq("embarcado_id", item.id)
        .order("data_movimentacao", { ascending: false })
        .limit(80),
      supabase
        .from("embarcados_solicitacoes_reparo")
        .select("id, created_at, veiculo, tipo_embarcado, problema, status, prioridade, executado_por")
        .eq("tipo_embarcado", item.tipo)
        .eq("veiculo", veiculo)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    setDetalheEmbarcado({
      embarcado: item,
      veiculo,
      loading: false,
      historico: resHist.data || [],
      reparos: resRep.data || [],
    });
  }

  return (
    <div className="space-y-6 p-4 md:p-6" style={nativePageStyle}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Embarcados · Central</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Cadastro de embarcados</h1>
          <p className="text-sm text-slate-500">
            Base completa dos ativos embarcados — pesquise, filtre por tipo/status e edite em janela.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-60"
          >
            <FaSync className={loading ? "animate-spin" : ""} /> {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            type="button"
            onClick={abrirNovo}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700"
          >
            <FaPlus />
            Novo embarcado
          </button>
        </div>
      </div>

      {!isNativeShell && <EmbarcadosModuleTabs />}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Total</div>
          <div className="mt-1 text-2xl font-black">{resumo.total}</div>
          <div className="mt-0.5 text-[11px] opacity-70">Após filtros</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Disponível</div>
          <div className="mt-1 text-2xl font-black">{resumo.disponiveis}</div>
          <div className="mt-0.5 text-[11px] opacity-70">Em estoque</div>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Em veículo</div>
          <div className="mt-1 text-2xl font-black">{resumo.emVeiculo}</div>
          <div className="mt-0.5 text-[11px] opacity-70">Instalados</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Manutenção</div>
          <div className="mt-1 text-2xl font-black">{resumo.manutencao}</div>
          <div className="mt-0.5 text-[11px] opacity-70">Em reparo</div>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Sucata</div>
          <div className="mt-1 text-2xl font-black">{resumo.sucata}</div>
          <div className="mt-0.5 text-[11px] opacity-70">Baixados</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Buscar
            </label>
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
                placeholder="Número, tipo, veículo, observação..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Tipo
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
            >
              <option value="">Todos</option>
              {TIPOS.map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Status
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm focus:border-blue-400 focus:outline-none"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {STATUS_FILTRO.map((x) => (
                <option key={x} value={x}>{statusLabel(x)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

        {(modoNovo || registroEdicao) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b bg-slate-900 px-5 py-4 text-white">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.15em] opacity-80">
                    {modoNovo ? "Novo embarcado" : "Editar embarcado"}
                  </div>
                  <div className="text-lg font-black">
                    {modoNovo
                      ? "Cadastro de ativo"
                      : `${registroEdicao?.tipo || ""} · ${registroEdicao?.numero_equipamento || ""}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModoNovo(false);
                    setRegistroEdicao(null);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20"
                  title="Fechar"
                >
                  <FaTimes />
                </button>
              </div>

              <div className="overflow-y-auto">
                <InlineEditor
                  registro={modoNovo ? null : registroEdicao}
                  saving={saving}
                  isNovo={modoNovo}
                  ultimaManutencaoMap={ultimaManutencaoMap}
                  onCancel={() => {
                    setModoNovo(false);
                    setRegistroEdicao(null);
                  }}
                  onSave={(payload) => salvar(payload, modoNovo ? null : registroEdicao)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-black text-slate-500 shadow-sm">
              Carregando embarcados...
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center font-black text-slate-500 shadow-sm">
              Nenhum embarcado encontrado.
            </div>
          ) : (
            filtrados.map((item) => {
              const valorAutomatico = getValorAutomatico(item, ultimaManutencaoMap);

              return (
                <div
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                          {tipoIcon(item.tipo)}
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                            {item.tipo}
                          </div>
                          <div className="text-base font-black text-slate-900">
                            {item.numero_equipamento}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black uppercase ${statusClass(
                          item.status_atual
                        )}`}
                      >
                        {statusLabel(item.status_atual)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Localização atual
                        </div>
                        <div className="mt-0.5 font-semibold text-slate-700">
                          {valorAutomatico}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                          Observação
                        </div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-700">
                          {item.observacao || "Sem observações."}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => irParaMovimentacao(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-2 py-2.5 text-xs font-black text-white hover:bg-blue-500"
                      >
                        <FaExchangeAlt />
                        Mover
                      </button>
                      <button
                        onClick={() => irParaReparo(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-2 py-2.5 text-xs font-black text-white hover:bg-amber-500"
                      >
                        <FaTools />
                        Reparo
                      </button>
                      <button
                        onClick={() => abrirDetalhe(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-50 px-2 py-2.5 text-xs font-black text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                      >
                        <FaEye />
                        Detalhes
                      </button>
                      <button
                        onClick={() => abrirEdicao(item)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2 py-2.5 text-xs font-black text-white hover:bg-black"
                      >
                        <FaEdit />
                        Editar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-4 py-3 font-black uppercase text-[11px] text-slate-600">Tipo</th>
                  <th className="px-4 py-3 font-black uppercase text-[11px] text-slate-600">Equipamento</th>
                  <th className="px-4 py-3 font-black uppercase text-[11px] text-slate-600">Status</th>
                  <th className="px-4 py-3 font-black uppercase text-[11px] text-slate-600">Localização atual</th>
                  <th className="px-4 py-3 font-black uppercase text-[11px] text-slate-600">Observação</th>
                  <th className="px-4 py-3 font-black uppercase text-[11px] text-slate-600 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center font-black text-slate-500"
                    >
                      Carregando embarcados...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center font-black text-slate-500"
                    >
                      Nenhum embarcado encontrado.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((item) => {
                    const valorAutomatico = getValorAutomatico(item, ultimaManutencaoMap);

                    return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-200 hover:bg-slate-50 transition bg-white"
                        >
                          <td className="px-4 py-3 align-middle">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-sm">
                                {tipoIcon(item.tipo)}
                              </div>
                              <div className="font-black text-slate-900">{item.tipo}</div>
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div className="font-black text-slate-900">
                              {item.numero_equipamento}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <span
                              className={`inline-flex px-3 py-1.5 rounded-full text-[11px] font-black uppercase ${statusClass(
                                item.status_atual
                              )}`}
                            >
                              {statusLabel(item.status_atual)}
                            </span>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div className="font-semibold text-slate-700">
                              {valorAutomatico}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle max-w-[360px]">
                            <div className="font-semibold text-slate-700 truncate">
                              {item.observacao || "Sem observações."}
                            </div>
                          </td>

                          <td className="px-4 py-3 align-middle">
                            <div className="flex flex-wrap justify-end gap-2">
                              <button
                                onClick={() => irParaMovimentacao(item)}
                                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-2"
                              >
                                <FaExchangeAlt />
                                Movimentar
                              </button>

                              <button
                                onClick={() => irParaReparo(item)}
                                className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-2"
                              >
                                <FaTools />
                                Reparo
                              </button>

                              <button
                                onClick={() => abrirDetalhe(item)}
                                className="px-3 py-2 rounded-xl bg-blue-50 ring-1 ring-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-black flex items-center gap-2"
                              >
                                <FaEye />
                                Detalhes
                              </button>

                              <button
                                onClick={() => abrirEdicao(item)}
                                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center gap-2"
                              >
                                <FaEdit />
                                Editar
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

        {detalheEmbarcado && (
          <div className="fixed inset-0 bg-slate-900/60 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl overflow-hidden flex flex-col">
              <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <FaHistory /> Vida do embarcado
                  </h2>
                  <p className="text-xs font-semibold text-slate-300">
                    {detalheEmbarcado.embarcado?.tipo} · {detalheEmbarcado.embarcado?.numero_equipamento}
                  </p>
                </div>
                <button
                  onClick={() => setDetalheEmbarcado(null)}
                  className="text-white/70 hover:text-white transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    {detalheEmbarcado.embarcado?.foto_url ? (
                      <img
                        src={detalheEmbarcado.embarcado.foto_url}
                        alt="Foto do embarcado"
                        className="h-56 w-full rounded-xl object-cover border"
                      />
                    ) : (
                      <div className="h-56 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                        <FaImage className="text-2xl" />
                        <span className="mt-2 text-sm font-bold">Sem foto no cadastro</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase text-slate-400">Número</div>
                      <div className="mt-1 text-xl font-black text-slate-900">{detalheEmbarcado.embarcado?.numero_equipamento || "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase text-slate-400">Status atual</div>
                      <div className="mt-1 text-xl font-black text-slate-900">{statusLabel(detalheEmbarcado.embarcado?.status_atual)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase text-slate-400">Local atual</div>
                      <div className="mt-1 text-xl font-black text-blue-700">{detalheEmbarcado.veiculo || detalheEmbarcado.embarcado?.localizacao_valor || "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase text-slate-400">Reparos consultados</div>
                      <div className="mt-1 text-xl font-black text-amber-700">{detalheEmbarcado.reparos?.length || 0}</div>
                    </div>
                    <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-[10px] font-black uppercase text-slate-400">Observação do cadastro</div>
                      <div className="mt-1 text-sm font-semibold text-slate-700 whitespace-pre-wrap">{detalheEmbarcado.embarcado?.observacao || "-"}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
                      Carros e movimentações
                    </div>
                    {detalheEmbarcado.loading ? (
                      <div className="py-8 text-center text-slate-400 font-black">Carregando...</div>
                    ) : detalheEmbarcado.historico?.length ? (
                      <div className="space-y-3">
                        {detalheEmbarcado.historico.map((h) => (
                          <div key={h.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="text-xs font-black text-slate-900">{h.tipo_movimentacao || "-"}</div>
                            <div className="mt-1 text-[11px] font-semibold text-slate-500">{formatDateTimeBR(h.data_movimentacao || h.created_at)}</div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                              <div><strong>Origem:</strong> {h.origem_tipo || "-"} · {h.origem_valor || "-"}</div>
                              <div><strong>Destino:</strong> {h.destino_tipo || "-"} · {h.destino_valor || "-"}</div>
                            </div>
                            {h.observacao ? <div className="mt-2 text-xs text-slate-600">{h.observacao}</div> : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 font-black">Sem movimentações.</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
                      Manutenções e solicitações
                    </div>
                    {detalheEmbarcado.loading ? (
                      <div className="py-8 text-center text-slate-400 font-black">Carregando...</div>
                    ) : detalheEmbarcado.reparos?.length ? (
                      <div className="space-y-3">
                        {detalheEmbarcado.reparos.map((r) => (
                          <div key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-black text-slate-900">{r.problema || "-"}</div>
                                <div className="mt-1 text-[11px] font-semibold text-slate-500">{formatDateTimeBR(r.created_at)}</div>
                              </div>
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">{statusLabel(r.status)}</span>
                            </div>
                            <div className="mt-2 text-xs text-slate-600">Executado por: <strong>{r.executado_por || "-"}</strong></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-slate-400 font-black">Sem solicitações para este veículo/tipo.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
