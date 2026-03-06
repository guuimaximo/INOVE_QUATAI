// src/pages/Embarcados.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  FaSearch,
  FaPlug,
  FaCamera,
  FaMapMarkerAlt,
  FaMicrochip,
  FaCheckCircle,
  FaExclamationTriangle,
  FaTools,
  FaTimesCircle,
  FaMinusCircle,
  FaEdit,
  FaSave,
  FaTimes,
  FaPlus,
  FaSync,
} from "react-icons/fa";

const TIPOS_FIXOS = [
  { value: "TELEMETRIA", label: "TELEMETRIA", icon: FaMicrochip },
  { value: "CAMERAS", label: "CAMERAS", icon: FaCamera },
  { value: "VISION", label: "VISION", icon: FaPlug },
  { value: "VALIDADOR", label: "VALIDADOR", icon: FaCheckCircle },
  { value: "GPS", label: "GPS", icon: FaMapMarkerAlt },
];

const STATUS_OPCOES = [
  "OK",
  "MANUTENCAO",
  "SEM_COMUNICACAO",
  "AVARIADO",
  "RETIRADO",
  "PENDENTE",
];

function getStatusMeta(status) {
  switch (status) {
    case "OK":
      return {
        label: "OK",
        card: "border-green-200 bg-green-50",
        badge: "bg-green-600 text-white",
        icon: FaCheckCircle,
      };
    case "MANUTENCAO":
      return {
        label: "MANUTENÇÃO",
        card: "border-yellow-200 bg-yellow-50",
        badge: "bg-yellow-500 text-black",
        icon: FaTools,
      };
    case "SEM_COMUNICACAO":
      return {
        label: "SEM COMUNICAÇÃO",
        card: "border-orange-200 bg-orange-50",
        badge: "bg-orange-500 text-white",
        icon: FaExclamationTriangle,
      };
    case "AVARIADO":
      return {
        label: "AVARIADO",
        card: "border-red-200 bg-red-50",
        badge: "bg-red-600 text-white",
        icon: FaTimesCircle,
      };
    case "RETIRADO":
      return {
        label: "RETIRADO",
        card: "border-gray-300 bg-gray-100",
        badge: "bg-gray-700 text-white",
        icon: FaMinusCircle,
      };
    case "PENDENTE":
      return {
        label: "PENDENTE",
        card: "border-blue-200 bg-blue-50",
        badge: "bg-blue-600 text-white",
        icon: FaExclamationTriangle,
      };
    default:
      return {
        label: status || "-",
        card: "border-gray-200 bg-white",
        badge: "bg-gray-500 text-white",
        icon: FaMinusCircle,
      };
  }
}

function EmptyPhoto() {
  return (
    <div className="w-full h-44 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-bold">
      Sem foto
    </div>
  );
}

function EquipamentoModal({
  open,
  onClose,
  onSave,
  saving,
  veiculoSelecionado,
  tipoInicial,
  registro,
}) {
  const [form, setForm] = useState({
    veiculo: "",
    tipo: "TELEMETRIA",
    numero_equipamento: "",
    foto_url: "",
    status_atual: "OK",
    observacao: "",
    ativo: true,
  });

  useEffect(() => {
    if (!open) return;

    if (registro) {
      setForm({
        veiculo: registro.veiculo || veiculoSelecionado || "",
        tipo: registro.tipo || tipoInicial || "TELEMETRIA",
        numero_equipamento: registro.numero_equipamento || "",
        foto_url: registro.foto_url || "",
        status_atual: registro.status_atual || "OK",
        observacao: registro.observacao || "",
        ativo: registro.ativo ?? true,
      });
      return;
    }

    setForm({
      veiculo: veiculoSelecionado || "",
      tipo: tipoInicial || "TELEMETRIA",
      numero_equipamento: "",
      foto_url: "",
      status_atual: "OK",
      observacao: "",
      ativo: true,
    });
  }, [open, registro, veiculoSelecionado, tipoInicial]);

  if (!open) return null;

  const isEdicao = !!registro;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.veiculo) return alert("Selecione um veículo.");
    if (!form.tipo) return alert("Tipo é obrigatório.");
    if (!form.numero_equipamento.trim()) return alert("Número do equipamento é obrigatório.");
    if (!form.status_atual) return alert("Status é obrigatório.");

    await onSave({
      ...form,
      numero_equipamento: form.numero_equipamento.trim(),
      foto_url: form.foto_url.trim(),
      observacao: form.observacao.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">
              {isEdicao ? "Editar embarcado" : "Novo embarcado"}
            </div>
            <div className="text-lg font-black text-gray-900">
              {form.veiculo || "Sem veículo"} {form.tipo ? `- ${form.tipo}` : ""}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100"
            title="Fechar"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
              Veículo
            </label>
            <input
              className="border rounded-lg px-3 py-2 text-sm font-bold bg-gray-100"
              value={form.veiculo}
              disabled
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
              Tipo
            </label>
            <select
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              disabled={!!registro}
            >
              {TIPOS_FIXOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
              Número do equipamento
            </label>
            <input
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.numero_equipamento}
              onChange={(e) =>
                setForm({ ...form, numero_equipamento: e.target.value })
              }
              placeholder="Ex: TEL-001 / DVR-123 / GPS-456"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
              Status atual
            </label>
            <select
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.status_atual}
              onChange={(e) => setForm({ ...form, status_atual: e.target.value })}
            >
              {STATUS_OPCOES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
              URL da foto
            </label>
            <input
              className="border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.foto_url}
              onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <div className="flex flex-col md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
              Observação
            </label>
            <textarea
              className="border rounded-lg px-3 py-2 text-sm font-bold min-h-[90px]"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Detalhes do equipamento..."
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <input
              id="ativo"
              type="checkbox"
              checked={!!form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            <label htmlFor="ativo" className="text-sm font-bold text-gray-700">
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

function CardEquipamento({ item, tipo, onNovo, onEditar }) {
  const IconeTipo = tipo.icon;
  const statusMeta = getStatusMeta(item?.status_atual);
  const StatusIcon = statusMeta.icon;

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${statusMeta.card}`}>
      <div className="px-4 py-4 border-b bg-white/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gray-900 text-white flex items-center justify-center shadow">
            <IconeTipo size={18} />
          </div>
          <div>
            <div className="text-[10px] font-black text-gray-500 uppercase">
              Tipo
            </div>
            <div className="text-base font-black text-gray-900">{tipo.label}</div>
          </div>
        </div>

        <div>
          <span
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-[11px] font-black uppercase ${statusMeta.badge}`}
          >
            <StatusIcon size={12} />
            {statusMeta.label}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {item?.foto_url ? (
          <img
            src={item.foto_url}
            alt={tipo.label}
            className="w-full h-44 object-cover rounded-xl border bg-white"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              const fallback = e.currentTarget.nextSibling;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}

        <div style={{ display: item?.foto_url ? "none" : "flex" }}>
          <EmptyPhoto />
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-white/80 rounded-xl border p-3">
            <div className="text-[10px] font-black text-gray-500 uppercase">
              Número do equipamento
            </div>
            <div className="text-lg font-black text-gray-900 mt-1 break-all">
              {item?.numero_equipamento || "-"}
            </div>
          </div>

          <div className="bg-white/80 rounded-xl border p-3">
            <div className="text-[10px] font-black text-gray-500 uppercase">
              Observação
            </div>
            <div className="text-sm font-semibold text-gray-800 mt-1 min-h-[42px]">
              {item?.observacao || "Sem observações."}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {!item ? (
            <button
              onClick={() => onNovo(tipo.value)}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-black flex items-center gap-2"
            >
              <FaPlus /> Cadastrar
            </button>
          ) : (
            <button
              onClick={() => onEditar(item)}
              className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-black flex items-center gap-2"
            >
              <FaEdit /> Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Embarcados() {
  const [prefixos, setPrefixos] = useState([]);
  const [embarcados, setEmbarcados] = useState([]);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState("");
  const [buscaVeiculo, setBuscaVeiculo] = useState("");

  const [loadingPrefixos, setLoadingPrefixos] = useState(true);
  const [loadingEmbarcados, setLoadingEmbarcados] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tipoNovo, setTipoNovo] = useState("TELEMETRIA");
  const [registroEdicao, setRegistroEdicao] = useState(null);

  async function carregarPrefixos() {
    setLoadingPrefixos(true);
    const { data, error } = await supabase
      .from("prefixos")
      .select("codigo, cluster")
      .order("codigo");

    if (error) {
      console.error(error);
      alert("Erro ao carregar veículos.");
      setPrefixos([]);
    } else {
      setPrefixos(data || []);
    }
    setLoadingPrefixos(false);
  }

  async function carregarEmbarcados(veiculo) {
    if (!veiculo) {
      setEmbarcados([]);
      return;
    }

    setLoadingEmbarcados(true);

    const { data, error } = await supabase
      .from("embarcados_veiculos")
      .select("*")
      .eq("veiculo", veiculo)
      .eq("ativo", true)
      .order("tipo", { ascending: true });

    if (error) {
      console.error(error);
      alert("Erro ao carregar embarcados do veículo.");
      setEmbarcados([]);
    } else {
      setEmbarcados(data || []);
    }

    setLoadingEmbarcados(false);
  }

  useEffect(() => {
    carregarPrefixos();
  }, []);

  useEffect(() => {
    carregarEmbarcados(veiculoSelecionado);
  }, [veiculoSelecionado]);

  const prefixosFiltrados = useMemo(() => {
    const txt = buscaVeiculo.trim().toLowerCase();
    if (!txt) return prefixos;

    return (prefixos || []).filter((p) => {
      const texto = `${p.codigo || ""} ${p.cluster || ""}`.toLowerCase();
      return texto.includes(txt);
    });
  }, [prefixos, buscaVeiculo]);

  const mapaPorTipo = useMemo(() => {
    const map = new Map();
    (embarcados || []).forEach((item) => {
      map.set(item.tipo, item);
    });
    return map;
  }, [embarcados]);

  const resumo = useMemo(() => {
    const total = embarcados.length;
    const ok = embarcados.filter((x) => x.status_atual === "OK").length;
    const pendencias = embarcados.filter((x) => x.status_atual !== "OK").length;
    return { total, ok, pendencias };
  }, [embarcados]);

  async function handleSalvar(payload) {
    try {
      setSaving(true);

      if (registroEdicao?.id) {
        const { error } = await supabase
          .from("embarcados_veiculos")
          .update(payload)
          .eq("id", registroEdicao.id);

        if (error) {
          console.error(error);
          alert(error.message || "Erro ao atualizar embarcado.");
          return;
        }
      } else {
        const { error } = await supabase
          .from("embarcados_veiculos")
          .insert([payload]);

        if (error) {
          console.error(error);
          alert(error.message || "Erro ao cadastrar embarcado.");
          return;
        }
      }

      setModalOpen(false);
      setRegistroEdicao(null);
      await carregarEmbarcados(veiculoSelecionado);
    } finally {
      setSaving(false);
    }
  }

  function abrirNovo(tipo) {
    if (!veiculoSelecionado) {
      alert("Selecione um veículo primeiro.");
      return;
    }
    setRegistroEdicao(null);
    setTipoNovo(tipo);
    setModalOpen(true);
  }

  function abrirEdicao(item) {
    setRegistroEdicao(item);
    setTipoNovo(item?.tipo || "TELEMETRIA");
    setModalOpen(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* CABEÇALHO */}
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">
              Controle
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-gray-900">
              Embarcados
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              Selecione um veículo para visualizar os equipamentos embarcados.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
                Buscar veículo
              </label>
              <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white min-w-[250px]">
                <FaSearch className="text-gray-400" />
                <input
                  className="w-full outline-none text-sm font-semibold"
                  placeholder="Ex: W541"
                  value={buscaVeiculo}
                  onChange={(e) => setBuscaVeiculo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-black text-gray-500 uppercase mb-1">
                Veículo
              </label>
              <select
                className="border rounded-xl px-3 py-2 text-sm font-bold min-w-[280px] bg-white"
                value={veiculoSelecionado}
                onChange={(e) => setVeiculoSelecionado(e.target.value)}
                disabled={loadingPrefixos}
              >
                <option value="">
                  {loadingPrefixos ? "Carregando veículos..." : "Selecione..."}
                </option>
                {prefixosFiltrados.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} {p.cluster ? `- ${p.cluster}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => carregarEmbarcados(veiculoSelecionado)}
              disabled={!veiculoSelecionado || loadingEmbarcados}
              className="h-[42px] px-4 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-black disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <FaSync className={loadingEmbarcados ? "animate-spin" : ""} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      {/* RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">
            Veículo
          </div>
          <div className="text-2xl font-black mt-1 text-gray-900">
            {veiculoSelecionado || "-"}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">
            Itens cadastrados
          </div>
          <div className="text-2xl font-black mt-1 text-gray-900">
            {resumo.total}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">
            OK
          </div>
          <div className="text-2xl font-black mt-1 text-green-600">
            {resumo.ok}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">
            Pendências
          </div>
          <div className="text-2xl font-black mt-1 text-red-600">
            {resumo.pendencias}
          </div>
        </div>
      </div>

      {!veiculoSelecionado ? (
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-10 text-center">
          <div className="text-lg font-black text-gray-800">
            Selecione um veículo para visualizar os embarcados
          </div>
          <div className="text-sm text-gray-500 font-semibold mt-2">
            O filtro de veículo usa a tabela de prefixos.
          </div>
        </div>
      ) : loadingEmbarcados ? (
        <div className="mt-4 bg-white rounded-2xl border shadow-sm p-10 text-center">
          <div className="text-lg font-black text-gray-800">
            Carregando embarcados...
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {TIPOS_FIXOS.map((tipo) => (
            <CardEquipamento
              key={tipo.value}
              tipo={tipo}
              item={mapaPorTipo.get(tipo.value) || null}
              onNovo={abrirNovo}
              onEditar={abrirEdicao}
            />
          ))}
        </div>
      )}

      <EquipamentoModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setRegistroEdicao(null);
        }}
        onSave={handleSalvar}
        saving={saving}
        veiculoSelecionado={veiculoSelecionado}
        tipoInicial={tipoNovo}
        registro={registroEdicao}
      />
    </div>
  );
}
