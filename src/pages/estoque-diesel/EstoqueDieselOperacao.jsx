import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCamera,
  FaCog,
  FaGasPump,
  FaInfoCircle,
  FaSave,
  FaTint,
  FaTrash,
  FaTimes,
} from "react-icons/fa";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import MediaPreviewModal from "../../components/MediaPreviewModal";
import {
  DEFAULT_PARAMS,
  MONTHS_2026,
  PRODUCT_CONFIG,
  buildDefaultForm,
  computeMeasurement,
  deletePumpInitialAdjustment,
  fetchDieselReceipts,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getPumpInitialAdjustment,
  getDailyReceipts,
  getMonthLabel,
  getPreviousEntry,
  measurementStatus,
  saveDieselReceipt,
  saveMeasurementEntry,
  savePumpInitialAdjustment,
  todayISO,
  validateMeasurement,
} from "./medicaoModel";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../supabase";

const DIESEL_RECEIPTS_TABLE = "estoque_diesel_recebimentos";

function parsePct(value) {
  if (value === null || value === undefined) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function parseLiters(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} L`;
}

function parseHodometro(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
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

function buildPumpAdjustmentLookup(metadata, product, dateValue) {
  const lookup = {};
  const requiredPumpNumbers = PRODUCT_CONFIG[product]?.requiredPumpNumbers || [];
  const dbPumps = (metadata?.pumpsByProduct?.[product] || []).filter((pump) =>
    requiredPumpNumbers.includes(Number(pump.numero))
  );

  dbPumps.forEach((pump) => {
    const adjustment = getPumpInitialAdjustment(metadata, pump.id, dateValue);
    if (adjustment) {
      lookup[Number(pump.numero)] = adjustment;
    }
  });

  return lookup;
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

function ReceiptPhotoCard({ label, url, onOpen }) {
  const hasPhoto = Boolean(url);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div>
      {hasPhoto ? (
        <button
          type="button"
          onClick={() => onOpen(url, label)}
          className="mt-3 block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left transition hover:border-blue-300 hover:bg-blue-50"
        >
          <img
            src={url}
            alt={label}
            className="h-40 w-full object-cover"
          />
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-700">
            <FaCamera />
            Abrir foto
          </div>
        </button>
      ) : (
        <div className="mt-3 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 text-center text-xs font-black uppercase tracking-wider text-slate-400">
          Sem foto
        </div>
      )}
    </div>
  );
}

function getStatusDescription(label) {
  if (label === "Critico") {
    return "Diferenca de planejado, recebido ou Transnet acima do limite critico configurado.";
  }
  if (label === "Atencao") {
    return "Existe divergencia acima da faixa de atencao e o dia pede conferencia.";
  }
  return "Dia dentro da faixa esperada para planejado, recebido, tanque, bombas e Transnet.";
}

function getPctTone(value, warn = 0.01, critical = 0.03) {
  if (value === null || value === undefined || Number.isNaN(value)) return "slate";
  const absValue = Math.abs(Number(value));
  if (absValue > critical) return "rose";
  if (absValue > warn) return "amber";
  return "emerald";
}

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundNumber(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(decimals));
}

function calculatePctDifference(reference, compared) {
  const base = safeNumber(reference, 0);
  const current = safeNumber(compared, 0);

  if (!base) return null;

  return (current - base) / base;
}

function resolveCascadeStatus(entry, productParams) {
  const warnTransnet = productParams?.transnetWarnPct ?? 0.02;
  const criticalTransnet = productParams?.transnetCriticalPct ?? 0.03;
  const warnNf = productParams?.nfDiffWarnPct ?? 0.01;
  const criticalNf = productParams?.nfDiffCriticalPct ?? 0.03;

  const checks = [entry.pctDiffTransnet, entry.pctDiffTankBombas].filter(
    (value) => value !== null && value !== undefined && !Number.isNaN(Number(value))
  );

  const nfDiff = entry.pctDiffNF;
  if (nfDiff !== null && nfDiff !== undefined && !Number.isNaN(Number(nfDiff))) {
    const absNf = Math.abs(Number(nfDiff));
    if (absNf > criticalNf) return "Critico";
    if (absNf > warnNf) return "Atencao";
  }

  const maxOperationalDiff = checks.reduce(
    (max, value) => Math.max(max, Math.abs(Number(value))),
    0
  );

  if (maxOperationalDiff > criticalTransnet) return "Critico";
  if (maxOperationalDiff > warnTransnet) return "Atencao";
  return "OK";
}

function buildCascadeMonthlyEntries(entries, receipts, productParams) {
  const chronological = [...(entries || [])].sort(
    (a, b) => String(a.date || "").localeCompare(String(b.date || ""))
  );
  const receiptTotalsByDate = (receipts || []).reduce((acc, receipt) => {
    if (!receipt?.date) return acc;
    if (!acc[receipt.date]) {
      acc[receipt.date] = {
        nfVolumeLitros: 0,
        volumeRecebidoLitros: 0,
      };
    }

    acc[receipt.date].nfVolumeLitros += safeNumber(receipt.nfVolumeLitros, 0);
    acc[receipt.date].volumeRecebidoLitros += safeNumber(
      receipt.volumeRecebidoLitros ?? receipt.nfVolumeLitros,
      0
    );
    return acc;
  }, {});

  let previousSaldoFinal = null;

  const recalculated = chronological.map((entry) => {
    const saldoAnterior =
      previousSaldoFinal === null
        ? safeNumber(entry.saldoAnterior, 0)
        : previousSaldoFinal;

    // O saldo final vem da régua/medição já salva. Não converte, não multiplica e não recalcula.
    const saldoFinal = safeNumber(
      entry.saldoFinal ?? entry.medicaoAtual ?? entry.medicaoInicial,
      0
    );

    const entradaDiesel = safeNumber(entry.entradaDiesel, 0);
    const saidaTanque = saldoAnterior + entradaDiesel - saldoFinal;
    const saidaTotalBombas = safeNumber(entry.saidaTotalBombas, 0);
    const saidaTransnet = safeNumber(entry.saidaTransnet, 0);
    const receiptTotals = receiptTotalsByDate[entry.date] || null;
    const inlineNf = safeNumber(entry.nfVolumeLitros, 0);
    const inlineReceived = safeNumber(entry.receiptMeasuredLiters ?? entry.entradaRecebimentos, 0);
    const totalNf = safeNumber(receiptTotals?.nfVolumeLitros, 0) + inlineNf;
    const totalReceived = safeNumber(receiptTotals?.volumeRecebidoLitros, 0) + inlineReceived;
    const recebidoDiesel = totalReceived > 0 ? totalReceived : entradaDiesel;
    const saldoInicialDia = roundNumber(saldoAnterior - saidaTanque);
    const pctDiffNF =
      totalNf > 0 ? calculatePctDifference(totalNf, recebidoDiesel) : entry.pctDiffNF ?? null;

    const pctDiffTankBombas = calculatePctDifference(saidaTanque, saidaTotalBombas);
    const pctDiffTransnet = calculatePctDifference(saidaTanque, saidaTransnet);

    const nextEntry = {
      ...entry,
      saldoAnterior,
      saldoInicialDia,
      saldoFinal,
      nfVolumeLitros: totalNf,
      entradaDiesel,
      recebidoDiesel,
      saidaTanque,
      pctDiffNF,
      pctDiffTankBombas,
      pctDiffTransnet,
    };

    nextEntry.status = resolveCascadeStatus(nextEntry, productParams);
    previousSaldoFinal = saldoFinal;

    return nextEntry;
  });

  return recalculated.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
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
  const [receiptFiles, setReceiptFiles] = useState({ before: null, after: null });
  const [customSupplierMode, setCustomSupplierMode] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [editingReceiptId, setEditingReceiptId] = useState(null);
  const [deletingReceipt, setDeletingReceipt] = useState(false);
  const [showDailyLaunch, setShowDailyLaunch] = useState(false);
  const [showPumpConfig, setShowPumpConfig] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [pumpConfigDrafts, setPumpConfigDrafts] = useState({});
  const [savingPumpConfigId, setSavingPumpConfigId] = useState(null);
  const launchPanelRef = useRef(null);
  const receiptFormRef = useRef(null);

  function buildPreparedForm(baseForm, sourceEntries = entries, sourceMetadata = metadata, options = {}) {
    const { forcePumpInitials = false } = options;
    const preparedForm = {
      ...baseForm,
      pumps: Array.isArray(baseForm?.pumps) ? baseForm.pumps.map((pump) => ({ ...pump })) : [],
    };
    const sourcePreviousEntry = getPreviousEntry(
      sourceEntries,
      preparedForm.product,
      preparedForm.date,
      preparedForm.id
    );
    const adjustmentLookup = buildPumpAdjustmentLookup(
      sourceMetadata,
      preparedForm.product,
      preparedForm.date
    );

    const hasExistingPreviousRule =
      preparedForm.reguaAnteriorT1 !== "" || preparedForm.reguaAnteriorT2 !== "";

    if (!hasExistingPreviousRule && sourcePreviousEntry) {
      preparedForm.reguaAnteriorT1 = sourcePreviousEntry.reguaFinalT1 ?? "";
      preparedForm.reguaAnteriorT2 = sourcePreviousEntry.reguaFinalT2 ?? "";
    }

    preparedForm.pumps = preparedForm.pumps.map((pump) => {
      const adjustment = adjustmentLookup[Number(pump.number)] || null;
      const previousPump = (sourcePreviousEntry?.pumps || []).find(
        (entryPump) => Number(entryPump.number) === Number(pump.number)
      );

      if (adjustment) {
        return {
          ...pump,
          initial: toFormValue(adjustment.hodometro_inicial),
        };
      }

      if (previousPump && (forcePumpInitials || pump.initial === "" || pump.initial === null || pump.initial === undefined)) {
        return {
          ...pump,
          initial: toFormValue(previousPump.final),
        };
      }

      return pump;
    });

    return preparedForm;
  }

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
        setForm(
          buildPreparedForm(
            buildDefaultForm(nextProduct, year, month),
            nextEntries,
            context.metadata,
            { forcePumpInitials: true }
          )
        );
        setReceiptFiles({ before: null, after: null });
        setCustomSupplierMode(false);
        setSelectedReceiptId(null);
        setShowDailyLaunch(false);
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
  const monthlyEntries = useMemo(
    () =>
      entries
        .filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`))
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [entries, month, product, year]
  );

  const monthlyDisplayEntries = useMemo(
    () =>
      buildCascadeMonthlyEntries(
        monthlyEntries,
        receipts.filter(
          (receipt) =>
            (receipt.product === product || receipt.tipoDiesel === product) &&
            receipt.date?.startsWith(`${year}-${month}`)
        ),
        productParams
      ),
    [monthlyEntries, month, product, productParams, receipts, year]
  );

  const previousEntry = useMemo(
    () => getPreviousEntry(entries, product, form.date, form.id),
    [entries, form.date, form.id, product]
  );
  const currentProductPumps = useMemo(
    () =>
      (metadata?.pumpsByProduct?.[product] || [])
        .filter((pump) => PRODUCT_CONFIG[product]?.requiredPumpNumbers?.includes(Number(pump.numero)))
        .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0)),
    [metadata, product]
  );
  const currentPumpAdjustments = useMemo(
    () => buildPumpAdjustmentLookup(metadata, product, form.date),
    [form.date, metadata, product]
  );

  const dailyReceipts = useMemo(
    () => getDailyReceipts(receipts, product, form.date),
    [form.date, product, receipts]
  );
  const plannedDieselLiters = useMemo(() => {
    // A modal "Recebimento de diesel" virou a fonte unica do planejado/recebido.
    // Se ja existem recebimentos salvos para o dia, o planejado do form legacy
    // (form.nfVolumeLitros) e ignorado para nao duplicar a conta.
    const externalPlanned = dailyReceipts.reduce(
      (sum, receipt) => sum + safeNumber(receipt.nfVolumeLitros, 0),
      0
    );
    if (dailyReceipts.length > 0) {
      return roundNumber(externalPlanned) ?? 0;
    }
    const inlinePlanned = form.hasReceipt ? safeNumber(form.nfVolumeLitros, 0) : 0;
    return roundNumber(inlinePlanned) ?? 0;
  }, [dailyReceipts, form.hasReceipt, form.nfVolumeLitros]);
  const selectedDailyReceipt = useMemo(
    () => dailyReceipts.find((receipt) => receipt.id === selectedReceiptId) || null,
    [dailyReceipts, selectedReceiptId]
  );
  const selectedReceiptFallbackEntry = useMemo(() => {
    if (!selectedDailyReceipt) return null;

    return (
      monthlyEntries.find((entry) => {
        if (entry.date !== selectedDailyReceipt.date) return false;
        if (!entry.receiptPhotoBeforeUrl && !entry.receiptPhotoAfterUrl) return false;
        if (!selectedDailyReceipt.nfNumero || !entry.nfNumero) return true;
        return String(entry.nfNumero) === String(selectedDailyReceipt.nfNumero);
      }) || null
    );
  }, [monthlyEntries, selectedDailyReceipt]);
  const selectedReceiptPhotoBeforeUrl =
    selectedDailyReceipt?.fotoAntesUrl || selectedReceiptFallbackEntry?.receiptPhotoBeforeUrl || "";
  const selectedReceiptPhotoAfterUrl =
    selectedDailyReceipt?.fotoDepoisUrl || selectedReceiptFallbackEntry?.receiptPhotoAfterUrl || "";

  const computed = useMemo(
    () =>
      computeMeasurement(
        {
          ...form,
          pumps: (form.pumps || []).map((pump) => ({
            ...pump,
            adjustment: currentPumpAdjustments[Number(pump.number)] || null,
          })),
        },
        productParams,
        previousEntry,
        dailyReceipts
      ),
    [currentPumpAdjustments, dailyReceipts, form, previousEntry, productParams]
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
  const isEditingReceipt = Boolean(editingReceiptId);

  function updatePump(index, field, value) {
    setForm((current) => ({
      ...current,
      pumps: current.pumps.map((pump, pumpIndex) =>
        pumpIndex === index ? { ...pump, [field]: value } : pump
      ),
    }));
  }

  function updateField(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // Trocar manualmente a data deve repuxar regua anterior e hodometros
      // iniciais a partir do D-1 daquela data; senao a tela fica com os
      // dados do dia anterior (carregados quando o form foi aberto).
      if (field === "date" && !current.id && value && value !== current.date) {
        return buildPreparedForm(next, entries, metadata, { forcePumpInitials: true });
      }
      return next;
    });
  }

  function clearReceiptFields() {
    setReceiptFiles({ before: null, after: null });
    setEditingReceiptId(null);
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
  }

  function handleEditReceipt(receipt) {
    if (!receipt) return;

    setShowReceiptModal(true);
    setEditingReceiptId(receipt.id);
    setSelectedReceiptId(receipt.id);
    setReceiptFiles({ before: null, after: null });
    setCustomSupplierMode(Boolean(receipt?.supplier && !supplierOptions.includes(receipt.supplier)));
    setForm((current) => ({
      ...current,
      hasReceipt: true,
      date: receipt.date || current.date,
      nfVolumeLitros: toFormValue(receipt.nfVolumeLitros),
      unitPrice: toFormValue(receipt.unitPrice),
      supplier: receipt.supplier || "",
      supplierId: receipt.supplierId || null,
      nfNumero: receipt.nfNumero || "",
      receiptRuleBeforeT1: isS10 ? toFormValue(receipt.reguaAntesCm) : "",
      receiptRuleBeforeT2: isS500 ? toFormValue(receipt.reguaAntesCm) : "",
      receiptRuleAfterT1: isS10 ? toFormValue(receipt.reguaDepoisCm) : "",
      receiptRuleAfterT2: isS500 ? toFormValue(receipt.reguaDepoisCm) : "",
      receiptPhotoBeforeUrl: receipt.fotoAntesUrl || "",
      receiptPhotoAfterUrl: receipt.fotoDepoisUrl || "",
    }));
    setFeedback({
      type: "success",
      message: `Recebimento ${receipt.nfNumero ? `NF ${receipt.nfNumero}` : ""} carregado para edicao.`,
    });
  }

  function resetFormForNewEntry(overrides = {}) {
    const { entriesOverride, metadataOverride, dateOverride } = overrides;
    const usableEntries = entriesOverride || entries;
    const usableMetadata = metadataOverride || metadata;
    const baseForm = buildDefaultForm(product, year, month);

    if (dateOverride) {
      baseForm.date = dateOverride;
    } else {
      // Pega a data do ultimo lancamento do mes atual e abre no dia seguinte.
      // Se nao houver nenhum lancamento no mes, segue o default (hoje ou
      // primeiro dia do mes). Assim "Novo lancamento" nao volta para 01.
      const ultimoDoMes = (usableEntries || [])
        .filter((e) => e.product === product && e.date && e.date.startsWith(`${year}-${month}`))
        .map((e) => e.date)
        .sort()
        .pop();
      if (ultimoDoMes) {
        const proxima = getNextDateAfter(ultimoDoMes);
        if (proxima && proxima.startsWith(`${year}-${month}`)) {
          baseForm.date = proxima;
        }
      }
    }

    setForm(buildPreparedForm(baseForm, usableEntries, usableMetadata, { forcePumpInitials: true }));
    setReceiptFiles({ before: null, after: null });
    setCustomSupplierMode(false);
    setSelectedReceiptId(null);
    setEditingReceiptId(null);
    setFeedback(null);
  }

  function getNextDateAfter(dateStr) {
    if (!dateStr) return null;
    try {
      const d = new Date(`${dateStr}T00:00:00`);
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return null;
    }
  }

  function handleStartDailyLaunch() {
    const defaultLaunchDate = buildDefaultForm(product, year, month).date;
    const existingDailyEntry = monthlyEntries.find((entry) => entry.date === defaultLaunchDate);

    if (existingDailyEntry) {
      handleSelectEntry(existingDailyEntry);
      return;
    }

    resetFormForNewEntry();
    setShowDailyLaunch(true);
    window.requestAnimationFrame(() => {
      launchPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleHideDailyLaunch() {
    setShowDailyLaunch(false);
    setShowPumpConfig(false);
  }

  function handleSelectEntry(entry) {
    setShowDailyLaunch(true);
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
      const next = buildPreparedForm(current);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }
      return next;
    });
  }, [currentPumpAdjustments, previousEntry]);

  useEffect(() => {
    const nextDrafts = {};
    currentProductPumps.forEach((pump) => {
      const adjustment = currentPumpAdjustments[Number(pump.numero)] || null;
      nextDrafts[pump.id] = {
        initial: adjustment ? toFormValue(adjustment.hodometro_inicial) : "",
        observation: adjustment?.observacao || "",
      };
    });
    setPumpConfigDrafts(nextDrafts);
  }, [currentProductPumps, currentPumpAdjustments]);

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
        message: "Lancamento salvo no Supabase. A tabela abaixo foi recalculada em cascata mantendo a régua original.",
      });
      // Pula automaticamente para o proximo dia (apos o dia que acabamos
      // de salvar). E usa o snapshot recem-atualizado de entries para que
      // os hodometros iniciais sejam puxados corretamente do dia salvo.
      const proximaData = getNextDateAfter(form.date);
      resetFormForNewEntry({
        entriesOverride: nextEntries,
        dateOverride: proximaData || undefined,
      });
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
      const savedReceiptId = await saveDieselReceipt({
        receiptId: editingReceiptId,
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
      clearReceiptFields();
      setSelectedReceiptId(savedReceiptId || null);
      setFeedback({
        type: "success",
        message: editingReceiptId
          ? "Recebimento atualizado e somado automaticamente no dia."
          : "Recebimento salvo e somado automaticamente no dia.",
      });
      setShowReceiptModal(false);
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

  async function handleDeleteReceipt() {
    if (!selectedDailyReceipt?.id) {
      setFeedback({
        type: "error",
        message: "Selecione um recebimento para excluir.",
      });
      return;
    }

    const confirmDelete = window.confirm(
      `Deseja excluir o recebimento${selectedDailyReceipt.nfNumero ? ` NF ${selectedDailyReceipt.nfNumero}` : ""}? Essa ação não pode ser desfeita.`
    );

    if (!confirmDelete) return;

    if (!metadata) {
      setFeedback({
        type: "error",
        message: "Os metadados do tanque ainda nao foram carregados.",
      });
      return;
    }

    try {
      setDeletingReceipt(true);

      const { error } = await supabase
        .from(DIESEL_RECEIPTS_TABLE)
        .delete()
        .eq("id", selectedDailyReceipt.id);

      if (error) throw error;

      const [nextEntries, nextReceipts] = await Promise.all([
        fetchMeasurementEntries({
          year,
          metadata,
          paramStore,
          includePumps: true,
        }),
        fetchDieselReceipts({
          year,
          metadata,
        }),
      ]);

      setEntries(nextEntries);
      setReceipts(nextReceipts);
      setSelectedReceiptId(null);
      clearReceiptFields();

      setFeedback({
        type: "success",
        message: "Recebimento excluido com sucesso. A tabela foi recarregada e os saldos anteriores foram recalculados em cascata.",
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

  function updatePumpConfigDraft(pumpId, field, value) {
    setPumpConfigDrafts((current) => ({
      ...current,
      [pumpId]: {
        ...(current[pumpId] || { initial: "", observation: "" }),
        [field]: value,
      },
    }));
  }

  async function reloadMeasurementData(nextForm = null, options = {}) {
    const { forcePumpInitials = false } = options;
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

    setMetadata(context.metadata);
    setParamStore(context.paramStore);
    setEntries(nextEntries);
    setReceipts(nextReceipts);

    if (nextForm) {
      setForm(buildPreparedForm(nextForm, nextEntries, context.metadata, { forcePumpInitials }));
    }
  }

  async function handleSavePumpConfig(pump) {
    const draft = pumpConfigDrafts[pump.id] || { initial: "", observation: "" };

    if (draft.initial === "" || draft.initial === null || draft.initial === undefined) {
      setFeedback({
        type: "error",
        message: `Informe o hodometro inicial ajustado da bomba ${pump.numero}.`,
      });
      return;
    }

    try {
      setSavingPumpConfigId(`save-${pump.id}`);
      await savePumpInitialAdjustment({
        metadata,
        product,
        pumpNumber: pump.numero,
        date: form.date,
        initial: draft.initial,
        observation: draft.observation,
        userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null,
      });

      await reloadMeasurementData(
        {
          ...form,
          pumps: (form.pumps || []).map((item) =>
            Number(item.number) === Number(pump.numero)
              ? { ...item, initial: toFormValue(draft.initial) }
              : item
          ),
        },
        { forcePumpInitials: true }
      );

      setFeedback({
        type: "success",
        message: `Configuracao da bomba ${pump.numero} salva para ${new Date(`${form.date}T00:00:00`).toLocaleDateString("pt-BR")}.`,
      });
    } catch (error) {
      console.error("Falha ao salvar ajuste de hodometro:", error);
      setFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel salvar o ajuste do hodometro inicial.",
      });
    } finally {
      setSavingPumpConfigId(null);
    }
  }

  async function handleDeletePumpConfig(pump) {
    try {
      setSavingPumpConfigId(`delete-${pump.id}`);
      await deletePumpInitialAdjustment({
        metadata,
        product,
        pumpNumber: pump.numero,
        date: form.date,
      });

      const previousPump = (previousEntry?.pumps || []).find(
        (item) => Number(item.number) === Number(pump.numero)
      );

      await reloadMeasurementData(
        {
          ...form,
          pumps: (form.pumps || []).map((item) =>
            Number(item.number) === Number(pump.numero)
              ? { ...item, initial: toFormValue(previousPump?.final ?? "") }
              : item
          ),
        },
        { forcePumpInitials: true }
      );

      setFeedback({
        type: "success",
        message: `Configuracao da bomba ${pump.numero} removida para ${new Date(`${form.date}T00:00:00`).toLocaleDateString("pt-BR")}.`,
      });
    } catch (error) {
      console.error("Falha ao remover ajuste de hodometro:", error);
      setFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel remover o ajuste do hodometro inicial.",
      });
    } finally {
      setSavingPumpConfigId(null);
    }
  }

  function isReceiptFormDirty() {
    const f = form || {};
    const algumCampo =
      String(f.nfVolumeLitros || "").trim() !== "" ||
      String(f.unitPrice || "").trim() !== "" ||
      String(f.supplier || "").trim() !== "" ||
      String(f.nfNumero || "").trim() !== "" ||
      String(f.receiptRuleBeforeT1 || "").trim() !== "" ||
      String(f.receiptRuleBeforeT2 || "").trim() !== "" ||
      String(f.receiptRuleAfterT1 || "").trim() !== "" ||
      String(f.receiptRuleAfterT2 || "").trim() !== "" ||
      Boolean(receiptFiles?.before) ||
      Boolean(receiptFiles?.after);
    return f.hasReceipt && algumCampo && !editingReceiptId;
  }

  function prepareNewReceipt() {
    if (isReceiptFormDirty()) {
      const ok = window.confirm(
        "Voce tem dados nao salvos no formulario de recebimento. Salve primeiro ou clique OK para descartar e iniciar um novo."
      );
      if (!ok) return;
    }
    setShowReceiptModal(true);
    setSelectedReceiptId(null);
    setEditingReceiptId(null);
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
    window.requestAnimationFrame(() => {
      receiptFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openReceiptConsultation() {
    if (!selectedReceiptId && dailyReceipts[0]?.id) {
      setSelectedReceiptId(dailyReceipts[0].id);
    }
    setForm((current) => ({ ...current, hasReceipt: true }));
    setShowReceiptModal(true);
  }

  function closeReceiptModal() {
    if (isReceiptFormDirty()) {
      const ok = window.confirm(
        "Voce tem dados nao salvos no recebimento. Tem certeza que deseja sair? Os dados serao descartados."
      );
      if (!ok) return;
    }
    // Descarta o que foi digitado e nao salvo, para nao "vazar" no calculo do dia.
    clearReceiptFields();
    setShowReceiptModal(false);
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
          <div className="space-y-3 xl:min-w-[420px]">
            <MonthNavigation month={month} product={product} />
            <ProductSwitcher product={product} onChange={handleProductChange} />
            <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
              <button
                type="button"
                onClick={handleStartDailyLaunch}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black uppercase tracking-wider text-white transition hover:bg-emerald-800"
              >
                <FaGasPump />
                Iniciar lançamento do dia
              </button>
              {showDailyLaunch ? (
                <>
                  <button
                    type="button"
                    onClick={handleHideDailyLaunch}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    <FaTimes />
                    Ocultar lançamento
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPumpConfig((current) => !current)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition ${
                      showPumpConfig
                        ? "border-blue-300 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <FaCog />
                    Configuracao
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </EstoqueDieselPanel>

      {showDailyLaunch ? (
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

          {showPumpConfig ? (
            <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">
                    Ajuste de hodometro inicial do dia
                  </h3>
                  <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-600">
                    Use esta configuracao quando o relogio da bomba for trocado ou o encerrante reiniciar. O ajuste vale so para a data do lancamento e substitui o D-1 naquela bomba.
                  </p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-700">
                  Data ativa {new Date(`${form.date}T00:00:00`).toLocaleDateString("pt-BR")}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                {currentProductPumps.map((pump) => {
                  const draft = pumpConfigDrafts[pump.id] || { initial: "", observation: "" };
                  const activeAdjustment = currentPumpAdjustments[Number(pump.numero)] || null;
                  const previousPump = (previousEntry?.pumps || []).find(
                    (item) => Number(item.number) === Number(pump.numero)
                  );

                  return (
                    <div key={pump.id} className="rounded-2xl border border-blue-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-800">Bomba {pump.numero}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            D-1 desta bomba: {previousPump?.final !== undefined && previousPump?.final !== null && previousPump?.final !== "" ? parseHodometro(previousPump.final) : "Sem historico"}
                          </p>
                        </div>
                        <div className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                          activeAdjustment
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}>
                          {activeAdjustment ? "Ajuste ativo no dia" : "Sem ajuste manual"}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormInput
                          label="Hodometro inicial do dia"
                          value={draft.initial}
                          onChange={(value) => updatePumpConfigDraft(pump.id, "initial", value)}
                        />
                        <label className="block">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                            Observacao do ajuste
                          </span>
                          <input
                            type="text"
                            value={draft.observation}
                            onChange={(event) => updatePumpConfigDraft(pump.id, "observation", event.target.value)}
                            placeholder="Ex.: troca de relogio da bomba"
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSavePumpConfig(pump)}
                          disabled={savingPumpConfigId !== null}
                          className="inline-flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FaSave />
                          {savingPumpConfigId === `save-${pump.id}` ? "Salvando..." : "Salvar ajuste"}
                        </button>
                        {activeAdjustment ? (
                          <button
                            type="button"
                            onClick={() => handleDeletePumpConfig(pump)}
                            disabled={savingPumpConfigId !== null}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FaTrash />
                            {savingPumpConfigId === `delete-${pump.id}` ? "Removendo..." : "Remover ajuste"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

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
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Saldo anterior</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoD1)}</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Vem automaticamente do ultimo saldo final salvo para {product}.
              </p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Saldo inicial do dia</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoInicial)}</p>
              <p className="mt-1 text-sm font-semibold text-blue-700">
                Saldo apurado pela regua depois das saidas do dia.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-700">Saldo final</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoAtual)}</p>
              <p className="mt-1 text-sm font-semibold text-amber-700">
                Soma do saldo inicial do dia com o recebido de diesel.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-emerald-700">Recebimento de diesel</h3>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  Cadastre, consulte ou edite os recebimentos em uma janela separada. O recebido entra automaticamente no fechamento do dia.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={prepareNewReceipt}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  Novo recebimento
                </button>
                <button
                  type="button"
                  onClick={openReceiptConsultation}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
                >
                  Consultar recebimentos
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Recebimentos do dia</div>
                <div className="mt-2 text-xl font-black text-slate-800">{dailyReceipts.length}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Recebido de Diesel</div>
                <div className="mt-2 text-xl font-black text-slate-800">{parseLiters(computed.entradaDiesel)}</div>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500">Planejado de Diesel</div>
                <div className="mt-2 text-xl font-black text-slate-800">{parseLiters(plannedDieselLiters)}</div>
              </div>
            </div>
          </div>

          {showReceiptModal ? (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
              <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Recebimento de diesel</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Informe o planejado, regua antes/depois e fotos. O volume recebido entra no dia selecionado.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeReceiptModal}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                </div>

                <div className="overflow-y-auto p-5">
                  <div ref={receiptFormRef} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-emerald-700">Dados do recebimento</h4>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        Informe o planejado de diesel, fornecedor, regua antes e depois, e anexe as fotos.
                      </p>
                    </div>

            {form.hasReceipt ? (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <FormInput label="Planejado de Diesel (litros)" value={form.nfVolumeLitros} onChange={(value) => updateField("nfVolumeLitros", value)} required />
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
            {form.hasReceipt ? (
              <div
                className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  computed.receiptBelowExpected
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : computed.receiptWithinTolerance === false
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider">Calculo pela regua</div>
                <div className="mt-2">
                  Recebido pela regua: <span className="font-black">{parseLiters(computed.receiptMeasuredLiters)}</span>
                  <br />
                  Planejado (NF): <span className="font-black">{parseLiters(Number(form.nfVolumeLitros || 0) || 0)}</span>
                  <br />
                  Diferenca p/ NF: <span className="font-black">{parseLiters(computed.diffRecebimento)}</span>
                  <br />
                  Tolerancia da faixa: <span className="font-black">{parseLiters(computed.receiptToleranceLiters)}</span>
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
                          onClick={() => handleEditReceipt(selectedDailyReceipt)}
                          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100"
                        >
                          Editar recebimento
                        </button>

                        <button
                          type="button"
                          onClick={handleDeleteReceipt}
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
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Planejado de Diesel</div>
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
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Inicio do tanque</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{parseLiters(selectedDailyReceipt.litrosAntes)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Fim do tanque</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{parseLiters(selectedDailyReceipt.litrosDepois)}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Regua antes</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{selectedDailyReceipt.reguaAntesCm ?? "--"} cm</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">Regua depois</div>
                        <div className="mt-2 text-lg font-black text-slate-800">{selectedDailyReceipt.reguaDepoisCm ?? "--"} cm</div>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <ReceiptPhotoCard
                        label="Foto da regua antes"
                        url={selectedReceiptPhotoBeforeUrl}
                        onOpen={(url, title) => setReceiptPreview({ url, title })}
                      />
                      <ReceiptPhotoCard
                        label="Foto da regua depois"
                        url={selectedReceiptPhotoAfterUrl}
                        onOpen={(url, title) => setReceiptPreview({ url, title })}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="sticky bottom-0 -mx-5 mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
              {isEditingReceipt ? (
                <div className="inline-flex items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
                  Editando recebimento selecionado
                </div>
              ) : null}
              <button
                type="button"
                onClick={closeReceiptModal}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveReceipt}
                disabled={savingReceipt}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60"
              >
                <FaSave />
                {savingReceipt
                  ? isEditingReceipt
                    ? "Atualizando recebimento..."
                    : "Salvando recebimento..."
                  : isEditingReceipt
                  ? "Atualizar recebimento"
                  : "Salvar recebimento"}
              </button>
            </div>
          </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Bombas</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">S500 usa bombas 2 e 3. S10 usa bomba 1.</p>
              <div className="mt-4 space-y-4">
                {form.pumps.map((pump, index) => {
                  const previousPump = (previousEntry?.pumps || []).find(
                    (entryPump) => Number(entryPump.number) === Number(pump.number)
                  );
                  const pumpAdjustment = currentPumpAdjustments[Number(pump.number)] || null;
                  const hasPreviousPump = Boolean(
                    previousPump &&
                      previousPump.final !== null &&
                      previousPump.final !== undefined &&
                      previousPump.final !== ""
                  );
                  const helperSource = pumpAdjustment
                    ? "config"
                    : hasPreviousPump
                    ? "previous"
                    : "manual";

                  return (
                    <div key={pump.number} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-800">Bomba {pump.number}</p>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {pumpAdjustment ? (
                            <div className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-amber-700">
                              Ajustado no dia
                            </div>
                          ) : null}
                          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Saida {parseLiters(computed.pumpDetails[index]?.output)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormInput
                          label="Hodometro inicial"
                          value={pump.initial}
                          onChange={(value) => updatePump(index, "initial", value)}
                          readOnly={helperSource !== "manual"}
                        />
                        <FormInput
                          label="Hodometro final"
                          value={pump.final}
                          onChange={(value) => updatePump(index, "final", value)}
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {helperSource === "config"
                          ? "O hodometro inicial desta bomba foi ajustado na configuracao do dia."
                          : helperSource === "previous"
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
                Saldo anterior considerado: <span className="font-black">{parseLiters(computed.medicaoD1)}</span>
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
            <SummaryCard title="Saldo anterior" value={parseLiters(computed.medicaoD1)} sub="Mesmo saldo final do D-1" tone="slate" />
            <SummaryCard title="Saida tanque" value={parseLiters(computed.saidaTanque)} tone="amber" />
            <SummaryCard title="Saida total bombas" value={parseLiters(computed.saidaTotalBombas)} tone="amber" />
            <SummaryCard title="Saida Transnet" value={parseLiters(computed.saidaTransnet)} tone="amber" />
            <SummaryCard title="% Tanque x Transnet" value={parsePct(computed.pctDiffTransnet)} tone={getPctTone(computed.pctDiffTransnet, productParams.transnetWarnPct || 0.02, productParams.transnetCriticalPct || 0.03)} />
            <SummaryCard title="Saldo inicial do dia" value={parseLiters(computed.medicaoInicial)} sub="Saldo depois das saidas" tone="blue" />
            <SummaryCard
              title="Recebido de Diesel"
              value={parseLiters(computed.entradaDiesel)}
              tone={form.hasReceipt || dailyReceipts.length > 0 ? "emerald" : "slate"}
            />
            <SummaryCard title="Planejado de Diesel" value={parseLiters(plannedDieselLiters)} tone={plannedDieselLiters > 0 ? "emerald" : "slate"} />
            <SummaryCard title="Saldo final" value={parseLiters(computed.saldoFinal)} tone="blue" />
            <SummaryCard title="Status" value={status.label} sub={getStatusDescription(status.label)} tone={status.tone} />
          </div>
        </EstoqueDieselPanel>
      </div>
      ) : null}

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Tabela do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Historico consolidado de {getMonthLabel(month)} de {year} para {product}. Os saldos anteriores são recalculados em cascata, mantendo o saldo final da régua salvo em cada dia.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
            <FaInfoCircle />
            1 linha por dia
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs font-black uppercase tracking-wider text-slate-500">
              <tr className="text-[11px] text-slate-700">
                {[
                  { label: "Dia", span: 1, className: "rounded-l-2xl border-slate-200 bg-slate-100" },
                  { label: "Saldo", span: 1, className: "border-blue-200 bg-blue-50 text-blue-700" },
                  { label: "Saidas", span: 3, className: "border-amber-200 bg-amber-50 text-amber-700" },
                  { label: "Comparativo", span: 1, className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
                  { label: "Saldo do dia", span: 1, className: "border-sky-200 bg-sky-50 text-sky-700" },
                  { label: "Recebimento", span: 2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                  { label: "Fechamento", span: 2, className: "rounded-r-2xl border-slate-200 bg-slate-100 text-slate-700" },
                ].map((cluster) => (
                  <th
                    key={cluster.label}
                    colSpan={cluster.span}
                    className={`border px-4 py-2 text-center ${cluster.className}`}
                  >
                    {cluster.label}
                  </th>
                ))}
              </tr>
              <tr>
                {[
                  { label: "Data", className: "bg-slate-50 border-r border-slate-200" },
                  { label: "Saldo anterior", className: "bg-blue-50/70 border-r border-blue-100 text-blue-800" },
                  { label: "Saida tanque", className: "bg-amber-50/70 text-amber-800" },
                  { label: "Bombas", className: "bg-amber-50/70 text-amber-800" },
                  { label: "Transnet", className: "bg-amber-50/70 border-r border-amber-200 text-amber-800" },
                  { label: "% Tanque x Transnet", className: "bg-cyan-50/70 border-r border-cyan-200 text-cyan-800" },
                  { label: "Saldo inicial do dia", className: "bg-sky-50/70 border-r border-sky-200 text-sky-800" },
                  { label: "Recebido de Diesel", className: "bg-emerald-50/70 text-emerald-800" },
                  { label: "Planejado de Diesel", className: "bg-emerald-50/70 border-r border-emerald-200 text-emerald-800" },
                  { label: "Saldo final", className: "bg-slate-50" },
                  { label: "Status", className: "bg-slate-50" },
                ].map((header, index, array) => (
                  <th
                    key={header.label}
                    className={`px-4 py-3 ${header.className} ${index === 0 ? "rounded-l-2xl" : ""} ${
                      index === array.length - 1 ? "rounded-r-2xl" : ""
                    }`}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyDisplayEntries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                    {loading ? "Carregando lançamentos..." : "Ainda nao ha lancamentos para este mes."}
                  </td>
                </tr>
              ) : (
                monthlyDisplayEntries.map((entry) => {
                  const isSelected = form.id === entry.id;
                  return (
                  <tr
                    key={entry.id}
                    onClick={() => handleSelectEntry(entry)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? "bg-blue-50/60" : ""}`}
                  >
                    <td className={`border-r border-slate-100 bg-slate-50/60 px-4 py-3 font-black ${isSelected ? "text-blue-700" : "text-slate-800"}`}>
                      {new Date(`${entry.date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="border-r border-blue-100 bg-blue-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.saldoAnterior)}</td>
                    <td className="bg-amber-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.saidaTanque)}</td>
                    <td className="bg-amber-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.saidaTotalBombas)}</td>
                    <td className="border-r border-amber-100 bg-amber-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.saidaTransnet)}</td>
                    <td className="border-r border-cyan-100 bg-cyan-50/30 px-4 py-3 font-semibold text-slate-700">{parsePct(entry.pctDiffTransnet)}</td>
                    <td className="border-r border-sky-100 bg-sky-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.saldoInicialDia)}</td>
                    <td className="bg-emerald-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.recebidoDiesel ?? entry.entradaDiesel)}</td>
                    <td className="border-r border-emerald-100 bg-emerald-50/30 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.nfVolumeLitros)}</td>
                    <td className="bg-slate-50/50 px-4 py-3 font-semibold text-slate-700">{parseLiters(entry.saldoFinal)}</td>
                    <td className="bg-slate-50/50 px-4 py-3">
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
      <MediaPreviewModal
        open={Boolean(receiptPreview?.url)}
        url={receiptPreview?.url}
        title={receiptPreview?.title || "Foto do recebimento"}
        onClose={() => setReceiptPreview(null)}
      />
    </EstoqueDieselPageShell>
  );
}
