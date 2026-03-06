import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
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

function formatDateBR(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleDateString("pt-BR");
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
      return "bg-green-100 text-green-700";
    case "EM_VEICULO":
      return "bg-blue-100 text-blue-700";
    case "MANUTENCAO":
      return "bg-yellow-100 text-yellow-800";
    case "SUCATA":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
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

function EmptyPhoto() {
  return (
    <div className="w-full h-40 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-bold">
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

function EmbarcadoModal({ open, onClose, onSave, saving, registro }) {
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
    if (!open) return;

    if (registro) {
      setForm({
        tipo: registro.tipo || "TELEMETRIA",
        numero_equipamento: registro.numero_equipamento || "",
        foto_url: registro.foto_url || "",
        observacao: registro.observacao || "",
        ativo: registro.ativo ?? true,
      });
      return;
    }

    setForm({
      tipo: "TELEMETRIA",
      numero_equipamento: "",
      foto_url: "",
      observacao: "",
      ativo: true,
    });
  }, [open, registro]);

  if (!open) return null;

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
    if (!form.numero_equipamento.trim()) return alert("Número do equipamento é obrigatório.");

    await onSave({
      tipo: form.tipo,
      numero_equipamento: form.numero_equipamento.trim(),
      foto_url: form.foto_url.trim(),
      observacao: form.observacao.trim(),
      ativo: !!form.ativo,
    });
  }

  const isNovo = !registro;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">
              {registro ? "Editar embarcado" : "Novo embarcado"}
            </div>
            <div className="text-lg font-black text-gray-900">
              {registro ? registro.numero_equipamento : "Cadastro de ativo"}
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Tipo</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
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
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
              Número do equipamento
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.numero_equipamento}
              onChange={(e) => setForm({ ...form, numero_equipamento: e.target.value })}
              placeholder="Ex: DVR-001 / GPS-120 / VAL-77"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Status</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-gray-100"
              value={isNovo ? "DISPONÍVEL" : statusLabel(registro?.status_atual)}
              disabled
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Valor da localização</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold bg-gray-100"
              value={
                isNovo
                  ? "Disponível"
                  : normalizeStatus(registro?.status_atual) === "EM_VEICULO"
                  ? registro?.veiculo || "-"
                  : normalizeStatus(registro?.status_atual) === "MANUTENCAO"
                  ? "Automático pela manutenção"
                  : normalizeStatus(registro?.status_atual) === "SUCATA"
                  ? "Sucata"
                  : "Disponível"
              }
              disabled
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Foto</label>

            <div className="flex flex-col gap-3">
              {form.foto_url ? (
                <img
                  src={form.foto_url}
                  alt="Foto do embarcado"
                  className="w-full h-52 object-cover rounded-xl border bg-white"
                />
              ) : (
                <EmptyPhoto />
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-2 disabled:opacity-60"
                >
                  <FaPlus />
                  {uploading ? "Enviando foto..." : "Anexar foto"}
                </button>

                {form.foto_url && (
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, foto_url: "" }))}
                    className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-black"
                  >
                    Remover foto
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
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Observação</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[90px]"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="ativo_embarcado"
              type="checkbox"
              checked={!!form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            <label htmlFor="ativo_embarcado" className="text-sm font-bold text-gray-700">
              Registro ativo
            </label>
          </div>

          <div className="md:col-span-2 flex justify-between gap-3 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-black text-sm bg-white border hover:bg-gray-100"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || uploading}
              className="px-4 py-2 rounded-lg font-black text-sm bg-gray-900 text-white hover:bg-black disabled:opacity-60 flex items-center gap-2"
            >
              <FaSave /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmbarcadosCentral() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registroEdicao, setRegistroEdicao] = useState(null);

  const [ultimaManutencaoMap, setUltimaManutencaoMap] = useState(new Map());

  async function carregar() {
    setLoading(true);

    const [resCentral, resMovs] = await Promise.all([
      supabase.from("v_embarcados_central").select("*").order("created_at", { ascending: false }),
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
    const disponiveis = filtrados.filter((x) => normalizeStatus(x.status_atual) === "DISPONIVEL").length;
    const emVeiculo = filtrados.filter((x) => normalizeStatus(x.status_atual) === "EM_VEICULO").length;
    const manutencao = filtrados.filter((x) => normalizeStatus(x.status_atual) === "MANUTENCAO").length;
    const sucata = filtrados.filter((x) => normalizeStatus(x.status_atual) === "SUCATA").length;

    return { total, disponiveis, emVeiculo, manutencao, sucata };
  }, [filtrados]);

  async function salvar(payload) {
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

      setModalOpen(false);
      setRegistroEdicao(null);
      await carregar();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">Módulo</div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
              Central de Embarcados
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              Cadastro mestre, status automático e posição atual do ativo.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={carregar}
              className="h-[42px] px-4 rounded-xl bg-white border text-gray-800 font-black text-sm hover:bg-gray-100 flex items-center gap-2"
            >
              <FaSync /> Atualizar
            </button>

            <button
              onClick={() => {
                setRegistroEdicao(null);
                setModalOpen(true);
              }}
              className="h-[42px] px-4 rounded-xl bg-green-600 text-white font-black text-sm hover:bg-green-500 flex items-center gap-2"
            >
              <FaPlus /> Novo embarcado
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Total</div>
          <div className="text-2xl font-black mt-1">{resumo.total}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Disponível</div>
          <div className="text-2xl font-black mt-1 text-green-700">{resumo.disponiveis}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Em veículo</div>
          <div className="text-2xl font-black mt-1 text-blue-700">{resumo.emVeiculo}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Manutenção</div>
          <div className="text-2xl font-black mt-1 text-yellow-700">{resumo.manutencao}</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Sucata</div>
          <div className="text-2xl font-black mt-1 text-gray-700">{resumo.sucata}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mt-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div className="xl:col-span-1">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Buscar</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white">
              <FaSearch className="text-gray-400" />
              <input
                className="w-full outline-none text-sm font-semibold"
                placeholder="Número, tipo, veículo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Tipo</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold bg-white"
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
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Status</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold bg-white"
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

      <div className="mt-4 grid grid-cols-1 2xl:grid-cols-2 gap-4">
        {loading ? (
          <div className="bg-white rounded-2xl border shadow-sm p-10 text-center font-black text-gray-500 col-span-full">
            Carregando embarcados...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl border shadow-sm p-10 text-center font-black text-gray-500 col-span-full">
            Nenhum embarcado encontrado.
          </div>
        ) : (
          filtrados.map((item) => {
            const valorAutomatico = getValorAutomatico(item, ultimaManutencaoMap);

            return (
              <div key={item.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow">
                      {tipoIcon(item.tipo)}
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-gray-500 uppercase">{item.tipo}</div>
                      <div className="text-lg font-black text-gray-900">{item.numero_equipamento}</div>
                    </div>
                  </div>

                  <span className={`px-3 py-2 rounded-full text-[11px] font-black uppercase ${statusClass(item.status_atual)}`}>
                    {statusLabel(item.status_atual)}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
                  <div>
                    {item.foto_url ? (
                      <img
                        src={item.foto_url}
                        alt={item.numero_equipamento}
                        className="w-full h-40 object-cover rounded-xl border bg-white"
                      />
                    ) : (
                      <EmptyPhoto />
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border p-3 bg-gray-50">
                      <div className="text-[10px] font-black text-gray-500 uppercase">Status atual</div>
                      <div className="text-sm font-black text-gray-900 mt-1">{statusLabel(item.status_atual)}</div>
                    </div>

                    <div className="rounded-xl border p-3 bg-gray-50">
                      <div className="text-[10px] font-black text-gray-500 uppercase">Valor da localização</div>
                      <div className="text-sm font-black text-gray-900 mt-1">{valorAutomatico}</div>
                    </div>

                    <div className="rounded-xl border p-3 bg-gray-50 md:col-span-2">
                      <div className="text-[10px] font-black text-gray-500 uppercase">Observação</div>
                      <div className="text-sm font-semibold text-gray-800 mt-1 min-h-[42px]">
                        {item.observacao || "Sem observações."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 flex flex-wrap gap-2 justify-end">
                  <button className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-black flex items-center gap-2">
                    <FaExchangeAlt /> Movimentar
                  </button>
                  <button className="px-4 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-black flex items-center gap-2">
                    <FaTools /> Reparo
                  </button>
                  <button
                    onClick={() => {
                      setRegistroEdicao(item);
                      setModalOpen(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-black"
                  >
                    Editar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <EmbarcadoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setRegistroEdicao(null);
        }}
        onSave={salvar}
        saving={saving}
        registro={registroEdicao}
      />
    </div>
  );
}
