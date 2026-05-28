import { supabase } from "../../supabase";

export const SUPRIMENTOS_BUCKET = "suprimentos";
const TESTE_INTERCORRENCIAS_MARKER = "__teste_intercorrencias__:";

export const GARANTIA_TIPOS = ["Peça comprada", "Veículo novo"];
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

export function addDaysToISODate(value, days) {
  if (!value || days === null || days === undefined || days === "") return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Number(days || 0));
  return toISODate(date);
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
  const raw = String(value || "").trim();
  if (!raw) return 0;
  const prefixed = raw.match(new RegExp(`^${prefix}-(\\d+)$`, "i"));
  if (prefixed) return Number(prefixed[1]);
  const numeric = raw.match(/^(\d+)$/);
  return numeric ? Number(numeric[1]) : 0;
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

  return String(maxValue + 1).padStart(5, "0");
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
  const retornoKey = retorno
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const retornoCredito = retornoKey.includes("credito") || (retornoKey.includes("cr") && retornoKey.includes("dito"));
  const retornoPeca = retornoKey.includes("peca") || retornoKey.includes("pea") || retornoKey.includes("nova");
  const prazoRetorno = safeNumber(row?.prazo_retorno_dias);
  const limiteRetorno = addDaysToISODate(row?.retirada_fornecedor_em, prazoRetorno);

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
      fase = "Fechada por negativa";
      tone = "rose";
    } else if (retornoCredito) {
      fase = "Fechada por crédito";
      tone = "emerald";
    } else if (retornoPeca) {
      fase = "Fechada por peça";
      tone = "emerald";
    } else {
      fase = "Fechada";
      tone = "emerald";
    }
  } else if (resultado === "Aprovada") {
    fase = "Aprovada";
    tone = "cyan";
  } else if (resultado === "Negada") {
    fase = "Negada";
    tone = "rose";
  } else if (row?.retorno_fornecedor_em) {
    fase = `Peça retornada pelo fornecedor em ${formatDateBR(row.retorno_fornecedor_em)}`;
    tone = "emerald";
  } else if (row?.retirada_fornecedor_em) {
    fase = limiteRetorno
      ? `Aguardando retorno até ${formatDateBR(limiteRetorno)}`
      : "Peça retirada pelo fornecedor";
    tone = "amber";
  } else if (row?.protocolo_fornecedor || row?.enviado_fornecedor_em) {
    fase = "Enviada ao fornecedor";
    tone = "amber";
  }

  return {
    status: concluida ? "Concluída" : "Aberta",
    fase,
    tone,
    concluida,
    limiteRetorno,
  };
}

function normalizeIntercorrencia(item, index = 0) {
  if (!item || typeof item !== "object") return null;
  const data = String(item.data || "").trim();
  const km = safeNumber(item.km);
  const descricao = String(item.descricao || "").trim();

  if (!data && km === null && !descricao) return null;

  return {
    id: item.id || `intercorrencia-${Date.now()}-${index}`,
    data,
    km: km === null ? "" : km,
    descricao,
  };
}

function parseIntercorrenciasPayload(value) {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith(TESTE_INTERCORRENCIAS_MARKER)) return null;

  try {
    const parsed = JSON.parse(value.slice(TESTE_INTERCORRENCIAS_MARKER.length));
    return Array.isArray(parsed?.intercorrencias) ? parsed.intercorrencias : null;
  } catch {
    return null;
  }
}

export function parseTesteIntercorrencias(row) {
  const fromPayload = parseIntercorrenciasPayload(row?.descricao_falha)
    ?.map((item, index) => normalizeIntercorrencia(item, index))
    .filter(Boolean);

  if (fromPayload?.length) return fromPayload;

  const legacy = normalizeIntercorrencia(
    {
      id: "legacy",
      data: row?.data_falha || "",
      km: row?.km_falha ?? "",
      descricao: row?.falha_registrada ? row?.descricao_falha || "" : "",
    },
    0
  );

  return legacy ? [legacy] : [];
}

export function serializeTesteIntercorrencias(intercorrencias) {
  const cleaned = (intercorrencias || [])
    .map((item, index) => normalizeIntercorrencia(item, index))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      data: item.data || null,
      km: safeNumber(item.km),
      descricao: item.descricao || null,
    }));

  if (!cleaned.length) return null;

  return `${TESTE_INTERCORRENCIAS_MARKER}${JSON.stringify({
    intercorrencias: cleaned,
  })}`;
}

export function getTesteLastIntercorrencia(rowOrIntercorrencias) {
  const list = Array.isArray(rowOrIntercorrencias)
    ? rowOrIntercorrencias
    : parseTesteIntercorrencias(rowOrIntercorrencias);

  return [...list]
    .filter(Boolean)
    .sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")))
    .at(-1) || null;
}

export function deriveTesteMeta(row) {
  const resultado = String(row?.resultado_final || "").trim();
  const concluiu = Boolean(row?.encerrado_em) || Boolean(resultado);
  const intercorrencias = parseTesteIntercorrencias(row);
  const kmAtual = safeNumber(row?.km_atual);
  const kmInicial = safeNumber(row?.km_inicial);

  let fase = "Iniciado";
  let tone = "slate";

  if (concluiu) {
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
  } else if (intercorrencias.length > 0) {
    fase = "Com intercorrencia";
    tone = "rose";
  } else if (kmAtual !== null && kmInicial !== null && kmAtual > kmInicial) {
    fase = "Em acompanhamento";
    tone = "cyan";
  }

  return {
    status: concluiu ? "Concluído" : "Ativo",
    fase,
    tone,
    concluido: concluiu,
  };
}

export function matchesSearch(row, term, fields) {
  const query = String(term || "").trim().toLowerCase();
  if (!query) return true;
  return fields.some((field) => String(row?.[field] || "").toLowerCase().includes(query));
}
