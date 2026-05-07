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

    for (const row of toleranceRows) {
      tolerancesPayload.push({
        tipo_diesel: product,
        volume_nf: parseNumber(row.nfVolume) || 0,
        pct_variacao_aceitavel: parseNumber(row.variationPct) || 0,
        diff_volume_aceitavel: parseNumber(row.acceptableDiffLiters) || 0,
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
