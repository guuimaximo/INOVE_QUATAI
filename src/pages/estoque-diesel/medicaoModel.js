import { supabase } from "../../supabase";

export const MONTHS_2026 = [
  { month: "01", label: "Janeiro" },
  { month: "02", label: "Fevereiro" },
  { month: "03", label: "Março" },
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
  },
  S10: {
    code: "S10",
    label: "Diesel S10",
    pumpNumbers: [1],
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
    suppliers: ["Ale", "Combustran", "Ipiranga", "Raizen", "Vibra"],
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
    suppliers: ["Ale", "Combustran", "Ipiranga", "Raizen", "Vibra"],
  },
};

export const RECEIPT_BUCKET = "estoque-diesel";

export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function round(value, decimals = 2) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(decimals));
}

export function todayISO() {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const yyyy = sp.getFullYear();
  const mm = String(sp.getMonth() + 1).padStart(2, "0");
  const dd = String(sp.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getMonthLabel(month) {
  return MONTHS_2026.find((item) => item.month === month)?.label || month;
}

export function getYearFromDate(date = todayISO()) {
  return String(date).slice(0, 4) || "2026";
}

export function getMonthFromDate(date = todayISO()) {
  return String(date).slice(5, 7) || "01";
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
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

export function calculateVolumeLiters(ruleCm, radiusM, lengthM) {
  const regua = parseNumber(ruleCm);
  const raio = parseNumber(radiusM);
  const comprimento = parseNumber(lengthM);

  if (regua === null || !raio || !comprimento) return null;
  if (regua <= 0) return 0;

  const h = regua / 100;
  const r = raio;
  const l = comprimento;

  if (h > 2 * r) return null;

  const volume =
    (r * r * Math.acos(1 - h / r) -
      Math.sqrt(Math.max(0, 2 * r * h - h * h)) * (r - h)) *
    1000 *
    l;

  return round(volume, 0);
}

function safeStatus(status) {
  if (["OK", "Atencao", "Critico"].includes(status)) return status;
  return null;
}

export function measurementStatus(computed, params) {
  const pctTransnet = computed?.pctDiffTransnet;
  const pctBombas = computed?.pctDiffBombas;

  const transnetCritical = pctTransnet !== null && pctTransnet !== undefined && Math.abs(pctTransnet) > (params.transnetCriticalPct || 0.03);
  const pumpCritical = pctBombas !== null && pctBombas !== undefined && Math.abs(pctBombas) > (params.pumpCriticalPct || 0.03);
  const transnetWarn = pctTransnet !== null && pctTransnet !== undefined && Math.abs(pctTransnet) > (params.transnetWarnPct || 0.02);
  const pumpWarn = pctBombas !== null && pctBombas !== undefined && Math.abs(pctBombas) > (params.pumpWarnPct || 0.02);

  if (transnetCritical || pumpCritical) return { tone: "rose", label: "Critico" };
  if (transnetWarn || pumpWarn) return { tone: "amber", label: "Atencao" };
  return { tone: "emerald", label: "OK" };
}

export function receiptStatus(computed, params) {
  const pct = computed?.pctDiffRecebimento;
  const critical = pct !== null && pct !== undefined && Math.abs(pct) > (params.nfDiffCriticalPct || 0.03);
  const warn = pct !== null && pct !== undefined && Math.abs(pct) > (params.nfDiffWarnPct || 0.01);

  if (critical) return { tone: "rose", label: "Critico" };
  if (warn) return { tone: "amber", label: "Atencao" };
  return { tone: "emerald", label: "OK" };
}

function mapMeasurementRowToEntry(row, metadata, paramStore, pumpRows = []) {
  const tank = metadata.tanksById[row.tanque_id];
  const product = tank?.tipo_diesel || "S500";
  const params = paramStore[product] || DEFAULT_PARAMS[product];

  const pumps = pumpRows
    .map((pump) => ({
      id: pump.bomba_id,
      number: metadata.pumpsById[pump.bomba_id]?.numero || 0,
      initial: Number(pump.hodometro_inicial || 0),
      final: Number(pump.hodometro_final || 0),
      output: pump.saida_bomba ?? round(Number(pump.hodometro_final || 0) - Number(pump.hodometro_inicial || 0), 2),
    }))
    .filter((pump) => getAllowedPumpNumbers(product).includes(Number(pump.number)))
    .sort((a, b) => a.number - b.number);

  const diffTanqueTransnet = row.saida_transnet != null && row.saida_tanque != null
    ? round(Number(row.saida_transnet) - Number(row.saida_tanque), 2)
    : null;

  const diffBombasTransnet = row.saida_transnet != null && row.saida_total_bombas != null
    ? round(Number(row.saida_transnet) - Number(row.saida_total_bombas), 2)
    : null;

  const diffTanqueBombas = row.saida_tanque != null && row.saida_total_bombas != null
    ? round(Number(row.saida_tanque) - Number(row.saida_total_bombas), 2)
    : null;

  const pctDiffTransnet = row.saida_tanque && Number(row.saida_tanque) !== 0
    ? round((Number(row.saida_transnet || 0) - Number(row.saida_tanque)) / Number(row.saida_tanque), 4)
    : row.pct_diff_transnet;

  const pctDiffBombas = row.saida_total_bombas && Number(row.saida_total_bombas) !== 0
    ? round((Number(row.saida_transnet || 0) - Number(row.saida_total_bombas)) / Number(row.saida_total_bombas), 4)
    : null;

  const entry = {
    id: row.id,
    product,
    date: row.data_medicao,
    reguaAtualT1: row.regua_final_t1,
    reguaAtualT2: row.regua_final_t2,
    litrosAtualT1: row.litros_final_t1,
    litrosAtualT2: row.litros_final_t2,
    medicaoD1: row.medicao_d1 ?? row.saldo_anterior,
    medicaoAtual: row.medicao_atual ?? row.saldo_final,
    saldoAnterior: row.saldo_anterior,
    saldoFinal: row.saldo_final,
    entradaDiesel: row.entrada_diesel ?? row.nf_volume_litros ?? 0,
    saidaTanque: row.saida_tanque,
    saidaTotalBombas: row.saida_total_bombas,
    saidaTransnet: row.saida_transnet ?? 0,
    transnetOutput: row.saida_transnet ?? 0,
    diffTanqueTransnet,
    diffBombasTransnet,
    diffTanqueBombas,
    pctDiffTransnet,
    pctDiffBombas,
    pumps,
    observation: row.observacao || "",
    rawStatus: row.status_lancamento,
    createdAt: row.criado_em,
  };

  entry.status = safeStatus(row.status_lancamento) || measurementStatus(entry, params).label;
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
    supplier: metadata.suppliersById[row.fornecedor_id]?.nome || row.fornecedor_nome || "",
    supplierId: row.fornecedor_id ?? null,
    nfNumero: row.nf_numero || "",
    nfVolumeLitros: row.nf_volume_litros ?? 0,
    reguaAntesCm: row.regua_antes_cm,
    reguaDepoisCm: row.regua_depois_cm,
    litrosAntes: row.litros_antes,
    litrosDepois: row.litros_depois,
    volumeRecebido: row.volume_recebido_litros ?? 0,
    diffRecebimento: row.diff_recebimento_litros,
    pctDiffRecebimento: row.pct_diff_recebimento,
    fotoAntesUrl: row.foto_antes_url || "",
    fotoDepoisUrl: row.foto_depois_url || "",
    observation: row.observacao || "",
    createdAt: row.criado_em,
  };

  receipt.status = safeStatus(row.status_recebimento) || receiptStatus(receipt, params).label;
  return receipt;
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
      .eq("ativo", true),
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

  for (const supplier of suppliersResponse.data || []) {
    metadata.suppliersById[supplier.id] = supplier;
  }

  for (const tank of tanksResponse.data || []) {
    metadata.tanksByProduct[tank.tipo_diesel] = tank;
    metadata.tanksById[tank.id] = tank;

    const productDefaults = paramStore[tank.tipo_diesel] || DEFAULT_PARAMS[tank.tipo_diesel] || DEFAULT_PARAMS.S500;
    const productParams = {
      ...productDefaults,
      diameterM: Number(tank.diametro_m || productDefaults.diameterM),
      lengthM: Number(tank.comprimento_m || productDefaults.lengthM),
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

  const supplierNames = (suppliersResponse.data || []).map((supplier) => supplier.nome);
  Object.keys(paramStore).forEach((product) => {
    paramStore[product].suppliers = supplierNames.length ? supplierNames : DEFAULT_PARAMS[product]?.suppliers || [];
  });

  for (const pump of pumpsResponse.data || []) {
    metadata.pumpsById[pump.id] = pump;
    const tank = metadata.tanksById[pump.tanque_id];
    if (!tank) continue;
    if (!metadata.pumpsByProduct[tank.tipo_diesel]) metadata.pumpsByProduct[tank.tipo_diesel] = [];
    metadata.pumpsByProduct[tank.tipo_diesel].push(pump);
  }

  Object.keys(PRODUCT_CONFIG).forEach((product) => {
    metadata.pumpsByProduct[product] = pickAllowedPumps(product, metadata.pumpsByProduct[product] || []);
  });

  return { metadata, paramStore };
}

export async function fetchMeasurementEntries({ year = "2026", product = null, metadata, paramStore = DEFAULT_PARAMS, includePumps = true }) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  let query = supabase
    .from("estoque_diesel_medicoes_diarias")
    .select("id, tanque_id, data_medicao, regua_final_t1, regua_final_t2, nf_volume_litros, saida_transnet, litros_final_t1, litros_final_t2, saldo_anterior, saldo_final, entrada_diesel, medicao_d1, medicao_atual, saida_tanque, pct_diff_transnet, saida_total_bombas, status_lancamento, observacao, criado_em")
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
    const { data: pumpRows, error: pumpError } = await supabase
      .from("estoque_diesel_leituras_bomba")
      .select("medicao_id, bomba_id, hodometro_inicial, hodometro_final, saida_bomba")
      .in("medicao_id", rows.map((row) => row.id));

    if (!pumpError) {
      pumpRowsByMeasurement = (pumpRows || []).reduce((acc, row) => {
        if (!acc[row.medicao_id]) acc[row.medicao_id] = [];
        acc[row.medicao_id].push(row);
        return acc;
      }, {});
    }
  }

  return (rows || []).map((row) => mapMeasurementRowToEntry(row, metadata, paramStore, pumpRowsByMeasurement[row.id] || []));
}

export async function fetchDieselReceipts({ year = "2026", product = null, metadata, paramStore = DEFAULT_PARAMS }) {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  let query = supabase
    .from("estoque_diesel_recebimentos")
    .select("id, tanque_id, tipo_diesel, data_recebimento, fornecedor_id, fornecedor_nome, nf_numero, nf_volume_litros, regua_antes_cm, regua_depois_cm, litros_antes, litros_depois, volume_recebido_litros, diff_recebimento_litros, pct_diff_recebimento, foto_antes_url, foto_depois_url, status_recebimento, observacao, criado_em")
    .gte("data_recebimento", from)
    .lte("data_recebimento", to)
    .order("data_recebimento", { ascending: true });

  if (product && metadata?.tanksByProduct?.[product]?.id) {
    query = query.eq("tanque_id", metadata.tanksByProduct[product].id);
  } else if (product) {
    return [];
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => mapReceiptRow(row, metadata, paramStore));
}

export function getPreviousEntry(entries, product, currentDate, currentId = null) {
  const current = new Date(`${currentDate}T00:00:00`);
  return [...(entries || [])]
    .filter((entry) => entry.product === product && entry.date && entry.id !== currentId)
    .filter((entry) => new Date(`${entry.date}T00:00:00`) < current)
    .sort((a, b) => new Date(`${b.date}T00:00:00`) - new Date(`${a.date}T00:00:00`))[0] || null;
}

export function getDailyReceipts(receipts, product, date) {
  return (receipts || []).filter((receipt) => receipt.product === product && receipt.date === date);
}

export function sumDailyReceipts(receipts, product, date) {
  return round(getDailyReceipts(receipts, product, date).reduce((sum, item) => sum + (Number(item.volumeRecebido) || 0), 0), 2) || 0;
}

export function buildDefaultForm(product, date = todayISO(), entries = []) {
  const previousEntry = getPreviousEntry(entries, product, date);
  const previousPumps = previousEntry?.pumps || [];

  const pumps = (PRODUCT_CONFIG[product]?.pumpNumbers || []).map((number) => {
    const previousPump = previousPumps.find((pump) => Number(pump.number) === Number(number));
    return {
      number,
      initial: previousPump?.final ?? "",
      final: "",
    };
  });

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

export function buildDefaultReceiptForm(product, date = todayISO()) {
  return {
    id: null,
    product,
    date,
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

export function computeMeasurement(form, params, previousEntry, dailyReceipts = []) {
  const radius = parseNumber(params.diameterM) ? parseNumber(params.diameterM) / 2 : parseNumber(params.radiusM);
  const length = parseNumber(params.lengthM);

  const litrosAtualT1 = calculateVolumeLiters(form.reguaAtualT1, radius, length);
  const litrosAtualT2 = calculateVolumeLiters(form.reguaAtualT2, radius, length);
  const medicaoAtual = round((litrosAtualT1 || 0) + (litrosAtualT2 || 0), 2);
  const medicaoD1 = previousEntry?.medicaoAtual ?? previousEntry?.saldoFinal ?? 0;
  const entradaDiesel = round((dailyReceipts || []).reduce((sum, row) => sum + (Number(row.volumeRecebido) || 0), 0), 2) || 0;
  const saidaTanque = medicaoAtual !== null ? round((Number(medicaoD1) || 0) + entradaDiesel - medicaoAtual, 2) : null;

  const previousPumps = previousEntry?.pumps || [];
  const pumpDetails = (form.pumps || []).map((pump) => {
    const previousPump = previousPumps.find((item) => Number(item.number) === Number(pump.number));
    const initial = parseNumber(pump.initial) ?? previousPump?.final ?? 0;
    const final = parseNumber(pump.final) ?? 0;
    return {
      ...pump,
      initial,
      final,
      output: round(final - initial, 2),
    };
  });

  const saidaTotalBombas = round(pumpDetails.reduce((sum, pump) => sum + (Number(pump.output) || 0), 0), 2) || 0;
  const saidaTransnet = parseNumber(form.transnetOutput) || 0;
  const diffTanqueTransnet = saidaTanque !== null ? round(saidaTransnet - saidaTanque, 2) : null;
  const diffBombasTransnet = round(saidaTransnet - saidaTotalBombas, 2);
  const diffTanqueBombas = saidaTanque !== null ? round(saidaTanque - saidaTotalBombas, 2) : null;
  const pctDiffTransnet = saidaTanque ? round(diffTanqueTransnet / saidaTanque, 4) : null;
  const pctDiffBombas = saidaTotalBombas ? round(diffBombasTransnet / saidaTotalBombas, 4) : null;

  return {
    litrosAtualT1,
    litrosAtualT2,
    medicaoD1,
    medicaoAtual,
    saldoAnterior: medicaoD1,
    saldoFinal: medicaoAtual,
    entradaDiesel,
    saidaTanque,
    pumpDetails,
    saidaTotalBombas,
    saidaTransnet,
    diffTanqueTransnet,
    diffBombasTransnet,
    diffTanqueBombas,
    pctDiffTransnet,
    pctDiffBombas,
  };
}

export function computeReceipt(form, params) {
  const radius = parseNumber(params.diameterM) ? parseNumber(params.diameterM) / 2 : parseNumber(params.radiusM);
  const length = parseNumber(params.lengthM);

  const litrosAntes = calculateVolumeLiters(form.reguaAntesCm, radius, length);
  const litrosDepois = calculateVolumeLiters(form.reguaDepoisCm, radius, length);
  const nfVolume = parseNumber(form.nfVolumeLitros) || 0;
  const volumeRecebido = litrosAntes !== null && litrosDepois !== null ? round(litrosDepois - litrosAntes, 2) : null;
  const diffRecebimento = volumeRecebido !== null ? round(volumeRecebido - nfVolume, 2) : null;
  const pctDiffRecebimento = nfVolume > 0 && diffRecebimento !== null ? round(diffRecebimento / nfVolume, 4) : null;

  return {
    litrosAntes,
    litrosDepois,
    volumeRecebido,
    diffRecebimento,
    pctDiffRecebimento,
  };
}

export function validateMeasurement(form, computed, params) {
  const errors = {};
  const warnings = [];

  if (!form.date) errors.date = "Informe a data do lançamento.";
  if (parseNumber(form.reguaAtualT1) === null && parseNumber(form.reguaAtualT2) === null) {
    errors.reguaAtual = "Informe a medição atual do tanque.";
  }

  for (const pump of form.pumps || []) {
    const final = parseNumber(pump.final);
    if (final === null) errors[`pump_${pump.number}`] = `Bomba ${pump.number}: informe o encerrante atual.`;
    if (final !== null && parseNumber(pump.initial) !== null && final < parseNumber(pump.initial)) {
      errors[`pump_${pump.number}`] = `Bomba ${pump.number}: encerrante atual menor que o D-1.`;
    }
  }

  ["reguaAtualT1", "reguaAtualT2"].forEach((field) => {
    const value = parseNumber(form[field]);
    if (value !== null && params.maxRuleCm && value > params.maxRuleCm) {
      warnings.push(`${field} acima do limite físico do tanque.`);
    }
  });

  if (computed.pctDiffTransnet !== null && Math.abs(computed.pctDiffTransnet) > (params.transnetWarnPct || 0.02)) {
    warnings.push("Diferença tanque x Transnet acima da faixa de atenção.");
  }

  if (computed.pctDiffBombas !== null && Math.abs(computed.pctDiffBombas) > (params.pumpWarnPct || 0.02)) {
    warnings.push("Diferença bombas x Transnet acima da faixa de atenção.");
  }

  return { errors, warnings };
}

export function validateReceipt(form, computed, params) {
  const errors = {};
  const warnings = [];

  if (!form.date) errors.date = "Informe a data do recebimento.";
  if ((parseNumber(form.nfVolumeLitros) || 0) <= 0) errors.nfVolumeLitros = "Informe o volume da NF.";
  if (parseNumber(form.reguaAntesCm) === null) errors.reguaAntesCm = "Informe a régua antes do recebimento.";
  if (parseNumber(form.reguaDepoisCm) === null) errors.reguaDepoisCm = "Informe a régua depois do recebimento.";
  if (!form.fotoAntesFile) errors.fotoAntesFile = "Anexe a foto da régua antes.";
  if (!form.fotoDepoisFile) errors.fotoDepoisFile = "Anexe a foto da régua depois.";
  if (computed.volumeRecebido !== null && computed.volumeRecebido < 0) errors.volumeRecebido = "Volume recebido negativo. Revise as réguas.";

  if (computed.pctDiffRecebimento !== null && Math.abs(computed.pctDiffRecebimento) > (params.nfDiffWarnPct || 0.01)) {
    warnings.push("Recebimento fora da faixa de atenção contra a NF.");
  }

  return { errors, warnings };
}

async function resolveSupplierId(form, metadata) {
  let supplierId = form.supplierId || null;
  if (!supplierId && form.supplier) {
    const existingSupplier = Object.values(metadata.suppliersById || {}).find((supplier) => supplier.nome === form.supplier);
    if (existingSupplier) {
      supplierId = existingSupplier.id;
    } else {
      const { data: newSupplier, error } = await supabase
        .from("estoque_diesel_fornecedores")
        .insert({ nome: form.supplier, ativo: true })
        .select("id, nome")
        .single();
      if (error) throw error;
      supplierId = newSupplier.id;
      metadata.suppliersById[newSupplier.id] = newSupplier;
    }
  }
  return supplierId;
}

async function uploadReceiptFile(file, product, date, suffix) {
  if (!file) return null;
  const extension = file.name?.split(".").pop() || "jpg";
  const path = `recebimentos/${product}/${date}/${Date.now()}-${suffix}.${extension}`;
  const { error } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(RECEIPT_BUCKET).getPublicUrl(path);
  return data?.publicUrl || path;
}

export async function saveDieselReceipt({ form, computed, product, params, metadata, userId = null }) {
  const tank = metadata?.tanksByProduct?.[product];
  if (!tank?.id) throw new Error(`Tanque de ${product} não encontrado no Supabase.`);

  const supplierId = await resolveSupplierId(form, metadata);
  const fotoAntesUrl = await uploadReceiptFile(form.fotoAntesFile, product, form.date, "antes");
  const fotoDepoisUrl = await uploadReceiptFile(form.fotoDepoisFile, product, form.date, "depois");
  const status = receiptStatus(computed, params).label;

  const payload = {
    tanque_id: tank.id,
    tipo_diesel: product,
    data_recebimento: form.date,
    fornecedor_id: supplierId,
    fornecedor_nome: form.supplier || null,
    nf_numero: form.nfNumero || null,
    nf_volume_litros: parseNumber(form.nfVolumeLitros) || 0,
    regua_antes_cm: parseNumber(form.reguaAntesCm),
    regua_depois_cm: parseNumber(form.reguaDepoisCm),
    litros_antes: computed.litrosAntes,
    litros_depois: computed.litrosDepois,
    volume_recebido_litros: computed.volumeRecebido,
    diff_recebimento_litros: computed.diffRecebimento,
    pct_diff_recebimento: computed.pctDiffRecebimento,
    foto_antes_url: fotoAntesUrl,
    foto_depois_url: fotoDepoisUrl,
    status_recebimento: status,
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

export async function saveMeasurementEntry({ form, computed, product, metadata, userId = null }) {
  const tank = metadata?.tanksByProduct?.[product];
  if (!tank?.id) throw new Error(`Tanque de ${product} não encontrado no Supabase.`);

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
    status_lancamento: measurementStatus(computed, DEFAULT_PARAMS[product]).label,
    observacao: form.observation || null,
    atualizado_em: new Date().toISOString(),
    usuario_id: Number.isInteger(userId) ? userId : null,
  };

  const { data: savedMeasurement, error } = await supabase
    .from("estoque_diesel_medicoes_diarias")
    .upsert(payload, { onConflict: "tanque_id,data_medicao" })
    .select("id")
    .single();

  if (error) throw error;

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

  if (pumpPayload.length) {
    const { error: pumpError } = await supabase
      .from("estoque_diesel_leituras_bomba")
      .upsert(pumpPayload, { onConflict: "medicao_id,bomba_id" });
    if (pumpError) throw pumpError;
  }

  return savedMeasurement.id;
}
