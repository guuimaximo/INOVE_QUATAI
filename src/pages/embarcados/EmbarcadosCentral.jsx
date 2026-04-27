import { useEffect, useMemo, useRef, useState } from "react";
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
  FaChevronDown,
  FaChevronRight,
  FaEdit,
} from "react-icons/fa";

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

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0];
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
      if (e.target) e.target.value = "";
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
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [saving, setSaving] = useState(false);
  const [ultimaManutencaoMap, setUltimaManutencaoMap] = useState(new Map());

  const [expandedId, setExpandedId] = useState(null);
  const [modoNovo, setModoNovo] = useState(false);

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

  async function salvar(payload, registroEdicao = null) {
    try {
      setSaving(true);

      if (registroEdicao?.id) {
        const { error } = await supabase
          .from("embarcados")
          .update({
            tipo: payload.tipo,
            numero_equipamento: payload.numero_equipamento,
            foto_url: payload.foto_url,
            observacao: payload.observacao,
            ativo: payload.ativo,
          })
          .eq("id", registroEdicao.id);

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

      setExpandedId(null);
      setModoNovo(false);
      await carregar();
    } finally {
      setSaving(false);
    }
  }

  function abrirNovo() {
    setExpandedId(null);
    setModoNovo((prev) => !prev);
  }

  function abrirEdicao(id) {
    setModoNovo(false);
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-5">
      <div className="max-w-[1700px] mx-auto space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-4">
            <div>
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.18em]">              
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
                Cadastro de Embarcados
              </h1>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                
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
                onClick={abrirNovo}
                className="h-[44px] px-4 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-500 flex items-center gap-2"
              >
                <FaPlus />
                {modoNovo ? "Fechar novo" : "Novo embarcado"}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="text-[10px] font-black text-slate-500 uppercase">Total</div>
            <div className="text-2xl font-black mt-1 text-slate-900">{resumo.total}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="text-[10px] font-black text-slate-500 uppercase">Disponível</div>
            <div className="text-2xl font-black mt-1 text-emerald-700">{resumo.disponiveis}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="text-[10px] font-black text-slate-500 uppercase">Em veículo</div>
            <div className="text-2xl font-black mt-1 text-blue-700">{resumo.emVeiculo}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="text-[10px] font-black text-slate-500 uppercase">Manutenção</div>
            <div className="text-2xl font-black mt-1 text-amber-700">{resumo.manutencao}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="text-[10px] font-black text-slate-500 uppercase">Sucata</div>
            <div className="text-2xl font-black mt-1 text-slate-700">{resumo.sucata}</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-1">
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Buscar
              </label>
              <div className="flex items-center gap-2 border border-slate-300 rounded-2xl px-3 py-2.5 bg-white">
                <FaSearch className="text-slate-400" />
                <input
                  className="w-full outline-none text-sm font-semibold"
                  placeholder="Número, tipo, veículo, observação..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Tipo
              </label>
              <select
                className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm font-bold bg-white"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos</option>
                {TIPOS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase mb-1 block">
                Status
              </label>
              <select
                className="w-full border border-slate-300 rounded-2xl px-3 py-2.5 text-sm font-bold bg-white"
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
              >
                <option value="">Todos</option>
                {STATUS_FILTRO.map((x) => (
                  <option key={x} value={x}>
                    {statusLabel(x)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {modoNovo && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-900 text-white">
              <div className="text-[11px] font-black uppercase tracking-[0.15em] opacity-80">
                Novo embarcado
              </div>
              <div className="text-lg font-black">Cadastro de ativo</div>
            </div>

            <InlineEditor
              registro={null}
              saving={saving}
              isNovo
              ultimaManutencaoMap={ultimaManutencaoMap}
              onCancel={() => setModoNovo(false)}
              onSave={(payload) => salvar(payload, null)}
            />
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 border-b border-slate-200">
                <tr className="text-left">
                  <th className="px-4 py-3 w-[56px]"></th>
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
                      colSpan={7}
                      className="px-4 py-12 text-center font-black text-slate-500"
                    >
                      Carregando embarcados...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center font-black text-slate-500"
                    >
                      Nenhum embarcado encontrado.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((item) => {
                    const valorAutomatico = getValorAutomatico(item, ultimaManutencaoMap);
                    const aberto = expandedId === item.id;

                    return (
                      <>
                        <tr
                          key={item.id}
                          className={`border-b border-slate-200 hover:bg-slate-50 transition ${
                            aberto ? "bg-slate-50" : "bg-white"
                          }`}
                        >
                          <td className="px-4 py-3 align-middle">
                            <button
                              onClick={() => abrirEdicao(item.id)}
                              className="w-8 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-700"
                              title={aberto ? "Fechar" : "Abrir detalhes"}
                            >
                              {aberto ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                            </button>
                          </td>

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
                              <button className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black flex items-center gap-2">
                                <FaExchangeAlt />
                                Movimentar
                              </button>

                              <button className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black flex items-center gap-2">
                                <FaTools />
                                Reparo
                              </button>

                              <button
                                onClick={() => abrirEdicao(item.id)}
                                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-black flex items-center gap-2"
                              >
                                <FaEdit />
                                Editar
                              </button>
                            </div>
                          </td>
                        </tr>

                        {aberto && (
                          <tr className="border-b border-slate-200">
                            <td colSpan={7} className="p-0">
                              <InlineEditor
                                registro={item}
                                saving={saving}
                                ultimaManutencaoMap={ultimaManutencaoMap}
                                onCancel={() => setExpandedId(null)}
                                onSave={(payload) => salvar(payload, item)}
                              />
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
