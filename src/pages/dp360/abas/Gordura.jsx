import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, CalendarClock, Info, PauseCircle, X } from "lucide-react";
import AbaShell from "./AbaShell";
import { lerDatasDP360, lerTudoDP360 } from "../../../services/dp360Api";
// A reserva LANÇADA pelo gestor mora na base do PRÓPRIO INOVE (tabela
// `reservas_motoristas` — quem grava é src/pages/pessoas/ControleReservas.jsx:91-99 e
// 460-489), NÃO na base de importação do DP360. Por isso ela não está (nem deve estar)
// na allowlist do gateway `dp360-api`: aqui se lê com o cliente Supabase normal do
// INOVE, exatamente como o app antigo faz em ferramenta/supabase_client.py:695-715.
import { supabase } from "../../../supabase";

// ---------------------------------------------------------------------------
// PASSO 4 — GORDURA DE PONTO (só MOTORISTA).
//
// Gordura = tempo que a pessoa BATEU PONTO A MAIS do que operou, medido só nas
// PONTAS (entrada e saída), nunca na jornada inteira. Interno/aprendiz não têm
// operação (GPS/SST/bilhetagem), então não há gordura a calcular — o tratamento
// deles é o aviso da Revisão (Passo 2).
//
// Porte de `viewP4Motorista` (Sistemas/PONTO — app/ui/app.js) + das camadas que
// o app antigo aplica na LEITURA (app/main.py `_gord`).
//
// NESTA FASE A ABA É SOMENTE LEITURA: nada é gravado e o envio de comunicado
// ainda não existe aqui (ver TODO em `Gordura`).
// ---------------------------------------------------------------------------

// RÉGUA FIXA DO DP (main.py TOL_ENTRADA_MIN / TOL_SAIDA_MIN, decisão de 24/08/2026:
// "10 e 8 em tudo"). NÃO é configuração de tela: ele bate o ponto e ainda anda até o
// carro (entrada −10 min) e, no fim, estaciona/confere e volta ao relógio (saída +8).
// Estes números também vivem no SQL da Revisão — mexeu aqui, mexe lá.
const TOL_ENTRADA = 10;
const TOL_SAIDA = 8;

// Assinatura da reserva sem lançamento (main.py `_aplica_reserva_gps`).
const RES_GPS_ESCALA = 15; // GPS × escala: até isso é a mesma hora
const RES_GPS_BILH = 30; // bilhetagem depois disso do GPS = ele estava esperando, não rodando

// Tolerância aplicada DEPOIS da união com a reserva lançada (main.py:4876 e 4884).
// AMBIGUIDADE (herdada do original): aqui o Python usa 10 nas DUAS pontas, enquanto a
// régua declarada na tela e usada em `camadaAlvo` é 10 na entrada e 8 na SAÍDA
// (TOL_SAIDA). Ou seja, uma saída com 9 min de gordura vira TOLERANCIA_OPERACIONAL
// nesta camada e seria P-alguma-coisa em qualquer outro caminho. Portado como está para
// não divergir do app antigo; se o DP decidir alinhar, é só trocar esta constante por
// TOL_SAIDA no lado da saída.
const TOL_RESERVA_INOVE = 10;

const PISOS = [
  { valor: 0, rotulo: "tudo" },
  { valor: 15, rotulo: "15 min" },
  { valor: 30, rotulo: "30 min" },
  { valor: 60, rotulo: "1 hora" },
  { valor: 120, rotulo: "2 horas" },
];

/* ------------------------- conversões (campos são TEXTO) ------------------- */
// ATENÇÃO: em `ponto_gordura` TODAS as colunas são text — inclusive minutos e
// booleanos ("true"/"false"). Nada aqui pode assumir number/boolean nativo.
const txt = (v) => (v == null ? "" : String(v).trim());
const ehVerdade = (v) => ["true", "t", "1", "sim", "yes", "y"].includes(txt(v).toLowerCase());
const num = (v) => {
  const n = Number.parseFloat(txt(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const modulo = (v) => Math.abs(num(v) || 0);
// Crachá com menos de 8 dígitos vira 8 com zeros à esquerda (main.py `_cracha8`).
const cracha8 = (c) => {
  const s = txt(c);
  return /^\d+$/.test(s) && s.length > 0 && s.length < 8 ? s.padStart(8, "0") : s;
};
const dia10 = (d) => txt(d).slice(0, 10);
const chaveDe = (cra, dia) => `${cracha8(cra)}|${dia10(dia)}`;

// "0130" -> "01:30" (a escala vem sem os dois pontos na gordura). Texto que não
// vira horário volta vazio — melhor a célula ficar "—" do que exibir lixo.
function fmtHora(valor) {
  const s = txt(valor);
  if (!s) return "";
  if (s.includes(":")) return s.slice(0, 5);
  const d = s.replace(/\D/g, "");
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return "";
}
function hm2m(valor) {
  const t = fmtHora(valor);
  const m = /^(\d{1,3}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
function m2hm(minutos) {
  const v = Math.round(minutos);
  const h = Math.floor(v / 60);
  const m = ((v % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
// Variante de t (t−24h, t, t+24h) mais perto de ref — é o que faz 02:08 casar com a
// batida 26:08 do cartão em vez de virar 02:08 da madrugada errada (simulador.var).
const variante = (t, ref) =>
  [t - 1440, t, t + 1440].reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a));
// Minutos entre dois horários no relógio, sempre 0..720 (main.py `_dif_relogio`).
const difRelogio = (a, b) => {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
};
function durHM(ini, fim, almoco = 0) {
  const a = hm2m(ini);
  const b = hm2m(fim);
  if (a == null || b == null) return "—";
  let d = b - a;
  if (d < 0) d += 1440;
  d -= almoco;
  if (d < 0) d = 0;
  return `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}`;
}
const fmtData = (d) => {
  const iso = dia10(d);
  if (iso.length !== 10) return iso || "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};
const H = (v) => fmtHora(v) || "—";
const semAcento = (s) =>
  txt(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/* --------------------------------- níveis ---------------------------------- */
const NIVEL_LBL = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P3_SEM_CONFIRMACAO: "P3⁻",
  P4: "P4",
  RESERVA: "Reserva",
  OPERACAO_FORA_PONTO: "fora do ponto",
  NAO_CALCULAR: "n/calc",
  ANOMALIA_TEMPORAL: "anomalia",
};
// Variantes de `.dp-gmark` (dp360.css) — as MESMAS cores de nível da ferramenta
// (app/ui/styles.css `.gmark.g-p1..g-neu`), não a paleta do INOVE.
const NIVEL_GCLS = {
  P1: "g-p1",
  P2: "g-p2",
  P3: "g-p3",
  P3_SEM_CONFIRMACAO: "g-p3",
  P4: "g-p4",
  RESERVA: "g-res",
  OPERACAO_FORA_PONTO: "g-fora",
  NAO_CALCULAR: "g-neu",
  ANOMALIA_TEMPORAL: "g-neu",
};
// Tolerância / sem dado / ponto incompleto não são gordura: a célula fica "—".
const NIVEIS_MUDOS = new Set(["", "TOLERANCIA_OPERACIONAL", "SEM_DADO", "PONTO_INCOMPLETO"]);
// P3 e P3⁻ contam como o mesmo nível nos chips e na pintura da linha.
const nivKey = (n) => {
  const k = txt(n).toUpperCase();
  return k === "P3_SEM_CONFIRMACAO" ? "P3" : k;
};
// A linha inteira é pintada pelo PIOR nível presente, nesta precedência.
const PRECEDENCIA = ["P1", "P2", "P3", "P4", "RESERVA", "OPERACAO_FORA_PONTO"];
// A LINHA INTEIRA pintada (não uma borda lateral): é assim que a ferramenta mostra o
// nível — `.dp-tabela tbody tr.row-p1 td` e irmãs, porte de app/ui/styles.css.
const LINHA_CLS = {
  P1: "row-p1",
  P2: "row-p2",
  P3: "row-p3",
  P4: "row-p4",
  RESERVA: "row-res",
  OPERACAO_FORA_PONTO: "row-fora",
};
function classeLinha(r) {
  const ks = [nivKey(r.nivel_entrada), nivKey(r.nivel_saida)];
  const pior = PRECEDENCIA.find((n) => ks.includes(n));
  return pior ? LINHA_CLS[pior] : "";
}
const CHIPS = [
  ["TODOS", "Todas"],
  ["P1", "P1"],
  ["P2", "P2"],
  ["P3", "P3"],
  ["P4", "P4"],
  ["RESERVA", "Reserva"],
  ["OPERACAO_FORA_PONTO", "Fora"],
];

/* ------------------------------ régua da lista ----------------------------- */
// 1º corte: só quem tem gordura acima da régua fixa em ALGUMA ponta. As pontas são
// independentes — uma saída fora da régua entra mesmo com a entrada dentro dela.
const passaRegua = (o) => modulo(o.gordura_entrada) > TOL_ENTRADA || modulo(o.gordura_saida) > TOL_SAIDA;
// Piso de exibição: NÃO é régua, é filtro de tela ("hoje só quero olhar acima de
// 30 min"). Olha a ponta MAIOR do dia.
const maiorPonta = (o) => Math.max(modulo(o.gordura_entrada), modulo(o.gordura_saida));

/* --------------------------- cartão de ponto e alvo ------------------------ */
function cartaoValido(horas) {
  const h = (horas || []).map((v) => fmtHora(v) || "");
  if (!h[0] || !h[3] || !!h[1] !== !!h[2]) return false;
  // Dia sem intervalo é um cartão válido de duas batidas. Com almoço, os quatro
  // horários precisam estar em ordem, inclusive em turno que cruza a meia-noite.
  const usados = h[1] && h[2] ? h : [h[0], h[3]];
  let anterior = hm2m(usados[0]);
  if (anterior == null) return false;
  const inicio = anterior;
  for (let i = 1; i < usados.length; i += 1) {
    let atual = hm2m(usados[i]);
    if (atual == null) return false;
    while (atual < anterior) atual += 1440;
    anterior = atual;
  }
  return anterior - inicio <= 1440;
}

// Motorista normalmente não bate almoço. Quando o DP já lançou a refeição no cartão,
// o Transnet desenha S almoço → E almoço → S artificial (poucos minutos depois). Esse
// último S não é a saída real.
function refeicaoLancadaNoCartao(bruto, entrada) {
  const marcas = [...txt(bruto).matchAll(/([ES])?\s*(\d{1,2}:\d{2})/gi)].map((m) => ({
    tipo: (m[1] || "").toUpperCase(),
    hora: fmtHora(m[2]),
  }));
  const mins = marcas.map((m) => hm2m(m.hora));
  for (let i = 1; i < mins.length; i += 1) {
    while (mins[i] != null && mins[i - 1] != null && mins[i] < mins[i - 1]) mins[i] += 1440;
  }
  for (let i = 0; i + 2 < marcas.length; i += 1) {
    if (marcas[i].tipo !== "S" || marcas[i + 1].tipo !== "E" || marcas[i + 2].tipo !== "S") continue;
    const [ini, fim, fecha] = [mins[i], mins[i + 1], mins[i + 2]];
    if (ini == null || fim == null || fecha == null) continue;
    let ent = hm2m(entrada);
    while (ent != null && ent > ini) ent -= 1440;
    if (ini >= (ent == null ? -Infinity : ent) && fim - ini >= 5 && fim - ini <= 240 && fecha - fim <= 10) {
      return [marcas[i].hora, marcas[i + 1].hora];
    }
  }
  return null;
}

// Cartões da Gordura: a régua só altera as PONTAS, mas o alvo é sempre o cartão
// inteiro (entrada · saída almoço · volta almoço · saída).
function cartoesGordura(g, pd, rm, caso) {
  const bruto = txt(pd.todas_batidas);
  const marcacoes = [...bruto.matchAll(/([ES])?\s*(\d{1,2}:\d{2})/gi)].map((m) => ({
    tipo: (m[1] || "").toUpperCase(),
    hora: fmtHora(m[2]),
  }));
  const campos = [pd.entrada, pd.saida_almoco, pd.volta_almoco, pd.saida].map(fmtHora);

  // Com duas marcações E/S, elas são entrada e saída — nunca saída/volta do almoço.
  // Com quatro, a sequência do cartão é a fonte mais fiel dos quatro slots.
  let atual;
  if (marcacoes.length === 2 && marcacoes[0].tipo === "E" && marcacoes[1].tipo === "S") {
    atual = [marcacoes[0].hora, "", "", marcacoes[1].hora];
  } else if (marcacoes.length >= 4) {
    atual = marcacoes.slice(0, 4).map((m) => m.hora);
  } else if (campos.some(Boolean)) {
    atual = campos;
  } else {
    // Fallback: conserva as pontas da gordura, sem inventar almoço.
    atual = [fmtHora(g.tn_entrada), "", "", fmtHora(g.tn_saida)];
  }

  const base = atual.map(fmtHora);
  const par = (a, b) => {
    const x = fmtHora(a);
    const y = fmtHora(b);
    return x && y ? [x, y] : null;
  };
  // A ponta de referência vem da Revisão (`alvo_*_ref` do ponto_diario); o alvo já
  // resolvido em `camadaAlvo` entra logo depois. O cartão não substitui essa régua.
  const ent = fmtHora(pd.alvo_entrada_ref || g.alvo_entrada || rm.entrada || pd.entrada_sug) || base[0];
  const sai = fmtHora(pd.alvo_saida_ref || g.alvo_saida || rm.saida || pd.saida_sug) || base[3];
  const candidatos = [
    par(caso.alvo_alm_saida, caso.alvo_alm_volta), // almoço congelado no aviso
    par(rm.alm_saida, rm.alm_volta), // real manual do DP
    refeicaoLancadaNoCartao(bruto, ent),
    par(pd.almoco_saida_sug, pd.almoco_volta_sug),
    [base[1], base[2]],
  ].filter(Boolean);
  // Não mistura uma refeição anterior com a entrada-alvo: usa o primeiro par que
  // forma um cartão cronológico inteiro.
  const meio = candidatos.find((p) => cartaoValido([ent, p[0], p[1], sai])) || candidatos[0] || ["", ""];
  const alvo = [ent, meio[0] || "", meio[1] || "", sai];

  return {
    atual: base,
    alvo,
    alvoValido: cartaoValido(alvo),
    mudou: alvo.map((v, i) => !!v && v !== base[i]),
  };
}

/* ----------------- camadas aplicadas na leitura (main.py `_gord`) ---------- */

// `_aplica_prioridade_citatti_linha99` — na linha 99 o Citatti é a fonte principal das
// duas pontas. A 99 costuma ser a primeira viagem, antes da tabela regular: bilhetagem
// e SST podem começar depois dela.
function camadaLinha99(g, com99) {
  if (!com99.has(chaveDe(g.cracha, g.data_ref))) return g;
  const out = { ...g };
  const oi = hm2m(g.op_inicio);
  const of = hm2m(g.op_fim);
  if (oi != null) {
    out.real_inicio_sem_linha99 = txt(g.real_inicio);
    out.real_inicio = m2hm(oi);
  }
  if (of != null) {
    out.real_fim_sem_linha99 = txt(g.real_fim);
    out.real_fim = m2hm(of);
  }
  out.prioridade_citatti_linha99 = true;
  out.fonte_operacao = "Citatti · linha 99";
  return out;
}

// Reservas LANÇADAS no INOVE para um dia, indexadas por crachá|dia.
// Porte de `ferramenta/supabase_client.py:695-715` (`ler_reservas_motoristas`), só que
// filtrado pelo dia — a aba já é por dia e o volume é pequeno (dezenas).
// DEGRADAÇÃO: se a tabela não existir, a RLS negar ou a rede cair, devolve vazio e a aba
// segue SEM a camada, igual ao try/except do original (main.py:4851-4856).
async function lerReservasInove(dia) {
  try {
    const { data, error } = await supabase
      .from("reservas_motoristas")
      .select("funcionario_cracha,data_referencia,hora_entrada,hora_saida,cobertura,atualizado_em")
      .eq("data_referencia", dia)
      .order("atualizado_em", { ascending: true, nullsFirst: true });
    if (error) throw error;
    const mapa = new Map();
    // Ordem crescente + "o último vence" deixa a reserva MAIS RECENTE do dia — mesmo
    // critério do pop-up do app antigo (`order=atualizado_em.desc&limit=1`,
    // supabase_client.py:732). O lote do Python ordenava só por data e ficava com uma
    // qualquer quando havia duas no mesmo dia.
    (data || []).forEach((r) => {
      const cra = cracha8(r.funcionario_cracha);
      if (!cra) return; // sem crachá não há como casar com a gordura
      mapa.set(chaveDe(cra, r.data_referencia), r);
    });
    return mapa;
  } catch {
    return new Map();
  }
}

// `_aplica_reserva` (main.py:4844-4885) — RESERVA LANÇADA PELO GESTOR no INOVE.
// Quem estava de reserva estava À DISPOSIÇÃO desde a hora lançada pelo gestor; a espera
// até assumir a tabela NÃO é gordura. Então a operação real vale a UNIÃO reserva ∪
// operação: início = min(entrada da reserva, real) e fim = max(saída da reserva, real).
// Medido no original: 31 de 55 dias com reserva cobravam indevidamente (62,5 h).
// Os valores antigos ficam em `*_sem_reserva` para não perder o rastro do que mudou.
function camadaReservaInove(g, reservas) {
  const r = reservas.get(chaveDe(g.cracha, g.data_ref));
  if (!r) return g;

  // AMBIGUIDADE (também do original): min/max são no relógio cru, sem `variante`. A
  // reserva vem de um formulário e é sempre 00:00-23:59, enquanto `real_fim` pode passar
  // das 24h ("26:08") no turno que cruza a meia-noite. Nesse caso o max já escolhe o
  // real, que é o certo; mas uma reserva lançada de madrugada num turno virado pode não
  // casar de volta. main.py:4863-4866 tem exatamente a mesma limitação — não inventei
  // correção aqui para não divergir do número que o DP já conhece.
  const rem = hm2m(r.hora_entrada); // reserva: entrada lançada
  const rsm = hm2m(r.hora_saida); // reserva: saída lançada
  const oi = hm2m(g.real_inicio);
  const of = hm2m(g.real_fim);
  const inicios = [rem, oi].filter((v) => v != null);
  const fins = [rsm, of].filter((v) => v != null);
  const ni = inicios.length ? Math.min(...inicios) : null;
  const nf = fins.length ? Math.max(...fins) : null;
  const pe = hm2m(g.tn_entrada);
  const ps = hm2m(g.tn_saida);

  const out = { ...g };
  // Marca SEMPRE que existe lançamento, mesmo quando nenhuma ponta muda: é esta flag
  // que faz `camadaReservaGps` sair do caminho (main.py:4868 lendo em 4901).
  out.tem_reserva_inove = true;
  out.reserva_inove_entrada = fmtHora(r.hora_entrada);
  out.reserva_inove_saida = fmtHora(r.hora_saida);
  out.reserva_inove_cobertura = txt(r.cobertura);

  if (ni != null && ni !== oi) {
    out.real_inicio_sem_reserva = txt(g.real_inicio);
    out.gordura_entrada_sem_reserva = txt(g.gordura_entrada);
    out.nivel_entrada_sem_reserva = txt(g.nivel_entrada);
    out.real_inicio = m2hm(ni);
    if (pe != null) {
      const ge = Math.round((ni - pe) * 10) / 10;
      out.gordura_entrada = String(ge);
      // main.py:4876 — 10 min, ver AMBIGUIDADE em TOL_RESERVA_INOVE.
      out.nivel_entrada =
        Math.abs(ge) <= TOL_RESERVA_INOVE ? "TOLERANCIA_OPERACIONAL" : txt(g.nivel_entrada);
    }
  }
  if (nf != null && nf !== of) {
    out.real_fim_sem_reserva = txt(g.real_fim);
    out.gordura_saida_sem_reserva = txt(g.gordura_saida);
    out.nivel_saida_sem_reserva = txt(g.nivel_saida);
    out.real_fim = m2hm(nf);
    if (ps != null) {
      const gs = Math.round((ps - nf) * 10) / 10;
      out.gordura_saida = String(gs);
      // main.py:4884 — também 10 aqui, e NÃO TOL_SAIDA (8). Inconsistência do original.
      out.nivel_saida =
        Math.abs(gs) <= TOL_RESERVA_INOVE ? "TOLERANCIA_OPERACIONAL" : txt(g.nivel_saida);
    }
  }
  return out;
}

// `_aplica_reserva_gps` — reserva SEM lançamento, detectada pelo próprio dado. Na
// reserva o motorista está à disposição mas não vende passagem: a bilhetagem só começa
// quando ele assume uma tabela, e o tempo de espera sumia da jornada. A assinatura é
// GPS concordando com a ESCALA e a bilhetagem aparecendo bem depois.
function camadaReservaGps(g) {
  if (ehVerdade(g.tem_reserva_inove)) return g; // o lançamento do gestor já mandou
  const e = hm2m(g.esc_inicio);
  const o = hm2m(g.op_inicio);
  const v = hm2m(g.val_inicio);
  const r = hm2m(g.real_inicio);
  if ([e, o, v, r].some((x) => x == null)) return g;
  const assinatura =
    Math.abs(o - e) <= RES_GPS_ESCALA && v - o >= RES_GPS_BILH && Math.abs(r - v) <= 2;
  if (!assinatura) return g; // sem a assinatura, ou o real já não é a bilhetagem
  const out = { ...g };
  out.real_inicio_sem_reserva = txt(g.real_inicio);
  out.gordura_entrada_sem_reserva = txt(g.gordura_entrada);
  out.nivel_entrada_sem_reserva = txt(g.nivel_entrada);
  out.reserva_por_gps = true;
  out.real_inicio = m2hm(o);
  const pe = hm2m(g.tn_entrada);
  if (pe != null) {
    const ge = Math.round((o - pe) * 10) / 10;
    out.gordura_entrada = String(ge);
    out.nivel_entrada = Math.abs(ge) <= 10 ? "TOLERANCIA_OPERACIONAL" : txt(g.nivel_entrada);
  }
  return out;
}

// `_aplica_alvo` — ALVO DA CORREÇÃO = real ∓ tolerância, e QUEM APURA A OPERAÇÃO É A
// REVISÃO (decisão do DP, 03-04/09/2026): o alvo publicado em `ponto_diario` manda.
// A gordura exibida e filtrada é a diferença PONTO × ALVO, não PONTO × operação bruta —
// senão o motorista é COBRADO contra um horário e AVISADO com outro. A conta local
// abaixo só alcança o dia que a Revisão não apurou.
function camadaAlvo(g, pd) {
  const out = { ...g };
  const revE = fmtHora(pd.alvo_entrada || pd.alvo_entrada_ref);
  const revS = fmtHora(pd.alvo_saida || pd.alvo_saida_ref);
  const ri = hm2m(g.real_inicio);
  const rf = hm2m(g.real_fim);
  const pe = hm2m(g.tn_entrada);
  const ps = hm2m(g.tn_saida);

  if (hm2m(revE) != null) {
    out.alvo_entrada = revE;
    out.fonte_alvo_gordura = "revisao";
  } else if (ri != null) {
    let alvoEntrada = Math.max(0, ri - TOL_ENTRADA);
    // Encaixe na escala com a MESMA régua da Revisão: ela olha a BATIDA, com janela
    // de 30 min — bateu perto da escala, vale o maior entre os dois (a escala já vem
    // com tolerância; não se aplica tolerância sobre tolerância).
    const esc = hm2m(g.esc_inicio || g.esc_entrada);
    if (esc != null && pe != null && difRelogio(pe, esc) <= 30) alvoEntrada = Math.max(pe, esc);
    out.alvo_entrada = m2hm(alvoEntrada);
    out.fonte_alvo_gordura = "gordura";
  }
  if (hm2m(revS) != null) {
    out.alvo_saida = revS;
    out.fonte_alvo_gordura = "revisao";
  } else if (rf != null) {
    out.alvo_saida = m2hm(rf + TOL_SAIDA);
    if (!out.fonte_alvo_gordura) out.fonte_alvo_gordura = "gordura";
  }

  const ae = hm2m(out.alvo_entrada);
  const af = hm2m(out.alvo_saida);
  if (pe != null && ae != null) {
    // `00:42` depois de uma saída `24:53` é 24:42, não 00:42 do início do dia:
    // alinha a ponta do alvo à mesma volta do relógio do cartão antes de subtrair.
    const ge = Math.round((variante(ae, pe) - pe) * 10) / 10;
    out.gordura_entrada = String(ge);
    if (Math.abs(ge) <= TOL_ENTRADA) out.nivel_entrada = "TOLERANCIA_OPERACIONAL";
    else if (ge < 0) out.nivel_entrada = "OPERACAO_FORA_PONTO";
  }
  if (ps != null && af != null) {
    const gs = Math.round((ps - variante(af, ps)) * 10) / 10;
    out.gordura_saida = String(gs);
    if (Math.abs(gs) <= TOL_SAIDA) out.nivel_saida = "TOLERANCIA_OPERACIONAL";
    else if (gs < 0) out.nivel_saida = "OPERACAO_FORA_PONTO";
  }
  return out;
}

/* --------------------------------- pedaços --------------------------------- */
// Overlay/detalhe não têm classe própria no dp360.css (e o arquivo de estilo não é
// desta mudança). Os poucos retoques ficam aqui, sempre lendo as VARIÁVEIS do tema
// DP — nada de paleta do INOVE nem de Tailwind visual.
const ESTILO = {
  fundo: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    overflowY: "auto",
    background: "rgba(20, 30, 55, 0.42)",
    padding: 20,
  },
  painel: { width: "100%", margin: "0 auto", padding: "16px 18px" },
  titulo: { fontSize: 15, fontWeight: 650 },
  rotulo: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--dp-muted)",
  },
  blocoSuave: { background: "var(--dp-surface-2)", borderRadius: 10, padding: "10px 12px" },
  blocoAviso: {
    background: "var(--dp-warn-bg)",
    color: "var(--dp-warn-ink)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  blocoAlvo: {
    background: "var(--dp-warn-bg)",
    border: "1px solid var(--dp-border)",
    borderRadius: 10,
    padding: "8px 12px",
  },
  blocoLinha: { border: "1px solid var(--dp-border)", borderRadius: 10, padding: "8px 12px" },
  blocoReserva: {
    background: "var(--dp-res-bg)",
    color: "var(--dp-res-ink)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  linhaNivel: { padding: "9px 0", borderBottom: "1px solid var(--dp-border)" },
  marcaNivel: { flex: "none", marginTop: 2, minWidth: 88, textAlign: "center", height: "fit-content" },
  textoLargo: { fontSize: 13, lineHeight: 1.65 },
  ponto: { width: 9, height: 9, borderRadius: 999, display: "inline-block", flex: "none" },
};
// Cor dos marcadores — mesmas famílias do tema DP, nunca a paleta do INOVE.
const COR = {
  linha99: "var(--dp-accent)",
  reservaInove: "var(--dp-res-ink)",
  reserva: "var(--dp-muted)",
  escala: "var(--dp-faint)",
  operacao: "var(--dp-ok-ink)",
  bilhetagem: "var(--dp-accent)",
  real: "var(--dp-ink)",
};

function ChipNivel({ minutos, nivel }) {
  const n = txt(nivel).toUpperCase();
  if (NIVEIS_MUDOS.has(n)) return <span className="dp-faint">—</span>;
  const v = num(minutos);
  return (
    <span className={`dp-gmark ${NIVEL_GCLS[n] || "g-neu"}`}>
      {v == null ? "" : `${Math.round(v)}min · `}
      {NIVEL_LBL[n] || n.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

// Os quatro slots do cartão: entrada · saída almoço · volta almoço · saída.
// Cada batida é um `.dp-chip` com a marca E/S, como no `batReais` da ferramenta; o
// slot que o alvo mudou usa a variante `.new` (a mesma cor do `.ptseg.alterar`).
const SLOT_ES = ["E", "S", "E", "S"];
function LinhaCartao({ horas, mudou }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {horas.map((h, i) =>
        h ? (
          <span key={`slot-${i}`} className={`dp-chip${mudou && mudou[i] ? " new" : ""}`}>
            <span className="es">{SLOT_ES[i]}</span>
            {h}
          </span>
        ) : (
          <span key={`slot-${i}`} className="dp-chip none">
            —
          </span>
        ),
      )}
    </span>
  );
}

function ModalNiveis({ aoFechar }) {
  const nivel = (chave, nome, texto) => (
    <div key={chave} className="flex gap-3" style={ESTILO.linhaNivel}>
      <span className={`dp-gmark ${NIVEL_GCLS[chave]}`} style={ESTILO.marcaNivel}>
        {NIVEL_LBL[chave]}
      </span>
      <span style={ESTILO.textoLargo}>{texto}</span>
    </div>
  );
  return (
    <Overlay aoFechar={aoFechar} titulo="Gordura de ponto — os níveis" largura={660}>
      <p style={{ ...ESTILO.blocoSuave, ...ESTILO.textoLargo }}>
        <b>Gordura</b> = tempo que o motorista <b>bateu ponto a mais do que operou</b>, só nas pontas
        (entrada e saída), nunca a jornada inteira. A régua da operação real é a{" "}
        <b>média SST + Validador</b> por ponta; o Citatti confirma.
      </p>
      <div className="mt-3">
        {nivel("P1", "P1", <><b>Tripla confirmação</b> — SST + Validador + Citatti concordam. Máxima confiança: <b>gordura oficial, corrige primeiro</b>.</>)}
        {nivel("P2", "P2", <><b>Dupla forte</b> — SST e Validador batem entre si, Citatti diverge ou está ausente. Alta confiança: <b>capturável, valide antes de corrigir</b>.</>)}
        {nivel("P3", "P3", <><b>Fonte forte única</b> (só SST ou só Validador) com apoio do Citatti. Confiança média: <b>radar, fora do oficial</b> (P3⁻ = sem apoio do Citatti).</>)}
        {nivel("P4", "P4", <><b>Só Citatti</b>, nenhuma fonte forte. Potencial baixo: <b>conferência manual</b>.</>)}
        {nivel("RESERVA", "Reserva", <>Gordura acima de <b>120 min</b> — provável <b>standby de reserva/prontidão</b>. Tempo legítimo: <b>não corrige, só valida</b>.</>)}
        {nivel("OPERACAO_FORA_PONTO", "fora do ponto", <>Gordura <b>negativa</b> — operou <b>sem cobrir com o ponto</b> (bateu menos do que operou). <b>Risco trabalhista</b>; reportado à parte, não é gordura financeira.</>)}
        {nivel("NAO_CALCULAR", "n/calc", <>SST e Validador <b>divergem mais de 20 min</b> — sem régua confiável, a ponta não entra. Tolerância e sem dado aparecem como “—”.</>)}
      </div>
      <p className="mt-3" style={{ ...ESTILO.blocoAviso, ...ESTILO.textoLargo }}>
        <b>Só P1 é o número oficial.</b> P2 é captura validável; P3/P4/Reserva/fora do ponto ficam no
        radar, rotulados. As pontas são <b>independentes</b>: uma saída P1 conta mesmo se a entrada
        estiver na tolerância — uma ponta nunca anula a outra.
      </p>
      <p className="dp-muted mt-2" style={{ fontSize: 12, lineHeight: 1.6 }}>
        Nesta fase a aba é somente leitura. As <b>duas reservas</b> já entram na conta: a{" "}
        <b>lançada pelo gestor no INOVE</b> (ícone de agenda) — a operação real vira a união{" "}
        <b>reserva ∪ operação</b>, porque ele estava à disposição desde a hora lançada — e a{" "}
        <b>detectada pelo GPS</b> (ícone de pausa), para o dia em que ninguém lançou.
      </p>
    </Overlay>
  );
}

function Overlay({ titulo, largura = 860, aoFechar, children }) {
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);
  return (
    <div
      style={ESTILO.fundo}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="dp-card"
        style={{ ...ESTILO.painel, maxWidth: largura }}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 style={ESTILO.titulo}>{titulo}</h3>
          <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// Detalhe do dia: horários e jornada POR FONTE + o cálculo da gordura por ponta.
// Ato disciplinar merece o DP enxergar GPS/SST/bilhetagem antes de confirmar,
// não só o número final.
function PainelDetalhe({ linha, aoFechar }) {
  const r = linha;
  const opIni = hm2m(r.op_inicio) != null ? hm2m(r.op_inicio) : hm2m(r.sst_vinculo);
  const valIni = hm2m(r.val_inicio);
  let dif = opIni != null && valIni != null ? Math.abs(valIni - opIni) : null;
  if (dif != null && dif > 720) dif = 1440 - dif;
  const foraDaCurva = dif != null && dif > 20; // régua de concordância entre fontes

  const Fonte = ({ rotulo, cor, ini, fim, aviso, destaque }) => {
    if (hm2m(ini) == null && hm2m(fim) == null) return null;
    return (
      <tr className={destaque ? "row-p4" : ""}>
        <td>
          <span className="flex items-center gap-2" style={{ fontWeight: 600 }}>
            <i style={{ ...ESTILO.ponto, background: cor }} />
            {rotulo}
            {aviso && <span className="dp-pill danger">{aviso}</span>}
          </span>
        </td>
        <td className="dp-mono dp-num">{H(ini)}</td>
        <td className="dp-mono dp-num">{H(fim)}</td>
        <td className="dp-mono dp-num dp-muted">{durHM(ini, fim)}</td>
      </tr>
    );
  };

  const Conta = ({ lado, bateu, real, minutos, nivel }) => {
    const n = num(minutos);
    const nv = txt(nivel).toUpperCase();
    const conta = !NIVEIS_MUDOS.has(nv) && n != null;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2" style={ESTILO.blocoSuave}>
        <span style={{ fontWeight: 700 }}>{lado}</span>
        <span className="dp-muted">
          bateu <b className="dp-mono dp-num">{H(bateu)}</b> · real{" "}
          <b className="dp-mono dp-num">{H(real)}</b>
        </span>
        <span className="flex items-center gap-2">
          {conta ? (
            <b
              className="dp-num"
              style={{ color: n > 0 ? "var(--dp-danger-ink)" : "var(--dp-ok-ink)" }}
            >
              {n > 0 ? "+" : ""}
              {Math.round(n)} min
            </b>
          ) : (
            <span className="dp-faint">— ({nv ? nv.toLowerCase().replace(/_/g, " ") : "sem dado"})</span>
          )}
          <ChipNivel nivel={nivel} />
        </span>
      </div>
    );
  };

  const temRealManual = [r.rm_entrada, r.rm_alm_saida, r.rm_alm_volta, r.rm_saida].some((v) => fmtHora(v));

  // O que a reserva LANÇADA alargou. Só entra a ponta que de fato mudou: o original
  // grava `*_sem_reserva` apenas quando altera (main.py:4869-4871 e 4877-4879), então a
  // ausência do campo já significa "a operação sozinha já cobria o período lançado".
  const semReserva = [
    {
      lado: "Entrada",
      antes: r.real_inicio_sem_reserva,
      agora: r.real_inicio,
      minutos: num(r.gordura_entrada_sem_reserva),
      nivel: txt(r.nivel_entrada_sem_reserva),
    },
    {
      lado: "Saída",
      antes: r.real_fim_sem_reserva,
      agora: r.real_fim,
      minutos: num(r.gordura_saida_sem_reserva),
      nivel: txt(r.nivel_saida_sem_reserva),
    },
  ].filter((s) => fmtHora(s.antes));

  return (
    <Overlay
      titulo={`${txt(r.nm_funcionario) || "Colaborador"} · ${fmtData(r.data_ref)}`}
      aoFechar={aoFechar}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="dp-pill mute">Crachá {txt(r.cracha) || "—"}</span>
        {txt(r.veiculo) && <span className="dp-pill mute">Carro {txt(r.veiculo)}</span>}
        {r.__linha99 && (
          <span className="dp-pill accent">
            <span className="flex items-center gap-1">
              <Bus size={12} /> Linha 99 · Citatti é a fonte
            </span>
          </span>
        )}
        {r.__reservaInove && (
          <span className="dp-pill res">
            <span className="flex items-center gap-1">
              <CalendarClock size={12} /> Reserva lançada pelo gestor
            </span>
          </span>
        )}
        {r.__reserva && !r.__reservaInove && (
          <span className="dp-pill res">
            <span className="flex items-center gap-1">
              <PauseCircle size={12} /> {r.reserva_por_gps ? "Reserva detectada pelo GPS" : "Reserva"}
            </span>
          </span>
        )}
        {txt(r.__casoStatus) && <span className="dp-pill accent">{r.__casoStatus}</span>}
      </div>

      <div className="mt-4">
        <div style={ESTILO.rotulo}>Horários e jornada por fonte</div>
        {/* O contêiner precisa rolar por conta própria: o `th` da .dp-tabela é sticky, e
            sem um ancestral de rolagem aqui ele grudaria no topo da JANELA, por cima do
            cabeçalho do modal. */}
        <div className="mt-2" style={{ overflow: "auto", maxHeight: 320 }}>
          <table className="dp-tabela" style={{ minWidth: 440 }}>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Entrada</th>
                <th>Saída</th>
                <th>Jornada</th>
              </tr>
            </thead>
            <tbody>
              <Fonte rotulo="Escala" cor={COR.escala} ini={r.esc_inicio} fim={r.esc_fim} />
              {/* Lançamento do gestor no INOVE — some sozinho quando não há reserva. */}
              <Fonte
                rotulo="Reserva (INOVE)"
                cor={COR.reservaInove}
                ini={r.reserva_inove_entrada}
                fim={r.reserva_inove_saida}
              />
              <Fonte rotulo="GPS (Citatti)" cor={COR.operacao} ini={r.op_inicio} fim={r.op_fim} />
              <Fonte rotulo="SS (SST)" cor={COR.operacao} ini={r.sst_vinculo} fim={r.sst_desvinculo} />
              <Fonte
                rotulo="Bilhetagem"
                cor={COR.bilhetagem}
                ini={r.val_inicio}
                fim={r.val_fim}
                aviso={foraDaCurva ? "fora da curva" : ""}
              />
              <Fonte rotulo="Operação real" cor={COR.real} ini={r.real_inicio} fim={r.real_fim} destaque />
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2" style={ESTILO.blocoAlvo}>
          <span style={{ ...ESTILO.rotulo, color: "var(--dp-warn-ink)" }}>
            Alvo (real com tolerância)
          </span>
          {r.__cartao.alvoValido ? (
            <LinhaCartao horas={r.__cartao.alvo} mudou={r.__cartao.mudou} />
          ) : (
            <span style={{ fontWeight: 700, color: "var(--dp-danger-ink)" }}>
              revisar alvo e refeição antes de corrigir
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2" style={ESTILO.blocoLinha}>
          <span style={ESTILO.rotulo}>Ponto (bateu)</span>
          <LinhaCartao horas={r.__cartao.atual} />
        </div>
        {txt(r.fonte_alvo_gordura) && (
          <p className="dp-muted" style={{ fontSize: 12 }}>
            Fonte do alvo:{" "}
            <b>{r.fonte_alvo_gordura === "revisao" ? "alvo publicado pela Revisão" : "calculado na Gordura"}</b>
            {txt(r.fonte_operacao) ? ` · operação: ${txt(r.fonte_operacao)}` : ""}
          </p>
        )}
      </div>

      <div className="mt-4">
        <div style={ESTILO.rotulo}>Cálculo da gordura</div>
        <div className="mt-2 grid gap-2">
          <Conta
            lado="Entrada"
            bateu={r.tn_entrada}
            real={r.real_inicio}
            minutos={r.gordura_entrada}
            nivel={r.nivel_entrada}
          />
          <Conta
            lado="Saída"
            bateu={r.tn_saida}
            real={r.real_fim}
            minutos={r.gordura_saida}
            nivel={r.nivel_saida}
          />
        </div>
        {/* O operador precisa ver O QUE MUDOU quando a reserva entrou na conta: senão o
            número da tela não bate com o cru da `ponto_gordura` e ninguém confia. */}
        {r.__reservaInove && (
          <div className="mt-2" style={ESTILO.blocoReserva}>
            <div className="flex items-center gap-1.5" style={{ ...ESTILO.rotulo, color: "inherit" }}>
              <CalendarClock size={13} /> Reserva lançada pelo gestor
            </div>
            <p className="mt-1" style={ESTILO.textoLargo}>
              Lançada das <b className="dp-mono dp-num">{H(r.reserva_inove_entrada)}</b> às{" "}
              <b className="dp-mono dp-num">{H(r.reserva_inove_saida)}</b>
              {txt(r.reserva_inove_cobertura) ? ` · cobertura: ${txt(r.reserva_inove_cobertura)}` : ""}. Ele
              estava <b>à disposição</b> desde a hora lançada, então a operação real é a{" "}
              <b>união reserva ∪ operação</b> — a espera até assumir a tabela não é gordura.
            </p>
            {semReserva.length ? (
              <ul className="mt-1.5 grid gap-1" style={{ fontSize: 12, lineHeight: 1.6, fontWeight: 600 }}>
                {semReserva.map((s) => (
                  <li key={s.lado}>
                    <b>{s.lado}</b> — sem a reserva o real era{" "}
                    <span className="dp-mono dp-num">{H(s.antes)}</span>
                    {s.minutos == null
                      ? ""
                      : ` (${s.minutos > 0 ? "+" : ""}${Math.round(s.minutos)} min${
                          s.nivel ? `, ${s.nivel.toLowerCase().replace(/_/g, " ")}` : ""
                        })`}
                    ; com a reserva passou a <span className="dp-mono dp-num">{H(s.agora)}</span>.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5" style={{ fontSize: 12, lineHeight: 1.6, fontWeight: 600 }}>
                Nenhuma ponta mudou: a operação já cobria todo o período lançado.
              </p>
            )}
          </div>
        )}
        {txt(r.justificativa) && (
          <p className="dp-muted mt-2" style={{ ...ESTILO.blocoSuave, ...ESTILO.textoLargo }}>
            {txt(r.justificativa)}
          </p>
        )}
      </div>

      <div className="mt-4">
        <div style={ESTILO.rotulo}>Real manual do DP</div>
        {temRealManual ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["Entrada", r.rm_entrada],
                ["Saída almoço", r.rm_alm_saida],
                ["Volta almoço", r.rm_alm_volta],
                ["Saída", r.rm_saida],
              ].map(([rot, val]) => (
                <div key={rot} style={ESTILO.blocoLinha}>
                  <div style={ESTILO.rotulo}>{rot}</div>
                  <div className="dp-mono dp-num mt-0.5" style={{ fontWeight: 700 }}>
                    {H(val)}
                  </div>
                </div>
              ))}
            </div>
            {(txt(r.rm_por) || txt(r.rm_em)) && (
              <p className="dp-muted mt-1.5" style={{ fontSize: 12 }}>
                Cravado por <b>{txt(r.rm_por) || "—"}</b>
                {txt(r.rm_em) ? ` em ${fmtData(r.rm_em)}` : ""}
              </p>
            )}
          </>
        ) : (
          <p className="dp-muted mt-2">
            Nenhum horário cravado pelo DP neste dia — vale a régua automática acima.
          </p>
        )}
      </div>
    </Overlay>
  );
}

/* --------------------------------- a aba ----------------------------------- */
export default function Gordura() {
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDia, setCarregandoDia] = useState(false);
  const [erro, setErro] = useState("");
  const [termo, setTermo] = useState("");
  const [piso, setPiso] = useState(0);
  const [filtro, setFiltro] = useState("TODOS");
  const [verNiveis, setVerNiveis] = useState(false);
  const [detalhe, setDetalhe] = useState(null);

  // Lista de dias com gordura calculada — `data_ref` distintas, mais recente primeiro.
  // A deduplicação acontece NO SERVIDOR, na ação `datas` do gateway
  // (supabase/functions/dp360-api/index.ts:191-228, atalho em
  // src/services/dp360Api.js:53-62). Antes a aba paginava até 40 mil linhas de
  // `data_ref` só para montar este <select>; agora volta uma lista curta e cacheada.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const ordenadas = await lerDatasDP360("ponto_gordura", "data_ref");
        if (!ativo) return;
        // O gateway já corta em 10 e devolve desc; o `dia10` é só cinto de segurança
        // para o dia que a coluna vier como timestamp.
        const limpas = ordenadas.map(dia10).filter(Boolean);
        setDatas(limpas);
        setData(limpas[0] || "");
      } catch (falha) {
        if (ativo) setErro(falha?.message || "Falha ao listar os dias com gordura calculada.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const carregarDia = useCallback(async (dia) => {
    // Gordura é a base; as demais tabelas só enriquecem. Se uma delas falhar, a
    // lista continua de pé (sem cartão/alvo) em vez de a aba inteira cair.
    const vazio = () => [];
    const [gordura, diario, linha99, realManual, casos, reservas] = await Promise.all([
      lerTudoDP360("ponto_gordura", { filtros: { data_ref: `eq.${dia}` }, ordem: "cracha.asc" }),
      lerTudoDP360("ponto_diario", { filtros: { date_ref: `eq.${dia}` } }).catch(vazio),
      lerTudoDP360("ponto_linha99", { filtros: { data_ref: `eq.${dia}` } }).catch(vazio),
      lerTudoDP360("ponto_real_manual", { filtros: { date_ref: `eq.${dia}` } }).catch(vazio),
      lerTudoDP360("ponto_caso", { filtros: { date_ref: `eq.${dia}` } }).catch(vazio),
      // Outra base (o Supabase do próprio INOVE) e outro cliente — já degrada sozinha.
      lerReservasInove(dia),
    ]);

    const indexar = (arr, colDia) => {
      const mapa = new Map();
      arr.forEach((x) => mapa.set(chaveDe(x.cracha, x[colDia]), x));
      return mapa;
    };
    const pdMapa = indexar(diario, "date_ref");
    const rmMapa = indexar(realManual, "date_ref");
    const casoMapa = indexar(casos, "date_ref");
    const com99 = new Set(linha99.map((x) => chaveDe(x.cracha, x.data_ref)));

    return gordura.map((bruta) => {
      const chave = chaveDe(bruta.cracha, bruta.data_ref);
      const pd = pdMapa.get(chave) || {};
      const rm = rmMapa.get(chave) || {};
      const caso = casoMapa.get(chave) || {};

      // Mesma ordem do app antigo (main.py:4699-4704, `_gord`):
      // linha 99 -> reserva do INOVE -> reserva por GPS -> alvo.
      // A ordem importa: a reserva por GPS só age quando NÃO há lançamento do gestor
      // (`tem_reserva_inove`), e o alvo é sempre a última palavra sobre a gordura.
      const g = camadaAlvo(
        camadaReservaGps(camadaReservaInove(camadaLinha99(bruta, com99), reservas)),
        pd,
      );

      const cartao = cartoesGordura(g, pd, rm, caso);
      const nivies = [txt(g.nivel_entrada).toUpperCase(), txt(g.nivel_saida).toUpperCase()];
      return {
        ...g,
        __chave: chave,
        __cartao: cartao,
        __linha99: !!g.prioridade_citatti_linha99 || com99.has(chave),
        // Duas coisas diferentes: o gestor LANÇOU a reserva no INOVE (documento, manda
        // em tudo) x a reserva foi DEDUZIDA do dado (GPS) ou o nível saiu RESERVA.
        __reservaInove: ehVerdade(g.tem_reserva_inove),
        __reserva:
          !!g.reserva_por_gps || ehVerdade(g.tem_reserva_inove) || nivies.includes("RESERVA"),
        __casoStatus: txt(caso.correcao_status) || txt(caso.aceite) || "",
        __busca: semAcento(`${txt(g.nm_funcionario)} ${txt(g.cracha)} ${cracha8(g.cracha)}`),
        rm_entrada: txt(rm.entrada),
        rm_alm_saida: txt(rm.alm_saida),
        rm_alm_volta: txt(rm.alm_volta),
        rm_saida: txt(rm.saida),
        rm_por: txt(rm.definido_por),
        rm_em: txt(rm.definido_em),
      };
    });
  }, []);

  useEffect(() => {
    if (!data) return undefined;
    let ativo = true;
    setCarregandoDia(true);
    setErro("");
    carregarDia(data)
      .then((prontas) => {
        if (ativo) setLinhas(prontas);
      })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha?.message || "Falha ao consultar a gordura deste dia.");
      })
      .finally(() => {
        if (ativo) setCarregandoDia(false);
      });
    return () => {
      ativo = false;
    };
  }, [data, carregarDia]);

  // Recorte base: quem passou da régua fixa (e do piso de exibição). Os chips de
  // nível e o resumo contam SOBRE esse recorte.
  const base = useMemo(
    () => linhas.filter((o) => passaRegua(o) && (!piso || maiorPonta(o) >= piso)),
    [linhas, piso],
  );

  const contagem = useMemo(() => {
    const c = { TODOS: base.length, P1: 0, P2: 0, P3: 0, P4: 0, RESERVA: 0, OPERACAO_FORA_PONTO: 0 };
    base.forEach((o) => {
      const ks = [nivKey(o.nivel_entrada), nivKey(o.nivel_saida)];
      PRECEDENCIA.forEach((k) => {
        if (ks.includes(k)) c[k] += 1;
      });
    });
    return c;
  }, [base]);

  const visiveis = useMemo(() => {
    const q = semAcento(termo);
    const termos = q.split(/\s+/).filter(Boolean);
    return base
      .filter((o) => !termos.length || termos.every((t) => o.__busca.includes(t)))
      .filter((o) =>
        filtro === "TODOS" ? true : nivKey(o.nivel_entrada) === filtro || nivKey(o.nivel_saida) === filtro,
      );
  }, [base, termo, filtro]);

  // A soma oficial conta APENAS pontas cujo nível é exatamente P1.
  const somaP1 = useMemo(
    () =>
      base.reduce(
        (a, o) =>
          a +
          (txt(o.nivel_entrada).toUpperCase() === "P1" ? num(o.gordura_entrada) || 0 : 0) +
          (txt(o.nivel_saida).toUpperCase() === "P1" ? num(o.gordura_saida) || 0 : 0),
        0,
      ),
    [base],
  );

  // Barra de filtros da ferramenta: dia, piso, busca, chips de nível e a RÉGUA FIXA
  // sempre à vista (no original ela mora na segunda `gbar`, como `hbsub`).
  const filtros = (
    <>
      <label className="dp-muted flex items-center gap-2">
        Dia
        <select value={data} onChange={(e) => setData(e.target.value)}>
          {datas.map((d) => (
            <option key={d} value={d}>
              {fmtData(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="dp-muted flex items-center gap-2">
        Mostrar acima de
        <select value={piso} onChange={(e) => setPiso(Number(e.target.value) || 0)}>
          {PISOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar nome ou crachá"
        style={{ width: 200 }}
      />
      <span className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setFiltro(chave)}
            className={`dp-chip-f${filtro === chave ? " on" : ""}`}
          >
            {rotulo} <span className="n">{contagem[chave] ?? 0}</span>
          </button>
        ))}
      </span>
      <span className="flex items-center gap-3" style={{ marginLeft: "auto" }}>
        <span className="dp-faint">
          Régua fixa: entrada &gt; 10 min antes · saída &gt; 8 min depois
        </span>
        <button type="button" className="dp-btn" onClick={() => setVerNiveis(true)}>
          <span className="flex items-center gap-1.5">
            <Info size={13} /> Níveis
          </span>
        </button>
      </span>
    </>
  );

  // Linha de resumo (o `dtot` da ferramenta) + a legenda dos marcadores da lista.
  const resumo = (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>
        <b className="dp-num">{base.length}</b> fora da régua
        {piso ? ` e acima de ${piso} min` : ""} · Gordura P1 do dia:{" "}
        <b className="dp-num">{Math.round(somaP1)} min</b> ({(somaP1 / 60).toFixed(1)}h)
      </span>
      <span className="flex items-center gap-1.5" style={{ color: COR.linha99 }}>
        <Bus size={13} /> linha 99 (Citatti é a fonte das pontas)
      </span>
      <span className="flex items-center gap-1.5" style={{ color: COR.reservaInove }}>
        <CalendarClock size={13} /> reserva lançada pelo gestor (real = reserva ∪ operação)
      </span>
      <span className="flex items-center gap-1.5" style={{ color: COR.reserva }}>
        <PauseCircle size={13} /> reserva por GPS / prontidão (não corrige, valida)
      </span>
      <span className="dp-faint">Clique na linha para ver as fontes do dia.</span>
    </span>
  );

  // TODO(porte): o envio de comunicado (📣 Enviar Ocorrência) do Passo 4 grava em
  // `ponto_caso` e dispara o robô do Transnet — fica para a fase de execução.

  const semDatas = !carregando && !datas.length;
  // Antes de o primeiro dia chegar, a barra ficaria com um <select> vazio — não desenha.
  const mostraBarra = !semDatas && !carregando;

  let corpo;
  if (semDatas) {
    corpo = (
      <div className="dp-resumo">
        Ainda não há gordura calculada. Rode o pipeline da gordura (Athena → agente → base DP360)
        para popular <span className="dp-mono">ponto_gordura</span>.
      </div>
    );
  } else if (carregandoDia) {
    corpo = <div className="dp-resumo">Carregando a gordura do dia…</div>;
  } else {
    corpo = (
      <div className="dp-tabela-wrap">
        <table className="dp-tabela">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Crachá</th>
              <th>Data</th>
              <th>Ponto (bateu)</th>
              <th>Alvo (c/ tolerância)</th>
              <th>Jornada</th>
              <th>Gordura entrada</th>
              <th>Gordura saída</th>
              <th>Esc. início</th>
              <th>Esc. fim</th>
              <th>Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r) => (
              <tr
                key={r.__chave}
                tabIndex={0}
                onClick={() => setDetalhe(r)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetalhe(r);
                  }
                }}
                // A linha inteira é pintada pelo PIOR nível — é a cor da linha que o
                // operador lê primeiro, como na ferramenta.
                className={classeLinha(r)}
                style={{ cursor: "pointer" }}
              >
                <td>
                  <span className="flex items-center gap-1.5" style={{ fontWeight: 600 }}>
                    {txt(r.nm_funcionario) || "—"}
                    {r.__linha99 && (
                      <span
                        title="Linha 99 — Citatti é a fonte das pontas"
                        style={{ color: COR.linha99, flex: "none" }}
                      >
                        <Bus size={13} aria-label="linha 99" />
                      </span>
                    )}
                    {/* Lançada pelo gestor x deduzida do dado são coisas distintas
                        e o operador precisa distinguir de relance. */}
                    {r.__reservaInove && (
                      <span
                        title={`Reserva lançada pelo gestor no INOVE${
                          fmtHora(r.reserva_inove_entrada) || fmtHora(r.reserva_inove_saida)
                            ? ` — ${H(r.reserva_inove_entrada)} às ${H(r.reserva_inove_saida)}`
                            : ""
                        } — real = união reserva ∪ operação`}
                        style={{ color: COR.reservaInove, flex: "none" }}
                      >
                        <CalendarClock size={13} aria-label="reserva lançada pelo gestor" />
                      </span>
                    )}
                    {r.__reserva && !r.__reservaInove && (
                      <span
                        title={
                          r.reserva_por_gps
                            ? "Reserva detectada pelo GPS (ninguém lançou) — não corrige, só valida"
                            : "Reserva / prontidão — não corrige, só valida"
                        }
                        style={{ color: COR.reserva, flex: "none" }}
                      >
                        <PauseCircle size={13} aria-label="reserva" />
                      </span>
                    )}
                  </span>
                </td>
                <td className="dp-mono dp-num dp-muted">{txt(r.cracha) || "—"}</td>
                <td className="dp-num dp-muted">{fmtData(r.data_ref)}</td>
                <td>
                  <LinhaCartao horas={r.__cartao.atual} />
                </td>
                <td>
                  {r.__cartao.alvoValido ? (
                    <LinhaCartao horas={r.__cartao.alvo} mudou={r.__cartao.mudou} />
                  ) : (
                    <span style={{ fontWeight: 700, color: "var(--dp-danger-ink)" }}>
                      revisar alvo e refeição
                    </span>
                  )}
                </td>
                <td className="dp-mono dp-num dp-muted">{durHM(r.real_inicio, r.real_fim)}</td>
                <td>
                  <ChipNivel minutos={r.gordura_entrada} nivel={r.nivel_entrada} />
                </td>
                <td>
                  <ChipNivel minutos={r.gordura_saida} nivel={r.nivel_saida} />
                </td>
                <td className="dp-mono dp-num dp-faint">{H(r.esc_inicio)}</td>
                <td className="dp-mono dp-num dp-faint">{H(r.esc_fim)}</td>
                <td
                  className="dp-muted"
                  style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}
                  title={txt(r.justificativa)}
                >
                  {txt(r.justificativa) || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visiveis.length && (
          <p className="dp-muted" style={{ padding: "28px 16px", textAlign: "center" }}>
            {base.length
              ? "Nada nesse nível ou nessa busca."
              : "Nenhuma ponta fora da régua fixa de aviso neste dia."}
          </p>
        )}
      </div>
    );
  }

  return (
    <AbaShell
      filtros={mostraBarra ? filtros : null}
      resumo={mostraBarra ? resumo : null}
      carregando={carregando}
      erro={erro}
    >
      {corpo}

      {verNiveis && <ModalNiveis aoFechar={() => setVerNiveis(false)} />}
      {detalhe && <PainelDetalhe linha={detalhe} aoFechar={() => setDetalhe(null)} />}
    </AbaShell>
  );
}
