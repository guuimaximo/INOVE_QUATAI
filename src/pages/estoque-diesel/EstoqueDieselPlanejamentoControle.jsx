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
  todayISO,
} from "./medicaoModel";

function formatLiters(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} L`;
}

function formatNumberInput(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
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

function StatBox({ title, value, tone = "slate", help }) {
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
      {help ? <p className="mt-1 text-[11px] font-bold opacity-80">{help}</p> : null}
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

function buildPlanningStatus(row) {
  if (row.hasActual) return { label: "Realizado", tone: "emerald" };
  if ((row.plannedOutput || 0) > 0 || (row.plannedReceipt || 0) > 0) {
    if ((row.projectedBalance || 0) < 0) return { label: "Critico", tone: "rose" };
    return { label: "Programado", tone: "blue" };
  }
  return { label: "Sem programacao", tone: "slate" };
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

  let runningBalance = Number(previousEntry?.saldoFinal ?? previousEntry?.medicaoAtual ?? 0);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const actual = measurementByDate[date] || null;
    const plan = planningByDate[date] || null;

    const openingBalance = actual
      ? Number(actual.medicaoD1 ?? runningBalance ?? 0)
      : Number(runningBalance || 0);

    const actualReceipt = Number(actual?.entradaDiesel ?? 0);
    const actualOutput = Number(actual?.saidaTanque ?? 0);
    const actualBalance = actual
      ? Number(actual.saldoFinal ?? actual.medicaoAtual ?? openingBalance)
      : Number(openingBalance);

    const plannedReceipt = Number(plan?.plannedReceipt ?? 0);
    const plannedOutput = Number(plan?.plannedOutput ?? 0);
    const projectedBalance = round(actualBalance + plannedReceipt - plannedOutput, 2) ?? actualBalance;

    runningBalance = actual ? actualBalance : projectedBalance;

    const row = {
      date,
      actual,
      plan,
      hasActual: Boolean(actual),
      openingBalance,
      actualReceipt,
      actualOutput,
      actualBalance,
      plannedReceipt,
      plannedOutput,
      projectedBalance,
      supplier: plan?.supplier || "",
      notes: plan?.notes || "",
      id: plan?.id || null,
    };

    return {
      ...row,
      statusMeta: buildPlanningStatus(row),
    };
  });
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
    observacao: String(form.notes || "").trim() || null,
    usuario_id: Number.isInteger(userId) ? userId : null,
    atualizado_em: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("estoque_diesel_programacoes_diarias")
    .upsert(payload, { onConflict: "tanque_id,data_programacao" });

  if (error) throw error;
}

function buildForm(date, selectedRow = null) {
  return {
    date,
    plannedReceipt: formatNumberInput(selectedRow?.plannedReceipt ?? ""),
    plannedOutput: formatNumberInput(selectedRow?.plannedOutput ?? ""),
    supplier: selectedRow?.supplier || "",
    notes: selectedRow?.notes || "",
  };
}

export default function EstoqueDieselPlanejamentoControle() {
  const { ano = "2026", mes = "01" } = useParams();
  const { user } = useAuth();
  const year = /^\d{4}$/.test(String(ano)) ? String(ano) : "2026";
  const month = MONTHS_2026.some((item) => item.month === mes) ? mes : "01";
  const [searchParams] = useSearchParams();
  const productParam = searchParams.get("produto") || "S500";
  const product = productParam in PRODUCT_CONFIG ? productParam : "S500";

  const formRef = useRef(null);
  const [metadata, setMetadata] = useState(null);
  const [paramStore, setParamStore] = useState(DEFAULT_PARAMS);
  const [measurements, setMeasurements] = useState([]);
  const [planningRows, setPlanningRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getDefaultDateForMonth(year, month));
  const [form, setForm] = useState(() => buildForm(getDefaultDateForMonth(year, month)));
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

  const currentStatus = selectedRow?.statusMeta || { label: "Sem programacao", tone: "slate" };

  const topStats = useMemo(() => {
    const latestRealized =
      [...monthRows]
        .filter((row) => row.hasActual)
        .sort((a, b) => b.date.localeCompare(a.date))[0] || selectedRow;

    const totalActualOutput = monthRows.reduce((sum, row) => sum + Number(row.actualOutput || 0), 0);
    const totalPlannedOutput = monthRows.reduce((sum, row) => sum + Number(row.plannedOutput || 0), 0);
    const currentBalance = Number(latestRealized?.actualBalance ?? latestRealized?.projectedBalance ?? 0);

    return {
      currentBalance,
      totalActualOutput,
      totalPlannedOutput,
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
    setForm(buildForm(selectedRow.date, selectedRow));
  }, [selectedRow]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSelectRow(row) {
    setSelectedDate(row.date);
    setForm(buildForm(row.date, row));
    setFeedback(null);
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetFormToToday() {
    const nextDate = getDefaultDateForMonth(year, month);
    setSelectedDate(nextDate);
    const row = monthRows.find((item) => item.date === nextDate) || null;
    setForm(buildForm(nextDate, row));
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

  const projectedBalance = useMemo(() => {
    const base = Number(selectedRow?.actualBalance ?? selectedRow?.openingBalance ?? 0);
    const entrada = parseNumber(form.plannedReceipt) || 0;
    const saida = parseNumber(form.plannedOutput) || 0;
    return round(base + entrada - saida, 2) ?? base;
  }, [form.plannedOutput, form.plannedReceipt, selectedRow]);

  return (
    <EstoqueDieselPageShell
      title="Programacao de Diesel"
      description={`Saldo diario, saida realizada e saida prevista de ${PRODUCT_CONFIG[product].label} em ${getMonthLabel(
        month
      )} de ${year}.`}
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
          sub={`${year} em planejamento`}
          icon={<FaCalendarAlt />}
          tone="slate"
        />
        <EstoqueDieselStat
          title="Saldo atual"
          value={formatLiters(topStats.currentBalance)}
          sub="Base diaria do tanque"
          icon={<FaTruckLoading />}
          tone="emerald"
        />
        <EstoqueDieselStat
          title="Saida prevista"
          value={formatLiters(topStats.totalPlannedOutput)}
          sub={`Realizado no mes: ${formatLiters(topStats.totalActualOutput)}`}
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
            <h2 className="mt-4 text-lg font-black text-slate-800">Abertura do planejamento</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Use o saldo realizado do tanque como base do dia e lance a saida prevista para projetar o fechamento.
            </p>
          </div>

          <div className="space-y-3">
            <MonthSelector activeMonth={month} product={product} />
            <ProductSwitcher activeProduct={product} month={month} />
          </div>
        </div>
      </EstoqueDieselPanel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div ref={formRef}>
        <EstoqueDieselPanel className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800">Programacao do dia</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                O saldo realizado ja vem da medicao diaria. Aqui voce programa a entrada prevista e a saida prevista do dia.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider ${
                currentStatus.tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : currentStatus.tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : currentStatus.tone === "rose"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
              }`}>
                {currentStatus.label}
              </div>
              <button
                type="button"
                onClick={resetFormToToday}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
              >
                Novo dia
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <FormInput label="Data" value={form.date} onChange={(value) => updateField("date", value)} type="date" required />
            <FormInput
              label="Saldo base do dia"
              value={formatLiters(selectedRow?.actualBalance ?? selectedRow?.openingBalance ?? 0)}
              onChange={() => {}}
              type="text"
              disabled
            />
            <FormInput
              label="Saida realizada"
              value={formatLiters(selectedRow?.actualOutput ?? 0)}
              onChange={() => {}}
              type="text"
              disabled
            />
            <FormInput
              label="Recebimento realizado"
              value={formatLiters(selectedRow?.actualReceipt ?? 0)}
              onChange={() => {}}
              type="text"
              disabled
            />
            <FormInput
              label="Entrada prevista (litros)"
              value={form.plannedReceipt}
              onChange={(value) => updateField("plannedReceipt", value)}
              placeholder="0"
            />
            <FormInput
              label="Saida prevista (litros)"
              value={form.plannedOutput}
              onChange={(value) => updateField("plannedOutput", value)}
              placeholder="0"
              required
            />
            <FormInput
              label="Fornecedor previsto"
              value={form.supplier}
              onChange={(value) => updateField("supplier", value)}
              type="text"
              placeholder="Opcional para entrega prevista"
            />
            <label className="block md:col-span-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Observacao da programacao
              </span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Ex.: reforco de frota, demanda especial, abastecimento previsto, ajuste de consumo."
              />
            </label>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-4">
            <StatBox
              title="Saldo base"
              value={formatLiters(selectedRow?.actualBalance ?? selectedRow?.openingBalance ?? 0)}
              tone="slate"
              help="Ultimo saldo realizado do dia"
            />
            <StatBox
              title="Entrada prevista"
              value={formatLiters(parseNumber(form.plannedReceipt) || 0)}
              tone="blue"
              help="Recebimento previsto para o dia"
            />
            <StatBox
              title="Saida prevista"
              value={formatLiters(parseNumber(form.plannedOutput) || 0)}
              tone="amber"
              help="Consumo esperado do dia"
            />
            <StatBox
              title="Saldo projetado"
              value={formatLiters(projectedBalance)}
              tone={projectedBalance < 0 ? "rose" : "emerald"}
              help={projectedBalance < 0 ? "Projecao abaixo de zero" : "Projecao apos o planejamento"}
            />
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
              O saldo projetado usa o saldo realizado do tanque como base e soma a entrada prevista menos a saida prevista.
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
        </div>

        <EstoqueDieselPanel className="p-5">
          <h2 className="text-xl font-black text-slate-800">Leitura rapida do dia</h2>
          <div className="mt-4 space-y-3">
            <StatBox
              title="Medição D-1"
              value={formatLiters(selectedRow?.actual?.medicaoD1 ?? selectedRow?.openingBalance ?? 0)}
              tone="slate"
            />
            <StatBox
              title="Saldo realizado"
              value={formatLiters(selectedRow?.actualBalance ?? 0)}
              tone="blue"
            />
            <StatBox
              title="Recebimento realizado"
              value={formatLiters(selectedRow?.actualReceipt ?? 0)}
              tone="emerald"
            />
            <StatBox
              title="Saída realizada"
              value={formatLiters(selectedRow?.actualOutput ?? 0)}
              tone="amber"
            />
            <StatBox
              title="Transnet do dia"
              value={formatLiters(selectedRow?.actual?.saidaTransnet ?? 0)}
              tone="slate"
            />
            <StatBox
              title="Bombas do dia"
              value={formatLiters(selectedRow?.actual?.saidaTotalBombas ?? 0)}
              tone="slate"
            />
          </div>
        </EstoqueDieselPanel>
      </div>

      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Tabela da programacao do mes</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Clique na linha inteira para abrir o dia em cima e ajustar a programacao.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">
            1 linha por dia com realizado + previsto
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
              <tr>
                {[
                  "Data",
                  "Saldo base",
                  "Receb. realizado",
                  "Saida realizada",
                  "Saldo realizado",
                  "Entrada prevista",
                  "Saida prevista",
                  "Saldo projetado",
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
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.openingBalance)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.actualReceipt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.actualOutput)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.actualBalance)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.plannedReceipt)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-600">{formatLiters(row.plannedOutput)}</td>
                    <td className="px-4 py-3 font-black text-slate-800">{formatLiters(row.projectedBalance)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                          row.statusMeta.tone === "emerald"
                            ? "bg-emerald-50 text-emerald-700"
                            : row.statusMeta.tone === "amber"
                              ? "bg-amber-50 text-amber-700"
                              : row.statusMeta.tone === "rose"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {row.statusMeta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </EstoqueDieselPanel>

      {loading ? (
        <EstoqueDieselPanel className="p-5">
          <p className="text-sm font-semibold text-slate-500">Carregando saldo e programacao do diesel...</p>
        </EstoqueDieselPanel>
      ) : null}
    </EstoqueDieselPageShell>
  );
}
