import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaBriefcase,
  FaCheckCircle,
  FaClipboardList,
  FaDownload,
  FaEdit,
  FaPlus,
  FaSearch,
  FaSync,
  FaTimes,
  FaUserCheck,
  FaUserPlus,
  FaTimesCircle,
} from "react-icons/fa";
import * as XLSX from "xlsx";

import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";

const STATUS = [
  { value: "ABERTA", label: "Aberta", cor: "amber" },
  { value: "RECRUTAMENTO", label: "Em recrutamento", cor: "blue" },
  { value: "ENTREVISTAS", label: "Em entrevistas", cor: "sky" },
  { value: "APROVACAO", label: "Em aprovacao", cor: "purple" },
  { value: "APROVADA", label: "Aprovada", cor: "emerald" },
  { value: "CONCLUIDA", label: "Concluida", cor: "emerald" },
  { value: "CANCELADA", label: "Cancelada", cor: "rose" },
];
const STATUS_BY_VALUE = new Map(STATUS.map((s) => [s.value, s]));
const STATUS_CHIP = {
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  sky: "bg-sky-100 text-sky-800 border-sky-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rose: "bg-rose-100 text-rose-800 border-rose-200",
};

const TIPOS_VAGA = ["NOVA", "SUBSTITUICAO"];
const SN_OPCOES = ["SIM", "NAO"];
const APROVACAO_OPCOES = ["SIM", "NAO", "EM_APROVACAO"];

function StatusBadge({ status }) {
  const s = STATUS_BY_VALUE.get(status) || { label: status, cor: "amber" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_CHIP[s.cor] || ""}`}>
      {s.label}
    </span>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try { return new Date(value).toLocaleDateString("pt-BR"); } catch { return String(value); }
}

function formatDateTime(value) {
  if (!value) return "-";
  try { return new Date(value).toLocaleString("pt-BR"); } catch { return String(value); }
}

function safeText(v) { return (v || "").toString().trim(); }

function buildNextNumero(rows) {
  const maxN = (rows || []).reduce((acc, r) => {
    const m = /VG-(\d+)/.exec(r.numero_vaga || "");
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `VG-${String(maxN + 1).padStart(4, "0")}`;
}

function CardKPI({ titulo, valor, cor = "slate", sub }) {
  const cls = {
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    purple: "border-purple-200 bg-purple-50 text-purple-900",
    sky: "border-sky-200 bg-sky-50 text-sky-900",
  }[cor];
  return (
    <div className={`rounded-2xl border ${cls} px-4 py-3`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">{titulo}</div>
      <div className="mt-1 text-2xl font-black">{valor}</div>
      {sub ? <div className="mt-0.5 text-[11px] opacity-70">{sub}</div> : null}
    </div>
  );
}

function Field({ label, hint, children, required }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {label}{required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

const inputCls = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none";

function ModalShell({ title, subtitle, onClose, footer, children, maxWidth = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
      <div className={`flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-2xl bg-white shadow-2xl`}>
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            {subtitle ? <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-blue-600">{subtitle}</div> : null}
            <div className="mt-0.5 text-lg font-black text-slate-900">{title}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><FaTimes /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

function VagaForm({ open, mode, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(initial || {});

  useEffect(() => {
    if (open) setForm(initial || {});
  }, [open, initial]);

  if (!open) return null;
  const set = (k, v) => setForm((current) => ({ ...current, [k]: v }));
  const isEdit = mode === "edit";

  return (
    <ModalShell
      title={isEdit ? `Editar vaga ${form.numero_vaga || ""}` : "Nova requisicao de vaga"}
      subtitle="Pessoas · RH"
      maxWidth="max-w-4xl"
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancelar</button>
          <button
            type="button"
            disabled={saving || !safeText(form.nome_cargo)}
            onClick={() => onSave(form)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Salvando..." : (isEdit ? "Salvar alteracoes" : "Abrir vaga")}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] text-blue-800">
          Preencha o maximo de campos. O RH usa essas informacoes para encontrar o candidato adequado.
        </div>

        <div>
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">Identificacao da vaga</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nome do cargo" required>
              <input className={inputCls} value={form.nome_cargo || ""} onChange={(e) => set("nome_cargo", e.target.value)} autoFocus />
            </Field>
            <Field label="Area">
              <input className={inputCls} value={form.area || ""} onChange={(e) => set("area", e.target.value)} />
            </Field>
            <Field label="Gestor da vaga">
              <input className={inputCls} value={form.gestor || ""} onChange={(e) => set("gestor", e.target.value)} />
            </Field>
            <Field label="Tipo da vaga">
              <select className={inputCls} value={form.tipo_vaga || ""} onChange={(e) => set("tipo_vaga", e.target.value)}>
                <option value="">Selecione</option>
                {TIPOS_VAGA.map((t) => <option key={t} value={t}>{t === "NOVA" ? "Nova" : "Substituicao"}</option>)}
              </select>
            </Field>
            {form.tipo_vaga === "SUBSTITUICAO" ? (
              <Field label="Quem sera substituido">
                <input className={inputCls} value={form.substituido || ""} onChange={(e) => set("substituido", e.target.value)} />
              </Field>
            ) : null}
            {form.tipo_vaga === "NOVA" ? (
              <Field label="Aprovada pela diretoria">
                <select className={inputCls} value={form.aprovada_diretoria || ""} onChange={(e) => set("aprovada_diretoria", e.target.value)}>
                  <option value="">Selecione</option>
                  {APROVACAO_OPCOES.map((o) => <option key={o} value={o}>{o.replace("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</option>)}
                </select>
              </Field>
            ) : null}
            <Field label="A vaga e sigilosa?">
              <select className={inputCls} value={form.sigilosa || ""} onChange={(e) => set("sigilosa", e.target.value)}>
                <option value="">Selecione</option>
                {SN_OPCOES.map((o) => <option key={o} value={o}>{o === "SIM" ? "Sim" : "Nao"}</option>)}
              </select>
            </Field>
            <Field label="A vaga pode ser para PCD?">
              <select className={inputCls} value={form.pcd || ""} onChange={(e) => set("pcd", e.target.value)}>
                <option value="">Selecione</option>
                {SN_OPCOES.map((o) => <option key={o} value={o}>{o === "SIM" ? "Sim" : "Nao"}</option>)}
              </select>
            </Field>
            <Field label="Local de atuacao">
              <input className={inputCls} value={form.local_atuacao || ""} onChange={(e) => set("local_atuacao", e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-black uppercase tracking-wide text-slate-700">Perfil do candidato</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Formacao">
              <input className={inputCls} value={form.formacao || ""} onChange={(e) => set("formacao", e.target.value)} placeholder="Ex: Superior em Engenharia" />
            </Field>
            <Field label="Tempo de experiencia na funcao">
              <input className={inputCls} value={form.tempo_experiencia || ""} onChange={(e) => set("tempo_experiencia", e.target.value)} placeholder="Ex: 2 anos" />
            </Field>
            <Field label="Experiencia requerida">
              <textarea rows={2} className={inputCls} value={form.experiencia_requerida || ""} onChange={(e) => set("experiencia_requerida", e.target.value)} />
            </Field>
            <Field label="Salario proposto">
              <input className={inputCls} value={form.salario_proposto || ""} onChange={(e) => set("salario_proposto", e.target.value)} placeholder="R$ ..." />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <Field label="Principais atividades e responsabilidades">
              <textarea rows={3} className={inputCls} value={form.atividades || ""} onChange={(e) => set("atividades", e.target.value)} />
            </Field>
            <Field label="Conhecimento tecnico requerido">
              <textarea rows={2} className={inputCls} value={form.conhecimento_requerido || ""} onChange={(e) => set("conhecimento_requerido", e.target.value)} />
            </Field>
            <Field label="Conhecimento tecnico desejavel">
              <textarea rows={2} className={inputCls} value={form.conhecimento_desejavel || ""} onChange={(e) => set("conhecimento_desejavel", e.target.value)} />
            </Field>
            <Field label="Habilidades comportamentais desejaveis">
              <textarea rows={2} className={inputCls} value={form.habilidades_comportamentais || ""} onChange={(e) => set("habilidades_comportamentais", e.target.value)} />
            </Field>
            <Field label="Observacoes">
              <textarea rows={2} className={inputCls} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DetalheVaga({ vaga, onClose, onUpdateStatus, onEditar, onConcluir, saving }) {
  if (!vaga) return null;
  const Row = ({ label, value }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-800 whitespace-pre-wrap">{value || "-"}</div>
    </div>
  );

  return (
    <ModalShell
      title={`Vaga ${vaga.numero_vaga} — ${vaga.nome_cargo}`}
      subtitle="Pessoas · RH"
      maxWidth="max-w-4xl"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Aberta em {formatDateTime(vaga.criado_em)} por <strong>{vaga.criado_por_nome || vaga.criado_por_login || "-"}</strong>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onEditar(vaga)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
              <FaEdit /> Editar
            </button>
            {vaga.status !== "CONCLUIDA" && vaga.status !== "CANCELADA" ? (
              <>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                  value={vaga.status}
                  onChange={(e) => onUpdateStatus(vaga, e.target.value)}
                  disabled={saving}
                >
                  {STATUS.filter((s) => s.value !== "CONCLUIDA").map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => onConcluir(vaga)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                  <FaUserCheck /> Concluir (contratar)
                </button>
              </>
            ) : null}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={vaga.status} />
          <div className="text-xs text-slate-500">Atualizada em {formatDateTime(vaga.atualizado_em)}</div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-black uppercase tracking-wide text-slate-700">Identificacao</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            <Row label="Cargo" value={vaga.nome_cargo} />
            <Row label="Area" value={vaga.area} />
            <Row label="Gestor" value={vaga.gestor} />
            <Row label="Tipo" value={vaga.tipo_vaga === "NOVA" ? "Nova" : vaga.tipo_vaga === "SUBSTITUICAO" ? "Substituicao" : "-"} />
            <Row label="Substituido" value={vaga.substituido} />
            <Row label="Aprovacao diretoria" value={vaga.aprovada_diretoria} />
            <Row label="Sigilosa" value={vaga.sigilosa} />
            <Row label="PCD" value={vaga.pcd} />
            <Row label="Local de atuacao" value={vaga.local_atuacao} />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm font-black uppercase tracking-wide text-slate-700">Perfil</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Row label="Formacao" value={vaga.formacao} />
            <Row label="Tempo na funcao" value={vaga.tempo_experiencia} />
            <Row label="Experiencia requerida" value={vaga.experiencia_requerida} />
            <Row label="Salario proposto" value={vaga.salario_proposto} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2">
            <Row label="Principais atividades e responsabilidades" value={vaga.atividades} />
            <Row label="Conhecimento tecnico requerido" value={vaga.conhecimento_requerido} />
            <Row label="Conhecimento tecnico desejavel" value={vaga.conhecimento_desejavel} />
            <Row label="Habilidades comportamentais desejaveis" value={vaga.habilidades_comportamentais} />
          </div>
        </div>

        {vaga.contratado_nome ? (
          <div>
            <div className="mb-1.5 text-sm font-black uppercase tracking-wide text-emerald-700">Contratacao</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Row label="Nome" value={vaga.contratado_nome} />
              <Row label="Chapa / ID" value={vaga.contratado_id_funcionario} />
              <Row label="Data contratacao" value={formatDate(vaga.data_contratacao)} />
            </div>
          </div>
        ) : null}

        {vaga.observacoes ? (
          <Row label="Observacoes" value={vaga.observacoes} />
        ) : null}
      </div>
    </ModalShell>
  );
}

function ConcluirModal({ open, vaga, onClose, onConfirm, saving }) {
  const [nome, setNome] = useState("");
  const [id, setId] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setNome("");
      setId("");
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  if (!open || !vaga) return null;
  return (
    <ModalShell
      title="Concluir vaga · registrar contratacao"
      subtitle={`Vaga ${vaga.numero_vaga} — ${vaga.nome_cargo}`}
      maxWidth="max-w-lg"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200">Cancelar</button>
          <button
            type="button"
            disabled={saving || !safeText(nome)}
            onClick={() => onConfirm({ nome: safeText(nome), id_funcionario: safeText(id), data_contratacao: data })}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FaCheckCircle /> {saving ? "Salvando..." : "Concluir vaga"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <Field label="Nome do contratado" required>
          <input className={inputCls} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
        </Field>
        <Field label="Chapa / ID do funcionario" hint="Opcional - preencher quando o cadastro for criado">
          <input className={inputCls} value={id} onChange={(e) => setId(e.target.value)} />
        </Field>
        <Field label="Data de contratacao">
          <input type="date" className={inputCls} value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
      </div>
    </ModalShell>
  );
}

export default function VagasCentral() {
  const { user } = useContext(AuthContext) || {};
  const isAdmin = String(user?.nivel || "").toLowerCase() === "administrador";
  const userName = safeText(user?.nome) || safeText(user?.login) || "Usuario";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [tab, setTab] = useState("todos");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("new"); // new | edit
  const [formInitial, setFormInitial] = useState(null);

  const [detalhe, setDetalhe] = useState(null);
  const [concluindo, setConcluindo] = useState(null);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("vagas_solicitacao")
      .select("*")
      .order("criado_em", { ascending: false });
    setLoading(false);
    if (error) {
      console.error(error);
      alert("Nao foi possivel carregar as vagas.");
      return;
    }
    setRows(data || []);
  }

  useEffect(() => { carregar(); }, []);

  function abrirNova() {
    setFormMode("new");
    setFormInitial({
      numero_vaga: buildNextNumero(rows),
      status: "ABERTA",
      tipo_vaga: "",
      sigilosa: "NAO",
      pcd: "NAO",
    });
    setFormOpen(true);
  }

  function abrirEditar(vaga) {
    setFormMode("edit");
    setFormInitial(vaga);
    setFormOpen(true);
  }

  async function salvarForm(payload) {
    setSaving(true);
    try {
      const agora = new Date().toISOString();
      if (formMode === "edit") {
        const { error } = await supabase
          .from("vagas_solicitacao")
          .update({ ...payload, atualizado_em: agora })
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const insert = {
          ...payload,
          numero_vaga: payload.numero_vaga || buildNextNumero(rows),
          status: payload.status || "ABERTA",
          criado_por_login: safeText(user?.login || user?.email),
          criado_por_nome: safeText(user?.nome),
          criado_por_id: safeText(user?.auth_user_id || user?.id),
          criado_em: agora,
          atualizado_em: agora,
        };
        const { error } = await supabase.from("vagas_solicitacao").insert([insert]);
        if (error) throw error;
      }
      setFormOpen(false);
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel salvar a vaga.");
    } finally {
      setSaving(false);
    }
  }

  async function atualizarStatus(vaga, novoStatus) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vagas_solicitacao")
        .update({ status: novoStatus, atualizado_em: new Date().toISOString() })
        .eq("id", vaga.id);
      if (error) throw error;
      setDetalhe((cur) => (cur && cur.id === vaga.id ? { ...cur, status: novoStatus } : cur));
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function concluirContratacao(payload) {
    if (!concluindo) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("vagas_solicitacao")
        .update({
          status: "CONCLUIDA",
          contratado_nome: payload.nome,
          contratado_id_funcionario: payload.id_funcionario || null,
          data_contratacao: payload.data_contratacao || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", concluindo.id);
      if (error) throw error;
      setConcluindo(null);
      setDetalhe(null);
      await carregar();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel concluir.");
    } finally {
      setSaving(false);
    }
  }

  function cancelarVaga(vaga) {
    if (!confirm("Cancelar esta vaga?")) return;
    atualizarStatus(vaga, "CANCELADA");
  }

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return rows.filter((r) => {
      if (tab === "abertas" && !["ABERTA", "RECRUTAMENTO", "ENTREVISTAS", "APROVACAO", "APROVADA"].includes(r.status)) return false;
      if (tab === "concluidas" && r.status !== "CONCLUIDA") return false;
      if (tab === "canceladas" && r.status !== "CANCELADA") return false;
      if (!q) return true;
      return [r.numero_vaga, r.nome_cargo, r.area, r.gestor, r.contratado_nome]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, busca, tab]);

  const stats = useMemo(() => {
    const total = rows.length;
    const abertas = rows.filter((r) => ["ABERTA", "RECRUTAMENTO", "ENTREVISTAS", "APROVACAO", "APROVADA"].includes(r.status)).length;
    const concluidas = rows.filter((r) => r.status === "CONCLUIDA").length;
    const canceladas = rows.filter((r) => r.status === "CANCELADA").length;
    return { total, abertas, concluidas, canceladas };
  }, [rows]);

  function exportarExcel() {
    if (!filtradas.length) {
      alert("Sem dados para exportar.");
      return;
    }
    const linhas = filtradas.map((r) => ({
      Vaga: r.numero_vaga,
      Status: STATUS_BY_VALUE.get(r.status)?.label || r.status,
      Cargo: r.nome_cargo,
      Area: r.area,
      Gestor: r.gestor,
      Tipo: r.tipo_vaga,
      Substituido: r.substituido,
      "Aprovacao Diretoria": r.aprovada_diretoria,
      Sigilosa: r.sigilosa,
      PCD: r.pcd,
      "Local de atuacao": r.local_atuacao,
      Formacao: r.formacao,
      "Tempo experiencia": r.tempo_experiencia,
      "Salario proposto": r.salario_proposto,
      "Aberta em": formatDate(r.criado_em),
      "Quem abriu": r.criado_por_nome,
      "Contratado": r.contratado_nome,
      "Data contratacao": formatDate(r.data_contratacao),
    }));
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws["!cols"] = Object.keys(linhas[0]).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vagas");
    XLSX.writeFile(wb, `vagas_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">Pessoas · RH</div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Vagas abertas</h1>
          <p className="text-sm text-slate-500">
            Central de requisicoes de vaga. Solicite uma nova vaga ao RH e acompanhe ate a contratacao.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportarExcel} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
            <FaDownload /> Excel
          </button>
          <button type="button" onClick={carregar} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-60">
            <FaSync className={loading ? "animate-spin" : ""} /> Atualizar
          </button>
          <button type="button" onClick={abrirNova} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-blue-700">
            <FaPlus /> Solicitar vaga
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <CardKPI titulo="Total" valor={stats.total} cor="slate" sub="Todas as solicitacoes" />
        <CardKPI titulo="Abertas" valor={stats.abertas} cor="amber" sub="Em andamento" />
        <CardKPI titulo="Concluidas" valor={stats.concluidas} cor="emerald" sub="Vagas preenchidas" />
        <CardKPI titulo="Canceladas" valor={stats.canceladas} cor="rose" sub="Sem efetivacao" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab("todos")} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${tab === "todos" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Todas ({stats.total})</button>
        <button type="button" onClick={() => setTab("abertas")} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${tab === "abertas" ? "border-amber-600 bg-amber-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Em andamento ({stats.abertas})</button>
        <button type="button" onClick={() => setTab("concluidas")} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${tab === "concluidas" ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Concluidas ({stats.concluidas})</button>
        <button type="button" onClick={() => setTab("canceladas")} className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${tab === "canceladas" ? "border-rose-600 bg-rose-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>Canceladas ({stats.canceladas})</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por numero, cargo, area, gestor ou contratado..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-slate-500">Carregando vagas...</div>
        ) : filtradas.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            Nenhuma vaga encontrada. Clique em "Solicitar vaga" para abrir a primeira requisicao.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtradas.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 px-4 py-3 transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
                <button type="button" onClick={() => setDetalhe(r)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wide text-blue-700">{r.numero_vaga}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-slate-900">
                    {r.nome_cargo} {r.area ? <span className="font-normal text-slate-500">· {r.area}</span> : null}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Gestor: {r.gestor || "-"} · {r.tipo_vaga === "NOVA" ? "Nova" : r.tipo_vaga === "SUBSTITUICAO" ? "Substituicao" : "—"}
                    {r.contratado_nome ? ` · Contratado: ${r.contratado_nome}` : ""} · Aberta {formatDate(r.criado_em)}
                  </div>
                </button>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => abrirEditar(r)} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200">
                    <FaEdit className="inline mr-1" /> Editar
                  </button>
                  {!["CONCLUIDA", "CANCELADA"].includes(r.status) ? (
                    <>
                      <button type="button" onClick={() => setConcluindo(r)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700">
                        <FaUserCheck className="inline mr-1" /> Concluir
                      </button>
                      {isAdmin && (
                        <button type="button" onClick={() => cancelarVaga(r)} className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-200" title="Cancelar (Admin)">
                          <FaTimesCircle className="inline mr-1" /> Cancelar
                        </button>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <VagaForm
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        onClose={() => setFormOpen(false)}
        onSave={salvarForm}
        saving={saving}
      />

      <DetalheVaga
        vaga={detalhe}
        onClose={() => setDetalhe(null)}
        onUpdateStatus={atualizarStatus}
        onEditar={(v) => { setDetalhe(null); abrirEditar(v); }}
        onConcluir={(v) => { setDetalhe(null); setConcluindo(v); }}
        saving={saving}
      />

      <ConcluirModal
        open={!!concluindo}
        vaga={concluindo}
        onClose={() => setConcluindo(null)}
        onConfirm={concluirContratacao}
        saving={saving}
      />
    </div>
  );
}
