import { useEffect, useMemo, useState } from "react";
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
  FaExclamationTriangle,
} from "react-icons/fa";

const TIPOS = [
  "TELEMETRIA",
  "CAMERAS",
  "VISION",
  "VALIDADOR",
  "CHIP_VALIDADOR",
  "GPS",
];

const STATUS = [
  "DISPONIVEL",
  "INSTALADO",
  "RESERVA",
  "MANUTENCAO",
  "AVARIADO",
  "DESCONECTADO",
  "BAIXADO",
];

const LOCALIZACOES = [
  "VEICULO",
  "ESTOQUE",
  "RESERVA",
  "MANUTENCAO",
  "EXTERNO",
  "DESCONHECIDO",
];

function statusClass(status) {
  switch (status) {
    case "DISPONIVEL":
      return "bg-green-100 text-green-700";
    case "INSTALADO":
      return "bg-blue-100 text-blue-700";
    case "RESERVA":
      return "bg-purple-100 text-purple-700";
    case "MANUTENCAO":
      return "bg-yellow-100 text-yellow-800";
    case "AVARIADO":
      return "bg-red-100 text-red-700";
    case "DESCONECTADO":
      return "bg-orange-100 text-orange-700";
    case "BAIXADO":
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

function EmbarcadoModal({ open, onClose, onSave, saving, registro }) {
  const [form, setForm] = useState({
    tipo: "TELEMETRIA",
    numero_equipamento: "",
    modelo: "",
    fabricante: "",
    foto_url: "",
    status_atual: "DISPONIVEL",
    localizacao_tipo: "ESTOQUE",
    localizacao_valor: "",
    observacao: "",
    ativo: true,
  });

  useEffect(() => {
    if (!open) return;

    if (registro) {
      setForm({
        tipo: registro.tipo || "TELEMETRIA",
        numero_equipamento: registro.numero_equipamento || "",
        modelo: registro.modelo || "",
        fabricante: registro.fabricante || "",
        foto_url: registro.foto_url || "",
        status_atual: registro.status_atual || "DISPONIVEL",
        localizacao_tipo: registro.localizacao_tipo || "ESTOQUE",
        localizacao_valor: registro.localizacao_valor || "",
        observacao: registro.observacao || "",
        ativo: registro.ativo ?? true,
      });
      return;
    }

    setForm({
      tipo: "TELEMETRIA",
      numero_equipamento: "",
      modelo: "",
      fabricante: "",
      foto_url: "",
      status_atual: "DISPONIVEL",
      localizacao_tipo: "ESTOQUE",
      localizacao_valor: "",
      observacao: "",
      ativo: true,
    });
  }, [open, registro]);

  if (!open) return null;

  async function submit(e) {
    e.preventDefault();
    if (!form.tipo) return alert("Tipo é obrigatório.");
    if (!form.numero_equipamento.trim()) return alert("Número do equipamento é obrigatório.");

    await onSave({
      ...form,
      numero_equipamento: form.numero_equipamento.trim(),
      modelo: form.modelo.trim(),
      fabricante: form.fabricante.trim(),
      foto_url: form.foto_url.trim(),
      localizacao_valor: form.localizacao_valor.trim(),
      observacao: form.observacao.trim(),
    });
  }

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
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Modelo</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.modelo}
              onChange={(e) => setForm({ ...form, modelo: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Fabricante</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.fabricante}
              onChange={(e) => setForm({ ...form, fabricante: e.target.value })}
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Status atual</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.status_atual}
              onChange={(e) => setForm({ ...form, status_atual: e.target.value })}
            >
              {STATUS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Localização</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.localizacao_tipo}
              onChange={(e) => setForm({ ...form, localizacao_tipo: e.target.value })}
            >
              {LOCALIZACOES.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">
              Valor da localização
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.localizacao_valor}
              onChange={(e) => setForm({ ...form, localizacao_valor: e.target.value })}
              placeholder="Ex: W541 / Estoque Central / Oficina / Terceiro"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">URL da foto</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.foto_url}
              onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
              placeholder="https://..."
            />
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
              disabled={saving}
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
  const [filtroLocalizacao, setFiltroLocalizacao] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registroEdicao, setRegistroEdicao] = useState(null);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("v_embarcados_central")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      alert("Erro ao carregar embarcados.");
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
      if (filtroTipo && r.tipo !== filtroTipo) return false;
      if (filtroStatus && r.status_atual !== filtroStatus) return false;
      if (filtroLocalizacao && r.localizacao_tipo !== filtroLocalizacao) return false;

      if (!txt) return true;

      const blob = [
        r.tipo,
        r.numero_equipamento,
        r.modelo,
        r.fabricante,
        r.status_atual,
        r.localizacao_tipo,
        r.localizacao_valor,
        r.veiculo,
        r.observacao,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(txt);
    });
  }, [rows, busca, filtroTipo, filtroStatus, filtroLocalizacao]);

  const resumo = useMemo(() => {
    const total = filtrados.length;
    const instalados = filtrados.filter((x) => x.status_atual === "INSTALADO").length;
    const reserva = filtrados.filter((x) => x.localizacao_tipo === "RESERVA").length;
    const manutencao = filtrados.filter((x) => x.status_atual === "MANUTENCAO").length;
    return { total, instalados, reserva, manutencao };
  }, [filtrados]);

  async function salvar(payload) {
    try {
      setSaving(true);

      if (registroEdicao?.id) {
        const { error } = await supabase.from("embarcados").update(payload).eq("id", registroEdicao.id);
        if (error) {
          console.error(error);
          alert(error.message || "Erro ao atualizar embarcado.");
          return;
        }
      } else {
        const { error } = await supabase.from("embarcados").insert([payload]);
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
              Cadastro mestre, status atual, localização e vínculo do ativo.
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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Total</div>
          <div className="text-2xl font-black mt-1">{resumo.total}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Instalados</div>
          <div className="text-2xl font-black mt-1 text-blue-700">{resumo.instalados}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Reserva</div>
          <div className="text-2xl font-black mt-1 text-purple-700">{resumo.reserva}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Manutenção</div>
          <div className="text-2xl font-black mt-1 text-yellow-700">{resumo.manutencao}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mt-4">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="xl:col-span-1">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Buscar</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white">
              <FaSearch className="text-gray-400" />
              <input
                className="w-full outline-none text-sm font-semibold"
                placeholder="Número, modelo, veículo..."
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
              {STATUS.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Localização</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold bg-white"
              value={filtroLocalizacao}
              onChange={(e) => setFiltroLocalizacao(e.target.value)}
            >
              <option value="">Todas</option>
              {LOCALIZACOES.map((x) => (
                <option key={x} value={x}>
                  {x}
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
          filtrados.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <div className="p-4 border-b flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow">
                    {tipoIcon(item.tipo)}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-gray-500 uppercase">{item.tipo}</div>
                    <div className="text-lg font-black text-gray-900">{item.numero_equipamento}</div>
                    <div className="text-xs text-gray-500 font-semibold">
                      {item.modelo || "-"} {item.fabricante ? `• ${item.fabricante}` : ""}
                    </div>
                  </div>
                </div>

                <span className={`px-3 py-2 rounded-full text-[11px] font-black uppercase ${statusClass(item.status_atual)}`}>
                  {item.status_atual}
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
                    <div className="text-[10px] font-black text-gray-500 uppercase">Localização</div>
                    <div className="text-sm font-black text-gray-900 mt-1">{item.localizacao_tipo || "-"}</div>
                    <div className="text-xs font-semibold text-gray-500 mt-1">{item.localizacao_valor || "-"}</div>
                  </div>

                  <div className="rounded-xl border p-3 bg-gray-50">
                    <div className="text-[10px] font-black text-gray-500 uppercase">Veículo atual</div>
                    <div className="text-sm font-black text-gray-900 mt-1">{item.veiculo || "-"}</div>
                    <div className="text-xs font-semibold text-gray-500 mt-1">
                      {item.data_instalacao ? new Date(item.data_instalacao).toLocaleString("pt-BR") : "Sem instalação ativa"}
                    </div>
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
          ))
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
