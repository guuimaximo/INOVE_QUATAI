#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { TextDecoder } from "node:util";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_CSV = "C:/Users/Guilh/Downloads/_tmp_csv_tmp2JPpo0.csv";
const LUBRIFICANTE_GRUPO = "LUBRIFICANTE, GRAXA E ADITIVOS";

function loadEnvFile(fileName) {
  const path = resolve(fileName);
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && inQuote && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === ";" && !inQuote) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

function normalize(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function chunks(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const csvPath = resolve(process.argv[2] || DEFAULT_CSV);
if (!existsSync(csvPath)) {
  console.error(`Arquivo nao encontrado: ${csvPath}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_SERVICE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Configure SUPABASE_URL/SUPABASE_SERVICE_KEY ou VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const text = new TextDecoder("windows-1252").decode(readFileSync(csvPath));
const lines = text.split(/\r?\n/).filter((line) => line.trim());
const headerIndex = lines.findIndex((line) => line.includes('"Cód."') && line.includes('"Grupo"'));
if (headerIndex === -1) {
  console.error("Cabecalho esperado nao encontrado no CSV.");
  process.exit(1);
}

const headers = splitCsvLine(lines[headerIndex]);
const col = Object.fromEntries(headers.map((name, index) => [name, index]));
const required = ["Cód.", "Nome", "Grupo", "Subgrupo"];
for (const field of required) {
  if (col[field] === undefined) {
    console.error(`Coluna obrigatoria ausente: ${field}`);
    process.exit(1);
  }
}

const rowsByCodigo = new Map();
for (const line of lines.slice(headerIndex + 1)) {
  const cells = splitCsvLine(line);
  const codigo = String(cells[col["Cód."]] || "").trim();
  if (!codigo) continue;
  rowsByCodigo.set(codigo, {
    codigo,
    descricao: String(cells[col["Nome"]] || "").trim(),
    grupo: String(cells[col["Grupo"]] || "").trim() || null,
    subgrupo: String(cells[col["Subgrupo"]] || "").trim() || null,
  });
}

const rows = Array.from(rowsByCodigo.values());
const groupedUpdates = new Map();
for (const row of rows) {
  const isLubrificante = normalize(row.grupo) === LUBRIFICANTE_GRUPO;
  const key = JSON.stringify({
    grupo: row.grupo,
    subgrupo: row.subgrupo,
    is_lubrificante: isLubrificante,
  });
  const bucket = groupedUpdates.get(key) || {
    patch: { grupo: row.grupo, subgrupo: row.subgrupo, is_lubrificante: isLubrificante },
    codigos: [],
  };
  bucket.codigos.push(row.codigo);
  groupedUpdates.set(key, bucket);
}

const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
let updatedRows = 0;
let failed = 0;
let processedCodes = 0;
let lubrificanteCodes = 0;

for (const { patch, codigos } of groupedUpdates.values()) {
  if (patch.is_lubrificante) lubrificanteCodes += codigos.length;
  for (const slice of chunks(codigos, 100)) {
    const { data, error, count } = await supabase
      .from("suprimentos_pecas")
      .update(patch)
      .in("codigo", slice)
      .select("id", { count: "exact" });

    processedCodes += slice.length;
    if (error) {
      failed += slice.length;
      console.error(`Falha ao atualizar grupo "${patch.grupo || "-"}": ${error.message}`);
      continue;
    }
    updatedRows += typeof count === "number" ? count : data?.length || 0;
    if (processedCodes % 1000 < slice.length) {
      console.log(`Processados ${processedCodes.toLocaleString("pt-BR")} / ${rows.length.toLocaleString("pt-BR")} codigos...`);
    }
  }
}

console.log("");
console.log(`CSV: ${rows.length.toLocaleString("pt-BR")} codigos unicos lidos.`);
console.log(`Lubrificantes no CSV: ${lubrificanteCodes.toLocaleString("pt-BR")} codigo(s).`);
console.log(`Banco: ${updatedRows.toLocaleString("pt-BR")} linha(s) atualizada(s).`);
console.log(`Falhas: ${failed.toLocaleString("pt-BR")} codigo(s).`);
