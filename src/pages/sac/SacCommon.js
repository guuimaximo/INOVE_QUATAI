import { supabase } from "../../supabase";

export const SAC_STATUS = ["Registrado", "Em tratativa", "Concluido", "Cancelado"];

export const SAC_ORIGENS = ["WhatsApp", "Ligacao", "Email", "Prefeitura", "Presencial", "Redes sociais"];

export const SAC_MOTIVOS = {
  Reclamacao: ["Intervalo de atendimento", "Cartao", "Conduta do operador", "Direcao perigosa", "Lotacao", "Horario", "Limpeza", "Acessibilidade"],
  Informacao: ["Itinerario", "Horarios", "Cartao", "Tarifas", "Achados e perdidos"],
  Denuncia: ["Evasao", "Conduta indevida", "Seguranca", "Fraude"],
  Elogio: ["Operador", "Linha", "Atendimento", "Conservacao"],
  Sugestao: ["Linha", "Horario", "Ponto", "Aplicativo", "Atendimento"],
};

export const SAC_ACOES = [
  "Registrado e esclarecido com passageiro",
  "Abrir tratativa",
  "Encaminhado ao setor responsavel",
  "Sem procedencia",
  "Retorno ao cliente pendente",
];

export function isValidUUID(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

export function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

export function formatDateBR(value) {
  if (!value) return "-";
  const date = String(value).includes("T") ? String(value).slice(0, 10) : String(value);
  const [y, m, d] = date.split("-");
  if (y && m && d) return `${d}/${m}/${y}`;
  return date;
}

export function formatTimeBR(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}

export function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function statusTone(status) {
  if (status === "Registrado") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "Em tratativa") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Concluido") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Cancelado") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function pickUserAudit(user) {
  const nome = user?.nome_completo || [user?.nome, user?.sobrenome].filter(Boolean).join(" ") || user?.email || user?.login || null;
  return {
    atendente_id: pickUserUuid(user) || user?.auth_user_id || user?.id || null,
    atendente_login: user?.login || user?.email || null,
    atendente_nome: nome,
  };
}

export function pickMovementUser(user) {
  const base = pickUserAudit(user);
  return {
    criado_por_id: base.atendente_id,
    criado_por_login: base.atendente_login,
    criado_por_nome: base.atendente_nome,
  };
}

export async function uploadSacFiles(files, folder) {
  const urls = [];
  for (const file of Array.from(files || [])) {
    const safeName = (file.name || "arquivo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const path = `${folder}/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
    const { error } = await supabase.storage.from("sac").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("sac").getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

export async function copyToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
