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
    pumps: 3,
    usesTransnet: true,
    monthSheetPattern: "Medicao Combustivel S500",
  },
  S10: {
    code: "S10",
    label: "Diesel S10",
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

function buildStatusLabel(entryLike, params) {
  if (entryLike?.status && ["OK", "Atencao", "Critico"].includes(entryLike.status)) {
    return entryLike.status;
  }

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
    reguaAnteriorT1: row.regua_anterior_t1,
    reguaAnteriorT2: row.regua_anterior_t2,
    reguaFinalT1: row.regua_final_t1,
    reguaFinalT2: row.regua_final_t2,
    transnetOutput: row.saida_transnet ?? 0,
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
    saidaTanque: row.saida_tanque,
    saidaTotalBombas: row.saida_total_bombas,
    saidaTransnet: row.saida_transnet ?? 0,
    diffRecebimento: row.diff_recebimento,
    pctDiffNF: row.pct_diff_nf,
    pctDiffTransnet: row.pct_diff_transnet,
    status: row.status_lancamento,
    createdAt: row.criado_em,
  };

  entry.status = buildStatusLabel(entry, params);
  return entry;
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

export async function fetchMeasurementContext() {
  const [tanksResponse, paramsResponse, tolerancesResponse, suppliersResponse, pumpsResponse] = await Promise.all([
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
      productParams.transnetWarnPct = Number(
        dbParam.pct_diff_transnet_alerta ?? productParams.transnetWarnPct
      );
      productParams.transnetCriticalPct = Number(
        dbParam.pct_diff_transnet_critico ?? productParams.transnetCriticalPct
      );
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
    metadata.pumpsByProduct[product].sort((a, b) => a.numero - b.numero);
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
      "id, tanque_id, data_medicao, regua_anterior_t1, regua_anterior_t2, regua_final_t1, regua_final_t2, nf_volume_litros, fornecedor_id, nf_numero, saida_transnet, litros_anterior_t1, litros_anterior_t2, litros_final_t1, litros_final_t2, saldo_anterior, saldo_final, entrada_diesel, medicao_d1, medicao_atual, saida_tanque, diff_recebimento, pct_diff_nf, pct_diff_transnet, saida_total_bombas, status_lancamento, observacao, criado_em"
    )
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
      .in(
        "medicao_id",
        rows.map((row) => row.id)
      );

    if (pumpsError) throw pumpsError;

    pumpRowsByMeasurement = (pumpRows || []).reduce((acc, row) => {
      if (!acc[row.medicao_id]) acc[row.medicao_id] = [];
      acc[row.medicao_id].push(row);
      return acc;
    }, {});
  }

  return (rows || []).map((row) =>
    mapMeasurementRowToEntry(row, metadata, paramStore, pumpRowsByMeasurement[row.id] || [])
  );
}

export async function saveMeasurementEntry({
  form,
  computed,
  product,
  params,
  metadata,
  userId = null,
}) {
  const tank = metadata?.tanksByProduct?.[product];
  if (!tank?.id) {
    throw new Error(`Tanque de ${product} nao encontrado no Supabase.`);
  }

  let supplierId = form.supplierId || null;
  if (!supplierId && form.supplier) {
    const existingSupplier = Object.values(metadata.suppliersById || {}).find(
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
      metadata.suppliersById[newSupplier.id] = newSupplier;
    }
  }

  const payload = {
    tanque_id: tank.id,
    data_medicao: form.date,
    regua_anterior_t1: parseNumber(form.reguaAnteriorT1),
    regua_anterior_t2: parseNumber(form.reguaAnteriorT2),
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

  const dbPumps = (metadata.pumpsByProduct?.[product] || []).sort((a, b) => a.numero - b.numero);
  const pumpPayload = dbPumps.map((pump, index) => ({
    medicao_id: savedMeasurement.id,
    bomba_id: pump.id,
    hodometro_inicial: parseNumber(form.pumps[index]?.initial) || 0,
    hodometro_final: parseNumber(form.pumps[index]?.final) || 0,
  }));

  if (pumpPayload.length > 0) {
    const { error: pumpError } = await supabase
      .from("estoque_diesel_leituras_bomba")
      .upsert(pumpPayload, { onConflict: "medicao_id,bomba_id" });
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
      tanksPayload.push({
        id: tank.id,
        diametro_m: parseNumber(current.diameterM) || DEFAULT_PARAMS[product].diameterM,
        comprimento_m: parseNumber(current.lengthM) || DEFAULT_PARAMS[product].lengthM,
      });
      paramsPayload.push({
        tanque_id: tank.id,
        regua_max_cm: parseNumber(current.maxRuleCm) || DEFAULT_PARAMS[product].maxRuleCm,
        pct_diff_nf_alerta: parseNumber(current.nfDiffWarnPct) || DEFAULT_PARAMS[product].nfDiffWarnPct,
        pct_diff_nf_critico: parseNumber(current.nfDiffCriticalPct) || DEFAULT_PARAMS[product].nfDiffCriticalPct,
        pct_diff_transnet_alerta:
          parseNumber(current.transnetWarnPct) || DEFAULT_PARAMS[product].transnetWarnPct,
        pct_diff_transnet_critico:
          parseNumber(current.transnetCriticalPct) || DEFAULT_PARAMS[product].transnetCriticalPct,
        ativo: true,
        atualizado_em: new Date().toISOString(),
      });
    }

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

  const { error: tanksError } = await supabase
    .from("estoque_diesel_tanques")
    .upsert(tanksPayload, { onConflict: "id" });
  if (tanksError) throw tanksError;

  const { error: paramsError } = await supabase
    .from("estoque_diesel_parametros")
    .upsert(paramsPayload, { onConflict: "tanque_id" });
  if (paramsError) throw paramsError;

  const { error: toleranceError } = await supabase
    .from("estoque_diesel_tolerancias_nf")
    .upsert(tolerancesPayload, { onConflict: "tipo_diesel,volume_nf" });
  if (toleranceError) throw toleranceError;
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
    supplierId: null,
    nfNumero: "",
    transnetOutput: "",
    observation: "",
    pumps,
  };
}

export function computeMeasurement(form, params, previousEntry) {
  const radius = parseNumber(params.diameterM)
    ? parseNumber(params.diameterM) / 2
    : parseNumber(params.radiusM);
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
  const saidaTanque =
    medicaoAtual !== null ? round((medicaoD1 || 0) + nfVolumeLitros - medicaoAtual, 2) : null;

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
    saidaTanque && saidaTanque !== 0 ? round((saidaTransnet - saidaTanque) / saidaTanque, 4) : null;

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
  const nfCritical =
    computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffCriticalPct || 0.03);
  const transnetCritical =
    computed.pctDiffTransnet !== null &&
    Math.abs(computed.pctDiffTransnet) > (params.transnetCriticalPct || 0.03);
  const nfWarn =
    computed.pctDiffNF !== null && Math.abs(computed.pctDiffNF) > (params.nfDiffWarnPct || 0.01);
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
    supplierId: form.supplierId || null,
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
