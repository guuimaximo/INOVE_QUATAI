import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaCheckCircle,
  FaCoins,
  FaEye,
  FaFilter,
  FaPlus,
  FaRedo,
  FaSearch,
  FaShieldAlt,
  FaTimes,
  FaTimesCircle,
  FaTools,
  FaTruckLoading,
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
  SupplierAutocomplete,
  StatusChip,
} from "./SuprimentosUI";
import {
  GARANTIA_RESULTADOS,
  GARANTIA_TIPOS,
  GARANTIA_TIPOS_RETORNO,
  GARANTIA_TIPOS_SOLICITACAO,
  addDaysToISODate,
  buildOpenedBy,
  deriveGarantiaMeta,
  formatCurrencyBR,
  formatDateBR,
  formatDateTimeBR,
  formatKm,
  generateNextControlNumber,
  matchesSearch,
  safeNumber,
  todayISO,
  uploadSuprimentosFiles,
} from "./suprimentosShared";

const QUICK_FORM = {
  peca: "",
  codigo_peca: "",
  fornecedor: "",
  data_compra: "",
  valor_peca: "",
  tipo_garantia: "Peca comprada",
  prefixo: "",
  km_instalacao: "",
  km_falha: "",
  data_falha: todayISO(),
  tipo_solicitacao: "Ressarcimento",
};

const DETAIL_FORM = {
  protocolo_fornecedor: "",
  enviado_fornecedor_em: "",
  retirada_fornecedor_em: "",
  prazo_retorno_dias: "",
  observacao: "",
  resultado: "",
  tipo_retorno: "",
  valor_aprovado: "",
  retorno_fornecedor_em: "",
  previsao_recebimento: "",
  recebida_em: "",
  encerrada_em: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

function Field({ label, required = false, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-blue-950">
        {label} {required ? "*" : ""}
      </span>
      {children}
    </label>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-slate-950">{value || "--"}</p>
    </div>
  );
}

function SectionBlock({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function FlowStepCard({ title, date, tone, pendingLabel, actionLabel, onAction, editing, onDateChange, children }) {
  const activeClass = tone === "emerald"
    ? "border-emerald-200 bg-emerald-50"
    : tone === "amber"
      ? "border-amber-200 bg-amber-50"
      : "border-slate-200 bg-slate-50";
  const chipClass = date
    ? tone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-amber-100 text-amber-800"
    : "bg-white text-slate-500";

  return (
    <div className={`rounded-2xl border p-4 ${activeClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="mt-2 text-sm font-black text-slate-950">
            {date ? formatDateBR(date) : pendingLabel}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase ${chipClass}`}>
          {date ? "Registrado" : "Pendente"}
        </span>
      </div>
      {children ? <div className="mt-3 text-xs font-semibold text-slate-600">{children}</div> : null}
      {editing ? (
        <input
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          className={`${inputClass} mt-4`}
        />
      ) : null}
      <ActionButton
        tone={date ? "slate" : tone}
        onClick={onAction}
        className="mt-4 w-full justify-center"
      >
        {date ? `${title} em ${formatDateBR(date)}` : actionLabel}
      </ActionButton>
    </div>
  );
}

function ModalShell({ onClose, title, eyebrow, subtitle = null, actions = null, children }) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">{eyebrow}</p>
              <h2 className="mt-3 truncate text-2xl font-semibold text-slate-900">{title}</h2>
              {subtitle ? <p className="mt-2 text-sm font-medium text-slate-500">{subtitle}</p> : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <FaTimes />
                Fechar
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto bg-slate-50 p-5">{children}</div>
      </div>
    </div>
  );
}

function QuickCreateGarantiaModal({ open, onClose, onSaved, user }) {
  const [form, setForm] = useState(QUICK_FORM);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(QUICK_FORM);
    setNewFiles([]);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const uploaded = await uploadSuprimentosFiles(
        newFiles,
        `garantias/${form.prefixo || "sem-prefixo"}`
      );

      const numeroControle = await generateNextControlNumber("suprimentos_garantias", "GAR");
      const payload = {
        numero_controle: numeroControle,
        peca: form.peca.trim(),
        codigo_peca: form.codigo_peca.trim() || null,
        fornecedor: form.fornecedor.trim(),
        data_compra: form.data_compra || null,
        valor_peca: safeNumber(form.valor_peca) ?? 0,
        tipo_garantia: form.tipo_garantia || "Peca comprada",
        prefixo: form.prefixo.trim(),
        km_instalacao: safeNumber(form.km_instalacao),
        km_falha: safeNumber(form.km_falha),
        data_falha: form.data_falha || null,
        tipo_solicitacao: form.tipo_solicitacao || null,
        anexos: uploaded,
        updated_at: new Date().toISOString(),
        ...buildOpenedBy(user),
      };

      const { error } = await supabase.from("suprimentos_garantias").insert(payload).select().single();
      if (error) throw error;

      onSaved?.();
      onClose?.();
    } catch (error) {
      alert(`Erro ao criar garantia: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Nova garantia" eyebrow="Cadastro rapido">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
          <Field label="Fornecedor" required>
            <SupplierAutocomplete
              value={form.fornecedor}
              onChange={(v) => setForm((prev) => ({ ...prev, fornecedor: v }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Data da compra">
            <input
              type="date"
              value={form.data_compra}
              onChange={(e) => setForm((prev) => ({ ...prev, data_compra: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Valor da peca">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.valor_peca}
              onChange={(e) => setForm((prev) => ({ ...prev, valor_peca: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Tipo da garantia">
            <select
              value={form.tipo_garantia}
              onChange={(e) => setForm((prev) => ({ ...prev, tipo_garantia: e.target.value }))}
              className={inputClass}
            >
              {GARANTIA_TIPOS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prefixo" required>
            <CampoPrefixo
              value={form.prefixo}
              onChange={(value) => setForm((prev) => ({ ...prev, prefixo: value }))}
              label=""
            />
          </Field>
          <Field label="KM instalacao">
            <input
              type="number"
              min="0"
              step="1"
              value={form.km_instalacao}
              onChange={(e) => setForm((prev) => ({ ...prev, km_instalacao: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="KM falha">
            <input
              type="number"
              min="0"
              step="1"
              value={form.km_falha}
              onChange={(e) => setForm((prev) => ({ ...prev, km_falha: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Data da falha" required>
            <input
              type="date"
              value={form.data_falha}
              onChange={(e) => setForm((prev) => ({ ...prev, data_falha: e.target.value }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Tipo de solicitacao">
            <select
              value={form.tipo_solicitacao}
              onChange={(e) => setForm((prev) => ({ ...prev, tipo_solicitacao: e.target.value }))}
              className={inputClass}
            >
              {GARANTIA_TIPOS_SOLICITACAO.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
            {saving ? "Salvando..." : "Salvar garantia"}
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}

function GarantiaDetailModal({ open, item, onClose, onSaved, user }) {
  const [form, setForm] = useState(DETAIL_FORM);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingDatas, setEditingDatas] = useState(false);
  const userName = user?.nome || user?.nome_completo || user?.login || user?.email || "Usuario";

  useEffect(() => {
    if (!open || !item) return;
    setForm({
      enviado_fornecedor_em: item.enviado_fornecedor_em || "",
      retirada_fornecedor_em: item.retirada_fornecedor_em || "",
      prazo_retorno_dias: item.prazo_retorno_dias ?? "",
      observacao: item.observacao || "",
      resultado: item.resultado || "",
      tipo_retorno: item.tipo_retorno || "",
      valor_aprovado: item.valor_aprovado ?? "",
      retorno_fornecedor_em: item.retorno_fornecedor_em || "",
      previsao_recebimento: item.previsao_recebimento || "",
      recebida_em: item.recebida_em || "",
      encerrada_em: item.encerrada_em || "",
    });
    // Junta laudo + anexos numa lista só (compat com registros antigos)
    const anexos = Array.isArray(item.anexos) ? item.anexos : [];
    const laudos = Array.isArray(item.laudo_urls) ? item.laudo_urls : [];
    setExistingAttachments([...anexos, ...laudos]);
    setNewFiles([]);
    setEditingDatas(false);
  }, [item, open]);

  if (!open || !item) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const uploaded = await uploadSuprimentosFiles(
        newFiles,
        `garantias/${item.prefixo || "sem-prefixo"}`
      );

      const payload = {
        enviado_fornecedor_em: form.enviado_fornecedor_em || null,
        retirada_fornecedor_em: form.retirada_fornecedor_em || null,
        prazo_retorno_dias: safeNumber(form.prazo_retorno_dias),
        observacao: form.observacao.trim() || null,
        resultado: form.resultado || null,
        tipo_retorno: form.resultado === "Aprovada" ? form.tipo_retorno || null : null,
        valor_aprovado: form.resultado === "Aprovada" ? safeNumber(form.valor_aprovado) : null,
        retorno_fornecedor_em: form.retorno_fornecedor_em || null,
        previsao_recebimento: form.previsao_recebimento || null,
        recebida_em: form.recebida_em || null,
        encerrada_em: form.encerrada_em || null,
        anexos: [...existingAttachments, ...uploaded],
        laudo_urls: [],
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("suprimentos_garantias").update(payload).eq("id", item.id);
      if (error) throw error;

      onSaved?.();
      onClose?.();
    } catch (error) {
      alert(`Erro ao atualizar garantia: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  const meta = deriveGarantiaMeta({ ...item, ...form });
  const showApprovedFields = form.resultado === "Aprovada";
  const prazoRetornoData = addDaysToISODate(form.retirada_fornecedor_em, form.prazo_retorno_dias);

  return (
    <ModalShell
      onClose={onClose}
      title={`${item.numero_controle || "GAR"} · ${item.peca}`}
      eyebrow="Detalhes da garantia"
      subtitle={`Aberto por ${item.aberto_por_nome || "--"} em ${formatDateTimeBR(item.created_at)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          {meta.concluida
            ? <StatusChip label={meta.status} tone="emerald" />
            : <StatusChip label={meta.fase} tone={meta.tone} />
          }
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SectionBlock title="Resumo">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Detail label="Controle" value={item.numero_controle} />
          <Detail label="Tipo da garantia" value={item.tipo_garantia || "Peca comprada"} />
          <Detail label="Peca" value={item.peca} />
          <Detail label="Codigo" value={item.codigo_peca} />
          <Detail label="Fornecedor" value={item.fornecedor} />
          <Detail label="Prefixo" value={item.prefixo} />
          <Detail label="Data falha" value={formatDateBR(item.data_falha)} />
          <Detail label="KM falha" value={formatKm(item.km_falha)} />
          <Detail label="Solicitacao" value={item.tipo_solicitacao} />
        </div>
        </SectionBlock>

        <SectionBlock
          title="Andamento"
        >
        <div className="mb-4 flex justify-end">
          <ActionButton onClick={() => setEditingDatas((v) => !v)}>
            {editingDatas ? "Concluir edicao" : "Editar datas"}
          </ActionButton>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <FlowStepCard
            title="Retirada"
            date={form.retirada_fornecedor_em}
            tone="amber"
            pendingLabel="Aguardando retirada"
            actionLabel="Marcar peca retirada"
            editing={editingDatas}
            onDateChange={(value) => setForm((prev) => ({ ...prev, retirada_fornecedor_em: value }))}
            onAction={() => {
              if (form.retirada_fornecedor_em && !editingDatas) return;
              const now = new Date();
              const stamp = `Peca retirada por ${userName} em ${now.toLocaleString("pt-BR")}.`;
              setForm((prev) => ({
                ...prev,
                retirada_fornecedor_em: todayISO(),
                observacao: prev.observacao
                  ? (prev.observacao.includes(stamp) ? prev.observacao : `${prev.observacao}\n${stamp}`)
                  : stamp,
              }));
            }}
          >
            Saida da peca com o fornecedor para analise.
          </FlowStepCard>

          <FlowStepCard
            title="Retornada"
            date={form.retorno_fornecedor_em}
            tone="emerald"
            pendingLabel="Aguardando retorno"
            actionLabel="Marcar peca retornada"
            editing={editingDatas}
            onDateChange={(value) => setForm((prev) => ({ ...prev, retorno_fornecedor_em: value }))}
            onAction={() => {
              if (form.retorno_fornecedor_em && !editingDatas) return;
              const now = new Date();
              const stamp = `Peca retornada por ${userName} em ${now.toLocaleString("pt-BR")}.`;
              setForm((prev) => ({
                ...prev,
                retorno_fornecedor_em: todayISO(),
                observacao: prev.observacao
                  ? (prev.observacao.includes(stamp) ? prev.observacao : `${prev.observacao}\n${stamp}`)
                  : stamp,
              }));
            }}
          >
            Volta do fornecedor, seja por peca, credito ou negativa.
          </FlowStepCard>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Enviado em">
            <input
              type="date"
              value={form.enviado_fornecedor_em}
              onChange={(e) => setForm((prev) => ({ ...prev, enviado_fornecedor_em: e.target.value }))}
              className={inputClass}
              disabled={!editingDatas && Boolean(form.enviado_fornecedor_em)}
            />
          </Field>
          <Field label="Prazo (dias)">
            <input
              type="number"
              min="0"
              step="1"
              value={form.prazo_retorno_dias}
              onChange={(e) => setForm((prev) => ({ ...prev, prazo_retorno_dias: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <Field label="Limite do retorno">
            <input
              type="date"
              value={prazoRetornoData || ""}
              className={inputClass}
              disabled
            />
          </Field>
          <Field label="Resultado">
            <select
              value={form.resultado}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  resultado: e.target.value,
                  tipo_retorno: e.target.value === "Aprovada" ? prev.tipo_retorno : "",
                  valor_aprovado: e.target.value === "Aprovada" ? prev.valor_aprovado : "",
                }))
              }
              className={inputClass}
            >
              <option value="">Em aberto</option>
              {GARANTIA_RESULTADOS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          {showApprovedFields ? (
            <>
              <Field label="Tipo de retorno">
                <select
                  value={form.tipo_retorno}
                  onChange={(e) => setForm((prev) => ({ ...prev, tipo_retorno: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Selecione</option>
                  {GARANTIA_TIPOS_RETORNO.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor aprovado">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valor_aprovado}
                  onChange={(e) => setForm((prev) => ({ ...prev, valor_aprovado: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Previsao recebimento">
                <input
                  type="date"
                  value={form.previsao_recebimento}
                  onChange={(e) => setForm((prev) => ({ ...prev, previsao_recebimento: e.target.value }))}
                  className={inputClass}
                />
              </Field>
              <Field label="Recebida em">
                <input
                  type="date"
                  value={form.recebida_em}
                  onChange={(e) => setForm((prev) => ({ ...prev, recebida_em: e.target.value }))}
                  className={inputClass}
                />
              </Field>
            </>
          ) : null}
          <Field label="Encerramento">
            <input
              type="date"
              value={form.encerrada_em}
              onChange={(e) => setForm((prev) => ({ ...prev, encerrada_em: e.target.value }))}
              className={inputClass}
            />
          </Field>
        </div>
        </SectionBlock>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionBlock title="Observacao">
            <textarea
              value={form.observacao}
              onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))}
              className={`${inputClass} min-h-[190px]`}
            />
          </SectionBlock>
        <SectionBlock title="Anexos" className="h-full">
            <AttachmentInput
              existingUrls={existingAttachments}
              onExistingUrlsChange={setExistingAttachments}
              newFiles={newFiles}
              onNewFilesChange={setNewFiles}
              helperText=""
            />
          </SectionBlock>
        </div>

        <SectionBlock title="Arquivos salvos">
          <AttachmentGallery urls={existingAttachments} />
        </SectionBlock>

        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <ActionButton onClick={onClose}>Fechar</ActionButton>
          <ActionButton type="submit" tone="blue" disabled={saving} className={saving ? "opacity-60" : ""}>
            {saving ? "Salvando..." : "Salvar detalhes"}
          </ActionButton>
        </div>
      </form>
    </ModalShell>
  );
}

export default function SuprimentosGarantias() {
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
      .from("suprimentos_garantias")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("SuprimentosGarantias:", error);
      setRows([]);
      setErrorMessage(error.message || "Erro ao carregar garantias.");
    } else {
      setRows(
        (data || []).map((row) => ({
          ...row,
          anexos: Array.isArray(row?.anexos) ? row.anexos : [],
          laudo_urls: Array.isArray(row?.laudo_urls) ? row.laudo_urls : [],
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
      const meta = deriveGarantiaMeta(row);
      const statusOk = statusFilter === "todos" ? true : meta.status === statusFilter;
      const searchOk = matchesSearch(row, search, [
        "numero_controle",
        "peca",
        "codigo_peca",
        "fornecedor",
        "tipo_garantia",
        "prefixo",
        "aberto_por_nome",
        "protocolo_fornecedor",
      ]);
      return statusOk && searchOk;
    });
  }, [rows, search, statusFilter]);

  const cards = useMemo(() => {
    const abertas = rows.filter((row) => deriveGarantiaMeta(row).status === "Aberta");
    const concluidas = rows.filter((row) => deriveGarantiaMeta(row).status === "Concluída");
    const aprovadas = rows.filter((row) => row.resultado === "Aprovada");
    const negadas = rows.filter((row) => row.resultado === "Negada");
    const valorEmGarantia = abertas.reduce((sum, row) => sum + Number(row.valor_peca || 0), 0);
    const valorRecuperado = rows
      .filter((row) => row.resultado === "Aprovada")
      .reduce((sum, row) => sum + Number(row.valor_aprovado || row.valor_peca || 0), 0);

    return { abertas, concluidas, aprovadas, negadas, valorEmGarantia, valorRecuperado };
  }, [rows]);

  function openDetail(item) {
    setDetailItem(item);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Suprimentos"
        title="Garantias"
        description=""
        actions={
          <>
            <ActionButton onClick={carregar}>
              <FaRedo /> Atualizar
            </ActionButton>
            <ActionButton tone="blue" onClick={() => setCreateOpen(true)}>
              <FaPlus /> Nova garantia
            </ActionButton>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Garantias abertas" value={cards.abertas.length} subtitle="Em tratamento ou aguardando fornecedor" icon={<FaShieldAlt />} tone="amber" />
        <KpiCard title="Garantias concluidas" value={cards.concluidas.length} subtitle="Fechadas por credito, peca ou negativa" icon={<FaCheckCircle />} tone="emerald" />
        <KpiCard title="Aprovadas" value={cards.aprovadas.length} subtitle="Com resposta positiva do fornecedor" icon={<FaTruckLoading />} tone="cyan" />
        <KpiCard title="Negadas" value={cards.negadas.length} subtitle="Sem cobertura da garantia" icon={<FaTimesCircle />} tone="rose" />
        <KpiCard title="Valor em garantia" value={formatCurrencyBR(cards.valorEmGarantia)} subtitle="Somatorio das garantias abertas" icon={<FaCoins />} tone="blue" />
        <KpiCard title="Valor recuperado" value={formatCurrencyBR(cards.valorRecuperado)} subtitle="Credito ou valor reconhecido" icon={<FaTools />} tone="violet" />
      </section>

      <Panel title="Central de garantias">
        <div className="grid gap-3 border-b border-slate-100 pb-4 lg:grid-cols-[1.2fr_0.45fr_0.25fr]">
          <label className="relative block">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar controle, peca, fornecedor, prefixo ou protocolo..."
              className={`${inputClass} pl-11`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <FaFilter className="mr-1 inline" /> Situacao
            </span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
              <option value="todos">Todas</option>
              <option value="Aberta">Abertas</option>
              <option value="Concluída">Concluidas</option>
            </select>
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Na tela</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredRows.length}</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-500">Carregando garantias...</div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="Nenhuma garantia encontrada" subtitle="Ajuste os filtros ou abra a primeira garantia do cluster." />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Controle</th>
                    <th className="px-4 py-3">Peca</th>
                    <th className="px-4 py-3">Fornecedor</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Falha</th>
                    <th className="px-4 py-3">Solicitacao</th>
                    <th className="px-4 py-3">Situacao</th>
                    <th className="px-4 py-3">Aberto por</th>
                    <th className="px-4 py-3 text-right">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const meta = deriveGarantiaMeta(row);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => openDetail(row)}
                        className="cursor-pointer border-t border-slate-100 transition hover:bg-blue-50/60"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.numero_controle || "--"}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{row.peca}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{row.codigo_peca || "Sem codigo"}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.fornecedor}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.prefixo || "--"}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{formatDateBR(row.data_falha)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatKm(row.km_falha)}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.tipo_solicitacao || "--"}</td>
                        <td className="px-4 py-3">
                          <StatusChip label={meta.fase} tone={meta.tone} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{row.aberto_por_nome || "--"}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateBR(row.created_at)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
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

      <QuickCreateGarantiaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={carregar}
        user={user}
      />

      <GarantiaDetailModal
        open={detailOpen}
        item={detailItem}
        onClose={() => setDetailOpen(false)}
        onSaved={carregar}
        user={user}
      />
    </div>
  );
}
