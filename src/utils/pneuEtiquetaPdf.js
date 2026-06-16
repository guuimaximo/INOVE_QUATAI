// Gera etiquetas de pneu (info + código de barras CODE128) numa janela
// de impressão. Usa jsbarcode pra renderizar o código como SVG inline.

import JsBarcode from "jsbarcode";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function barcodeSvg(value) {
  if (!value) return "";
  try {
    // jsbarcode precisa de um nó DOM — usamos um documento offscreen.
    const xmlDoc = document.implementation.createDocument(
      "http://www.w3.org/2000/svg",
      "svg",
      null
    );
    const node = xmlDoc.documentElement;
    JsBarcode(node, String(value), {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      height: 50,
      margin: 0,
      background: "#ffffff",
    });
    return new XMLSerializer().serializeToString(node);
  } catch (e) {
    console.error("Falha gerando código de barras:", e);
    return `<div style="font-family:monospace">${esc(value)}</div>`;
  }
}

function etiquetaHtml(row) {
  const numero = row.pneu || row.numero_fogo || "-";
  const ficha = row.ficha_estoque || "-";
  const marca = row.marca || "-";
  const situacao = row.situacao_inove || row.situacao || "-";
  const status = row.status || "";
  const local = row.local || "";
  return `<div class="etiqueta">
    <div class="brand">INOVE · QUATAI</div>
    <div class="grid">
      <div><span class="lab">Ficha</span><span class="val">${esc(ficha)}</span></div>
      <div><span class="lab">Marca</span><span class="val">${esc(marca)}</span></div>
      <div><span class="lab">Situação</span><span class="val">${esc(situacao)}</span></div>
      ${status ? `<div><span class="lab">Status</span><span class="val">${esc(status)}</span></div>` : ""}
      ${local ? `<div class="full"><span class="lab">Local</span><span class="val">${esc(local)}</span></div>` : ""}
    </div>
    <div class="codigo">
      <div class="fogo">Nº de fogo: <strong>${esc(numero)}</strong></div>
      <div class="bar">${barcodeSvg(numero)}</div>
    </div>
  </div>`;
}

export function printEtiquetasPneus(rows) {
  const lista = Array.isArray(rows) ? rows.filter((r) => r && (r.pneu || r.numero_fogo)) : [];
  if (!lista.length) {
    alert("Nenhum pneu para gerar etiqueta.");
    return;
  }

  const etiquetasHtml = lista.map(etiquetaHtml).join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Etiquetas de pneu (${lista.length})</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; color: #0f172a; }
  .sheet {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 60mm;
    gap: 4mm;
  }
  .etiqueta {
    border: 1.5px solid #0f172a;
    border-radius: 6px;
    padding: 6px 8px;
    background: #fff;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    display: flex;
    flex-direction: column;
    height: 60mm;
    overflow: hidden;
  }
  .brand {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #1e3a8a;
    border-bottom: 1px dashed #94a3b8;
    padding-bottom: 4px;
    margin-bottom: 6px;
    text-align: center;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 8px;
    margin-bottom: 6px;
  }
  .grid .full { grid-column: 1 / -1; }
  .grid > div {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 3px 6px;
    border-radius: 3px;
  }
  .lab {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #475569;
  }
  .val {
    font-size: 11px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.15;
  }
  .codigo {
    margin-top: auto;
    padding-top: 6px;
    border-top: 1px dashed #94a3b8;
    text-align: center;
  }
  .fogo {
    font-size: 11px;
    margin-bottom: 4px;
  }
  .fogo strong { font-size: 14px; letter-spacing: 0.05em; }
  .bar svg { width: 100%; height: 60px; }
  @media print {
    .etiqueta { box-shadow: none; }
  }
</style></head><body>
  <div class="sheet">${etiquetasHtml}</div>
</body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("Permita pop-ups para gerar etiquetas.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  // pequeno delay pra renderizar antes do print
  setTimeout(() => w.print(), 200);
}
