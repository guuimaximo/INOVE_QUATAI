import { supabase } from "../../supabase";

export const SUPRIMENTOS_BUCKET = "suprimentos";

export const GARANTIA_TIPOS_SOLICITACAO = ["Ressarcimento", "Peça nova"];
export const GARANTIA_RESULTADOS = ["Aprovada", "Negada"];
export const GARANTIA_TIPOS_RETORNO = ["Crédito", "Peça nova"];

export const TESTE_RESULTADOS = ["Aprovado", "Reprovado"];

export function toISODate(date) {
  const base = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(base.getTime())) return "";
  return new Date(base.getTime() - base.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

export function todayISO() {
  return toISODate(new Date());
}

export function formatDateBR(value) {
  if (!value) return "--";
  const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("pt-BR");
}

export function formatDateTimeBR(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR");
}

export function formatCurrencyBR(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatKm(value) {
  if (value === null || value === undefined || value === "") return "--";
  return `${Number(value || 0).toLocaleString("pt-BR")} km`;
}

export function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeAttachments(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function fileNameFromUrl(url) {
  try {
    const raw = String(url || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    return decodeURIComponent(noQuery.split("/").filter(Boolean).pop() || "arquivo");
  } catch {
    return "arquivo";
  }
}

export function sanitizeFileName(name) {
  return String(name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function parseControlNumber(value, prefix) {
  const match = String(value || "").match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  return match ? Number(match[1]) : 0;
}

export async function generateNextControlNumber(table, prefix) {
  const { data, error } = await supabase
    .from(table)
    .select("numero_controle")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  const maxValue = (data || []).reduce((max, row) => {
    const current = parseControlNumber(row?.numero_controle, prefix);
    return current > max ? current : max;
  }, 0);

  return `${prefix}-${String(maxValue + 1).padStart(5, "0")}`;
}

export function buildOpenedBy(user) {
  return {
    aberto_por_id: Number(user?.usuario_id || user?.id || 0) || null,
    aberto_por_nome: user?.nome || user?.nome_completo || user?.login || user?.email || "Usuario INOVE",
    aberto_por_login: user?.login || user?.email || null,
  };
}

export async function uploadSuprimentosFiles(files, folder = "geral") {
  const uploads = [];

  for (const file of files || []) {
    const path = `${folder}/${Date.now()}_${sanitizeFileName(file?.name)}`;
    const { error } = await supabase.storage.from(SUPRIMENTOS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file?.type || undefined,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(SUPRIMENTOS_BUCKET).getPublicUrl(path);
    uploads.push(data?.publicUrl);
  }

  return uploads.filter(Boolean);
}

export function deriveGarantiaMeta(row) {
  const resultado = String(row?.resultado || "").trim();
  const retorno = String(row?.tipo_retorno || "").trim();
  const retornoCredito = retorno === "Credito" || retorno === "Crédito";
  const retornoPeca = retorno === "Peca nova" || retorno === "Peça nova";

  const concluida =
    Boolean(row?.encerrada_em) ||
    (resultado === "Negada" && Boolean(row?.retorno_fornecedor_em)) ||
    (resultado === "Aprovada" &&
      ((retornoCredito && Boolean(row?.retorno_fornecedor_em)) ||
        (retornoPeca && Boolean(row?.recebida_em))));

  let fase = "Aberta";
  let tone = "slate";

  if (concluida) {
    if (resultado === "Negada") {
      fase = "Finalizada negada";
      tone = "rose";
    } else if (retornoCredito) {
      fase = "Finalizada com credito";
      tone = "emerald";
    } else if (retornoPeca) {
      fase = "Finalizada com peca";
      tone = "emerald";
    } else {
      fase = "Finalizada";
      tone = "emerald";
    }
  } else if (resultado === "Aprovada") {
    fase = "Aprovada";
    tone = "cyan";
  } else if (resultado === "Negada") {
    fase = "Negada";
    tone = "rose";
  } else if (row?.protocolo_fornecedor || row?.enviado_fornecedor_em) {
    fase = "Enviada ao fornecedor";
    tone = "amber";
  }

  return {
    status: concluida ? "Concluída" : "Aberta",
    fase,
    tone,
    concluida,
  };
}

export function deriveTesteMeta(row) {
  const resultado = String(row?.resultado_final || "").trim();
  const concluido = Boolean(row?.encerrado_em) || Boolean(resultado);

  let fase = "Iniciado";
  let tone = "slate";

  if (concluido) {
    if (resultado === "Aprovado") {
      fase = "Finalizado aprovado";
      tone = "emerald";
    } else if (resultado === "Reprovado") {
      fase = "Finalizado reprovado";
      tone = "rose";
    } else {
      fase = "Finalizado";
      tone = "emerald";
    }
  } else if (row?.falha_registrada) {
    fase = "Com falha registrada";
    tone = "rose";
  } else if (safeNumber(row?.km_atual) && safeNumber(row?.km_inicial) !== safeNumber(row?.km_atual)) {
    fase = "Em acompanhamento";
    tone = "cyan";
  }

  return {
    status: concluido ? "Concluído" : "Ativo",
    fase,
    tone,
    concluido,
  };
}

export function matchesSearch(row, term, fields) {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => String(row?.[field] || "").toLowerCase().includes(query));
}
