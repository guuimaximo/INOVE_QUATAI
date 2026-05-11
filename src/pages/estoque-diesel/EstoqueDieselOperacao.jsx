import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCamera,
  FaGasPump,
  FaInfoCircle,
  FaSave,
  FaTrash,
  FaTint,
} from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  DEFAULT_PARAMS,
  MONTHS_2026,
  PRODUCT_CONFIG,
  buildDefaultForm,
  computeMeasurement,
  fetchDieselReceipts,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getDailyReceipts,
  getMonthLabel,
  getPreviousEntry,
  measurementStatus,
  saveDieselReceipt,
  saveMeasurementEntry,
  todayISO,
  validateMeasurement,
} from "./medicaoModel";
import { useAuth } from "../../context/AuthContext";

function parsePct(value) {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function parseLiters(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`;
}

function parseCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toFormValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

const DIESEL_RECEIPTS_TABLE = "estoque_diesel_recebimentos";


function buildFormFromEntry(entry, product, year, month) {
  const base = buildDefaultForm(product, year, month);
  const pumpNumbers = PRODUCT_CONFIG[product]?.requiredPumpNumbers || [];
  const entryPumps = Array.isArray(entry?.pumps) ? entry.pumps : [];

  return {
    ...base,
    id: entry?.id || null,
    product,
    date: entry?.date || base.date,
    reguaAnteriorT1: toFormValue(entry?.reguaAnteriorT1),
    reguaAnteriorT2: toFormValue(entry?.reguaAnteriorT2),
    reguaFinalT1: toFormValue(entry?.reguaFinalT1),
    reguaFinalT2: toFormValue(entry?.reguaFinalT2),
    hasReceipt: Boolean(entry?.hasReceipt || Number(entry?.nfVolumeLitros || 0) > 0),
    nfVolumeLitros: toFormValue(entry?.nfVolumeLitros),
    unitPrice: toFormValue(entry?.unitPrice),
    supplier: entry?.supplier || "",
    supplierId: entry?.supplierId || null,
    nfNumero: entry?.nfNumero || "",
    receiptRuleBeforeT1: toFormValue(entry?.receiptRuleBeforeT1),
    receiptRuleBeforeT2: toFormValue(entry?.receiptRuleBeforeT2),
    receiptRuleAfterT1: toFormValue(entry?.receiptRuleAfterT1),
    receiptRuleAfterT2: toFormValue(entry?.receiptRuleAfterT2),
    receiptPhotoBeforeUrl: entry?.receiptPhotoBeforeUrl || "",
    receiptPhotoAfterUrl: entry?.receiptPhotoAfterUrl || "",
    transnetOutput: toFormValue(entry?.transnetOutput ?? entry?.saidaTransnet),
    observation: entry?.observation || "",
    pumps: pumpNumbers.map((number) => {
      const currentPump = entryPumps.find((pump) => Number(pump.number) === Number(number));
      return {
        number,
        initial: toFormValue(currentPump?.initial),
        final: toFormValue(currentPump?.final),
      };
    }),
  };
}

function FormInput({ label, value, onChange, type = "number", min, step = "0.1", placeholder, required = false, readOnly = false }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        min={min}
        step={type === "number" ? step : undefined}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        className={`mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
          readOnly ? "bg-slate-100" : "bg-white"
        }`}
      />
    </label>
  );
}

function FileInput({ label, onChange, fileName }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  function pickFile(file) {
    if (!file) return;
    onChange(file);
  }

  function handlePaste(event) {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type?.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (file) {
      event.preventDefault();
      pickFile(file);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const file = Array.from(event.dataTransfer?.files || []).find((item) => item.type?.startsWith("image/"));
    pickFile(file || null);
  }

  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        className={`mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left text-sm font-semibold text-slate-600 transition ${
          dragActive
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 bg-white hover:border-blue-300 hover:bg-blue-50"
        }`}
      >
        <FaCamera className="text-slate-400" />
        <div className="min-w-0 flex-1">
          <span className="block truncate">{fileName || "Selecionar foto, arrastar aqui ou colar com CTRL+V"}</span>
          <span className="mt-1 block text-xs font-bold text-slate-400">
            Aceita clique, arrastar e soltar, ou colar imagem.
          </span>
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} />
      </button>
    </label>
  );
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="">Selecione</option>
        {value === "__custom__" ? <option value="__custom__">Cadastrar novo fornecedor</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({ title, value, sub, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
      {sub ? <p className="mt-1 text-xs font-bold opacity-80">{sub}</p> : null}
    </div>
  );
}

function getStatusDescription(label) {
  if (label === "Critico") {
    return "Diferenca de NF ou de Transnet acima do limite critico configurado.";
  }
  if (label === "Atencao") {
    return "Existe divergencia acima da faixa de atencao e o dia pede conferencia.";
  }
  return "Dia dentro da faixa esperada para NF, tanque, bombas e Transnet.";
}

function getPctTone(value, warn = 0.01, critical = 0.03) {
  if (value === null || value === undefined || Number.isNaN(value)) return "slate";
  const absValue = Math.abs(Number(value));
  if (absValue > critical) return "rose";
  if (absValue > warn) return "amber";
  return "emerald";
}

function recalculateProductEntriesCascade({ entries, receipts, product, params, year, month }) {
  const productEntries = [...(entries || [])]
    .filter((entry) => entry.product === product)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const recalculatedById = new Map();
  let previousEntry = null;

  productEntries.forEach((entry) => {
    const entryDate = entry?.date || "";
    const entryMonth = entryDate.slice(5, 7) || month;
    const form = buildFormFromEntry(entry, product, year, entryMonth);
    const dailyReceipts = getDailyReceipts(receipts, product, form.date);
    const computed = computeMeasurement(form, params, previousEntry, dailyReceipts);
    const status = measurementStatus(computed, params);

    const recalculatedEntry = {
      ...entry,
      saldoAnterior: computed.medicaoD1,
      medicaoD1: computed.medicaoD1,
      medicaoInicial: computed.medicaoInicial,
      medicaoAtual: computed.medicaoAtual,
      entradaDiesel: computed.entradaDiesel,
      entradaRecebimentos: computed.entradaRecebimentos,
      saldoFinal: computed.saldoFinal ?? computed.medicaoAtual,
      saidaTanque: computed.saidaTanque,
      saidaTotalBombas: computed.saidaTotalBombas,
      saidaTransnet: computed.saidaTransnet,
      receiptMeasuredLiters: computed.receiptMeasuredLiters,
      pctDiffNF: computed.pctDiffNF,
      pctDiffTankBombas: computed.pctDiffTankBombas,
      pctDiffTransnet: computed.pctDiffTransnet,
      status: status.label,
      statusTone: status.tone,
      _cascadeRecalculated: true,
    };

    recalculatedById.set(entry.id, recalculatedEntry);
    previousEntry = recalculatedEntry;
  });

  return (entries || []).map((entry) => recalculatedById.get(entry.id) || entry);
}

function MonthNavigation({ month, product }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MONTHS_2026.map((item) => {
        const active = item.month === month;
        return (
          <Link
            key={item.month}
            to={`/estoque-diesel/operacao/2026/${item.month}?produto=${product}`}
            className={`rounded-xl border px-3 py-2 text-sm font-black transition ${
              active
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.label.slice(0, 3)}
          </Link>
        );
      })}
    </div>
  );
}

function ProductSwitcher({ product, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.values(PRODUCT_CONFIG).map((item) => {
        const active = item.code === product;
        return (
          <button
            key={item.code}
            type="button"
            onClick={() => onChange(item.code)}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
              active
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.code === "S500" ? <FaTint /> : <FaGasPump />}
            {item.code}
          </button>
        );
      })}
    </div>
  );
}

export default function EstoqueDieselOperacao() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const year = params.ano || "2026";
  const month = params.mes || todayISO().slice(5, 7);
  const initialProduct = searchParams.get("produto") || "S500";

  const [entries, setEntries] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [paramStore, setParamStore] = useState(DEFAULT_PARAMS);
  const [metadata, setMetadata] = useState(null);
  const [product, setProduct] = useState(initialProduct in PRODUCT_CONFIG ? initialProduct : "S500");
  const [form, setForm] = useState(() => buildDefaultForm(initialProduct in PRODUCT_CONFIG ? initialProduct : "S500", year, month));
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [deletingReceipt, setDeletingReceipt] = useState(false);
  const [receiptFiles, setReceiptFiles] = useState({ before: null, after: null });
  const [customSupplierMode, setCustomSupplierMode] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const launchPanelRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadData(nextProduct) {
      try {
        setLoading(true);
        setFeedback(null);
        const context = await fetchMeasurementContext();
        const [nextEntries, nextReceipts] = await Promise.all([
          fetchMeasurementEntries({
            year,
            metadata: context.metadata,
            paramStore: context.paramStore,
            includePumps: true,
          }),
          fetchDieselReceipts({
            year,
            metadata: context.metadata,
          }),
        ]);
        if (!active) return;
        setMetadata(context.metadata);
        setParamStore(context.paramStore);
        setEntries(nextEntries);
        setReceipts(nextReceipts);
        setProduct(nextProduct);
        setForm(buildDefaultForm(nextProduct, year, month));
        setReceiptFiles({ before: null, after: null });
        setCustomSupplierMode(false);
        setSelectedReceiptId(null);
      } catch (error) {
        if (!active) return;
        console.error("Falha ao carregar medição de diesel:", error);
        setFeedback({
          type: "error",
          message: "Nao foi possivel carregar os dados do Supabase.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    const nextProduct = initialProduct in PRODUCT_CONFIG ? initialProduct : "S500";
    loadData(nextProduct);

    return () => {
      active = false;
    };
  }, [initialProduct, month, year]);

  const productParams = paramStore[product] || DEFAULT_PARAMS[product];
  const recalculatedEntries = useMemo(
    () =>
      recalculateProductEntriesCascade({
        entries,
        receipts,
        product,
        params: productParams,
        year,
        month,
      }),
    [entries, receipts, product, productParams, year, month]
  );

  const monthlyEntries = useMemo(
    () =>
      recalculatedEntries
        .filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [recalculatedEntries, month, product, year]
  );

  const previousEntry = useMemo(
    () => getPreviousEntry(recalculatedEntries, product, form.date, form.id),
    [recalculatedEntries, form.date, form.id, product]
  );

  const dailyReceipts = useMemo(
    () => getDailyReceipts(receipts, product, form.date),
    [form.date, product, receipts]
  );
  const selectedDailyReceipt = useMemo(
    () => dailyReceipts.find((receipt) => receipt.id === selectedReceiptId) || null,
    [dailyReceipts, selectedReceiptId]
  );

  const computed = useMemo(
    () => computeMeasurement(form, productParams, previousEntry, dailyReceipts),
    [dailyReceipts, form, previousEntry, productParams]
  );

  const validation = useMemo(
    () => validateMeasurement(form, computed, productParams),
    [computed, form, productParams]
  );

  const status = useMemo(
    () => measurementStatus(computed, productParams),
    [computed, productParams]
  );
  const isS500 = product === "S500";
  const isS10 = product === "S10";
  const receiptRuleBeforeField = isS500 ? "receiptRuleBeforeT2" : "receiptRuleBeforeT1";
  const receiptRuleAfterField = isS500 ? "receiptRuleAfterT2" : "receiptRuleAfterT1";
  const supplierOptions = useMemo(
    () => [...new Set((productParams.suppliers || []).map((item) => String(item || "").trim()).filter(Boolean))],
    [productParams.suppliers]
  );
  const showCustomSupplierInput = customSupplierMode || (form.supplier && !supplierOptions.includes(form.supplier));

  function updatePump(index, field, value) {
    setForm((current) => ({
      ...current,
      pumps: current.pumps.map((pump, pumpIndex) =>
        pumpIndex === index ? { ...pump, [field]: value } : pump
      ),
    }));
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetFormForNewEntry() {
    setForm(buildDefaultForm(product, year, month));
    setReceiptFiles({ before: null, after: null });
    setCustomSupplierMode(false);
    setSelectedReceiptId(null);
    setFeedback(null);
  }

  function handleSelectEntry(entry) {
    setForm(buildFormFromEntry(entry, product, year, month));
    setReceiptFiles({ before: null, after: null });
    setCustomSupplierMode(Boolean(entry?.supplier && !supplierOptions.includes(entry.supplier)));
    setSelectedReceiptId(null);
    setFeedback({
      type: "success",
      message: `Lancamento de ${new Date(`${entry.date}T00:00:00`).toLocaleDateString("pt-BR")} carregado para conferencia.`,
    });
    window.requestAnimationFrame(() => {
      launchPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  useEffect(() => {
    setForm((current) => {
      const next = { ...current };
      const hasExistingPreviousRule =
        current.reguaAnteriorT1 !== "" || current.reguaAnteriorT2 !== "";

      if (!hasExistingPreviousRule && previousEntry) {
        next.reguaAnteriorT1 = previousEntry.reguaFinalT1 ?? "";
        next.reguaAnteriorT2 = previousEntry.reguaFinalT2 ?? "";
      }

      next.pumps = current.pumps.map((pump) => {
        const previousPump = (previousEntry?.pumps || []).find(
          (entryPump) => Number(entryPump.number) === Number(pump.number)
        );
        if (previousPump && (pump.initial === "" || pump.initial === null || pump.initial === undefined)) {
          return { ...pump, initial: previousPump.final ?? "" };
        }
        return pump;
      });

      return next;
    });
  }, [previousEntry]);

  useEffect(() => {
    if (!form.supplier) {
      setCustomSupplierMode(false);
    }
  }, [form.supplier]);

  async function handleSave() {
    if (Object.keys(validation.errors).length > 0) {
      setFeedback({
        type: "error",
        message: Object.values(validation.errors)[0],
      });
      return;
    }

    if (
      form.hasReceipt &&
      !receiptFiles.before &&
      !String(form.receiptPhotoBeforeUrl || "").trim()
    ) {
      setFeedback({
        type: "error",
        message: "Anexe a foto da regua antes do recebimento.",
      });
      return;
    }

    if (
      form.hasReceipt &&
      !receiptFiles.after &&
      !String(form.receiptPhotoAfterUrl || "").trim()
    ) {
      setFeedback({
        type: "error",
        message: "Anexe a foto da regua depois do recebimento.",
      });
      return;
    }

    if (!metadata) {
      setFeedback({
        type: "error",
        message: "Os metadados do tanque ainda nao foram carregados.",
      });
      return;
    }

    try {
      setSaving(true);
      await saveMeasurementEntry({
        form,
        computed,
        product,
        params: productParams,
        metadata,
        userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null,
        receiptFiles,
      });

      const nextEntries = await fetchMeasurementEntries({
        year,
        metadata,
        paramStore,
        includePumps: true,
      });
      const nextReceipts = await fetchDieselReceipts({
        year,
        metadata,
      });

      setEntries(nextEntries);
      setReceipts(nextReceipts);
      setFeedback({
        type: "success",
        message: "Lancamento salvo no Supabase. Os saldos seguintes foram recalculados automaticamente na tela.",
      });
      resetFormForNewEntry();
    } catch (error) {
      console.error("Falha ao salvar medição:", error);
      setFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel salvar o lancamento no Supabase.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveReceipt() {
    if (!form.hasReceipt) {
      setFeedback({
        type: "error",
        message: "Ative o recebimento e preencha os dados antes de salvar.",
      });
      return;
    }

    if ((computed.receiptMeasuredLiters ?? null) === null) {
      setFeedback({
        type: "error",
        message: "Preencha as reguas do recebimento para salvar essa entrada.",
      });
      return;
    }

    if (
      !receiptFiles.before &&
      !String(form.receiptPhotoBeforeUrl || "").trim()
    ) {
      setFeedback({
        type: "error",
        message: "Anexe a foto da regua antes do recebimento.",
      });
      return;
    }

    if (
      !receiptFiles.after &&
      !String(form.receiptPhotoAfterUrl || "").trim()
    ) {
      setFeedback({
        type: "error",
        message: "Anexe a foto da regua depois do recebimento.",
      });
      return;
    }

    if (!metadata) {
      setFeedback({
        type: "error",
        message: "Os metadados do tanque ainda nao foram carregados.",
      });
      return;
    }

    try {
      setSavingReceipt(true);
      await saveDieselReceipt({
        form,
        computed,
        product,
        params: productParams,
        metadata,
        userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null,
        receiptFiles,
      });

      const nextReceipts = await fetchDieselReceipts({
        year,
        metadata,
      });
      setReceipts(nextReceipts);
      setReceiptFiles({ before: null, after: null });
      setSelectedReceiptId(null);
      setForm((current) => ({
        ...current,
        hasReceipt: false,
        nfVolumeLitros: "",
        unitPrice: "",
        supplier: "",
        supplierId: null,
        nfNumero: "",
        receiptRuleBeforeT1: "",
        receiptRuleBeforeT2: "",
        receiptRuleAfterT1: "",
        receiptRuleAfterT2: "",
        receiptPhotoBeforeUrl: "",
        receiptPhotoAfterUrl: "",
      }));
      setCustomSupplierMode(false);
      setFeedback({
        type: "success",
        message: "Recebimento salvo e somado automaticamente no dia.",
      });
    } catch (error) {
      console.error("Falha ao salvar recebimento:", error);
      setFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel salvar o recebimento.",
      });
    } finally {
      setSavingReceipt(false);
    }
  }

  async function handleDeleteReceipt(receipt) {
    if (!receipt?.id || !metadata) return;

    const confirmDelete = window.confirm(
      `Confirma a exclusão do recebimento${receipt.nfNumero ? ` NF ${receipt.nfNumero}` : ""}? Essa ação remove o recebimento do dia e recalcula os saldos automaticamente.`
    );

    if (!confirmDelete) return;

    try {
      setDeletingReceipt(true);

      const { error } = await supabase
        .from(DIESEL_RECEIPTS_TABLE)
        .delete()
        .eq("id", receipt.id);

      if (error) throw error;

      const nextReceipts = await fetchDieselReceipts({
        year,
        metadata,
      });

      setReceipts(nextReceipts);
      setSelectedReceiptId(null);
      setReceiptFiles({ before: null, after: null });
      setForm((current) => ({
        ...current,
        hasReceipt: false,
        nfVolumeLitros: "",
        unitPrice: "",
        supplier: "",
        supplierId: null,
        nfNumero: "",
        receiptRuleBeforeT1: "",
        receiptRuleBeforeT2: "",
        receiptRuleAfterT1: "",
        receiptRuleAfterT2: "",
        receiptPhotoBeforeUrl: "",
        receiptPhotoAfterUrl: "",
      }));
      setCustomSupplierMode(false);

      setFeedback({
        type: "success",
        message: "Recebimento excluído. O fechamento do dia e os saldos seguintes foram recalculados automaticamente na tela.",
      });
    } catch (error) {
      console.error("Falha ao excluir recebimento:", error);
      setFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel excluir o recebimento.",
      });
    } finally {
      setDeletingReceipt(false);
    }
  }

  function handleProductChange(nextProduct) {
    navigate(`/estoque-diesel/operacao/${year}/${month}?produto=${nextProduct}`);
  }

  function prepareNewReceipt() {
    setSelectedReceiptId(null);
    setReceiptFiles({ before: null, after: null });
    setCustomSupplierMode(false);
    setForm((current) => ({
      ...current,
      hasReceipt: true,
      nfVolumeLitros: "",
      unitPrice: "",
      supplier: "",
      supplierId: null,
      nfNumero: "",
      receiptRuleBeforeT1: "",
      receiptRuleBeforeT2: "",
      receiptRuleAfterT1: "",
      receiptRuleAfterT2: "",
      receiptPhotoBeforeUrl: "",
      receiptPhotoAfterUrl: "",
    }));
  }

  return (
    <EstoqueDieselPageShell
      title="Medicao de Diesel"
      description={`Lancamento diario de ${PRODUCT_CONFIG[product].label} em ${getMonthLabel(month)} de ${year}, com calculos automaticos iguais ao raciocinio da planilha.`}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard title="Produto" value={product} sub={PRODUCT_CONFIG[product].label} tone="blue" />
        <SummaryCard title="Mes" value={getMonthLabel(month)} sub={`${year} pronto no Inove`} tone="slate" />
        <SummaryCard title="Status do dia" value={status.label} sub={getStatusDescription(status.label)} tone={status.tone} />
        <SummaryCard
          title="Lancamentos no mes"
          value={String(monthlyEntries.length)}
          sub="Historico da tabela abaixo"
          tone="emerald"
        />
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link
              to="/estoque-diesel/resumo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <FaArrowLeft />
              Voltar para 2026
            </Link>
            <h2 className="mt-4 text-lg font-black text-slate-800">Abertura do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              O mes fica fixo aqui em cima. Dentro da pagina, o lancamento do dia ja vem com a data de hoje quando ela pertence a este mes.
            </p>
          </div>
          <div className="space-y-3">
            <MonthNavigation month={month} product={product} />
            <ProductSwitcher product={product} onChange={handleProductChange} />
          </div>
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div ref={launchPanelRef} className="xl:col-span-2">
        <EstoqueDieselPanel className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800">Lancamento do dia</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                O operador informa a medicao atual, a saida do Transnet e, se houver, o recebimento do diesel. O restante vem do D-1 e dos calculos automaticos.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
              {isS500
                ? "S500 exige regua atual T2 e usa bombas 2 e 3."
                : "S10 exige regua atual T1 e usa bomba 1."}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {form.id ? (
                <>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-700">
                    Editando {new Date(`${form.date}T00:00:00`).toLocaleDateString("pt-BR")}
                  </div>
                  <button
                    type="button"
                    onClick={resetFormForNewEntry}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                  >
                    Novo lancamento
                  </button>
                </>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
                  Fluxo operacional da medicao
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" type="date" value={form.date} onChange={(value) => updateField("date", value)} required readOnly={Boolean(form.id)} />
            <FormInput label="Regua atual T1 (cm)" value={form.reguaFinalT1} onChange={(value) => updateField("reguaFinalT1", value)} required={isS10} />
            <FormInput label="Regua atual T2 (cm)" value={form.reguaFinalT2} onChange={(value) => updateField("reguaFinalT2", value)} required={isS500} />
            <FormInput label="Saida Transnet (litros)" value={form.transnetOutput} onChange={(value) => updateField("transnetOutput", value)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Medicao D-1</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoD1)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Vem automaticamente do ultimo saldo final salvo para {product}.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Medicao inicial</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoInicial)}</p>
              <p className="mt-1 text-sm font-semibold text-blue-700">
                Leitura realizada pela regua atual T1 e T2 no inicio do dia.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-700">Medicao atual</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoAtual)}</p>
              <p className="mt-1 text-sm font-semibold text-amber-700">
                Soma da medicao inicial com o recebimento considerado no dia.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-emerald-700">Recebimento de diesel</h3>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  Se houve recebimento, informe NF, fornecedor, regua antes e depois, e anexe as fotos. O volume entra automaticamente na conta do dia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateField("hasReceipt", !form.hasReceipt)}
                className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-black transition ${
                  form.hasReceipt
                    ? "bg-emerald-700 text-white hover:bg-emerald-800"
                    : "border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-100"
                }`}
              >
                {form.hasReceipt ? "Recebimento ativo" : "Sem recebimento"}
              </button>
            </div>

            {form.hasReceipt ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormInput label="Volume NF (litros)" value={form.nfVolumeLitros} onChange={(value) => updateField("nfVolumeLitros", value)} required />
                <div className="space-y-2">
                  <SelectInput
                    label="Fornecedor"
                    value={showCustomSupplierInput ? "__custom__" : form.supplier}
                    options={supplierOptions}
                    onChange={(value) => {
                      if (value === "__custom__") {
                        setCustomSupplierMode(true);
                        setForm((current) => ({ ...current, supplier: "", supplierId: null }));
                        return;
                      }
                      setCustomSupplierMode(false);
                      updateField("supplier", value);
                      updateField("supplierId", null);
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomSupplierMode(true);
                        updateField("supplier", "");
                        updateField("supplierId", null);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                    >
                      Novo fornecedor
                    </button>
                    {showCustomSupplierInput ? (
                      <div className="min-w-[220px] flex-1">
                        <FormInput
                          label="Cadastrar fornecedor"
                          type="text"
                          value={form.supplier}
                          onChange={(value) => {
                            updateField("supplier", value);
                            updateField("supplierId", null);
                          }}
                          placeholder="Digite o nome do fornecedor"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
                <FormInput label="Numero da NF" type="text" value={form.nfNumero} onChange={(value) => updateField("nfNumero", value)} />
                <FormInput label="Valor unitario" value={form.unitPrice} onChange={(value) => updateField("unitPrice", value)} step="0.01" />
                <FormInput
                  label={`Regua antes ${isS500 ? "T2" : "T1"} (cm)`}
                  value={form[receiptRuleBeforeField]}
                  onChange={(value) => updateField(receiptRuleBeforeField, value)}
                  required
                />
                <FileInput
                  label="Foto da regua antes"
                  onChange={(file) => setReceiptFiles((current) => ({ ...current, before: file }))}
                  fileName={receiptFiles.before?.name || form.receiptPhotoBeforeUrl?.split("/").pop() || ""}
                />
                <FormInput
                  label={`Regua depois ${isS500 ? "T2" : "T1"} (cm)`}
                  value={form[receiptRuleAfterField]}
                  onChange={(value) => updateField(receiptRuleAfterField, value)}
                  required
                />
                <FileInput
                  label="Foto da regua depois"
                  onChange={(file) => setReceiptFiles((current) => ({ ...current, after: file }))}
                  fileName={receiptFiles.after?.name || form.receiptPhotoAfterUrl?.split("/").pop() || ""}
                />
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">Valor total da NF</div>
                  <div className="mt-2 text-lg font-black text-slate-800">
                    {parseCurrency((Number(form.unitPrice || 0) || 0) * (Number(form.nfVolumeLitros || 0) || 0))}
                  </div>
                </div>
              </div>
            ) : null}
            {dailyReceipts.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-wider text-emerald-700">Recebimentos salvos do dia</h4>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Clique em um recebimento para consultar os dados. Se precisar, lance outro logo abaixo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={prepareNewReceipt}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Lançar mais um
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {dailyReceipts.map((receipt) => (
                    <button
                      key={receipt.id}
                      type="button"
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        selectedReceiptId === receipt.id
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                            NF {receipt.nfNumero || "-"} • {receipt.supplier || "Sem fornecedor"}
                          </div>
                          <div className="mt-2 text-lg font-black text-slate-800">
                            {parseLiters(receipt.volumeRecebidoLitros || receipt.nfVolumeLitros)}
                          </div>
                        </div>
                        <div className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                          receipt.status === "Critico"
                            ? "bg-rose-50 text-rose-700"
                            : receipt.status === "Atencao"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}>
                          {receipt.status}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {selectedDailyReceipt ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <h5 className="text-sm font-black uppercase tracking-wider text-slate-600">
                          Consulta do recebimento
                        </h5>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {selectedDailyReceipt.supplier || "Sem fornecedor"} • NF {selectedDailyReceipt.nfNumero || "-"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
                          {selectedDailyReceipt.date
                            ? new Date(`${selectedDailyReceipt.date}T00:00:00`).toLocaleDateString("pt-BR")
                            : "Sem data"}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteReceipt(selectedDailyReceipt)}
                          disabled={deletingReceipt}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          <FaTrash />
                          {deletingReceipt ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Volume NF</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{parseLiters(selectedDailyReceipt.nfVolumeLitros)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Recebimento medido</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{parseLiters(selectedDailyReceipt.volumeRecebidoLitros)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Valor unitario</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{parseCurrency(selectedDailyReceipt.unitPrice)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Valor total</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{parseCurrency(selectedDailyReceipt.totalValue)}</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {form.hasReceipt ? (
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={handleSaveReceipt}
                  disabled={savingReceipt || deletingReceipt}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
                >
                  <FaSave />
                  {savingReceipt ? "Salvando recebimento..." : "Salvar recebimento"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Bombas</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">S500 usa bombas 2 e 3. S10 usa bomba 1.</p>
              <div className="mt-4 space-y-4">
                {form.pumps.map((pump, index) => {
                  const previousPump = (previousEntry?.pumps || []).find(
                    (entryPump) => Number(entryPump.number) === Number(pump.number)
                  );
                  const hasPreviousPump = Boolean(
                    previousPump &&
                      previousPump.final !== null &&
                      previousPump.final !== undefined &&
                      previousPump.final !== ""
                  );

                  return (
                    <div key={pump.number} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-800">Bomba {pump.number}</p>
                        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
                          Saida {parseLiters(computed.pumpDetails[index]?.output)}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormInput
                          label="Hodometro inicial"
                          value={pump.initial}
                          onChange={(value) => updatePump(index, "initial", value)}
                          readOnly={hasPreviousPump}
                        />
                        <FormInput
                          label="Hodometro final"
                          value={pump.final}
                          onChange={(value) => updatePump(index, "final", value)}
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {hasPreviousPump
                          ? "O hodometro inicial veio automaticamente do encerrante do dia anterior."
                          : "Sem historico anterior para esta bomba. Informe o hodometro inicial manualmente no primeiro lancamento."}
                      </p>
                      {validation.errors[`pump_${pump.number}`] ? (
                        <p className="mt-2 text-xs font-bold text-rose-600">
                          {validation.errors[`pump_${pump.number}`]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Observacao do dia</h3>
              <textarea
                value={form.observation}
                onChange={(event) => updateField("observation", event.target.value)}
                rows={8}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Use este campo quando a divergencia passar do limite ou houver qualquer fato operacional relevante."
              />

              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                Medicao D-1 considerada: <span className="font-black">{parseLiters(computed.medicaoD1)}</span>
              </div>

              {dailyReceipts.length > 0 ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Recebimentos do dia considerados no fechamento: <span className="font-black">{dailyReceipts.length}</span>
                  <br />
                  Volume total somado na medicao atual: <span className="font-black">{parseLiters(computed.entradaRecebimentos)}</span>
                </div>
              ) : null}

              {form.hasReceipt ? (
                <div
                  className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                    computed.receiptBelowExpected
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : computed.receiptWithinTolerance === false
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  Recebimento medido: <span className="font-black">{parseLiters(computed.receiptMeasuredLiters)}</span>
                  <br />
                  Tolerancia da faixa: <span className="font-black">{parseLiters(computed.receiptToleranceLiters)}</span>
                  <br />
                  Valor unitario: <span className="font-black">{parseCurrency(Number(form.unitPrice || 0) || 0)}</span>
                  <br />
                  Situacao:{" "}
                  <span className="font-black">
                    {computed.receiptWithinTolerance === null
                      ? "Aguardando dados"
                      : computed.receiptBelowExpected
                      ? "Abaixo do esperado"
                      : computed.receiptWithinTolerance
                      ? "Dentro da tolerancia"
                      : "Acima da tolerancia"}
                  </span>
                </div>
              ) : null}

              {validation.errors.reguaFinal ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {validation.errors.reguaFinal}
                </div>
              ) : null}

              {validation.errors.nfVolumeLitros || validation.errors.supplier || validation.errors.receiptBefore || validation.errors.receiptAfter ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {validation.errors.nfVolumeLitros ||
                    validation.errors.supplier ||
                    validation.errors.receiptBefore ||
                    validation.errors.receiptAfter}
                </div>
              ) : null}

              {validation.warnings.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  <div className="flex items-center gap-2 font-black">
                    <FaExclamationTriangle />
                    Validacoes do dia
                  </div>
                  <ul className="mt-2 space-y-1">
                    {validation.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-600">
              O sistema calcula os indicadores automaticamente e salva o lancamento no Supabase.
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
            >
              <FaSave />
              {saving ? "Salvando..." : "Salvar lancamento"}
            </button>
          </div>

          {feedback ? (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}
        </EstoqueDieselPanel>
        </div>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Resumo calculado</h2>
          <div className="mt-4 space-y-3">
            <SummaryCard title="Medicao D-1" value={parseLiters(computed.medicaoD1)} tone="slate" />
            <SummaryCard title="Medicao inicial" value={parseLiters(computed.medicaoInicial)} tone="blue" />
            <SummaryCard title="Medicao atual" value={parseLiters(computed.medicaoAtual)} tone="blue" />
            <SummaryCard
              title="Recebimento considerado"
              value={parseLiters(computed.entradaDiesel)}
              tone={form.hasReceipt || dailyReceipts.length > 0 ? "emerald" : "slate"}
            />
            <SummaryCard title="Saida tanque" value={parseLiters(computed.saidaTanque)} tone="amber" />
            <SummaryCard title="Saida total bombas" value={parseLiters(computed.saidaTotalBombas)} tone="amber" />
            <SummaryCard title="Saida Transnet" value={parseLiters(computed.saidaTransnet)} tone="amber" />
            <SummaryCard
              title="Recebimento medido"
              value={parseLiters(computed.receiptMeasuredLiters)}
              tone={
                computed.receiptBelowExpected
                  ? "rose"
                  : computed.receiptWithinTolerance === false
                  ? "amber"
                  : "emerald"
              }
            />
            <SummaryCard title="% Dif NF x Recebido" value={parsePct(computed.pctDiffNF)} tone={computed.receiptBelowExpected ? "rose" : getPctTone(computed.pctDiffNF, productParams.nfDiffWarnPct || 0.01, productParams.nfDiffCriticalPct || 0.03)} />
            <SummaryCard title="% Dif Tanque x Bombas" value={parsePct(computed.pctDiffTankBombas)} tone={getPctTone(computed.pctDiffTankBombas, productParams.transnetWarnPct || 0.02, productParams.transnetCriticalPct || 0.03)} />
            <SummaryCard title="% Dif Tanque x Transnet" value={parsePct(computed.pctDiffTransnet)} tone={getPctTone(computed.pctDiffTransnet, productParams.transnetWarnPct || 0.02, productParams.transnetCriticalPct || 0.03)} />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Tabela do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Historico consolidado de {getMonthLabel(month)} de {year} para {product}. Os saldos são recalculados em cascata a partir do primeiro dia alterado.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <FaInfoCircle />
            1 linha por dia
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  "Data",
                  "Saldo ant.",
                  "NF",
                  "Entrada diesel",
                  "Saldo final",
                  "Saida tanque",
                  "Bombas",
                  "Transnet",
                  "% NF",
                  "% Tanque x Transnet",
                  "Status",
                ].map((header, index, array) => (
                  <th
                    key={header}
                    className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${
                      index === array.length - 1 ? "rounded-r-2xl" : ""
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    {loading ? "Carregando lançamentos..." : "Ainda nao ha lancamentos para este mes."}
                  </td>
                </tr>
              ) : (
                monthlyEntries.map((entry) => {
                  const isSelected = form.id === entry.id;
                  return (
                  <tr
                    key={entry.id}
                    onClick={() => handleSelectEntry(entry)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? "bg-blue-50/60" : ""}`}
                  >
                    <td className={`px-4 py-3 font-black ${isSelected ? "text-blue-700" : "text-slate-800"}`}>
                      {new Date(`${entry.date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saldoAnterior)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.nfVolumeLitros)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.entradaDiesel)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saldoFinal)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTanque)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTotalBombas)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTransnet)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parsePct(entry.pctDiffNF)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parsePct(entry.pctDiffTransnet)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                          entry.status === "Critico"
                            ? "bg-rose-50 text-rose-700"
                            : entry.status === "Atencao"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {entry.status === "OK" ? <FaCheckCircle /> : <FaExclamationTriangle />}
                        {entry.status}
                      </span>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>
    </EstoqueDieselPageShell>
  );
}
