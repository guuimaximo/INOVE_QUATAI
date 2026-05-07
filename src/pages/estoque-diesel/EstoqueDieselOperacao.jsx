import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheckCircle,
  FaExclamationTriangle,
  FaCamera,
  FaGasPump,
  FaInfoCircle,
  FaSave,
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
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50">
        <FaCamera className="text-slate-400" />
        <span className="min-w-0 truncate">{fileName || "Selecionar foto"}</span>
        <input type="file" accept="image/*" className="hidden" onChange={(event) => onChange(event.target.files?.[0] || null)} />
      </label>
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
  const [receiptFiles, setReceiptFiles] = useState({ before: null, after: null });

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

  const previousEntry = useMemo(
    () => getPreviousEntry(entries, product, form.date, form.id),
    [entries, form.date, form.id, product]
  );

  const dailyReceipts = useMemo(
    () => getDailyReceipts(receipts, product, form.date),
    [form.date, product, receipts]
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

  function handleSelectEntry(entry) {
    setForm(buildFormFromEntry(entry, product, year, month));
    setReceiptFiles({ before: null, after: null });
    setFeedback({
      type: "success",
      message: `Lancamento de ${new Date(`${entry.date}T00:00:00`).toLocaleDateString("pt-BR")} carregado para conferencia.`,
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
        message: "Lancamento salvo no Supabase. A tabela abaixo ja foi atualizada.",
      });
      setForm(buildDefaultForm(product, year, month));
      setReceiptFiles({ before: null, after: null });
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

  function handleProductChange(nextProduct) {
    navigate(`/estoque-diesel/operacao/${year}/${month}?produto=${nextProduct}`);
  }

  return (
    <EstoqueDieselPageShell
      title="Medicao de Diesel"
      description={`Lancamento diario de ${PRODUCT_CONFIG[product].label} em ${getMonthLabel(month)} de ${year}, com calculos automaticos iguais ao raciocinio da planilha.`}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <SummaryCard title="Produto" value={product} sub={PRODUCT_CONFIG[product].label} tone="blue" />
        <SummaryCard title="Mes" value={getMonthLabel(month)} sub={`${year} pronto no Inove`} tone="slate" />
        <SummaryCard title="Status" value={status.label} sub="Calculado em tempo real" tone={status.tone} />
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
        <EstoqueDieselPanel className="p-5 xl:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-800">Lancamento do dia</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                O operador informa a medicao atual, a saida do Transnet e, se houver, o recebimento do diesel. O restante vem do D-1 e dos calculos automaticos.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-500">
              Fluxo operacional da medicao
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" type="date" value={form.date} onChange={(value) => updateField("date", value)} required />
            <FormInput label="Regua atual T1 (cm)" value={form.reguaFinalT1} onChange={(value) => updateField("reguaFinalT1", value)} required />
            <FormInput label="Regua atual T2 (cm)" value={form.reguaFinalT2} onChange={(value) => updateField("reguaFinalT2", value)} />
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
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-700">Medicao atual</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.medicaoAtual)}</p>
              <p className="mt-1 text-sm font-semibold text-blue-700">
                Calculada a partir da regua atual T1 e T2.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-700">Saida do dia</h3>
              <p className="mt-3 text-2xl font-black text-slate-800">{parseLiters(computed.saidaTanque)}</p>
              <p className="mt-1 text-sm font-semibold text-amber-700">
                Calculada automaticamente com D-1, recebimento e medicao atual.
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
                <SelectInput
                  label="Fornecedor"
                  value={form.supplier}
                  options={productParams.suppliers || []}
                  onChange={(value) => updateField("supplier", value)}
                />
                <FormInput label="Numero da NF" type="text" value={form.nfNumero} onChange={(value) => updateField("nfNumero", value)} />
                <FormInput label="Regua antes T1 (cm)" value={form.receiptRuleBeforeT1} onChange={(value) => updateField("receiptRuleBeforeT1", value)} />
                <FormInput label="Regua antes T2 (cm)" value={form.receiptRuleBeforeT2} onChange={(value) => updateField("receiptRuleBeforeT2", value)} />
                <FileInput
                  label="Foto da regua antes"
                  onChange={(file) => setReceiptFiles((current) => ({ ...current, before: file }))}
                  fileName={receiptFiles.before?.name || form.receiptPhotoBeforeUrl?.split("/").pop() || ""}
                />
                <FormInput label="Regua depois T1 (cm)" value={form.receiptRuleAfterT1} onChange={(value) => updateField("receiptRuleAfterT1", value)} />
                <FormInput label="Regua depois T2 (cm)" value={form.receiptRuleAfterT2} onChange={(value) => updateField("receiptRuleAfterT2", value)} />
                <FileInput
                  label="Foto da regua depois"
                  onChange={(file) => setReceiptFiles((current) => ({ ...current, after: file }))}
                  fileName={receiptFiles.after?.name || form.receiptPhotoAfterUrl?.split("/").pop() || ""}
                />
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
                  Recebimentos separados do dia: <span className="font-black">{dailyReceipts.length}</span>
                  <br />
                  Volume total dessas entradas: <span className="font-black">{parseLiters(computed.entradaRecebimentos)}</span>
                </div>
              ) : null}

              {form.hasReceipt ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  Recebimento medido: <span className="font-black">{parseLiters(computed.receiptMeasuredLiters)}</span>
                  <br />
                  Tolerancia da faixa: <span className="font-black">{parseLiters(computed.receiptToleranceLiters)}</span>
                  <br />
                  Situacao:{" "}
                  <span className="font-black">
                    {computed.receiptWithinTolerance === null
                      ? "Aguardando dados"
                      : computed.receiptWithinTolerance
                      ? "Dentro da tolerancia"
                      : "Fora da tolerancia"}
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

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-lg font-black text-slate-800">Resumo calculado</h2>
          <div className="mt-4 space-y-3">
            <SummaryCard title="Medicao D-1" value={parseLiters(computed.medicaoD1)} tone="slate" />
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
              tone={computed.receiptWithinTolerance === false ? "rose" : "emerald"}
            />
            <SummaryCard title="% Dif NF x Recebido" value={parsePct(computed.pctDiffNF)} tone={Math.abs(computed.pctDiffNF || 0) > (productParams.nfDiffWarnPct || 0.01) ? "amber" : "slate"} />
            <SummaryCard title="% Dif Tanque x Transnet" value={parsePct(computed.pctDiffTransnet)} tone={Math.abs(computed.pctDiffTransnet || 0) > (productParams.transnetWarnPct || 0.02) ? "amber" : "slate"} />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">Tabela do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Historico consolidado de {getMonthLabel(month)} de {year} para {product}.
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
                  <tr key={entry.id} className={isSelected ? "bg-blue-50/60" : ""}>
                    <td className="px-4 py-3 font-black text-slate-800">
                      <button
                        type="button"
                        onClick={() => handleSelectEntry(entry)}
                        className={`rounded-lg px-2 py-1 text-left transition ${
                          isSelected
                            ? "bg-blue-100 text-blue-700"
                            : "text-slate-800 hover:bg-slate-100 hover:text-blue-700"
                        }`}
                      >
                        {new Date(`${entry.date}T00:00:00`).toLocaleDateString("pt-BR")}
                      </button>
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
