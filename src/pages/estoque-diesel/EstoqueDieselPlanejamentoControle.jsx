import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { FaBolt, FaChartLine, FaGasPump, FaSave, FaTint } from "react-icons/fa";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import EstoqueDieselPageShell, {
  EstoqueDieselPanel,
} from "../../components/estoque-diesel/EstoqueDieselPageShell";
import {
  DEFAULT_PARAMS,
  MONTHS_2026,
  PRODUCT_CONFIG,
  fetchDieselReceipts,
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
    capacity: 30000,
    defaultWeekdayOutput: 4200,
    defaultSaturdayOutput: 2500,
    defaultSundayOutput: 1500,
    defaultHolidayOutput: 1500,
    lowLabel: "Baixo - 15 mil",
    highLabel: "Alto - 29 mil",
  },
  S10: {
    minimum: 10000,
    highReference: 29000,
    capacity: 30000,
    defaultWeekdayOutput: 4200,
    defaultSaturdayOutput: 2500,
    defaultSundayOutput: 1500,
    defaultHolidayOutput: 1500,
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

function formatPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";

  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatDateBR(date) {
  if (!date) return "--";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "--";

  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProductCode(value) {
  const text = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (text.includes("S10")) return "S10";
  if (text.includes("S500") || text.includes("S0500") || text.includes("DIESEL500")) return "S500";

  return "S500";
}

function shiftDate(date, days) {
  if (!date) return date;

  const current = new Date(`${date}T00:00:00`);
  current.setDate(current.getDate() + days);

  return current.toISOString().slice(0, 10);
}

function getMonthLastDate(year, month) {
  return `${year}-${month}-${String(new Date(Number(year), Number(month), 0).getDate()).padStart(
    2,
    "0"
  )}`;
}

function getPlanningSourceDateForViewDate(date) {
  return shiftDate(date, 1);
}

function getMeasurementSourceDateForViewDate(date) {
  return shiftDate(date, 1);
}

function getWeekdayShort(date) {
  if (!date) return "--";

  return new Date(`${date}T00:00:00`)
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .toLowerCase();
}

function isSaturday(date) {
  const weekday = getWeekdayShort(date);
  return weekday.startsWith("sáb") || weekday.startsWith("sab");
}

function isSunday(date) {
  return getWeekdayShort(date).startsWith("dom");
}

function normalizeDateList(text) {
  return String(text || "")
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function classifyProjectionDay(date, holidayDates = []) {
  const holidaySet = new Set(holidayDates);

  if (holidaySet.has(date)) return "holiday";
  if (isSunday(date)) return "sunday";
  if (isSaturday(date)) return "saturday";

  return "weekday";
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
  const capacity = rules.capacity ?? 30000;

  if (level > capacity) {
    return { label: "Não cabe", tone: "rose" };
  }

  if (level <= rules.minimum) {
    return { label: rules.lowLabel, tone: "rose" };
  }

  if (level >= rules.highReference) {
    return { label: rules.highLabel, tone: "emerald" };
  }

  return { label: "Faixa intermediaria", tone: "amber" };
}

function getStatusFromDiff(pctDiffTransnet, fallbackStatus = "OK") {
  if (
    pctDiffTransnet === null ||
    pctDiffTransnet === undefined ||
    Number.isNaN(Number(pctDiffTransnet))
  ) {
    return fallbackStatus || "OK";
  }

  const absValue = Math.abs(Number(pctDiffTransnet));

  if (absValue > 0.03) return "Critico";
  if (absValue > 0.02) return "Atencao";

  return "OK";
}

function filterMeasurementWindow(entries, year, month, product) {
  const start = shiftDate(`${year}-${month}-01`, -7);
  const end = shiftDate(getMonthLastDate(year, month), 1);

  return [...(entries || [])]
    .filter((entry) => entry.product === product)
    .filter((entry) => entry.date >= start && entry.date <= end)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function buildMeasurementCascadeRows({ measurements, product }) {
  const productEntries = [...(measurements || [])]
    .filter((entry) => entry.product === product)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  let runningSaldoFinal = null;

  return productEntries.map((entry) => {
    const saldoAnteriorOriginal = safeNumber(
      entry?.saldoAnterior ?? entry?.medicaoD1 ?? entry?.saldoPlanejado ?? 0,
      0
    );

    const saldoAnterior =
      runningSaldoFinal !== null && runningSaldoFinal !== undefined
        ? runningSaldoFinal
        : saldoAnteriorOriginal;

    const entradaDiesel = safeNumber(
      entry?.entradaDiesel ??
        entry?.entradaRecebimentos ??
        entry?.receiptMeasuredLiters ??
        entry?.nfVolumeLitros ??
        0,
      0
    );

    const saldoFinal = safeNumber(
      entry?.saldoFinal ?? entry?.medicaoAtual ?? entry?.actualBalance ?? 0,
      0
    );

    const saidaTanqueCalculada = saldoAnterior + entradaDiesel - saldoFinal;

    const saidaTanque = Number.isFinite(saidaTanqueCalculada)
      ? saidaTanqueCalculada
      : safeNumber(entry?.saidaTanque ?? 0, 0);

    const saidaTransnet = safeNumber(
      entry?.saidaTransnet ?? entry?.transnetOutput ?? 0,
      0
    );

    const saidaTotalBombas = safeNumber(
      entry?.saidaTotalBombas ?? entry?.bombas ?? 0,
      0
    );

    const pctDiffNF = entradaDiesel > 0 ? safeNumber(entry?.pctDiffNF, null) : null;

    const pctDiffTransnet =
      saidaTransnet > 0 ? (saidaTanque - saidaTransnet) / saidaTransnet : null;

    const status = getStatusFromDiff(pctDiffTransnet, entry?.status);

    const normalized = {
      ...entry,
      saldoAnterior,
      medicaoD1: saldoAnterior,
      entradaDiesel,
      entradaRecebimentos: entradaDiesel,
      saldoFinal,
      medicaoAtual: saldoFinal,
      saidaTanque,
      saidaTransnet,
      transnetOutput: saidaTransnet,
      saidaTotalBombas,
      pctDiffNF,
      pctDiffTransnet,
      status,
    };

    runningSaldoFinal = saldoFinal;

    return normalized;
  });
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
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>

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
      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
        {label}
      </span>

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
      <p className="text-[11px] font-black uppercase tracking-wider opacity-80">
        {label}
      </p>
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

  const paramSuppliers = (paramStore?.[product]?.suppliers || []).map((item) =>
    String(item || "").trim()
  );

  return [...new Set([...metadataSuppliers, ...paramSuppliers])].sort((a, b) =>
    a.localeCompare(b)
  );
}

function mapPlanningRow(row, metadata) {
  const tank = metadata?.tanksById?.[row.tanque_id];

  return {
    id: row.id,
    date: row.data_programacao,
    tankId: row.tanque_id,
    product: normalizeProductCode(tank?.tipo_diesel || row.tipo_diesel || row.produto || "S500"),
    supplier: row.fornecedor_previsto || "",
    dieselPrice: row.preco_diesel ?? null,
    cbieGap: row.defasagem_cbie ?? null,
    plannedReceipt: row.entrada_prevista_litros ?? 0,
    plannedOutput: row.saida_prevista_litros ?? 0,
    notes: row.observacao || "",
  };
}

async function fetchPlanningRows({ year, month, product = null, metadata, includeAllProducts = false }) {
  const from = shiftDate(`${year}-${month}-01`, -10);
  const to = shiftDate(getMonthLastDate(year, month), 45);

  let query = supabase
    .from("estoque_diesel_programacoes_diarias")
    .select("*")
    .gte("data_programacao", from)
    .lte("data_programacao", to)
    .order("data_programacao", { ascending: true });

  if (!includeAllProducts && product) {
    const tankId = metadata?.tanksByProduct?.[product]?.id;
    if (tankId) query = query.eq("tanque_id", tankId);
  }

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

function buildMonthRows({ year, month, product, measurements, planningRows, receipts = [] }) {
  const cascadedMeasurements = buildMeasurementCascadeRows({ measurements, product });
  const receiptByDate = buildReceiptSummaryMap(receipts);

  const monthPlanning = [...(planningRows || [])]
    .filter((entry) => entry.product === product)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  const measurementByDate = Object.fromEntries(
    cascadedMeasurements.map((entry) => [entry.date, entry])
  );

  const planningByDate = Object.fromEntries(
    monthPlanning.map((entry) => [entry.date, entry])
  );

  const previousEntry =
    [...cascadedMeasurements]
      .filter((entry) => entry.product === product && entry.date < `${year}-${month}-01`)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || null;

  let runningBalance = safeNumber(
    previousEntry?.saldoFinal ?? previousEntry?.medicaoAtual ?? 0,
    0
  );

  const monthNumber = Number(month);
  const daysInMonth = new Date(Number(year), monthNumber, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const planningSourceDate = getPlanningSourceDateForViewDate(date);
    const measurementSourceDate = getMeasurementSourceDateForViewDate(date);

    const actual = measurementByDate[measurementSourceDate] || null;
    const plan = planningByDate[planningSourceDate] || null;
    const realizedDay = Boolean(actual);

    // Recebimento na data REAL (medicao do mesmo dia, com fallback p/ tabela de recebimentos),
    // em vez de herdar a entrada do dia D+1 da medicao.
    const sameDayMeasurement = measurementByDate[date] || null;
    const sameDayEntrada = safeNumber(
      sameDayMeasurement?.entradaDiesel ??
        sameDayMeasurement?.entradaRecebimentos ??
        sameDayMeasurement?.receiptMeasuredLiters ??
        0,
      0
    );
    const recebidoReal =
      sameDayEntrada > 0
        ? sameDayEntrada
        : safeNumber(receiptByDate.get(date)?.receivedLiters ?? 0, 0);

    if (realizedDay) {
      // Saldo anterior medido (vem da tabela de medicao) ja inclui o recebimento do dia embutido
      // no saldo final. Removemos o recebimento da abertura para ele ser contado uma unica vez
      // (na coluna Recebimento) e manter a cascata continua.
      const saldoAnteriorMedido = safeNumber(
        actual?.saldoAnterior ?? actual?.medicaoD1 ?? runningBalance,
        runningBalance
      );
      const saldoPlanejado =
        round(saldoAnteriorMedido - recebidoReal, 2) ?? saldoAnteriorMedido;

      const entradaReal = safeNumber(
        actual?.entradaDiesel ??
          actual?.entradaRecebimentos ??
          actual?.receiptMeasuredLiters ??
          0,
        0
      );

      const saidaTanque = safeNumber(
        actual?.saidaTanque ??
          Math.max(
            0,
            saldoPlanejado + entradaReal - safeNumber(actual?.saldoFinal ?? actual?.medicaoAtual, 0)
          ),
        0
      );

      const saidaTransnet = safeNumber(
        actual?.saidaTransnet ?? actual?.transnetOutput ?? 0,
        0
      );

      const saldoPosEntrega = round(saldoPlanejado + recebidoReal, 2) ?? saldoPlanejado;
      const saldoProjetado = round(saldoPosEntrega - saidaTanque, 2) ?? saldoPosEntrega;
      const indicator = getIndicator(product, saldoPosEntrega);

      runningBalance = saldoProjetado;

      return {
        date,
        planningSourceDate,
        measurementSourceDate,
        isRealized: true,
        weekday: getWeekdayShort(date),
        actual,
        actualOutput: saidaTransnet,
        actualBalance: saldoProjetado,
        saldoPlanejado,
        supplier: plan?.supplier || "",
        dieselPrice: plan?.dieselPrice ?? null,
        cbieGap: plan?.cbieGap ?? null,
        gapValue:
          plan?.dieselPrice !== null &&
          plan?.dieselPrice !== undefined &&
          plan?.cbieGap !== null &&
          plan?.cbieGap !== undefined
            ? round((Number(plan.cbieGap) * Number(plan.dieselPrice)) / 100, 4)
            : null,
        plannedReceipt: recebidoReal,
        saldoPosEntrega,
        plannedOutput: saidaTanque,
        saldoProjetado,
        notes: plan?.notes || "",
        indicator,
      };
    }

    const saldoPlanejado = safeNumber(runningBalance, 0);
    const plannedReceipt =
      recebidoReal > 0 ? recebidoReal : safeNumber(plan?.plannedReceipt ?? 0, 0);
    const plannedOutput = safeNumber(
      plan?.plannedOutput ?? getDefaultPlannedOutput(product, date),
      0
    );

    const saldoPosEntrega = round(saldoPlanejado + plannedReceipt, 2) ?? saldoPlanejado;
    const saldoProjetado = round(saldoPosEntrega - plannedOutput, 2) ?? saldoPosEntrega;
    const indicator = getIndicator(product, saldoPosEntrega);

    const gapValue =
      plan?.dieselPrice !== null &&
      plan?.dieselPrice !== undefined &&
      plan?.cbieGap !== null &&
      plan?.cbieGap !== undefined
        ? round((Number(plan.cbieGap) * Number(plan.dieselPrice)) / 100, 4)
        : null;

    runningBalance = saldoProjetado;

    return {
      date,
      planningSourceDate,
      measurementSourceDate,
      isRealized: false,
      weekday: getWeekdayShort(date),
      actual: null,
      actualOutput: 0,
      actualBalance: saldoProjetado,
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

function buildReceiptSummaryMap(receipts = []) {
  const summaryByDate = new Map();

  for (const receipt of receipts) {
    const date = receipt?.date || receipt?.dataRecebimento || null;
    if (!date) continue;

    const current = summaryByDate.get(date) || {
      date,
      supplier: "",
      dieselPrice: null,
      receivedLiters: 0,
    };

    current.receivedLiters += safeNumber(
      receipt?.volumeRecebidoLitros ?? receipt?.nfVolumeLitros,
      0
    );

    if (!current.supplier && String(receipt?.supplier || "").trim()) {
      current.supplier = String(receipt.supplier).trim();
    }

    if (
      (current.dieselPrice === null || current.dieselPrice === undefined) &&
      receipt?.unitPrice !== null &&
      receipt?.unitPrice !== undefined
    ) {
      current.dieselPrice = receipt.unitPrice;
    }

    summaryByDate.set(date, current);
  }

  return summaryByDate;
}

function decorateReceiptHighlightRows(rows = [], receipts = []) {
  const receiptSummaryByDate = buildReceiptSummaryMap(receipts);
  const forwardedSourceDates = new Map();

  for (const row of rows) {
    const receiptDate = row?.actual?.date || null;
    const receiptSummary = receiptDate ? receiptSummaryByDate.get(receiptDate) : null;

    if (receiptSummary && receiptDate !== row.date) {
      forwardedSourceDates.set(row.date, receiptDate);
    }
  }

  return rows.map((row) => {
    const receiptSummary = receiptSummaryByDate.get(row.date) || null;
    const scheduledQuantity = safeNumber(row.plannedReceipt ?? 0, 0);
    const forwardedToDate = forwardedSourceDates.get(row.date) || null;

    let receiptStatus = null;
    let receiptNoticeQuantity = null;
    let receiptNoticeLabel = "";
    let displaySupplier = row.supplier || "";
    let displayDieselPrice = row.dieselPrice ?? null;

    if (receiptSummary) {
      receiptStatus = "received";
      receiptNoticeQuantity = receiptSummary.receivedLiters;
      receiptNoticeLabel = "Ja recebido";
      displaySupplier = receiptSummary.supplier || displaySupplier;
      displayDieselPrice =
        receiptSummary.dieselPrice !== null && receiptSummary.dieselPrice !== undefined
          ? receiptSummary.dieselPrice
          : displayDieselPrice;
    } else if (!row.isRealized && scheduledQuantity > 0) {
      receiptStatus = "scheduled";
      receiptNoticeQuantity = scheduledQuantity;
      receiptNoticeLabel = "Programado";
    }

    return {
      ...row,
      receiptStatus,
      receiptNoticeQuantity,
      receiptNoticeLabel,
      receiptForwardedToDate: forwardedToDate,
      displaySupplier,
      displayDieselPrice,
    };
  });
}

function getReceiptRowClasses(status, isActive) {
  if (status === "received") {
    return [
      "bg-emerald-50/85 font-black text-slate-900",
      isActive ? "ring-1 ring-inset ring-emerald-200" : "",
      "hover:bg-emerald-100/80",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (status === "scheduled") {
    return [
      "bg-amber-50/90 font-black text-slate-900",
      isActive ? "ring-1 ring-inset ring-amber-200" : "",
      "hover:bg-amber-100/80",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return `${isActive ? "bg-blue-50/70" : "bg-white"} hover:bg-blue-50`;
}

function getReceiptValueText(row) {
  if (row.receiptForwardedToDate) return "--";

  if (row.receiptNoticeQuantity !== null && row.receiptNoticeQuantity !== undefined) {
    return formatLiters(row.receiptNoticeQuantity);
  }

  return formatLiters(row.plannedReceipt);
}

function mapReceiptToAnalyticalRow(receipt) {
  return {
    id: receipt.id,
    date: receipt.date || receipt.dataRecebimento,
    product: normalizeProductCode(receipt.product || receipt.tipoDiesel || "S500"),
    supplier: receipt.supplier || "",
    dieselPrice: receipt.unitPrice ?? null,
    cbieGap: null,
    cbieValue: null,
    plannedReceipt: safeNumber(
      receipt.volumeRecebidoLitros ?? receipt.nfVolumeLitros,
      0
    ),
    sourceKind: "receipt",
  };
}

function mapPlanningToProjectedAnalyticalRow(row) {
  return {
    ...row,
    date: shiftDate(row.date, -1),
    product: normalizeProductCode(row.product),
    sourceKind: "planning",
  };
}

function buildForm(date, product, row = null) {
  const sourceDate = row?.planningSourceDate || getPlanningSourceDateForViewDate(date);

  return {
    date: sourceDate,
    visualDate: date,
    supplier: row?.supplier || "",
    dieselPrice: row?.dieselPrice ?? "",
    cbieGap: row?.cbieGap ?? "",
    plannedReceipt: row?.plannedReceipt ?? "",
    plannedOutput: row?.plannedOutput ?? getDefaultPlannedOutput(product, date),
    notes: row?.notes || "",
  };
}


function buildAnalyticalRows(planningRows = [], receipts = []) {
  const products = ["S500", "S10"];
  const today = todayISO();

  return products.reduce((acc, product) => {
    const realizedPurchases = [...(receipts || [])]
      .map((receipt) => mapReceiptToAnalyticalRow(receipt))
      .filter((row) => row.product === product)
      .filter((row) => safeNumber(row.plannedReceipt, 0) > 0)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    const futureProjectedPurchases = [...planningRows]
      .map((row) => mapPlanningToProjectedAnalyticalRow(row))
      .filter((row) => row.product === product)
      .filter((row) => safeNumber(row.plannedReceipt, 0) > 0 || safeNumber(row.dieselPrice, 0) > 0)
      .filter((row) => row.date > today)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    const timeline = [...realizedPurchases, ...futureProjectedPurchases].sort(
      (a, b) => String(a.date || "").localeCompare(String(b.date || ""))
    );

    const withVariation = timeline.map((row, index) => {
      const previousWithPrice = [...timeline]
        .slice(0, index)
        .reverse()
        .find((item) => safeNumber(item.dieselPrice, 0) > 0);

      const previousPrice = previousWithPrice ? safeNumber(previousWithPrice.dieselPrice, 0) : null;
      const currentPrice = safeNumber(row.dieselPrice, null);

      const variationValue =
        previousPrice && previousPrice > 0 && currentPrice !== null ? currentPrice - previousPrice : null;

      const variationPct =
        previousPrice && previousPrice > 0 && currentPrice !== null
          ? ((currentPrice - previousPrice) / previousPrice) * 100
          : null;

      const cbieValue =
        row?.dieselPrice !== null &&
        row?.dieselPrice !== undefined &&
        row?.cbieGap !== null &&
        row?.cbieGap !== undefined
          ? round((Number(row.cbieGap) * Number(row.dieselPrice)) / 100, 4)
          : null;

      return {
        ...row,
        previousPrice,
        variationValue,
        variationPct,
        cbieValue,
      };
    });

    const realized = [...withVariation]
      .filter((row) => row.sourceKind === "receipt")
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    const future = [...withVariation]
      .filter((row) => row.sourceKind === "planning")
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

    // Se não houver compras com data <= hoje, mostra as últimas compras conhecidas da janela,
    // para não deixar a tela vazia em bases de teste ou meses futuros.
    const fallbackLastPurchases = [...realizedPurchases]
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
      .slice(-7);

    acc[product] = {
      lastPurchases: realized.length ? realized.slice(-7) : fallbackLastPurchases,
      futurePurchases: future,
      allPurchases: withVariation,
    };

    return acc;
  }, {});
}

function canvasRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function canvasText(ctx, text, x, y, maxWidth = 160) {
  const value = String(text ?? "--");
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y);
    return;
  }

  let clipped = value;
  while (clipped.length > 3 && ctx.measureText(`${clipped}...`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  ctx.fillText(`${clipped}...`, x, y);
}


function drawInfoChip(ctx, { x, y, width, height, label, value, borderColor, bgColor, labelColor, valueColor }) {
  canvasRoundRect(ctx, x, y, width, height, 16);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = labelColor;
  ctx.font = "bold 12px Arial";
  ctx.fillText(label.toUpperCase(), x + 14, y + 12);

  ctx.fillStyle = valueColor;
  ctx.font = "bold 18px Arial";
  ctx.fillText(value, x + 14, y + 34);
}

function drawModernTableCard(ctx, { title, x, y, width, columns, rows, rowHeight = 34 }) {
  const padding = 16;
  const titleHeight = 26;
  const headerHeight = 34;
  const tableTop = y + padding + titleHeight + 12;
  const bodyRows = rows.length ? rows : [{ empty: true }];
  const bodyHeight = bodyRows.length * rowHeight;
  const cardHeight = padding + titleHeight + 12 + headerHeight + bodyHeight + 14;

  canvasRoundRect(ctx, x, y, width, cardHeight, 18);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#dbe2ea";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(title.toUpperCase(), x + padding, y + padding);

  canvasRoundRect(ctx, x + padding, tableTop, width - padding * 2, headerHeight, 14);
  ctx.fillStyle = "#f3f6fa";
  ctx.fill();

  let currentX = x + padding;
  columns.forEach((column, index) => {
    const innerX = currentX + (index === 0 ? 12 : 10);
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    canvasText(ctx, column.label.toUpperCase(), innerX, tableTop + headerHeight / 2, column.width - 16);
    currentX += column.width;
  });

  bodyRows.forEach((row, rowIndex) => {
    const rowY = tableTop + headerHeight + rowIndex * rowHeight;

    if (rowIndex > 0) {
      ctx.strokeStyle = "#edf2f7";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + padding, rowY);
      ctx.lineTo(x + width - padding, rowY);
      ctx.stroke();
    }

    currentX = x + padding;
    columns.forEach((column) => {
      const textX = currentX + 10;
      const textY = rowY + rowHeight / 2;

      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.font = column.bold ? "bold 13px Arial" : "13px Arial";
      ctx.fillStyle = row.empty ? "#94a3b8" : column.color?.(row) || "#334155";

      let value = row.empty ? "Nenhum dado encontrado" : column.value(row);
      if (column.renderBadge && !row.empty) {
        const badge = column.renderBadge(row);
        canvasRoundRect(ctx, currentX + 6, rowY + 7, badge.width, rowHeight - 14, 12);
        ctx.fillStyle = badge.bg;
        ctx.fill();
        ctx.strokeStyle = badge.border;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = badge.color;
        ctx.font = "bold 12px Arial";
        ctx.fillText(badge.text, currentX + 16, textY);
      } else {
        canvasText(ctx, value, textX, textY, column.width - 16);
      }

      currentX += column.width;
    });
  });

  return cardHeight;
}

function downloadAnalyticalImage(product, data) {
  const last = [...(data?.lastPurchases || [])].slice(0, 7);
  const future = [...(data?.futurePurchases || [])].slice(0, 12);
  const lastPrice = last[0]?.dieselPrice ?? null;
  const futureLiters = future.reduce((sum, row) => sum + safeNumber(row.plannedReceipt, 0), 0);

  const width = 1600;
  const headerHeight = 92;
  const topCardHeight = 92;
  const gap = 16;

  const tableColumns = [
    { label: "Data", width: 110, value: (row) => formatDateBR(row.date), bold: true, color: () => "#0f172a" },
    { label: "Dia", width: 70, value: (row) => getWeekdayShort(row.date) },
    { label: "Fornecedor", width: 160, value: (row) => row.supplier || "--" },
    {
      label: "Produto",
      width: 86,
      value: (row) => row.product || product,
      renderBadge: (row) => ({
        text: row.product || product,
        width: 42,
        bg: product === "S10" ? "#ecfdf5" : "#eff6ff",
        border: product === "S10" ? "#86efac" : "#93c5fd",
        color: product === "S10" ? "#047857" : "#1d4ed8",
      }),
    },
    { label: "Litros", width: 110, value: (row) => formatLiters(row.plannedReceipt) },
    { label: "Preço/Litro", width: 110, value: (row) => formatPrice(row.dieselPrice) },
    {
      label: "Variação",
      width: 140,
      value: (row) =>
        row.variationValue == null ? "--" : `${Number(row.variationValue) > 0 ? "+" : ""}${formatPrice(row.variationValue)}`,
      color: (row) =>
        row.variationValue == null ? "#94a3b8" : Number(row.variationValue) > 0 ? "#dc2626" : "#059669",
      bold: true,
    },
    {
      label: "Defasagem CBIE",
      width: 140,
      value: (row) => formatPct(row.cbieGap),
      color: (row) => safeNumber(row.cbieGap, 0) > 0 ? "#dc2626" : "#059669",
    },
    {
      label: "Defasagem R$",
      width: 130,
      value: (row) => formatPrice(row.cbieValue),
      color: (row) => safeNumber(row.cbieValue, 0) > 0 ? "#dc2626" : "#059669",
    },
  ];

  const estimateCardHeight = (rowsCount) => 16 + 26 + 12 + 34 + Math.max(rowsCount, 1) * 34 + 14;
  const topTableHeight = estimateCardHeight(last.length);
  const bottomTableHeight = estimateCardHeight(future.length);

  const height = headerHeight + gap + topCardHeight + gap + topTableHeight + gap + bottomTableHeight + 28;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // Header section
  canvasRoundRect(ctx, 16, 16, width - 32, headerHeight, 20);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#dbe2ea";
  ctx.lineWidth = 1;
  ctx.stroke();

  canvasRoundRect(ctx, 32, 32, 74, 28, 14);
  ctx.fillStyle = product === "S10" ? "#ecfdf5" : "#eff6ff";
  ctx.fill();
  ctx.strokeStyle = product === "S10" ? "#86efac" : "#93c5fd";
  ctx.stroke();
  ctx.fillStyle = product === "S10" ? "#047857" : "#1d4ed8";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(product, 44, 46);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 18px Arial";
  ctx.fillText(`Análise de compras ${product}`, 122, 42);
  ctx.fillStyle = "#64748b";
  ctx.font = "13px Arial";
  ctx.fillText("Últimas 7 compras e compras futuras projetadas.", 122, 66);

  drawInfoChip(ctx, {
    x: width - 370,
    y: 28,
    width: 110,
    height: 58,
    label: "Último Preço",
    value: formatPrice(lastPrice),
    borderColor: "#bfdbfe",
    bgColor: "#eff6ff",
    labelColor: "#3b82f6",
    valueColor: "#0f172a",
  });

  drawInfoChip(ctx, {
    x: width - 244,
    y: 28,
    width: 140,
    height: 58,
    label: "Litros Futuros",
    value: formatLiters(futureLiters),
    borderColor: "#fde68a",
    bgColor: "#fff7ed",
    labelColor: "#d97706",
    valueColor: "#0f172a",
  });

  // top compact info card matching screen style
  const contentX = 16;
  const contentWidth = width - 32;
  let currentY = 16 + headerHeight + gap;

  const topTableTitle = `Últimas 7 compras - ${product}`;
  const bottomTableTitle = `Compras futuras projetadas - ${product}`;

  const firstTableHeight = drawModernTableCard(ctx, {
    title: topTableTitle,
    x: contentX,
    y: currentY,
    width: contentWidth,
    columns: tableColumns,
    rows: last,
  });

  currentY += firstTableHeight + gap;

  drawModernTableCard(ctx, {
    title: bottomTableTitle,
    x: contentX,
    y: currentY,
    width: contentWidth,
    columns: tableColumns,
    rows: future,
  });

  const link = document.createElement("a");
  link.download = `programacao_analitica_${product}_${todayISO()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function ProductBadge({ product }) {
  const tone =
    product === "S10"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${tone}`}>
      {product}
    </span>
  );
}

function PriceVariation({ value, pct }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className="font-semibold text-slate-400">--</span>;
  }

  const positive = Number(value) > 0;
  const neutral = Number(value) === 0;

  return (
    <div
      className={`font-black ${
        neutral ? "text-slate-500" : positive ? "text-rose-600" : "text-emerald-600"
      }`}
    >
      {positive ? "+" : ""}
      {formatPrice(value)}
      <span className="ml-2 text-xs">
        ({positive ? "+" : ""}
        {formatPct(pct)})
      </span>
    </div>
  );
}

function AnalyticalTable({ title, rows, emptyText }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">{title}</h4>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              {[
                "Data",
                "Dia",
                "Fornecedor",
                "Produto",
                "Litros",
                "Preço/Litro",
                "Variação",
                "Defasagem CBIE",
                "Defasagem R$",
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
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.product}-${row.date}-${row.id || row.plannedReceipt}`}>
                  <td className="px-4 py-3 font-black text-slate-800">{formatDateBR(row.date)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {getWeekdayShort(row.date)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {row.supplier || "--"}
                  </td>
                  <td className="px-4 py-3">
                    <ProductBadge product={row.product} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatLiters(row.plannedReceipt)}
                  </td>
                  <td className="px-4 py-3 font-black text-slate-800">
                    {formatPrice(row.dieselPrice)}
                  </td>
                  <td className="px-4 py-3">
                    <PriceVariation value={row.variationValue} pct={row.variationPct} />
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatPct(row.cbieGap)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatPrice(row.cbieValue)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-6 text-center text-sm font-semibold text-slate-400" colSpan={9}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticalProductSection({ product, data, onDownload }) {
  const last = data?.lastPurchases || [];
  const future = data?.futurePurchases || [];

  const lastPrice = last[0]?.dieselPrice ?? null;
  const futureLiters = future.reduce((sum, row) => sum + safeNumber(row.plannedReceipt, 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <ProductBadge product={product} />
          <div>
            <h3 className="text-lg font-black text-slate-800">Análise de compras {product}</h3>
            <p className="text-sm font-semibold text-slate-500">
              Últimas 7 compras e compras futuras projetadas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SummaryChip label="Último preço" value={formatPrice(lastPrice)} tone="blue" />
            <SummaryChip label="Litros futuros" value={formatLiters(futureLiters)} tone="amber" />
          </div>

          <button
            type="button"
            onClick={() => onDownload?.(product, data)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-700"
          >
            <FaChartLine />
            Baixar imagem
          </button>
        </div>
      </div>

      <AnalyticalTable
        title={`Últimas 7 compras - ${product}`}
        rows={last}
        emptyText={`Nenhuma compra realizada encontrada para ${product}.`}
      />

      <AnalyticalTable
        title={`Compras futuras projetadas - ${product}`}
        rows={future}
        emptyText={`Nenhuma compra futura projetada encontrada para ${product}.`}
      />
    </div>
  );
}

export default function EstoqueDieselPlanejamentoControle() {
  const { ano = "2026", mes = "01" } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const year = /^\d{4}$/.test(String(ano)) ? String(ano) : "2026";
  const month = MONTHS_2026.some((item) => item.month === mes) ? mes : "01";
  const productParam = searchParams.get("produto") || "S500";
  const product = productParam in PRODUCT_CONFIG ? productParam : "S500";

  const [activeView, setActiveView] = useState("programacao");
  const [metadata, setMetadata] = useState(null);
  const [paramStore, setParamStore] = useState(DEFAULT_PARAMS);
  const [measurements, setMeasurements] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [planningRows, setPlanningRows] = useState([]);
  const [analyticalRows, setAnalyticalRows] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getDefaultDateForMonth(year, month));
  const [form, setForm] = useState(() =>
    buildForm(getDefaultDateForMonth(year, month), product)
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [projectionModalOpen, setProjectionModalOpen] = useState(false);

  const [bulkProjection, setBulkProjection] = useState({
    startDate: getDefaultDateForMonth(year, month),
    endDate: getMonthLastDate(year, month),
    weekdayOutput: PROGRAMMING_RULES[product]?.defaultWeekdayOutput ?? 4200,
    saturdayOutput: PROGRAMMING_RULES[product]?.defaultSaturdayOutput ?? 2500,
    sundayOutput: PROGRAMMING_RULES[product]?.defaultSundayOutput ?? 1500,
    holidayOutput: PROGRAMMING_RULES[product]?.defaultHolidayOutput ?? 1500,
    holidayDatesText: "",
  });

  const monthRows = useMemo(
    () =>
      decorateReceiptHighlightRows(
        buildMonthRows({
          year,
          month,
          product,
          measurements,
          planningRows,
          receipts: receipts.filter(
            (receipt) => normalizeProductCode(receipt.product) === product
          ),
        }),
        receipts.filter((receipt) => normalizeProductCode(receipt.product) === product)
      ),
    [measurements, month, planningRows, product, receipts, year]
  );

  const selectedRow = useMemo(
    () => monthRows.find((row) => row.date === selectedDate) || monthRows[0] || null,
    [monthRows, selectedDate]
  );

  const suppliers = useMemo(
    () => normalizeSuppliers(metadata, paramStore, product),
    [metadata, paramStore, product]
  );

  const analyticalData = useMemo(
    () => buildAnalyticalRows(analyticalRows, receipts),
    [analyticalRows, receipts]
  );

  const summary = useMemo(() => {
    const lastRow =
      [...monthRows].reverse().find((row) => row.actualBalance || row.saldoProjetado) ||
      selectedRow;

    return {
      balance: Number(lastRow?.actualBalance ?? lastRow?.saldoProjetado ?? 0),
      totalActualOutput: monthRows.reduce((sum, row) => sum + Number(row.actualOutput || 0), 0),
      totalPlannedReceipt: monthRows.reduce(
        (sum, row) => sum + Number(row.plannedReceipt || 0),
        0
      ),
      totalPlannedOutput: monthRows.reduce(
        (sum, row) => sum + Number(row.plannedOutput || 0),
        0
      ),
    };
  }, [monthRows, selectedRow]);

  const computed = useMemo(() => {
    const saldoPlanejado = Number(selectedRow?.saldoPlanejado ?? 0);

    const plannedReceipt = selectedRow?.isRealized
      ? Number(selectedRow?.plannedReceipt ?? 0)
      : parseNumber(form.plannedReceipt) || 0;

    const plannedOutput = selectedRow?.isRealized
      ? Number(selectedRow?.plannedOutput ?? 0)
      : parseNumber(form.plannedOutput) || 0;

    const saldoPosEntrega = round(saldoPlanejado + plannedReceipt, 2) ?? saldoPlanejado;
    const saldoProjetado = round(saldoPosEntrega - plannedOutput, 2) ?? saldoPosEntrega;

    const dieselPrice = selectedRow?.isRealized
      ? parseNumber(selectedRow?.dieselPrice)
      : parseNumber(form.dieselPrice);

    const cbieGap = selectedRow?.isRealized
      ? parseNumber(selectedRow?.cbieGap)
      : parseNumber(form.cbieGap);

    const gapValue =
      dieselPrice !== null && cbieGap !== null
        ? round((cbieGap * dieselPrice) / 100, 4)
        : null;

    return {
      saldoPlanejado,
      plannedReceipt,
      saldoPosEntrega,
      plannedOutput,
      saldoProjetado,
      dieselPrice,
      cbieGap,
      gapValue,
      indicator: getIndicator(product, saldoPosEntrega),
    };
  }, [
    form.cbieGap,
    form.dieselPrice,
    form.plannedOutput,
    form.plannedReceipt,
    product,
    selectedRow,
  ]);

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setFeedback(null);

        const context = await fetchMeasurementContext();

        const [measurementData, receiptData, planningData, analyticalDataResponse] = await Promise.all([
          fetchMeasurementEntries({
            year,
            product,
            metadata: context.metadata,
            paramStore: context.paramStore,
            includePumps: false,
          }),
          fetchDieselReceipts({
            year,
            metadata: context.metadata,
          }),
          fetchPlanningRows({
            year,
            month,
            product,
            metadata: context.metadata,
          }),
          fetchPlanningRows({
            year,
            month,
            metadata: context.metadata,
            includeAllProducts: true,
          }),
        ]);

        if (!active) return;

        setMetadata(context.metadata);
        setParamStore(context.paramStore);
        setMeasurements(filterMeasurementWindow(measurementData, year, month, product));
        setReceipts(receiptData || []);
        setPlanningRows(planningData);
        setAnalyticalRows(analyticalDataResponse);
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

    setSelectedDate((current) =>
      current?.startsWith(`${year}-${month}`) ? current : nextDate
    );
  }, [month, year]);

  useEffect(() => {
    if (!selectedRow) return;

    setForm(buildForm(selectedRow.date, product, selectedRow));
  }, [product, selectedRow]);

  useEffect(() => {
    setBulkProjection((current) => ({
      ...current,
      startDate: getDefaultDateForMonth(year, month),
      endDate: getMonthLastDate(year, month),
      weekdayOutput: PROGRAMMING_RULES[product]?.defaultWeekdayOutput ?? 4200,
      saturdayOutput: PROGRAMMING_RULES[product]?.defaultSaturdayOutput ?? 2500,
      sundayOutput: PROGRAMMING_RULES[product]?.defaultSundayOutput ?? 1500,
      holidayOutput: PROGRAMMING_RULES[product]?.defaultHolidayOutput ?? 1500,
    }));
  }, [month, product, year]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBulkProjection(field, value) {
    setBulkProjection((current) => ({ ...current, [field]: value }));
  }

  function handleSelectRow(row) {
    setSelectedDate(row.date);
    setForm(buildForm(row.date, product, row));
    setFeedback(null);
    setEditModalOpen(true);
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

      const [freshPlanning, freshAnalytical] = await Promise.all([
        fetchPlanningRows({
          year,
          month,
          product,
          metadata,
        }),
        fetchPlanningRows({
          year,
          month,
          metadata,
          includeAllProducts: true,
        }),
      ]);

      setPlanningRows(freshPlanning);
      setAnalyticalRows(freshAnalytical);

      setFeedback({
        type: "success",
        message: `Programacao de ${new Date(`${form.date}T00:00:00`).toLocaleDateString(
          "pt-BR"
        )} salva com sucesso. Saldos seguintes recalculados automaticamente.`,
      });

      setEditModalOpen(false);
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

  async function handleApplyBulkProjection() {
    if (!metadata) return;

    const startDate = bulkProjection.startDate;
    const endDate = bulkProjection.endDate;

    if (!startDate || !endDate) {
      setFeedback({
        type: "error",
        message: "Informe a data inicial e final para aplicar a projeção.",
      });
      return;
    }

    if (startDate > endDate) {
      setFeedback({
        type: "error",
        message: "A data inicial não pode ser maior que a data final.",
      });
      return;
    }

    const holidayDates = normalizeDateList(bulkProjection.holidayDatesText);

    const rowsToSave = monthRows.filter((row) => {
      if (row.date < startDate || row.date > endDate) return false;
      return true;
    });

    if (!rowsToSave.length) {
      setFeedback({
        type: "error",
        message: "Nenhum dia encontrado no período informado para aplicar a projeção.",
      });
      return;
    }

    try {
      setSaving(true);

      for (const row of rowsToSave) {
        const dayType = classifyProjectionDay(row.date, holidayDates);

        const plannedOutputByType = {
          weekday: bulkProjection.weekdayOutput,
          saturday: bulkProjection.saturdayOutput,
          sunday: bulkProjection.sundayOutput,
          holiday: bulkProjection.holidayOutput,
        };

        const plannedOutput = parseNumber(plannedOutputByType[dayType]) || 0;

        const nextForm = {
          date: row.planningSourceDate,
          visualDate: row.date,
          supplier: row.supplier || "",
          dieselPrice: row.dieselPrice ?? "",
          cbieGap: row.cbieGap ?? "",
          plannedReceipt: row.plannedReceipt ?? "",
          plannedOutput,
          notes: row.notes || "",
        };

        await savePlanningRow({
          form: nextForm,
          product,
          metadata,
          userId: Number.isInteger(user?.usuario_id) ? user.usuario_id : null,
        });
      }

      const [freshPlanning, freshAnalytical] = await Promise.all([
        fetchPlanningRows({
          year,
          month,
          product,
          metadata,
        }),
        fetchPlanningRows({
          year,
          month,
          metadata,
          includeAllProducts: true,
        }),
      ]);

      setPlanningRows(freshPlanning);
      setAnalyticalRows(freshAnalytical);

      setFeedback({
        type: "success",
        message: `Projeção de saída aplicada em ${rowsToSave.length} dia(s). Saldos recalculados automaticamente em cascata.`,
      });

      setProjectionModalOpen(false);
    } catch (error) {
      console.error("Erro ao aplicar projeção em lote:", error);

      setFeedback({
        type: "error",
        message: error?.message || "Não foi possível aplicar a projeção em lote.",
      });
    } finally {
      setSaving(false);
    }
  }

  function renderProjectionModal() {
    if (!projectionModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-600 p-3 text-white">
                <FaBolt />
              </div>

              <div>
                <h2 className="text-xl font-black text-slate-800">
                  Atalho de projeção de saída
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Aplique a saída prevista para vários dias de uma vez, separando dia útil,
                  sábado, domingo e feriado.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setProjectionModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SimpleInput
              label="Data inicial"
              type="date"
              value={bulkProjection.startDate}
              onChange={(value) => updateBulkProjection("startDate", value)}
            />

            <SimpleInput
              label="Data final"
              type="date"
              value={bulkProjection.endDate}
              onChange={(value) => updateBulkProjection("endDate", value)}
            />

            <SimpleInput
              label="Saída dia útil"
              type="number"
              step="1"
              value={bulkProjection.weekdayOutput}
              onChange={(value) => updateBulkProjection("weekdayOutput", value)}
            />

            <SimpleInput
              label="Saída sábado"
              type="number"
              step="1"
              value={bulkProjection.saturdayOutput}
              onChange={(value) => updateBulkProjection("saturdayOutput", value)}
            />

            <SimpleInput
              label="Saída domingo"
              type="number"
              step="1"
              value={bulkProjection.sundayOutput}
              onChange={(value) => updateBulkProjection("sundayOutput", value)}
            />

            <SimpleInput
              label="Saída feriado"
              type="number"
              step="1"
              value={bulkProjection.holidayOutput}
              onChange={(value) => updateBulkProjection("holidayOutput", value)}
            />

            <div className="md:col-span-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                  Datas de feriado
                </span>

                <textarea
                  rows={4}
                  value={bulkProjection.holidayDatesText}
                  onChange={(event) =>
                    updateBulkProjection("holidayDatesText", event.target.value)
                  }
                  className="mt-2 w-full rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ex.: 2026-01-01, 2026-02-17 ou uma data por linha"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
            A projeção será aplicada nos dias selecionados, salvando automaticamente no D+1 e recalculando os saldos em cascata.
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

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setProjectionModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApplyBulkProjection}
              disabled={saving || loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600 disabled:opacity-60"
            >
              <FaBolt />
              {saving ? "Aplicando..." : "Aplicar projeção"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderEditModal() {
    if (!editModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800">
                Editar programação do dia
              </h2>

              <p className="mt-1 text-sm font-semibold text-slate-500">
                Dia selecionado:{" "}
                <strong>
                  {form.visualDate
                    ? new Date(`${form.visualDate}T00:00:00`).toLocaleDateString("pt-BR")
                    : "--"}
                </strong>
                {" "} | Data salva no sistema:{" "}
                <strong>
                  {form.date
                    ? new Date(`${form.date}T00:00:00`).toLocaleDateString("pt-BR")
                    : "--"}
                </strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            <SimpleInput
              label="Dia exibido"
              type="date"
              value={form.visualDate || selectedDate}
              onChange={() => {}}
              disabled
            />

            <SimpleInput
              label="Data salva no sistema"
              type="date"
              value={form.date}
              onChange={(value) => updateField("date", value)}
            />

            <SimpleInput
              label="Dia"
              value={getWeekdayShort(form.visualDate || selectedDate)}
              onChange={() => {}}
              disabled
            />

            <SimpleSelect
              label="Fornecedor"
              value={form.supplier}
              options={suppliers}
              onChange={(value) => updateField("supplier", value)}
            />

            <SimpleInput
              label="Preço Diesel"
              type="number"
              step="0.0001"
              value={form.dieselPrice}
              onChange={(value) => updateField("dieselPrice", value)}
            />

            <SimpleInput
              label="Defasagem (CBIE)"
              type="number"
              step="0.01"
              value={form.cbieGap}
              onChange={(value) => updateField("cbieGap", value)}
            />

            <SimpleInput
              label="Programação de Entrega"
              type="number"
              step="1"
              value={form.plannedReceipt}
              onChange={(value) => updateField("plannedReceipt", value)}
            />

            <SimpleInput
              label="Saída Programada"
              type="number"
              step="1"
              value={form.plannedOutput}
              onChange={(value) => updateField("plannedOutput", value)}
            />
          </div>

          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Observação
            </span>

            <textarea
              rows={4}
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              placeholder="Ex.: entrega confirmada, consumo acima do padrão, reforço de operação."
            />
          </label>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
            <SummaryChip
              label="Saldo Planejado"
              value={formatLiters(computed.saldoPlanejado)}
              tone="slate"
            />
            <SummaryChip
              label="Saldo Pós Entrega"
              value={formatLiters(computed.saldoPosEntrega)}
              tone="blue"
            />
            <SummaryChip
              label="Saldo Projetado"
              value={formatLiters(computed.saldoProjetado)}
              tone={computed.indicator.tone}
            />
            <SummaryChip
              label="Defasagem R$"
              value={formatMoney(computed.gapValue)}
              tone="amber"
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

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

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
        </div>
      </div>
    );
  }

  function renderAnalyticalView() {
    return (
      <div className="space-y-5">
        <EstoqueDieselPanel className="border-2 border-rose-200 bg-rose-50/40 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-black text-rose-700">
                <FaChartLine />
                Programação Analítica
              </h2>
              <p className="mt-1 text-sm font-semibold text-rose-700/80">
                Últimas compras e compras futuras projetadas separadas por S500 e S10.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveView("programacao")}
              className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50"
            >
              Voltar para programação
            </button>
          </div>
        </EstoqueDieselPanel>

        <AnalyticalProductSection product="S500" data={analyticalData.S500} onDownload={downloadAnalyticalImage} />
        <AnalyticalProductSection product="S10" data={analyticalData.S10} onDownload={downloadAnalyticalImage} />
      </div>
    );
  }

  return (
    <EstoqueDieselPageShell
      title="Programacao de Diesel"
      description={`Visao mensal de suprimentos para ${
        PRODUCT_CONFIG[product].label
      } em ${getMonthLabel(month)} de ${year}.`}
    >
      <EstoqueDieselPanel className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-800">
              Leitura mensal da programação
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Dias realizados usam dados reais da medição em D+1. Dias futuros usam a projeção programada em D+1.
            </p>
          </div>

          <div className="space-y-3">
            <MonthSelector activeMonth={month} product={product} />
            <ProductSwitcher activeProduct={product} month={month} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView("programacao")}
            className={`rounded-xl px-4 py-3 text-sm font-black transition ${
              activeView === "programacao"
                ? "bg-slate-800 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Programação Mensal
          </button>

          <button
            type="button"
            onClick={() => setActiveView("analitica")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              activeView === "analitica"
                ? "bg-rose-700 text-white"
                : "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            <FaChartLine />
            Programação Analítica
          </button>
        </div>

        {activeView === "programacao" ? (
          <>
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SummaryChip label="Produto" value={product} tone="blue" />
          <SummaryChip label="Saldo Atual" value={formatLiters(summary.balance)} tone="emerald" />
          <SummaryChip
            label="Saída Realizada"
            value={formatLiters(summary.totalActualOutput)}
            tone="slate"
          />
          <SummaryChip
            label="Entrega Prevista"
            value={formatLiters(summary.totalPlannedReceipt)}
            tone="blue"
          />
          <SummaryChip
            label="Saída Prevista"
            value={formatLiters(summary.totalPlannedOutput)}
            tone="amber"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-600 p-3 text-white">
              <FaBolt />
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-blue-800">
                Projeção de saída
              </h3>
              <p className="mt-1 text-sm font-semibold text-blue-700">
                Abra o atalho para programar vários dias de uma vez.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              setProjectionModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white transition hover:bg-blue-600"
          >
            <FaBolt />
            Abrir projeção
          </button>
        </div>
          </>
        ) : null}

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
      </EstoqueDieselPanel>

      {activeView === "analitica" ? (
        renderAnalyticalView()
      ) : (
      <div className="grid grid-cols-1 gap-4">
        <EstoqueDieselPanel className="p-5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800">Programação do mês</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Indicador calculado pelo Saldo Pós Entrega. Para dias realizados, dados reais são buscados do dia seguinte.
              </p>
              <p className="mt-2 text-xs font-black uppercase tracking-wider text-slate-400">
                Linha verde: recebimento ja confirmado. Linha amarela: entrega programada para chegar.
              </p>
            </div>

            <div
              className={`rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-wider ${
                getIndicator(product, summary.balance).tone === "emerald"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : getIndicator(product, summary.balance).tone === "amber"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {getIndicator(product, summary.balance).label}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-wider text-slate-500">
                <tr className="text-[11px] text-slate-700">
                  {[
                    { label: "Identificação", span: 2, className: "rounded-l-2xl border-slate-200 bg-slate-100" },
                    { label: "Saldo Projetado", span: 1, className: "border-sky-200 bg-sky-50 text-sky-700" },
                    { label: "Compra de Diesel", span: 2, className: "border-blue-200 bg-blue-50 text-blue-700" },
                    { label: "Recebimento", span: 2, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                    { label: "Saída", span: 2, className: "border-amber-200 bg-amber-50 text-amber-700" },
                    { label: "Saldo Final", span: 1, className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
                    { label: "Indicador", span: 1, className: "rounded-r-2xl border-slate-200 bg-slate-100 text-slate-700" },
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
                    { label: "Dia", className: "bg-slate-50 border-r border-slate-200" },
                    { label: "Saldo Projetado", className: "bg-sky-50/70 border-r border-sky-200 text-sky-800" },
                    { label: "Fornecedor", className: "bg-blue-50/70 text-blue-800" },
                    { label: "Preço Diesel", className: "bg-blue-50/70 border-r border-blue-200 text-blue-800" },
                    { label: "Recebimento", className: "bg-emerald-50/70 text-emerald-800" },
                    { label: "Saldo Pós Entrega", className: "bg-emerald-50/70 border-r border-emerald-200 text-emerald-800" },
                    { label: "Saída Prevista", className: "bg-amber-50/70 text-amber-800" },
                    { label: "Saída Real", className: "bg-amber-50/70 border-r border-amber-200 text-amber-800" },
                    { label: "Saldo Final Projetado", className: "bg-cyan-50/70 border-r border-cyan-200 text-cyan-800" },
                    { label: "Indicador", className: "bg-slate-50" },
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
                {monthRows.map((row) => {
                  const isActive = row.date === selectedDate;
                  const rowClasses = getReceiptRowClasses(row.receiptStatus, isActive);
                  const emphasizedCellClass = row.receiptStatus
                    ? "font-black text-slate-900"
                    : "font-semibold text-slate-600";

                  return (
                    <tr
                      key={row.date}
                      onClick={() => handleSelectRow(row)}
                      className={`cursor-pointer transition ${rowClasses}`}
                    >
                      <td className="px-4 py-3 font-black text-slate-800">
                        {formatDateBR(row.date)}
                      </td>
                      <td className={`border-r border-slate-200 px-4 py-3 ${emphasizedCellClass}`}>
                        {row.weekday}
                      </td>
                      <td className={`border-r border-sky-100 px-4 py-3 ${emphasizedCellClass}`}>
                        {formatLiters(row.saldoPlanejado)}
                      </td>
                      <td className={`px-4 py-3 ${emphasizedCellClass}`}>
                        <div>{row.displaySupplier || row.supplier || "--"}</div>
                        {row.receiptStatus ? (
                          <div
                            className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                              row.receiptStatus === "received"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {row.receiptNoticeLabel}
                          </div>
                        ) : null}
                      </td>
                      <td className={`border-r border-blue-100 px-4 py-3 ${emphasizedCellClass}`}>
                        {formatMoney(row.displayDieselPrice ?? row.dieselPrice)}
                      </td>
                      <td className={`px-4 py-3 ${emphasizedCellClass}`}>
                        <div>{getReceiptValueText(row)}</div>
                        {row.receiptForwardedToDate ? (
                          <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Recebido em {formatDateBR(row.receiptForwardedToDate)}
                          </div>
                        ) : null}
                      </td>
                      <td className={`border-r border-emerald-100 px-4 py-3 ${emphasizedCellClass}`}>
                        {formatLiters(row.saldoPosEntrega)}
                      </td>
                      <td className={`px-4 py-3 ${emphasizedCellClass}`}>
                        {formatLiters(row.plannedOutput)}
                      </td>
                      <td className={`border-r border-amber-100 px-4 py-3 ${emphasizedCellClass}`}>
                        {formatLiters(row.actualOutput)}
                      </td>
                      <td className="border-r border-cyan-100 px-4 py-3 font-black text-slate-800">
                        {formatLiters(row.saldoProjetado)}
                      </td>
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
      </div>

      )}

      {renderProjectionModal()}
      {renderEditModal()}

      {loading ? (
        <EstoqueDieselPanel className="p-5">
          <p className="text-sm font-semibold text-slate-500">
            Carregando programação de diesel...
          </p>
        </EstoqueDieselPanel>
      ) : null}
    </EstoqueDieselPageShell>
  );
}
