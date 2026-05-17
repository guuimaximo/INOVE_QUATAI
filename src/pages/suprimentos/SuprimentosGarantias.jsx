import { useContext, useEffect, useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardList,
  FaCoins,
  FaEdit,
  FaEye,
  FaFilter,
  FaPlus,
  FaRedo,
  FaSearch,
  FaShieldAlt,
  FaTimesCircle,
  FaTools,
  FaTruckLoading,
  FaUserShield,
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
  StatusChip,
} from "./SuprimentosUI";
import {
  GARANTIA_RESULTADOS,
  GARANTIA_TIPOS_RETORNO,
  GARANTIA_TIPOS_SOLICITACAO,
  buildOpenedBy,
  deriveGarantiaMeta,
  formatCurrencyBR,
  formatDateBR,
  formatDateTimeBR,
  formatKm,
  matchesSearch,
  safeNumber,
  todayISO,
  uploadSuprimentosFiles,
} from "./suprimentosShared";

const EMPTY_FORM = {
  peca: "",
  codigo_peca: "",
  fornecedor: "",
  data_compra: "",
  valor_peca: "",
  prefixo: "",
  km_instalacao: "",
  km_falha: "",
  data_falha: todayISO(),
  tipo_solicitacao: "Ressarcimento",
  protocolo_fornecedor: "",
  enviado_fornecedor_em: "",
  observacao: "",
  resultado: "",
  tipo_retorno: "",
  valor_aprovado: "",
  retorno_fornecedor_em: "",
  previsao_recebimento: "",
  recebida_em: "",
  encerrada_em: "",
};

function GarantiaModal({ open, item, onClose, onSaved, user }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!item) {
      setForm(EMPTY_FORM);
      setExistingAttachments([]);
      setNewFiles([]);
      return;
    }

    setForm({
      peca: item.peca || "",
      codigo_peca: item.codigo_peca || "",
      fornecedor: item.fornecedor || "",
      data_compra: item.data_compra || "",
      valor_peca: item.valor_peca ?? "",
      prefixo: item.prefixo || "",
      km_instalacao: item.km_instalacao ?? "",
      km_falha: item.km_falha ?? "",
      data_falha: item.data_falha || todayISO(),
      tipo_solicitacao: item.tipo_solicitacao || "Ressarcimento",
      protocolo_fornecedor: item.protocolo_fornecedor || "",
      enviado_fornecedor_em: item.enviado_fornecedor_em || "",
      observacao: item.observacao || "",
      resultado: item.resultado || "",
      tipo_retorno: item.tipo_retorno || "",
      valor_aprovado: item.valor_aprovado ?? "",
      retorno_fornecedor_em: item.retorno_fornecedor_em || "",
      previsao_recebimento: item.previsao_recebimento || "",
      recebida_em: item.recebida_em || "",
      encerrada_em: item.encerrada_em || "",
    });
    setExistingAttachments(Array.isArray(item.anexos) ? item.anexos : []);
    setNewFiles([]);
  }, [item, open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);

    try {
      const uploaded = await uploadSuprimentosFiles(newFiles, `garantias/${form.prefixo || "sem-prefixo"}`);
      const payload = {
        peca: form.peca.trim(),
        codigo_peca: form.codigo_peca.trim() || null,
        fornecedor: form.fornecedor.trim(),
        data_compra: form.data_compra || null,
        valor_peca: safeNumber(form.valor_peca) ?? 0,
        prefixo: form.prefixo.trim(),
        km_instalacao: safeNumber(form.km_instalacao),
        km_falha: safeNumber(form.km_falha),
        data_falha: form.data_falha || null,
        tipo_solicitacao: form.tipo_solicitacao || null,
        protocolo_fornecedor: form.protocolo_fornecedor.trim() || null,
        enviado_fornecedor_em: form.enviado_fornecedor_em || null,
        observacao: form.observacao.trim() || null,
        resultado: form.resultado || null,
        tipo_retorno: form.resultado === "Aprovada" ? form.tipo_retorno || null : null,
        valor_aprovado: form.resultado === "Aprovada" ? safeNumber(form.valor_aprovado) : null,
        retorno_fornecedor_em: form.retorno_fornecedor_em || null,
        previsao_recebimento: form.previsao_recebimento || null,
        recebida_em: form.recebida_em || null,
        encerrada_em: form.encerrada_em || null,
        anexos: [...existingAttachments, ...uploaded],
        updated_at: new Date().toISOString(),
      };

      if (item?.id) {
        const { error } = await supabase.from("suprimentos_garantias").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suprimentos_garantias").insert({
          ...payload,
          ...buildOpenedBy(user),
        });
        if (error) throw error;
      }

      onSaved?.();
      onClose?.();
    } catch (error) {
      alert(`Erro ao salvar garantia: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  const showApprovedFields = form.resultado === "Aprovada";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[32px] border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.34em] text-blue-600">Suprimentos</p>
              <h2 className="mt-3 text-2xl font-black text-slate-900">{item ? "Atualizar garantia" : "Nova garantia"}</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">Controle a peça, a resposta do fornecedor e o fechamento da garantia sem depender de status manual.</p>
            </div>
            <ActionButton onClick={onClose}>Fechar</ActionButton>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Peça" required>
              <input value={form.peca} onChange={(e) => setForm((prev) => ({ ...prev, peca: e.target.value }))} className={inputClass} required />
            </Field>
            <Field label="Código da peça">
              <input value={form.codigo_peca} onChange={(e) => setForm((prev) => ({ ...prev, codigo_peca: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Fornecedor" required>
              <input value={form.fornecedor} onChange={(e) => setForm((prev) => ({ ...prev, fornecedor: e.target.value }))} className={inputClass} required />
            </Field>
            <Field label="Data da compra">
              <input type="date" value={form.data_compra} onChange={(e) => setForm((prev) => ({ ...prev, data_compra: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Valor da peça">
              <input type="number" min="0" step="0.01" value={form.valor_peca} onChange={(e) => setForm((prev) => ({ ...prev, valor_peca: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Prefixo" required>
              <CampoPrefixo value={form.prefixo} onChange={(value) => setForm((prev) => ({ ...prev, prefixo: value }))} label="" />
            </Field>
            <Field label="KM instalação">
              <input type="number" min="0" step="1" value={form.km_instalacao} onChange={(e) => setForm((prev) => ({ ...prev, km_instalacao: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="KM falha">
              <input type="number" min="0" step="1" value={form.km_falha} onChange={(e) => setForm((prev) => ({ ...prev, km_falha: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Data da falha" required>
              <input type="date" value={form.data_falha} onChange={(e) => setForm((prev) => ({ ...prev, data_falha: e.target.value }))} className={inputClass} required />
            </Field>
            <Field label="Tipo de solicitação">
              <select value={form.tipo_solicitacao} onChange={(e) => setForm((prev) => ({ ...prev, tipo_solicitacao: e.target.value }))} className={inputClass}>
                {GARANTIA_TIPOS_SOLICITACAO.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Protocolo / RMA">
              <input value={form.protocolo_fornecedor} onChange={(e) => setForm((prev) => ({ ...prev, protocolo_fornecedor: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Enviado ao fornecedor em">
              <input type="date" value={form.enviado_fornecedor_em} onChange={(e) => setForm((prev) => ({ ...prev, enviado_fornecedor_em: e.target.value }))} className={inputClass} />
            </Field>
            <Field label="Resultado">
              <select value={form.resultado} onChange={(e) => setForm((prev) => ({ ...prev, resultado: e.target.value, tipo_retorno: e.target.value === "Aprovada" ? prev.tipo_retorno : "", valor_aprovado: e.target.value === "Aprovada" ? prev.valor_aprovado : "" }))} className={inputClass}>
                <option value="">Em aberto</option>
                {GARANTIA_RESULTADOS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </Field>
            <Field label="Data do retorno">
              <input type="date" value={form.retorno_fornecedor_em} onChange={(e) => setForm((prev) => ({ ...prev, retorno_fornecedor_em: e.target.value }))} className={inputClass} />
            </Field>
            {showApprovedFields ? (
              <>
                <Field label="Tipo de retorno">
                  <select value={form.tipo_retorno} onChange={(e) => setForm((prev) => ({ ...prev, tipo_retorno: e.target.value }))} className={inputClass}>
                    <option value="">Selecione</option>
                    {GARANTIA_TIPOS_RETORNO.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Valor aprovado">
                  <input type="number" min="0" step="0.01" value={form.valor_aprovado} onChange={(e) => setForm((prev) => ({ ...prev, valor_aprovado: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Previsão de recebimento">
                  <input type="date" value={form.previsao_recebimento} onChange={(e) => setForm((prev) => ({ ...prev, previsao_recebimento: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="Data do recebimento">
                  <input type="date" value={form.recebida_em} onChange={(e) => setForm((prev) => ({ ...prev, recebida_em: e.target.value }))} className={inputClass} />
                </Field>
              </>
            ) : null}
            <Field label="Data de encerramento">
              <input type="date" value={form.encerrada_em} onChange={(e) => setForm((prev) => ({ ...prev, encerrada_em: e.target.value }))} className={inputClass} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Field label="Observação" className="h-full">
              <textarea value={form.observacao} onChange={(e) => setForm((prev) => ({ ...prev, observacao: e.target.value }))} className={`${inputClass} min-h-[140px]`} />
            </Field>
            <Panel title="Anexos" subtitle="Fotos, PDFs ou evidências da peça e da resposta do fornecedor." className="h-full">
              <AttachmentInput
                existingUrls={existingAttachments}
                onExistingUrlsChange={setExistingAttachments}
                newFiles={newFiles}
                onNewFilesChange={setNewFiles}
              />
            </Panel>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <ActionButton onClick={onClose}>Cancelar</ActionButton>
            <ActionButton type="submit" tone="blue" disabled={saving} className={saving ? "opacity-60" : ""}>
              {saving ? "Salvando..." : item ? "Atualizar garantia" : "Criar garantia"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function GarantiaDetail({ item }) {
  if (!item) return null;
  const meta = deriveGarantiaMeta(item);

  return (
    <Panel
      title={`${item.peca} · ${item.prefixo || "Sem prefixo"}`}
      subtitle={`Aberto por ${item.aberto_por_nome || "—"} em ${formatDateTimeBR(item.created_at)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <StatusChip label={meta.status} tone={meta.concluida ? "emerald" : "amber"} />
          <StatusChip label={meta.fase} tone={meta.tone} />
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <Detail label="Peça" value={item.peca} />
          <Detail label="Código" value={item.codigo_peca} />
          <Detail label="Fornecedor" value={item.fornecedor} />
          <Detail label="Prefixo" value={item.prefixo} />
          <Detail label="Data falha" value={formatDateBR(item.data_falha)} />
          <Detail label="KM falha" value={formatKm(item.km_falha)} />
          <Detail label="KM instalação" value={formatKm(item.km_instalacao)} />
          <Detail label="Valor peça" value={formatCurrencyBR(item.valor_peca)} />
          <Detail label="Solicitação" value={item.tipo_solicitacao} />
          <Detail label="Protocolo" value={item.protocolo_fornecedor} />
          <Detail label="Resultado" value={item.resultado || "Em aberto"} />
          <Detail label="Retorno" value={item.tipo_retorno || "—"} />
          <Detail label="Valor aprovado" value={item.valor_aprovado ? formatCurrencyBR(item.valor_aprovado) : "—"} />
          <Detail label="Recebida em" value={formatDateBR(item.recebida_em)} />
        </div>

        <div className="space-y-4">
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Observação</p>
            <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">{item.observacao || "Sem observações."}</p>
          </div>
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-400">Anexos</p>
            <div className="mt-3">
              <AttachmentGallery urls={item.anexos} />
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function Field({ label, required = false, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {label} {required ? "*" : ""}
      </span>
      {children}
    </label>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

const inputClass = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

export default function SuprimentosGarantias() {
  const { user } = useContext(AuthContext);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

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
      setRows((data || []).map((row) => ({ ...row, anexos: Array.isArray(row?.anexos) ? row.anexos : [] })));
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
      const searchOk = matchesSearch(row, search, ["peca", "codigo_peca", "fornecedor", "prefixo", "aberto_por_nome", "protocolo_fornecedor"]);
      return statusOk && searchOk;
    });
  }, [rows, search, statusFilter]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || filteredRows[0] || null, [filteredRows, rows, selectedId]);

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

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Suprimentos"
        title="Garantias"
        description="Acompanhe a peça, o prefixo, a resposta do fornecedor e o fechamento financeiro ou logístico da garantia no mesmo fluxo."
        actions={
          <>
            <ActionButton onClick={carregar}><FaRedo /> Atualizar</ActionButton>
            <ActionButton tone="blue" onClick={() => { setEditingItem(null); setEditorOpen(true); }}>
              <FaPlus /> Nova garantia
            </ActionButton>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <KpiCard title="Garantias abertas" value={cards.abertas.length} subtitle="Em tratamento ou aguardando fornecedor" icon={<FaShieldAlt />} tone="amber" />
        <KpiCard title="Garantias concluídas" value={cards.concluidas.length} subtitle="Fechadas por crédito, peça ou negativa" icon={<FaCheckCircle />} tone="emerald" />
        <KpiCard title="Aprovadas" value={cards.aprovadas.length} subtitle="Com resposta positiva do fornecedor" icon={<FaTruckLoading />} tone="cyan" />
        <KpiCard title="Negadas" value={cards.negadas.length} subtitle="Sem cobertura da garantia" icon={<FaTimesCircle />} tone="rose" />
        <KpiCard title="Valor em garantia" value={formatCurrencyBR(cards.valorEmGarantia)} subtitle="Somatório das garantias abertas" icon={<FaCoins />} tone="blue" />
        <KpiCard title="Valor recuperado" value={formatCurrencyBR(cards.valorRecuperado)} subtitle="Crédito ou valor reconhecido" icon={<FaTools />} tone="violet" />
      </section>

      <Panel
        title="Central de garantias"
        subtitle="Filtre a carteira e clique em uma linha para ver o detalhe completo."
      >
        <div className="grid gap-3 border-b border-slate-100 pb-4 lg:grid-cols-[1.2fr_0.45fr_0.25fr]">
          <label className="relative block">
            <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar peça, fornecedor, prefixo ou protocolo..."
              className={`${inputClass} pl-11`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-[0.2em] text-slate-500"><FaFilter className="mr-1 inline" /> Situação</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass}>
              <option value="todos">Todas</option>
              <option value="Aberta">Abertas</option>
              <option value="Concluída">Concluídas</option>
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Na tela</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{filteredRows.length}</p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{errorMessage}</div>
        ) : null}

        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-slate-500">Carregando garantias...</div>
        ) : filteredRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="Nenhuma garantia encontrada" subtitle="Ajuste os filtros ou abra a primeira garantia do cluster." />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3">Peça</th>
                    <th className="px-4 py-3">Fornecedor</th>
                    <th className="px-4 py-3">Prefixo</th>
                    <th className="px-4 py-3">Falha</th>
                    <th className="px-4 py-3">Solicitação</th>
                    <th className="px-4 py-3">Situação</th>
                    <th className="px-4 py-3">Aberto por</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const meta = deriveGarantiaMeta(row);
                    const active = selected?.id === row.id;
                    return (
                      <tr key={row.id} className={`border-t border-slate-100 transition hover:bg-slate-50 ${active ? "bg-blue-50/60" : ""}`}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setSelectedId(row.id)} className="text-left">
                            <p className="font-black text-slate-900">{row.peca}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{row.codigo_peca || "Sem código"}</p>
                          </button>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.fornecedor}</td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.prefixo || "—"}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{formatDateBR(row.data_falha)}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatKm(row.km_falha)}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">{row.tipo_solicitacao || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <StatusChip label={meta.status} tone={meta.concluida ? "emerald" : "amber"} />
                            <StatusChip label={meta.fase} tone={meta.tone} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{row.aberto_por_nome || "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDateBR(row.created_at)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <ActionButton className="px-3 py-2 text-xs" onClick={() => setSelectedId(row.id)}>
                              <FaEye /> Ver
                            </ActionButton>
                            <ActionButton className="px-3 py-2 text-xs" onClick={() => { setEditingItem(row); setEditorOpen(true); }}>
                              <FaEdit /> Editar
                            </ActionButton>
                          </div>
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

      {selected ? <GarantiaDetail item={selected} /> : null}

      <GarantiaModal
        open={editorOpen}
        item={editingItem}
        onClose={() => setEditorOpen(false)}
        onSaved={carregar}
        user={user}
      />
    </div>
  );
}
