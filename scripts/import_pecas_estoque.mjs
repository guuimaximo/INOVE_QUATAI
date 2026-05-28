#!/usr/bin/env node
// Importa localizacao, estoque_min, estoque_max, ref_fabricante, saldo_erp, pmu, almoxarifado
// a partir do CSV do ERP TransNet (formato ;-separated, encoding latin1 / windows-1252).
//
// Uso:
//   SUPABASE_SERVICE_KEY=xxx node scripts/import_pecas_estoque.mjs caminho/arquivo.csv
//
// Se SUPABASE_SERVICE_KEY nao for setada, usa a anon key publica do projeto (sujeito a RLS).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://wboelthngddvkgrvwkbu.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib2VsdGhuZ2RkdmtncnZ3a2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODQxMzcsImV4cCI6MjA3NjU2MDEzN30.A3ylU8Tkx20VOD3EjOr3K7ir0J_jZrCfBNlzAOtODXg";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Uso: node scripts/import_pecas_estoque.mjs <arquivo.csv>");
  process.exit(1);
}

function parseBRNumber(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || raw === "__________") return null;
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCsvLine(line) {
  // CSV simples: tokens entre "" separados por ;
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ";" && !inQuote) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function decodeLatin1(buffer) {
  return new TextDecoder("windows-1252").decode(buffer);
}

const raw = readFileSync(resolve(csvPath));
const text = decodeLatin1(raw);
const lines = text.split(/\r?\n/);

const rows = [];
let almox = null;

for (const line of lines) {
  if (!line.trim()) continue;
  if (/^Almoxarifado:\s/i.test(line)) {
    almox = line.replace(/^Almoxarifado:\s*/i, "").trim();
    continue;
  }
  if (/^Grupo:|^Subgrupo:|^Total Subgrupo:|^Total Grupo:|^C.digo;Nome/i.test(line)) continue;

  const cols = splitCsvLine(line);
  if (cols.length < 10) continue;
  const codigo = String(cols[0] || "").trim();
  if (!/^\d{6,}$/.test(codigo)) continue;

  const nome = String(cols[1] || "").trim();
  const localizacao = String(cols[2] || "").trim() || null;
  const refFab = String(cols[3] || "").trim() || null;
  const unidade = String(cols[4] || "").trim() || null;
  const saldo = parseBRNumber(cols[5]);
  const pmu = parseBRNumber(cols[6]);
  const estMin = parseBRNumber(cols[8]);
  const estMax = parseBRNumber(cols[9]);

  rows.push({
    codigo,
    descricao: nome,
    localizacao,
    ref_fabricante: refFab,
    unidade_padrao: unidade,
    saldo_erp: saldo,
    pmu,
    estoque_min: estMin,
    estoque_max: estMax,
    almoxarifado: almox,
  });
}

console.log(`Linhas validas no CSV: ${rows.length}`);

if (!rows.length) process.exit(0);

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const erpSyncEm = new Date().toISOString();
const chunkSize = 200;
let updated = 0;
let inserted = 0;
let failed = 0;

for (let i = 0; i < rows.length; i += chunkSize) {
  const chunk = rows.slice(i, i + chunkSize);
  const codigos = chunk.map((r) => r.codigo);

  const { data: existentes, error: selErr } = await supabase
    .from("suprimentos_pecas")
    .select("id, codigo")
    .in("codigo", codigos);

  if (selErr) { console.error("Select falhou:", selErr.message); failed += chunk.length; continue; }

  const existenteMap = new Map((existentes || []).map((r) => [r.codigo, r.id]));

  const toUpdate = [];
  const toInsert = [];
  for (const r of chunk) {
    const payload = {
      localizacao: r.localizacao,
      estoque_min: r.estoque_min,
      estoque_max: r.estoque_max,
      ref_fabricante: r.ref_fabricante,
      saldo_erp: r.saldo_erp,
      pmu: r.pmu,
      almoxarifado: r.almoxarifado,
      unidade_padrao: r.unidade_padrao || "un",
      erp_sync_em: erpSyncEm,
    };
    const id = existenteMap.get(r.codigo);
    if (id) toUpdate.push({ id, ...payload });
    else toInsert.push({ codigo: r.codigo, descricao: r.descricao, ...payload });
  }

  if (toUpdate.length) {
    // Update um por um para nao sobrescrever descricao/fornecedor existentes.
    for (const u of toUpdate) {
      const { error } = await supabase.from("suprimentos_pecas").update(u).eq("id", u.id);
      if (error) { console.error(`Update ${u.id}:`, error.message); failed += 1; }
      else updated += 1;
    }
  }
  if (toInsert.length) {
    const { error } = await supabase.from("suprimentos_pecas").insert(toInsert);
    if (error) { console.error("Insert chunk:", error.message); failed += toInsert.length; }
    else inserted += toInsert.length;
  }

  console.log(`Processados ${Math.min(i + chunkSize, rows.length)}/${rows.length}`);
}

console.log(`\nResultado: ${updated} atualizadas, ${inserted} inseridas, ${failed} falhas.`);
