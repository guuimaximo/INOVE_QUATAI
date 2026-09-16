// Lógica de pneus sem tela (sem React, sem IO): usada pela Troca de Pneus e
// pelo Resumo da página de Controle de Pneus. Roda no Node para teste.

const norm = (value) => String(value || "").trim();

function parseDateValue(value) {
  if (!value) return null;
  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

// Dias corridos (calendário local) entre a data e hoje.
export function diffDaysFromToday(value, hoje = new Date()) {
  const start = parseDateValue(value);
  if (!start) return 0;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.floor((nowUtc - startUtc) / 86400000));
}

// Carros sem auditoria de pneus há mais de 30 dias (ou nunca auditados).
export const DIAS_AUDITORIA = 30;
export function buildAuditoriaAtrasadaList(prefixos, auditorias, hoje = new Date()) {
  const ultimaPorPrefixo = new Map();

  for (const row of auditorias || []) {
    const prefixo = norm(row?.prefixo);
    if (!prefixo) continue;
    const atual = parseDateValue(row.created_at);
    if (!atual) continue;

    const existente = ultimaPorPrefixo.get(prefixo);
    if (!existente || atual.getTime() > existente.getTime()) {
      ultimaPorPrefixo.set(prefixo, atual);
    }
  }

  return (prefixos || [])
    .map((item) => {
      const prefixo = norm(item?.codigo);
      if (!prefixo) return null;
      const ultima = ultimaPorPrefixo.get(prefixo) || null;
      const diasSemAuditoria = ultima ? diffDaysFromToday(ultima.toISOString(), hoje) : 9999;

      if (ultima && diasSemAuditoria <= DIAS_AUDITORIA) return null;

      return {
        id: item?.id || prefixo,
        prefixo,
        cluster: norm(item?.cluster),
        ultimaAuditoria: ultima ? ultima.toISOString() : "",
        diasSemAuditoria: ultima ? diasSemAuditoria : null,
        semAuditoria: !ultima,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.semAuditoria && !b.semAuditoria) return -1;
      if (!a.semAuditoria && b.semAuditoria) return 1;
      return (b.diasSemAuditoria || 0) - (a.diasSemAuditoria || 0);
    });
}

// ---------- RESUMO: o que foi lançado e o que está pendente ----------
// Data local (BRT), nunca UTC — ver skill inove-playbook.
const isoLocal = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export function segundaDe(data) {
  const d = new Date(data);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return isoLocal(d);
}

export const SEMANAS_TROCAS = 10;
export const DIAS_RISCADO_ALERTA = 10;

export function montarResumoLancamentos({ trocas = [], auditorias = [], prefixos = [], consertos = [], riscados = [], hoje = new Date() }) {
  // Trocas por semana (segunda a domingo), da mais antiga até a atual.
  const semanaAtual = segundaDe(hoje);
  const semanas = [];
  for (let i = SEMANAS_TROCAS - 1; i >= 0; i--) {
    const d = new Date(semanaAtual + "T00:00:00");
    d.setDate(d.getDate() - 7 * i);
    semanas.push({ semana: isoLocal(d), lancadas: 0, semLancar: 0 });
  }
  const porSemana = new Map(semanas.map((s) => [s.semana, s]));
  const semLancar = [];
  for (const t of trocas) {
    const quando = parseDateValue(t.created_at);
    if (!quando) continue;
    const s = porSemana.get(segundaDe(quando));
    if (s) {
      if (t.transnet_lancado_em) s.lancadas += 1;
      else s.semLancar += 1;
    }
    if (!t.transnet_lancado_em) semLancar.push({ ...t, dias: diffDaysFromToday(t.created_at, hoje) });
  }
  semLancar.sort((a, b) => b.dias - a.dias);
  const atual = porSemana.get(semanaAtual);

  const consertosAbertos = consertos
    .filter((c) => norm(c.status).toUpperCase() !== "CONCLUIDO")
    .map((c) => ({ ...c, status: norm(c.status) || "PENDENTE", dias: diffDaysFromToday(c.created_at, hoje) }))
    .sort((a, b) => b.dias - a.dias);

  const riscadosAbertos = riscados
    .filter((r) => norm(r.status).toUpperCase() !== "RESOLVIDO")
    .map((r) => ({ ...r, status: norm(r.status) || "ABERTO", dias: diffDaysFromToday(r.data_riscado || r.created_at, hoje) }))
    .sort((a, b) => b.dias - a.dias);

  return {
    semanaAtual,
    trocasPorSemana: semanas,
    trocasSemana: atual ? atual.lancadas + atual.semLancar : 0,
    trocasSemanaSemLancar: atual ? atual.semLancar : 0,
    trocasTotal: trocas.length,
    trocasSemLancar: semLancar,
    auditoriaAtrasada: buildAuditoriaAtrasadaList(prefixos, auditorias, hoje),
    frota: prefixos.length,
    consertosAbertos,
    riscadosAbertos,
    riscadosVelhos: riscadosAbertos.filter((r) => r.dias >= DIAS_RISCADO_ALERTA).length,
  };
}
