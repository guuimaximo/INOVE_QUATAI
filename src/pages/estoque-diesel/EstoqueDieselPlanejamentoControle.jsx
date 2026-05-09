import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaGasPump,
  FaSave,
  FaTint,
} from "react-icons/fa";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
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
    highReference: 29000,
    defaultWeekdayOutput: 8500,
    defaultSaturdayOutput: 5500,
    defaultSundayOutput: 3500,
    lowLabel: "Baixo - 15 mil",
    highLabel: "Alto - 29 mil",
  },
  S10: {
    minimum: 10000,
    highReference: 29000,
    defaultWeekdayOutput: 4600,
    defaultSaturdayOutput: 3000,
    defaultSundayOutput: 1500,
    lowLabel: "Baixo - 15 mil",
    highLabel: "Alto - 29 mil",
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

function getWeekdayShort(date) {
  if (!date) return "--";
  return new Date(`${date}T00:00:00`)
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .toLowerCase();
}

function getDefaultPlannedOutput(product, date) {
  const rules = PROGRAMMING_RULES[product] || PROGRAMMING_RULES.S500;
  const weekday = getWeekdayShort(date);
  if (weekday.startsWith("dom")) return rules.defaultSundayOutput;
  if (weekday.startsWith("sáb") || weekday.startsWith("sab")) return rules.defaultSaturdayOutput;
  return rules.defaultWeekdayOutput;
}

function getIndicator(product, liters) {
  const rules = PROGRAMMING_RULES[product] || PROGRAMMING_RULES.S500;
  const level = Number(liters || 0);

  if (level <= rules.minimum) {
    return { label: rules.lowLabel, tone: "rose" };
  }

  if (level >= rules.highReference) {
    return { label: rules.highLabel, tone: "emerald" };
  }

  return { label: "Faixa intermediaria", tone: "amber" };
}

function SimpleInput({
  label,
  value,
  onChange,
  type = "text",
  step,
  placeholder = "",
  disabled = false,
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        step={step}
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

function SimpleSelect({ label, value, options, onChange }) {
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

function SummaryChip({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${tones[tone] || tones.slate}`}>
      <p className="text-[11px] font-black uppercase tracking-wider opacity-80">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-800">{value}</p>
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
    product: tank?.tipo_diesel || "S500",
    supplier: row.fornecedor_previsto || "",
    dieselPrice: row.preco_diesel ?? null,
    cbieGap: row.defasagem_cbie ?? null,
    plannedReceipt: row.entrada_prevista_litros ?? 0,
    plannedOutput: row.saida_prevista_litros ?? 0,
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
    fornecedor_previsto: String(form.supplier || "").trim() || null,
    preco_diesel: parseNumber(form.dieselPrice),
    defasagem_cbie: parseNumber(form.cbieGap),
    entrada_prevista_litros: parseNumber(form.plannedReceipt) || 0,
    saida_prevista_litros: parseNumber(form.plannedOutput) || 0,
    observacao: String(form.notes || "").trim() || null,
    usuario_id: Number.isInteger(userId) ? userId : null,
    atualizado_em: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("estoque_diesel_programacoes_diarias")
    .upsert(payload, { onConflict: "tanque_id,data_programacao" });

  if (error) throw error;
}

function buildMonthRows({ year, month, product, measurements, planningRows }) {
  const monthEntries = [...(measurements || [])]
    .filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`))
    .sort((a, b) => a.date.localeCompare(b.date));
  const monthPlanning = [...(planningRows || [])]
    .filter((entry) => entry.product === product && entry.date?.startsWith(`${year}-${month}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  const measurementByDate = Object.fromEntries(monthEntries.map((entry) => [entry.date, entry]));
  const planningByDate = Object.fromEntries(monthPlanning.map((entry) => [entry.date, entry]));

  const previousEntry =
    [...(measurements || [])]
      .filter((entry) => entry.product === product && entry.date < `${year}-${month}-01`)
      .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  let runningBalance = Number(previousEntry?.saldoFinal ?? previousEntry?.medicaoAtual ?? 0);
  const monthNumber = Number(month);
  const daysInMonth = new Date(Number(year), monthNumber, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const actual = measurementByDate[date] || null;
    const plan = planningByDate[date] || null;
    const saldoPlanejado = actual
      ? Number(actual.saldoFinal ?? actual.medicaoAtual ?? runningBalance)
      : Number(runningBalance || 0);
    const plannedReceipt = Number(plan?.plannedReceipt ?? 0);
    const plannedOutput = Number(plan?.plannedOutput ?? getDefaultPlannedOutput(product, date));
    const saldoPosEntrega = round(saldoPlanejado + plannedReceipt, 2) ?? saldoPlanejado;
    const saldoProjetado = round(saldoPosEntrega - plannedOutput, 2) ?? saldoPosEntrega;
    const indicator = getIndicator(product, actual ? actual.saldoFinal : saldoProjetado);
    const gapValue =
      plan?.dieselPrice !== null &&
      plan?.dieselPrice !== undefined &&
      plan?.cbieGap !== null &&
      plan?.cbieGap !== undefined
        ? round((Number(plan.cbieGap) * Number(plan.dieselPrice)) / 100, 4)
        : null;

    runningBalance = actual ? Number(actual.saldoFinal ?? actual.medicaoAtual ?? saldoProjetado) : saldoProjetado;

    return {
      date,
      weekday: getWeekdayShort(date),
      actual,
      actualOutput: Number(actual?.saidaTanque ?? 0),
      actualBalance: Number(actual?.saldoFinal ?? actual?.medicaoAtual ?? saldoPlanejado),
      saldoPlanejado,
      supplier: plan?.supplier || "",
      dieselPrice: plan?.dieselPrice ?? null,
      cbieGap: plan?.cbieGap ?? null,
      gapValue,
      plannedReceipt,
      saldoPosEntrega,
      plannedOutput,
      saldoProjetado,
      notes: plan?.notes || "",
      indicator,
    };
  });
}

function buildForm(date, product, row = null) {
  return {
    date,
    supplier: row?.supplier || "",
    dieselPrice: row?.dieselPrice ?? "",
    cbieGap: row?.cbieGap ?? "",
    plannedReceipt: row?.plannedReceipt ?? "",
    plannedOutput: row?.plannedOutput ?? getDefaultPlannedOutput(product, date),
    notes: row?.notes || "",
  };
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
    const lastRow = [...monthRows].reverse().find((row) => row.actualBalance || row.saldoProjetado) || selectedRow;
    return {
      balance: Number(lastRow?.actualBalance ?? lastRow?.saldoProjetado ?? 0),
      totalActualOutput: monthRows.reduce((sum, row) => sum + Number(row.actualOutput || 0), 0),
      totalPlannedReceipt: monthRows.reduce((sum, row) => sum + Number(row.plannedReceipt || 0), 0),
      totalPlannedOutput: monthRows.reduce((sum, row) => sum + Number(row.plannedOutput || 0), 0),
    };
  }, [monthRows, selectedRow]);

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
    const row = monthRows.find((item) => item.date === nextDate) || null;
    setSelectedDate(nextDate);
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

  const computed = useMemo(() => {
    const saldoPlanejado = Number(selectedRow?.saldoPlanejado ?? 0);
    const plannedReceipt = parseNumber(form.plannedReceipt) || 0;
    const plannedOutput = parseNumber(form.plannedOutput) || 0;
    const saldoPosEntrega = round(saldoPlanejado + plannedReceipt, 2) ?? saldoPlanejado;
    const saldoProjetado = round(saldoPosEntrega - plannedOutput, 2) ?? saldoPosEntrega;
    const dieselPrice = parseNumber(form.dieselPrice);
    const cbieGap = parseNumber(form.cbieGap);
    const gapValue =
      dieselPrice !== null && cbieGap !== null ? round((cbieGap * dieselPrice) / 100, 4) : null;
    return {
      saldoPlanejado,
      plannedReceipt,
      saldoPosEntrega,
      plannedOutput,
      saldoProjetado,
      dieselPrice,
      cbieGap,
      gapValue,
      indicator: getIndicator(product, saldoProjetado),
    };
  }, [form.cbieGap, form.dieselPrice, form.plannedOutput, form.plannedReceipt, product, selectedRow]);

  return (
    <EstoqueDieselPageShell
      title="Programacao de Diesel"
      description={`Visao mensal de suprimentos para ${PRODUCT_CONFIG[product].label} em ${getMonthLabel(month)} de ${year}.`}
    >
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
            <h2 className="mt-4 text-lg font-black text-slate-800">Leitura mensal da programação</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Menos card e mais visibilidade do mes inteiro, como na planilha: mercado, indicador e programação semanal em linha.
            </p>
          </div>

          <div className="space-y-3">
            <MonthSelector activeMonth={month} product={product} />
            <ProductSwitcher activeProduct={product} month={month} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryChip label="Produto" value={product} tone="blue" />
          <SummaryChip label="Saldo Atual" value={formatLiters(summary.balance)} tone="emerald" />
          <SummaryChip label="Saída Realizada" value={formatLiters(summary.totalActualOutput)} tone="slate" />
          <SummaryChip label="Entrega Prevista" value={formatLiters(summary.totalPlannedReceipt)} tone="blue" />
          <SummaryChip label="Saída Prevista" value={formatLiters(summary.totalPlannedOutput)} tone="amber" />
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <EstoqueDieselPanel className="p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800">Programação do mês</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Clique na linha do dia para editar fornecedor, preço diesel, defasagem, entrega e saída programada.
              </p>
            </div>
            <div className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider ${
              getIndicator(product, summary.balance).tone === "emerald"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : getIndicator(product, summary.balance).tone === "amber"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
            }`}>
              {getIndicator(product, summary.balance).label}
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
                    "Saldo Planejado",
                    "Entrega",
                    "Pós Entrega",
                    "Saída Prevista",
                    "Saldo Projetado",
                    "Saída Real",
                    "Indicador",
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
                      key={row.date}
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
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.saldoPlanejado)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.plannedReceipt)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.saldoPosEntrega)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.plannedOutput)}</td>
                      <td className="px-4 py-3 font-black text-slate-800">{formatLiters(row.saldoProjetado)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.actualOutput)}</td>
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

        <div ref={formRef}>
          <EstoqueDieselPanel className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-800">Editar dia</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Ajuste o dia selecionado sem perder a visão do mês inteiro.
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewDay}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
              >
                Novo dia
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <SimpleInput label="Data" type="date" value={form.date} onChange={(value) => updateField("date", value)} />
              <SimpleInput label="Dia" value={getWeekdayShort(form.date)} onChange={() => {}} disabled />
              <SimpleSelect label="Fornecedor" value={form.supplier} options={suppliers} onChange={(value) => updateField("supplier", value)} />
              <SimpleInput label="Preço Diesel" type="number" step="0.0001" value={form.dieselPrice} onChange={(value) => updateField("dieselPrice", value)} />
              <SimpleInput label="Defasagem (CBIE)" type="number" step="0.01" value={form.cbieGap} onChange={(value) => updateField("cbieGap", value)} />
              <SimpleInput label="Programação de Entrega" type="number" step="1" value={form.plannedReceipt} onChange={(value) => updateField("plannedReceipt", value)} />
              <SimpleInput label="Saída Programada" type="number" step="1" value={form.plannedOutput} onChange={(value) => updateField("plannedOutput", value)} />

              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">Observação</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ex.: entrega confirmada, consumo acima do padrão, reforço de operação."
                />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <SummaryChip label="Saldo Planejado" value={formatLiters(computed.saldoPlanejado)} tone="slate" />
              <SummaryChip label="Saldo Pós Entrega" value={formatLiters(computed.saldoPosEntrega)} tone="blue" />
              <SummaryChip label="Saldo Projetado" value={formatLiters(computed.saldoProjetado)} tone={computed.indicator.tone} />
              <SummaryChip label="Defasagem R$" value={formatMoney(computed.gapValue)} tone="amber" />
            </div>

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
                O saldo real da medição vira base da programação; daqui para frente o que muda é suprimentos.
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || !form.date}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:opacity-60"
              >
                <FaSave />
                {saving ? "Salvando..." : "Salvar programação"}
              </button>
            </div>
          </EstoqueDieselPanel>
        </div>
      </div>

      {loading ? (
        <EstoqueDieselPanel className="p-5">
          <p className="text-sm font-semibold text-slate-500">Carregando programação de diesel...</p>
        </EstoqueDieselPanel>
      ) : null}
    </EstoqueDieselPageShell>
  );
}
