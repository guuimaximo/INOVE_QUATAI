import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import {
  FaPlus,
  FaSave,
  FaTimes,
  FaSearch,
  FaSync,
  FaWrench,
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

const PRIORIDADES = ["BAIXA", "MEDIA", "ALTA", "CRITICA"];
const STATUS = ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS", "CONCLUIDA", "CANCELADA"];

const BUCKET_FOTOS = "embarcados";

function sanitizeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_");
}

function statusClass(status) {
  switch (status) {
    case "ABERTA":
      return "bg-blue-100 text-blue-700";
    case "EM_ANALISE":
      return "bg-yellow-100 text-yellow-800";
    case "EM_EXECUCAO":
      return "bg-orange-100 text-orange-700";
    case "AG_PECAS":
      return "bg-purple-100 text-purple-700";
    case "CONCLUIDA":
      return "bg-green-100 text-green-700";
    case "CANCELADA":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function prioridadeClass(p) {
  switch (p) {
    case "CRITICA":
      return "bg-red-100 text-red-700";
    case "ALTA":
      return "bg-orange-100 text-orange-700";
    case "MEDIA":
      return "bg-yellow-100 text-yellow-800";
    case "BAIXA":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function EmptyPhoto() {
  return (
    <div className="w-full h-40 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm font-bold">
      Sem foto
    </div>
  );
}

function NovaSolicitacaoModal({ open, onClose, onSave, saving, prefixos }) {
  const [form, setForm] = useState({
    veiculo: "",
    tipo_embarcado: "TELEMETRIA",
    problema: "",
    descricao: "",
    local_problema: "",
    prioridade: "MEDIA",
    solicitante: "",
    foto_url: "",
    status: "ABERTA",
    ativo: true,
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      veiculo: "",
      tipo_embarcado: "TELEMETRIA",
      problema: "",
      descricao: "",
      local_problema: "",
      prioridade: "MEDIA",
      solicitante: "",
      foto_url: "",
      status: "ABERTA",
      ativo: true,
    });
  }, [open]);

  if (!open) return null;

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const nomeLimpo = sanitizeFileName(file.name);
      const ext = nomeLimpo.split(".").pop() || "jpg";
      const baseSemDuplicarExt = nomeLimpo.replace(/\.[^.]+$/, "");
      const filePath = `reparos/solicitacoes/${form.veiculo || "sem_veiculo"}/${Date.now()}_${baseSemDuplicarExt}.${ext}`;

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

    if (!form.veiculo) return alert("Veículo é obrigatório.");
    if (!form.tipo_embarcado) return alert("Tipo do embarcado é obrigatório.");
    if (!form.problema.trim()) return alert("Problema é obrigatório.");
    if (!form.prioridade) return alert("Prioridade é obrigatória.");

    await onSave({
      veiculo: form.veiculo,
      tipo_embarcado: form.tipo_embarcado,
      problema: form.problema.trim(),
      descricao: form.descricao.trim(),
      local_problema: form.local_problema.trim(),
      prioridade: form.prioridade,
      solicitante: form.solicitante.trim(),
      foto_url: form.foto_url.trim(),
      status: "ABERTA",
      ativo: true,
      embarcado_id: null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">Nova solicitação</div>
            <div className="text-lg font-black text-gray-900">Solicitação de reparo</div>
          </div>

          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Veículo</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.veiculo}
              onChange={(e) => setForm({ ...form, veiculo: e.target.value })}
            >
              <option value="">Selecione...</option>
              {prefixos.map((p) => (
                <option key={p.codigo} value={p.codigo}>
                  {p.codigo} {p.cluster ? `- ${p.cluster}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Tipo embarcado</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.tipo_embarcado}
              onChange={(e) => setForm({ ...form, tipo_embarcado: e.target.value })}
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Prioridade</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.prioridade}
              onChange={(e) => setForm({ ...form, prioridade: e.target.value })}
            >
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Solicitante</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.solicitante}
              onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Problema</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.problema}
              onChange={(e) => setForm({ ...form, problema: e.target.value })}
              placeholder="Ex: Sem comunicação / equipamento desligado / câmera sem imagem"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Local do problema</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.local_problema}
              onChange={(e) => setForm({ ...form, local_problema: e.target.value })}
              placeholder="Ex: Painel frontal / teto / traseira"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Descrição</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[90px]"
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Foto</label>

            <div className="flex flex-col gap-3">
              {form.foto_url ? (
                <img
                  src={form.foto_url}
                  alt="Evidência"
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
                  <FaUpload />
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
              <FaSave /> {saving ? "Salvando..." : "Salvar solicitação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExecucaoModal({ open, onClose, solicitacao, onSave, saving }) {
  const [form, setForm] = useState({
    status_evento: "EM_ANALISE",
    acao_executada: "",
    diagnostico: "",
    observacao: "",
    executado_por: "",
    foto_url: "",
  });

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      status_evento: solicitacao?.status || "EM_ANALISE",
      acao_executada: "",
      diagnostico: "",
      observacao: "",
      executado_por: "",
      foto_url: "",
    });
  }, [open, solicitacao]);

  if (!open || !solicitacao) return null;

  async function handleUploadFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      const nomeLimpo = sanitizeFileName(file.name);
      const ext = nomeLimpo.split(".").pop() || "jpg";
      const baseSemDuplicarExt = nomeLimpo.replace(/\.[^.]+$/, "");
      const filePath = `reparos/execucao/${solicitacao.id}/${Date.now()}_${baseSemDuplicarExt}.${ext}`;

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

    if (!form.status_evento) return alert("Status é obrigatório.");

    await onSave({
      ...form,
      acao_executada: form.acao_executada.trim(),
      diagnostico: form.diagnostico.trim(),
      observacao: form.observacao.trim(),
      executado_por: form.executado_por.trim(),
      foto_url: form.foto_url.trim(),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs font-black text-gray-500 uppercase">Execução</div>
            <div className="text-lg font-black text-gray-900">
              {solicitacao.tipo_embarcado} • {solicitacao.problema}
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <FaTimes />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Novo status</label>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.status_evento}
              onChange={(e) => setForm({ ...form, status_evento: e.target.value })}
            >
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Executado por</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold"
              value={form.executado_por}
              onChange={(e) => setForm({ ...form, executado_por: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Diagnóstico</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[80px]"
              value={form.diagnostico}
              onChange={(e) => setForm({ ...form, diagnostico: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Ação executada</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[80px]"
              value={form.acao_executada}
              onChange={(e) => setForm({ ...form, acao_executada: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Observação</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm font-bold min-h-[80px]"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Evidência</label>

            <div className="flex flex-col gap-3">
              {form.foto_url ? (
                <img
                  src={form.foto_url}
                  alt="Evidência"
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
                  <FaUpload />
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
              <FaSave /> {saving ? "Salvando..." : "Salvar execução"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmbarcadosReparos() {
  const [rows, setRows] = useState([]);
  const [prefixos, setPrefixos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("");

  const [novaOpen, setNovaOpen] = useState(false);
  const [execOpen, setExecOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [solicitacaoAtual, setSolicitacaoAtual] = useState(null);

  async function carregar() {
    setLoading(true);

    const [r1, r2] = await Promise.all([
      supabase.from("embarcados_solicitacoes_reparo").select("*").order("created_at", { ascending: false }),
      supabase.from("prefixos").select("codigo, cluster").order("codigo"),
    ]);

    if (r1.error) console.error(r1.error);
    if (r2.error) console.error(r2.error);

    setRows(r1.data || []);
    setPrefixos(r2.data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtrados = useMemo(() => {
    const txt = busca.trim().toLowerCase();

    return rows.filter((r) => {
      if (filtroStatus && r.status !== filtroStatus) return false;
      if (filtroPrioridade && r.prioridade !== filtroPrioridade) return false;

      if (!txt) return true;

      const blob = [
        r.veiculo,
        r.tipo_embarcado,
        r.problema,
        r.descricao,
        r.local_problema,
        r.prioridade,
        r.status,
        r.solicitante,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(txt);
    });
  }, [rows, busca, filtroStatus, filtroPrioridade]);

  const resumo = useMemo(() => {
    const total = filtrados.length;
    const abertas = filtrados.filter((x) => ["ABERTA", "EM_ANALISE", "EM_EXECUCAO", "AG_PECAS"].includes(x.status)).length;
    const concluidas = filtrados.filter((x) => x.status === "CONCLUIDA").length;
    const criticas = filtrados.filter((x) => x.prioridade === "CRITICA").length;
    return { total, abertas, concluidas, criticas };
  }, [filtrados]);

  async function salvarSolicitacao(payload) {
    try {
      setSaving(true);

      const { error } = await supabase.from("embarcados_solicitacoes_reparo").insert([payload]);
      if (error) {
        console.error(error);
        alert(error.message || "Erro ao salvar solicitação.");
        return;
      }

      setNovaOpen(false);
      await carregar();
    } finally {
      setSaving(false);
    }
  }

  async function salvarExecucao(payload) {
    if (!solicitacaoAtual?.id) return;

    try {
      setSaving(true);

      const { error: evError } = await supabase.from("embarcados_solicitacoes_reparo_eventos").insert([
        {
          solicitacao_id: solicitacaoAtual.id,
          status_evento: payload.status_evento,
          acao_executada: payload.acao_executada || null,
          diagnostico: payload.diagnostico || null,
          observacao: payload.observacao || null,
          executado_por: payload.executado_por || null,
          foto_url: payload.foto_url || null,
        },
      ]);

      if (evError) {
        console.error(evError);
        alert(evError.message || "Erro ao salvar evento.");
        return;
      }

      const updatePayload = {
        status: payload.status_evento,
        observacao_execucao: payload.observacao || null,
        executado_por: payload.executado_por || null,
        data_execucao: new Date().toISOString(),
      };

      if (payload.status_evento === "CONCLUIDA" || payload.status_evento === "CANCELADA") {
        updatePayload.data_fechamento = new Date().toISOString();
      }

      const { error: upError } = await supabase
        .from("embarcados_solicitacoes_reparo")
        .update(updatePayload)
        .eq("id", solicitacaoAtual.id);

      if (upError) {
        console.error(upError);
        alert(upError.message || "Erro ao atualizar solicitação.");
        return;
      }

      setExecOpen(false);
      setSolicitacaoAtual(null);
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
              Reparos de Embarcados
            </h1>
            <p className="text-sm text-gray-500 font-semibold mt-1">
              Abertura por veículo e controle da execução do serviço.
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
              onClick={() => setNovaOpen(true)}
              className="h-[42px] px-4 rounded-xl bg-green-600 text-white font-black text-sm hover:bg-green-500 flex items-center gap-2"
            >
              <FaPlus /> Nova solicitação
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
          <div className="text-[10px] font-black text-gray-500 uppercase">Abertas</div>
          <div className="text-2xl font-black mt-1 text-blue-700">{resumo.abertas}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Concluídas</div>
          <div className="text-2xl font-black mt-1 text-green-700">{resumo.concluidas}</div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-4">
          <div className="text-[10px] font-black text-gray-500 uppercase">Críticas</div>
          <div className="text-2xl font-black mt-1 text-red-700">{resumo.criticas}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-4 mt-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Buscar</label>
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 bg-white">
              <FaSearch className="text-gray-400" />
              <input
                className="w-full outline-none text-sm font-semibold"
                placeholder="Veículo, problema, solicitante..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Status</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-500 uppercase mb-1 block">Prioridade</label>
            <select
              className="w-full border rounded-xl px-3 py-2 text-sm font-bold"
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
            >
              <option value="">Todas</option>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 text-[10px] uppercase text-gray-600 border-b font-black">
                <th className="p-3 border-r whitespace-nowrap">Criado em</th>
                <th className="p-3 border-r whitespace-nowrap">Veículo</th>
                <th className="p-3 border-r whitespace-nowrap">Tipo</th>
                <th className="p-3 border-r whitespace-nowrap">Problema</th>
                <th className="p-3 border-r whitespace-nowrap">Prioridade</th>
                <th className="p-3 border-r whitespace-nowrap">Status</th>
                <th className="p-3 border-r whitespace-nowrap">Solicitante</th>
                <th className="p-3 text-center whitespace-nowrap">Ações</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 font-black">
                    Carregando solicitações...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 font-black">
                    Nenhuma solicitação encontrada.
                  </td>
                </tr>
              ) : (
                filtrados.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3 border-r font-semibold whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3 border-r font-black">{r.veiculo || "-"}</td>
                    <td className="p-3 border-r font-black">{r.tipo_embarcado}</td>
                    <td className="p-3 border-r font-semibold">{r.problema}</td>
                    <td className="p-3 border-r">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase ${prioridadeClass(r.prioridade)}`}>
                        {r.prioridade}
                      </span>
                    </td>
                    <td className="p-3 border-r">
                      <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase ${statusClass(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 border-r font-semibold">{r.solicitante || "-"}</td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setSolicitacaoAtual(r);
                            setExecOpen(true);
                          }}
                          className="px-3 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-black flex items-center gap-2"
                        >
                          <FaWrench /> Executar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NovaSolicitacaoModal
        open={novaOpen}
        onClose={() => setNovaOpen(false)}
        onSave={salvarSolicitacao}
        saving={saving}
        prefixos={prefixos}
      />

      <ExecucaoModal
        open={execOpen}
        onClose={() => {
          setExecOpen(false);
          setSolicitacaoAtual(null);
        }}
        solicitacao={solicitacaoAtual}
        onSave={salvarExecucao}
        saving={saving}
      />
    </div>
  );
}
