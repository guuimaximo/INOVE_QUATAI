// ============================================================================
// DP360 · Passo 5 — OCORRÊNCIAS  (porte do app antigo Sistemas/PONTO)
//
// FONTE DA VERDADE deste arquivo (não invente regra — tudo aqui tem origem):
//   app/ui/app.js   → viewP5 (~354), P5PORTAS (~133), P5ABAS (~134), SIT (~166),
//                     COLS_CONF (~183), COLS_ENV (~2647), pontasChips (~3819),
//                     diaStatus (~1586), jaTratado (~117), decJa (~222)
//   app/main.py     → get_conferencia (~8959), get_todas_ocorrencias (~4050),
//                     _situacao (~7834), _reaberto (~7822),
//                     _pendentes_advertencia (~8204), _ref_ponta (~7885),
//                     _julga_ref (~7926), _rotulo_caso (~2905)
//   docs/dp360/PORTE.md (constantes e as regras que não podem ser reinventadas)
//
// ⚠ ESCOPO DESTA FASE — SOMENTE LEITURA.
// A tela monta a mesa de decisão inteira, mas NÃO GRAVA nada: os botões de
// aceitar / rejeitar / advertir / cancelar nascem DESABILITADOS. Motivo: uma
// decisão errada aqui vira advertência indevida em cima de trabalhador. As
// chamadas de gravação ficam em TODO, prontas, no fim do arquivo.
//
// A REGRA QUE MANDA NA TELA (PORTE.md §5): recusar ≠ advertir. Advertência só
// existe depois de aviso registrado. É por isso que a navegação é em DOIS
// NÍVEIS — primeiro a PORTA (de onde o dia veio), depois a aba.
// ============================================================================
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import AbaShell from "./AbaShell";
import { lerTudoDP360 } from "../../../services/dp360Api";

/* ─────────────────────────── constantes do domínio ───────────────────────── */

// PORTE.md §4 — janela de dados de quase todas as leituras do DP360.
const JANELA_DIAS = 70;
// PORTE.md §4 / main.py:9959 (tol=10) — tolerância do veredito.
const TOLERANCIA_MIN = 10;
// PORTE.md §4 / main.py PRAZO_HORAS = 48.
const PRAZO_HORAS = 48;
// main.py DELTA_FONTE = 20 — margem de concordância entre fontes (CANON 6.5).
const DELTA_FONTE = 20;

const AVISO_FASE = "Gravação liberada na próxima fase (validação pendente)";

// app.js:133 — as duas portas + comunicados. A porta define a CONSEQUÊNCIA.
const PORTAS = [
  {
    id: "pedido",
    label: "Pedido do colaborador",
    ajuda:
      "Ele mexeu por conta própria, sem aviso nosso naquele dia. Recusar aqui SÓ recusa — nunca vira advertência.",
  },
  {
    id: "aviso",
    label: "Enviamos para ajuste",
    ajuda:
      "Nós avisamos aquele crachá+dia; o ajuste é RESPOSTA. Recusar aqui PODE advertir e corrigir o ponto.",
  },
  {
    id: "coment",
    label: "Comunicados",
    ajuda: "Avisos que só informam (almoço, bateu ponto fora). Não pedem ação.",
  },
];

// app.js:134 (P5ABAS) — o caminho é o mesmo nas duas portas: decidir → executar → desfecho.
const ABAS = {
  pedido: [
    ["conf", "A decidir"],
    ["exec", "Execução pendente"],
    ["ok", "Ponto OK"],
    ["recusados", "Recusados"],
    ["fechado", "Ponto fechado"],
  ],
  aviso: [
    ["aguard", "A decidir"],
    ["exec", "Execução pendente"],
    ["ok", "Ponto OK"],
    ["disc", "Advertências e correções"],
    ["cancel", "Cancelamento"],
    ["fechado", "Ponto fechado"],
  ],
  coment: [["coment", "Comunicados"]],
};

// app.js:166 (SIT) — situação → rótulo + cor da linha.
const SIT = {
  conf_certo: { rotulo: "✓ certo", cor: "ok" },
  conf_errado: { rotulo: "✗ errado", cor: "erro" },
  conf: { rotulo: "• a julgar", cor: "neutro" },
  ok: { rotulo: "✓ ponto OK", cor: "ok" },
  advertido: { rotulo: "⚠ advertido", cor: "erro" },
  corrigido: { rotulo: "🔧 corrigido", cor: "ok" },
  exec_pendente: { rotulo: "⏳ aceito · aguardando bot", cor: "neutro" },
  recusa_exec_pendente: { rotulo: "⏳ recusado · aguardando bot", cor: "neutro" },
  ponto_fechado: { rotulo: "🔒 ponto fechado no Transnet", cor: "erro" },
  recusado: { rotulo: "✗ recusado", cor: "erro" },
  aguardando: { rotulo: "📤 enviada · sem resposta", cor: "neutro" },
  // estados que só existem no monitor de avisos (main.py:4286-4361)
  comunicado: { rotulo: "📣 comunicado", cor: "neutro" },
  posterior: { rotulo: "⏱ pedido posterior", cor: "alerta" },
  ajustou: { rotulo: "ajustou (decidido)", cor: "ok" },
  ajustou_certo: { rotulo: "ajustou certo", cor: "ok" },
  ajustou_errado: { rotulo: "ajustou errado", cor: "erro" },
  ajustou_julgar: { rotulo: "ajustou (a julgar)", cor: "alerta" },
  vencido: { rotulo: "vencido (+48h)", cor: "erro" },
  cancelado: { rotulo: "🗑 aviso cancelado", cor: "neutro" },
};

// main.py:7808 / 7818
const DESFECHOS = ["ok", "advertido", "corrigido", "ponto_fechado"];
const DESTINOS = [...DESFECHOS, "exec_pendente", "recusa_exec_pendente"];
// app.js:2849 — a aba de desfecho da porta "aviso".
const SIT_DISC = ["advertido", "corrigido"];

const FUNCOES = [
  ["TODAS", "Todas as funções"],
  ["MOTORISTA", "Motorista"],
  ["INTERNO", "Interno"],
  ["APRENDIZ", "Aprendiz"],
];

/* ───────────────────────────── utilidades puras ──────────────────────────── */

const txt = (v) => String(v ?? "").trim();

// ATENÇÃO: booleanos do lake chegam como STRING "true"/"false".
const ehVerdadeiro = (v) =>
  v === true || ["true", "t", "1", "sim"].includes(String(v ?? "").trim().toLowerCase());

// main.py:56 — crachá com menos de 8 dígitos vira 8 com zeros à esquerda.
function cra8(c) {
  const s = txt(c);
  return /^\d+$/.test(s) && s.length > 0 && s.length < 8 ? s.padStart(8, "0") : s;
}

// main.py:7658 — dd/mm/aaaa ou aaaa-mm-dd → aaaa-mm-dd (chave de join).
function paraISO(valor) {
  const s = txt(valor);
  if (s.includes("/")) {
    const p = s.split("/");
    if (p.length === 3) return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  }
  return s.slice(0, 10);
}

// main.py:48 — '2026-07-14' → '14/07/2026'.
function paraBR(iso) {
  const s = txt(iso);
  if (s.includes("-")) {
    const [a, m, d] = s.split("-");
    if (a && m && d) return `${d}/${m}/${a}`;
  }
  return s;
}

// NUNCA toISOString() para data local (CLAUDE.md): depois das 21h BRT vira o dia seguinte.
function isoDataLocal(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function isoDiasAtras(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return isoDataLocal(d);
}

function hm2m(valor) {
  const m = /(\d{1,2}):(\d{2})/.exec(txt(valor));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function m2hm(min) {
  if (min == null) return "";
  const v = Math.round(min);
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
}

// simulador.var — variante de t (t-24h, t, t+24h) mais perto de ref. É o que faz
// 02:08 casar com a batida 26:08 do cartão em vez de cair na madrugada errada.
function variante(t, ref) {
  if (t == null || ref == null) return t;
  return [t - 1440, t, t + 1440].reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a));
}

// "E13:36 | S18:27 | ..." ou "13:36,18:27" → ["13:36", "18:27"]
function parseBatidas(valor) {
  return txt(valor)
    .split(/[|,]/)
    .map((x) => x.trim().replace(/^[ES]\s*/i, "").trim())
    .filter((x) => /^\d{1,2}:\d{2}$/.test(x));
}

// main.py:7731 — o cartão vem de `todas_batidas`; `batidas_limpas` derruba a
// entrada em ~400 dias da base e não serve como "antes".
function batidasDoCartao(pd) {
  if (!pd) return [];
  const t = parseBatidas(pd.todas_batidas);
  return t.length ? t : parseBatidas(pd.batidas_limpas);
}

function fmtDataHora(valor) {
  const s = txt(valor);
  if (!s) return "—";
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s);
  if (Number.isNaN(d.getTime())) return s;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: s.length > 10 ? "short" : undefined,
  }).format(d);
}

function horasDesde(iso) {
  const s = txt(iso).replace("Z", "").split("+")[0].split(".")[0];
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

function tempoHoras(h) {
  const v = Math.abs(Number(h) || 0);
  if (v < 24) return `${Math.round(v)}h`;
  const d = Math.floor(v / 24);
  const r = Math.round(v - d * 24);
  return r ? `${d}d ${r}h` : `${d}d`;
}

function pedacos(lista, tamanho) {
  const out = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

/* ─────────────────────────── regras portadas do DP ───────────────────────── */

// main.py:2905 — (label, grupo, tipo_cod, monitora). `monitora` = o aviso pede
// ajuste e roda os 48h; sem ele o caso é só comunicado.
function rotuloCaso(origem, tipo) {
  const org = txt(origem).toLowerCase();
  const tp = txt(tipo).toLowerCase();
  if (org === "fora" || tp === "fora")
    return { label: "Bateu ponto fora", grupo: "motorista", monitora: false };
  if (org === "gordura")
    return { label: "Aviso de ajuste (gordura)", grupo: "motorista", monitora: true };
  if (org === "revisao") {
    if (tp === "cerco")
      return { label: "Aviso de ajuste (revisão)", grupo: "motorista", monitora: true };
    const label =
      { incompleto: "Registro incompleto", curta: "Jornada curta", almoco: "Almoço curto" }[tp] ||
      tp ||
      "Aviso da revisão";
    return { label, grupo: "interno", monitora: ["incompleto", "curta"].includes(tp) };
  }
  // legado sem origem: a migração deu origem=gordura aos casos antigos com aviso.
  return { label: "Aviso de ajuste (cerco)", grupo: "motorista", monitora: true };
}

// main.py:7822 — um aviso MAIS NOVO que a conferência reabriu o ciclo deste dia.
// O aceite guardado é do ciclo anterior e não decide o pedido novo.
function ehReaberto(caso) {
  const av = txt(caso?.aviso_enviado_em);
  const cf = txt(caso?.conferido_em);
  return Boolean(av && cf && av > cf);
}

// main.py:9170 — no ciclo reaberto os campos de decisão do ciclo velho são zerados.
function casoDoCiclo(caso) {
  if (!caso) return {};
  if (!ehReaberto(caso)) return caso;
  return {
    ...caso,
    aceite: "pendente",
    ajuste: null,
    ajuste_ids: "",
    aceito_em: null,
    conferido_em: null,
    advertencia_enviada_em: null,
    correcao_final_em: null,
    correcao_status: null,
  };
}

// main.py:7834 (_situacao) — a decisão gravada manda; sem decisão, o veredito.
// DEVIDO PROCESSO: recusar NÃO é advertir. A precedência abaixo é a do backend.
function situacaoDoCaso(veredito, caso, temAviso) {
  const c = caso || {};
  // Ponto fechado é DESFECHO, não pendência: o Transnet recusa a competência e o
  // dia nunca vai ser executado nem corrigido. Vem antes de tudo, até de corrigido.
  if (txt(c.correcao_status) === "ponto_fechado") return "ponto_fechado";
  if (txt(c.correcao_final_em)) return "corrigido";
  if (txt(c.aceite) === "rejeitado") {
    const dispensada = txt(c.correcao_status) === "dispensada";
    if (temAviso && !dispensada) return txt(c.conferido_em) ? "advertido" : "recusa_exec_pendente";
    // recusa dispensada não produz consequência: o que valeu foi o aceite.
    if (temAviso) return txt(c.conferido_em) ? "ok" : "recusa_exec_pendente";
    // SEM aviso a recusa encerra na própria porta de Pedidos.
    return txt(c.conferido_em) ? "recusado" : "recusa_exec_pendente";
  }
  if (txt(c.aceite) === "aceito") return txt(c.conferido_em) ? "ok" : "exec_pendente";
  return { certo: "conf_certo", errado: "conf_errado" }[veredito] || "conf";
}

// main.py:7885 (_ref_ponta) — a escada do CANON para achar a referência de UMA ponta.
function refDaPonta(sst, val, ct, esc) {
  const s = hm2m(sst);
  const v = hm2m(val);
  const c = hm2m(ct);
  const e = hm2m(esc);
  if (s != null && v != null && Math.abs(s - v) <= DELTA_FONTE)
    return [(s + v) / 2, "real (SST+bilhetagem)"];
  if (v != null && c != null && Math.abs(v - c) <= DELTA_FONTE)
    return [v, "real (bilhetagem+Citatti)"];
  if (v != null && c != null) return [v, `bilhetagem (Citatti divergiu ${Math.abs(v - c)} min)`];
  if (s != null && c != null && Math.abs(s - c) <= DELTA_FONTE)
    return [c, "Citatti (confirmado pelo SST)"];
  if (c != null && v == null)
    return [c, `Citatti${s != null ? " (SST divergiu — desconexão?)" : ""}`];
  if (s != null) return [s, "SST"];
  if (v != null) return [v, "bilhetagem"];
  return e != null ? [e, "escala"] : [null, ""];
}

// app.js:1586 (diaStatus) — o status do DIA a partir das pontas cobradas.
// PONTA INDEPENDENTE (PORTE.md §5): uma nunca anula a outra; misto obriga abrir o caso.
function statusDoDia(reg) {
  const st = [
    reg.cobrEntrada ? reg.verEntrada || "pendente" : null,
    reg.cobrSaida ? reg.verSaida || "pendente" : null,
  ].filter(Boolean);
  if (!st.length) return reg.veredito || "";
  const certo = st.includes("certo");
  const errado = st.includes("errado");
  const pendente = st.includes("pendente");
  if (certo && errado) return "misto";
  if (errado) return "errado";
  if (certo && !pendente) return "certo";
  if (pendente) return "pendente";
  return "";
}

// app.js:222 (decJa) — "eu já decidi esse?". `pendente` é o DEFAULT da coluna,
// não uma decisão: só aceito/rejeitado contam. Ciclo reaberto não conta.
function decisaoJaTomada(caso) {
  const c = caso || {};
  if (!["aceito", "rejeitado"].includes(txt(c.aceite))) return null;
  if (ehReaberto(c)) return null;
  return {
    aceito: txt(c.aceite) === "aceito",
    subiu: Boolean(txt(c.conferido_em)),
    quando: txt(c.conferido_em || c.aceito_em || c.atualizado_em).slice(0, 16).replace("T", " "),
  };
}

// app.js:117 (jaTratado) — o que sai da caixa de entrada de "Meus avisos".
function jaTratado(reg) {
  if (["advertido", "corrigido", "ajustou"].includes(reg.situacaoAviso)) return true;
  if (reg.reaberto) return false;
  return ["aceito", "rejeitado"].includes(txt(reg.caso?.aceite));
}

/* ─────────────────────────────── carga de dados ──────────────────────────── */

const COLS_AJUSTES =
  "id_ocorrencia,cracha,nome,date_ref,escala,tipo_ajuste,dia_posterior,ponto_antes," +
  "ponto_depois,horario_ajuste,alvo_etapa2,verdict,situacao_ajuste,respondido_por," +
  "origem,abertura,capturado_em,aceito_em,batida_atual,batida_nova";

const COLS_DIARIO =
  "cracha,date_ref,todas_batidas,batidas_limpas,jornada_liquida_min,entrada,saida," +
  "saida_almoco,volta_almoco,esc_entrada,esc_saida,entrada_sug,saida_sug," +
  "almoco_saida_sug,almoco_volta_sug,status_ponto,motivo,nm_funcao,categoria";

const COLS_GORDURA =
  "cracha,nm_funcionario,data_ref,esc_inicio,esc_fim,sst_vinculo,sst_desvinculo," +
  "val_inicio,val_fim,op_inicio,op_fim,real_inicio,real_fim,gordura_entrada," +
  "gordura_saida,nivel_entrada,nivel_saida";

const COLS_INTERVALO =
  "cracha,data_ref,sugestao_inicio,sugestao_fim,sugestao_duracao_min," +
  "sugestao_sst_inicio,sugestao_sst_fim,transnet_almoco_inicio,transnet_almoco_fim,status_almoco";

// Lê uma tabela do lake só nas chaves em cena. Sem o recorte, ponto_diario de 70
// dias traz a operação inteira (dezenas de milhares de linhas) para nada.
async function lerPorChaves(tabela, colCracha, colData, crachas, datas, colunas) {
  if (!crachas.length || !datas.length) return [];
  const listaDatas = datas.join(",");
  const out = [];
  for (const bloco of pedacos(crachas, 60)) {
    const linhas = await lerTudoDP360(tabela, {
      colunas,
      ordem: `${colCracha}.asc`,
      filtros: { [colCracha]: `in.(${bloco.join(",")})`, [colData]: `in.(${listaDatas})` },
    });
    out.push(...linhas);
  }
  return out;
}

async function carregarOcorrencias() {
  const inicio = isoDiasAtras(JANELA_DIAS);

  const [casos, ajustesBrutos, ocorrencias] = await Promise.all([
    lerTudoDP360("ponto_caso", {
      ordem: "date_ref.desc",
      filtros: { date_ref: `gte.${inicio}` },
    }),
    lerTudoDP360("ponto_ajustes_app", {
      colunas: COLS_AJUSTES,
      ordem: "capturado_em.desc",
      filtros: { capturado_em: `gte.${inicio}` },
    }),
    lerTudoDP360("ponto_ocorrencias", {
      colunas: "cracha,date_ref,tipo,status,lancado_em,usuario",
      ordem: "date_ref.desc",
      filtros: { date_ref: `gte.${inicio}` },
    }),
  ]);

  // ── PEDIDO VÁLIDO vs LIXO (obrigatório, supabase_client.ler_ajustes_app) ──
  // O lake guarda avisos, advertências e atestados na MESMA tabela, sem
  // `tipo_ajuste`. Essas linhas NÃO são pedido do colaborador — entram como lixo
  // na conferência e inflam a fila de decisão. Descarte é regra, não otimização.
  const pedidos = ajustesBrutos.filter((o) => txt(o.tipo_ajuste));
  const descartados = ajustesBrutos.length - pedidos.length;

  // chaves em cena = crachá × dia dos pedidos + dos casos
  const chaves = new Map();
  const anota = (cracha, data) => {
    const c = txt(cracha);
    const iso = paraISO(data);
    if (!c || !iso) return;
    chaves.set(`${cra8(c)}|${iso}`, { cracha: c, iso });
  };
  pedidos.forEach((o) => anota(o.cracha, o.date_ref));
  casos.forEach((c) => anota(c.cracha, c.date_ref));

  const crachasBrutos = new Set();
  const datas = new Set();
  chaves.forEach(({ cracha, iso }) => {
    crachasBrutos.add(cracha);
    crachasBrutos.add(cra8(cracha));
    datas.add(iso);
  });
  const listaCrachas = [...crachasBrutos];
  const listaDatas = [...datas];

  const [diario, gordura, intervalo, realManual] = await Promise.all([
    lerPorChaves("ponto_diario", "cracha", "date_ref", listaCrachas, listaDatas, COLS_DIARIO),
    lerPorChaves("ponto_gordura", "cracha", "data_ref", listaCrachas, listaDatas, COLS_GORDURA),
    lerPorChaves("ponto_intervalo", "cracha", "data_ref", listaCrachas, listaDatas, COLS_INTERVALO),
    lerPorChaves("ponto_real_manual", "cracha", "date_ref", listaCrachas, listaDatas, undefined),
  ]);

  return {
    casos,
    pedidos,
    ocorrencias,
    diario,
    gordura,
    intervalo,
    realManual,
    descartados,
    chaves,
    lidoEm: new Date().toISOString(),
  };
}

/* ────────────────────── montagem das linhas (a conferência) ──────────────── */

function montarRegistros(base) {
  if (!base) return [];
  const { casos, pedidos, ocorrencias, diario, gordura, intervalo, realManual, chaves } = base;

  const chave = (cracha, data) => `${cra8(cracha)}|${paraISO(data)}`;
  const indexar = (linhas, colData) => {
    const m = new Map();
    (linhas || []).forEach((r) => m.set(chave(r.cracha, r[colData]), r));
    return m;
  };

  const mapaCaso = indexar(casos, "date_ref");
  const mapaDiario = indexar(diario, "date_ref");
  const mapaGordura = indexar(gordura, "data_ref");
  const mapaIntervalo = indexar(intervalo, "data_ref");
  const mapaReal = indexar(realManual, "date_ref");

  // main.py:8190 (_dias_com_aviso) — houve aviso no dia? DUAS fontes: o carimbo do
  // caso e a ocorrência lançada. Ler só uma fazia a advertência nunca sair da fila.
  const diasComAviso = new Set();
  casos.forEach((c) => {
    if (txt(c.aviso_enviado_em)) diasComAviso.add(chave(c.cracha, c.date_ref));
  });
  (ocorrencias || []).forEach((o) => {
    if (txt(o.lancado_em)) diasComAviso.add(chave(o.cracha, o.date_ref));
  });

  // categoria (função) por crachá — ponto_diario.categoria, o mesmo de _cat_de.
  const categoriaPorCracha = new Map();
  (diario || []).forEach((r) => {
    const k = cra8(r.cracha);
    if (!categoriaPorCracha.has(k) && txt(r.categoria))
      categoriaPorCracha.set(k, txt(r.categoria).toUpperCase());
  });

  // pedidos agrupados por crachá × dia (1 dia = N ocorrências no Transnet)
  const grupos = new Map();
  pedidos.forEach((o) => {
    const k = chave(o.cracha, o.date_ref);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(o);
  });
  grupos.forEach((lista) =>
    lista.sort((a, b) => txt(a.capturado_em).localeCompare(txt(b.capturado_em))),
  );

  const registros = [];
  chaves.forEach(({ cracha, iso }, k) => {
    const grupo = grupos.get(k) || [];
    const casoBruto = mapaCaso.get(k) || null;
    const temAvisoCaso = Boolean(txt(casoBruto?.aviso_enviado_em));

    // linhas sem pedido e sem aviso não são caso nenhum (só ruído do join)
    if (!grupo.length && !temAvisoCaso) return;

    const cp = mapaDiario.get(k) || {};
    const g = mapaGordura.get(k) || {};
    const iv = mapaIntervalo.get(k) || {};
    const rm = mapaReal.get(k) || {};
    const caso = casoBruto || {};
    const reaberto = ehReaberto(caso);
    const ciclo = casoDoCiclo(caso);
    const temAviso = diasComAviso.has(k);

    const primeiro = grupo[0] || {};
    const ultimo = grupo[grupo.length - 1] || {};

    // ── cartão: antes fiel (ponto_diario) e o "depois" congelado nos pedidos ──
    // O merge por slot é o mesmo de consolidaDia (app.js:483): o estado final é o
    // último não-vazio de cada posição. O simulador do backend (_simula) NÃO foi
    // portado — aqui a prova é o `ponto_depois` que o lake já congelou.
    const antesCartao = batidasDoCartao(cp);
    const antesGrade = parseBatidas(primeiro.ponto_antes);
    const antes = antesCartao.length ? antesCartao : antesGrade;
    const depois = [];
    grupo.forEach((o) =>
      parseBatidas(o.ponto_depois).forEach((t, i) => {
        if (t) depois[i] = t;
      }),
    );
    const depoisLimpo = depois.filter(Boolean);

    // ── a régua do veredito, na ordem do get_conferencia (main.py:9130-9147):
    // Real manual do DP > ALVO congelado no caso > sugestão do dia > escada do canon.
    const alvoE = hm2m(caso.alvo_entrada);
    const alvoS = hm2m(caso.alvo_saida);
    const rmE = hm2m(rm.entrada);
    const rmS = hm2m(rm.saida);
    const sugE = hm2m(cp.entrada_sug);
    const sugS = hm2m(cp.saida_sug);
    const refE =
      rmE != null
        ? [rmE, "Real (você)"]
        : alvoE != null
          ? [alvoE, "régua do aviso"]
          : sugE != null
            ? [sugE, "sugestão do aviso"]
            : refDaPonta(g.sst_vinculo, g.val_inicio, g.op_inicio, cp.esc_entrada);
    const refS =
      rmS != null
        ? [rmS, "Real (você)"]
        : alvoS != null
          ? [alvoS, "régua do aviso"]
          : sugS != null
            ? [sugS, "sugestão do aviso"]
            : refDaPonta(g.sst_desvinculo, g.val_fim, g.op_fim, cp.esc_saida);

    // cobrado = o aviso pediu essa ponta (main.py:9151-9153)
    const pontaCaso = txt(caso.ponta).toLowerCase();
    const cobrEntrada = Boolean(txt(caso.alvo_entrada)) || ["entrada", "ambos"].includes(pontaCaso);
    const cobrSaida = Boolean(txt(caso.alvo_saida)) || ["saida", "ambos"].includes(pontaCaso);

    // main.py:7926 (_julga_ref) — só entra na conta a ponta que o pedido MEXEU.
    // Quem só ajustou a saída não pode ser reprovado pela entrada.
    const julga = (valor, ref) => {
      const b = hm2m(valor);
      if (b == null || ref == null || ref[0] == null) return "";
      return Math.abs(variante(ref[0], b) - b) <= TOLERANCIA_MIN ? "certo" : "errado";
    };
    const mexeuEntrada = depoisLimpo.length > 0 && (!antes.length || depoisLimpo[0] !== antes[0]);
    const mexeuSaida =
      depoisLimpo.length > 0 &&
      (!antes.length || depoisLimpo[depoisLimpo.length - 1] !== antes[antes.length - 1]);
    // main.py:9155 (_pst): cobrado e não mexeu = pendente; não pedido = fora.
    const pst = (st, cobr) => (st === "certo" || st === "errado" ? st : cobr ? "pendente" : "");
    const verEntrada = pst(mexeuEntrada ? julga(depoisLimpo[0], refE) : "", cobrEntrada);
    const verSaida = pst(
      mexeuSaida ? julga(depoisLimpo[depoisLimpo.length - 1], refS) : "",
      cobrSaida,
    );

    // veredito combinado: o congelado do lake manda (é o canônico); sem ele, o AND.
    const congelado = txt([...grupo].reverse().find((o) => txt(o.verdict))?.verdict).toLowerCase();
    const pontas = [verEntrada, verSaida].filter((x) => x === "certo" || x === "errado");
    const veredito = ["certo", "errado"].includes(congelado)
      ? congelado
      : pontas.length
        ? pontas.every((x) => x === "certo")
          ? "certo"
          : "errado"
        : "";

    // desfecho no Transnet (lake): recusado > pendente > efetuado (main.py:9032)
    const peso = { RECUSADO: 3, PENDENTE: 2, EFETUADO: 1 };
    let desfecho = "";
    grupo.forEach((o) => {
      const s = txt(o.situacao_ajuste).toUpperCase();
      if (s && (peso[s] || 0) > (peso[desfecho] || 0)) desfecho = s;
    });

    const situacao = situacaoDoCaso(veredito, ciclo, temAviso);
    const rot = rotuloCaso(caso.origem, caso.tipo);

    // ── monitor de avisos (main.py:4283-4361) ─────────────────────────────
    // ids ainda PENDENTES no Transnet que a nossa decisão NÃO cobre
    const idsDecididos = new Set(
      txt(ciclo.ajuste_ids)
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x.startsWith("A:") || x.startsWith("R:"))
        .map((x) => x.slice(2)),
    );
    const pendLivre = grupo.some(
      (o) =>
        txt(o.situacao_ajuste).toUpperCase() === "PENDENTE" &&
        !idsDecididos.has(txt(o.id_ocorrencia)),
    );
    const horas = horasDesde(caso.aviso_enviado_em);
    const restam = horas == null ? null : PRAZO_HORAS - horas;
    const mexeu = grupo.length > 0;
    const ajustou =
      rot.grupo === "interno"
        ? txt(cp.status_ponto).toUpperCase() === "OK"
        : ["aceito", "rejeitado"].includes(txt(caso.aceite));

    let situacaoAviso = "";
    let foraPrazo = false;
    if (txt(caso.aviso_cancelado_em) || txt(caso.aceite).toLowerCase() === "cancelado") {
      situacaoAviso = "cancelado";
    } else if (!rot.monitora && !pendLivre) {
      situacaoAviso = "comunicado";
    } else if (
      (txt(caso.correcao_final_em) || txt(caso.correcao_status) === "ponto_fechado") &&
      pendLivre
    ) {
      // pedido que chegou DEPOIS de o dia já ter sido fechado por nós: só recusa.
      situacaoAviso = "posterior";
    } else if (txt(caso.correcao_final_em)) {
      situacaoAviso = "corrigido";
    } else if (txt(caso.advertencia_enviada_em)) {
      situacaoAviso = "advertido";
    } else if (ajustou && !reaberto) {
      const s = situacaoDoCaso("", caso, temAviso);
      situacaoAviso = DESTINOS.includes(s) ? s : "ajustou";
    } else if (veredito) {
      situacaoAviso = veredito === "certo" ? "ajustou_certo" : "ajustou_errado";
      foraPrazo = horas != null && horas > PRAZO_HORAS;
    } else if (mexeu) {
      // REGRA: quem MEXEU sai do "vencido" mesmo fora do prazo. O prazo é para
      // corrigir; corrigiu, cumpriu a função (main.py:4348-4357).
      situacaoAviso = "ajustou_julgar";
      foraPrazo = horas != null && horas > PRAZO_HORAS;
    } else if (horas != null && horas > PRAZO_HORAS) {
      situacaoAviso = "vencido";
    } else {
      situacaoAviso = "aguardando";
    }

    const cat = categoriaPorCracha.get(cra8(cracha)) || "MOTORISTA";

    registros.push({
      k,
      cracha,
      cracha8: cra8(cracha),
      iso,
      dataBR: paraBR(iso),
      nome: txt(primeiro.nome) || txt(caso.nm_funcionario) || txt(g.nm_funcionario) || "—",
      categoria: cat,
      funcao: txt(cp.nm_funcao),
      caso,
      ciclo,
      cartao: cp,
      gordura: g,
      intervalo: iv,
      realManual: rm,
      ajustes: grupo,
      nAjustes: grupo.length,
      capturadoEm: txt(ultimo.capturado_em),
      antes,
      antesFonte: antesCartao.length ? "cartão" : "grade",
      depois: depoisLimpo,
      escala: [txt(cp.esc_entrada) || txt(g.esc_inicio), txt(cp.esc_saida) || txt(g.esc_fim)],
      alvo: [txt(caso.alvo_entrada), txt(caso.alvo_saida)],
      baseE: refE[1],
      baseS: refS[1],
      refE: refE[0] == null ? "" : m2hm(refE[0]),
      refS: refS[0] == null ? "" : m2hm(refS[0]),
      cobrEntrada,
      cobrSaida,
      verEntrada,
      verSaida,
      veredito,
      desfecho,
      situacao,
      situacaoAviso,
      temAviso,
      reaberto,
      monitora: rot.monitora,
      grupo: rot.grupo,
      tipoLabel: rot.label,
      horas,
      restam,
      foraPrazo,
      mexeu,
      pendLivre,
      decJa: decisaoJaTomada(caso),
    });
  });

  registros.forEach((r) => {
    r.diaStatus = statusDoDia(r);
  });
  registros.sort((a, b) => b.iso.localeCompare(a.iso) || a.nome.localeCompare(b.nome));
  return registros;
}

/* ────────────────────────── filtros de porta e aba ───────────────────────── */

// app.js:164 — o vínculo é o par (crachá, dia). Se existe aviso nosso no mesmo
// par, o ajuste dele é RESPOSTA e vive na porta "Enviamos para ajuste".
const daPorta = (porta) => (r) => {
  if (porta === "coment") return r.temAviso && !r.monitora;
  if (porta === "aviso") return r.temAviso && r.monitora;
  return !r.temAviso;
};

// app.js:2069 — o Transnet já efetuou/recusou: não existe mais decisão humana.
const resolvidoNoTransnet = (r) => ["EFETUADO", "RECUSADO"].includes(r.desfecho);

function linhasDaAba(registros, porta, aba) {
  const base = registros.filter(daPorta(porta));
  if (aba === "conf") {
    // app.js:2077 — a caixa de entrada da decisão do DP.
    return base.filter(
      (r) =>
        ["conf_certo", "conf_errado", "conf", "recusado"].includes(r.situacao) &&
        !resolvidoNoTransnet(r) &&
        !r.decJa,
    );
  }
  if (aba === "aguard") {
    // app.js:2883 — caixa de entrada de "Meus avisos": nunca o desfecho.
    return base.filter((r) => !SIT_DISC.includes(r.situacaoAviso) && !jaTratado(r));
  }
  if (aba === "coment") return base;
  if (aba === "cancel")
    return registros.filter(
      (r) =>
        txt(r.caso.aviso_cancelado_em) || txt(r.caso.aceite).toLowerCase() === "cancelado",
    );
  const cfg = {
    ok: ["ok"],
    exec: ["exec_pendente", "recusa_exec_pendente"],
    fechado: ["ponto_fechado"],
    // app.js:3315 — advertência e correção são vistas do MESMO caso: uma aba só.
    disc: ["advertido", "corrigido"],
    recusados: ["recusado", "corrigido"],
  }[aba];
  return cfg ? base.filter((r) => cfg.includes(r.situacao)) : base;
}

// app.js:438 (pintaPendentes) — quanto trabalho espera VOCÊ em cada porta/aba.
function contagens(registros) {
  const pend = (r) => !resolvidoNoTransnet(r);
  const pedidoConf = registros.filter(
    (r) =>
      !r.temAviso &&
      ["conf_certo", "conf_errado", "conf"].includes(r.situacao) &&
      !txt(r.caso.conferido_em) &&
      pend(r) &&
      !r.decJa,
  ).length;
  // pendente em avisos = respondeu (tem ajuste) OU venceu sem mexer
  const avisoConf = registros.filter(
    (r) =>
      r.temAviso &&
      r.monitora &&
      !jaTratado(r) &&
      (r.nAjustes > 0 || ["vencido", "ajustou_julgar"].includes(r.situacaoAviso)),
  ).length;
  const execDe = (porta) =>
    registros.filter(
      (r) =>
        daPorta(porta)(r) && ["exec_pendente", "recusa_exec_pendente"].includes(r.situacao),
    ).length;
  return {
    porta: { pedido: pedidoConf, aviso: avisoConf, coment: 0 },
    aba: {
      conf: pedidoConf,
      aguard: avisoConf,
      "pedido:exec": execDe("pedido"),
      "aviso:exec": execDe("aviso"),
    },
  };
}

/* ─────────────────────────── peças visuais reusáveis ─────────────────────── */

// cor lógica do domínio → pílula da ferramenta (styles.css .pill / dp360.css .dp-pill).
const PILL = { ok: "ok", erro: "danger", alerta: "warn", neutro: "mute", accent: "accent" };

// app.js:166 (SIT) — na ferramenta a situação pinta a LINHA INTEIRA: a cor da linha
// É a informação, não enfeite. Puro visual: nada aqui decide nada.
const LINHA_SIT = {
  conf_certo: "row-ok",
  conf_errado: "row-sem",
  conf: "row-sug",
  ok: "row-ok",
  advertido: "row-sem",
  corrigido: "row-ok",
  exec_pendente: "row-sug",
  recusa_exec_pendente: "row-sug",
  ponto_fechado: "row-sem",
  recusado: "row-sem",
  aguardando: "row-sug",
  comunicado: "",
  posterior: "row-sug",
  ajustou: "row-ok",
  ajustou_certo: "row-ok",
  ajustou_errado: "row-sem",
  ajustou_julgar: "row-sug",
  vencido: "row-sem",
  cancelado: "",
};

// Ciclo reaberto pinta de azul: é aviso novo por cima, não desfecho.
function classeDaLinha(reg, porta) {
  if (reg.reaberto) return "row-msg";
  const chave =
    porta === "aviso" && reg.situacaoAviso in LINHA_SIT ? reg.situacaoAviso : reg.situacao;
  return LINHA_SIT[chave] || "";
}

// pilhas/filas curtas — layout local, sem utilitário de framework
const PILHA = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 };
const FILA = { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" };
const MINI = { fontSize: 11, fontWeight: 600 };

function Selo({ cor = "neutro", titulo, quebra, children }) {
  return (
    <span
      title={titulo}
      className={`dp-pill ${PILL[cor] || PILL.neutro}`}
      style={quebra ? { whiteSpace: "normal" } : undefined}
    >
      {children}
    </span>
  );
}

function Contador({ n }) {
  if (!n) return null;
  return <span className="n">{n}</span>;
}

// Todo botão que GRAVA nasce assim nesta fase.
function BotaoBloqueado({ children, tom = "neutro" }) {
  const cor = { ok: "var(--dp-ok-ink)", erro: "var(--dp-danger-ink)" }[tom];
  return (
    <button
      type="button"
      disabled
      title={AVISO_FASE}
      className="dp-btn"
      style={cor ? { color: cor } : undefined}
    >
      {children}
    </button>
  );
}

// app.js:3819 (pontasChips) — o veredito POR PONTA. As pontas são INDEPENDENTES:
// uma nunca anula a outra, e o dia misto não entra em decisão em lote.
function PontasES({ reg }) {
  const chip = (lado, st, cobr) => {
    if (!cobr && !st) return null;
    const L = lado === "entrada" ? "E" : "S";
    if (st === "certo")
      return (
        <Selo key={L} cor="ok" titulo={`${lado}: certo — aceitar`}>
          {L} ✓
        </Selo>
      );
    if (st === "errado")
      return (
        <Selo key={L} cor="erro" titulo={`${lado}: errado — rejeitar`}>
          {L} ✗
        </Selo>
      );
    if (st === "pendente")
      return (
        <Selo key={L} cor="alerta" titulo={`${lado}: pendente — não mexeu (48h → adv/correção)`}>
          {L} •
        </Selo>
      );
    return null;
  };
  const chips = [
    chip("entrada", reg.verEntrada, reg.cobrEntrada),
    chip("saida", reg.verSaida, reg.cobrSaida),
  ].filter(Boolean);

  if (!chips.length) {
    if (reg.veredito === "certo")
      return (
        <Selo cor="ok" titulo={reg.baseE || reg.baseS}>
          ✓ certo
        </Selo>
      );
    if (reg.veredito === "errado")
      return (
        <Selo cor="erro" titulo={reg.baseE || reg.baseS}>
          ✗ errado
        </Selo>
      );
    return <Selo titulo="Sem referência para comparar — não force veredito">• sem base</Selo>;
  }
  return (
    <div style={PILHA}>
      <div style={FILA}>{chips}</div>
      {reg.diaStatus === "misto" ? (
        <Selo cor="alerta" titulo="Pontas divergem — decidir por ponta">
          ⚠ conferir · misto
        </Selo>
      ) : (
        <span className="dp-faint" style={MINI} title={`${reg.baseE} · ${reg.baseS}`}>
          {reg.baseE || reg.baseS || ""}
        </span>
      )}
    </div>
  );
}

// O cartão em chips mono, como no original (styles.css .chip). `contra` = o cartão
// anterior: a batida que não existia lá aparece marcada (.new).
function Cartao({ batidas, vazio = "—", contra = null }) {
  if (!batidas || !batidas.length) return <span className="dp-chip none">{vazio}</span>;
  const conhecidas = contra && contra.length ? new Set(contra) : null;
  const classe = (t) => `dp-chip${conhecidas && !conhecidas.has(t) ? " new" : ""}`;
  const primeira = batidas[0];
  const ultima = batidas[batidas.length - 1];
  return (
    <span style={FILA}>
      <span className={classe(primeira)}>
        <span className="es">E</span>
        {primeira}
      </span>
      {batidas.length > 1 ? (
        <span className={classe(ultima)}>
          <span className="es">S</span>
          {ultima}
        </span>
      ) : null}
      {batidas.length > 2 ? (
        <span className="dp-chip none" title={`Almoço: ${batidas.slice(1, -1).join(" · ")}`}>
          +{batidas.length - 2}
        </span>
      ) : null}
    </span>
  );
}

// app.js depoisFlags — o que sumiu do cartão sai riscado (.chip.del).
function Removidas({ antes, depois }) {
  const fica = new Set(depois || []);
  const fora = (antes || []).filter((t) => !fica.has(t));
  if (!fora.length) return null;
  return (
    <span style={FILA}>
      {fora.map((t, i) => (
        <span key={`${t}-${i}`} className="dp-chip del" title="batida removida pelo ajuste">
          {t}
        </span>
      ))}
    </span>
  );
}

/* ────────────────────────── células das grades ───────────────────────────── */

// A "Decisão" da porta Pedido. Nesta fase os dois lados são botões travados: a
// UI existe, a gravação não. O selo aparece quando a decisão já foi tomada.
function CelulaDecisao({ reg }) {
  if (reg.decJa) {
    return reg.decJa.subiu ? (
      <Selo cor="ok" titulo={`Executado no Transnet em ${reg.decJa.quando} — o dia está travado.`}>
        🔒 enviado · {reg.decJa.aceito ? "aceito" : "recusado"}
      </Selo>
    ) : (
      <Selo titulo={`Marcado em ${reg.decJa.quando}. Ainda não subiu: falta rodar o bot.`}>
        ✓ decidido · {reg.decJa.aceito ? "aceito" : "recusado"} — aguardando bot
      </Selo>
    );
  }
  const misto = reg.diaStatus === "misto";
  return (
    <div style={PILHA}>
      <div style={FILA}>
        <BotaoBloqueado tom="ok">Aceitar</BotaoBloqueado>
        <BotaoBloqueado tom="erro">Rejeitar</BotaoBloqueado>
      </div>
      {misto ? (
        <span style={{ ...MINI, color: "var(--dp-warn-ink)" }}>
          não entra em lote — abra o caso
        </span>
      ) : reg.diaStatus === "certo" ? (
        <span style={{ ...MINI, color: "var(--dp-ok-ink)" }}>sugestão: aceitar</span>
      ) : reg.diaStatus === "errado" ? (
        <span style={{ ...MINI, color: "var(--dp-danger-ink)" }}>
          sugestão: rejeitar {reg.temAviso ? "(com aviso → advertência)" : "(sem aviso → só recusa)"}
        </span>
      ) : null}
    </div>
  );
}

// app.js:3972 (env_prazo). PRAZO = 48h desde `aviso_enviado_em`.
function CelulaPrazo({ reg }) {
  if (!reg.monitora) return <span className="dp-faint">—</span>;
  if (reg.situacaoAviso === "advertido")
    return (
      <span className="dp-muted" style={MINI}>
        advertido · {fmtDataHora(txt(reg.caso.advertencia_enviada_em).slice(0, 10))}
      </span>
    );
  if (reg.situacaoAviso === "corrigido")
    return (
      <span className="dp-muted" style={MINI}>
        corrigido · {fmtDataHora(txt(reg.caso.correcao_final_em).slice(0, 10))}
      </span>
    );
  if (reg.restam == null) return <span className="dp-faint">—</span>;
  // Mexeu depois das 48h: NÃO é vencido — o prazo é para corrigir, e ele corrigiu.
  if (reg.foraPrazo)
    return (
      <Selo cor="alerta" titulo="Ele mexeu no ponto, mas só depois das 48h">
        ajustou fora do prazo
      </Selo>
    );
  if (["ajustou", "ajustou_certo", "ajustou_errado", "ajustou_julgar"].includes(reg.situacaoAviso))
    return <Selo cor="ok">ajustou a tempo</Selo>;
  if (reg.restam > 0)
    return (
      <Selo cor="alerta">
        faltam <span className="dp-num">{tempoHoras(reg.restam)}</span>
      </Selo>
    );
  return (
    <Selo cor="erro">
      vencido há <span className="dp-num">{tempoHoras(-reg.restam)}</span>
    </Selo>
  );
}

function CelulaAjustes({ reg, aoAbrir }) {
  // stopPropagation: a linha inteira também abre o caso; sem isso o clique no
  // botão dispara duas vezes e o painel abre e fecha no mesmo gesto.
  const clique = (e) => {
    e.stopPropagation();
    aoAbrir();
  };
  if (!reg.nAjustes)
    return (
      <button
        type="button"
        onClick={clique}
        title="Ele não mexeu no ponto depois do aviso. Abra para ver o caso."
        className="dp-btn"
      >
        não mexeu
      </button>
    );
  const cor = {
    certo: "var(--dp-ok-ink)",
    errado: "var(--dp-danger-ink)",
  }[reg.diaStatus] || "var(--dp-warn-ink)";
  return (
    <button
      type="button"
      onClick={clique}
      title="Abrir a mesa do dia: cada ajuste contra o alvo"
      className="dp-btn"
      style={{ color: cor }}
    >
      <span className="dp-num">{reg.nAjustes === 1 ? "1 ajuste" : `${reg.nAjustes} ajustes`}</span> ▾
    </button>
  );
}

function CelulaSituacao({ reg, campo = "situacao" }) {
  const s = SIT[reg[campo]] || { rotulo: reg[campo] || "—", cor: "neutro" };
  return (
    <div style={PILHA}>
      <Selo cor={s.cor}>{s.rotulo}</Selo>
      {reg.reaberto ? (
        <Selo cor="accent" titulo="Um aviso mais novo abriu outro ciclo: a decisão anterior não decide este.">
          ↻ reaberto
        </Selo>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── grade genérica ──────────────────────────── */

function Grade({ colunas, linhas, aoAbrir, vazio, porta }) {
  if (!linhas.length)
    return (
      <div className="dp-card" style={{ margin: "8px 20px 20px", textAlign: "center" }}>
        <span className="dp-muted">{vazio}</span>
      </div>
    );
  return (
    <div className="dp-tabela-wrap">
      <table className="dp-tabela">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((reg) => (
            <tr
              key={reg.k}
              onClick={() => aoAbrir(reg)}
              className={classeDaLinha(reg, porta)}
              style={{ cursor: "pointer" }}
            >
              {colunas.map((c) => (
                <td key={c.chave}>{c.render(reg)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────────────────────── painel de detalhe ─────────────────────────── */

const ROTULO_CARD = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

function Linha({ rotulo, children }) {
  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, padding: "3px 0" }}
    >
      <span className="dp-muted" style={{ ...ROTULO_CARD, width: 150, flexShrink: 0 }}>
        {rotulo}
      </span>
      <span>{children}</span>
    </div>
  );
}

function Detalhe({ reg, aoFechar }) {
  if (!reg) return null;
  const c = reg.caso;
  const etapas = [
    ["Aviso enviado", c.aviso_enviado_em],
    ["Aviso conferido no Transnet", c.aviso_conferido_em],
    ["Pedido capturado", reg.capturadoEm],
    [`Decisão do DP (${txt(c.aceite) || "pendente"})`, c.aceito_em],
    ["Bot conferiu no Transnet", c.conferido_em],
    ["Advertência enviada", c.advertencia_enviada_em],
    ["Correção do ponto", c.correcao_final_em],
    ["Aviso cancelado", c.aviso_cancelado_em],
  ].filter(([, v]) => txt(v));

  return (
    <div
      className="dp-card"
      style={{ margin: "0 20px 20px", borderColor: "var(--dp-accent)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ ...ROTULO_CARD, color: "var(--dp-accent)" }}>
            Caso · {reg.temAviso ? "Enviamos para ajuste" : "Pedido do colaborador"}
          </div>
          <h3 style={{ margin: "4px 0 2px", fontSize: 16, fontWeight: 700 }}>
            {reg.nome} <span className="dp-muted dp-num">· {reg.cracha}</span>
          </h3>
          <div className="dp-muted dp-num">
            {reg.dataBR} · {reg.categoria}
            {reg.funcao ? ` · ${reg.funcao}` : ""}
          </div>
        </div>
        <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar detalhe">
          <X size={14} />
        </button>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <div className="dp-card">
          <div className="dp-muted" style={ROTULO_CARD}>
            O pedido do colaborador
          </div>
          {reg.ajustes.length ? (
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {reg.ajustes.map((o, i) => (
                <li
                  key={txt(o.id_ocorrencia) || i}
                  style={{
                    background: "var(--dp-surface-2)",
                    borderRadius: 8,
                    padding: "7px 10px",
                    marginBottom: 6,
                  }}
                >
                  <div style={FILA}>
                    <Selo>{txt(o.tipo_ajuste) || "—"}</Selo>
                    <span className="dp-mono dp-num" style={{ fontWeight: 600 }}>
                      {txt(o.horario_ajuste) || "—"}
                    </span>
                    {txt(o.batida_atual) || txt(o.batida_nova) ? (
                      <span style={FILA}>
                        <span className="dp-chip del">{txt(o.batida_atual) || "—"}</span>
                        <ArrowRight size={12} className="dp-faint" />
                        <span className="dp-chip new">{txt(o.batida_nova) || "—"}</span>
                      </span>
                    ) : null}
                    {txt(o.situacao_ajuste) ? (
                      <Selo
                        cor={
                          txt(o.situacao_ajuste).toUpperCase() === "RECUSADO"
                            ? "erro"
                            : txt(o.situacao_ajuste).toUpperCase() === "EFETUADO"
                              ? "ok"
                              : "alerta"
                        }
                      >
                        Transnet: {txt(o.situacao_ajuste).toLowerCase()}
                      </Selo>
                    ) : null}
                  </div>
                  <div className="dp-faint" style={{ ...MINI, marginTop: 4 }}>
                    capturado em {fmtDataHora(o.capturado_em)}
                    {ehVerdadeiro(o.dia_posterior) ? " · dia posterior" : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dp-muted" style={{ margin: "8px 0 0" }}>
              Nenhum pedido neste crachá+dia — ele não mexeu no ponto depois do aviso.
            </p>
          )}
        </div>

        <div className="dp-card">
          <div className="dp-muted" style={ROTULO_CARD}>
            O cartão e a régua
          </div>
          <div style={{ marginTop: 8 }}>
            <Linha rotulo={`Antes (${reg.antesFonte})`}>
              <Cartao batidas={reg.antes} vazio="sem cartão" />
            </Linha>
            <Linha rotulo="Depois (congelado)">
              <span style={FILA}>
                <Cartao batidas={reg.depois} vazio="não mexeu" contra={reg.antes} />
                <Removidas antes={reg.antes} depois={reg.depois} />
              </span>
            </Linha>
            <Linha rotulo="Escala">
              <span className="dp-mono dp-num">
                {reg.escala[0] || "—"} – {reg.escala[1] || "—"}
              </span>
            </Linha>
            <Linha rotulo="Pedimos (alvo)">
              <span className="dp-mono dp-num">
                E {reg.alvo[0] || (reg.cobrEntrada ? "—" : "não pedido")} · S{" "}
                {reg.alvo[1] || (reg.cobrSaida ? "—" : "não pedido")}
              </span>
            </Linha>
            <Linha rotulo="Régua usada">
              <span className="dp-muted">
                E <span className="dp-mono dp-num">{reg.refE || "—"}</span> (
                {reg.baseE || "sem base"}) · S{" "}
                <span className="dp-mono dp-num">{reg.refS || "—"}</span> (
                {reg.baseS || "sem base"}) · tolerância {TOLERANCIA_MIN} min
              </span>
            </Linha>
            <Linha rotulo="Veredito por ponta">
              <PontasES reg={reg} />
            </Linha>
            <Linha rotulo="Situação">
              <CelulaSituacao reg={reg} />
            </Linha>
          </div>
        </div>
      </div>

      <div className="dp-card" style={{ marginTop: 12 }}>
        <div className="dp-muted" style={ROTULO_CARD}>
          Linha do tempo do caso
        </div>
        {etapas.length ? (
          <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
            {etapas.map(([rotulo, valor]) => (
              <li key={rotulo} style={{ ...FILA, gap: 6, padding: "2px 0" }}>
                <span style={{ color: "var(--dp-ok-ink)" }}>✓</span>
                <span style={{ fontWeight: 600 }}>{rotulo}</span>
                <span className="dp-muted dp-num">{fmtDataHora(valor)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dp-muted" style={{ margin: "8px 0 0" }}>
            Nenhuma etapa registrada — o caso ainda não entrou no ciclo.
          </p>
        )}
        {txt(c.correcao_status) ? (
          <p className="dp-faint" style={{ ...MINI, margin: "8px 0 0" }}>
            correcao_status: {txt(c.correcao_status)}
          </p>
        ) : null}
      </div>

      <div
        className="dp-card"
        style={{
          ...FILA,
          marginTop: 12,
          background: "var(--dp-warn-bg)",
          borderColor: "var(--dp-warn-bg)",
        }}
      >
        <Selo cor="alerta" quebra titulo={AVISO_FASE}>
          Somente leitura nesta fase — {AVISO_FASE.toLowerCase()}.
        </Selo>
        <span style={{ flex: 1 }} />
        <BotaoBloqueado tom="ok">Aceitar</BotaoBloqueado>
        <BotaoBloqueado tom="erro">Rejeitar</BotaoBloqueado>
        {reg.temAviso ? <BotaoBloqueado tom="erro">Advertir e corrigir</BotaoBloqueado> : null}
        <BotaoBloqueado>Cancelar aviso</BotaoBloqueado>
      </div>
    </div>
  );
}

/* ──────────────────────────────── componente ─────────────────────────────── */

export default function Ocorrencias() {
  const [base, setBase] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [porta, setPorta] = useState("pedido");
  const [aba, setAba] = useState("conf");
  const [funcao, setFuncao] = useState("TODAS");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);

  useEffect(() => {
    let ativo = true;
    carregarOcorrencias()
      .then((dados) => {
        if (ativo) setBase(dados);
      })
      .catch((falha) => {
        if (ativo) setErro(falha?.message || "Falha ao consultar a base DP360.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const registros = useMemo(() => montarRegistros(base), [base]);

  // Filtro global por função (app.js:151 — P5CATS).
  const porFuncao = useMemo(
    () => (funcao === "TODAS" ? registros : registros.filter((r) => r.categoria === funcao)),
    [registros, funcao],
  );

  const cont = useMemo(() => contagens(porFuncao), [porFuncao]);

  const abasDaPorta = ABAS[porta] || ABAS.pedido;
  const abaAtiva = abasDaPorta.some(([k]) => k === aba) ? aba : abasDaPorta[0][0];

  const linhas = useMemo(() => {
    const lista = linhasDaAba(porFuncao, porta, abaAtiva);
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.cracha.toLowerCase().includes(q),
    );
  }, [porFuncao, porta, abaAtiva, busca]);

  const trocarPorta = (id) => {
    setPorta(id);
    setAba((ABAS[id] || ABAS.pedido)[0][0]);
    setAberto(null);
  };

  const abrir = (reg) => setAberto((atual) => (atual?.k === reg.k ? null : reg));

  const regAberto = aberto ? registros.find((r) => r.k === aberto.k) || aberto : null;

  /* ── colunas de cada grade ── */
  const colColaborador = {
    chave: "nome",
    label: "Colaborador",
    render: (r) => (
      <div>
        <div style={{ fontWeight: 650 }}>{r.nome}</div>
        <div className="dp-faint dp-num" style={MINI}>
          {r.cracha} · {r.categoria}
        </div>
      </div>
    ),
  };
  const colDia = {
    chave: "dia",
    label: "Dia",
    render: (r) => <span className="dp-num">{r.dataBR}</span>,
  };
  const colChapa = {
    chave: "cracha",
    label: "Chapa",
    render: (r) => <span className="dp-num dp-mono">{r.cracha}</span>,
  };
  const colAjustes = {
    chave: "aj",
    label: "Ajustes",
    render: (r) => <CelulaAjustes reg={r} aoAbrir={() => abrir(r)} />,
  };

  // app.js:183 (COLS_CONF) — Pedidos: quem · dia · veredito por ponta · decisão · ajustes.
  const COLS_PEDIDO = [
    colColaborador,
    colDia,
    { chave: "pontas", label: "Veredito E/S", render: (r) => <PontasES reg={r} /> },
    { chave: "dec", label: "Decisão", render: (r) => <CelulaDecisao reg={r} /> },
    colAjustes,
  ];

  // app.js:2647 (COLS_ENV) — Meus avisos.
  const COLS_AVISO = [
    colColaborador,
    colChapa,
    { chave: "data", label: "Data", render: (r) => <span className="dp-num">{r.dataBR}</span> },
    { chave: "oq", label: "O que", render: (r) => <Selo>{r.tipoLabel}</Selo> },
    {
      chave: "atual",
      label: "Ponto atual",
      render: (r) => <Cartao batidas={batidasDoCartao(r.cartao)} />,
    },
    {
      chave: "alvo",
      label: "Pedimos (alvo)",
      render: (r) =>
        r.alvo[0] || r.alvo[1] ? (
          <span style={FILA}>
            {r.alvo[0] || r.cobrEntrada ? (
              <span className="dp-chip">
                <span className="es">E</span>
                {r.alvo[0] || "—"}
              </span>
            ) : null}
            {r.alvo[1] || r.cobrSaida ? (
              <span className="dp-chip">
                <span className="es">S</span>
                {r.alvo[1] || "—"}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="dp-faint">—</span>
        ),
    },
    colAjustes,
    { chave: "prazo", label: "Prazo (48h)", render: (r) => <CelulaPrazo reg={r} /> },
    {
      chave: "acao",
      label: "Ação",
      render: (r) =>
        r.situacaoAviso === "vencido" ? (
          <div style={PILHA}>
            <BotaoBloqueado tom="erro">⚠ Vencido — advertir e corrigir</BotaoBloqueado>
            <span style={{ ...MINI, color: "var(--dp-danger-ink)" }}>não entra em lote</span>
          </div>
        ) : (
          <CelulaDecisao reg={r} />
        ),
    },
  ];

  const COLS_COMENT = [
    colColaborador,
    colChapa,
    { chave: "data", label: "Data", render: (r) => <span className="dp-num">{r.dataBR}</span> },
    { chave: "oq", label: "O que", render: (r) => <Selo>{r.tipoLabel}</Selo> },
    {
      chave: "atual",
      label: "Ponto atual",
      render: (r) => <Cartao batidas={batidasDoCartao(r.cartao)} />,
    },
    {
      chave: "quando",
      label: "Enviado em",
      render: (r) => (
        <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_enviado_em)}</span>
      ),
    },
  ];

  const COLS_LISTA = [
    colColaborador,
    colDia,
    { chave: "sit", label: "Situação", render: (r) => <CelulaSituacao reg={r} /> },
    { chave: "pontas", label: "Veredito E/S", render: (r) => <PontasES reg={r} /> },
    {
      chave: "quando",
      label: "Quando",
      render: (r) => (
        <span className="dp-muted dp-num">
          {fmtDataHora(
            r.caso.correcao_final_em ||
              r.caso.advertencia_enviada_em ||
              r.caso.conferido_em ||
              r.caso.aceito_em ||
              r.caso.atualizado_em,
          )}
        </span>
      ),
    },
    colAjustes,
  ];

  const COLS_CANCEL = [
    colColaborador,
    colDia,
    { chave: "oq", label: "O que", render: (r) => <Selo>{r.tipoLabel}</Selo> },
    {
      chave: "quando",
      label: "Cancelado em",
      render: (r) => (
        <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_cancelado_em)}</span>
      ),
    },
    {
      chave: "acao",
      label: "Ação",
      render: () => <BotaoBloqueado>🗑 Cancelar no Transnet</BotaoBloqueado>,
    },
  ];

  const colunas =
    abaAtiva === "conf"
      ? COLS_PEDIDO
      : abaAtiva === "aguard"
        ? COLS_AVISO
        : abaAtiva === "coment"
          ? COLS_COMENT
          : abaAtiva === "cancel"
            ? COLS_CANCEL
            : COLS_LISTA;

  const VAZIOS = {
    conf: "Nenhum pedido aguardando decisão. Aguarde a captura do Transnet.",
    aguard: "Nenhum aviso esperando você — quem recebeu o aviso já foi tratado.",
    exec: "Nenhuma decisão aguardando execução do robô.",
    ok: "Nenhum dia fechado como OK nesta porta.",
    recusados: "Nenhuma recusa nesta porta.",
    disc: "Nenhuma advertência ou correção — e isso pode estar certo: só adverte quem recebeu aviso.",
    fechado: "Nenhum dia travado por competência fechada.",
    cancel: "Nenhum aviso cancelado.",
    coment: "Nenhum comunicado no período.",
  };

  const portaAtual = PORTAS.find((p) => p.id === porta) || PORTAS[0];

  return (
    <AbaShell
      carregando={carregando}
      erro={erro}
      filtros={
        <>
          <select
            value={funcao}
            onChange={(e) => setFuncao(e.target.value)}
            title="Filtro global por função"
          >
            {FUNCOES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou chapa…"
            style={{ width: 230 }}
          />
          <span className="dp-muted dp-num">
            {linhas.length} {linhas.length === 1 ? "caso" : "casos"} · janela de {JANELA_DIAS} dias
          </span>
          {base?.descartados ? (
            <span
              className="dp-faint dp-num"
              title="Linhas de ponto_ajustes_app sem tipo_ajuste (avisos, advertências, atestados). Não são pedido do colaborador."
            >
              · {base.descartados} linha(s) descartada(s) por não serem pedido
            </span>
          ) : null}
          <span style={{ flex: 1 }} />
          <span className="dp-faint dp-num">lido em {fmtDataHora(base?.lidoEm)}</span>
          <Selo cor="alerta" titulo={AVISO_FASE}>
            somente leitura
          </Selo>
        </>
      }
      resumo={
        /* A regra que manda na tela — sempre visível, no topo (PORTE.md §5). */
        <>
          <Selo cor="erro" quebra>
            Recusar não é advertir — advertência só existe depois de aviso registrado.
          </Selo>{" "}
          Recusa sem aviso encerra o caso. Entrada e saída são julgadas separadamente: uma nunca
          anula a outra, e dia misto obriga abrir o caso. Tolerância de julgamento: {TOLERANCIA_MIN}{" "}
          min · prazo do colaborador: {PRAZO_HORAS} h.
        </>
      }
    >
      {/* PORTAS — o primeiro nível da navegação. Cada porta diz a CONSEQUÊNCIA da
          recusa; por isso o texto de ajuda fica visível nas três, não só na ativa. */}
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          padding: "8px 20px 0",
        }}
      >
        {PORTAS.map((p) => {
          const ativa = p.id === porta;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => trocarPorta(p.id)}
              title={p.ajuda}
              className="dp-card"
              style={{
                font: "inherit",
                textAlign: "left",
                cursor: "pointer",
                ...(ativa
                  ? {
                      borderColor: "var(--dp-accent)",
                      background: "var(--dp-accent-soft)",
                      color: "var(--dp-accent)",
                    }
                  : null),
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 650 }}>{p.label}</span>
                {cont.porta[p.id] ? (
                  <span className="dp-pill danger n">{cont.porta[p.id]}</span>
                ) : null}
              </div>
              <p className={ativa ? "" : "dp-muted"} style={{ ...MINI, margin: "5px 0 0", lineHeight: 1.4 }}>
                {p.ajuda}
              </p>
            </button>
          );
        })}
      </div>

      {/* ABAS da porta escolhida — o segundo nível. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "12px 20px 0" }}>
        {abasDaPorta.map(([id, label]) => {
          const ativa = id === abaAtiva;
          const n = cont.aba[id] ?? cont.aba[`${porta}:${id}`] ?? 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setAba(id);
                setAberto(null);
              }}
              className={`dp-chip-f${ativa ? " on" : ""}`}
            >
              {label}
              <Contador n={n} />
            </button>
          );
        })}
      </div>

      <div className="dp-resumo" style={{ paddingTop: 10 }}>
        {portaAtual.ajuda}
      </div>

      <Grade
        colunas={colunas}
        linhas={linhas}
        aoAbrir={abrir}
        vazio={VAZIOS[abaAtiva] || "Nada por aqui."}
        porta={porta}
      />

      <Detalhe reg={regAberto} aoFechar={() => setAberto(null)} />
    </AbaShell>
  );
}

/* ============================================================================
 * TODO — FASE SEGUINTE: LIGAR A GRAVAÇÃO
 *
 * Nada abaixo roda. As chamadas ficam escritas para que a próxima fase só
 * precise validar a régua contra o app antigo e destravar os botões.
 * Regras que a gravação NÃO pode violar (PORTE.md §5, main.py:_situacao):
 *   · recusa SEM aviso registrado nunca vira advertência — só "recusado";
 *   · decidir ≠ executar: gravar a decisão e disparar o robô são dois passos,
 *     e o disparo exige escopo explícito (um clique sem escopo já processou
 *     34 casos indevidos);
 *   · dia MISTO e aviso VENCIDO não entram em decisão em lote;
 *   · o antes/depois e o alvo do aviso são congelados: nunca reescrever.
 *
 * import { upsertDP360 } from "../../../services/dp360Api";
 *
 * // Aceitar / rejeitar UM dia (porta Pedido e porta Aviso):
 * // await upsertDP360("ponto_caso", {
 * //   cracha: reg.cracha,
 * //   date_ref: reg.iso,
 * //   aceite: aceitar ? "aceito" : "rejeitado",
 * //   aceito_em: new Date().toISOString(),
 * //   // ajuste_ids: "A:<id>,R:<id>"  -> a decisão POR OCORRÊNCIA do pop-up
 * //   // correcao_status: "dispensada" quando o DP escolher "só rejeitar"
 * //   //   (isso tira o caso da fila de advertência PARA SEMPRE — confirmar antes)
 * // });
 *
 * // Cancelar um aviso (só quando _caso_pode_cancelar_aviso: sem resposta, sem
 * // aceite, sem advertência e sem correção):
 * // await upsertDP360("ponto_caso", {
 * //   cracha: reg.cracha, date_ref: reg.iso,
 * //   aviso_cancelado_em: new Date().toISOString(), aceite: "cancelado",
 * // });
 *
 * // Advertir + corrigir é do ROBÔ, não da tela: a tela grava a decisão e o
 * // disparo do workflow (Edge Function `dispatch-bot`) leva o escopo explícito
 * // [{ cracha, date_ref }]. O robô grava advertencia_enviada_em / correcao_final_em.
 *
 * Pendências conhecidas deste porte:
 *   · o simulador do backend (main.py::_simula / ferramenta/simulador.py) NÃO foi
 *     portado — o "depois" exibido é o `ponto_depois` congelado no lake, e o
 *     veredito por ponta é recalculado sobre ele com a mesma régua (±10 min).
 *     Antes de liberar a gravação, comparar linha a linha com get_conferencia.
 *   · aba Cancelamento lista o que já foi cancelado; a remoção da ocorrência no
 *     Transnet depende do robô (sincronizar_cancelamentos_ocorrencias).
 * ========================================================================== */
