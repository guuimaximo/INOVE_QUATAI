import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaChevronRight,
  FaGasPump,
  FaSave,
  FaTint,
  FaTruckLoading,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
  EstoqueDieselStat,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  DEFAULT_PARAMS,
  MONTHS_2026,
  PRODUCT_CONFIG,
  fetchMeasurementContext,
  fetchMeasurementEntries,
  getDefaultDateForMonth,
  getMonthLabel,
  parseNumber,
  round,
} from "./medicaoModel";

const PROGRAMMING_RULES = {
  S500: {
    minimum: 14000,
    medium: 30000,
    maximum: 47000,
    indicatorLowLabel: "Baixo - 15 mil",
    indicatorHighLabel: "Alto - 29 mil",
    defaultWeekdayOutput: 8500,
    defaultSaturdayOutput: 5500,
    defaultSundayOutput: 3500,
  },
  S10: {
    minimum: 10000,
    medium: 15000,
    maximum: 25000,
    indicatorLowLabel: "Baixo - 15 mil",
    indicatorHighLabel: "Alto - 29 mil",
    defaultWeekdayOutput: 4600,
    defaultSaturdayOutput: 3000,
    defaultSundayOutput: 1500,
  },
};

function formatLiters(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} L`;
}

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatNumberInput(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function getWeekdayShort(date) {
  if (!date) return "--";
  const weekday = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
  });
  return weekday.replace(".", "").toLowerCase();
}

function getDefaultPlannedOutput(product, date) {
  const rules = PROGRAMMING_RULES[product] || PROGRAMMING_RULES.S500;
  const weekday = getWeekdayShort(date);
  if (weekday.startsWith("dom")) return rules.defaultSundayOutput;
  if (weekday.startsWith("sáb") || weekday.startsWith("sab")) return rules.defaultSaturdayOutput;
  return rules.defaultWeekdayOutput;
}

function getStockIndicator(product, liters) {
  const rules = PROGRAMMING_RULES[product] || PROGRAMMING_RULES.S500;
  const level = Number(liters || 0);

  if (level <= rules.minimum) {
    return {
      label: rules.indicatorLowLabel,
      tone: "rose",
      description: "Estoque abaixo da faixa minima operacional.",
    };
  }

  if (level >= 29000) {
    return {
      label: rules.indicatorHighLabel,
      tone: "emerald",
      description: "Estoque alto para sustentar a operacao.",
    };
  }

  return {
    label: "Faixa intermediaria",
    tone: "amber",
    description: "Estoque entre a faixa minima e a faixa alta.",
  };
}

function FormInput({
  label,
  value,
  onChange,
  type = "number",
  step = "1",
  required = false,
  disabled = false,
  placeholder = "",
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value ?? ""}
        step={type === "number" ? step : undefined}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${
          disabled
            ? "border-slate-200 bg-slate-100 text-slate-500"
            : "border-slate-200 bg-white text-slate-700"
        }`}
      />
    </label>
  );
}

function SelectInput({ label, value, options, onChange }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <select
        value={value || ""}
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

function SummaryBox({ title, value, tone = "slate", helper }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-black uppercase tracking-wider opacity-80">{title}</p>
      <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
      {helper ? <p className="mt-1 text-[11px] font-bold opacity-80">{helper}</p> : null}
    </div>
  );
}

function MonthSelector({ activeMonth, product }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {MONTHS_2026.map((item) => {
        const active = item.month === activeMonth;
        return (
          <Link
            key={item.month}
            to={`/estoque-diesel/programacao/2026/${item.month}?produto=${product}`}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
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

function ProductSwitcher({ activeProduct, month }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Object.values(PRODUCT_CONFIG).map((item) => {
        const active = item.code === activeProduct;
        return (
          <Link
            key={item.code}
            to={`/estoque-diesel/programacao/2026/${month}?produto=${item.code}`}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition ${
              active
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {item.code === "S500" ? <FaTint /> : <FaGasPump />}
            {item.code}
          </Link>
        );
      })}
    </div>
  );
}

function normalizeSuppliers(metadata, paramStore, product) {
  const metadataSuppliers = Object.values(metadata?.suppliersById || {})
    .map((supplier) => String(supplier.nome || "").trim())
    .filter(Boolean);
  const paramSuppliers = (paramStore?.[product]?.suppliers || []).map((item) => String(item || "").trim());

  return [...new Set([...metadataSuppliers, ...paramSuppliers])].sort((a, b) => a.localeCompare(b));
}

function mapPlanningRow(row, metadata) {
  const tank = metadata?.tanksById?.[row.tanque_id];
  return {
    id: row.id,
    date: row.data_programacao,
    tankId: row.tanque_id,
    product: tank?.tipo_diesel || row.tipo_diesel || "S500",
    plannedReceipt: row.entrada_prevista_litros ?? 0,
    plannedOutput: row.saida_prevista_litros ?? 0,
    supplier: row.fornecedor_previsto || "",
    dieselPrice: row.preco_diesel ?? null,
    cbieGap: row.defasagem_cbie ?? null,
    notes: row.observacao || "",
  };
}

async function fetchPlanningRows({ year, product, metadata }) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  let query = supabase
    .from("estoque_diesel_programacoes_diarias")
    .select("*")
    .gte("data_programacao", from)
    .lte("data_programacao", to)
    .order("data_programacao", { ascending: true });

  const tankId = metadata?.tanksByProduct?.[product]?.id;
  if (tankId) query = query.eq("tanque_id", tankId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => mapPlanningRow(row, metadata));
}

async function savePlanningRow({ form, product, metadata, userId = null }) {
  const tankId = metadata?.tanksByProduct?.[product]?.id;
  if (!tankId) throw new Error(`Tanque de ${product} nao encontrado para programacao.`);

  const payload = {
    tanque_id: tankId,
    data_programacao: form.date,
    entrada_prevista_litros: parseNumber(form.plannedReceipt) || 0,
    saida_prevista_litros: parseNumber(form.plannedOutput) || 0,
    fornecedor_previsto: String(form.supplier || "").trim() || null,
    preco_diesel: parseNumber(form.dieselPrice),
    defasagem_cbie: parseNumber(form.cbieGap),
    observacao: String(form.notes || "").trim() || null,
    usuario_id: Number.isInteger(userId) ? userId : null,
    atualizado_em: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("estoque_diesel_programacoes_diarias")
    .upsert(payload, { onConflict: "tanque_id,data_programacao" });

  if (error) throw error;
}

function buildForm(date, product, selectedRow = null) {
  return {
    date,
    supplier: selectedRow?.supplier || "",
    dieselPrice: formatNumberInput(selectedRow?.dieselPrice ?? ""),
    cbieGap: formatNumberInput(selectedRow?.cbieGap ?? ""),
    plannedReceipt: formatNumberInput(selectedRow?.plannedReceipt ?? ""),
    plannedOutput: formatNumberInput(
      selectedRow?.plannedOutput ?? getDefaultPlannedOutput(product, date)
    ),
    notes: selectedRow?.notes || "",
  };
}

function buildMonthRows({ year, month, product, measurements, planningRows }) {
  const monthEntries = [...(measurements || [])]
    .filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const monthPlanning = [...(planningRows || [])]
    .filter((item) => item.product === product && item.date?.startsWith(`${year}-${month}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const measurementByDate = Object.fromEntries(monthEntries.map((entry) => [entry.date, entry]));
  const planningByDate = Object.fromEntries(monthPlanning.map((entry) => [entry.date, entry]));

  const monthNumber = Number(month);
  const daysInMonth = new Date(Number(year), monthNumber, 0).getDate();

  const previousEntry =
    [...(measurements || [])]
      .filter((entry) => entry.product === product && entry.date < `${year}-${month}-01`)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  let runningProjectedBalance = Number(previousEntry?.saldoFinal ?? previousEntry?.medicaoAtual ?? 0);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const actual = measurementByDate[date] || null;
    const plan = planningByDate[date] || null;
    const weekday = getWeekdayShort(date);

    const saldoPlanejado = actual
      ? Number(actual.saldoFinal ?? actual.medicaoAtual ?? runningProjectedBalance ?? 0)
      : Number(runningProjectedBalance || 0);

    const actualReceipt = Number(actual?.entradaDiesel ?? 0);
    const actualOutput = Number(actual?.saidaTanque ?? 0);
    const actualBalance = actual
      ? Number(actual.saldoFinal ?? actual.medicaoAtual ?? saldoPlanejado)
      : Number(saldoPlanejado);

    const plannedReceipt = Number(plan?.plannedReceipt ?? 0);
    const plannedOutput = Number(
      plan?.plannedOutput ?? getDefaultPlannedOutput(product, date)
    );
    const saldoPosEntrega = round(saldoPlanejado + plannedReceipt, 2) ?? saldoPlanejado;
    const saldoProjetado = round(saldoPosEntrega - plannedOutput, 2) ?? saldoPosEntrega;

    const dieselPrice = Number(plan?.dieselPrice ?? 0) || null;
    const cbieGap = Number(plan?.cbieGap ?? 0) || null;
    const gapValue =
      dieselPrice !== null && cbieGap !== null ? round((cbieGap * dieselPrice) / 100, 4) : null;

    const indicator = getStockIndicator(product, actual ? actualBalance : saldoProjetado);

    runningProjectedBalance = actual ? actualBalance : saldoProjetado;

    return {
      date,
      weekday,
      actual,
      hasActual: Boolean(actual),
      actualReceipt,
      actualOutput,
      actualBalance,
      saldoPlanejado,
      plannedReceipt,
      saldoPosEntrega,
      plannedOutput,
      saldoProjetado,
      dieselPrice,
      cbieGap,
      gapValue,
      supplier: plan?.supplier || "",
      notes: plan?.notes || "",
      indicator,
    };
  });
}

export default function EstoqueDieselPlanejamentoControle() {
  const { ano = "2026", mes = "01" } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const year = /^\d{4}$/.test(String(ano)) ? String(ano) : "2026";
  const month = MONTHS_2026.some((item) => item.month === mes) ? mes : "01";
  const productParam = searchParams.get("produto") || "S500";
  const product = productParam in PRODUCT_CONFIG ? productParam : "S500";

  const formRef = useRef(null);
  const [metadata, setMetadata] = useState(null);
  const [paramStore, setParamStore] = useState(DEFAULT_PARAMS);
  const [measurements, setMeasurements] = useState([]);
  const [planningRows, setPlanningRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getDefaultDateForMonth(year, month));
  const [form, setForm] = useState(() =>
    buildForm(getDefaultDateForMonth(year, month), product)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const monthRows = useMemo(
    () => buildMonthRows({ year, month, product, measurements, planningRows }),
    [measurements, month, planningRows, product, year]
  );

  const selectedRow = useMemo(
    () => monthRows.find((row) => row.date === selectedDate) || monthRows[0] || null,
    [monthRows, selectedDate]
  );

  const suppliers = useMemo(
    () => normalizeSuppliers(metadata, paramStore, product),
    [metadata, paramStore, product]
  );

  const summary = useMemo(() => {
    const latest = [...monthRows].reverse().find((row) => row.hasActual) || selectedRow;
    const totalActualOutput = monthRows.reduce((sum, row) => sum + Number(row.actualOutput || 0), 0);
    const totalPlannedOutput = monthRows.reduce((sum, row) => sum + Number(row.plannedOutput || 0), 0);
    const totalPlannedReceipt = monthRows.reduce((sum, row) => sum + Number(row.plannedReceipt || 0), 0);
    const balance = Number(latest?.actualBalance ?? latest?.saldoProjetado ?? 0);
    return {
      balance,
      totalActualOutput,
      totalPlannedOutput,
      totalPlannedReceipt,
      indicator: getStockIndicator(product, balance),
    };
  }, [monthRows, product, selectedRow]);

  const computed = useMemo(() => {
    const dieselPrice = parseNumber(form.dieselPrice);
    const cbieGap = parseNumber(form.cbieGap);
    const plannedReceipt = parseNumber(form.plannedReceipt) || 0;
    const plannedOutput = parseNumber(form.plannedOutput) || 0;
    const base = Number(selectedRow?.actualBalance ?? selectedRow?.saldoPlanejado ?? 0);
    const saldoPosEntrega = round(base + plannedReceipt, 2) ?? base;
    const saldoProjetado = round(saldoPosEntrega - plannedOutput, 2) ?? saldoPosEntrega;
    const gapValue =
      dieselPrice !== null && cbieGap !== null ? round((cbieGap * dieselPrice) / 100, 4) : null;
    return {
      dieselPrice,
      cbieGap,
      gapValue,
      plannedReceipt,
      plannedOutput,
      saldoBase: base,
      saldoPosEntrega,
      saldoProjetado,
      indicator: getStockIndicator(product, saldoProjetado),
    };
  }, [form.cbieGap, form.dieselPrice, form.plannedOutput, form.plannedReceipt, product, selectedRow]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setFeedback(null);
        const context = await fetchMeasurementContext();
        const [measurementData, planningData] = await Promise.all([
          fetchMeasurementEntries({
            year,
            product,
            metadata: context.metadata,
            paramStore: context.paramStore,
            includePumps: false,
          }),
          fetchPlanningRows({ year, product, metadata: context.metadata }),
        ]);

        if (!active) return;
        setMetadata(context.metadata);
        setParamStore(context.paramStore);
        setMeasurements(measurementData);
        setPlanningRows(planningData);
      } catch (error) {
        if (!active) return;
        console.error("Erro ao carregar programacao de diesel:", error);
        setFeedback({
          type: "error",
          message: error?.message || "Nao foi possivel carregar a programacao do diesel.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [month, product, year]);

  useEffect(() => {
    const nextDate = getDefaultDateForMonth(year, month);
    setSelectedDate((current) => (current?.startsWith(`${year}-${month}`) ? current : nextDate));
  }, [month, year]);

  useEffect(() => {
    if (!selectedRow) return;
    setForm(buildForm(selectedRow.date, product, selectedRow));
  }, [product, selectedRow]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSelectRow(row) {
    setSelectedDate(row.date);
    setForm(buildForm(row.date, product, row));
    setFeedback(null);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleNewDay() {
    const nextDate = getDefaultDateForMonth(year, month);
    setSelectedDate(nextDate);
    const row = monthRows.find((item) => item.date === nextDate) || null;
    setForm(buildForm(nextDate, product, row));
    setFeedback(null);
  }

  async function handleSave() {
    if (!metadata) return;
    try {
      setSaving(true);
      await savePlanningRow({
        form,
        product,
        metadata,
        userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null,
      });

      const freshPlanning = await fetchPlanningRows({ year, product, metadata });
      setPlanningRows(freshPlanning);
      setFeedback({
        type: "success",
        message: `Programacao de ${new Date(`${form.date}T00:00:00`).toLocaleDateString("pt-BR")} salva com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao salvar programacao de diesel:", error);
      setFeedback({
        type: "error",
        message: error?.message || "Nao foi possivel salvar a programacao do diesel.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <EstoqueDieselPageShell
      title="Programacao de Diesel"
      description={`Modelo de suprimentos para ${PRODUCT_CONFIG[product].label} em ${getMonthLabel(month)} de ${year}, no formato da planilha de programacao.`}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EstoqueDieselStat
          title="Produto"
          value={product}
          sub={PRODUCT_CONFIG[product].label}
          icon={product === "S500" ? <FaTint /> : <FaGasPump />}
          tone="blue"
        />
        <EstoqueDieselStat
          title="Mes"
          value={getMonthLabel(month)}
          sub={`${year} em suprimentos`}
          icon={<FaCalendarAlt />}
          tone="slate"
        />
        <EstoqueDieselStat
          title="Saldo atual"
          value={formatLiters(summary.balance)}
          sub={summary.indicator.label}
          icon={<FaTruckLoading />}
          tone={summary.indicator.tone}
        />
        <EstoqueDieselStat
          title="Saida prevista"
          value={formatLiters(summary.totalPlannedOutput)}
          sub={`Entrega prevista: ${formatLiters(summary.totalPlannedReceipt)}`}
          icon={<FaChevronRight />}
          tone="amber"
        />
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              to="/estoque-diesel/resumo"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <FaArrowLeft />
              Voltar para 2026
            </Link>
            <h2 className="mt-4 text-lg font-black text-slate-800">Abertura da programacao</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              A medicao diaria alimenta o saldo real. Aqui entram fornecedor, preco, defasagem e a programacao de entrega/saida do periodo.
            </p>
          </div>

          <div className="space-y-3">
            <MonthSelector activeMonth={month} product={product} />
            <ProductSwitcher activeProduct={product} month={month} />
          </div>
        </div>
      </EstoqueDieselPanel>

      <div ref={formRef} className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <EstoqueDieselPanel className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800">Programacao do dia</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Mesmo raciocinio da planilha: fornecedor, preco diesel, defasagem, entrega prevista e saida programada.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div
                className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider ${
                  computed.indicator.tone === "emerald"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : computed.indicator.tone === "amber"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {computed.indicator.label}
              </div>
              <button
                type="button"
                onClick={handleNewDay}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
              >
                Novo dia
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" type="date" value={form.date} onChange={(value) => updateField("date", value)} required />
            <FormInput label="Dia" type="text" value={getWeekdayShort(form.date)} onChange={() => {}} disabled />
            <SelectInput label="Fornecedor" value={form.supplier} options={suppliers} onChange={(value) => updateField("supplier", value)} />
            <FormInput label="Preço Diesel" value={form.dieselPrice} onChange={(value) => updateField("dieselPrice", value)} step="0.0001" placeholder="0,0000" />
            <FormInput label="Defasagem (CBIE)" value={form.cbieGap} onChange={(value) => updateField("cbieGap", value)} step="0.01" placeholder="0,00" />
            <FormInput
              label="Defasagem R$"
              type="text"
              value={formatMoney(computed.gapValue)}
              onChange={() => {}}
              disabled
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <SummaryBox
                title="Saldo planejado"
                value={formatLiters(selectedRow?.saldoPlanejado ?? 0)}
                tone="slate"
                helper="Base do dia para programacao"
              />
              <SummaryBox
                title="Programacao de entrega"
                value={formatLiters(computed.plannedReceipt)}
                tone="blue"
                helper="Entrada prevista para o dia"
              />
              <SummaryBox
                title="Saldo pos entrega"
                value={formatLiters(computed.saldoPosEntrega)}
                tone="emerald"
                helper="Saldo apos considerar a entrega"
              />
              <SummaryBox
                title="Saida programada"
                value={formatLiters(computed.plannedOutput)}
                tone="amber"
                helper="Consumo previsto do dia"
              />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <FormInput
                label="Programacao de entrega (litros)"
                value={form.plannedReceipt}
                onChange={(value) => updateField("plannedReceipt", value)}
                placeholder="0"
              />
              <FormInput
                label="Saida programada (litros)"
                value={form.plannedOutput}
                onChange={(value) => updateField("plannedOutput", value)}
                placeholder="0"
                required
              />
              <SummaryBox
                title="Saldo projetado"
                value={formatLiters(computed.saldoProjetado)}
                tone={computed.indicator.tone}
                helper={computed.indicator.description}
              />
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Observacao da programacao
            </span>
            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Ex.: manter Raizen, reforco para pico de frota, entrega prevista no pátio, ajuste de consumo."
            />
          </label>

          {feedback ? (
            <div
              className={`mt-5 rounded-xl border px-4 py-3 text-sm font-semibold ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-600">
              O planejamento usa o saldo real como base e projeta a operacao com entrega prevista, saida prevista e indicador de estoque.
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading || !form.date}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
            >
              <FaSave />
              {saving ? "Salvando..." : "Salvar programacao"}
            </button>
          </div>
        </EstoqueDieselPanel>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-xl font-black text-slate-800">Leitura do realizado</h2>
          <div className="mt-4 space-y-3">
            <SummaryBox
              title="Saldo realizado"
              value={formatLiters(selectedRow?.actualBalance ?? 0)}
              tone="blue"
              helper="Vem da medicao diaria"
            />
            <SummaryBox
              title="Recebimento realizado"
              value={formatLiters(selectedRow?.actualReceipt ?? 0)}
              tone="emerald"
              helper="O que entrou de verdade"
            />
            <SummaryBox
              title="Saida realizada"
              value={formatLiters(selectedRow?.actualOutput ?? 0)}
              tone="amber"
              helper="Consumo real do tanque"
            />
            <SummaryBox
              title="Bombas"
              value={formatLiters(selectedRow?.actual?.saidaTotalBombas ?? 0)}
              tone="slate"
              helper="Base de comparacao operacional"
            />
            <SummaryBox
              title="Transnet"
              value={formatLiters(selectedRow?.actual?.saidaTransnet ?? 0)}
              tone="slate"
              helper="Leitura do sistema"
            />
            <SummaryBox
              title="Indicador atual"
              value={summary.indicator.label}
              tone={summary.indicator.tone}
              helper={summary.indicator.description}
            />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">
              Mercado e indicador de estoque
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Mesmo bloco da programacao: data, dia, fornecedor, preco diesel, defasagem e indicador do nivel de estoque.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
            clique na linha inteira para editar
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  "Data",
                  "Dia",
                  "Fornecedor",
                  "Preço Diesel",
                  "Defasagem (CBIE)",
                  "Defasagem R$",
                  "Indicador Nível Estoque",
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
              {monthRows.map((row) => {
                const isActive = row.date === selectedDate;
                return (
                  <tr
                    key={`market-${row.date}`}
                    onClick={() => handleSelectRow(row)}
                    className={`cursor-pointer transition hover:bg-blue-50 ${
                      isActive ? "bg-blue-50/70" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 font-black text-slate-800">
                      {new Date(`${row.date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{row.weekday}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{row.supplier || "--"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatMoney(row.dieselPrice)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatPct(row.cbieGap)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatMoney(row.gapValue)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                          row.indicator.tone === "emerald"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.indicator.tone === "amber"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {row.indicator.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">
              Programacao semanal {product === "S500" ? "Diesel S500" : "Diesel S10"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Modelo da planilha: saldo planejado, programacao de entrega, saldo pós entrega e saida programada.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
            saldo real + projecao do suprimentos
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  "Data",
                  "Dia",
                  "Saldo Planejado",
                  "Programação de Entrega",
                  "Saldo Pós Entrega",
                  "Saída Programada",
                  "Saldo Projetado",
                  "Saída Realizada",
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
              {monthRows.map((row) => {
                const isActive = row.date === selectedDate;
                return (
                  <tr
                    key={`weekly-${row.date}`}
                    onClick={() => handleSelectRow(row)}
                    className={`cursor-pointer transition hover:bg-blue-50 ${
                      isActive ? "bg-blue-50/70" : "bg-white"
                    }`}
                  >
                    <td className="px-4 py-3 font-black text-slate-800">
                      {new Date(`${row.date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{row.weekday}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.saldoPlanejado)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.plannedReceipt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.saldoPosEntrega)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.plannedOutput)}</td>
                    <td className="px-4 py-3 font-black text-slate-800">{formatLiters(row.saldoProjetado)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.actualOutput)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>

      {loading ? (
        <EstoqueDieselPanel className="p-5">
          <p className="text-sm font-semibold text-slate-500">Carregando programacao de diesel...</p>
        </EstoqueDieselPanel>
      ) : null}
    </EstoqueDieselPageShell>
  );
}
