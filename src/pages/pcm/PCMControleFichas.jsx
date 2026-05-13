import { useContext, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes,
  FaTimesCircle,
  FaTrashAlt,
  FaUserCheck,
  FaUserTie,
} from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";

const TAB_LANCAMENTO = "lancamento";
const TAB_SUPERVISOR = "supervisor";
const TAB_PCM = "pcm";

const STATUS_AGUARDANDO_SUPERVISOR = "AGUARDANDO_SUPERVISOR";
const STATUS_AGUARDANDO_PCM = "AGUARDANDO_PCM";
const STATUS_AGUARDANDO_TRANSNET = "AGUARDANDO_TRANSNET";
const STATUS_CONCLUIDO = "CONCLUIDO";
const STATUS_RECUSADO_SUPERVISOR = "RECUSADO_SUPERVISOR";
const STATUS_RECUSADO_PCM = "RECUSADO_PCM";

const STATUS_LABELS = {
  [STATUS_AGUARDANDO_SUPERVISOR]: "Aguardando supervisor",
  [STATUS_AGUARDANDO_PCM]: "Aguardando PCM",
  [STATUS_AGUARDANDO_TRANSNET]: "Aguardando lancamento no Transnet",
  [STATUS_CONCLUIDO]: "Concluido",
  [STATUS_RECUSADO_SUPERVISOR]: "Recusado pelo supervisor",
  [STATUS_RECUSADO_PCM]: "Recusado pelo PCM",
};

const STATUS_COLORS = {
  [STATUS_AGUARDANDO_SUPERVISOR]: "bg-amber-100 text-amber-800 border-amber-200",
  [STATUS_AGUARDANDO_PCM]: "bg-blue-100 text-blue-800 border-blue-200",
  [STATUS_AGUARDANDO_TRANSNET]: "bg-purple-100 text-purple-800 border-purple-200",
  [STATUS_CONCLUIDO]: "bg-emerald-100 text-emerald-800 border-emerald-200",
  [STATUS_RECUSADO_SUPERVISOR]: "bg-rose-100 text-rose-800 border-rose-200",
  [STATUS_RECUSADO_PCM]: "bg-rose-100 text-rose-800 border-rose-200",
};

const BUCKET = "pcm_controle_fichas";

const isNativeShell = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

function createUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowDisplay() {
  return new Date().toLocaleString("pt-BR");
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return String(value);
  }
}

function safeText(value) {
  return (value || "").toString().trim();
}

function sanitizeFileName(name) {
  if (!name) return "foto.jpg";
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function buildNextFicha(rows) {
  const prefix = "CF";
  const maxNumber = (rows || []).reduce((acc, row) => {
    const match = /CF-(\d+)/.exec(row.ficha_controle || "");
    if (match) return Math.max(acc, Number(match[1]));
    return acc;
  }, 0);
  return `${prefix}-${String(maxNumber + 1).padStart(4, "0")}`;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function captureNativePhoto(fileNamePrefix) {
  const permissions = await Camera.checkPermissions();
  const has = permissions.camera === "granted" || permissions.camera === "limited";
  if (!has) {
    const req = await Camera.requestPermissions({ permissions: ["camera"] });
    const granted = req.camera === "granted" || req.camera === "limited";
    if (!granted) throw new Error("Permissao da camera negada.");
  }
  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Base64,
    quality: 80,
    promptLabelHeader: "Foto da ficha",
    promptLabelPhoto: "Galeria",
    promptLabelPicture: "Camera",
  });
  if (!photo?.base64String) return null;
  const ext = photo.format || "jpg";
  const mime = photo.format ? `image/${photo.format}` : "image/jpeg";
  const bytes = base64ToUint8Array(photo.base64String);
  return new File([bytes], `${fileNamePrefix}.${ext}`, { type: mime });
}

async function uploadFoto(loteId, itemId, file) {
  if (!file) return { path: null, url: null };
  const path = `controle/${loteId}/ficha_${itemId}_${Date.now()}_${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, url: data?.publicUrl || "" };
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        STATUS_COLORS[status] || "bg-slate-100 text-slate-700 border-slate-200"
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function ModalShell({ title, subtitle, onClose, footer, children, maxWidth = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            {subtitle ? (
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{subtitle}</div>
            ) : null}
            <div className="mt-0.5 text-lg font-black text-slate-900">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <FaTimes />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ReadOnly({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-800">{value || "-"}</div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white shadow"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
      }`}
    >
      {icon}
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          className={`ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
            active ? "bg-white text-blue-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function PhotoField({ title, file, imageUrl = "", inputId, onChange, onNativeCapture }) {
  const [previewUrl, setPreviewUrl] = useState(imageUrl || "");
  useEffect(() => {
    if (!file) {
      setPreviewUrl(imageUrl || "");
      return undefined;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file, imageUrl]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {title ? <div className="text-sm font-semibold text-slate-900">{title}</div> : null}
      <div className="mt-1 text-xs text-slate-500">Ao tocar em inserir foto, a camera abre no celular.</div>
      <div className="mt-3 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white">
        {previewUrl ? (
          <img src={previewUrl} alt={title || "Foto"} className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
            <FaCamera className="text-xl" />
            <span className="text-sm font-medium">Nenhuma foto adicionada</span>
          </div>
        )}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => {
          if (isNativeShell && onNativeCapture) {
            void onNativeCapture();
            return;
          }
          document.getElementById(inputId)?.click();
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <FaCamera />
        Inserir foto
      </button>
    </div>
  );
}

function createItem() {
  return {
    id: createUuid(),
    numeroFicha: "",
    foto: null,
  };
}

export default function PCMControleFichas() {
  const { user } = useContext(AuthContext) || {};
  const userName = safeText(user?.nome) || safeText(user?.login) || "Usuario";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(TAB_LANCAMENTO);
  const [filtro, setFiltro] = useState("");

  const [lancamentoOpen, setLancamentoOpen] = useState(false);
  const [lancamentoForm, setLancamentoForm] = useState(() => ({
    ficha: "",
    dataEntrega: nowDisplay(),
    quemEntregou: userName,
    numeroOS: "",
    observacoes: "",
    itens: [createItem()],
  }));
  const [saving, setSaving] = useState(false);

  const [acaoModal, setAcaoModal] = useState(null);
  const [acaoNome, setAcaoNome] = useState("");
  const [acaoMotivo, setAcaoMotivo] = useState("");
  const [acaoSaving, setAcaoSaving] = useState(false);

  const [consultaOpen, setConsultaOpen] = useState(false);
  const [consultaRow, setConsultaRow] = useState(null);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pcm_controle_fichas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      alert("Nao foi possivel carregar o controle de fichas.");
    } else {
      setRows(data || []);
    }
    setLoading(false);
    return data || [];
  }

  useEffect(() => {
    carregar();
  }, []);

  const supervisorPendentes = useMemo(
    () => rows.filter((r) => r.status === STATUS_AGUARDANDO_SUPERVISOR),
    [rows]
  );
  const pcmPendentes = useMemo(
    () =>
      rows.filter(
        (r) => r.status === STATUS_AGUARDANDO_PCM || r.status === STATUS_AGUARDANDO_TRANSNET
      ),
    [rows]
  );

  function abrirLancamento() {
    setLancamentoForm({
      ficha: buildNextFicha(rows),
      dataEntrega: nowDisplay(),
      quemEntregou: userName,
      numeroOS: "",
      observacoes: "",
      itens: [createItem()],
    });
    setLancamentoOpen(true);
  }

  function setField(field, value) {
    setLancamentoForm((current) => ({ ...current, [field]: value }));
  }

  function setItem(itemId, patch) {
    setLancamentoForm((current) => ({
      ...current,
      itens: current.itens.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
    }));
  }

  function addItem() {
    setLancamentoForm((current) => ({ ...current, itens: [...current.itens, createItem()] }));
  }

  function removeItem(itemId) {
    setLancamentoForm((current) => {
      const filtered = current.itens.filter((it) => it.id !== itemId);
      return { ...current, itens: filtered.length ? filtered : [createItem()] };
    });
  }

  async function capturarItemFoto(itemId) {
    try {
      const file = await captureNativePhoto(`ficha_${itemId}`);
      if (file) setItem(itemId, { foto: file });
    } catch (error) {
      alert(error?.message || "Nao foi possivel abrir a camera.");
    }
  }

  async function salvarLancamento() {
    const numeroOS = safeText(lancamentoForm.numeroOS);
    if (!numeroOS) {
      alert("Informe o numero da OS.");
      return;
    }
    const itens = lancamentoForm.itens.filter((it) => it.foto || safeText(it.numeroFicha));
    if (!itens.length) {
      alert("Adicione pelo menos uma ficha com foto.");
      return;
    }
    const semFoto = itens.findIndex((it) => !it.foto);
    if (semFoto >= 0) {
      alert(`A foto da ficha ${semFoto + 1} e obrigatoria.`);
      return;
    }

    const id = createUuid();
    setSaving(true);
    try {
      const itensSalvos = [];
      for (const it of itens) {
        const uploaded = await uploadFoto(id, it.id, it.foto);
        itensSalvos.push({
          id: it.id,
          numero_ficha: safeText(it.numeroFicha) || null,
          foto_path: uploaded.path,
          foto_url: uploaded.url,
        });
      }
      const ficha = lancamentoForm.ficha || buildNextFicha(rows);
      const { error } = await supabase.from("pcm_controle_fichas").insert([
        {
          id,
          ficha_controle: ficha,
          numero_os: numeroOS,
          data_entrega: new Date().toISOString(),
          quantidade_fichas: itensSalvos.length,
          itens: itensSalvos,
          observacoes: safeText(lancamentoForm.observacoes) || null,
          status: STATUS_AGUARDANDO_SUPERVISOR,
          criado_por_login: safeText(user?.login || user?.email),
          criado_por_nome: safeText(user?.nome),
          criado_por_id: safeText(user?.auth_user_id || user?.id),
          origem: isNativeShell ? "INOVE_MOBILE_APP" : "INOVE_WEB_APP",
        },
      ]);
      if (error) throw error;
      setLancamentoOpen(false);
      await carregar();
      alert("Lote registrado e entregue ao supervisor.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar o lancamento.");
    } finally {
      setSaving(false);
    }
  }

  function abrirAcao(row, tipo) {
    setAcaoModal({ row, tipo });
    setAcaoNome(userName);
    setAcaoMotivo("");
  }

  async function confirmarAcao() {
    if (!acaoModal) return;
    const nome = userName;
    const { row, tipo } = acaoModal;
    const ehRecusa = tipo.endsWith("_recusar");
    const motivo = safeText(acaoMotivo);
    if (ehRecusa && !motivo) {
      alert("Informe o motivo da recusa.");
      return;
    }
    const agora = new Date().toISOString();
    let update = null;
    if (tipo === "supervisor_receber") {
      update = {
        supervisor_nome: nome,
        supervisor_recebido_em: agora,
        status: STATUS_AGUARDANDO_PCM,
      };
    } else if (tipo === "supervisor_recusar") {
      update = {
        supervisor_nome: nome,
        supervisor_recusado_em: agora,
        supervisor_recusa_motivo: motivo,
        status: STATUS_RECUSADO_SUPERVISOR,
      };
    } else if (tipo === "pcm_receber") {
      update = {
        pcm_nome: nome,
        pcm_recebido_em: agora,
        status: STATUS_AGUARDANDO_TRANSNET,
      };
    } else if (tipo === "pcm_recusar") {
      update = {
        pcm_nome: nome,
        pcm_recusado_em: agora,
        pcm_recusa_motivo: motivo,
        status: STATUS_RECUSADO_PCM,
      };
    } else if (tipo === "transnet") {
      update = {
        transnet_lancado_em: agora,
        transnet_lancado_por_nome: nome,
        status: STATUS_CONCLUIDO,
      };
    }
    if (!update) return;
    setAcaoSaving(true);
    try {
      const { error } = await supabase
        .from("pcm_controle_fichas")
        .update({ ...update, updated_at: agora })
        .eq("id", row.id);
      if (error) throw error;
      setAcaoModal(null);
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel confirmar a acao.");
    } finally {
      setAcaoSaving(false);
    }
  }

  function abrirConsulta(row) {
    setConsultaRow(row);
    setConsultaOpen(true);
  }

  const linhasFiltradas = useMemo(() => {
    const termo = filtro.toLowerCase();
    let base;
    if (activeTab === TAB_LANCAMENTO) base = rows;
    else if (activeTab === TAB_SUPERVISOR) base = supervisorPendentes;
    else base = pcmPendentes;
    if (!termo) return base;
    return base.filter((r) =>
      [r.ficha_controle, r.numero_os, r.criado_por_nome, r.supervisor_nome, r.pcm_nome]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(termo))
    );
  }, [activeTab, rows, supervisorPendentes, pcmPendentes, filtro]);

  const acaoLabels = {
    supervisor_receber: { title: "Supervisor recebeu as fichas", nome: "Nome do supervisor", cor: "bg-emerald-600 hover:bg-emerald-700" },
    supervisor_recusar: { title: "Supervisor recusou o lote", nome: "Nome do supervisor", cor: "bg-rose-600 hover:bg-rose-700" },
    pcm_receber: { title: "PCM recebeu as fichas", nome: "Nome do PCM", cor: "bg-emerald-600 hover:bg-emerald-700" },
    pcm_recusar: { title: "PCM recusou o lote", nome: "Nome do PCM", cor: "bg-rose-600 hover:bg-rose-700" },
    transnet: { title: "Lancamento no Transnet", nome: "Quem lancou no Transnet", cor: "bg-emerald-600 hover:bg-emerald-700" },
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">PCM · Controle</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Controle de fichas</h1>
          <p className="text-sm text-slate-500">
            Cada lote tem uma OS e varias fichas, cada ficha com sua foto. O supervisor recebe (ou recusa) e o PCM faz o mesmo antes de lancar no Transnet.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirLancamento}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
        >
          <FaPlus />
          Lancar entrega
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <TabButton
          active={activeTab === TAB_LANCAMENTO}
          onClick={() => setActiveTab(TAB_LANCAMENTO)}
          icon={<FaClipboardList />}
        >
          Lancamento
        </TabButton>
        <TabButton
          active={activeTab === TAB_SUPERVISOR}
          onClick={() => setActiveTab(TAB_SUPERVISOR)}
          icon={<FaUserTie />}
          count={supervisorPendentes.length}
        >
          Supervisor
        </TabButton>
        <TabButton
          active={activeTab === TAB_PCM}
          onClick={() => setActiveTab(TAB_PCM)}
          icon={<FaUserCheck />}
          count={pcmPendentes.length}
        >
          PCM
        </TabButton>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por ficha, OS ou nome..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">OS</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Quem entregou</th>
                <th className="px-4 py-3">Fichas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : linhasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                    Nenhum lancamento encontrado.
                  </td>
                </tr>
              ) : (
                linhasFiltradas.map((row) => {
                  const totalFichas = Array.isArray(row.itens) ? row.itens.length : (row.quantidade_fichas || 0);
                  return (
                    <tr
                      key={row.id}
                      onClick={() => abrirConsulta(row)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-4 py-3 font-bold text-blue-700">{row.ficha_controle}</td>
                      <td className="px-4 py-3 text-slate-700">{row.numero_os}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.data_entrega || row.created_at)}</td>
                      <td className="px-4 py-3 text-slate-600">{row.criado_por_nome || row.criado_por_login || "-"}</td>
                      <td className="px-4 py-3 text-slate-600">{totalFichas}</td>
                      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          {activeTab === TAB_SUPERVISOR && row.status === STATUS_AGUARDANDO_SUPERVISOR ? (
                            <>
                              <button
                                type="button"
                                onClick={() => abrirAcao(row, "supervisor_receber")}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                Recebeu
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirAcao(row, "supervisor_recusar")}
                                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
                              >
                                Recusar
                              </button>
                            </>
                          ) : null}
                          {activeTab === TAB_PCM && row.status === STATUS_AGUARDANDO_PCM ? (
                            <>
                              <button
                                type="button"
                                onClick={() => abrirAcao(row, "pcm_receber")}
                                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                              >
                                Recebeu
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirAcao(row, "pcm_recusar")}
                                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
                              >
                                Recusar
                              </button>
                            </>
                          ) : null}
                          {activeTab === TAB_PCM && row.status === STATUS_AGUARDANDO_TRANSNET ? (
                            <button
                              type="button"
                              onClick={() => abrirAcao(row, "transnet")}
                              className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700"
                            >
                              Lancado no Transnet
                            </button>
                          ) : null}
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

      {lancamentoOpen ? (
        <ModalShell
          title="Lancar entrega de fichas"
          subtitle="PCM · Controle"
          maxWidth="max-w-4xl"
          onClose={() => setLancamentoOpen(false)}
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setLancamentoOpen(false)}
                className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarLancamento}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <FaSave />
                {saving ? "Salvando..." : "Entregar ao supervisor"}
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnly label="Numero do lote" value={lancamentoForm.ficha} />
              <ReadOnly label="Data" value={lancamentoForm.dataEntrega} />
              <ReadOnly label="Quem esta entregando" value={lancamentoForm.quemEntregou} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Numero da OS">
                <input
                  type="text"
                  value={lancamentoForm.numeroOS}
                  onChange={(e) => setField("numeroOS", e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </Field>
              <Field label="Observacoes (opcional)">
                <input
                  type="text"
                  value={lancamentoForm.observacoes}
                  onChange={(e) => setField("observacoes", e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-black uppercase tracking-wide text-slate-700">
                  Fichas do lote ({lancamentoForm.itens.length})
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <FaPlus /> Adicionar ficha
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {lancamentoForm.itens.map((it, idx) => (
                  <div key={it.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold text-slate-800">Ficha {idx + 1}</div>
                      {lancamentoForm.itens.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeItem(it.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-100 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-200"
                        >
                          <FaTrashAlt /> Remover
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field label="Numero da ficha (opcional)">
                        <input
                          type="text"
                          value={it.numeroFicha}
                          onChange={(e) => setItem(it.id, { numeroFicha: e.target.value })}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                        />
                      </Field>
                      <PhotoField
                        title="Foto da ficha"
                        file={it.foto}
                        inputId={`controle-ficha-foto-${it.id}`}
                        onChange={(event) => setItem(it.id, { foto: event.target.files?.[0] || null })}
                        onNativeCapture={() => capturarItemFoto(it.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalShell>
      ) : null}

      {acaoModal ? (
        <ModalShell
          title={acaoLabels[acaoModal.tipo].title}
          subtitle={`Lote ${acaoModal.row.ficha_controle} · OS ${acaoModal.row.numero_os}`}
          onClose={() => setAcaoModal(null)}
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAcaoModal(null)}
                className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAcao}
                disabled={acaoSaving}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 ${acaoLabels[acaoModal.tipo].cor}`}
              >
                {acaoModal.tipo.endsWith("_recusar") ? <FaTimesCircle /> : <FaCheckCircle />}
                {acaoSaving ? "Gravando..." : "Confirmar"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                {acaoLabels[acaoModal.tipo].nome}
              </div>
              <div className="mt-1 text-base font-bold text-slate-900">{userName}</div>
              <div className="text-xs text-slate-500">Registrado em {nowDisplay()}</div>
            </div>
            {acaoModal.tipo.endsWith("_recusar") ? (
              <Field label="Motivo da recusa">
                <textarea
                  rows={3}
                  value={acaoMotivo}
                  onChange={(e) => setAcaoMotivo(e.target.value)}
                  autoFocus
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </Field>
            ) : null}
          </div>
        </ModalShell>
      ) : null}

      {consultaOpen && consultaRow ? (
        <ModalShell
          title={`Lote ${consultaRow.ficha_controle}`}
          subtitle="PCM · Controle"
          maxWidth="max-w-4xl"
          onClose={() => setConsultaOpen(false)}
          footer={
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setConsultaOpen(false)}
                className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                Fechar
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <ReadOnly label="Numero da OS" value={consultaRow.numero_os} />
              <ReadOnly label="Data entrega" value={formatDate(consultaRow.data_entrega || consultaRow.created_at)} />
              <ReadOnly
                label="Fichas no lote"
                value={Array.isArray(consultaRow.itens) ? consultaRow.itens.length : (consultaRow.quantidade_fichas ?? "-")}
              />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</div>
                <div className="mt-2"><StatusBadge status={consultaRow.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnly label="Quem entregou" value={consultaRow.criado_por_nome || consultaRow.criado_por_login} />
              <ReadOnly
                label="Supervisor"
                value={
                  consultaRow.supervisor_recusado_em
                    ? `${consultaRow.supervisor_nome || "-"} recusou em ${formatDate(consultaRow.supervisor_recusado_em)}`
                    : consultaRow.supervisor_nome
                    ? `${consultaRow.supervisor_nome} · ${formatDate(consultaRow.supervisor_recebido_em)}`
                    : "Pendente"
                }
              />
              <ReadOnly
                label="PCM"
                value={
                  consultaRow.pcm_recusado_em
                    ? `${consultaRow.pcm_nome || "-"} recusou em ${formatDate(consultaRow.pcm_recusado_em)}`
                    : consultaRow.pcm_nome
                    ? `${consultaRow.pcm_nome} · ${formatDate(consultaRow.pcm_recebido_em)}`
                    : "Pendente"
                }
              />
            </div>

            {consultaRow.supervisor_recusa_motivo ? (
              <ReadOnly label="Motivo da recusa (supervisor)" value={consultaRow.supervisor_recusa_motivo} />
            ) : null}
            {consultaRow.pcm_recusa_motivo ? (
              <ReadOnly label="Motivo da recusa (PCM)" value={consultaRow.pcm_recusa_motivo} />
            ) : null}

            <ReadOnly
              label="Lancamento no Transnet"
              value={
                consultaRow.transnet_lancado_em
                  ? `${consultaRow.transnet_lancado_por_nome || "-"} · ${formatDate(consultaRow.transnet_lancado_em)}`
                  : "Pendente"
              }
            />

            {Array.isArray(consultaRow.itens) && consultaRow.itens.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-black uppercase tracking-wide text-slate-700">
                  Fichas
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {consultaRow.itens.map((it, idx) => (
                    <div key={it.id || idx} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Ficha {idx + 1}{it.numero_ficha ? ` · ${it.numero_ficha}` : ""}
                      </div>
                      {it.foto_url ? (
                        <img
                          src={it.foto_url}
                          alt={`Ficha ${idx + 1}`}
                          className="mt-2 h-56 w-full rounded-lg object-contain"
                        />
                      ) : (
                        <div className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400">
                          Sem foto
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {consultaRow.observacoes ? <ReadOnly label="Observacoes" value={consultaRow.observacoes} /> : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
