import { jsPDF } from "jspdf";
import logoInove from "../assets/logoInovaQuatai.png";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateBR(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function formatDateTimeBR(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "-";
  }
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Sim" : "Nao";
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(", ") : "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "object") return Object.values(value).map((item) => String(item)).filter(Boolean);
  const raw = String(value).trim();
  if (!raw) return [];
  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item)).filter(Boolean);
    } catch {}
  }
  return raw
    .split(/[\n,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function imageToDataUrl(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });
      const maxWidth = 1400;
      const scale = Math.min(1, maxWidth / image.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return {
        dataUrl: canvas.toDataURL("image/jpeg", 0.88),
        width: canvas.width,
        height: canvas.height,
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.warn("Falha ao carregar imagem do laudo:", error);
    return null;
  }
}

function toneFromAction(action = "") {
  const text = String(action || "").toLowerCase();
  if (text.includes("similaridade")) return [22, 163, 74];
  if (text.includes("inconclusivo")) return [217, 119, 6];
  if (text.includes("irregularidade")) return [220, 38, 38];
  if (text.includes("inconsistencia")) return [71, 85, 105];
  return [37, 99, 235];
}

function addLabeledValue(pdf, x, y, w, label, value, colors, lines = 2) {
  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(x, y, w, 18, 2, 2, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 116, 139);
  pdf.text(String(label || "").toUpperCase(), x + 3, y + 5);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...colors);
  const text = pdf.splitTextToSize(formatValue(value), w - 6).slice(0, lines);
  pdf.text(text, x + 3, y + 11);
}

function addParagraph(pdf, margin, y, width, title, value, accent = [37, 99, 235]) {
  const lines = pdf.splitTextToSize(formatValue(value), width - 8);
  const height = Math.max(18, lines.length * 4.5 + 10);
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(margin, y, width, height, 2, 2, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...accent);
  pdf.text(String(title || "").toUpperCase(), margin + 4, y + 6);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(15, 23, 42);
  pdf.text(lines, margin + 4, y + 12);
  return height;
}

function addSectionTitle(pdf, margin, y, width, title, subtitle = "") {
  pdf.setFillColor(30, 64, 175);
  pdf.roundedRect(margin, y, width, 9, 2, 2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(String(title || "").toUpperCase(), margin + 4, y + 6);
  if (subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.text(String(subtitle), margin + width - 4, y + 6, { align: "right" });
  }
  return y + 12;
}

function addImageBox(pdf, x, y, w, h, title, image) {
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(226, 232, 240);
  pdf.roundedRect(x, y, w, h, 2, 2, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(37, 99, 235);
  pdf.text(String(title || "").toUpperCase(), x + 3, y + 5);
  if (image?.dataUrl) {
    const aspect = image.width / image.height || 1;
    let drawW = w - 6;
    let drawH = h - 12;
    if (drawW / drawH > aspect) {
      drawW = drawH * aspect;
    } else {
      drawH = drawW / aspect;
    }
    const dx = x + (w - drawW) / 2;
    const dy = y + 8 + (h - 12 - drawH) / 2;
    pdf.addImage(image.dataUrl, "JPEG", dx, dy, drawW, drawH, undefined, "FAST");
  } else {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text("Sem imagem", x + w / 2, y + h / 2, { align: "center" });
  }
}

export async function gerarLaudoInovePdf(row) {
  if (!row) return;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  let y = 12;

  const actionColor = toneFromAction(row.acao_prevista);

  const cadImg = await imageToDataUrl(row.img_cadastro_url);
  const camImg = await imageToDataUrl(row.img_camera_url);
  const mapaImg = await imageToDataUrl(row.mapa_facial_visual_url);

  pdf.setProperties({
    title: `Laudo Inove ${row.prefixo || ""}`,
    subject: "Laudo Inove - detalhes do monitoramento",
    creator: "INOVE",
  });

  pdf.setFillColor(30, 64, 175);
  pdf.roundedRect(margin, y, contentW, 24, 3, 3, "F");
  pdf.addImage(logoInove, "PNG", margin + 4, y + 3.8, 16, 16);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.text("LAUDO INOVE", margin + 24, y + 10);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("Relatorio detalhado do monitoramento", margin + 24, y + 16);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(formatDateTimeBR(row.data_hora_evento || row.created_at), pageW - margin - 2, y + 9, { align: "right" });
  pdf.text(String(row.acao_prevista || "-"), pageW - margin - 2, y + 16, { align: "right" });
  y += 30;

  y = addSectionTitle(pdf, margin, y, contentW, "Identificacao", "Dados do laudo");
  const halfW = (contentW - 4) / 2;
  addLabeledValue(pdf, margin, y, halfW, "Nome", row.nome || "-", [15, 23, 42]);
  addLabeledValue(pdf, margin + halfW + 4, y, halfW, "Prefixo", row.prefixo || row.veiculo || "-", [15, 23, 42]);
  y += 20;
  addLabeledValue(pdf, margin, y, halfW, "Registro", row.registro || "-", [15, 23, 42]);
  addLabeledValue(pdf, margin + halfW + 4, y, halfW, "Categoria", row.categoria || "-", [15, 23, 42]);
  y += 20;
  addLabeledValue(pdf, margin, y, halfW, "Codigo Cartao", row.codigo_cartao || "-", [15, 23, 42]);
  addLabeledValue(pdf, margin + halfW + 4, y, halfW, "Codigo Usuario", row.codigo_usuario || "-", [15, 23, 42]);
  y += 20;

  y = addSectionTitle(pdf, margin, y + 2, contentW, "Imagens", "Cadastro e camera");
  const imgH = 58;
  addImageBox(pdf, margin, y, (contentW - 4) / 2, imgH, "Foto Cadastro", cadImg);
  addImageBox(pdf, margin + (contentW - 4) / 2 + 4, y, (contentW - 4) / 2, imgH, "Foto Camera", camImg);
  y += imgH + 6;

  y = addSectionTitle(pdf, margin, y, contentW, "Resultado da Analise", "Scores e decisao tecnica");
  const metricW = (contentW - 6) / 4;
  addLabeledValue(pdf, margin, y, metricW, "Score Final", row.score, [37, 99, 235], 1);
  addLabeledValue(pdf, margin + metricW + 2, y, metricW, "Score Biometrico", row.score_biometrico, [22, 163, 74], 1);
  addLabeledValue(pdf, margin + (metricW + 2) * 2, y, metricW, "Face Mesh", row.score_face_mesh, [217, 119, 6], 1);
  addLabeledValue(pdf, margin + (metricW + 2) * 3, y, metricW, "ArcFace", row.similaridade_arcface, [15, 23, 42], 1);
  y += 22;
  addLabeledValue(pdf, margin, y, metricW, "Rostos", row.quantidade_rostos_camera, [15, 23, 42], 1);
  addLabeledValue(pdf, margin + metricW + 2, y, metricW, "Confianca", row.confianca, [15, 23, 42], 1);
  addLabeledValue(pdf, margin + (metricW + 2) * 2, y, metricW, "Confianca Biometrica", row.confianca_biometrica, [15, 23, 42], 1);
  addLabeledValue(pdf, margin + (metricW + 2) * 3, y, metricW, "Decisao", row.decisao_biometrica, actionColor, 1);
  y += 22;

  y = addSectionTitle(pdf, margin, y + 2, contentW, "Laudo Pericial", "Narrativa e recomendacao");
  y += addParagraph(pdf, margin, y, contentW, "Descricao Profissional", row.descricao_profissional || "-", [37, 99, 235]) + 4;
  y += addParagraph(pdf, margin, y, contentW, "Motivo", row.motivo || "-", [107, 114, 128]) + 4;
  y += addParagraph(pdf, margin, y, contentW, "Motivo Face Mesh", row.motivo_face_mesh || "-", [107, 114, 128]) + 4;
  y += addParagraph(pdf, margin, y, contentW, "Recomendacao Operacional", row.recomendacao_operacional || row.camera_recomendacao || "-", actionColor) + 4;

  const listItems = [
    { title: "Indicios de Semelhanca", items: parseList(row.indicios_semelhanca), color: [22, 163, 74] },
    { title: "Indicios de Diferenca", items: parseList(row.indicios_diferenca), color: [220, 38, 38] },
    { title: "Limitacoes", items: parseList(row.limitacoes), color: [100, 116, 139] },
  ];
  for (const block of listItems) {
    if (!block.items.length) continue;
    const needed = 12 + block.items.length * 5;
    if (y + needed > pageH - 18) {
      pdf.addPage();
      y = 12;
    }
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.roundedRect(margin, y, contentW, needed, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(...block.color);
    pdf.text(String(block.title).toUpperCase(), margin + 4, y + 6);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text(block.items.map((item) => `- ${item}`).join("\n"), margin + 4, y + 12);
    y += needed + 4;
  }

  y = addSectionTitle(pdf, margin, y + 2, contentW, "Camera_", "Parametros e sinais tecnicos");
  const camMetricW = (contentW - 6) / 3;
  addLabeledValue(pdf, margin, y, camMetricW, "Enquadramento", row.camera_enquadramento || "-", actionColor, 2);
  addLabeledValue(pdf, margin + camMetricW + 3, y, camMetricW, "Area Rosto", row.camera_area_rosto_percentual != null ? `${row.camera_area_rosto_percentual}%` : "-", actionColor, 2);
  addLabeledValue(pdf, margin + (camMetricW + 3) * 2, y, camMetricW, "Posicao Rosto", row.camera_posicao_rosto || "-", actionColor, 2);
  y += 22;
  y += addParagraph(pdf, margin, y, contentW, "Avaliacao Camera", row.avaliacao_camera || "-", [37, 99, 235]) + 4;
  y += addParagraph(pdf, margin, y, contentW, "Recomendacao Camera", row.camera_recomendacao || row.recomendacao_camera || "-", actionColor) + 4;
  const problemas = parseList(row.problemas_enquadramento_camera);
  if (problemas.length) {
    y += addParagraph(pdf, margin, y, contentW, "Problemas de Enquadramento", problemas.map((item) => `- ${item}`).join("\n"), [220, 38, 38]) + 4;
  }

  y = addSectionTitle(pdf, margin, y + 2, contentW, "Dados Complementares", "Resumo rapido da operacao");
  const compW = (contentW - 4) / 2;
  addLabeledValue(pdf, margin, y, compW, "Status Cartao", row.status_cartao || "-", [15, 23, 42]);
  addLabeledValue(pdf, margin + compW + 4, y, compW, "Status Inspecao", row.status_inspecao || "-", [15, 23, 42]);
  y += 20;
  addLabeledValue(pdf, margin, y, compW, "Ultima leitura", formatDateTimeBR(row.created_at || row.data_hora_evento), [15, 23, 42]);
  addLabeledValue(pdf, margin + compW + 4, y, compW, "Data do evento", formatDateBR(row.data_hora_evento), [15, 23, 42]);
  y += 20;

  if (mapaImg) {
    y = addSectionTitle(pdf, margin, y + 2, contentW, "Mapa Facial", "Imagem auxiliar");
    const imgH2 = 60;
    addImageBox(pdf, margin, y, contentW, imgH2, "Mapa Facial Visual", mapaImg);
    y += imgH2 + 4;
  }

  if (y > pageH - 24) {
    pdf.addPage();
    y = 12;
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 116, 139);
  pdf.text(`Laudo gerado em ${new Date().toLocaleString("pt-BR")}`, margin, pageH - 8);
  pdf.text(`INOVE Monitoramento`, pageW - margin, pageH - 8, { align: "right" });

  const fileName = `Laudo_Inove_${String(row.prefixo || row.veiculo || row.id || "laudo").replace(/[^\w-]+/g, "-")}.pdf`;
  pdf.save(fileName);
}
