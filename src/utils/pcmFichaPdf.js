// PDF "ficha" para Auditoria e Troca de Pneus.
// Mesmo visual da ficha de Serviço Externo (SuprimentosServicoExterno.jsx).

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

const BASE_STYLES = `
  @page { size: A4; margin: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  html { margin: 0; padding: 0; }
  body {
    margin: 0;
    padding: 18mm 14mm 22mm 14mm;
    font-family: Arial, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #0f172a;
  }
  h1, h2, h3, p { margin: 0; padding: 0; }
  .nobreak { break-inside: avoid; page-break-inside: avoid; }
  .mb-3 { margin-bottom: 12px; }
  .mt-4 { margin-top: 16px; }
  .doc-header {
    display: flex; align-items: stretch; justify-content: space-between; gap: 16px;
    border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 12px;
  }
  .brand { display: flex; align-items: center; gap: 10px; min-width: 140px; align-self: center; }
  .brand img { width: 48px; height: 48px; object-fit: contain; display: block; }
  .brand-name { font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.12em; }
  .brand-sub { font-size: 8.5px; color: #64748b; letter-spacing: 0.18em; text-transform: uppercase; margin-top: 2px; }
  .doc-title-block { flex: 1; text-align: center; align-self: center; }
  .doc-title { font-size: 18px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.04em; line-height: 1.15; }
  .doc-subtitle { font-size: 10px; color: #475569; margin-top: 2px; }
  .doc-meta {
    text-align: right; font-size: 9.5px; color: #475569;
    display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    min-width: 140px; align-self: center;
  }
  .status-pill {
    display: inline-block; padding: 2px 10px; border-radius: 999px;
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    background: #dbeafe; color: #1e3a8a; border: 1px solid #93c5fd;
  }
  .section-title {
    background: #1e3a8a; color: #fff; font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em;
    padding: 8px 10px; margin-bottom: 6px; border-radius: 2px;
    line-height: 1;
  }
  .field-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px;
    border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 3px; background: #f8fafc;
  }
  .field-grid .full { grid-column: 1 / -1; }
  .field-label {
    font-size: 9px; color: #475569; text-transform: uppercase;
    letter-spacing: 0.05em; font-weight: 600; display: block;
  }
  .field-value { font-size: 11px; color: #0f172a; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; break-inside: auto; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  .compact th, .compact td { padding: 4px 6px; border: 1px solid #cbd5e1; vertical-align: top; }
  .compact thead th {
    background: #1e3a8a; color: #fff; font-weight: 600; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.03em; text-align: left;
  }
  .compact tbody tr:nth-child(even) td { background: #f8fafc; }
  .note-box {
    border: 1px solid #cbd5e1; border-radius: 3px; padding: 8px 10px;
    background: #f8fafc; min-height: 42px; font-size: 11px; white-space: pre-wrap;
  }
  .signature-box { text-align: center; }
  .signature-line {
    border-top: 1px solid #0f172a; margin: 40px 8px 4px 8px; padding-top: 3px;
    font-size: 10px; font-weight: 600;
  }
  .signature-role { font-size: 9px; color: #475569; }
  .footer-disclaimer {
    margin-top: 12px; font-size: 8.5px; color: #64748b; text-align: justify;
    border-top: 1px dashed #cbd5e1; padding-top: 6px;
  }
`;

function buildHeader(title, subtitle, numero, statusLabel) {
  return `
  <header class="doc-header nobreak">
    <div class="brand">
      <img src="${logoInove}" alt="INOVE" />
      <div>
        <div class="brand-name">INOVE</div>
        <div class="brand-sub">Gestão de Frota</div>
      </div>
    </div>
    <div class="doc-title-block">
      <h1 class="doc-title">${esc(title)}</h1>
      <div class="doc-subtitle">${esc(subtitle)}</div>
    </div>
    <div class="doc-meta">
      <div><strong>Nº:</strong> ${esc(numero || "-")}</div>
      <div><strong>Emissão:</strong> ${esc(new Date().toLocaleString("pt-BR"))}</div>
      ${statusLabel ? `<div><span class="status-pill">${esc(statusLabel)}</span></div>` : ""}
    </div>
  </header>`;
}

function abrirEPrint(html) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    alert("Permita pop-ups para imprimir a ficha.");
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

// ─── Auditoria ───────────────────────────────────────────────
export function printAuditoriaFicha(row) {
  if (!row) return;
  const posicoes = Array.isArray(row.posicoes) ? row.posicoes : [];
  const numero = row.ficha_auditoria || `AP-${String(row.id || "").slice(0, 6)}`;
  const lancado = row.criado_por_nome || row.criado_por_login || "-";

  const itensHtml = posicoes
    .map((p, i) => `<tr>
      <td>${i + 1}</td>
      <td><strong>${esc(p.posicao || "-")}</strong></td>
      <td>${esc(p.numero_fogo || "-")}</td>
      <td>${esc(p.calibragem || "-")}</td>
      <td>${esc(p.sulco || "-")}</td>
      <td>${esc(p.conferencia_status || "Pendente")}</td>
    </tr>`)
    .join("");

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Auditoria de Pneus ${esc(numero)}</title>
<style>${BASE_STYLES}</style></head><body>
  ${buildHeader("AUDITORIA DE PNEUS", "Ficha de conferência por posição", numero, "")}

  <section class="mb-3 nobreak">
    <div class="section-title">1. Identificação</div>
    <div class="field-grid">
      <div><span class="field-label">Ficha</span><span class="field-value">${esc(numero)}</span></div>
      <div><span class="field-label">Data</span><span class="field-value">${esc(formatDateTimeBR(row.created_at))}</span></div>
      <div><span class="field-label">Prefixo</span><span class="field-value">${esc(row.prefixo || "-")}</span></div>
      <div><span class="field-label">Quem lançou</span><span class="field-value">${esc(lancado)}</span></div>
      <div class="full"><span class="field-label">Resumo</span><span class="field-value">${esc(posicoes.length)} posições auditadas</span></div>
    </div>
  </section>

  <section class="mb-3 nobreak">
    <div class="section-title">2. Posições auditadas</div>
    <table class="compact">
      <thead><tr>
        <th style="width:30px">#</th>
        <th style="width:80px">Posição</th>
        <th>Número de fogo</th>
        <th style="width:80px">Calibragem</th>
        <th style="width:70px">Sulco</th>
        <th style="width:100px">Conferência</th>
      </tr></thead>
      <tbody>${itensHtml || '<tr><td colspan="6" style="text-align:center;padding:8px">Nenhuma posição.</td></tr>'}</tbody>
    </table>
  </section>

  ${row.observacoes ? `
  <section class="mb-3 nobreak">
    <div class="section-title">3. Observações</div>
    <div class="note-box">${esc(row.observacoes)}</div>
  </section>` : ""}

  <section class="mt-4 nobreak">
    <div class="section-title">${row.observacoes ? "4" : "3"}. Assinaturas</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px 26px;margin-top:8px">
      <div class="signature-box">
        <div class="signature-line">Auditor</div>
        <div class="signature-role">${esc(lancado)}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Responsável da garagem</div>
        <div class="signature-role">Conferência / ciência</div>
      </div>
    </div>
  </section>

  <div class="footer-disclaimer">
    Este documento registra a auditoria de pneus do veículo, com calibragem, sulco e número de fogo conferidos
    posição a posição. As partes signatárias declaram ciência dos dados lançados no sistema.
  </div>
</body></html>`;

  abrirEPrint(html);
}

// ─── Troca de Pneu ───────────────────────────────────────────
export function printTrocaFicha(row) {
  if (!row) return;
  const numero = row.ficha_troca || `TP-${String(row.id || "").slice(0, 6)}`;
  const lancado = row.criado_por_nome || row.criado_por_login || "-";
  const tipo = row.tipo_troca || "-";

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
<title>Troca de Pneu ${esc(numero)}</title>
<style>${BASE_STYLES}</style></head><body>
  ${buildHeader("TROCA DE PNEU", "Ficha de movimentação de pneus", numero, tipo)}

  <section class="mb-3 nobreak">
    <div class="section-title">1. Identificação</div>
    <div class="field-grid">
      <div><span class="field-label">Ficha</span><span class="field-value">${esc(numero)}</span></div>
      <div><span class="field-label">Data</span><span class="field-value">${esc(formatDateTimeBR(row.created_at))}</span></div>
      <div><span class="field-label">Tipo de troca</span><span class="field-value">${esc(tipo)}</span></div>
      <div><span class="field-label">Quem lançou</span><span class="field-value">${esc(lancado)}</span></div>
      ${row.ficha_auditoria_origem ? `<div class="full"><span class="field-label">Origem (auditoria)</span><span class="field-value">${esc(row.ficha_auditoria_origem)}</span></div>` : ""}
    </div>
  </section>

  <section class="mb-3 nobreak">
    <div class="section-title">2. Retirada</div>
    <div class="field-grid">
      <div><span class="field-label">Prefixo</span><span class="field-value">${esc(row.prefixo_retirada || "-")}</span></div>
      <div><span class="field-label">Posição</span><span class="field-value">${esc(row.posicao_retirada || "-")}</span></div>
      <div><span class="field-label">Nº de fogo retirado</span><span class="field-value">${esc(row.numero_fogo_retirado || "-")}</span></div>
      <div><span class="field-label">Origem recebeu</span><span class="field-value">${esc(row.origem_recebeu || "-")}</span></div>
      ${row.numero_fogo_origem_recebido ? `<div class="full"><span class="field-label">Pneu que entrou no carro de origem</span><span class="field-value">${esc(row.numero_fogo_origem_recebido)}</span></div>` : ""}
    </div>
  </section>

  <section class="mb-3 nobreak">
    <div class="section-title">3. Instalação</div>
    <div class="field-grid">
      <div><span class="field-label">Prefixo</span><span class="field-value">${esc(row.prefixo_instalacao || "-")}</span></div>
      <div><span class="field-label">Posição</span><span class="field-value">${esc(row.posicao_instalacao || "-")}</span></div>
      <div><span class="field-label">Nº de fogo colocado</span><span class="field-value">${esc(row.numero_fogo_colocado || "-")}</span></div>
      ${row.numero_fogo_destino_retirado ? `<div><span class="field-label">Pneu que saiu do destino (vai pro estoque)</span><span class="field-value">${esc(row.numero_fogo_destino_retirado)}</span></div>` : ""}
    </div>
  </section>

  ${row.observacoes ? `
  <section class="mb-3 nobreak">
    <div class="section-title">4. Observações</div>
    <div class="note-box">${esc(row.observacoes)}</div>
  </section>` : ""}

  <section class="mt-4 nobreak">
    <div class="section-title">${row.observacoes ? "5" : "4"}. Assinaturas</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:18px 26px;margin-top:8px">
      <div class="signature-box">
        <div class="signature-line">Responsável pela troca</div>
        <div class="signature-role">${esc(lancado)}</div>
      </div>
      <div class="signature-box">
        <div class="signature-line">Responsável da garagem</div>
        <div class="signature-role">Conferência / ciência</div>
      </div>
    </div>
  </section>

  <div class="footer-disclaimer">
    Este documento registra a movimentação de pneus do veículo conforme dados lançados no sistema. As partes
    signatárias declaram ciência das posições, números de fogo e demais informações descritas.
  </div>
</body></html>`;

  abrirEPrint(html);
}
