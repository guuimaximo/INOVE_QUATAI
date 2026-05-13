import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaCamera,
  FaCheckCircle,
  FaClipboardList,
  FaPlus,
  FaSave,
  FaSearch,
  FaTimes,
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

const STATUS_LABELS = {
  [STATUS_AGUARDANDO_SUPERVISOR]: "Aguardando supervisor",
  [STATUS_AGUARDANDO_PCM]: "Aguardando PCM",
  [STATUS_AGUARDANDO_TRANSNET]: "Aguardando lancamento no Transnet",
  [STATUS_CONCLUIDO]: "Concluido",
};

const STATUS_COLORS = {
  [STATUS_AGUARDANDO_SUPERVISOR]: "bg-amber-100 text-amber-800 border-amber-200",
  [STATUS_AGUARDANDO_PCM]: "bg-blue-100 text-blue-800 border-blue-200",
  [STATUS_AGUARDANDO_TRANSNET]: "bg-purple-100 text-purple-800 border-purple-200",
  [STATUS_CONCLUIDO]: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const BUCKET = "pcm_controle_fichas";

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

async function uploadFoto(recordId, file) {
  if (!file) return { path: null, url: null };
  const path = `controle/${recordId}/foto_${Date.now()}_${sanitizeFileName(file.name)}`;
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

function ModalShell({ title, subtitle, onClose, footer, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
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

function PhotoField({ file, onChange, inputId }) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          <FaCamera />
          {file ? "Trocar foto" : "Tirar / escolher foto"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
        />
        {file ? <span className="truncate text-xs text-slate-600">{file.name}</span> : null}
      </div>
      {previewUrl ? (
        <img src={previewUrl} alt="Pre-visualizacao" className="mt-3 max-h-48 rounded-lg object-contain" />
      ) : null}
    </div>
  );
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
    quantidadeFichas: "",
    foto: null,
    observacoes: "",
  }));
  const [saving, setSaving] = useState(false);

  const [acaoModal, setAcaoModal] = useState(null);
  const [acaoNome, setAcaoNome] = useState("");
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
      quantidadeFichas: "",
      foto: null,
      observacoes: "",
    });
    setLancamentoOpen(true);
  }

  function setField(field, value) {
    setLancamentoForm((current) => ({ ...current, [field]: value }));
  }

  async function salvarLancamento() {
    const numeroOS = safeText(lancamentoForm.numeroOS);
    if (!numeroOS) {
      alert("Informe o numero da OS.");
      return;
    }
    if (!lancamentoForm.foto) {
      alert("A foto das fichas e obrigatoria.");
      return;
    }
    const id = createUuid();
    setSaving(true);
    try {
      const foto = await uploadFoto(id, lancamentoForm.foto);
      const ficha = lancamentoForm.ficha || buildNextFicha(rows);
      const { error } = await supabase.from("pcm_controle_fichas").insert([
        {
          id,
          ficha_controle: ficha,
          numero_os: numeroOS,
          data_entrega: new Date().toISOString(),
          quantidade_fichas: lancamentoForm.quantidadeFichas
            ? Number(lancamentoForm.quantidadeFichas)
            : null,
          foto_path: foto.path,
          foto_url: foto.url,
          observacoes: safeText(lancamentoForm.observacoes) || null,
          status: STATUS_AGUARDANDO_SUPERVISOR,
          criado_por_login: safeText(user?.login || user?.email),
          criado_por_nome: safeText(user?.nome),
          criado_por_id: safeText(user?.auth_user_id || user?.id),
          origem: "INOVE_WEB_APP",
        },
      ]);
      if (error) throw error;
      setLancamentoOpen(false);
      await carregar();
      alert("Lancamento registrado e entregue ao supervisor.");
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar o lancamento.");
    } finally {
      setSaving(false);
    }
  }

  function abrirAcaoSupervisor(row) {
    setAcaoModal({ row, tipo: "supervisor" });
    setAcaoNome("");
  }

  function abrirAcaoPCM(row) {
    setAcaoModal({ row, tipo: "pcm" });
    setAcaoNome("");
  }

  function abrirAcaoTransnet(row) {
    setAcaoModal({ row, tipo: "transnet" });
    setAcaoNome(userName);
  }

  async function confirmarAcao() {
    if (!acaoModal) return;
    const nome = safeText(acaoNome);
    if (!nome) {
      alert("Informe o nome.");
      return;
    }
    const { row, tipo } = acaoModal;
    const agora = new Date().toISOString();
    let update = null;
    if (tipo === "supervisor") {
      update = {
        supervisor_nome: nome,
        supervisor_recebido_em: agora,
        status: STATUS_AGUARDANDO_PCM,
      };
    } else if (tipo === "pcm") {
      update = {
        pcm_nome: nome,
        pcm_recebido_em: agora,
        status: STATUS_AGUARDANDO_TRANSNET,
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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">PCM · Controle</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Controle de fichas</h1>
          <p className="text-sm text-slate-500">
            Acompanhe a entrega das fichas: do operador para o supervisor, do supervisor para o PCM e o lancamento no Transnet.
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
                <th className="px-4 py-3">Ficha</th>
                <th className="px-4 py-3">OS</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Quem entregou</th>
                <th className="px-4 py-3">Qtd</th>
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
                linhasFiltradas.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => abrirConsulta(row)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3 font-bold text-blue-700">{row.ficha_controle}</td>
                    <td className="px-4 py-3 text-slate-700">{row.numero_os}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(row.data_entrega || row.created_at)}</td>
                    <td className="px-4 py-3 text-slate-600">{row.criado_por_nome || row.criado_por_login || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.quantidade_fichas ?? "-"}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {activeTab === TAB_SUPERVISOR && row.status === STATUS_AGUARDANDO_SUPERVISOR ? (
                          <button
                            type="button"
                            onClick={() => abrirAcaoSupervisor(row)}
                            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
                          >
                            Supervisor recebeu
                          </button>
                        ) : null}
                        {activeTab === TAB_PCM && row.status === STATUS_AGUARDANDO_PCM ? (
                          <button
                            type="button"
                            onClick={() => abrirAcaoPCM(row)}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            PCM recebeu
                          </button>
                        ) : null}
                        {activeTab === TAB_PCM && row.status === STATUS_AGUARDANDO_TRANSNET ? (
                          <button
                            type="button"
                            onClick={() => abrirAcaoTransnet(row)}
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Lancado no Transnet
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lancamentoOpen ? (
        <ModalShell
          title="Lancar entrega de fichas"
          subtitle="PCM · Controle"
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
              <ReadOnly label="Numero da ficha" value={lancamentoForm.ficha} />
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
              <Field label="Quantidade de fichas (opcional)">
                <input
                  type="number"
                  min="1"
                  value={lancamentoForm.quantidadeFichas}
                  onChange={(e) => setField("quantidadeFichas", e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
                />
              </Field>
            </div>

            <Field label="Foto das fichas">
              <PhotoField
                file={lancamentoForm.foto}
                onChange={(file) => setField("foto", file)}
                inputId="controle-fichas-foto"
              />
            </Field>

            <Field label="Observacoes (opcional)">
              <textarea
                rows={3}
                value={lancamentoForm.observacoes}
                onChange={(e) => setField("observacoes", e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}

      {acaoModal ? (
        <ModalShell
          title={
            acaoModal.tipo === "supervisor"
              ? "Supervisor recebeu as fichas"
              : acaoModal.tipo === "pcm"
              ? "PCM recebeu as fichas"
              : "Lancamento no Transnet"
          }
          subtitle={`Ficha ${acaoModal.row.ficha_controle} · OS ${acaoModal.row.numero_os}`}
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
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <FaCheckCircle />
                {acaoSaving ? "Gravando..." : "Confirmar"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {acaoModal.tipo === "supervisor"
                ? "Peca para o supervisor digitar o nome dele aqui para confirmar o recebimento das fichas."
                : acaoModal.tipo === "pcm"
                ? "Peca para o responsavel do PCM digitar o nome para confirmar o recebimento."
                : "Confirme o lancamento no Transnet informando o nome do responsavel."}
            </p>
            <Field
              label={
                acaoModal.tipo === "supervisor"
                  ? "Nome do supervisor"
                  : acaoModal.tipo === "pcm"
                  ? "Nome do PCM"
                  : "Quem lancou no Transnet"
              }
            >
              <input
                type="text"
                value={acaoNome}
                onChange={(e) => setAcaoNome(e.target.value)}
                autoFocus
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-blue-400 focus:outline-none"
              />
            </Field>
          </div>
        </ModalShell>
      ) : null}

      {consultaOpen && consultaRow ? (
        <ModalShell
          title={`Ficha ${consultaRow.ficha_controle}`}
          subtitle="PCM · Controle"
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
              <ReadOnly label="Quantidade" value={consultaRow.quantidade_fichas ?? "-"} />
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Status</div>
                <div className="mt-2"><StatusBadge status={consultaRow.status} /></div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnly label="Quem entregou" value={consultaRow.criado_por_nome || consultaRow.criado_por_login} />
              <ReadOnly
                label="Supervisor recebeu"
                value={
                  consultaRow.supervisor_nome
                    ? `${consultaRow.supervisor_nome} · ${formatDate(consultaRow.supervisor_recebido_em)}`
                    : "Pendente"
                }
              />
              <ReadOnly
                label="PCM recebeu"
                value={
                  consultaRow.pcm_nome
                    ? `${consultaRow.pcm_nome} · ${formatDate(consultaRow.pcm_recebido_em)}`
                    : "Pendente"
                }
              />
            </div>

            <ReadOnly
              label="Lancamento no Transnet"
              value={
                consultaRow.transnet_lancado_em
                  ? `${consultaRow.transnet_lancado_por_nome || "-"} · ${formatDate(consultaRow.transnet_lancado_em)}`
                  : "Pendente"
              }
            />

            {consultaRow.foto_url ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Foto das fichas
                </div>
                <img
                  src={consultaRow.foto_url}
                  alt="Foto das fichas"
                  className="max-h-96 w-full rounded-lg object-contain"
                />
              </div>
            ) : null}

            {consultaRow.observacoes ? <ReadOnly label="Observacoes" value={consultaRow.observacoes} /> : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
