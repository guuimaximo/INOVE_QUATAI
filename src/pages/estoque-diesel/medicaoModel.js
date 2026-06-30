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
    pumps: [2, 3],
    usesTransnet: true,
    monthSheetPattern: "Medicao Combustivel S500",
  },
  S10: {
    code: "S10",
    label: "Diesel S10",
    requiredPumpNumbers: [1],
    pumps: [1],
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

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw;

  if (raw.includes(",") && raw.includes(".")) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }

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
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 4);

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(new Date().getFullYear());

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

function sanitizeFileName(name = "arquivo") {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeSupplierName(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function getRelevantRuleField(product, moment) {
  if (product === "S500") {
    return moment === "before" ? "receiptRuleBeforeT2" : "receiptRuleAfterT2";
  }
  return moment === "before" ? "receiptRuleBeforeT1" : "receiptRuleAfterT1";
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

function findToleranceRow(params, nfVolumeLitros) {
  const nfVolume = parseNumber(nfVolumeLitros) || 0;
  const rows = Array.isArray(params?.toleranceRows) ? params.toleranceRows : [];

  if (nfVolume <= 0 || rows.length === 0) return null;

  return rows.find((row) => nfVolume <= Number(row.nfVolume || 0)) || rows[rows.length - 1] || null;
}

export function getRequiredPumpNumbers(product) {
  return PRODUCT_CONFIG[product]?.requiredPumpNumbers || [];
}

export function buildPumpAdjustmentKey(dateValue, pumpId) {
  if (!dateValue || !pumpId) return null;
  return `${dateValue}::${pumpId}`;
}

export function getPumpInitialAdjustment(metadata, pumpId, dateValue) {
  const key = buildPumpAdjustmentKey(dateValue, pumpId);
  if (!key) return null;
  return metadata?.pumpInitialAdjustmentsByKey?.[key] || null;
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

  const saidaTanque = row.saida_tanque ?? null;
  const saidaTotalBombas = row.saida_total_bombas ?? 0;
  const saidaTransnet = row.saida_transnet ?? null;

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
    hasReceipt: row.houve_recebimento === true || Number(row.nf_volume_litros || 0) > 0,
    receiptRuleBeforeT1: row.regua_recebimento_antes_t1,
    receiptRuleBeforeT2: row.regua_recebimento_antes_t2,
    receiptRuleAfterT1: row.regua_recebimento_depois_t1,
    receiptRuleAfterT2: row.regua_recebimento_depois_t2,
    receiptPhotoBeforeUrl: row.foto_regua_antes_url || "",
    receiptPhotoAfterUrl: row.foto_regua_depois_url || "",
    receiptMeasuredLiters: row.recebimento_litros_calculado,
    receiptToleranceLiters: row.recebimento_tolerancia_litros,
    receiptWithinTolerance: row.recebimento_dentro_tolerancia,
    transnetOutput: saidaTransnet,
    pumps: sortedPumps,
    litrosAnteriorT1: row.litros_anterior_t1,
    litrosAnteriorT2: row.litros_anterior_t2,
    litrosFinalT1: row.litros_final_t1,
    litrosFinalT2: row.litros_final_t2,
    saldoAnterior: row.saldo_anterior,
    saldoFinal: row.saldo_final,
    entradaDiesel: row.entrada_diesel,
    medicaoD1: row.medicao_d1,
    medicaoAtual: row.medicao_atual,
    saidaTanque,
    saidaTotalBombas,
    saidaTransnet,
    diffRecebimento: row.diff_recebimento,
    pctDiffNF: row.pct_diff_nf,
    pctDiffTransnet: row.pct_diff_transnet,
    diffTanqueTransnet: saidaTanque !== null && saidaTransnet !== null ? round(saidaTransnet - saidaTanque, 2) : null,
    diffBombasTransnet: saidaTransnet !== null ? round(saidaTransnet - saidaTotalBombas, 2) : null,
    diffTanqueBombas: saidaTanque !== null ? round(saidaTotalBombas - saidaTanque, 2) : null,
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
    supplier: row.fornecedor_nome || metadata?.suppliersById?.[row.fornecedor_id]?.nome || "",
    nfNumero: row.nf_numero || "",
    nfVolumeLitros: row.nf_volume_litros ?? 0,
    unitPrice: row.valor_unitario ?? null,
    totalValue: row.valor_total ?? null,
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

export async function fetchMeasurementContext() {
  const [tanksResponse, paramsResponse, tolerancesResponse, suppliersResponse, pumpsResponse, pumpAdjustmentsResponse] =
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
      supabase
        .from("estoque_diesel_ajustes_hodometro_inicial")
        .select("id, bomba_id, data_referencia, hodometro_inicial, observacao, atualizado_em, usuario_id")
        .eq("ativo", true),
    ]);

  for (const response of [tanksResponse, paramsResponse, tolerancesResponse, suppliersResponse, pumpsResponse, pumpAdjustmentsResponse]) {
    if (response.error) throw response.error;
  }

  const paramStore = cloneDefaults();
  const metadata = {
    tanksByProduct: {},
    tanksById: {},
    pumpsByProduct: {},
    pumpsById: {},
    pumpInitialAdjustmentsByKey: {},
    suppliersById: {},
  };

  const paramsByTankId = Object.fromEntries((paramsResponse.data || []).map((row) => [row.tanque_id, row]));

  for (const supplier of suppliersResponse.data || []) {
    metadata.suppliersById[supplier.id] = supplier;
  }

  for (const tank of tanksResponse.data || []) {
    const product = tank.tipo_diesel || "S500";
    const currentDefault = paramStore[product] || DEFAULT_PARAMS[product] || DEFAULT_PARAMS.S500;

    metadata.tanksByProduct[product] = tank;
    metadata.tanksById[tank.id] = tank;

    const productParams = {
      ...currentDefault,
      diameterM: Number(tank.diametro_m || currentDefault.diameterM),
      lengthM: Number(tank.comprimento_m || currentDefault.lengthM),
      radiusM: Number(tank.raio_m || currentDefault.diameterM / 2),
    };

    const dbParam = paramsByTankId[tank.id];
    if (dbParam) {
      productParams.maxRuleCm = Number(dbParam.regua_max_cm ?? productParams.maxRuleCm);
      productParams.nfDiffWarnPct = Number(dbParam.pct_diff_nf_alerta ?? productParams.nfDiffWarnPct);
      productParams.nfDiffCriticalPct = Number(dbParam.pct_diff_nf_critico ?? productParams.nfDiffCriticalPct);
      productParams.transnetWarnPct = Number(dbParam.pct_diff_transnet_alerta ?? productParams.transnetWarnPct);
      productParams.transnetCriticalPct = Number(dbParam.pct_diff_transnet_critico ?? productParams.transnetCriticalPct);
    }

    paramStore[product] = productParams;
  }

  const suppliers = [...new Set((suppliersResponse.data || []).map((supplier) => String(supplier.nome || "").trim()).filter(Boolean))];
  Object.keys(paramStore).forEach((product) => {
    paramStore[product].suppliers = suppliers;
  });

  const toleranceRowsByProduct = {};
  for (const row of tolerancesResponse.data || []) {
    const product = row.tipo_diesel || "S500";
    if (!toleranceRowsByProduct[product]) toleranceRowsByProduct[product] = [];

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
    if (!metadata.pumpsByProduct[product]) metadata.pumpsByProduct[product] = [];
    metadata.pumpsByProduct[product].push(pump);
  }

  Object.keys(metadata.pumpsByProduct).forEach((product) => {
    metadata.pumpsByProduct[product].sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
  });

  for (const adjustment of pumpAdjustmentsResponse.data || []) {
    const key = buildPumpAdjustmentKey(adjustment.data_referencia, adjustment.bomba_id);
    if (!key) continue;
    metadata.pumpInitialAdjustmentsByKey[key] = adjustment;
  }

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
    .select("*")
    .gte("data_medicao", from)
    .lte("data_medicao", to)
    .order("data_medicao", { ascending: true });

  if (product && metadata?.tanksByProduct?.[product]?.id) {
    query = query.eq("tanque_id", metadata.tanksByProduct[product].id);
  } else if (product) {
    return [];
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  let pumpRowsByMeasurement = {};
  if (includePumps && rows?.length) {
    const { data: pumpRows, error: pumpsError } = await supabase
      .from("estoque_diesel_leituras_bomba")
      .select("medicao_id, bomba_id, hodometro_inicial, hodometro_final, saida_bomba")
      .in("medicao_id", rows.map((row) => row.id));

    if (pumpsError) throw pumpsError;

    pumpRowsByMeasurement = (pumpRows || []).reduce((acc, row) => {
      if (!acc[row.medicao_id]) acc[row.medicao_id] = [];
      acc[row.medicao_id].push(row);
      return acc;
    }, {});
  }

  return (rows || [])
    .map((row) => mapMeasurementRowToEntry(row, metadata, paramStore, pumpRowsByMeasurement[row.id] || []))
    .filter(isMeaningfulEntry);
}

export async function fetchDieselReceipts({
  year = "2026",
  product = null,
  metadata,
}) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  let query = supabase
    .from("estoque_diesel_recebimentos")
    .select("*")
    .gte("data_recebimento", from)
    .lte("data_recebimento", to)
    .order("data_recebimento", { ascending: true });

  if (product) {
    query = query.eq("tipo_diesel", product);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row) => mapReceiptRow(row, metadata));
}

export function isMeaningfulEntry(entry) {
  const hasFinalRule =
    Number(parseNumber(entry?.reguaFinalT1) || 0) > 0 ||
    Number(parseNumber(entry?.reguaFinalT2) || 0) > 0;

  return Boolean(
    hasFinalRule ||
      Number(entry?.nfVolumeLitros || 0) > 0 ||
      Number(entry?.transnetOutput || entry?.saidaTransnet || 0) > 0 ||
      Number(entry?.saidaTotalBombas || 0) > 0 ||
      Number(entry?.receiptMeasuredLiters || 0) > 0 ||
      String(entry?.observation || entry?.observacao || "").trim()
  );
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

export function getDailyReceipts(receipts, product, date) {
  if (!Array.isArray(receipts) || !product || !date) return [];
  return receipts.filter(
    (receipt) =>
      (receipt.product === product || receipt.tipoDiesel === product) &&
      (receipt.date === date || receipt.dataRecebimento === date)
  );
}

export function getPreviousPumpReading(entries, product, currentDate, pumpNumber) {
  const previous = getPreviousEntry(entries, product, currentDate);
  const pump = previous?.pumps?.find((item) => Number(item.number) === Number(pumpNumber));
  return pump?.final ?? pump?.initial ?? null;
}

export function buildDefaultForm(product, year, month) {
  const selectedProduct = product in PRODUCT_CONFIG ? product : "S500";
  const pumpNumbers = getRequiredPumpNumbers(selectedProduct);

  return {
    id: null,
    product: selectedProduct,
    date: getDefaultDateForMonth(year, month),
    reguaAnteriorT1: "",
    reguaAnteriorT2: "",
    reguaFinalT1: "",
    reguaFinalT2: "",
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
  if (pct === null || pct === undefined) return { tone: "slate", label: "OK" };

  const value = Number(pct);
  const absPct = Math.abs(value);
  const warn = Number(params?.nfDiffWarnPct ?? 0.01);
  const critical = Number(params?.nfDiffCriticalPct ?? 0.03);

  if (value < 0 && absPct > critical) return { tone: "rose", label: "Critico" };
  if (value < 0 && absPct > warn) return { tone: "rose", label: "Atencao" };
  if (value > 0 && absPct > warn) return { tone: "amber", label: "Atencao" };
  return { tone: "emerald", label: "OK" };
}

export function computeMeasurement(form, params, previousEntry, receipts = []) {
  const radius = getRadiusFromParams(params);
  const length = parseNumber(params?.lengthM) || DEFAULT_PARAMS.S500.lengthM;
  const product = form?.product || "S500";

  const reguaAnteriorT1 =
    parseNumber(form.reguaAnteriorT1) ?? parseNumber(previousEntry?.reguaFinalT1);
  const reguaAnteriorT2 =
    parseNumber(form.reguaAnteriorT2) ?? parseNumber(previousEntry?.reguaFinalT2);
  const reguaFinalT1 = parseNumber(form.reguaFinalT1);
  const reguaFinalT2 = parseNumber(form.reguaFinalT2);

  const litrosAnteriorT1 = calculateVolumeLiters(reguaAnteriorT1, radius, length);
  const litrosAnteriorT2 = calculateVolumeLiters(reguaAnteriorT2, radius, length);
  const litrosFinalT1 = calculateVolumeLiters(reguaFinalT1, radius, length);
  const litrosFinalT2 = calculateVolumeLiters(reguaFinalT2, radius, length);

  const saldoAnteriorCalculado = round((litrosAnteriorT1 || 0) + (litrosAnteriorT2 || 0), 2);
  const medicaoInicial = round((litrosFinalT1 || 0) + (litrosFinalT2 || 0), 2);

  const medicaoD1 =
    previousEntry?.saldoFinal ??
    previousEntry?.medicaoAtual ??
    previousEntry?.medicao_atual ??
    previousEntry?.saldo_final ??
    saldoAnteriorCalculado ??
    0;

  const saldoAnterior = medicaoD1;

  const hasInlineReceipt = form.hasReceipt === true;
  const nfVolumeLitros = parseNumber(form.nfVolumeLitros) || 0;

  const receiptBeforeT1 = calculateVolumeLiters(form.receiptRuleBeforeT1, radius, length);
  const receiptBeforeT2 = calculateVolumeLiters(form.receiptRuleBeforeT2, radius, length);
  const receiptAfterT1 = calculateVolumeLiters(form.receiptRuleAfterT1, radius, length);
  const receiptAfterT2 = calculateVolumeLiters(form.receiptRuleAfterT2, radius, length);

  const inlineReceiptMeasuredLiters = hasInlineReceipt
    ? round(
        (receiptAfterT1 || 0) +
          (receiptAfterT2 || 0) -
          (receiptBeforeT1 || 0) -
          (receiptBeforeT2 || 0),
        2
      )
    : null;

  const inlineReceiptLiters = hasInlineReceipt
    ? round(inlineReceiptMeasuredLiters ?? nfVolumeLitros, 2)
    : 0;

  const externalDailyReceipts = round(
    (receipts || []).reduce((sum, receipt) => {
      const value =
        parseNumber(receipt.volumeRecebidoLitros) ??
        parseNumber(receipt.nfVolumeLitros) ??
        0;
      return sum + value;
    }, 0),
    2
  );

  // A modal de Recebimento e a fonte unica do volume recebido. Se ja existe
  // pelo menos um recebimento salvo no dia, ignoramos o inline (que era o
  // fluxo legacy embutido na medicao). Sem isso o usuario via 20.000L quando
  // entrou so um recebimento de 10.000L: 10k do inline + 10k do externo.
  const usaInline = !(receipts && receipts.length > 0);
  const entradaRecebimentos = round(
    (externalDailyReceipts || 0) + (usaInline ? (inlineReceiptLiters || 0) : 0),
    2
  );
  const entradaDiesel = round(entradaRecebimentos || 0, 2);
  const saldoFinal = round((medicaoInicial || 0) + (entradaDiesel || 0), 2);
  const medicaoAtual = saldoFinal;

  const saidaTanque =
    medicaoAtual !== null ? round((medicaoD1 || 0) + entradaDiesel - medicaoAtual, 2) : null;

  const pumpDetails = (form.pumps || []).map((pump) => {
    const previousPump = (previousEntry?.pumps || []).find(
      (item) => Number(item.number) === Number(pump.number)
    );
    const pumpAdjustment = pump.adjustment || null;

    const initial =
      parseNumber(pump.initial) ??
      parseNumber(pumpAdjustment?.hodometro_inicial) ??
      parseNumber(previousPump?.final) ??
      0;
    const final = parseNumber(pump.final) || 0;

    // Problema 2: alerta quando o inicial NAO bate com o encerrante do dia
    // anterior e nao ha ajuste manual (ex.: bomba registrou consumo fora do
    // sistema, ou o D-1 mudou depois). encerranteAnterior = final do D-1.
    const encerranteAnterior = parseNumber(previousPump?.final);
    const initialMismatch =
      encerranteAnterior != null &&
      !pumpAdjustment &&
      Math.abs(initial - encerranteAnterior) > 0.5;

    return {
      ...pump,
      number: pump.number,
      adjustment: pumpAdjustment,
      initial,
      final,
      output: round(final - initial, 2),
      encerranteAnterior,
      initialMismatch,
      initialGap: initialMismatch ? round(initial - encerranteAnterior, 2) : 0,
    };
  });

  const saidaTotalBombas = round(
    pumpDetails.reduce((sum, pump) => sum + (pump.output || 0), 0),
    2
  );

  const saidaTransnet = parseNumber(form.transnetOutput);
  const diffRecebimento =
    hasInlineReceipt && nfVolumeLitros > 0 ? round((inlineReceiptLiters || 0) - nfVolumeLitros, 2) : null;
  const pctDiffNF =
    hasInlineReceipt && nfVolumeLitros > 0 ? round(((inlineReceiptLiters || 0) - nfVolumeLitros) / nfVolumeLitros, 6) : null;

  const pctDiffTransnet =
    saidaTransnet !== null && saidaTanque && saidaTanque !== 0
      ? round((saidaTransnet - saidaTanque) / saidaTanque, 6)
      : null;

  const diffTanqueTransnet =
    saidaTanque !== null && saidaTransnet !== null ? round(saidaTransnet - saidaTanque, 2) : null;

  const diffBombasTransnet =
    saidaTransnet !== null ? round(saidaTransnet - saidaTotalBombas, 2) : null;
  const diffTanqueBombas =
    saidaTanque !== null ? round(saidaTotalBombas - saidaTanque, 2) : null;
  const pctDiffTankBombas =
    saidaTanque && saidaTanque !== 0
      ? round((saidaTotalBombas - saidaTanque) / saidaTanque, 6)
      : null;

  const toleranceRow = findToleranceRow(params, nfVolumeLitros);
  const receiptToleranceLiters = toleranceRow?.acceptableDiffLiters ?? null;
  const receiptWithinTolerance =
    hasInlineReceipt && receiptToleranceLiters !== null && diffRecebimento !== null
      ? Math.abs(diffRecebimento) <= receiptToleranceLiters
      : null;
  const receiptBelowExpected = diffRecebimento !== null ? diffRecebimento < 0 : false;

  return {
    product,
    reguaAnteriorT1,
    reguaAnteriorT2,
    litrosAnteriorT1,
    litrosAnteriorT2,
    litrosFinalT1,
    litrosFinalT2,
    medicaoInicial,
    saldoAnterior,
    saldoFinal,
    entradaDiesel,
    entradaRecebimentos,
    medicaoD1,
    medicaoAtual,
    saidaTanque,
    pumpDetails,
    saidaTotalBombas,
    saidaTransnet,
    receiptBeforeT1,
    receiptBeforeT2,
    receiptAfterT1,
    receiptAfterT2,
    receiptMeasuredLiters: inlineReceiptMeasuredLiters,
    receiptToleranceLiters,
    receiptWithinTolerance,
    diffRecebimento,
    pctDiffNF,
    pctDiffTransnet,
    pctDiffTankBombas,
    diffTanqueTransnet,
    diffBombasTransnet,
    diffTanqueBombas,
    receiptBelowExpected,
  };
}

export function validateMeasurement(form, computed, params) {
  const errors = {};
  const warnings = [];
  const product = form?.product || "S500";
  const requiresT1 = product === "S10";
  const requiresT2 = product === "S500";
  const receiptBeforeField = getRelevantRuleField(product, "before");
  const receiptAfterField = getRelevantRuleField(product, "after");

  if (!form.date) {
    errors.date = "Informe a data do lancamento.";
  }

  if (requiresT1 && parseNumber(form.reguaFinalT1) === null) {
    errors.reguaFinal = "Para S10, informe obrigatoriamente a regua atual T1.";
  }

  if (requiresT2 && parseNumber(form.reguaFinalT2) === null) {
    errors.reguaFinal = "Para S500, informe obrigatoriamente a regua atual T2.";
  }

  if (form.transnetOutput === "" || form.transnetOutput === null || form.transnetOutput === undefined) {
    warnings.push("Saida Transnet ainda nao foi informada.");
  }

  if (form.hasReceipt) {
    if ((parseNumber(form.nfVolumeLitros) || 0) <= 0) {
      errors.nfVolumeLitros = "Informe o volume da NF quando houver recebimento.";
    }
    if (!String(form.supplier || "").trim()) {
      errors.supplier = "Selecione o fornecedor quando houver recebimento.";
    }
    if (parseNumber(form[receiptBeforeField]) === null) {
      errors.receiptBefore = `Informe a regua antes do recebimento para ${product === "S500" ? "T2" : "T1"}.`;
    }
    if (parseNumber(form[receiptAfterField]) === null) {
      errors.receiptAfter = `Informe a regua depois do recebimento para ${product === "S500" ? "T2" : "T1"}.`;
    }
  }

  (form.pumps || []).forEach((pump) => {
    const initial = parseNumber(pump.initial);
    const final = parseNumber(pump.final);

    if (final === null) {
      errors[`pump_${pump.number}`] = `Informe o encerrante atual da bomba ${pump.number}.`;
    }

    if (initial !== null && final !== null && final < initial) {
      errors[`pump_${pump.number}`] = `Bomba ${pump.number}: encerrante atual nao pode ser menor que o hodometro inicial configurado.`;
    }
  });

  ["reguaAnteriorT1", "reguaAnteriorT2", "reguaFinalT1", "reguaFinalT2"].forEach((field) => {
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

  if (form.hasReceipt && computed?.receiptBelowExpected && computed?.receiptWithinTolerance === false) {
    warnings.push("Recebimento abaixo do esperado e fora da tolerancia da faixa da NF.");
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

  if (!form.date) errors.date = "Informe a data do recebimento.";
  if (!form.product) errors.product = "Informe o produto.";
  if (!parseNumber(form.nfVolumeLitros)) errors.nfVolumeLitros = "Informe o volume da NF.";
  if (parseNumber(form.reguaAntesCm) === null) errors.reguaAntesCm = "Informe a regua antes do recebimento.";
  if (parseNumber(form.reguaDepoisCm) === null) errors.reguaDepoisCm = "Informe a regua depois do recebimento.";

  if (computed?.volumeRecebidoLitros !== null && computed?.volumeRecebidoLitros < 0) {
    errors.volumeRecebidoLitros = "Volume recebido ficou negativo. Confira as reguas.";
  }

  const status = receiptStatus(computed, params);
  if (status.label === "Atencao") warnings.push("Recebimento fora da faixa de atencao.");
  if (status.label === "Critico") warnings.push("Recebimento fora da faixa critica.");

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

  if (nfCritical || transnetCritical) return { tone: "rose", label: "Critico" };
  if (nfWarn || transnetWarn) return { tone: "amber", label: "Atencao" };
  return { tone: "emerald", label: "OK" };
}

async function resolveSupplierId(form, metadata) {
  let supplierId = form.supplierId || null;
  const supplierName = String(form.supplier || "").trim();

  if (!supplierId && supplierName) {
    const existingSupplier = Object.values(metadata?.suppliersById || {}).find(
      (supplier) => normalizeSupplierName(supplier.nome) === normalizeSupplierName(supplierName)
    );

    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      const { data: newSupplier, error: supplierError } = await supabase
        .from("estoque_diesel_fornecedores")
        .insert({ nome: supplierName, ativo: true })
        .select("id, nome")
        .single();

      if (supplierError) throw supplierError;

      supplierId = newSupplier.id;
      if (metadata?.suppliersById) metadata.suppliersById[newSupplier.id] = newSupplier;
    }
  }

  return supplierId;
}

async function uploadReceiptPhoto(file, product, date, kind) {
  if (!file) return null;

  const extension = file.name?.split(".").pop() || "jpg";
  const safeName = sanitizeFileName(file.name || `${kind}.${extension}`);
  const path = `recebimentos/${product}/${date}/${Date.now()}-${kind}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("estoque-diesel")
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadError) throw uploadError;
  return supabase.storage.from("estoque-diesel").getPublicUrl(path).data.publicUrl;
}

export async function saveMeasurementEntry({
  form,
  computed,
  product,
  params,
  metadata,
  userId = null,
  receiptFiles = {},
}) {
  const tank = getTankByProduct(metadata, product);
  if (!tank?.id) throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);

  const supplierId = await resolveSupplierId(form, metadata);
  const receiptPhotoBeforeUrl =
    (await uploadReceiptPhoto(receiptFiles.before, product, form.date, "antes")) ||
    form.receiptPhotoBeforeUrl ||
    null;
  const receiptPhotoAfterUrl =
    (await uploadReceiptPhoto(receiptFiles.after, product, form.date, "depois")) ||
    form.receiptPhotoAfterUrl ||
    null;

  const payload = {
    tanque_id: tank.id,
    data_medicao: form.date,
    regua_anterior_t1: computed.reguaAnteriorT1,
    regua_anterior_t2: computed.reguaAnteriorT2,
    regua_final_t1: parseNumber(form.reguaFinalT1),
    regua_final_t2: parseNumber(form.reguaFinalT2),
    nf_volume_litros: parseNumber(form.nfVolumeLitros) || 0,
    fornecedor_id: supplierId,
    nf_numero: form.nfNumero || null,
    houve_recebimento: form.hasReceipt === true,
    regua_recebimento_antes_t1: form.hasReceipt ? parseNumber(form.receiptRuleBeforeT1) : null,
    regua_recebimento_antes_t2: form.hasReceipt ? parseNumber(form.receiptRuleBeforeT2) : null,
    regua_recebimento_depois_t1: form.hasReceipt ? parseNumber(form.receiptRuleAfterT1) : null,
    regua_recebimento_depois_t2: form.hasReceipt ? parseNumber(form.receiptRuleAfterT2) : null,
    foto_regua_antes_url: receiptPhotoBeforeUrl,
    foto_regua_depois_url: receiptPhotoAfterUrl,
    recebimento_litros_calculado: computed.receiptMeasuredLiters,
    recebimento_tolerancia_litros: computed.receiptToleranceLiters,
    recebimento_dentro_tolerancia: computed.receiptWithinTolerance,
    saida_transnet: parseNumber(form.transnetOutput),
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
    status_lancamento: measurementStatus(computed, params).label,
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
    .filter((pump) => getRequiredPumpNumbers(product).includes(Number(pump.numero)))
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));

  const pumpPayload = dbPumps.map((pump) => {
    const computedPump = (computed?.pumpDetails || []).find(
      (item) => Number(item.number) === Number(pump.numero)
    );

    return {
      medicao_id: savedMeasurement.id,
      bomba_id: pump.id,
      hodometro_inicial: parseNumber(computedPump?.initial) || 0,
      hodometro_final: parseNumber(computedPump?.final) || 0,
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

export async function savePumpInitialAdjustment({
  metadata,
  product,
  pumpNumber,
  date,
  initial,
  observation = "",
  userId = null,
}) {
  const dbPump = (metadata?.pumpsByProduct?.[product] || []).find(
    (pump) => Number(pump.numero) === Number(pumpNumber)
  );

  if (!dbPump?.id) {
    throw new Error(`Bomba ${pumpNumber} de ${product} nao encontrada no Supabase.`);
  }

  const payload = {
    bomba_id: dbPump.id,
    data_referencia: date,
    hodometro_inicial: parseNumber(initial) || 0,
    observacao: String(observation || "").trim() || null,
    ativo: true,
    atualizado_em: new Date().toISOString(),
    usuario_id: Number.isInteger(userId) ? userId : null,
  };

  const { data, error } = await supabase
    .from("estoque_diesel_ajustes_hodometro_inicial")
    .upsert(payload, { onConflict: "bomba_id,data_referencia" })
    .select("id, bomba_id, data_referencia, hodometro_inicial, observacao, atualizado_em, usuario_id")
    .single();

  if (error) throw error;
  return data;
}

export async function deletePumpInitialAdjustment({
  metadata,
  product,
  pumpNumber,
  date,
}) {
  const dbPump = (metadata?.pumpsByProduct?.[product] || []).find(
    (pump) => Number(pump.numero) === Number(pumpNumber)
  );

  if (!dbPump?.id) {
    throw new Error(`Bomba ${pumpNumber} de ${product} nao encontrada no Supabase.`);
  }

  const { error } = await supabase
    .from("estoque_diesel_ajustes_hodometro_inicial")
    .delete()
    .eq("bomba_id", dbPump.id)
    .eq("data_referencia", date);

  if (error) throw error;
}

export async function saveDieselReceipt({
  receiptId = null,
  form,
  computed,
  product,
  params,
  metadata,
  userId = null,
  receiptFiles = {},
}) {
  const tank = getTankByProduct(metadata, product);
  if (!tank?.id) throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);

  const supplierId = await resolveSupplierId(form, metadata);
  const relevantBeforeField = getRelevantRuleField(product, "before");
  const relevantAfterField = getRelevantRuleField(product, "after");
  const [fotoAntesUrl, fotoDepoisUrl] = await Promise.all([
    uploadReceiptPhoto(receiptFiles.before || form.fotoAntesFile, product, form.date, "antes"),
    uploadReceiptPhoto(receiptFiles.after || form.fotoDepoisFile, product, form.date, "depois"),
  ]);

  const payload = {
    tanque_id: tank.id,
    data_recebimento: form.date,
    tipo_diesel: product,
    fornecedor_id: supplierId,
    fornecedor_nome: form.supplier || null,
    nf_numero: form.nfNumero || null,
    nf_volume_litros: parseNumber(form.nfVolumeLitros) || 0,
    valor_unitario: parseNumber(form.unitPrice),
    valor_total:
      parseNumber(form.unitPrice) !== null
        ? round((parseNumber(form.unitPrice) || 0) * (parseNumber(form.nfVolumeLitros) || 0), 2)
        : null,
    regua_antes_cm: parseNumber(form[relevantBeforeField]),
    regua_depois_cm: parseNumber(form[relevantAfterField]),
    litros_antes:
      product === "S500" ? computed.receiptBeforeT2 : computed.receiptBeforeT1,
    litros_depois:
      product === "S500" ? computed.receiptAfterT2 : computed.receiptAfterT1,
    volume_recebido_litros: computed.receiptMeasuredLiters,
    diff_recebimento_litros: computed.diffRecebimento,
    pct_diff_recebimento: computed.pctDiffNF,
    status_recebimento: receiptStatus(computed, params).label,
    foto_antes_url: fotoAntesUrl,
    foto_depois_url: fotoDepoisUrl,
    observacao: form.observation || null,
    usuario_id: Number.isInteger(userId) ? userId : null,
    atualizado_em: new Date().toISOString(),
  };

  const query = receiptId
    ? supabase
        .from("estoque_diesel_recebimentos")
        .update(payload)
        .eq("id", receiptId)
        .select("id")
        .single()
    : supabase
        .from("estoque_diesel_recebimentos")
        .insert(payload)
        .select("id")
        .single();

  const { data, error } = await query;

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
    if (!tank?.id) continue;

    tanksPayload.push({
      id: tank.id,
      diametro_m: parseNumber(current.diameterM) || DEFAULT_PARAMS[product].diameterM,
      comprimento_m: parseNumber(current.lengthM) || DEFAULT_PARAMS[product].lengthM,
      ativo: true,
    });

    paramsPayload.push({
      tanque_id: tank.id,
      regua_max_cm: parseNumber(current.maxRuleCm) || DEFAULT_PARAMS[product].maxRuleCm,
      pct_diff_nf_alerta: parseNumber(current.nfDiffWarnPct) || DEFAULT_PARAMS[product].nfDiffWarnPct,
      pct_diff_nf_critico: parseNumber(current.nfDiffCriticalPct) || DEFAULT_PARAMS[product].nfDiffCriticalPct,
      pct_diff_transnet_alerta: parseNumber(current.transnetWarnPct) || DEFAULT_PARAMS[product].transnetWarnPct,
      pct_diff_transnet_critico: parseNumber(current.transnetCriticalPct) || DEFAULT_PARAMS[product].transnetCriticalPct,
      ativo: true,
      atualizado_em: new Date().toISOString(),
    });

    for (const row of normalizeToleranceRows(current.toleranceRows)) {
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
    reguaAnteriorT1: computed.reguaAnteriorT1,
    reguaAnteriorT2: computed.reguaAnteriorT2,
    reguaFinalT1: parseNumber(form.reguaFinalT1),
    reguaFinalT2: parseNumber(form.reguaFinalT2),
    transnetOutput: parseNumber(form.transnetOutput) || 0,
    pumps: computed.pumpDetails,
    status: measurementStatus(computed, params).label,
    ...computed,
    createdAt: new Date().toISOString(),
  };
}
