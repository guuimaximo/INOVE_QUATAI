// Reduz a resolucao/peso de uma imagem ANTES de exibir/enviar.
// Foto de celular sai com 8-12 MP (varios MB); processar/enviar isso na thread
// principal trava a UI ("foto demora a entrar"). Aqui reescalamos para no maximo
// `maxSize` px no maior lado e reexportamos como JPEG, derrubando o peso para
// algumas centenas de KB sem perda visivel para evidencia.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function compressImageFile(
  file,
  { maxSize = 1600, quality = 0.8, mimeType = "image/jpeg" } = {}
) {
  // So comprime imagem; PDFs/videos passam direto.
  if (!file || !String(file.type || "").startsWith("image/")) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { naturalWidth: w, naturalHeight: h } = img;

    // Ja esta pequena o suficiente: nao reprocessa.
    if (Math.max(w, h) <= maxSize) return file;

    const scale = maxSize / Math.max(w, h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));

    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
    if (!blob) return file;

    const baseName = String(file.name || "foto").replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, { type: mimeType, lastModified: Date.now() });
  } catch {
    // Em qualquer falha, devolve o arquivo original (nunca trava o fluxo).
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
