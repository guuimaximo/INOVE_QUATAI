import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCamera,
  FaCheckCircle,
  FaChevronRight,
  FaExclamationTriangle,
  FaGasPump,
  FaInfoCircle,
  FaPlus,
  FaSave,
  FaTimes,
  FaTint,
} from "react-icons/fa";
import EstoqueDieselPageShell, { EstoqueDieselPanel } from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  DEFAULT_PARAMS,
  MONTHS_2026,
  PRODUCT_CONFIG,
  buildDefaultForm,
  buildDefaultReceiptForm,
  computeMeasurement,
  computeReceipt,
  fetchDieselReceipts,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getDailyReceipts,
  getMonthLabel,
  getPreviousEntry,
  measurementStatus,
  receiptStatus,
  saveDieselReceipt,
  saveMeasurementEntry,
  validateMeasurement,
  validateReceipt,
} from "./medicaoModel";
import { useAuth } from "../../context/AuthContext";

function parsePct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function parseLiters(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} L`;
}

function formatDate(date) {
  if (!date) return "--";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function FormInput({ label, value, onChange, type = "number", min, step = "0.1", placeholder, required = false, disabled = false }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value ?? ""}
        min={min}
        step={type === "number" ? step : undefined}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
          disabled ? "border-slate-200 bg-slate-100 text-slate-500" : "border-slate-200 bg-white text-slate-700"
        }`}
      />
    </label>
  );
}

function FileInput({ label, onChange, required = false }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
        <FaCamera className="text-slate-400" />
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
          className="w-full text-xs font-bold text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-black file:text-white"
        />
      </div>
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
              active ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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

function statusBadge(status) {
  const tone =
    status === "Critico"
      ? "bg-rose-50 text-rose-700"
      : status === "Atencao"
      ? "bg-amber-50 text-amber-700"
      : "bg-emerald-50 text-emerald-700";
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${tone}`}>
      {status === "OK" ? <FaCheckCircle /> : <FaExclamationTriangle />}
      {status || "OK"}
    </span>
  );
}

function MonthLineTable({ year, product, month, entries, receipts }) {
  const rows = MONTHS_2026.map((item) => {
    const monthKey = `${year}-${item.month}`;
    const monthEntries = entries.filter((entry) => entry.product === product && entry.date?.startsWith(monthKey));
    const monthReceipts = receipts.filter((receipt) => receipt.product === product && receipt.date?.startsWith(monthKey));
    const alertas = monthEntries.filter((entry) => entry.status && entry.status !== "OK").length + monthReceipts.filter((receipt) => receipt.status && receipt.status !== "OK").length;
    const saidaTanque = monthEntries.reduce((sum, entry) => sum + (Number(entry.saidaTanque) || 0), 0);
    const saidaTransnet = monthEntries.reduce((sum, entry) => sum + (Number(entry.saidaTransnet) || 0), 0);
    return { ...item, active: item.month === month, lancamentos: monthEntries.length, recebimentos: monthReceipts.length, alertas, saidaTanque, saidaTransnet };
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
          <tr>
            {["Mes", "Lancamentos", "Recebimentos", "Saida tanque", "Transnet", "Alertas", "Acao"].map((header, index, array) => (
              <th key={header} className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${index === array.length - 1 ? "rounded-r-2xl" : ""}`}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.month} className={row.active ? "bg-blue-50/50" : ""}>
              <td className="px-4 py-3 font-black text-slate-800">{row.label}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.lancamentos}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.recebimentos}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(row.saidaTanque)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(row.saidaTransnet)}</td>
              <td className="px-4 py-3 font-semibold text-slate-600">{row.alertas}</td>
              <td className="px-4 py-3">
                <Link
                  to={`/estoque-diesel/operacao/${year}/${row.month}?produto=${product}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:bg-slate-50"
                >
                  Abrir mes
                  <FaChevronRight />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecebimentoModal({ open, onClose, product, productParams, metadata, user, onSaved }) {
  const [form, setForm] = useState(() => buildDefaultReceiptForm(product));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(buildDefaultReceiptForm(product));
      setFeedback(null);
    }
  }, [open, product]);

  const computed = useMemo(() => computeReceipt(form, productParams), [form, productParams]);
  const validation = useMemo(() => validateReceipt(form, computed, productParams), [form, computed, productParams]);
  const status = useMemo(() => receiptStatus(computed, productParams), [computed, productParams]);

  if (!open) return null;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveReceipt() {
    if (Object.keys(validation.errors).length > 0) {
      setFeedback({ type: "error", message: Object.values(validation.errors)[0] });
      return;
    }
    try {
      setSaving(true);
      await saveDieselReceipt({
        form,
        computed,
        product,
        params: productParams,
        metadata,
        userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null,
      });
      setFeedback({ type: "success", message: "Recebimento salvo e ja entrou na conta do dia." });
      await onSaved?.();
      onClose();
    } catch (error) {
      console.error("Falha ao salvar recebimento:", error);
      setFeedback({ type: "error", message: error?.message || "Nao foi possivel salvar o recebimento." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Recebimento de Diesel - {product}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Lance NF, regua antes/depois e fotos. O volume recebido entra automaticamente no fechamento do dia.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
            <FaTimes />
            Fechar
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <FormInput label="Data recebimento" type="date" value={form.date} onChange={(value) => updateField("date", value)} required />
          <SelectInput label="Fornecedor" value={form.supplier} options={productParams.suppliers || []} onChange={(value) => updateField("supplier", value)} />
          <FormInput label="Numero NF" type="text" value={form.nfNumero} onChange={(value) => updateField("nfNumero", value)} />
          <FormInput label="Volume NF (litros)" value={form.nfVolumeLitros} onChange={(value) => updateField("nfVolumeLitros", value)} required />
          <FormInput label="Regua antes (cm)" value={form.reguaAntesCm} onChange={(value) => updateField("reguaAntesCm", value)} required />
          <FormInput label="Regua depois (cm)" value={form.reguaDepoisCm} onChange={(value) => updateField("reguaDepoisCm", value)} required />
          <FileInput label="Foto regua antes" required onChange={(file) => updateField("fotoAntesFile", file)} />
          <FileInput label="Foto regua depois" required onChange={(file) => updateField("fotoDepoisFile", file)} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard title="Litros antes" value={parseLiters(computed.litrosAntes)} />
          <SummaryCard title="Litros depois" value={parseLiters(computed.litrosDepois)} tone="blue" />
          <SummaryCard title="Recebido real" value={parseLiters(computed.volumeRecebido)} tone="emerald" />
          <SummaryCard title="Dif. NF" value={parseLiters(computed.diffRecebimento)} tone={status.tone} />
          <SummaryCard title="% Dif. NF" value={parsePct(computed.pctDiffNF)} tone={status.tone} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Observacao</span>
            <textarea
              value={form.observation}
              onChange={(event) => updateField("observation", event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Informe qualquer detalhe do recebimento ou divergencia de regua/NF."
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">Status recebimento</p>
            <div className="mt-3">{statusBadge(status.label)}</div>
            {validation.warnings.length > 0 ? <p className="mt-3 text-xs font-bold text-amber-700">{validation.warnings[0]}</p> : null}
          </div>
        </div>

        {feedback ? (
          <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
            {feedback.message}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Cancelar</button>
          <button type="button" disabled={saving} onClick={handleSaveReceipt} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-60">
            <FaSave />
            {saving ? "Salvando..." : "Salvar recebimento"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EstoqueDieselOperacao() {
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const year = params.ano || "2026";
  const month = params.mes || "01";
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
  const [receiptOpen, setReceiptOpen] = useState(false);

  async function reloadData(nextProduct = product, keepForm = true) {
    const context = await fetchMeasurementContext();
    const [nextEntries, nextReceipts] = await Promise.all([
      fetchMeasurementEntries({ year, metadata: context.metadata, paramStore: context.paramStore, includePumps: true }),
      fetchDieselReceipts({ year, metadata: context.metadata, paramStore: context.paramStore }),
    ]);
    setMetadata(context.metadata);
    setParamStore(context.paramStore);
    setEntries(nextEntries);
    setReceipts(nextReceipts);
    setProduct(nextProduct);
    if (!keepForm) setForm(buildDefaultForm(nextProduct, year, month));
  }

  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        setLoading(true);
        setFeedback(null);
        const nextProduct = initialProduct in PRODUCT_CONFIG ? initialProduct : "S500";
        const context = await fetchMeasurementContext();
        const [nextEntries, nextReceipts] = await Promise.all([
          fetchMeasurementEntries({ year, metadata: context.metadata, paramStore: context.paramStore, includePumps: true }),
          fetchDieselReceipts({ year, metadata: context.metadata, paramStore: context.paramStore }),
        ]);
        if (!active) return;
        setMetadata(context.metadata);
        setParamStore(context.paramStore);
        setEntries(nextEntries);
        setReceipts(nextReceipts);
        setProduct(nextProduct);
        setForm(buildDefaultForm(nextProduct, year, month));
      } catch (error) {
        if (!active) return;
        console.error("Falha ao carregar medicao de diesel:", error);
        setFeedback({ type: "error", message: "Nao foi possivel carregar os dados do Supabase." });
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, [initialProduct, month, year]);

  const productParams = paramStore[product] || DEFAULT_PARAMS[product];
  const monthlyEntries = useMemo(() => entries.filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`)).sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)), [entries, month, product, year]);
  const monthlyReceipts = useMemo(() => receipts.filter((receipt) => receipt.product === product && receipt.date?.startsWith(`${year}-${month}`)).sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`)), [receipts, month, product, year]);
  const previousEntry = useMemo(() => getPreviousEntry(entries, product, form.date, form.id), [entries, form.date, form.id, product]);
  const dailyReceipts = useMemo(() => getDailyReceipts(receipts, product, form.date), [receipts, product, form.date]);
  const computed = useMemo(() => computeMeasurement(form, productParams, previousEntry, dailyReceipts), [form, productParams, previousEntry, dailyReceipts]);
  const validation = useMemo(() => validateMeasurement(form, computed, productParams), [computed, form, productParams]);
  const status = useMemo(() => measurementStatus(computed, productParams), [computed, productParams]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      pumps: current.pumps.map((pump) => ({
        ...pump,
        initial: previousEntry?.pumps?.find((item) => Number(item.number) === Number(pump.number))?.final ?? "",
      })),
    }));
  }, [previousEntry?.id]);

  function updatePump(index, field, value) {
    setForm((current) => ({
      ...current,
      pumps: current.pumps.map((pump, pumpIndex) => (pumpIndex === index ? { ...pump, [field]: value } : pump)),
    }));
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (Object.keys(validation.errors).length > 0) {
      setFeedback({ type: "error", message: Object.values(validation.errors)[0] });
      return;
    }
    if (!metadata) {
      setFeedback({ type: "error", message: "Os metadados do tanque ainda nao foram carregados." });
      return;
    }
    try {
      setSaving(true);
      await saveMeasurementEntry({ form, computed, product, params: productParams, metadata, userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null });
      await reloadData(product, false);
      setFeedback({ type: "success", message: "Lancamento salvo. Medicao D-1, bombas, recebimentos e Transnet foram recalculados." });
    } catch (error) {
      console.error("Falha ao salvar medicao:", error);
      setFeedback({ type: "error", message: error?.message || "Nao foi possivel salvar o lancamento no Supabase." });
    } finally {
      setSaving(false);
    }
  }

  function handleProductChange(nextProduct) {
    navigate(`/estoque-diesel/operacao/${year}/${month}?produto=${nextProduct}`);
  }

  return (
    <EstoqueDieselPageShell title="Medicao de Diesel" description={`Fechamento diario de ${PRODUCT_CONFIG[product].label}: medicao atual, bombas, recebimentos do dia e comparativo Transnet.`}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard title="Produto" value={product} sub={PRODUCT_CONFIG[product].label} tone="blue" />
        <SummaryCard title="Data lancamento" value={formatDate(form.date)} sub="Abre direto na data de hoje" tone="slate" />
        <SummaryCard title="Status" value={status.label} sub="Calculado em tempo real" tone={status.tone} />
        <SummaryCard title="Recebimentos do dia" value={String(dailyReceipts.length)} sub={parseLiters(computed.entradaDiesel)} tone="emerald" />
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <Link to="/estoque-diesel/resumo" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50">
              <FaArrowLeft />
              Voltar para 2026
            </Link>
            <h2 className="mt-4 text-lg font-black text-slate-800">Meses em linha</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">A parte dos meses agora fica em tabela, com botao para abrir o mes.</p>
          </div>
          <div className="flex flex-col gap-3 md:items-end">
            <ProductSwitcher product={product} onChange={handleProductChange} />
            <button type="button" onClick={() => setReceiptOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600">
              <FaPlus />
              Recebimento de Diesel
            </button>
          </div>
        </div>
        <div className="mt-5">
          <MonthLineTable year={year} product={product} month={month} entries={entries} receipts={receipts} />
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <EstoqueDieselPanel className="p-5 xl:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800">Lancamento do dia</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">Digite somente a medicao atual, encerrante das bombas e saida Transnet. O D-1 vem automatico.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">D-1 automatico</div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" type="date" value={form.date} onChange={(value) => updateField("date", value)} required />
            <FormInput label="Medicao D-1 automatica" value={computed.medicaoD1 ?? ""} onChange={() => {}} disabled />
            <FormInput label="Recebimento do dia" value={computed.entradaDiesel ?? ""} onChange={() => {}} disabled />
            <FormInput label="Medicao atual T1 (cm)" value={form.reguaAtualT1} onChange={(value) => updateField("reguaAtualT1", value)} required />
            <FormInput label="Medicao atual T2 (cm)" value={form.reguaAtualT2} onChange={(value) => updateField("reguaAtualT2", value)} />
            <FormInput label="Saida Transnet (litros)" value={form.transnetOutput} onChange={(value) => updateField("transnetOutput", value)} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Bombas do produto</h3>
              <p className="mt-1 text-xs font-bold text-slate-500">S500 usa bombas 2 e 3. S10 usa bomba 1.</p>
              <div className="mt-4 space-y-4">
                {form.pumps.map((pump, index) => (
                  <div key={pump.number} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-slate-800">Bomba {pump.number}</p>
                      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-500">Saida {parseLiters(computed.pumpDetails[index]?.output)}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormInput label="Encerrante D-1 automatico" value={pump.initial} onChange={() => {}} disabled />
                      <FormInput label="Encerrante atual" value={pump.final} onChange={(value) => updatePump(index, "final", value)} required />
                    </div>
                    {validation.errors[`pump_${pump.number}`] ? <p className="mt-2 text-xs font-bold text-rose-600">{validation.errors[`pump_${pump.number}`]}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Observacao do dia</h3>
              <textarea value={form.observation} onChange={(event) => updateField("observation", event.target.value)} rows={8} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" placeholder="Use este campo quando a divergencia passar do limite ou houver qualquer fato operacional relevante." />

              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
                Formula do dia: <span className="font-black">D-1 + Recebimento - Medicao atual = Saida tanque</span>
              </div>

              {validation.errors.reguaAtual ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{validation.errors.reguaAtual}</div> : null}
              {validation.warnings.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                  <div className="flex items-center gap-2 font-black"><FaExclamationTriangle /> Validacoes do dia</div>
                  <ul className="mt-2 space-y-1">{validation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-600">O sistema calcula tanque, bombas, recebimento e diferenca Transnet automaticamente.</div>
            <button type="button" onClick={handleSave} disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-60">
              <FaSave />
              {saving ? "Salvando..." : "Salvar lancamento"}
            </button>
          </div>

          {feedback ? <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{feedback.message}</div> : null}
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Resumo calculado</h2>
          <div className="mt-4 space-y-3">
            <SummaryCard title="Medicao D-1" value={parseLiters(computed.medicaoD1)} tone="slate" />
            <SummaryCard title="Recebimento do dia" value={parseLiters(computed.entradaDiesel)} tone="emerald" />
            <SummaryCard title="Medicao atual" value={parseLiters(computed.medicaoAtual)} tone="blue" />
            <SummaryCard title="Saida tanque" value={parseLiters(computed.saidaTanque)} tone="amber" />
            <SummaryCard title="Saida total bombas" value={parseLiters(computed.saidaTotalBombas)} tone="amber" />
            <SummaryCard title="Saida Transnet" value={parseLiters(computed.saidaTransnet)} tone="amber" />
            <SummaryCard title="Dif. tanque x Transnet" value={parseLiters(computed.diffTanqueTransnet)} tone={Math.abs(computed.pctDiffTransnet || 0) > (productParams.transnetWarnPct || 0.02) ? "amber" : "slate"} />
            <SummaryCard title="Dif. bombas x Transnet" value={parseLiters(computed.diffBombasTransnet)} tone={Math.abs(computed.pctDiffBombas || 0) > (productParams.pumpWarnPct || 0.02) ? "amber" : "slate"} />
            <SummaryCard title="Dif. tanque x bombas" value={parseLiters(computed.diffTanqueBombas)} tone="slate" />
            <SummaryCard title="% Dif. tanque x Transnet" value={parsePct(computed.pctDiffTransnet)} tone={Math.abs(computed.pctDiffTransnet || 0) > (productParams.transnetWarnPct || 0.02) ? "amber" : "slate"} />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Tabela do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Historico consolidado de {getMonthLabel(month)} de {year} para {product}.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500"><FaInfoCircle /> 1 linha por dia</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>{["Data", "D-1", "Recebimento", "Med. atual", "Saida tanque", "Bombas", "Transnet", "Dif. T x Transnet", "Dif. B x Transnet", "Status"].map((header, index, array) => <th key={header} className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${index === array.length - 1 ? "rounded-r-2xl" : ""}`}>{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyEntries.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">{loading ? "Carregando lancamentos..." : "Ainda nao ha lancamentos para este mes."}</td></tr>
              ) : (
                monthlyEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-black text-slate-800">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.medicaoD1)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.entradaDiesel)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.medicaoAtual)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTanque)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTotalBombas)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.saidaTransnet)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.diffTanqueTransnet)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(entry.diffBombasTransnet)}</td>
                    <td className="px-4 py-3">{statusBadge(entry.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Recebimentos do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Recebimentos lancados com fotos antes/depois da regua.</p>
          </div>
          <button type="button" onClick={() => setReceiptOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600"><FaPlus /> Novo recebimento</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>{["Data", "Fornecedor", "NF", "Volume NF", "Recebido real", "Dif.", "% Dif.", "Fotos", "Status"].map((header, index, array) => <th key={header} className={`px-4 py-3 ${index === 0 ? "rounded-l-2xl" : ""} ${index === array.length - 1 ? "rounded-r-2xl" : ""}`}>{header}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyReceipts.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm font-semibold text-slate-500">Nenhum recebimento lancado neste mes.</td></tr>
              ) : (
                monthlyReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td className="px-4 py-3 font-black text-slate-800">{formatDate(receipt.date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{receipt.supplier || "--"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{receipt.nfNumero || "--"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(receipt.nfVolumeLitros)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(receipt.volumeRecebido)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parseLiters(receipt.diffRecebimento)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{parsePct(receipt.pctDiffNF)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">
                      <div className="flex flex-wrap gap-2">
                        {receipt.fotoAntesUrl ? <a href={receipt.fotoAntesUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-700">Antes</a> : null}
                        {receipt.fotoDepoisUrl ? <a href={receipt.fotoDepoisUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-black text-slate-700">Depois</a> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(receipt.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>

      <RecebimentoModal open={receiptOpen} onClose={() => setReceiptOpen(false)} product={product} productParams={productParams} metadata={metadata} user={user} onSaved={() => reloadData(product, true)} />
    </EstoqueDieselPageShell>
  );
}
