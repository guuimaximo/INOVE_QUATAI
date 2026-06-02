// Helpers comuns do Controle de Especial.

function safeText(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function formatDateBR(s) {
  if (!s) return "";
  // s = "YYYY-MM-DD"
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function formatTimeBR(s) {
  if (!s) return "";
  return String(s).substring(0, 5);
}

function blocoParadas(paradas, prefixoIcone = "•") {
  return (paradas || [])
    .filter((p) => p?.local || p?.endereco)
    .flatMap((p, i) => {
      const linhas = [`${prefixoIcone} Parada ${i + 1}: ${safeText(p.local)}`];
      if (safeText(p.endereco)) linhas.push(`     ${safeText(p.endereco)}`);
      return linhas;
    });
}

export function buildMensagemWhatsAppEspecial(form) {
  const data = formatDateBR(form.data);
  const horaIda = formatTimeBR(form.ida_hora_saida);
  const horaVolta = formatTimeBR(form.volta_hora_saida);

  const bloco = [];

  bloco.push("*🚌 ESPECIAL — LANÇAMENTO*");
  bloco.push("");
  bloco.push(`📅 Data: *${data || "—"}*`);
  bloco.push(`🚐 Quantidade de ônibus: *${form.qtd_onibus || 1}*`);
  bloco.push("");

  // IDA
  bloco.push("*🚌 IDA*");
  bloco.push(`⏰ Saída: ${horaIda || "—"}`);
  if (safeText(form.ida_local_saida)) bloco.push(`📍 Local: ${safeText(form.ida_local_saida)}`);
  if (safeText(form.ida_end_saida)) bloco.push(`     ${safeText(form.ida_end_saida)}`);
  bloco.push(...blocoParadas(form.ida_paradas));
  if (safeText(form.ida_destino_local)) bloco.push(`🎯 Destino: ${safeText(form.ida_destino_local)}`);
  if (safeText(form.ida_end_destino)) bloco.push(`     ${safeText(form.ida_end_destino)}`);

  bloco.push("");

  // VOLTA
  bloco.push("*🚌 RETORNO*");
  bloco.push(`⏰ Saída: ${horaVolta || "—"}`);
  if (safeText(form.volta_local_saida)) bloco.push(`📍 Local: ${safeText(form.volta_local_saida)}`);
  if (safeText(form.volta_end_saida)) bloco.push(`     ${safeText(form.volta_end_saida)}`);
  bloco.push(...blocoParadas(form.volta_paradas));
  if (safeText(form.volta_destino_local)) bloco.push(`🎯 Destino: ${safeText(form.volta_destino_local)}`);
  if (safeText(form.volta_end_destino)) bloco.push(`     ${safeText(form.volta_end_destino)}`);

  if (safeText(form.observacoes)) {
    bloco.push("");
    bloco.push("📝 Observações:");
    bloco.push(safeText(form.observacoes));
  }

  bloco.push("");
  bloco.push("_Lançado pelo INOVE • Controle de Especial_");

  return bloco.join("\n");
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
