import { supabase } from "../../supabase";

export const ACIDENTE_STATUS = ["Aguardando imagens", "Em aberto", "Concluido", "Cancelado"];
export const SITUACOES_OPERACIONAIS = ["Seguiu viagem", "Aguardando orientação", "Recolhido para garagem"];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowHHMM() {
  return new Date().toTimeString().slice(0, 5);
}

export function formatDateBR(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).split("-");
  if (y && m && d) return `${d}/${m}/${y}`;
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
}

export function formatTimeBR(value) {
  if (!value) return "-";
  return String(value).slice(0, 5).replace(":", "h");
}

export function safeText(value, fallback = "-") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function statusTone(status) {
  if (status === "Aguardando imagens") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "Em aberto") return "border-blue-200 bg-blue-50 text-blue-800";
  if (status === "Concluido") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "Cancelado") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export function situacaoMarcada(situacao, alvo) {
  return situacao === alvo ? "x" : " ";
}

export function buildMensagemWhatsApp(form) {
  const motorista = [form.motorista_chapa, form.motorista_nome].filter(Boolean).join(" - ");
  return [
    `📅 Data: ${formatDateBR(form.data_ocorrencia)}`,
    `⏰ Hora: ${formatTimeBR(form.hora_ocorrencia)}`,
    `📍 Local: ${safeText(form.local, "")}`,
    `🚌 Linha: ${safeText(form.linha, "")}`,
    `🚍 Prefixo: ${safeText(form.prefixo, "")}`,
    `👨‍✈️ Motorista: ${safeText(motorista || form.motorista_chapa || form.motorista_nome, "")}`,
    "",
    `🚗 Veículo terceiro: ${safeText(form.veiculo_terceiro, "")}`,
    `Placa: ${safeText(form.placa_terceiro, "")}`,
    `Condutor: ${safeText(form.condutor_terceiro, "")}`,
    "📄 Descrição:",
    safeText(form.descricao, ""),
    "🚦 Situação operacional:",
    "",
    `(${situacaoMarcada(form.situacao_operacional, "Seguiu viagem")}) Seguiu viagem`,
    `(${situacaoMarcada(form.situacao_operacional, "Aguardando orientação")}) Aguardando orientação`,
    `(${situacaoMarcada(form.situacao_operacional, "Recolhido para garagem")}) Recolhido para garagem`,
    "",
    "📷 Registros:",
    safeText(form.registros_observacao, "Segue fotos mandadas pelo Operador"),
    "",
    "CCO ciente e acompanhando ocorrência",
    "@Josue @Japa (Corporativo) @Fernando Siqueira",
  ].join("\n");
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

export async function uploadAcidenteFiles(files, folder) {
  const urls = [];
  for (const file of Array.from(files || [])) {
    const safeName = (file.name || "arquivo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const path = `${folder}/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
    const { error } = await supabase.storage.from("acidentes").upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("acidentes").getPublicUrl(path);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

export function pickUserAudit(user) {
  return {
    criado_por_login: user?.login || user?.email || null,
    criado_por_nome: user?.nome_completo || user?.nome || user?.email || null,
    criado_por_id: user?.auth_user_id || user?.id || null,
  };
}
