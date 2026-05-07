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
    pumpNumbers: [2, 3],
    usesTransnet: true,
    monthSheetPattern: "Medicao Combustivel S500",
  },
  S10: {
    code: "S10",
    label: "Diesel S10",
    pumpNumbers: [1],
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
    pumpWarnPct: 0.02,
    pumpCriticalPct: 0.03,
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
    pumpWarnPct: 0.02,
    pumpCriticalPct: 0.03,
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

export const RECEIPT_BUCKET = "estoque-diesel";

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
}

function todayISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60000);
  return localDate.toISOString().slice(0, 10);
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

function getAllowedPumpNumbers(product) {
  return PRODUCT_CONFIG[product]?.pumpNumbers || [];
}

function pickAllowedPumps(product, pumps = []) {
  const allowed = getAllowedPumpNumbers(product);
  return [...pumps]
    .filter((pump) => allowed.includes(Number(pump.numero ?? pump.number)))
    .sort((a, b) => Number(a.numero ?? a.number) - Number(b.numero ?? b.number));
}

function buildStatusLabel(entryLike, params) {
  if (entryLike?.status && ["OK", "Atencao", "Critico"].includes(entryLike.status)) return entryLike.status;
  return measurementStatus(entryLike, params).label;
}

function mapMeasurementRowToEntry(row, metadata, paramStore, pumpRows = []) {
  const tank = metadata.tanksById[row.tanque_id];
  const product = tank?.tipo_diesel || "S500";
  const params = paramStore[product] || DEFAULT_PARAMS[product];

  const sortedPumps = pumpRows
    .map((pump) => ({
      id: pump.bomba_id,
      number: metadata.pumpsById[pump.bomba_id]?.numero || 0,
      initial: pump.hodometro_inicial ?? 0,
      final: pump.hodometro_final ?? 0,
      output: pump.saida_bomba ?? round((pump.hodometro_final || 0) - (pump.hodometro_inicial || 0), 2),
    }))
    .filter((pump) => getAllowedPumpNumbers(product).includes(Number(pump.number)))
    .sort((a, b) => a.number - b.number);

  const entry = {
    id: row.id,
    product,
    date: row.data_medicao,
    supplier: metadata.suppliersById[row.fornecedor_id]?.nome || "",
    supplierId: row.fornecedor_id ?? null,
    nfNumero: row.nf_numero || "",
    nfVolumeLitros: row.nf_volume_litros ?? 0,
    observation: row.observacao || "",
    reguaAtualT1: row.regua_final_t1,
    reguaAtualT2: row.regua_final_t2,
    transnetOutput: row.saida_transnet ?? 0,
    pumps: sortedPumps,
    litrosAtualT1: row.litros_final_t1,
    litrosAtualT2: row.litros_final_t2,
    saldoAnterior: row.saldo_anterior,
    saldoFinal: row.saldo_final,
    entradaDiesel: row.entrada_diesel,
    medicaoD1: row.medicao_d1,
    medicaoAtual: row.medicao_atual,
    saidaTanque: row.saida_tanque,
    saidaTotalBombas: row.saida_total_bombas,
    saidaTransnet: row.saida_transnet ?? 0,
    diffRecebimento: row.diff_recebimento,
    pctDiffNF: row.pct_diff_nf,
    pctDiffTransnet: row.pct_diff_transnet,
    diffTanqueTransnet: row.saida_transnet != null && row.saida_tanque != null ? round(Number(row.saida_transnet) - Number(row.saida_tanque), 2) : null,
    diffBombasTransnet: row.saida_transnet != null && row.saida_total_bombas != null ? round(Number(row.saida_transnet) - Number(row.saida_total_bombas), 2) : null,
    diffTanqueBombas: row.saida_tanque != null && row.saida_total_bombas != null ? round(Number(row.saida_tanque) - Number(row.saida_total_bombas), 2) : null,
    status: row.status_lancamento,
    createdAt: row.criado_em,
  };

  entry.status = buildStatusLabel(entry, params);
  return entry;
}

function mapReceiptRow(row, metadata, paramStore) {
  const tank = metadata.tanksById[row.tanque_id];
  const product = tank?.tipo_diesel || row.tipo_diesel || "S500";
  const params = paramStore[product] || DEFAULT_PARAMS[product];
  const receipt = {
    id: row.id,
    product,
    date: row.data_recebimento,
    supplier: metadata.suppliersById[row.fornecedor_id]?.nome || "",
    supplierId: row.fornecedor_id ?? null,
    nfNumero: row.nf_numero || "",
    nfVolumeLitros: row.nf_volume_litros ?? 0,
    reguaAntesCm: row.regua_antes_cm,
    reguaDepoisCm: row.regua_depois_cm,
    litrosAntes: row.litros_antes,
    litrosDepois: row.litros_depois,
    volumeRecebido: row.volume_recebido,
    diffRecebimento: row.diff_recebimento,
    pctDiffNF: row.pct_diff_nf,
    fotoAntesUrl: row.foto_antes_url || "",
    fotoDepoisUrl: row.foto_depois_url || "",
    observation: row.observacao || "",
    status: row.status_recebimento || receiptStatus({ pctDiffNF: row.pct_diff_nf }, params).label,
    createdAt: row.criado_em,
  };
  return receipt;
}

export function getTodayISO() {
  return todayISO();
}

export function getDefaultDateForMonth(year, month) {
  const today = todayISO();
  if (today.startsWith(`${year}-${month}`)) return today;
  return today;
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

export async function fetchMeasurementContext() {
  const [tanksResponse, paramsResponse, tolerancesResponse, suppliersResponse, pumpsResponse] = await Promise.all([
    supabase
      .from("estoque_diesel_tanques")
      .select("id, nome, tipo_diesel, diametro_m, raio_m, comprimento_m, capacidade_max_litros")
      .eq("ativo", true),
    supabase
      .from("estoque_diesel_parametros")
      .select("tanque_id, regua_max_cm, pct_diff_nf_alerta, pct_diff_nf_critico, pct_diff_transnet_alerta, pct_diff_transnet_critico")
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

  for (const response of [tanksResponse, paramsResponse, tolerancesResponse, suppliersResponse, pumpsResponse]) {
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

  const paramsByTankId = Object.fromEntries((paramsResponse.data || []).map((row) => [row.tanque_id, row]));

  for (const supplier of suppliersResponse.data || []) metadata.suppliersById[supplier.id] = supplier;

  for (const tank of tanksResponse.data || []) {
    metadata.tanksByProduct[tank.tipo_diesel] = tank;
    metadata.tanksById[tank.id] = tank;
    const productParams = {
      ...(paramStore[tank.tipo_diesel] || cloneDefaults()[tank.tipo_diesel]),
      diameterM: Number(tank.diametro_m || paramStore[tank.tipo_diesel]?.diameterM || DEFAULT_PARAMS[tank.tipo_diesel].diameterM),
      lengthM: Number(tank.comprimento_m || paramStore[tank.tipo_diesel]?.lengthM || DEFAULT_PARAMS[tank.tipo_diesel].lengthM),
      radiusM: Number(tank.raio_m || 0),
    };

    const dbParam = paramsByTankId[tank.id];
    if (dbParam) {
      productParams.maxRuleCm = Number(dbParam.regua_max_cm ?? productParams.maxRuleCm);
      productParams.nfDiffWarnPct = Number(dbParam.pct_diff_nf_alerta ?? productParams.nfDiffWarnPct);
      productParams.nfDiffCriticalPct = Number(dbParam.pct_diff_nf_critico ?? productParams.nfDiffCriticalPct);
      productParams.transnetWarnPct = Number(dbParam.pct_diff_transnet_alerta ?? productParams.transnetWarnPct);
      productParams.transnetCriticalPct = Number(dbParam.pct_diff_transnet_critico ?? productParams.transnetCriticalPct);
    }
    paramStore[tank.tipo_diesel] = productParams;
  }

  const suppliers = (suppliersResponse.data || []).map((supplier) => supplier.nome);
  Object.keys(paramStore).forEach((product) => {
    paramStore[product].suppliers = suppliers;
  });

  const toleranceRowsByProduct = {};
  for (const row of tolerancesResponse.data || []) {
    if (!toleranceRowsByProduct[row.tipo_diesel]) toleranceRowsByProduct[row.tipo_diesel] = [];
    toleranceRowsByProduct[row.tipo_diesel].push({
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
    if (!metadata.pumpsByProduct[tank.tipo_diesel]) metadata.pumpsByProduct[tank.tipo_diesel] = [];
    metadata.pumpsByProduct[tank.tipo_diesel].push(pump);
  }

  Object.keys(metadata.pumpsByProduct).forEach((product) => {
    metadata.pumpsByProduct[product] = pickAllowedPumps(product, metadata.pumpsByProduct[product]);
  });

  return { metadata, paramStore };
}

export async function fetchMeasurementEntries({ year = "2026", product = null, metadata, paramStore = DEFAULT_PARAMS, includePumps = true }) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  let query = supabase
    .from("estoque_diesel_medicoes_diarias")
    .select("id, tanque_id, data_medicao, regua_anterior_t1, regua_anterior_t2, regua_final_t1, regua_final_t2, nf_volume_litros, fornecedor_id, nf_numero, saida_transnet, litros_anterior_t1, litros_anterior_t2, litros_final_t1, litros_final_t2, saldo_anterior, saldo_final, entrada_diesel, medicao_d1, medicao_atual, saida_tanque, diff_recebimento, pct_diff_nf, pct_diff_transnet, saida_total_bombas, status_lancamento, observacao, criado_em")
    .gte("data_medicao", from)
    .lte("data_medicao", to)
    .order("data_medicao", { ascending: true });

  if (product && metadata?.tanksByProduct?.[product]?.id) query = query.eq("tanque_id", metadata.tanksByProduct[product].id);
  else if (product) return [];

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

  return (rows || []).map((row) => mapMeasurementRowToEntry(row, metadata, paramStore, pumpRowsByMeasurement[row.id] || []));
}

export async function fetchDieselReceipts({ year = "2026", product = null, metadata, paramStore = DEFAULT_PARAMS }) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  let query = supabase
    .from("estoque_diesel_recebimentos")
    .select("id, tanque_id, data_recebimento, fornecedor_id, nf_numero, nf_volume_litros, regua_antes_cm, regua_depois_cm, litros_antes, litros_depois, volume_recebido, diff_recebimento, pct_diff_nf, foto_antes_url, foto_depois_url, status_recebimento, observacao, criado_em")
    .gte("data_recebimento", from)
    .lte("data_recebimento", to)
    .order("data_recebimento", { ascending: true });

  if (product && metadata?.tanksByProduct?.[product]?.id) query = query.eq("tanque_id", metadata.tanksByProduct[product].id);
  else if (product) return [];

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => mapReceiptRow(row, metadata, paramStore));
}

export function getPreviousEntry(entries, product, currentDate, currentId = null) {
  const current = new Date(`${currentDate}T00:00:00`);
  return [...entries]
    .filter((entry) => entry.product === product && entry.date && entry.id !== currentId)
    .filter((entry) => new Date(`${entry.date}T00:00:00`) < current)
    .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`))[0] || null;
}

export function getDailyReceipts(receipts, product, date) {
  return (receipts || []).filter((item) => item.product === product && item.date === date);
}

export function sumDailyReceipts(receipts, product, date) {
  return round(getDailyReceipts(receipts, product, date).reduce((sum, item) => sum + (Number(item.volumeRecebido ?? item.nfVolumeLitros) || 0), 0), 2) || 0;
}

export function buildDefaultForm(product, year, month) {
  const date = getDefaultDateForMonth(year, month);
  const pumps = (PRODUCT_CONFIG[product]?.pumpNumbers || []).map((number) => ({ number, initial: "", final: "" }));
  return {
    id: null,
    product,
    date,
    reguaAtualT1: "",
    reguaAtualT2: "",
    transnetOutput: "",
    observation: "",
    pumps,
  };
}

export function buildDefaultReceiptForm(product) {
  return {
    id: null,
    product,
    date: todayISO(),
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
  const volume = (r * r * Math.acos(1 - h / r) - Math.sqrt(Math.max(0, 2 * r * h - h * h)) * (r - h)) * 1000 * l;
  return round(volume, 0);
}

function getRadius(params) {
  return parseNumber(params.diameterM) ? parseNumber(params.diameterM) / 2 : parseNumber(params.radiusM);
}

function getPreviousPumpFinal(previousEntry, pumpNumber) {
  const previousPump = previousEntry?.pumps?.find((pump) => Number(pump.number) === Number(pumpNumber));
  return previousPump?.final ?? "";
}

export function computeMeasurement(form, params, previousEntry, dailyReceipts = []) {
  const radius = getRadius(params);
  const length = parseNumber(params.lengthM);

  const litrosAtualT1 = calculateVolumeLiters(form.reguaAtualT1, radius, length);
  const litrosAtualT2 = calculateVolumeLiters(form.reguaAtualT2, radius, length);
  const medicaoD1 = previousEntry?.saldoFinal ?? previousEntry?.medicaoAtual ?? 0;
  const entradaDiesel = round(dailyReceipts.reduce((sum, item) => sum + (Number(item.volumeRecebido ?? item.nfVolumeLitros) || 0), 0), 2) || 0;
  const medicaoAtual = round((litrosAtualT1 || 0) + (litrosAtualT2 || 0), 2);
  const saldoAnterior = medicaoD1;
  const saldoFinal = medicaoAtual;
  const saidaTanque = medicaoAtual !== null ? round((medicaoD1 || 0) + entradaDiesel - medicaoAtual, 2) : null;

  const pumpDetails = form.pumps.map((pump) => {
    const initial = parseNumber(pump.initial) ?? parseNumber(getPreviousPumpFinal(previousEntry, pump.number)) ?? 0;
    const final = parseNumber(pump.final) || 0;
    return { ...pump, initial, final, output: round(final - initial, 2) };
  });

  const saidaTotalBombas = round(pumpDetails.reduce((sum, pump) => sum + (pump.output || 0), 0), 2);
  const saidaTransnet = parseNumber(form.transnetOutput) || 0;
  const diffTanqueTransnet = saidaTanque !== null ? round(saidaTransnet - saidaTanque, 2) : null;
  const diffBombasTransnet = saidaTotalBombas !== null ? round(saidaTransnet - saidaTotalBombas, 2) : null;
  const diffTanqueBombas = saidaTanque !== null && saidaTotalBombas !== null ? round(saidaTanque - saidaTotalBombas, 2) : null;
  const pctDiffTransnet = saidaTanque && saidaTanque !== 0 ? round(diffTanqueTransnet / saidaTanque, 4) : null;
  const pctDiffBombas = saidaTotalBombas && saidaTotalBombas !== 0 ? round(diffBombasTransnet / saidaTotalBombas, 4) : null;

  return {
    litrosAtualT1,
    litrosAtualT2,
    litrosFinalT1: litrosAtualT1,
    litrosFinalT2: litrosAtualT2,
    saldoAnterior,
    saldoFinal,
    entradaDiesel,
    medicaoD1,
    medicaoAtual,
    saidaTanque,
    pumpDetails,
    saidaTotalBombas,
    saidaTransnet,
    diffTanqueTransnet,
    diffBombasTransnet,
    diffTanqueBombas,
    pctDiffTransnet,
    pctDiffBombas,
    diffRecebimento: null,
    pctDiffNF: null,
  };
}

export function computeReceipt(receiptForm, params) {
  const radius = getRadius(params);
  const length = parseNumber(params.lengthM);
  const litrosAntes = calculateVolumeLiters(receiptForm.reguaAntesCm, radius, length);
  const litrosDepois = calculateVolumeLiters(receiptForm.reguaDepoisCm, radius, length);
  const nfVolumeLitros = parseNumber(receiptForm.nfVolumeLitros) || 0;
  const volumeRecebido = litrosDepois !== null && litrosAntes !== null ? round(litrosDepois - litrosAntes, 2) : null;
  const diffRecebimento = volumeRecebido !== null ? round(volumeRecebido - nfVolumeLitros, 2) : null;
  const pctDiffNF = nfVolumeLitros > 0 && diffRecebimento !== null ? round(diffRecebimento / nfVolumeLitros, 4) : null;
  return { litrosAntes, litrosDepois, nfVolumeLitros, volumeRecebido, diffRecebimento, pctDiffNF };
}

export function validateMeasurement(form, computed, params) {
  const errors = {};
  const warnings = [];
  if (parseNumber(form.reguaAtualT1) === null && parseNumber(form.reguaAtualT2) === null) {
    errors.reguaAtual = "Informe a medicao atual do tanque.";
  }
  form.pumps.forEach((pump) => {
    const initial = parseNumber(pump.initial);
    const final = parseNumber(pump.final);
    if (final === null) errors[`pump_${pump.number}`] = `Bomba ${pump.number}: informe o encerrante atual.`;
    if (initial !== null && final !== null && final < initial) errors[`pump_${pump.number}`] = `Bomba ${pump.number}: encerrante atual nao pode ser menor que o D-1.`;
  });
  ["reguaAtualT1", "reguaAtualT2"].forEach((field) => {
    const value = parseNumber(form[field]);
    if (value !== null && params.maxRuleCm && value > params.maxRuleCm) warnings.push(`${field} acima do limite fisico do tanque.`);
  });
  if (computed.pctDiffTransnet !== null && Math.abs(computed.pctDiffTransnet) > (params.transnetWarnPct || 0.02)) warnings.push("Diferenca tanque x Transnet acima da faixa de atencao.");
  if (computed.pctDiffBombas !== null && Math.abs(computed.pctDiffBombas) > (params.pumpWarnPct || 0.02)) warnings.push("Diferenca bombas x Transnet acima da faixa de atencao.");
  if ((computed.saldoFinal || 0) < 0) warnings.push("Saldo final negativo. Revise as medicoes.");
  return { errors, warnings };
}

export function validateReceipt(form, computed, params) {
  const errors = {};
  const warnings = [];
  if (!form.date) errors.date = "Informe a data do recebimento.";
  if ((parseNumber(form.nfVolumeLitros) || 0) <= 0) errors.nfVolumeLitros = "Informe o volume da NF.";
  if (parseNumber(form.reguaAntesCm) === null) errors.reguaAntesCm = "Informe a regua antes do recebimento.";
  if (parseNumber(form.reguaDepoisCm) === null) errors.reguaDepoisCm = "Informe a regua depois do recebimento.";
  if (!form.fotoAntesFile) errors.fotoAntesFile = "Anexe a foto da regua antes.";
  if (!form.fotoDepoisFile) errors.fotoDepoisFile = "Anexe a foto da regua depois.";
  if (computed.volumeRecebido !== null && computed.volumeRecebido < 0) errors.volumeRecebido = "Volume recebido negativo. Revise as reguas.";
  if (computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffWarnPct || 0.01)) warnings.push("Recebimento fora da faixa de atencao contra a NF.");
  return { errors, warnings };
}

export function measurementStatus(computed, params) {
  const transnetCritical = computed.pctDiffTransnet !== null && Math.abs(computed.pctDiffTransnet) > (params.transnetCriticalPct || 0.03);
  const pumpCritical = computed.pctDiffBombas !== null && Math.abs(computed.pctDiffBombas) > (params.pumpCriticalPct || 0.03);
  const transnetWarn = computed.pctDiffTransnet !== null && Math.abs(computed.pctDiffTransnet) > (params.transnetWarnPct || 0.02);
  const pumpWarn = computed.pctDiffBombas !== null && Math.abs(computed.pctDiffBombas) > (params.pumpWarnPct || 0.02);
  if (transnetCritical || pumpCritical) return { tone: "rose", label: "Critico" };
  if (transnetWarn || pumpWarn) return { tone: "amber", label: "Atencao" };
  return { tone: "emerald", label: "OK" };
}

export function receiptStatus(computed, params) {
  const critical = computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffCriticalPct || 0.03);
  const warn = computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffWarnPct || 0.01);
  if (critical) return { tone: "rose", label: "Critico" };
  if (warn) return { tone: "amber", label: "Atencao" };
  return { tone: "emerald", label: "OK" };
}

async function resolveSupplierId(form, metadata) {
  let supplierId = form.supplierId || null;
  if (!supplierId && form.supplier) {
    const existingSupplier = Object.values(metadata.suppliersById || {}).find((supplier) => supplier.nome === form.supplier);
    if (existingSupplier) supplierId = existingSupplier.id;
    else {
      const { data: newSupplier, error: supplierError } = await supabase
        .from("estoque_diesel_fornecedores")
        .insert({ nome: form.supplier, ativo: true })
        .select("id, nome")
        .single();
      if (supplierError) throw supplierError;
      supplierId = newSupplier.id;
      metadata.suppliersById[newSupplier.id] = newSupplier;
    }
  }
  return supplierId;
}

async function uploadReceiptFile(file, product, date, suffix) {
  if (!file) return null;
  const extension = file.name?.split(".").pop() || "jpg";
  const safeName = `${Date.now()}-${suffix}.${extension}`;
  const path = `recebimentos/${product}/${date}/${safeName}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path);
  return data?.publicUrl || path;
}

export async function saveDieselReceipt({ form, computed, product, params, metadata, userId = null }) {
  const tank = metadata?.tanksByProduct?.[product];
  if (!tank?.id) throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);
  const supplierId = await resolveSupplierId(form, metadata);
  const fotoAntesUrl = await uploadReceiptFile(form.fotoAntesFile, product, form.date, "antes");
  const fotoDepoisUrl = await uploadReceiptFile(form.fotoDepoisFile, product, form.date, "depois");
  const status = receiptStatus(computed, params).label;
  const payload = {
    tanque_id: tank.id,
    data_recebimento: form.date,
    fornecedor_id: supplierId,
    nf_numero: form.nfNumero || null,
    nf_volume_litros: parseNumber(form.nfVolumeLitros) || 0,
    regua_antes_cm: parseNumber(form.reguaAntesCm),
    regua_depois_cm: parseNumber(form.reguaDepoisCm),
    litros_antes: computed.litrosAntes,
    litros_depois: computed.litrosDepois,
    volume_recebido: computed.volumeRecebido,
    diff_recebimento: computed.diffRecebimento,
    pct_diff_nf: computed.pctDiffNF,
    foto_antes_url: fotoAntesUrl,
    foto_depois_url: fotoDepoisUrl,
    status_recebimento: status,
    observacao: form.observation || null,
    usuario_id: Number.isInteger(userId) ? userId : null,
    atualizado_em: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("estoque_diesel_recebimentos").insert(payload).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function saveMeasurementEntry({ form, computed, product, params, metadata, userId = null }) {
  const tank = metadata?.tanksByProduct?.[product];
  if (!tank?.id) throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);
  const payload = {
    tanque_id: tank.id,
    data_medicao: form.date,
    regua_anterior_t1: null,
    regua_anterior_t2: null,
    regua_final_t1: parseNumber(form.reguaAtualT1),
    regua_final_t2: parseNumber(form.reguaAtualT2),
    nf_volume_litros: computed.entradaDiesel || 0,
    fornecedor_id: null,
    nf_numero: null,
    saida_transnet: parseNumber(form.transnetOutput) || 0,
    litros_anterior_t1: null,
    litros_anterior_t2: null,
    litros_final_t1: computed.litrosAtualT1,
    litros_final_t2: computed.litrosAtualT2,
    saldo_anterior: computed.saldoAnterior,
    saldo_final: computed.saldoFinal,
    entrada_diesel: computed.entradaDiesel,
    medicao_d1: computed.medicaoD1,
    medicao_atual: computed.medicaoAtual,
    saida_tanque: computed.saidaTanque,
    diff_recebimento: null,
    pct_diff_nf: null,
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

  const dbPumps = pickAllowedPumps(product, metadata.pumpsByProduct?.[product] || []);
  const pumpPayload = dbPumps.map((pump) => {
    const currentPump = computed.pumpDetails.find((item) => Number(item.number) === Number(pump.numero));
    return {
      medicao_id: savedMeasurement.id,
      bomba_id: pump.id,
      hodometro_inicial: currentPump?.initial || 0,
      hodometro_final: currentPump?.final || 0,
    };
  });

  if (pumpPayload.length > 0) {
    const { error: pumpError } = await supabase.from("estoque_diesel_leituras_bomba").upsert(pumpPayload, { onConflict: "medicao_id,bomba_id" });
    if (pumpError) throw pumpError;
  }
  return savedMeasurement.id;
}

export async function saveMeasurementParams(paramStore, metadata) {
  const tanksPayload = [];
  const paramsPayload = [];
  const tolerancesPayload = [];
  for (const product of Object.keys(PRODUCT_CONFIG)) {
    const tank = metadata?.tanksByProduct?.[product];
    const current = paramStore[product] || DEFAULT_PARAMS[product];
    if (tank?.id) {
      tanksPayload.push({ id: tank.id, diametro_m: parseNumber(current.diameterM) || DEFAULT_PARAMS[product].diameterM, comprimento_m: parseNumber(current.lengthM) || DEFAULT_PARAMS[product].lengthM });
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
    }
    for (const row of normalizeToleranceRows(current.toleranceRows)) {
      tolerancesPayload.push({ tipo_diesel: product, volume_nf: row.nfVolume, pct_variacao_aceitavel: row.variationPct, diff_volume_aceitavel: row.acceptableDiffLiters, ativo: true });
    }
  }
  const { error: tanksError } = await supabase.from("estoque_diesel_tanques").upsert(tanksPayload, { onConflict: "id" });
  if (tanksError) throw tanksError;
  const { error: paramsError } = await supabase.from("estoque_diesel_parametros").upsert(paramsPayload, { onConflict: "tanque_id" });
  if (paramsError) throw paramsError;
  const { error: toleranceError } = await supabase.from("estoque_diesel_tolerancias_nf").upsert(tolerancesPayload, { onConflict: "tipo_diesel,volume_nf" });
  if (toleranceError) throw toleranceError;
}

export function serializeEntry(form, computed, params) {
  return { id: form.id || `${form.product}-${form.date}-${Date.now()}`, product: form.product, date: form.date, observation: form.observation, reguaAtualT1: parseNumber(form.reguaAtualT1), reguaAtualT2: parseNumber(form.reguaAtualT2), transnetOutput: parseNumber(form.transnetOutput) || 0, pumps: computed.pumpDetails, status: measurementStatus(computed, params).label, ...computed, createdAt: new Date().toISOString() };
}
