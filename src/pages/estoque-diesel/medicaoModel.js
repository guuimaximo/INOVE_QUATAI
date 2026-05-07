export const STORAGE_KEYS = {
  entries: "inove.estoqueDiesel.entries.v1",
  params: "inove.estoqueDiesel.params.v1",
};

export const MONTHS_2026 = [
  { month: "01", label: "Janeiro" },
  { month: "02", label: "Fevereiro" },
  { month: "03", label: "Marco" },
  { month: "04", label: "Abril" },
  { month: "05", label: "Maio" },
  { month: "06", label: "Junho" },
  { month: "07", label: "Julho" },
  { month: "08", label: "Agosto" },
  { month: "09", label: "Setembro" },
  { month: "10", label: "Outubro" },
  { month: "11", label: "Novembro" },
  { month: "12", label: "Dezembro" },
];

export const PRODUCT_CONFIG = {
  S500: {
    code: "S500",
    label: "Diesel S500",
    pumps: 3,
    usesTransnet: true,
    monthSheetPattern: "Medição Combustível S500",
  },
  S10: {
    code: "S10",
    label: "Diesel S10",
    pumps: 1,
    usesTransnet: true,
    monthSheetPattern: "Medição Combustível S10",
  },
};

export const DEFAULT_PARAMS = {
  S500: {
    diameterM: 2.549,
    lengthM: 6.13,
    maxRuleCm: 254.9,
    nfDiffWarnPct: 0.01,
    nfDiffCriticalPct: 0.03,
    transnetWarnPct: 0.02,
    transnetCriticalPct: 0.03,
    lowStockAlertLiters: 0,
    suppliers: ["Raizen", "BR Distribuidora", "Ipiranga"],
    toleranceRows: [
      { nfVolume: 5000, variationPct: 0.0105, acceptableDiffLiters: 4.947 },
      { nfVolume: 10000, variationPct: 0.0105, acceptableDiffLiters: 9.895 },
      { nfVolume: 15000, variationPct: 0.0105, acceptableDiffLiters: 14.842 },
      { nfVolume: 20000, variationPct: 0.0105, acceptableDiffLiters: 19.79 },
      { nfVolume: 25000, variationPct: 0.0105, acceptableDiffLiters: 24.737 },
      { nfVolume: 30000, variationPct: 0.0105, acceptableDiffLiters: 29.685 },
      { nfVolume: 35000, variationPct: 0.0105, acceptableDiffLiters: 34.632 },
    ],
  },
  S10: {
    diameterM: 2.549,
    lengthM: 6.13,
    maxRuleCm: 254.9,
    nfDiffWarnPct: 0.01,
    nfDiffCriticalPct: 0.03,
    transnetWarnPct: 0.02,
    transnetCriticalPct: 0.03,
    lowStockAlertLiters: 0,
    suppliers: ["Raizen", "BR Distribuidora", "Ipiranga"],
    toleranceRows: [
      { nfVolume: 5000, variationPct: 0.0105, acceptableDiffLiters: 4.947 },
      { nfVolume: 10000, variationPct: 0.0105, acceptableDiffLiters: 9.895 },
      { nfVolume: 15000, variationPct: 0.0105, acceptableDiffLiters: 14.842 },
      { nfVolume: 20000, variationPct: 0.0105, acceptableDiffLiters: 19.79 },
      { nfVolume: 25000, variationPct: 0.0105, acceptableDiffLiters: 24.737 },
      { nfVolume: 30000, variationPct: 0.0105, acceptableDiffLiters: 29.685 },
      { nfVolume: 35000, variationPct: 0.0105, acceptableDiffLiters: 34.632 },
    ],
  },
};

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

export function getDefaultDateForMonth(year, month) {
  return `${year}-${month}-01`;
}

export function getMonthLabel(month) {
  return MONTHS_2026.find((item) => item.month === month)?.label || month;
}

export function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.entries) || "[]");
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
}

export function loadParams() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.params) || "null");
    return parsed || DEFAULT_PARAMS;
  } catch {
    return DEFAULT_PARAMS;
  }
}

export function saveParams(params) {
  localStorage.setItem(STORAGE_KEYS.params, JSON.stringify(params));
}

export function calculateVolumeLiters(ruleCm, radiusM, lengthM) {
  const regua = parseNumber(ruleCm);
  const raio = parseNumber(radiusM);
  const comprimento = parseNumber(lengthM);
  if (!regua || !raio || !comprimento) return null;

  const h = regua / 100;
  const r = raio;
  const l = comprimento;

  if (h <= 0 || r <= 0 || l <= 0) return null;
  if (h > 2 * r) return null;

  const volume =
    (r * r * Math.acos(1 - h / r) - Math.sqrt(Math.max(0, 2 * r * h - h * h)) * (r - h)) *
    1000 *
    l;

  return round(volume, 0);
}

export function getPreviousEntry(entries, product, currentDate, currentId = null) {
  const current = new Date(currentDate);
  return [...entries]
    .filter((entry) => entry.product === product && entry.date && entry.id !== currentId)
    .filter((entry) => new Date(entry.date) < current)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || null;
}

export function buildDefaultForm(product, year, month) {
  const pumps = Array.from({ length: PRODUCT_CONFIG[product].pumps }, (_, index) => ({
    number: index + 1,
    initial: "",
    final: "",
  }));

  return {
    id: null,
    product,
    date: getDefaultDateForMonth(year, month),
    reguaAnteriorT1: "",
    reguaAnteriorT2: "",
    reguaFinalT1: "",
    reguaFinalT2: "",
    nfVolumeLitros: "",
    supplier: "",
    nfNumero: "",
    transnetOutput: "",
    observation: "",
    pumps,
  };
}

export function computeMeasurement(form, params, previousEntry) {
  const radius = parseNumber(params.diameterM) ? parseNumber(params.diameterM) / 2 : parseNumber(params.radiusM);
  const length = parseNumber(params.lengthM);

  const litrosAnteriorT1 = calculateVolumeLiters(form.reguaAnteriorT1, radius, length);
  const litrosAnteriorT2 = calculateVolumeLiters(form.reguaAnteriorT2, radius, length);
  const litrosFinalT1 = calculateVolumeLiters(form.reguaFinalT1, radius, length);
  const litrosFinalT2 = calculateVolumeLiters(form.reguaFinalT2, radius, length);

  const saldoAnterior = round((litrosAnteriorT1 || 0) + (litrosAnteriorT2 || 0), 2);
  const saldoFinal = round((litrosFinalT1 || 0) + (litrosFinalT2 || 0), 2);
  const nfVolumeLitros = parseNumber(form.nfVolumeLitros) || 0;
  const entradaDiesel = round(saldoFinal - saldoAnterior, 2);
  const medicaoD1 = previousEntry?.saldoFinal ?? saldoAnterior;
  const medicaoAtual = saldoFinal;
  const saidaTanque = medicaoAtual !== null ? round((medicaoD1 || 0) + nfVolumeLitros - medicaoAtual, 2) : null;

  const pumpDetails = form.pumps.map((pump) => {
    const initial = parseNumber(pump.initial) || 0;
    const final = parseNumber(pump.final) || 0;
    return {
      ...pump,
      initial,
      final,
      output: round(final - initial, 2),
    };
  });

  const saidaTotalBombas = round(
    pumpDetails.reduce((sum, pump) => sum + (pump.output || 0), 0),
    2
  );
  const saidaTransnet = parseNumber(form.transnetOutput) || 0;
  const diffRecebimento = round(entradaDiesel - nfVolumeLitros, 2);
  const pctDiffNF =
    nfVolumeLitros > 0 ? round((entradaDiesel - nfVolumeLitros) / nfVolumeLitros, 4) : null;
  const pctDiffTransnet =
    saidaTanque && saidaTanque !== 0
      ? round((saidaTransnet - saidaTanque) / saidaTanque, 4)
      : null;

  return {
    litrosAnteriorT1,
    litrosAnteriorT2,
    litrosFinalT1,
    litrosFinalT2,
    saldoAnterior,
    saldoFinal,
    entradaDiesel,
    medicaoD1,
    medicaoAtual,
    saidaTanque,
    pumpDetails,
    saidaTotalBombas,
    saidaTransnet,
    diffRecebimento,
    pctDiffNF,
    pctDiffTransnet,
  };
}

export function validateMeasurement(form, computed, params) {
  const errors = {};
  const warnings = [];

  if (parseNumber(form.reguaFinalT1) === null && parseNumber(form.reguaFinalT2) === null) {
    errors.reguaFinal = "Informe ao menos uma regua final.";
  }

  form.pumps.forEach((pump, index) => {
    const initial = parseNumber(pump.initial);
    const final = parseNumber(pump.final);
    if (initial !== null && final !== null && final < initial) {
      errors[`pump_${index + 1}`] = `Bomba ${index + 1}: hodometro final nao pode ser menor que o inicial.`;
    }
  });

  ["reguaAnteriorT1", "reguaAnteriorT2", "reguaFinalT1", "reguaFinalT2"].forEach((field) => {
    const value = parseNumber(form[field]);
    if (value !== null && params.maxRuleCm && value > params.maxRuleCm) {
      warnings.push(`${field} acima do limite fisico do tanque.`);
    }
  });

  if (computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffWarnPct || 0.01)) {
    warnings.push("Diferenca NF x recebido acima da faixa de atencao.");
  }

  if (
    computed.pctDiffTransnet !== null &&
    Math.abs(computed.pctDiffTransnet) > (params.transnetWarnPct || 0.02)
  ) {
    warnings.push("Diferenca tanque x Transnet acima da faixa de atencao.");
  }

  if ((computed.saldoFinal || 0) < 0) {
    warnings.push("Saldo final negativo. Revise as medicoes.");
  }

  return { errors, warnings };
}

export function measurementStatus(computed, params) {
  const nfCritical = computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffCriticalPct || 0.03);
  const transnetCritical =
    computed.pctDiffTransnet !== null &&
    Math.abs(computed.pctDiffTransnet) > (params.transnetCriticalPct || 0.03);
  const nfWarn = computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffWarnPct || 0.01);
  const transnetWarn =
    computed.pctDiffTransnet !== null &&
    Math.abs(computed.pctDiffTransnet) > (params.transnetWarnPct || 0.02);

  if (nfCritical || transnetCritical) {
    return { tone: "rose", label: "Critico" };
  }
  if (nfWarn || transnetWarn) {
    return { tone: "amber", label: "Atencao" };
  }
  return { tone: "emerald", label: "OK" };
}

export function serializeEntry(form, computed, params) {
  return {
    id: form.id || `${form.product}-${form.date}-${Date.now()}`,
    product: form.product,
    date: form.date,
    supplier: form.supplier,
    nfNumero: form.nfNumero,
    nfVolumeLitros: parseNumber(form.nfVolumeLitros) || 0,
    observation: form.observation,
    reguaAnteriorT1: parseNumber(form.reguaAnteriorT1),
    reguaAnteriorT2: parseNumber(form.reguaAnteriorT2),
    reguaFinalT1: parseNumber(form.reguaFinalT1),
    reguaFinalT2: parseNumber(form.reguaFinalT2),
    transnetOutput: parseNumber(form.transnetOutput) || 0,
    pumps: computed.pumpDetails,
    status: measurementStatus(computed, params).label,
    ...computed,
    createdAt: new Date().toISOString(),
  };
}
