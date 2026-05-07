import { supabase } from "../../supabase";

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
    requiredPumpNumbers: [2, 3],
    pumps: 2,
    usesTransnet: true,
    monthSheetPattern: "Medicao Combustivel S500",
  },
  S10: {
    code: "S10",
    label: "Diesel S10",
    requiredPumpNumbers: [1],
    pumps: 1,
    usesTransnet: true,
    monthSheetPattern: "Medicao Combustivel S10",
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
    suppliers: ["Ale", "Combustran", "Ipiranga", "Raizen", "Vibra"],
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
    suppliers: ["Ale", "Combustran", "Ipiranga", "Raizen", "Vibra"],
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

export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const normalized = String(value)
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

export function getTodayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export const todayISO = getTodayISO;

export function getYearFromDate(dateValue) {
  if (!dateValue) return String(new Date().getFullYear());

  const value = String(dateValue);

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 4);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return String(new Date().getFullYear());
  }

  return String(parsed.getFullYear());
}

export function getDefaultDateForMonth(year, month) {
  const today = getTodayISO();
  if (today.startsWith(`${year}-${month}`)) return today;
  return `${year}-${month}-01`;
}

export function getMonthLabel(month) {
  return MONTHS_2026.find((item) => item.month === month)?.label || month;
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
}

function normalizeToleranceRows(rows = []) {
  return rows
    .map((row) => ({
      nfVolume: parseNumber(row.nfVolume) || 0,
      variationPct: parseNumber(row.variationPct) || 0,
      acceptableDiffLiters: parseNumber(row.acceptableDiffLiters) || 0,
    }))
    .sort((a, b) => a.nfVolume - b.nfVolume);
}

export function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.entries) || "[]");
  } catch {
    return [];
  }
}

export function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries || []));
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
  localStorage.setItem(STORAGE_KEYS.params, JSON.stringify(params || DEFAULT_PARAMS));
}

export function calculateVolumeLiters(ruleCm, radiusM, lengthM) {
  const regua = parseNumber(ruleCm);
  const raio = parseNumber(radiusM);
  const comprimento = parseNumber(lengthM);

  if (regua === null || raio === null || comprimento === null) return null;

  const h = regua / 100;
  const r = raio;
  const l = comprimento;

  if (h <= 0 || r <= 0 || l <= 0) return 0;
  if (h > 2 * r) return null;

  const volume =
    (r * r * Math.acos(1 - h / r) -
      Math.sqrt(Math.max(0, 2 * r * h - h * h)) * (r - h)) *
    1000 *
    l;

  return round(volume, 0);
}

function getRadiusFromParams(params) {
  const diameter = parseNumber(params?.diameterM);
  if (diameter) return diameter / 2;

  const radius = parseNumber(params?.radiusM);
  if (radius) return radius;

  return DEFAULT_PARAMS.S500.diameterM / 2;
}

export function getRequiredPumpNumbers(product) {
  return PRODUCT_CONFIG[product]?.requiredPumpNumbers || [];
}

function getTankByProduct(metadata, product) {
  return metadata?.tanksByProduct?.[product] || null;
}

function getProductByTankId(metadata, tankId) {
  const tank = metadata?.tanksById?.[tankId];
  return tank?.tipo_diesel || "S500";
}

function buildStatusLabel(entryLike, params) {
  if (entryLike?.status && ["OK", "Atencao", "Critico", "IMPORTADO_PLANILHA"].includes(entryLike.status)) {
    return entryLike.status;
  }

  return measurementStatus(entryLike, params).label;
}

function mapMeasurementRowToEntry(row, metadata, paramStore, pumpRows = []) {
  const product = getProductByTankId(metadata, row.tanque_id);
  const params = paramStore?.[product] || DEFAULT_PARAMS[product];

  const sortedPumps = pumpRows
    .map((pump) => ({
      id: pump.bomba_id,
      number: metadata?.pumpsById?.[pump.bomba_id]?.numero || 0,
      initial: pump.hodometro_inicial ?? 0,
      final: pump.hodometro_final ?? 0,
      output:
        pump.saida_bomba ??
        round((Number(pump.hodometro_final || 0) || 0) - (Number(pump.hodometro_inicial || 0) || 0), 2),
    }))
    .sort((a, b) => a.number - b.number);

  const entry = {
    id: row.id,
    product,
    date: row.data_medicao,

    supplier: metadata?.suppliersById?.[row.fornecedor_id]?.nome || "",
    supplierId: row.fornecedor_id ?? null,
    nfNumero: row.nf_numero || "",
    nfVolumeLitros: row.nf_volume_litros ?? 0,

    observation: row.observacao || "",

    reguaAnteriorT1: row.regua_anterior_t1,
    reguaAnteriorT2: row.regua_anterior_t2,
    reguaFinalT1: row.regua_final_t1,
    reguaFinalT2: row.regua_final_t2,

    litrosAnteriorT1: row.litros_anterior_t1,
    litrosAnteriorT2: row.litros_anterior_t2,
    litrosFinalT1: row.litros_final_t1,
    litrosFinalT2: row.litros_final_t2,

    saldoAnterior: row.saldo_anterior,
    saldoFinal: row.saldo_final,

    entradaDiesel: row.entrada_diesel,
    medicaoD1: row.medicao_d1,
    medicaoAtual: row.medicao_atual,
    saidaTanque: row.saida_tanque,

    transnetOutput: row.saida_transnet ?? 0,
    saidaTransnet: row.saida_transnet ?? 0,

    diffRecebimento: row.diff_recebimento,
    pctDiffNF: row.pct_diff_nf,
    pctDiffTransnet: row.pct_diff_transnet,

    saidaTotalBombas: row.saida_total_bombas,
    pumps: sortedPumps,

    status: row.status_lancamento,
    createdAt: row.criado_em,
  };

  entry.status = buildStatusLabel(entry, params);
  return entry;
}

function mapReceiptRow(row, metadata) {
  const product = row.tipo_diesel || getProductByTankId(metadata, row.tanque_id);

  return {
    id: row.id,
    product,
    tipoDiesel: product,
    tanqueId: row.tanque_id,
    date: row.data_recebimento,
    dataRecebimento: row.data_recebimento,

    supplierId: row.fornecedor_id,
    supplier:
      row.fornecedor_nome ||
      metadata?.suppliersById?.[row.fornecedor_id]?.nome ||
      "",

    nfNumero: row.nf_numero || "",
    nfVolumeLitros: row.nf_volume_litros ?? 0,

    reguaAntesCm: row.regua_antes_cm,
    reguaDepoisCm: row.regua_depois_cm,

    litrosAntes: row.litros_antes,
    litrosDepois: row.litros_depois,
    volumeRecebidoLitros: row.volume_recebido_litros,
    diffRecebimentoLitros: row.diff_recebimento_litros,
    pctDiffRecebimento: row.pct_diff_recebimento,

    status: row.status_recebimento || "OK",
    fotoAntesUrl: row.foto_antes_url,
    fotoDepoisUrl: row.foto_depois_url,

    observation: row.observacao || "",
    createdAt: row.criado_em,
  };
}

export async function fetchMeasurementContext() {
  const [tanksResponse, paramsResponse, tolerancesResponse, suppliersResponse, pumpsResponse] =
    await Promise.all([
      supabase
        .from("estoque_diesel_tanques")
        .select("id, nome, tipo_diesel, diametro_m, raio_m, comprimento_m, capacidade_max_litros")
        .eq("ativo", true),

      supabase
        .from("estoque_diesel_parametros")
        .select(
          "tanque_id, regua_max_cm, pct_diff_nf_alerta, pct_diff_nf_critico, pct_diff_transnet_alerta, pct_diff_transnet_critico"
        )
        .eq("ativo", true),

      supabase
        .from("estoque_diesel_tolerancias_nf")
        .select("tipo_diesel, volume_nf, pct_variacao_aceitavel, diff_volume_aceitavel")
        .eq("ativo", true)
        .order("tipo_diesel")
        .order("volume_nf"),

      supabase
        .from("estoque_diesel_fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),

      supabase
        .from("estoque_diesel_bombas")
        .select("id, tanque_id, numero, descricao")
        .eq("ativo", true)
        .order("numero"),
    ]);

  for (const response of [
    tanksResponse,
    paramsResponse,
    tolerancesResponse,
    suppliersResponse,
    pumpsResponse,
  ]) {
    if (response.error) throw response.error;
  }

  const paramStore = cloneDefaults();

  const metadata = {
    tanksByProduct: {},
    tanksById: {},
    pumpsByProduct: {},
    pumpsById: {},
    suppliersById: {},
  };

  const paramsByTankId = Object.fromEntries(
    (paramsResponse.data || []).map((row) => [row.tanque_id, row])
  );

  for (const supplier of suppliersResponse.data || []) {
    metadata.suppliersById[supplier.id] = supplier;
  }

  for (const tank of tanksResponse.data || []) {
    const product = tank.tipo_diesel || "S500";

    metadata.tanksByProduct[product] = tank;
    metadata.tanksById[tank.id] = tank;

    const currentDefault = paramStore[product] || DEFAULT_PARAMS[product] || DEFAULT_PARAMS.S500;

    const productParams = {
      ...currentDefault,
      diameterM: Number(tank.diametro_m || currentDefault.diameterM),
      lengthM: Number(tank.comprimento_m || currentDefault.lengthM),
      radiusM: Number(tank.raio_m || currentDefault.diameterM / 2),
    };

    const dbParam = paramsByTankId[tank.id];

    if (dbParam) {
      productParams.maxRuleCm = Number(dbParam.regua_max_cm ?? productParams.maxRuleCm);
      productParams.nfDiffWarnPct = Number(
        dbParam.pct_diff_nf_alerta ?? productParams.nfDiffWarnPct
      );
      productParams.nfDiffCriticalPct = Number(
        dbParam.pct_diff_nf_critico ?? productParams.nfDiffCriticalPct
      );
      productParams.transnetWarnPct = Number(
        dbParam.pct_diff_transnet_alerta ?? productParams.transnetWarnPct
      );
      productParams.transnetCriticalPct = Number(
        dbParam.pct_diff_transnet_critico ?? productParams.transnetCriticalPct
      );
    }

    paramStore[product] = productParams;
  }

  const suppliers = (suppliersResponse.data || []).map((supplier) => supplier.nome);

  Object.keys(paramStore).forEach((product) => {
    paramStore[product].suppliers = suppliers;
  });

  const toleranceRowsByProduct = {};

  for (const row of tolerancesResponse.data || []) {
    const product = row.tipo_diesel || "S500";

    if (!toleranceRowsByProduct[product]) {
      toleranceRowsByProduct[product] = [];
    }

    toleranceRowsByProduct[product].push({
      nfVolume: Number(row.volume_nf || 0),
      variationPct: Number(row.pct_variacao_aceitavel || 0),
      acceptableDiffLiters: Number(row.diff_volume_aceitavel || 0),
    });
  }

  Object.keys(toleranceRowsByProduct).forEach((product) => {
    paramStore[product].toleranceRows = toleranceRowsByProduct[product];
  });

  for (const pump of pumpsResponse.data || []) {
    metadata.pumpsById[pump.id] = pump;

    const tank = metadata.tanksById[pump.tanque_id];
    if (!tank) continue;

    const product = tank.tipo_diesel || "S500";

    if (!metadata.pumpsByProduct[product]) {
      metadata.pumpsByProduct[product] = [];
    }

    metadata.pumpsByProduct[product].push(pump);
  }

  Object.keys(metadata.pumpsByProduct).forEach((product) => {
    metadata.pumpsByProduct[product].sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
  });

  return { metadata, paramStore };
}

export async function fetchMeasurementEntries({
  year = "2026",
  product = null,
  metadata,
  paramStore = DEFAULT_PARAMS,
  includePumps = false,
}) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  let query = supabase
    .from("estoque_diesel_medicoes_diarias")
    .select(
      `
      id,
      tanque_id,
      data_medicao,
      regua_anterior_t1,
      regua_anterior_t2,
      regua_final_t1,
      regua_final_t2,
      nf_volume_litros,
      fornecedor_id,
      nf_numero,
      saida_transnet,
      litros_anterior_t1,
      litros_anterior_t2,
      litros_final_t1,
      litros_final_t2,
      saldo_anterior,
      saldo_final,
      entrada_diesel,
      medicao_d1,
      medicao_atual,
      saida_tanque,
      diff_recebimento,
      pct_diff_nf,
      pct_diff_transnet,
      saida_total_bombas,
      status_lancamento,
      observacao,
      criado_em
      `
    )
    .gte("data_medicao", from)
    .lte("data_medicao", to)
    .order("data_medicao", { ascending: true });

  if (product) {
    const tank = getTankByProduct(metadata, product);

    if (!tank?.id) {
      return [];
    }

    query = query.eq("tanque_id", tank.id);
  }

  const { data: rows, error } = await query;

  if (error) throw error;

  let pumpRowsByMeasurement = {};

  if (includePumps && rows?.length) {
    const { data: pumpRows, error: pumpsError } = await supabase
      .from("estoque_diesel_leituras_bomba")
      .select("medicao_id, bomba_id, hodometro_inicial, hodometro_final, saida_bomba")
      .in(
        "medicao_id",
        rows.map((row) => row.id)
      );

    if (pumpsError) throw pumpsError;

    pumpRowsByMeasurement = (pumpRows || []).reduce((acc, row) => {
      if (!acc[row.medicao_id]) {
        acc[row.medicao_id] = [];
      }

      acc[row.medicao_id].push(row);
      return acc;
    }, {});
  }

  return (rows || []).map((row) =>
    mapMeasurementRowToEntry(row, metadata, paramStore, pumpRowsByMeasurement[row.id] || [])
  );
}

export async function fetchDieselReceipts({
  year = "2026",
  product = null,
  metadata,
  fromDate = null,
  toDate = null,
}) {
  const from = fromDate || `${year}-01-01`;
  const to = toDate || `${year}-12-31`;

  let query = supabase
    .from("estoque_diesel_recebimentos")
    .select(
      `
      id,
      tanque_id,
      data_recebimento,
      tipo_diesel,
      fornecedor_id,
      fornecedor_nome,
      nf_numero,
      nf_volume_litros,
      regua_antes_cm,
      regua_depois_cm,
      litros_antes,
      litros_depois,
      volume_recebido_litros,
      diff_recebimento_litros,
      pct_diff_recebimento,
      status_recebimento,
      foto_antes_url,
      foto_depois_url,
      observacao,
      criado_em
      `
    )
    .gte("data_recebimento", from)
    .lte("data_recebimento", to)
    .order("data_recebimento", { ascending: false });

  if (product) {
    query = query.eq("tipo_diesel", product);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((row) => mapReceiptRow(row, metadata));
}

export function getPreviousEntry(entries, product, currentDate, currentId = null) {
  const current = new Date(`${currentDate}T00:00:00`);

  return (
    [...(entries || [])]
      .filter((entry) => entry.product === product && entry.date && entry.id !== currentId)
      .filter((entry) => new Date(`${entry.date}T00:00:00`) < current)
      .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`))[0] ||
    null
  );
}

export function getPreviousPumpReading(entries, product, currentDate, pumpNumber) {
  const previous = getPreviousEntry(entries, product, currentDate);

  const pump = previous?.pumps?.find(
    (item) => Number(item.number) === Number(pumpNumber)
  );

  return pump?.final ?? pump?.initial ?? null;
}

export function buildDefaultForm(product, year, month) {
  const selectedProduct = product in PRODUCT_CONFIG ? product : "S500";
  const date = getDefaultDateForMonth(year, month);
  const pumpNumbers = getRequiredPumpNumbers(selectedProduct);

  return {
    id: null,
    product: selectedProduct,
    date,

    medicaoAtual: "",
    reguaFinalT1: "",
    reguaFinalT2: "",

    nfVolumeLitros: "",
    supplier: "",
    supplierId: null,
    nfNumero: "",

    transnetOutput: "",
    observation: "",

    pumps: pumpNumbers.map((number) => ({
      number,
      initial: "",
      final: "",
    })),
  };
}

export function buildDefaultReceiptForm(product = "S500") {
  return {
    id: null,
    product: product in PRODUCT_CONFIG ? product : "S500",
    date: getTodayISO(),
    supplier: "",
    supplierId: null,
    nfNumero: "",
    nfVolumeLitros: "",
    reguaAntesCm: "",
    reguaDepoisCm: "",
    fotoAntesFile: null,
    fotoDepoisFile: null,
    observation: "",
  };
}

export function computeReceipt(form, params) {
  const radius = getRadiusFromParams(params);
  const length = parseNumber(params?.lengthM) || DEFAULT_PARAMS.S500.lengthM;

  const litrosAntes = calculateVolumeLiters(form.reguaAntesCm, radius, length);
  const litrosDepois = calculateVolumeLiters(form.reguaDepoisCm, radius, length);

  const nfVolumeLitros = parseNumber(form.nfVolumeLitros) || 0;

  const volumeRecebidoLitros =
    litrosAntes !== null && litrosDepois !== null ? round(litrosDepois - litrosAntes, 2) : null;

  const diffRecebimentoLitros =
    volumeRecebidoLitros !== null ? round(volumeRecebidoLitros - nfVolumeLitros, 2) : null;

  const pctDiffRecebimento =
    nfVolumeLitros > 0 && diffRecebimentoLitros !== null
      ? round(diffRecebimentoLitros / nfVolumeLitros, 6)
      : null;

  return {
    litrosAntes,
    litrosDepois,
    volumeRecebidoLitros,
    diffRecebimentoLitros,
    pctDiffRecebimento,
  };
}

export function receiptStatus(computed, params) {
  const pct = computed?.pctDiffRecebimento;

  if (pct === null || pct === undefined) {
    return { tone: "slate", label: "OK" };
  }

  const absPct = Math.abs(Number(pct));
  const warn = Number(params?.nfDiffWarnPct ?? 0.01);
  const critical = Number(params?.nfDiffCriticalPct ?? 0.03);

  if (absPct > critical) {
    return { tone: "rose", label: "Critico" };
  }

  if (absPct > warn) {
    return { tone: "amber", label: "Atencao" };
  }

  return { tone: "emerald", label: "OK" };
}

export function computeMeasurement(form, params, previousEntry, receipts = []) {
  const radius = getRadiusFromParams(params);
  const length = parseNumber(params?.lengthM) || DEFAULT_PARAMS.S500.lengthM;

  const reguaFinalT1 = parseNumber(form.reguaFinalT1);
  const reguaFinalT2 = parseNumber(form.reguaFinalT2);
  const medicaoAtualInput = parseNumber(form.medicaoAtual);

  const litrosFinalT1 =
    reguaFinalT1 !== null ? calculateVolumeLiters(reguaFinalT1, radius, length) : null;

  const litrosFinalT2 =
    reguaFinalT2 !== null ? calculateVolumeLiters(reguaFinalT2, radius, length) : null;

  const saldoFinalPorRegua =
    litrosFinalT1 !== null || litrosFinalT2 !== null
      ? round((litrosFinalT1 || 0) + (litrosFinalT2 || 0), 2)
      : null;

  const medicaoAtual =
    medicaoAtualInput !== null
      ? medicaoAtualInput
      : saldoFinalPorRegua !== null
      ? saldoFinalPorRegua
      : null;

  const medicaoD1 =
    previousEntry?.medicaoAtual ??
    previousEntry?.saldoFinal ??
    previousEntry?.medicao_atual ??
    previousEntry?.saldo_final ??
    0;

  const entradaRecebimentos = round(
    (receipts || [])
      .filter((receipt) => receipt.product === form.product || receipt.tipoDiesel === form.product)
      .filter((receipt) => receipt.date === form.date || receipt.dataRecebimento === form.date)
      .reduce((sum, receipt) => {
        const value =
          parseNumber(receipt.volumeRecebidoLitros) ??
          parseNumber(receipt.nfVolumeLitros) ??
          0;

        return sum + value;
      }, 0),
    2
  );

  const nfVolumeLitros = parseNumber(form.nfVolumeLitros) || 0;
  const entradaDiesel = entradaRecebimentos || nfVolumeLitros || 0;

  const saidaTanque =
    medicaoAtual !== null ? round((medicaoD1 || 0) + entradaDiesel - medicaoAtual, 2) : null;

  const pumpDetails = (form.pumps || []).map((pump) => {
    const initial = parseNumber(pump.initial) || 0;
    const final = parseNumber(pump.final) || 0;

    return {
      ...pump,
      number: pump.number,
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

  const diffRecebimento =
    entradaDiesel && nfVolumeLitros ? round(entradaDiesel - nfVolumeLitros, 2) : 0;

  const pctDiffNF =
    nfVolumeLitros > 0 ? round((entradaDiesel - nfVolumeLitros) / nfVolumeLitros, 6) : null;

  const pctDiffTransnet =
    saidaTanque && saidaTanque !== 0
      ? round((saidaTransnet - saidaTanque) / saidaTanque, 6)
      : null;

  const diffTanqueTransnet =
    saidaTanque !== null ? round(saidaTransnet - saidaTanque, 2) : null;

  const diffBombasTransnet = round(saidaTransnet - saidaTotalBombas, 2);

  const diffTanqueBombas =
    saidaTanque !== null ? round(saidaTotalBombas - saidaTanque, 2) : null;

  return {
    litrosAnteriorT1: null,
    litrosAnteriorT2: null,
    litrosFinalT1,
    litrosFinalT2,

    saldoAnterior: medicaoD1,
    saldoFinal: medicaoAtual,

    entradaDiesel,
    entradaRecebimentos,
    nfVolumeLitros,

    medicaoD1,
    medicaoAtual,

    saidaTanque,
    pumpDetails,
    saidaTotalBombas,
    saidaTransnet,

    diffRecebimento,
    pctDiffNF,
    pctDiffTransnet,

    diffTanqueTransnet,
    diffBombasTransnet,
    diffTanqueBombas,
  };
}

export function validateMeasurement(form, computed, params) {
  const errors = {};
  const warnings = [];

  const medicaoAtual = parseNumber(form.medicaoAtual);
  const reguaFinalT1 = parseNumber(form.reguaFinalT1);
  const reguaFinalT2 = parseNumber(form.reguaFinalT2);

  if (medicaoAtual === null && reguaFinalT1 === null && reguaFinalT2 === null) {
    errors.medicaoAtual = "Informe a medicao atual do tanque ou a regua final.";
  }

  if (form.transnetOutput === "" || form.transnetOutput === null || form.transnetOutput === undefined) {
    warnings.push("Saida Transnet ainda nao foi informada.");
  }

  (form.pumps || []).forEach((pump) => {
    const initial = parseNumber(pump.initial);
    const final = parseNumber(pump.final);

    if (final === null) {
      errors[`pump_${pump.number}`] = `Informe o encerrante atual da bomba ${pump.number}.`;
    }

    if (initial !== null && final !== null && final < initial) {
      errors[`pump_${pump.number}`] = `Bomba ${pump.number}: encerrante atual nao pode ser menor que o D-1.`;
    }
  });

  ["reguaFinalT1", "reguaFinalT2"].forEach((field) => {
    const value = parseNumber(form[field]);

    if (value !== null && params?.maxRuleCm && value > params.maxRuleCm) {
      warnings.push(`${field} acima do limite fisico do tanque.`);
    }
  });

  if (
    computed?.pctDiffNF !== null &&
    computed?.pctDiffNF !== undefined &&
    Math.abs(computed.pctDiffNF) > (params?.nfDiffWarnPct || 0.01)
  ) {
    warnings.push("Diferenca NF x recebido acima da faixa de atencao.");
  }

  if (
    computed?.pctDiffTransnet !== null &&
    computed?.pctDiffTransnet !== undefined &&
    Math.abs(computed.pctDiffTransnet) > (params?.transnetWarnPct || 0.02)
  ) {
    warnings.push("Diferenca tanque x Transnet acima da faixa de atencao.");
  }

  if ((computed?.saldoFinal || 0) < 0) {
    warnings.push("Saldo final negativo. Revise as medicoes.");
  }

  return { errors, warnings };
}

export function validateReceipt(form, computed, params) {
  const errors = {};
  const warnings = [];

  if (!form.date) {
    errors.date = "Informe a data do recebimento.";
  }

  if (!form.product) {
    errors.product = "Informe o produto.";
  }

  if (!parseNumber(form.nfVolumeLitros)) {
    errors.nfVolumeLitros = "Informe o volume da NF.";
  }

  if (parseNumber(form.reguaAntesCm) === null) {
    errors.reguaAntesCm = "Informe a regua antes do recebimento.";
  }

  if (parseNumber(form.reguaDepoisCm) === null) {
    errors.reguaDepoisCm = "Informe a regua depois do recebimento.";
  }

  if (computed?.volumeRecebidoLitros !== null && computed?.volumeRecebidoLitros < 0) {
    errors.volumeRecebidoLitros = "Volume recebido ficou negativo. Confira as reguas.";
  }

  const status = receiptStatus(computed, params);

  if (status.label === "Atencao") {
    warnings.push("Recebimento fora da faixa de atencao.");
  }

  if (status.label === "Critico") {
    warnings.push("Recebimento fora da faixa critica.");
  }

  return { errors, warnings };
}

export function measurementStatus(computed, params) {
  const nfCritical =
    computed?.pctDiffNF !== null &&
    computed?.pctDiffNF !== undefined &&
    Math.abs(computed.pctDiffNF) > (params?.nfDiffCriticalPct || 0.03);

  const transnetCritical =
    computed?.pctDiffTransnet !== null &&
    computed?.pctDiffTransnet !== undefined &&
    Math.abs(computed.pctDiffTransnet) > (params?.transnetCriticalPct || 0.03);

  const nfWarn =
    computed?.pctDiffNF !== null &&
    computed?.pctDiffNF !== undefined &&
    Math.abs(computed.pctDiffNF) > (params?.nfDiffWarnPct || 0.01);

  const transnetWarn =
    computed?.pctDiffTransnet !== null &&
    computed?.pctDiffTransnet !== undefined &&
    Math.abs(computed.pctDiffTransnet) > (params?.transnetWarnPct || 0.02);

  if (nfCritical || transnetCritical) {
    return { tone: "rose", label: "Critico" };
  }

  if (nfWarn || transnetWarn) {
    return { tone: "amber", label: "Atencao" };
  }

  return { tone: "emerald", label: "OK" };
}

async function resolveSupplierId(form, metadata) {
  let supplierId = form.supplierId || null;

  if (!supplierId && form.supplier) {
    const existingSupplier = Object.values(metadata?.suppliersById || {}).find(
      (supplier) => supplier.nome === form.supplier
    );

    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      const { data: newSupplier, error: supplierError } = await supabase
        .from("estoque_diesel_fornecedores")
        .insert({ nome: form.supplier, ativo: true })
        .select("id, nome")
        .single();

      if (supplierError) throw supplierError;

      supplierId = newSupplier.id;

      if (metadata?.suppliersById) {
        metadata.suppliersById[newSupplier.id] = newSupplier;
      }
    }
  }

  return supplierId;
}

export async function saveMeasurementEntry({
  form,
  computed,
  product,
  params,
  metadata,
  userId = null,
}) {
  const tank = getTankByProduct(metadata, product);

  if (!tank?.id) {
    throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);
  }

  const supplierId = await resolveSupplierId(form, metadata);

  const status = measurementStatus(computed, params).label;

  const payload = {
    tanque_id: tank.id,
    data_medicao: form.date,

    regua_anterior_t1: null,
    regua_anterior_t2: null,
    regua_final_t1: parseNumber(form.reguaFinalT1),
    regua_final_t2: parseNumber(form.reguaFinalT2),

    nf_volume_litros: parseNumber(form.nfVolumeLitros) || 0,
    fornecedor_id: supplierId,
    nf_numero: form.nfNumero || null,

    saida_transnet: parseNumber(form.transnetOutput) || 0,

    litros_anterior_t1: computed.litrosAnteriorT1,
    litros_anterior_t2: computed.litrosAnteriorT2,
    litros_final_t1: computed.litrosFinalT1,
    litros_final_t2: computed.litrosFinalT2,

    saldo_anterior: computed.saldoAnterior,
    saldo_final: computed.saldoFinal,

    entrada_diesel: computed.entradaDiesel,
    medicao_d1: computed.medicaoD1,
    medicao_atual: computed.medicaoAtual,
    saida_tanque: computed.saidaTanque,

    diff_recebimento: computed.diffRecebimento,
    pct_diff_nf: computed.pctDiffNF,
    pct_diff_transnet: computed.pctDiffTransnet,

    saida_total_bombas: computed.saidaTotalBombas,
    status_lancamento: status,

    observacao: form.observation || null,
    atualizado_em: new Date().toISOString(),
    usuario_id: Number.isInteger(userId) ? userId : null,
  };

  const { data: savedMeasurement, error: measurementError } = await supabase
    .from("estoque_diesel_medicoes_diarias")
    .upsert(payload, { onConflict: "tanque_id,data_medicao" })
    .select("id")
    .single();

  if (measurementError) throw measurementError;

  const dbPumps = (metadata?.pumpsByProduct?.[product] || [])
    .filter((pump) =>
      getRequiredPumpNumbers(product).includes(Number(pump.numero))
    )
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

  const pumpPayload = dbPumps.map((pump) => {
    const formPump = (form.pumps || []).find(
      (item) => Number(item.number) === Number(pump.numero)
    );

    return {
      medicao_id: savedMeasurement.id,
      bomba_id: pump.id,
      hodometro_inicial: parseNumber(formPump?.initial) || 0,
      hodometro_final: parseNumber(formPump?.final) || 0,
    };
  });

  if (pumpPayload.length > 0) {
    const { error: pumpError } = await supabase
      .from("estoque_diesel_leituras_bomba")
      .upsert(pumpPayload, { onConflict: "medicao_id,bomba_id" });

    if (pumpError) throw pumpError;
  }

  return savedMeasurement.id;
}

async function uploadDieselReceiptFile(file, product, date, type) {
  if (!file) return null;

  const safeName = String(file.name || "foto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const path = `recebimentos/${product}/${date}/${Date.now()}_${type}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("estoque-diesel")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("estoque-diesel").getPublicUrl(path);

  return data?.publicUrl || path;
}

export async function saveDieselReceipt({
  form,
  computed,
  product,
  params,
  metadata,
  userId = null,
}) {
  const tank = getTankByProduct(metadata, product);

  if (!tank?.id) {
    throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);
  }

  const supplierId = await resolveSupplierId(form, metadata);

  const [fotoAntesUrl, fotoDepoisUrl] = await Promise.all([
    uploadDieselReceiptFile(form.fotoAntesFile, product, form.date, "antes"),
    uploadDieselReceiptFile(form.fotoDepoisFile, product, form.date, "depois"),
  ]);

  const status = receiptStatus(computed, params).label;

  const payload = {
    tanque_id: tank.id,
    data_recebimento: form.date,
    tipo_diesel: product,

    fornecedor_id: supplierId,
    fornecedor_nome: form.supplier || null,

    nf_numero: form.nfNumero || null,
    nf_volume_litros: parseNumber(form.nfVolumeLitros) || 0,

    regua_antes_cm: parseNumber(form.reguaAntesCm),
    regua_depois_cm: parseNumber(form.reguaDepoisCm),

    litros_antes: computed.litrosAntes,
    litros_depois: computed.litrosDepois,

    volume_recebido_litros: computed.volumeRecebidoLitros,
    diff_recebimento_litros: computed.diffRecebimentoLitros,
    pct_diff_recebimento: computed.pctDiffRecebimento,

    status_recebimento: status,

    foto_antes_url: fotoAntesUrl,
    foto_depois_url: fotoDepoisUrl,

    observacao: form.observation || null,
    usuario_id: Number.isInteger(userId) ? userId : null,
    atualizado_em: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("estoque_diesel_recebimentos")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  return data.id;
}

export async function saveMeasurementParams(paramStore, metadata) {
  const tanksPayload = [];
  const paramsPayload = [];
  const tolerancesPayload = [];

  for (const product of Object.keys(PRODUCT_CONFIG)) {
    const tank = metadata?.tanksByProduct?.[product];
    const current = paramStore?.[product] || DEFAULT_PARAMS[product];

    if (!tank?.id) {
      continue;
    }

    tanksPayload.push({
      id: tank.id,
      diametro_m: parseNumber(current.diameterM) || DEFAULT_PARAMS[product].diameterM,
      comprimento_m: parseNumber(current.lengthM) || DEFAULT_PARAMS[product].lengthM,
      ativo: true,
    });

    paramsPayload.push({
      tanque_id: tank.id,
      regua_max_cm: parseNumber(current.maxRuleCm) || DEFAULT_PARAMS[product].maxRuleCm,
      pct_diff_nf_alerta:
        parseNumber(current.nfDiffWarnPct) || DEFAULT_PARAMS[product].nfDiffWarnPct,
      pct_diff_nf_critico:
        parseNumber(current.nfDiffCriticalPct) || DEFAULT_PARAMS[product].nfDiffCriticalPct,
      pct_diff_transnet_alerta:
        parseNumber(current.transnetWarnPct) || DEFAULT_PARAMS[product].transnetWarnPct,
      pct_diff_transnet_critico:
        parseNumber(current.transnetCriticalPct) || DEFAULT_PARAMS[product].transnetCriticalPct,
      ativo: true,
      atualizado_em: new Date().toISOString(),
    });

    const toleranceRows = Array.isArray(current.toleranceRows)
      ? current.toleranceRows
      : DEFAULT_PARAMS[product].toleranceRows;

    for (const row of normalizeToleranceRows(toleranceRows)) {
      tolerancesPayload.push({
        tipo_diesel: product,
        volume_nf: row.nfVolume,
        pct_variacao_aceitavel: row.variationPct,
        diff_volume_aceitavel: row.acceptableDiffLiters,
        ativo: true,
      });
    }
  }

  if (tanksPayload.length > 0) {
    const { error: tanksError } = await supabase
      .from("estoque_diesel_tanques")
      .upsert(tanksPayload, { onConflict: "id" });

    if (tanksError) throw tanksError;
  }

  if (paramsPayload.length > 0) {
    const { error: paramsError } = await supabase
      .from("estoque_diesel_parametros")
      .upsert(paramsPayload, { onConflict: "tanque_id" });

    if (paramsError) throw paramsError;
  }

  if (tolerancesPayload.length > 0) {
    const { error: toleranceError } = await supabase
      .from("estoque_diesel_tolerancias_nf")
      .upsert(tolerancesPayload, { onConflict: "tipo_diesel,volume_nf" });

    if (toleranceError) throw toleranceError;
  }

  return true;
}

export function serializeEntry(form, computed, params) {
  return {
    id: form.id || `${form.product}-${form.date}-${Date.now()}`,
    product: form.product,
    date: form.date,

    supplier: form.supplier,
    supplierId: form.supplierId || null,
    nfNumero: form.nfNumero,
    nfVolumeLitros: parseNumber(form.nfVolumeLitros) || 0,

    observation: form.observation,

    reguaAnteriorT1: null,
    reguaAnteriorT2: null,
    reguaFinalT1: parseNumber(form.reguaFinalT1),
    reguaFinalT2: parseNumber(form.reguaFinalT2),

    transnetOutput: parseNumber(form.transnetOutput) || 0,
    pumps: computed.pumpDetails,

    status: measurementStatus(computed, params).label,
    ...computed,

    createdAt: new Date().toISOString(),
  };
}
