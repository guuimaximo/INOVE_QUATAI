// Logica de preventivas (porta do gerador Python). Nao faz IO — recebe as linhas
// cruas de ultimo_plano e devolve os dados para a Gerencial e a Programacao.

const num = (x) => {
  const v = parseFloat(x);
  return Number.isFinite(v) ? v : null;
};
const fdate = (s) => {
  if (!s || s.length < 10) return null;
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
};
const median = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

export const WINDOW_KM = 3000;
export const CONCESS = new Set(["2645", "2646"]);

// Colunas da Gerencial (mesmo modelo do Excel).  tipo: km | dias | calc | blank
export const GERENCIAL_COLS = [
  { t: "INSP 5.000", id: "2305", tipo: "km" },
  { t: "REVISÃO", id: "2306", tipo: "km" },
  { t: "REV.VENCIDA", id: null, tipo: "calc" },
  { t: "ÓLEO MOTOR", id: "726", tipo: "km" },
  { t: "ÓLEO CÂMBIO", id: "757", tipo: "km" },
  { t: "ÓLEO DIFER.", id: "758", tipo: "km" },
  { t: "FILTRO AR", id: "1299", tipo: "km" },
  { t: "FILTRO ARLA", id: "2314", tipo: "km" },
  { t: "FILTRO APU", id: "2345", tipo: "km" },
  { t: "FILTRO HIDR.", id: "2309", tipo: "km" },
  { t: "CUBO DT", id: "1300", tipo: "km" },
  { t: "EMBREAGEM", id: "1132", tipo: "km" },
  { t: "FLUIDO EMBR.", id: "1585", tipo: "km" },
  { t: "LIMPEZA GERAL", id: "2167", tipo: "km" },
  { t: "TANQUE ARLA", id: "2965", tipo: "km" },
  { t: "LIMPEZA DPF", id: "2966", tipo: "km" },
  { t: "SERPENTINA", id: "2311", tipo: "km" },
  { t: "TCO", id: "1239", tipo: "dias" },
];

// Quadros de servico da Programacao (satelites conciliados na 10.000)
export const BOXES = [
  { t: "TROCA DE ÓLEO E FILTROS", ids: ["726"] },
  { t: "TROCA DE ÓLEO DE CÂMBIO", ids: ["757"] },
  { t: "TROCA DE ÓLEO DE DIFERENCIAL", ids: ["758"] },
  { t: "TROCA DO FILTRO DE AR", ids: ["1299"] },
  { t: "RETENTOR E GRAXA DO CUBO DIANTEIRO", ids: ["1300"] },
  { t: "FILTRO APU / SERPENTINAS", ids: ["2345", "2311"] },
  { t: "TROCA FILTRO ARLA", ids: ["2314"] },
  { t: "TROCA FILTRO HIDRÁULICO", ids: ["2309"] },
  { t: "AFERIÇÃO DE TACÓGRAFO", ids: ["1239"] },
  { t: "REVISÃO SISTEMA EMBREAGEM", ids: ["1132"] },
  { t: "TROCA FLUÍDO EMBREAGEM", ids: ["1585"] },
  { t: "LIMPEZA TANQUE DE ARLA E PESCADOR", ids: ["2965"] },
  { t: "LIMPEZA FILTRO DPF", ids: ["2966"] },
];

const DOW_NOMES = [
  "Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira",
  "Quinta-Feira", "Sexta-Feira", "Sábado",
];
const fmtBR = (d) =>
  d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : "—";

// Monta o estado por carro a partir das linhas cruas.
// Carros fora da frota de ônibus: placas de passeio (prefixo com 3 letras no
// início, ex: PKB3382, BZA7H86) e parados com dado ruim.
const ehPlaca = (v) => /^[A-Za-z]{3}/.test(v || "");
const PARADOS = new Set(["110797"]);

export function montarCarros(rows) {
  const cars = new Map();
  for (const r of rows) {
    const v = r.nr_ordem;
    if (ehPlaca(v) || PARADOS.has(v)) continue; // remove passeio (placa) e parados
    if (!cars.has(v)) cars.set(v, { veic: v, byplan: {}, kmdias: [], gar: false, odom: 0 });
    const c = cars.get(v);
    c.byplan[r.id_plano] = r;
    if (CONCESS.has(r.id_plano)) c.gar = true;
    const kr = num(r.km_rodado), dv = num(r.dias_vencido), qk = num(r.qt_km_intervalo);
    if (qk && qk > 0 && kr && dv && dv > 30) c.kmdias.push(kr / dv);
    const atual = (num(r.nr_hodometro) || 0) + (num(r.km_rodado) || 0);
    if (atual) c.odom = Math.max(c.odom, atual);
  }
  for (const c of cars.values()) {
    c.kmdia = c.kmdias.length ? Math.round(median(c.kmdias) * 10) / 10 : null;
  }
  return cars;
}

const kmp = (c, id) => {
  const r = c.byplan[id];
  return r ? num(r.km_para_proxima) : null;
};
const diasCode = (c, id) => {
  const r = c.byplan[id];
  if (!r) return null;
  const qk = num(r.qt_km_intervalo);
  if (qk === 0) {
    const dv = num(r.dias_vencido);
    return dv == null ? null : Math.round(-dv);
  }
  const k = kmp(c, id);
  if (k == null || !c.kmdia || c.kmdia <= 0) return null;
  return Math.round(-k / c.kmdia);
};

// Frescor do dado: data mais recente da base.
export function ultimaAtualizacao(rows) {
  let ref = null;
  for (const r of rows) {
    for (const campo of ["data_abastecimento", "dt_fechamento_os", "dt_abertura_os"]) {
      const d = fdate(r[campo]);
      if (d && (!ref || d > ref)) ref = d;
    }
  }
  return ref;
}

// ---------- GERENCIAL: 1 linha por carro, colunas por plano ----------
export function montarGerencial(cars) {
  const linhas = [];
  for (const c of [...cars.values()].sort((a, b) => a.veic.localeCompare(b.veic))) {
    const rRev = c.byplan["2306"];
    const du = rRev ? fdate(rRev.dt_fechamento_os) : null;
    const semana = du ? isoWeek(du) : null;
    const cols = GERENCIAL_COLS.map((col) => {
      if (col.tipo === "km") {
        const v = kmp(c, col.id);
        return { v, venc: v != null && v >= 0, texto: v != null ? Math.round(v) : "" };
      }
      if (col.tipo === "dias") {
        const r = c.byplan[col.id];
        const dv = r ? num(r.dias_vencido) : null;
        return { v: dv, venc: dv != null && dv >= 0, texto: dv != null ? Math.round(dv) : "" };
      }
      // calc: revisao vencida?
      const rev = kmp(c, "2306");
      const venc = rev != null && rev >= 0;
      return { v: rev, venc, texto: rev == null ? "" : venc ? "VENCIDA" : "NÃO", isCalc: true };
    });
    linhas.push({ veic: "046-" + c.veic, semana, dataUlt: fmtBR(du), kmdia: c.kmdia, odom: c.odom, cols });
  }
  // Bloco de aderencia (por plano)
  const aderencia = GERENCIAL_COLS.filter((col) => col.id).map((col) => {
    let tot = 0, atr = 0;
    for (const c of cars.values()) {
      const r = c.byplan[col.id];
      if (!r) continue;
      const val = col.tipo === "dias" ? num(r.dias_vencido) : num(r.km_para_proxima);
      if (val == null) continue;
      tot += 1;
      if (val >= 0) atr += 1;
    }
    return { nome: col.t, atrasadas: atr, total: tot, adr: tot ? 1 - atr / tot : null };
  }).filter((x) => x.total > 0);
  return { linhas, aderencia };
}

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

// ---------- PROGRAMACAO: 10.000 (amanha->sexta) + 5.000 (hoje + semana) ----------
export function montarProgramacao(cars, hoje = new Date()) {
  const inhouse = [...cars.values()];
  for (const c of inhouse) {
    c.oleo = diasCode(c, "726");
    c.insp5 = diasCode(c, "2305");
    c.rev10 = diasCode(c, "2306");
    c.tipo = c.rev10 != null && (c.insp5 == null || c.rev10 <= c.insp5) ? "10K"
      : c.insp5 != null ? "5K" : (c.oleo != null ? "10K" : "5K");
  }
  const gat10 = (c) => {
    const vs = [c.rev10, c.oleo].filter((x) => x != null);
    return vs.length ? Math.min(...vs) : null;
  };
  const drv10 = (c) =>
    c.rev10 != null && (c.oleo == null || c.rev10 <= c.oleo) ? "Rev.10k" : "Óleo";
  const precisa = (c, id) => {
    if (id === "1239") { const d = diasCode(c, "1239"); return d != null && d <= 15; }
    const rk = kmp(c, id);
    return rk != null && -rk <= WINDOW_KM;
  };

  const fila10 = inhouse.filter((c) => c.tipo === "10K" && gat10(c) != null).sort((a, b) => gat10(a) - gat10(b));
  const fila5 = inhouse.filter((c) => c.tipo === "5K" && c.insp5 != null).sort((a, b) => a.insp5 - b.insp5);

  // dias uteis de amanha ate sexta desta semana
  const base = new Date(hoje); base.setHours(0, 0, 0, 0);
  const dow = base.getDay(); // 0=dom
  const diffFri = (5 - dow + 7) % 7 || 7; // proxima sexta (>=1)
  let fri = new Date(base); fri.setDate(base.getDate() + diffFri);
  if (dow >= 5 || dow === 0) { fri = new Date(base); fri.setDate(base.getDate() + ((5 - dow + 7) % 7 || 7)); }
  const dias = [];
  const cur = new Date(base); cur.setDate(base.getDate() + 1);
  while (cur <= fri) {
    if (cur.getDay() >= 1 && cur.getDay() <= 5) dias.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  const ND = dias.length;

  const carros10 = fila10.slice(0, 3 * ND);
  const boxVeic = {};
  for (const b of BOXES) boxVeic[b.t] = [];
  const prog10 = dias.map((d, di) => {
    const grp = carros10.slice(di * 3, di * 3 + 3).map((c) => {
      for (const b of BOXES) if (b.ids.some((id) => precisa(c, id))) boxVeic[b.t].push("046-" + c.veic);
      return { veic: "046-" + c.veic, gat: gat10(c), drv: drv10(c), kmdia: c.kmdia };
    });
    return { dow: DOW_NOMES[d.getDay()], data: fmtBR(d).slice(0, 5), cars: grp };
  });

  const insp5Hoje = fila5.slice(0, 3).map((c) => ({ veic: "046-" + c.veic, gat: c.insp5, kmdia: c.kmdia }));
  const restante = fila5.slice(3, 3 + 3 * ND);
  const prog5 = dias.map((d, di) => ({
    dow: DOW_NOMES[d.getDay()], data: fmtBR(d).slice(0, 5),
    cars: restante.slice(di * 3, di * 3 + 3).map((c) => ({ veic: "046-" + c.veic, gat: c.insp5, kmdia: c.kmdia })),
  }));

  return {
    hoje: fmtBR(base).slice(0, 5),
    dias10: prog10,
    hoje5: insp5Hoje,
    dias5: prog5,
    boxes: BOXES.map((b) => ({ nome: b.t, veics: boxVeic[b.t] })).filter((b) => b.veics.length),
    nPrev: prog10.reduce((s, d) => s + d.cars.length, 0),
    nInsp: insp5Hoje.length + prog5.reduce((s, d) => s + d.cars.length, 0),
  };
}

// ---------- GARANTIA (Euro6): revisão 60k na concessionária, save 500km ----------
export const GAR_FEITOS = new Set([
  "242522", "242520", "242517", "242514", "242505", "242513",
]);
const GAR_BUFFER = 500;
const addDias = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

export function montarGarantia(cars, hoje = new Date()) {
  const base = new Date(hoje);
  base.setHours(0, 0, 0, 0);
  const out = [];
  for (const c of cars.values()) {
    if (!c.gar || !c.kmdia || c.kmdia <= 0 || !c.odom) continue;
    let faltam = null;
    for (const id of CONCESS) {
      const k = kmp(c, id);
      if (k == null) continue;
      const rk = -k; // faltam km
      if (faltam == null || rk < faltam) faltam = rk;
    }
    if (faltam == null) continue;
    const milestone = Math.round((c.odom + faltam) / 30000) * 30000;
    const venceD = faltam / c.kmdia;
    const alvoD = (faltam - GAR_BUFFER) / c.kmdia;
    const vence = addDias(base, Math.round(venceD));
    const alvo = addDias(base, Math.max(0, Math.round(alvoD)));
    const done = GAR_FEITOS.has(c.veic);
    out.push({
      veic: "046-" + c.veic,
      odom: Math.round(c.odom),
      milestone,
      falta: Math.round(faltam),
      kmdia: c.kmdia,
      vence: fmtBR(vence),
      alvo: fmtBR(alvo),
      alvoSort: alvo.getTime(),
      done,
    });
  }
  // pendentes por data de chamada; feitos (OK) no fim
  out.sort((a, b) => (a.done === b.done ? a.alvoSort - b.alvoSort : a.done ? 1 : -1));
  return out;
}

export { fmtBR };
