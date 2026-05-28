import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaEye,
  FaFlagCheckered,
  FaFlask,
  FaPlus,
  FaRedo,
  FaRoute,
  FaSearch,
  FaTimes,
  FaTimesCircle,
  FaTrash,
} from "react-icons/fa";
import CampoPrefixo from "../../components/CampoPrefixo";
import { AuthContext } from "../../context/AuthContext";
import { supabase } from "../../supabase";
import {
  ActionButton,
  AttachmentGallery,
  AttachmentInput,
  EmptyState,
  KpiCard,
  PageHero,
  Panel,
  PartAutocomplete,
  StatusChip,
  SupplierAutocomplete,
} from "./SuprimentosUI";
import {
  TESTE_RESULTADOS,
  buildOpenedBy,
  deriveTesteMeta,
  formatDateBR,
  formatDateTimeBR,
  formatKm,
  generateNextControlNumber,
  getTesteLastIntercorrencia,
  matchesSearch,
  parseTesteIntercorrencias,
  safeNumber,
  serializeTesteIntercorrencias,
  todayISO,
  uploadSuprimentosFiles,
} from "./suprimentosShared";

const QUICK_FORM = {
  nome_teste: "",
  peca: "",
  codigo_peca: "",
  fornecedor: "",
  prefixo: "",
  data_inicio: todayISO(),
  km_inicial: "",
};

const DETAIL_FORM = {
  nome_teste: "",
  peca: "",
  codigo_peca: "",
  fornecedor: "",
  prefixo: "",
  data_inicio: "",
  km_inicial: "",
  objetivo: "",
  km_atual: "",
  prazo_teste: "",
  resultado_final: "",
  encerrado_em: "",
  descricao_final: "",
  parecer_tecnico: "",
};

const EMPTY_INTERCORRENCIA = {
  id: "",
  data: todayISO(),
  km: "",
  descricao: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function createIntercorrencia() {
  return {
    ...EMPTY_INTERCORRENCIA,
    id: `intercorrencia-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

function ModalShell({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-blue-950">
      {children}
    </span>
  );
}

function StaticInfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <Label>{label}</Label>
      <p className="text-base font-semibold text-slate-950">{value || "--"}</p>
    </div>
  );
}

function Field({ label, required = false, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <Label>
        {label} {required ? "*" : ""}
      </Label>
      {children}
    </label>
  );
}

function QuickCreateTesteModal({ open, onClose, onSaved, user }) {
  const [form, setForm] = useState(QUICK_FORM);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(QUICK_FORM);
    setNewFiles([]);
  }, [open]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const uploaded = await uploadSuprimentosFiles(
        newFiles,
        `testes/${form.prefixo || "sem-prefixo"}`
      );

      const numeroControle = await generateNextControlNumber("suprimentos_testes", "TST");
      const payload = {
        numero_controle: numeroControle,
        nome_teste: form.nome_teste.trim(),
        peca: form.peca.trim(),
        codigo_peca: form.codigo_peca.trim() || null,
        fornecedor: form.fornecedor.trim(),
        prefixo: form.prefixo.trim(),
        data_inicio: form.data_inicio || null,
        km_inicial: safeNumber(form.km_inicial),
        km_atual: null,
        objetivo: null,
        prazo_teste: null,
        observacao: null,
        falha_registrada: false,
        data_falha: null,
        km_falha: null,
        descricao_falha: null,
        parecer_tecnico: null,
        resultado_final: null,
        encerrado_em: null,
        anexos: uploaded,
        updated_at: new Date().toISOString(),
        ...buildOpenedBy(user),
      };

      const { error } = await supabase.from("suprimentos_testes").insert(payload).select().single();
      if (error) throw error;

      onSaved?.();
      onClose?.();
    } catch (error) {
      alert(`Erro ao criar teste: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Suprimentos</p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900">Novo teste</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Cadastre o basico primeiro. O restante do acompanhamento fica no detalhe.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Nome do teste" required>
            <input
              value={form.nome_teste}
              onChange={(e) => setForm((prev) => ({ ...prev, nome_teste: e.target.value }))}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Peca" required>
            <PartAutocomplete
              value={form.peca}
              onChange={(value) => setForm((prev) => ({ ...prev, peca: value }))}
              onSelect={(peca) =>
                setForm((prev) => ({
                  ...prev,
                  peca: peca.descricao || prev.peca,
                  codigo_peca: peca.codigo || prev.codigo_peca,
                  fornecedor: peca.fornecedor_nome || prev.fornecedor,
                }))
              }
              className={inputClass}
              required
            />
          </Field>

          <Field label="Codigo da peca">
            <input
              value={form.codigo_peca}
              onChange={(e) => setForm((prev) => ({ ...prev, codigo_peca: e.target.value }))}
              className={inputClass}
            />
          </Field>

          <Field label="Fornecedor / marca" required>
            <SupplierAutocomplete value={form.fornecedor} onChange={(v) => setForm((prev) => ({ ...prev, fornecedor: v }))} className={inputClass} required />
          </Field>

          <Field label="Prefixo" required>
            <CampoPrefixo
              value={form.prefixo}
              onChange={(value) => setForm((prev) => ({ ...prev, prefixo: value }))}
              label=""
            />
          </Field>

          <Field label="Data de inicio" required>
            <input
              type="date"
              value={form.data_inicio}
              onChange={(e) => setForm((prev) => ({ ...prev, data_inicio: e.target.value }))}
              className={inputClass}
              required
            />
          </Field>

          <Field label="KM inicial" required>
            <input
              type="number"
              min="0"
              step="1"
              value={form.km_inicial}
              onChange={(e) => setForm((prev) => ({ ...prev, km_inicial: e.target.value }))}
              className={inputClass}
              required
            />
          </Field>
        </div>

        <Panel title="Anexos iniciais">
          <AttachmentInput
            existingUrls={[]}
            onExistingUrlsChange={() => {}}
            newFiles={newFiles}
            onNewFilesChange={setNewFiles}
            helperText=""
          />
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <ActionButton onClick={onClose}>Cancelar</ActionButton>
          <ActionButton type="submit" tone="blue" disabled={saving} className={saving ? "opacity-60" : ""}>
            {saving ? "Salvando..." : "Salvar teste"}
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}

function IntercorrenciaEditor({ item, onChange, onRemove }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Intercorrencia</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Registre data, quilometragem e o que aconteceu.
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:bg-rose-50"
        >
          <FaTrash />
          Remover
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Data">
          <input
            type="date"
            value={item.data}
            onChange={(e) => onChange({ ...item, data: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="KM">
          <input
            type="number"
            min="0"
            step="1"
            value={item.km}
            onChange={(e) => onChange({ ...item, km: e.target.value })}
            className={inputClass}
          />
        </Field>

        <Field label="O que houve" className="md:col-span-3">
          <textarea
            value={item.descricao}
            onChange={(e) => onChange({ ...item, descricao: e.target.value })}
            className={`${inputClass} min-h-[110px]`}
            placeholder="Descreva a intercorrencia observada no teste."
          />
        </Field>
      </div>
    </div>
  );
}

function TesteDetailModal({ open, item, onClose, onSaved }) {
  const [form, setForm] = useState(DETAIL_FORM);
  const [intercorrencias, setIntercorrencias] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !item) return;

    setForm({
      nome_teste: item.nome_teste || "",
      peca: item.peca || "",
      codigo_peca: item.codigo_peca || "",
      fornecedor: item.fornecedor || "",
      prefixo: item.prefixo || "",
      data_inicio: item.data_inicio || "",
      km_inicial: item.km_inicial ?? "",
      objetivo: item.objetivo || "",
      km_atual: item.km_atual ?? "",
      prazo_teste: item.prazo_teste || "",
      resultado_final: item.resultado_final || "",
      encerrado_em: item.encerrado_em || "",
      descricao_final: item.observacao || "",
      parecer_tecnico: item.parecer_tecnico || "",
    });
    setIntercorrencias(parseTesteIntercorrencias(item));
    setExistingAttachments(Array.isArray(item.anexos) ? item.anexos : []);
    setNewFiles([]);
  }, [item, open]);

  if (!open || !item) return null;

  async function saveTeste(overrides = {}) {
    setSaving(true);

    try {
      const nextForm = { ...form, ...overrides };
      const uploaded = await uploadSuprimentosFiles(newFiles, `testes/${nextForm.prefixo || item.prefixo || "sem-prefixo"}`);
      const ultimaIntercorrencia = getTesteLastIntercorrencia(intercorrencias);

      const payload = {
        nome_teste: nextForm.nome_teste.trim(),
        peca: nextForm.peca.trim(),
        codigo_peca: nextForm.codigo_peca.trim() || null,
        fornecedor: nextForm.fornecedor.trim(),
        prefixo: nextForm.prefixo.trim(),
        data_inicio: nextForm.data_inicio || null,
        km_inicial: safeNumber(nextForm.km_inicial),
        objetivo: nextForm.objetivo.trim() || null,
        km_atual: safeNumber(nextForm.km_atual),
        prazo_teste: nextForm.prazo_teste || null,
        observacao: nextForm.descricao_final.trim() || null,
        falha_registrada: intercorrencias.length > 0,
        data_falha: ultimaIntercorrencia?.data || null,
        km_falha: safeNumber(ultimaIntercorrencia?.km),
        descricao_falha: serializeTesteIntercorrencias(intercorrencias),
        parecer_tecnico: nextForm.parecer_tecnico.trim() || null,
        resultado_final: nextForm.resultado_final || null,
        encerrado_em: nextForm.encerrado_em || null,
        anexos: [...existingAttachments, ...uploaded],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("suprimentos_testes").update(payload).eq("id", item.id);
      if (error) throw error;

      onSaved?.();
      onClose?.();
    } catch (error) {
      alert(`Erro ao atualizar teste: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await saveTeste();
  }

  async function handleEncerrarTeste() {
    const encerradoEm = form.encerrado_em || todayISO();
    setForm((prev) => ({ ...prev, encerrado_em: encerradoEm }));
    await saveTeste({ encerrado_em: encerradoEm });
  }

  const meta = deriveTesteMeta({
    ...item,
    ...form,
    descricao_falha: serializeTesteIntercorrencias(intercorrencias),
    falha_registrada: intercorrencias.length > 0,
  });

  const kmRodado =
    safeNumber(form.km_atual) !== null && safeNumber(form.km_inicial) !== null
      ? Math.max(Number(form.km_atual) - Number(form.km_inicial), 0)
      : null;

  function handleIntercorrenciaChange(targetId, nextValue) {
    setIntercorrencias((current) =>
      current.map((entry) => (entry.id === targetId ? nextValue : entry))
    );
  }

  function handleIntercorrenciaRemove(targetId) {
    setIntercorrencias((current) => current.filter((entry) => entry.id !== targetId));
  }

  return (
    <ModalShell open={open} onClose={onClose}>
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">
              {form.nome_teste || item.nome_teste} - {form.prefixo || item.prefixo || "--"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {item.numero_controle || "--"} - Aberto por {item.aberto_por_nome || "--"} em{" "}
              {formatDateTimeBR(item.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusChip label={meta.fase} tone={meta.tone} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 p-6">
        <Panel
          title="Dados iniciais do teste"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StaticInfoCard label="Controle" value={item.numero_controle} />
            <StaticInfoCard label="KM inicial" value={formatKm(form.km_inicial)} />
            <StaticInfoCard label="KM atual" value={formatKm(form.km_atual)} />
            <StaticInfoCard label="KM rodado" value={kmRodado !== null ? formatKm(kmRodado) : "--"} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Nome do teste" required className="xl:col-span-2">
              <input
                value={form.nome_teste}
                onChange={(e) => setForm((prev) => ({ ...prev, nome_teste: e.target.value }))}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Peca" required>
              <PartAutocomplete
                value={form.peca}
                onChange={(value) => setForm((prev) => ({ ...prev, peca: value }))}
                onSelect={(peca) =>
                  setForm((prev) => ({
                    ...prev,
                    peca: peca.descricao || prev.peca,
                    codigo_peca: peca.codigo || prev.codigo_peca,
                    fornecedor: peca.fornecedor_nome || prev.fornecedor,
                  }))
                }
                className={inputClass}
                required
              />
            </Field>

            <Field label="Codigo da peca">
              <input
                value={form.codigo_peca}
                onChange={(e) => setForm((prev) => ({ ...prev, codigo_peca: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Fornecedor / marca" required className="xl:col-span-2">
              <SupplierAutocomplete value={form.fornecedor} onChange={(v) => setForm((prev) => ({ ...prev, fornecedor: v }))} className={inputClass} required />
            </Field>

            <Field label="Prefixo" required>
              <CampoPrefixo
                value={form.prefixo}
                onChange={(value) => setForm((prev) => ({ ...prev, prefixo: value }))}
                label={null}
              />
            </Field>

            <Field label="Data de inicio" required>
              <input
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm((prev) => ({ ...prev, data_inicio: e.target.value }))}
                className={inputClass}
                required
              />
            </Field>

            <Field label="KM inicial" required>
              <input
                type="number"
                min="0"
                step="1"
                value={form.km_inicial}
                onChange={(e) => setForm((prev) => ({ ...prev, km_inicial: e.target.value }))}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Prazo do teste">
              <input
                type="date"
                value={form.prazo_teste}
                onChange={(e) => setForm((prev) => ({ ...prev, prazo_teste: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Objetivo do teste">
              <textarea
                value={form.objetivo}
                onChange={(e) => setForm((prev) => ({ ...prev, objetivo: e.target.value }))}
                className={`${inputClass} min-h-[110px]`}
                placeholder="Explique o que queremos validar com esse teste."
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Intercorrencias durante o teste"
          actions={
            <ActionButton tone="amber" onClick={() => setIntercorrencias((current) => [...current, createIntercorrencia()])}>
              <FaPlus />
              Inserir intercorrencia
            </ActionButton>
          }
        >
          {intercorrencias.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center">
              <FaExclamationTriangle className="mx-auto text-2xl text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Nenhuma intercorrencia registrada ate agora.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {intercorrencias.map((entry) => (
                <IntercorrenciaEditor
                  key={entry.id}
                  item={entry}
                  onChange={(nextValue) => handleIntercorrenciaChange(entry.id, nextValue)}
                  onRemove={() => handleIntercorrenciaRemove(entry.id)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Finalizacao do teste"
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="KM atual / final">
              <input
                type="number"
                min="0"
                step="1"
                value={form.km_atual}
                onChange={(e) => setForm((prev) => ({ ...prev, km_atual: e.target.value }))}
                className={inputClass}
              />
            </Field>

            <Field label="Resultado final">
              <select
                value={form.resultado_final}
                onChange={(e) => setForm((prev) => ({ ...prev, resultado_final: e.target.value }))}
                className={inputClass}
              >
                <option value="">Em aberto</option>
                {TESTE_RESULTADOS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Data de encerramento">
              <input
                type="date"
                value={form.encerrado_em}
                onChange={(e) => setForm((prev) => ({ ...prev, encerrado_em: e.target.value }))}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Field label="Descricao final">
              <textarea
                value={form.descricao_final}
                onChange={(e) => setForm((prev) => ({ ...prev, descricao_final: e.target.value }))}
                className={`${inputClass} min-h-[120px]`}
                placeholder="Resumo final do comportamento da peca no teste."
              />
            </Field>

            <Field label="Parecer tecnico">
              <textarea
                value={form.parecer_tecnico}
                onChange={(e) => setForm((prev) => ({ ...prev, parecer_tecnico: e.target.value }))}
                className={`${inputClass} min-h-[120px]`}
                placeholder="Parecer tecnico, conclusao e recomendacao."
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Anexos do teste">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <AttachmentInput
              existingUrls={existingAttachments}
              onExistingUrlsChange={setExistingAttachments}
              newFiles={newFiles}
              onNewFilesChange={setNewFiles}
              helperText=""
            />
            <AttachmentGallery urls={existingAttachments} />
          </div>
        </Panel>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <ActionButton onClick={onClose}>Cancelar</ActionButton>
          <ActionButton type="button" tone="emerald" disabled={saving} onClick={handleEncerrarTeste} className={saving ? "opacity-60" : ""}>
            <FaFlagCheckered />
            {saving ? "Salvando..." : "Encerrar teste"}
          </ActionButton>
          <ActionButton type="submit" tone="blue" disabled={saving} className={saving ? "opacity-60" : ""}>
            {saving ? "Salvando..." : "Salvar teste"}
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}

export default function SuprimentosTestes() {
  const { user } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  async function carregar() {
    setLoading(true);
    setErrorMessage("");
    const { data, error } = await supabase
      .from("suprimentos_testes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SuprimentosTestes:", error);
      setRows([]);
      setErrorMessage(error.message || "Erro ao carregar testes.");
    } else {
      setRows(
        (data || []).map((row) => ({
          ...row,
          anexos: Array.isArray(row?.anexos) ? row.anexos : [],
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const meta = deriveTesteMeta(row);
      const statusOk = statusFilter === "todos" ? true : meta.status === statusFilter;
      const searchOk = matchesSearch(row, search, [
        "numero_controle",
        "nome_teste",
        "peca",
        "codigo_peca",
        "fornecedor",
        "prefixo",
        "aberto_por_nome",
      ]);
      return statusOk && searchOk;
    });
  }, [rows, search, statusFilter]);

  const cards = useMemo(() => {
    const ativos = rows.filter((row) => deriveTesteMeta(row).status === "Ativo");
    const concluidos = rows.filter((row) => deriveTesteMeta(row).status === "Concluído");
    const aprovados = rows.filter((row) => row.resultado_final === "Aprovado");
    const reprovados = rows.filter((row) => row.resultado_final === "Reprovado");
    const comIntercorrencia = rows.filter((row) => parseTesteIntercorrencias(row).length > 0);
    const kmTotal = ativos.reduce((sum, row) => {
      const inicial = Number(row.km_inicial || 0);
      const atual = Number(row.km_atual || 0);
      return sum + Math.max(atual - inicial, 0);
    }, 0);

    return { ativos, concluidos, aprovados, reprovados, comIntercorrencia, kmTotal };
  }, [rows]);

  function openDetail(item) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Suprimentos"
        title="Testes"
        description=""
        actions={
          <>
            <ActionButton onClick={carregar}>
              <FaRedo /> Atualizar
            </ActionButton>
            <ActionButton tone="blue" onClick={() => setCreateOpen(true)}>
              <FaPlus /> Novo teste
            </ActionButton>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Testes ativos" value={cards.ativos.length} subtitle="Em campo e sem encerramento final" icon={<FaFlask />} tone="amber" />
        <KpiCard title="Testes concluidos" value={cards.concluidos.length} subtitle="Fechados com resultado final" icon={<FaFlagCheckered />} tone="emerald" />
        <KpiCard title="Aprovados" value={cards.aprovados.length} subtitle="Liberados tecnicamente" icon={<FaCheckCircle />} tone="cyan" />
        <KpiCard title="Reprovados" value={cards.reprovados.length} subtitle="Sem aderencia tecnica" icon={<FaTimesCircle />} tone="rose" />
        <KpiCard title="Com intercorrencia" value={cards.comIntercorrencia.length} subtitle="Ja tiveram ocorrencia registrada" icon={<FaExclamationTriangle />} tone="violet" />
        <KpiCard title="KM em teste" value={`${cards.kmTotal.toLocaleString("pt-BR")} km`} subtitle="Rodagem acumulada dos ativos" icon={<FaRoute />} tone="blue" />
      </section>

      <Panel title="Leitura mensal dos testes">
        <div className="grid gap-3 border-b border-slate-100 pb-4 lg:grid-cols-[1.2fr_0.45fr_0.25fr]">
          <label className="relative block">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar controle, teste, peca, fornecedor ou prefixo..."
              className={`${inputClass} pl-11`}
            />
          </label>

          <label className="block">
            <Label>Situacao</Label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
              <option value="todos">Todos</option>
              <option value="Ativo">Ativos</option>
              <option value="Concluído">Concluidos</option>
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Label>Na tela</Label>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{filteredRows.length}</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-500">Carregando testes...</div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="Nenhum teste encontrado" subtitle="Abra um teste novo para comecar a acompanhar a peca em campo." />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-4">Controle</th>
                    <th className="px-4 py-4">Teste</th>
                    <th className="px-4 py-4">Peca</th>
                    <th className="px-4 py-4">Prefixo</th>
                    <th className="px-4 py-4">KM</th>
                    <th className="px-4 py-4">Intercorrencia</th>
                    <th className="px-4 py-4">Situacao</th>
                    <th className="px-4 py-4">Aberto por</th>
                    <th className="px-4 py-4 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const meta = deriveTesteMeta(row);
                    const ultimaIntercorrencia = getTesteLastIntercorrencia(row);

                    return (
                      <tr
                        key={row.id}
                        onClick={() => openDetail(row)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60"
                      >
                        <td className="px-4 py-4 font-semibold text-slate-800">{row.numero_controle || "--"}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">{row.nome_teste}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{formatDateBR(row.data_inicio)}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-700">{row.peca}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.fornecedor}</p>
                        </td>
                        <td className="px-4 py-4 font-semibold text-slate-700">{row.prefixo || "--"}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-700">{formatKm(row.km_atual || row.km_inicial)}</p>
                          <p className="mt-1 text-xs text-slate-500">Inicial {formatKm(row.km_inicial)}</p>
                        </td>
                        <td className="px-4 py-4">
                          {ultimaIntercorrencia ? (
                            <>
                              <p className="font-semibold text-rose-600">{formatDateBR(ultimaIntercorrencia.data)}</p>
                              <p className="mt-1 text-xs text-slate-500">{formatKm(ultimaIntercorrencia.km)}</p>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">Sem ocorrencias</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <StatusChip label={meta.fase} tone={meta.tone} />
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-700">{row.aberto_por_nome || "--"}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateBR(row.created_at)}</p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                            <FaEye />
                            Abrir
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <QuickCreateTesteModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={carregar}
        user={user}
      />

      <TesteDetailModal
        open={detailOpen}
        item={detailItem}
        onClose={() => setDetailOpen(false)}
        onSaved={carregar}
      />
    </div>
  );
}
