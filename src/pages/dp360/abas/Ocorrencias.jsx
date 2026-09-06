// ============================================================================
// DP360 · Passo 5 — OCORRÊNCIAS  (porte do app antigo Sistemas/PONTO)
//
// FONTE DA VERDADE deste arquivo (não invente regra — tudo aqui tem origem):
//   app/ui/app.js   → viewP5 (~354), P5PORTAS (~133), P5ABAS (~134), SIT (~166),
//                     COLS_CONF (~183), COLS_ENV (~2647), pontasChips (~3819),
//                     diaStatus (~1586), jaTratado (~117), decJa (~222)
//   app/main.py     → get_conferencia (~8959), get_todas_ocorrencias (~4050),
//                     _situacao (~7834), _reaberto (~7822),
//                     _pendentes_advertencia (~8204), _rotulo_caso (~2905),
//                     _grava_contrato (~9467), confirmar_certos (~9498),
//                     desfazer_decisao (~9519), marcar_ajustes (~9542),
//                     confirmar_errados (~9664)
//   src/pages/dp360/regrasPonto.js → O MOTOR DE REGRAS (porte 1:1 do Python,
//                     validado a 100% contra ele: julgaRef 518/518, julgaAcoes
//                     1090/1090, simulaCartao 1316/1316, refPonta 1616/1616).
//                     NENHUM veredito é calculado à mão neste arquivo.
//   docs/dp360/PORTE.md (constantes e as regras que não podem ser reinventadas)
//
// ⚠ ESCOPO DESTA FASE — GRAVA A DECISÃO, NÃO EXECUTA.
// Aceitar / rejeitar / marcar por ocorrência / desfazer GRAVAM em `ponto_caso`
// (e o contrato antes/depois em `ponto_ajustes_app`). O que mexe no Transnet —
// rodar o bot, advertir, corrigir, cancelar a ocorrência — continua DESLIGADO:
// decidir e executar são dois passos, e o disparo exige escopo explícito (um
// clique sem escopo já processou 34 casos indevidos).
//
// A REGRA QUE MANDA NA TELA (PORTE.md §5): recusar ≠ advertir. Advertência só
// existe depois de aviso registrado. É por isso que a navegação é em DOIS
// NÍVEIS — primeiro a PORTA (de onde o dia veio), depois a aba. E é por isso
// que a recusa de um dia COM aviso não tem botão na grade: ela só acontece
// dentro do caso aberto, com o desfecho escolhido à mão.
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import { lerTudoDP360, upsertDP360 } from "../../../services/dp360Api";
import {
  CONSTANTES,
  batidasDoCartao,
  bloqueioSimulacao,
  difRelogio,
  hm2min,
  julgaAcoes,
  julgaRef,
  min2hm,
  normData,
  realocaDia,
  refDaPonta,
  refPonta,
  removeFantasmas,
  resumoAcoes,
  simulaCartao,
  textoBatidas,
} from "../regrasPonto";

/* ─────────────────────────── constantes do domínio ───────────────────────── */

// PORTE.md §4 — janela de dados de quase todas as leituras do DP360.
const JANELA_DIAS = 70;
// main.py:9959 (tol=10) — a tolerância do veredito é a do MOTOR, não uma cópia.
const TOLERANCIA_MIN = CONSTANTES.TOL_AJUSTE_MIN;
// PORTE.md §4 / main.py PRAZO_HORAS = 48.
const PRAZO_HORAS = 48;

// O que continua desligado nesta fase (só o que MEXE no Transnet).
const AVISO_EXEC =
  "Execução desligada: decidir e executar são dois passos. Gravar aqui não roda o bot.";

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

// CARIMBO DE GRAVAÇÃO. É o `datetime.now().isoformat()` do Python: hora LOCAL, sem
// fuso no texto. Não pode ser toISOString(): além da regra do projeto, `_reaberto`
// compara `aviso_enviado_em > conferido_em` COMO TEXTO — misturar um carimbo em UTC
// com os carimbos locais que já estão na tabela desloca a comparação em 3 horas e o
// ciclo reaberto passa a mentir.
function agoraISOLocal() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
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

function confirmar(texto) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  return window.confirm(texto);
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

// `dt_referencia_ponto` é o SEGUNDO dia de referência do lake — é ele que alimenta
// a realocação de dia do motor (main.py:6445). Sem a coluna, 71 pedidos eram
// julgados contra o cartão do dia errado.
const COLS_AJUSTES =
  "id_ocorrencia,cracha,nome,date_ref,escala,tipo_ajuste,dia_posterior,ponto_antes," +
  "ponto_depois,horario_ajuste,alvo_etapa2,verdict,situacao_ajuste,respondido_por," +
  "origem,abertura,capturado_em,aceito_em,batida_atual,batida_nova,dt_referencia_ponto";

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

  // chaves em cena = crachá × dia dos pedidos + dos casos. O dia ALTERNATIVO do
  // pedido entra na lista de datas: sem o cartão do outro dia a realocação do
  // motor (realocaDia) não tem contra o que casar a batida.
  const crachasBrutos = new Set();
  const datas = new Set();
  const anota = (cracha, data) => {
    const c = txt(cracha);
    const iso = normData(data);
    if (!c || !iso) return;
    crachasBrutos.add(c);
    crachasBrutos.add(cra8(c));
    datas.add(iso);
  };
  pedidos.forEach((o) => {
    anota(o.cracha, o.date_ref);
    anota(o.cracha, o.dt_referencia_ponto);
  });
  casos.forEach((c) => anota(c.cracha, c.date_ref));

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
    lidoEm: agoraISOLocal(),
  };
}

/* ────────────────────── montagem das linhas (a conferência) ──────────────── */

// O pedido do lake no formato que o MOTOR entende (regrasPonto: {tipo, hora, id}).
const pedidoDoMotor = (o) => ({
  tipo: txt(o.tipo_ajuste),
  hora: txt(o.horario_ajuste),
  ajuste: txt(o.horario_ajuste),
  id: txt(o.id_ocorrencia),
});

// main.py:9070-9082 (_prev) — a prévia simula CADA pedido uma vez, e só os que ainda
// estão abertos. Reenvio do mesmo pedido (17% do volume) quebrava a simulação, e
// EFETUADO/RECUSADO é história, não prévia (o efetuado já está dentro do cartão).
function pedidosDaPrevia(grupo) {
  const vistos = new Set();
  const prev = [];
  grupo.forEach((o) => {
    const st = txt(o.situacao_ajuste).toUpperCase();
    if (st === "EFETUADO" || st === "RECUSADO") return;
    const chave = `${txt(o.tipo_ajuste).toLowerCase().slice(0, 5)}\u0000${txt(o.horario_ajuste)}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    prev.push(o);
  });
  return prev;
}

function montarRegistros(base) {
  if (!base) return [];
  const { casos, pedidos, ocorrencias, diario, gordura, intervalo, realManual } = base;

  const chave = (cracha, data) => `${cra8(cracha)}|${normData(data)}`;
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

  // ── REALOCAÇÃO DE DIA (motor: realocaDia — porte de main.py:6445) ─────────
  // O lake traz DOIS dias de referência e eles divergem em 79% dos pedidos.
  // Quando a batida que ele quer mexer não está no cartão do nosso dia e está no
  // do outro, o dia é o outro. Roda ANTES de agrupar: o grupo do dia errado
  // julgava contra o cartão errado.
  let realocados = 0;
  const pedidosNoDia = (pedidos || []).map((o) => {
    const d0 = normData(o.date_ref);
    const alt = normData(o.dt_referencia_ponto);
    const r = realocaDia({
      pedido: {
        tipo: o.tipo_ajuste,
        batida_atual: o.batida_atual,
        ajuste: o.horario_ajuste,
        date_ref: d0,
        date_ref_alt: alt,
      },
      cartaoDoDia: mapaDiario.get(`${cra8(o.cracha)}|${d0}`) || {},
      cartaoDoDiaAlt: mapaDiario.get(`${cra8(o.cracha)}|${alt}`) || {},
    });
    if (!r.realocou) return { ...o, _iso: d0, _realocadoDe: "" };
    realocados += 1;
    return { ...o, _iso: r.dateRef, _realocadoDe: r.diaRealocado };
  });

  // chaves em cena = crachá × dia (já realocado) dos pedidos + dos casos
  const chaves = new Map();
  const anota = (cracha, iso) => {
    const c = txt(cracha);
    if (!c || !iso) return;
    chaves.set(`${cra8(c)}|${iso}`, { cracha: c, iso });
  };
  pedidosNoDia.forEach((o) => anota(o.cracha, o._iso));
  (casos || []).forEach((c) => anota(c.cracha, normData(c.date_ref)));

  // main.py:8190 (_dias_com_aviso) — houve aviso no dia? DUAS fontes: o carimbo do
  // caso e a ocorrência lançada. Ler só uma fazia a advertência nunca sair da fila.
  // É o mesmo separador que decide se uma RECUSA pode virar advertência.
  const diasComAviso = new Set();
  (casos || []).forEach((c) => {
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
  pedidosNoDia.forEach((o) => {
    const k = `${cra8(o.cracha)}|${o._iso}`;
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
    const cat = categoriaPorCracha.get(cra8(cracha)) || "MOTORISTA";

    // ── O CARTÃO ANTES (main.py:9057) ────────────────────────────────────────
    // Fonte = `todas_batidas` do nosso ponto_diario; a grade do Transnet distorce
    // (inclui batida que não existe e perde a notação >24h). Sem cartão, o
    // `ponto_antes` congelado no pedido. Tudo em MINUTOS, como o motor trabalha.
    const antesCartao = batidasDoCartao(cp);
    const antesMin = antesCartao.length ? antesCartao : batidasDoCartao(primeiro.ponto_antes);

    // main.py:9124 — `lim` = o cartão ANTES com os FANTASMAS REMOVIDOS. É contra
    // ele que o veredito mede "que ponta ele mexeu" (batida duplicada em <=6 min é
    // o MESMO evento; sem colapsar, um cartão de 3 batidas reais parece ter 4).
    // `desenrolar:false` reproduz a chamada crua do Python (lá o desenrolo é feito
    // dentro do simulador, não aqui).
    const { limpas: lim, fora: fantasmas } = removeFantasmas(antesMin, { desenrolar: false });

    // ── O CARTÃO DEPOIS = SIMULAÇÃO (motor: simulaCartao) ────────────────────
    // Não é mais o `ponto_depois` congelado lido do lake: o motor aplica os pedidos
    // sobre o cartão real, com as regras que o congelado não tem (ponta nova em vez
    // de substituição, encaixe da inserção, AM/PM, teto de 4 campos).
    const refsEscala = [hm2min(cp.esc_entrada), hm2min(cp.esc_saida)].filter((v) => v != null);
    const fechado = txt(cp.status_ponto).toUpperCase() === "SEM_PONTO";
    const prev = pedidosDaPrevia(grupo);
    const previa = simulaCartao({
      batidas: antesMin,
      pedidos: prev.map(pedidoDoMotor),
      refs: refsEscala,
      cartaoFechado: fechado,
    });
    let notas = previa.notas.filter((n) => !String(n).startsWith("_fantasma"));
    // "sem cartão" tem DUAS causas e a nota do simulador só conhece uma (main.py:9088).
    if (fechado) {
      notas = notas.map((n) =>
        String(n).includes("aguardando o dia fechar")
          ? "não bateu ponto no dia — nada a conferir"
          : n,
      );
    }
    let sim = previa.batidas;

    // main.py:9098-9122 — O "DEPOIS" TEM QUE RESPEITAR A DECISÃO. Enquanto aberto,
    // ele é a PRÉVIA de aceitar tudo; depois de decidido vira EVIDÊNCIA, e evidência
    // que ignora a decisão mente. Com decisão: simula SÓ o que foi aceito; e o
    // contrato congelado (ponto_depois) manda por cima.
    const decidido = ["aceito", "rejeitado"].includes(txt(ciclo.aceite));
    if (decidido) {
      const ids = txt(ciclo.ajuste_ids)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      const temPrefixo = ids.some((x) => x.slice(0, 2) === "A:" || x.slice(0, 2) === "R:");
      const aceitos = temPrefixo
        ? new Set(ids.filter((x) => x.slice(0, 2) === "A:").map((x) => x.slice(2)))
        : new Set(txt(ciclo.aceite) === "aceito" ? grupo.map((o) => txt(o.id_ocorrencia)) : []);
      const oks = prev.filter((o) => aceitos.has(txt(o.id_ocorrencia)));
      sim = oks.length
        ? simulaCartao({
            batidas: antesMin,
            pedidos: oks.map(pedidoDoMotor),
            refs: refsEscala,
            cartaoFechado: fechado,
          }).batidas
        : antesMin;
      const contratos = grupo.map((o) => txt(o.ponto_depois)).filter(Boolean);
      const contrato = contratos.length ? batidasDoCartao(contratos[contratos.length - 1]) : [];
      if (contrato.length === 2 || contrato.length === 4) sim = contrato;
    }

    // main.py:6702 (_bloqueio_simulacao) — por que este dia NÃO pode ser julgado.
    const bloqueio = bloqueioSimulacao(notas);

    // ── A RÉGUA (motor: refDaPonta) — main.py:9132-9147 ──────────────────────
    // Real manual do DP > ALVO congelado no caso > sugestão do dia > escada do canon.
    const fontesE = {
      sst: g.sst_vinculo,
      val: g.val_inicio,
      citatti: g.op_inicio,
      escala: cp.esc_entrada,
    };
    const fontesS = {
      sst: g.sst_desvinculo,
      val: g.val_fim,
      citatti: g.op_fim,
      escala: cp.esc_saida,
    };
    const refE = refDaPonta({
      ponta: "entrada",
      realManual: { entrada: rm.entrada },
      alvoCongelado: { entrada: caso.alvo_entrada },
      sugestaoDia: { entrada: cp.entrada_sug },
      fontes: fontesE,
    });
    const refS = refDaPonta({
      ponta: "saida",
      realManual: { saida: rm.saida },
      alvoCongelado: { saida: caso.alvo_saida },
      sugestaoDia: { saida: cp.saida_sug },
      fontes: fontesS,
    });
    // o que o CANON sozinho diria (sem a cascata) — só para explicar a régua na tela
    const canonE = refPonta({ ponta: "entrada", fontes: fontesE });
    const canonS = refPonta({ ponta: "saida", fontes: fontesS });

    // ── O VEREDITO (motor: julgaRef) — main.py:7926 ──────────────────────────
    // Mede o cartão simulado contra a régua, POR PONTA, e só a ponta que o pedido
    // mexeu. `refs` pré-resolvido = a assinatura crua do Python
    // (_julga_ref(lim, sim, ref_e, ref_s, tol)).
    const jr = julgaRef({
      cartaoAntes: lim,
      cartaoDepois: sim,
      refs: { entrada: refE, saida: refS },
      tol: TOLERANCIA_MIN,
    });
    if (!jr.combinado && jr.motivo) notas = [...notas, jr.motivo]; // main.py:9160

    // cobrado = o aviso pediu essa ponta (main.py:9151-9153)
    const pontaCaso = txt(caso.ponta).toLowerCase();
    const cobrEntrada = Boolean(txt(caso.alvo_entrada)) || ["entrada", "ambos"].includes(pontaCaso);
    const cobrSaida = Boolean(txt(caso.alvo_saida)) || ["saida", "ambos"].includes(pontaCaso);

    // main.py:9155 (_pst): cobrado e não mexeu = pendente; não pedido = fora.
    const pst = (st, cobr) => (st === "certo" || st === "errado" ? st : cobr ? "pendente" : "");
    const verEntrada = pst(jr.entrada, cobrEntrada);
    const verSaida = pst(jr.saida, cobrSaida);
    const veredito = jr.combinado || "";

    // ── VEREDITO POR OCORRÊNCIA (motor: julgaAcoes / resumoAcoes) ────────────
    // É o que permite decidir um dia MISTO sem "rejeitar tudo" (eram 124 casos).
    const acoes = julgaAcoes({
      pedidos: grupo.map(pedidoDoMotor),
      alvo: {
        entrada: caso.alvo_entrada,
        saida: caso.alvo_saida,
        almSaida: caso.alvo_alm_saida,
        almVolta: caso.alvo_alm_volta,
        origem: caso.origem,
      },
      gordura: g,
      sugestao: {
        entrada_sug: cp.entrada_sug,
        saida_sug: cp.saida_sug,
        almoco_saida_sug: cp.almoco_saida_sug,
        almoco_volta_sug: cp.almoco_volta_sug,
      },
      escala: { entrada: cp.esc_entrada, saida: cp.esc_saida },
      cartao: cp,
    });
    const resumo = resumoAcoes(acoes, {
      categoria: cat,
      temGordura: Boolean(g && Object.keys(g).length),
    });

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
      realocado: txt(primeiro._realocadoDe),
      capturadoEm: txt(ultimo.capturado_em),
      antes: lim,
      antesBruto: antesMin,
      antesFonte: antesCartao.length ? "cartão" : "grade",
      antesTexto: textoBatidas(lim),
      fantasmas,
      depois: sim,
      depoisTexto: textoBatidas(sim),
      notas,
      bloqueio,
      escala: [txt(cp.esc_entrada) || txt(g.esc_inicio), txt(cp.esc_saida) || txt(g.esc_fim)],
      alvo: [txt(caso.alvo_entrada), txt(caso.alvo_saida)],
      baseE: refE.rotulo,
      baseS: refS.rotulo,
      refE: refE.ref == null ? "" : min2hm(refE.ref),
      refS: refS.ref == null ? "" : min2hm(refS.ref),
      canonE,
      canonS,
      baseVeredito: jr.base,
      motivoVeredito: jr.motivo,
      cobrEntrada,
      cobrSaida,
      verEntrada,
      verSaida,
      veredito,
      acoes: acoes.itens,
      fonteAlvo: acoes.fonteAlvo,
      alvoPar: acoes.alvoPar,
      resumoAcoes: resumo,
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
    r.realocados = realocados;
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
      (r) => txt(r.caso.aviso_cancelado_em) || txt(r.caso.aceite).toLowerCase() === "cancelado",
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
      (r) => daPorta(porta)(r) && ["exec_pendente", "recusa_exec_pendente"].includes(r.situacao),
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

/* ═══════════════════════════ GRAVAÇÃO DA DECISÃO ═════════════════════════════
 * Campos: os de main.py, um a um. Nada inventado.
 *   confirmar_certos  (9498) · confirmar_errados (9664) · marcar_ajustes (9542)
 *   desfazer_decisao  (9519) · _grava_contrato   (9467)
 *
 * O QUE ESTA TELA NÃO FAZ: rodar o bot, advertir, corrigir, cancelar a ocorrência
 * no Transnet. Decidir ≠ executar.
 * ═══════════════════════════════════════════════════════════════════════════ */

// A CHAVE DA LINHA EXISTENTE MANDA. O upsert casa por (cracha, date_ref); se a
// linha do caso guarda '030061089' e a gente grava '30061089', nasce uma linha
// irmã e a decisão fica invisível para o resto do fluxo.
function chaveDoCaso(reg) {
  const c = reg.caso || {};
  if (txt(c.cracha) && txt(c.date_ref)) return { cracha: c.cracha, date_ref: c.date_ref };
  return { cracha: reg.cracha, date_ref: reg.iso };
}

const idsDoDia = (reg) => (reg.ajustes || []).map((o) => txt(o.id_ocorrencia)).filter(Boolean);

/**
 * main.py:9467 (_grava_contrato) — o CONTRATO da decisão: como o cartão estava e
 * como tem que ficar. CONGELAMENTO: nunca reescreve um contrato que já existe —
 * o primeiro é o que o DP aprovou, o resto é ruído. Falhar aqui não pode derrubar
 * a decisão (no Python o except é mudo); aqui devolvemos o aviso para a tela.
 */
async function gravaContrato(reg, ids, antes, depois) {
  const alvo = new Set((ids || []).map(txt).filter(Boolean));
  const dep = txt(depois);
  if (!alvo.size) return "";
  const linhas = [];
  (reg.ajustes || []).forEach((o) => {
    const id = txt(o.id_ocorrencia);
    if (!alvo.has(id)) return;
    if (txt(o.ponto_depois)) return; // já tem contrato — CONGELADO, não mexe
    const linha = { id_ocorrencia: id };
    if (txt(antes)) linha.ponto_antes = txt(antes);
    if (dep) linha.ponto_depois = dep;
    if (Object.keys(linha).length > 1) linhas.push(linha);
  });
  if (!linhas.length) return "";
  try {
    await upsertDP360("ponto_ajustes_app", linhas);
    return "";
  } catch (e) {
    return `decisão gravada, mas o contrato antes/depois falhou: ${e?.message || e}`;
  }
}

/** main.py:9498 (confirmar_certos) — aceite do DIA. */
async function gravarAceite(reg) {
  const agora = agoraISOLocal();
  const ids = idsDoDia(reg);
  // o "depois" só é congelado quando dá para confiar nele (sem nota grave)
  const aviso = await gravaContrato(reg, ids, reg.antesTexto, reg.bloqueio ? "" : reg.depoisTexto);
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: "aceito",
    ajuste: "certo",
    aceito_em: agora,
    ajuste_ids: ids.join(","),
    atualizado_em: agora,
  });
  return aviso;
}

/**
 * main.py:9664 (confirmar_errados) — recusa do DIA.
 *   modo 'completo' → segue para Advertências e Correções (só existe COM aviso).
 *   modo 'rejeitar' → correcao_status='dispensada': encerra, não adverte.
 * O `depois` NÃO é congelado numa recusa: o ponto fica como estava, e um contrato
 * de "depois" numa recusa viraria plano de execução de um cartão que ninguém
 * aprovou (mesma escolha de main.py:decidir_ajustes, `antes and not depois`).
 */
async function gravarRecusa(reg, modo) {
  const agora = agoraISOLocal();
  const ids = idsDoDia(reg);
  const aviso = await gravaContrato(reg, ids, reg.antesTexto, "");
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: "rejeitado",
    ajuste: "errado",
    ajuste_ids: ids.join(","),
    correcao_status: modo === "rejeitar" ? "dispensada" : "",
    atualizado_em: agora,
  });
  return aviso;
}

/** main.py:9519 (desfazer_decisao) — o caso volta para a fila. */
async function gravarDesfazer(reg) {
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: "pendente",
    ajuste: null,
    aceito_em: null,
    atualizado_em: agoraISOLocal(),
  });
  return "";
}

/**
 * main.py:9542 (marcar_ajustes) — veredito POR OCORRÊNCIA (A:/R: em ajuste_ids).
 * `aceite` fica PENDENTE de propósito: marcar é decisão, lançar é ação posterior.
 * É o caminho do dia MISTO — que não cabe em decisão de dia inteiro.
 */
async function gravarMarcacao(reg, aceitar, rejeitar) {
  const ace = (aceitar || []).map(txt).filter(Boolean);
  const rej = (rejeitar || []).map(txt).filter(Boolean);
  if (!ace.length && !rej.length) throw new Error("Nenhuma marcação.");
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: "pendente",
    ajuste: rej.length ? "errado" : "certo",
    ajuste_ids: [...ace.map((i) => `A:${i}`), ...rej.map((i) => `R:${i}`)].join(","),
    aceito_em: null,
    atualizado_em: agoraISOLocal(),
  });
  // o contrato guarda o cartão como ele fica ACEITANDO SÓ O QUE FOI MARCADO
  let depois = "";
  if (ace.length && !reg.bloqueio) {
    const aceitos = (reg.ajustes || []).filter((o) => ace.includes(txt(o.id_ocorrencia)));
    const sim = simulaCartao({
      batidas: reg.antesBruto,
      pedidos: aceitos.map(pedidoDoMotor),
      refs: [hm2min(reg.escala[0]), hm2min(reg.escala[1])].filter((v) => v != null),
      cartaoFechado: txt(reg.cartao?.status_ponto).toUpperCase() === "SEM_PONTO",
    });
    if (!bloqueioSimulacao(sim.notas)) depois = textoBatidas(sim.batidas);
  }
  return gravaContrato(reg, [...ace, ...rej], reg.antesTexto, depois);
}

/* ───────── as travas que protegem o trabalhador (não são conveniência de tela) ───────── */

// Este dia não comporta decisão NENHUMA — nem em lote, nem no caso aberto.
function motivoSemDecisao(reg) {
  if (reg.decJa) return "já decidido";
  if (resolvidoNoTransnet(reg)) return "o Transnet já resolveu";
  // NÃO EXISTE DECISÃO SOBRE O NADA. Dia sem pedido nenhum (ele não mexeu depois
  // do aviso) não se aceita nem se recusa: gravaria aceite com ajuste_ids vazio e
  // tiraria o caso da fila de advertência em silêncio — o oposto do que o dia pede.
  if (!reg.nAjustes) return "ele não mexeu no ponto — não há pedido para decidir";
  // VENCIDO: segue só a cadeia advertência → correção. Nunca aceite/recusa, nunca lote.
  if (reg.situacaoAviso === "vencido")
    return "aviso vencido — segue só a cadeia advertência → correção";
  return "";
}

// Por que este dia não pode entrar em decisão em MASSA (ou em aceite de dia inteiro).
function motivoForaDoLote(reg, acao) {
  const base = motivoSemDecisao(reg);
  if (base) return base;
  // DIA MISTO: uma ponta certa e outra errada obriga abrir o caso — a decisão
  // correta é por OCORRÊNCIA, não do dia inteiro.
  if (reg.diaStatus === "misto") return "dia misto — decidir por ocorrência, no caso aberto";
  // Sem simulação confiável não há cartão para prometer ao robô. (Recusar continua
  // podendo: main.py — "recusa não precisa de cartão nem de contrato".)
  if (reg.bloqueio) return reg.bloqueio;
  // Recusa de um dia COM aviso pode virar ADVERTÊNCIA: só no caso aberto, com o
  // desfecho escolhido à mão.
  if (acao === "rejeitar" && reg.temAviso)
    return "tem aviso no dia — a recusa pode virar advertência: abra o caso";
  return "";
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

// Botão que GRAVA. `tom` só pinta; quem decide se pode é o chamador.
function BotaoAcao({ children, tom = "neutro", titulo, onClick, disabled }) {
  const cor = { ok: "var(--dp-ok-ink)", erro: "var(--dp-danger-ink)" }[tom];
  return (
    <button
      type="button"
      title={titulo}
      onClick={onClick}
      disabled={disabled}
      className="dp-btn"
      style={cor && !disabled ? { color: cor } : undefined}
    >
      {children}
    </button>
  );
}

// O que MEXE NO TRANSNET continua travado nesta fase.
function BotaoExecucao({ children, tom = "neutro" }) {
  const cor = { ok: "var(--dp-ok-ink)", erro: "var(--dp-danger-ink)" }[tom];
  return (
    <button type="button" disabled title={AVISO_EXEC} className="dp-btn" style={cor ? { color: cor } : undefined}>
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
    if (reg.bloqueio)
      return (
        <Selo cor="alerta" quebra titulo={reg.bloqueio}>
          • não dá para julgar
        </Selo>
      );
    if (reg.veredito === "certo")
      return (
        <Selo cor="ok" titulo={reg.baseVeredito}>
          ✓ certo
        </Selo>
      );
    if (reg.veredito === "errado")
      return (
        <Selo cor="erro" titulo={reg.baseVeredito}>
          ✗ errado
        </Selo>
      );
    return (
      <Selo titulo={reg.motivoVeredito || "Sem referência para comparar — não force veredito"}>
        • sem base
      </Selo>
    );
  }
  return (
    <div style={PILHA}>
      <div style={FILA}>{chips}</div>
      {reg.diaStatus === "misto" ? (
        <Selo cor="alerta" titulo="Pontas divergem — decidir por ocorrência, no caso aberto">
          ⚠ conferir · misto
        </Selo>
      ) : (
        <span className="dp-faint" style={MINI} title={`${reg.baseE} · ${reg.baseS}`}>
          {reg.baseVeredito || reg.baseE || reg.baseS || ""}
        </span>
      )}
    </div>
  );
}

// O cartão em chips mono, como no original (styles.css .chip). Batidas em MINUTOS
// (é assim que o motor trabalha); `contra` = o cartão anterior, e a batida que não
// existia lá aparece marcada (.new).
function Cartao({ batidas, vazio = "—", contra = null }) {
  const b = (batidas || []).filter((t) => t != null);
  if (!b.length) return <span className="dp-chip none">{vazio}</span>;
  const conhecidas = contra && contra.length ? new Set(contra) : null;
  const classe = (t) => `dp-chip${conhecidas && !conhecidas.has(t) ? " new" : ""}`;
  const primeira = b[0];
  const ultima = b[b.length - 1];
  return (
    <span style={FILA}>
      <span className={classe(primeira)}>
        <span className="es">E</span>
        {min2hm(primeira)}
      </span>
      {b.length > 1 ? (
        <span className={classe(ultima)}>
          <span className="es">S</span>
          {min2hm(ultima)}
        </span>
      ) : null}
      {b.length > 2 ? (
        <span className="dp-chip none" title={`Almoço: ${b.slice(1, -1).map(min2hm).join(" · ")}`}>
          +{b.length - 2}
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
          {min2hm(t)}
        </span>
      ))}
    </span>
  );
}

/* ────────────────────────── células das grades ───────────────────────────── */

// A "Decisão" da porta Pedido / do monitor de avisos.
// REGRA DE OURO DESTA CÉLULA: aqui só se recusa o que NÃO PODE virar advertência.
// Dia com aviso, dia misto, aviso vencido e dia sem simulação confiável não têm
// botão de recusa na grade — abrem o caso.
function CelulaDecisao({ reg, gravando, aoAceitar, aoRejeitar, aoDesfazer, aoAbrir }) {
  if (reg.decJa) {
    return (
      <div style={PILHA}>
        {reg.decJa.subiu ? (
          <Selo cor="ok" titulo={`Executado no Transnet em ${reg.decJa.quando} — o dia está travado.`}>
            🔒 enviado · {reg.decJa.aceito ? "aceito" : "recusado"}
          </Selo>
        ) : (
          <>
            <Selo titulo={`Marcado em ${reg.decJa.quando}. Ainda não subiu: falta rodar o bot.`}>
              ✓ decidido · {reg.decJa.aceito ? "aceito" : "recusado"} — aguardando bot
            </Selo>
            <BotaoAcao
              titulo="Desfaz a decisão e devolve o caso para a fila (main.py:desfazer_decisao). Só vale enquanto o bot não executou."
              onClick={(e) => {
                e.stopPropagation();
                aoDesfazer(reg);
              }}
              disabled={gravando}
            >
              ↩ Desfazer decisão
            </BotaoAcao>
          </>
        )}
      </div>
    );
  }
  const trava = motivoForaDoLote(reg, "aceitar");
  const travaRecusa = motivoForaDoLote(reg, "rejeitar");
  return (
    <div style={PILHA}>
      <div style={FILA}>
        <BotaoAcao
          tom="ok"
          titulo={trava || "Grava aceite=aceito no caso (não roda o bot)"}
          disabled={Boolean(trava) || gravando}
          onClick={(e) => {
            e.stopPropagation();
            aoAceitar(reg);
          }}
        >
          Aceitar
        </BotaoAcao>
        {travaRecusa ? (
          <BotaoAcao
            titulo={`${travaRecusa} — abrir o caso`}
            onClick={(e) => {
              e.stopPropagation();
              aoAbrir(reg);
            }}
            disabled={gravando}
          >
            Rejeitar…
          </BotaoAcao>
        ) : (
          <BotaoAcao
            tom="erro"
            titulo="Sem aviso no dia: a recusa ENCERRA o caso (correcao_status=dispensada) e nunca vira advertência."
            disabled={gravando}
            onClick={(e) => {
              e.stopPropagation();
              aoRejeitar(reg, "rejeitar");
            }}
          >
            Rejeitar
          </BotaoAcao>
        )}
      </div>
      {reg.diaStatus === "misto" ? (
        <span style={{ ...MINI, color: "var(--dp-warn-ink)" }}>
          não entra em lote — abra o caso e decida por ocorrência
        </span>
      ) : reg.bloqueio ? (
        <span style={{ ...MINI, color: "var(--dp-warn-ink)" }}>{reg.bloqueio}</span>
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
  const cor =
    { certo: "var(--dp-ok-ink)", errado: "var(--dp-danger-ink)" }[reg.diaStatus] ||
    "var(--dp-warn-ink)";
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
        <Selo
          cor="accent"
          titulo="Um aviso mais novo abriu outro ciclo: a decisão anterior não decide este."
        >
          ↻ reaberto
        </Selo>
      ) : null}
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

// Um item do julgaAcoes (motor) — o veredito daquele pedido contra o alvo da ponta.
function ItemAcao({ item, marca, aoMarcar, travado }) {
  const cor = item.ok === true ? "ok" : item.ok === false ? "erro" : "alerta";
  const rotulo =
    item.ok === true ? "bate com o alvo" : item.ok === false ? "não bate" : "não dá para julgar";
  return (
    <li
      style={{
        background: "var(--dp-surface-2)",
        borderRadius: 8,
        padding: "7px 10px",
        marginBottom: 6,
      }}
    >
      <div style={FILA}>
        <Selo>{item.tipo || "—"}</Selo>
        <span className="dp-mono dp-num" style={{ fontWeight: 600 }}>
          {item.hora || "—"}
        </span>
        {item.n > 1 ? <Selo titulo="pedido reenviado">×{item.n}</Selo> : null}
        {item.ponta ? (
          <span className="dp-muted" style={MINI}>
            {item.ponta}
            {item.alvo ? ` · alvo ${item.alvo}` : ""}
            {item.dif != null ? ` · ${item.dif} min` : ""}
          </span>
        ) : null}
        <Selo cor={cor}>{rotulo}</Selo>
        {item.menos ? <Selo cor="ok" titulo="pediu MENOS: abriu mão de tempo">pediu menos</Selo> : null}
        {item.excl ? <Selo titulo="exclusão: a régua é invertida">exclusão</Selo> : null}
        {item.redundante ? (
          <Selo cor="alerta" titulo={`já existe ${item.redundante} no cartão`}>
            redundante
          </Selo>
        ) : null}
        {item.viraAlteracao ? (
          <Selo cor="alerta" titulo={`o certo seria ALTERAR a batida ${item.viraAlteracao}`}>
            era alteração
          </Selo>
        ) : null}
        {item.orfao ? (
          <Selo cor="erro" titulo="a batida de origem não está no cartão — aceitar não faz nada">
            órfã
          </Selo>
        ) : null}
        {item.semAlvoPonta ? (
          <Selo cor="alerta" titulo="a ponta que ele mirou não tem alvo — não se julga contra a outra">
            sem alvo nesta ponta
          </Selo>
        ) : null}
      </div>
      <div style={{ ...FILA, marginTop: 5 }}>
        {["A", "R", ""].map((v) => (
          <label key={v || "nada"} style={{ ...MINI, ...FILA, gap: 3, cursor: travado ? "default" : "pointer" }}>
            <input
              type="radio"
              disabled={travado}
              checked={marca === v}
              onChange={() => aoMarcar(v)}
            />
            {v === "A" ? "aceitar" : v === "R" ? "rejeitar" : "não marcar"}
          </label>
        ))}
        <span className="dp-faint" style={MINI}>
          {item.ids.length ? `ocorrência ${item.ids.join(", ")}` : "sem id de ocorrência"}
        </span>
      </div>
    </li>
  );
}

function Detalhe({ reg, aoFechar, gravando, aoAceitar, aoRejeitar, aoDesfazer, aoMarcar }) {
  // marcação por ocorrência: começa com o que o MOTOR julgou (julgaAcoes.ok)
  const inicial = useMemo(() => {
    const m = {};
    (reg?.acoes || []).forEach((it, i) => {
      m[i] = it.ok === true ? "A" : it.ok === false ? "R" : "";
    });
    return m;
  }, [reg?.acoes]);
  const [marcas, setMarcas] = useState(inicial);
  useEffect(() => setMarcas(inicial), [inicial]);

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

  const idsMarcados = (letra) =>
    (reg.acoes || []).flatMap((it, i) => (marcas[i] === letra ? it.ids : []));
  const aceitarIds = idsMarcados("A");
  const rejeitarIds = idsMarcados("R");
  // aceitar precisa de cartão simulável e de dia não-misto; recusar, não (main.py).
  const travaAceite = motivoForaDoLote(reg, "aceitar");
  const travaRecusa = motivoSemDecisao(reg);

  return (
    <div className="dp-card" style={{ margin: "0 20px 20px", borderColor: "var(--dp-accent)" }}>
      <div
        style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}
      >
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
            {reg.realocado ? ` · pedido veio do dia ${paraBR(reg.realocado)}` : ""}
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
            O pedido do colaborador — veredito por ocorrência
          </div>
          {reg.ajustes.length ? (
            <>
              <div className="dp-faint" style={{ ...MINI, margin: "6px 0" }}>
                alvo: {reg.alvoPar?.[0] || "—"} / {reg.alvoPar?.[1] || "—"} (fonte:{" "}
                {reg.fonteAlvo || "sem alvo"}) · resumo do motor:{" "}
                {reg.resumoAcoes?.resumo || "—"}
              </div>
              <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                {reg.acoes.map((it, i) => (
                  <ItemAcao
                    key={`${it.tipo}-${it.hora}-${i}`}
                    item={it}
                    marca={marcas[i] ?? ""}
                    travado={Boolean(reg.decJa) || gravando}
                    aoMarcar={(v) => setMarcas((m) => ({ ...m, [i]: v }))}
                  />
                ))}
              </ul>
              <div style={{ ...FILA, marginTop: 8 }}>
                <BotaoAcao
                  titulo="Grava A:/R: por ocorrência em ajuste_ids (main.py:marcar_ajustes). O aceite do dia continua PENDENTE: marcar é decidir, lançar é outro passo."
                  disabled={Boolean(reg.decJa) || gravando || (!aceitarIds.length && !rejeitarIds.length)}
                  onClick={() => aoMarcar(reg, aceitarIds, rejeitarIds)}
                >
                  Gravar marcação por ocorrência ({aceitarIds.length}A / {rejeitarIds.length}R)
                </BotaoAcao>
                <span className="dp-faint" style={MINI}>
                  é por aqui que o dia MISTO se decide
                </span>
              </div>
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                {reg.ajustes.map((o, i) => (
                  <li key={txt(o.id_ocorrencia) || i} className="dp-faint" style={{ ...MINI, ...FILA }}>
                    <span className="dp-mono">{txt(o.id_ocorrencia) || "—"}</span>
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
                    <span>capturado em {fmtDataHora(o.capturado_em)}</span>
                    {ehVerdadeiro(o.dia_posterior) ? <span>· dia posterior</span> : null}
                    {txt(o.ponto_depois) ? (
                      <span title="contrato já congelado — não será reescrito">· contrato congelado</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
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
              <span style={FILA}>
                <Cartao batidas={reg.antes} vazio="sem cartão" />
                {reg.fantasmas?.length ? (
                  <span
                    className="dp-faint"
                    style={MINI}
                    title="batidas duplicadas em ≤6 min — o mesmo evento registrado duas vezes"
                  >
                    fantasmas: {reg.fantasmas.map(min2hm).join(" · ")}
                  </span>
                ) : null}
              </span>
            </Linha>
            <Linha rotulo="Depois (simulado)">
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
                E <span className="dp-mono dp-num">{reg.refE || "—"}</span> ({reg.baseE || "sem base"}
                ) · S <span className="dp-mono dp-num">{reg.refS || "—"}</span> (
                {reg.baseS || "sem base"}) · tolerância {TOLERANCIA_MIN} min
              </span>
            </Linha>
            <Linha rotulo="O canon sozinho">
              <span className="dp-faint" style={MINI}>
                E {reg.canonE?.ref == null ? "—" : min2hm(reg.canonE.ref)} (
                {reg.canonE?.rotulo || "sem fonte"})
                {reg.canonE?.ref != null && reg.refE
                  ? ` · ${difRelogio(reg.canonE.ref, hm2min(reg.refE))} min da régua`
                  : ""}{" "}
                · S {reg.canonS?.ref == null ? "—" : min2hm(reg.canonS.ref)} (
                {reg.canonS?.rotulo || "sem fonte"})
                {reg.canonS?.ref != null && reg.refS
                  ? ` · ${difRelogio(reg.canonS.ref, hm2min(reg.refS))} min da régua`
                  : ""}{" "}
                · concordância entre fontes: {CONSTANTES.DELTA_FONTE} min
              </span>
            </Linha>
            <Linha rotulo="Veredito por ponta">
              <PontasES reg={reg} />
            </Linha>
            <Linha rotulo="Situação">
              <CelulaSituacao reg={reg} />
            </Linha>
            {reg.notas?.length ? (
              <Linha rotulo="O que o motor viu">
                <span className="dp-muted" style={MINI}>
                  {reg.notas.join(" · ")}
                </span>
              </Linha>
            ) : null}
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

      {/* DECISÃO DO DIA. As duas recusas são botões DIFERENTES de propósito:
          "recusar" e "advertir" nunca podem sair do mesmo clique. */}
      <div
        className="dp-card"
        style={{ marginTop: 12, background: "var(--dp-surface-2)" }}
      >
        <div className="dp-muted" style={ROTULO_CARD}>
          Decisão do DP — grava em ponto_caso, não roda o bot
        </div>
        <div style={{ ...FILA, marginTop: 8 }}>
          {reg.decJa ? (
            <>
              <Selo cor={reg.decJa.aceito ? "ok" : "erro"}>
                já decidido · {reg.decJa.aceito ? "aceito" : "recusado"} em {reg.decJa.quando}
              </Selo>
              {reg.decJa.subiu ? (
                <span className="dp-muted" style={MINI}>
                  o bot já executou no Transnet — não dá mais para desfazer por aqui.
                </span>
              ) : (
                <BotaoAcao
                  titulo="main.py:desfazer_decisao — aceite volta a 'pendente'"
                  disabled={gravando}
                  onClick={() => aoDesfazer(reg)}
                >
                  ↩ Desfazer decisão
                </BotaoAcao>
              )}
            </>
          ) : (
            <>
              <BotaoAcao
                tom="ok"
                titulo={travaAceite || "Grava aceite=aceito, ajuste=certo e o contrato antes/depois"}
                disabled={Boolean(travaAceite) || gravando}
                onClick={() => aoAceitar(reg)}
              >
                Aceitar o dia
              </BotaoAcao>
              {reg.temAviso ? (
                <>
                  <BotaoAcao
                    tom="erro"
                    titulo={
                      travaRecusa ||
                      "Rejeita E MANTÉM o caso na cadeia de advertência/correção (correcao_status vazio). Só é possível porque existe aviso registrado neste crachá+dia."
                    }
                    disabled={Boolean(travaRecusa) || gravando}
                    onClick={() => aoRejeitar(reg, "completo")}
                  >
                    Rejeitar → advertência e correção
                  </BotaoAcao>
                  <BotaoAcao
                    titulo={
                      travaRecusa ||
                      "Rejeita e ENCERRA: correcao_status='dispensada' tira o caso da fila de advertência para sempre."
                    }
                    disabled={Boolean(travaRecusa) || gravando}
                    onClick={() => aoRejeitar(reg, "rejeitar")}
                  >
                    Só rejeitar (dispensa advertência)
                  </BotaoAcao>
                </>
              ) : (
                <BotaoAcao
                  tom="erro"
                  titulo={
                    travaRecusa ||
                    "Sem aviso no dia: a recusa encerra o caso (dispensada) e NUNCA vira advertência."
                  }
                  disabled={Boolean(travaRecusa) || gravando}
                  onClick={() => aoRejeitar(reg, "rejeitar")}
                >
                  Rejeitar (encerra — sem advertência)
                </BotaoAcao>
              )}
            </>
          )}
          <span style={{ flex: 1 }} />
          <BotaoExecucao tom="erro">Advertir e corrigir (robô)</BotaoExecucao>
          <BotaoExecucao>Cancelar aviso no Transnet</BotaoExecucao>
        </div>
        <p className="dp-faint" style={{ ...MINI, margin: "8px 0 0" }}>
          {reg.temAviso
            ? "Existe aviso registrado neste crachá+dia (ponto_caso.aviso_enviado_em ou ponto_ocorrencias.lancado_em): a recusa PODE virar advertência — por isso o desfecho é escolhido à mão."
            : "Não há aviso registrado neste crachá+dia em nenhuma das duas fontes: a recusa encerra o caso e nunca vira advertência."}{" "}
          {AVISO_EXEC}
        </p>
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
  const [gravando, setGravando] = useState(false);
  const [recado, setRecado] = useState("");
  const [selIds, setSelIds] = useState([]);
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await carregarOcorrencias();
      setBase(dados);
      setErro("");
    } catch (falha) {
      setErro(falha?.message || "Falha ao consultar a base DP360.");
    } finally {
      setCarregando(false);
    }
  }, []);

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
    setSelIds([]);
  };

  const abrir = (reg) => setAberto((atual) => (atual?.k === reg.k ? null : reg));

  const regAberto = aberto ? registros.find((r) => r.k === aberto.k) || aberto : null;

  /* ── gravação: sempre no CLIQUE, sempre com confirmação, sempre recarregando ── */

  const executarGravacao = useCallback(
    async (rotulo, tarefa) => {
      setGravando(true);
      setRecado("");
      try {
        const aviso = await tarefa();
        setRecado(aviso ? `${rotulo} — ${aviso}` : `${rotulo} ✓`);
        setSelIds([]);
        setVersao((v) => v + 1);
        await carregar();
      } catch (e) {
        // o erro REAL do gateway (o dp360Api já desembrulha o motivo do 4xx)
        setRecado(`Falhou: ${e?.message || e}`);
      } finally {
        setGravando(false);
      }
    },
    [carregar],
  );

  const aoAceitar = useCallback(
    (reg) => {
      const trava = motivoForaDoLote(reg, "aceitar");
      if (trava) {
        setRecado(`Não dá para aceitar: ${trava}.`);
        return;
      }
      const ok = confirmar(
        `ACEITAR o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}).\n\n` +
          `Grava em ponto_caso: aceite=aceito, ajuste=certo, aceito_em, ajuste_ids (${reg.nAjustes} ocorrência(s)).\n` +
          `Contrato antes/depois: ${reg.antesTexto || "—"} → ${reg.depoisTexto || "—"} (só onde ainda não estiver congelado).\n\n` +
          `NÃO roda o bot: a execução no Transnet continua desligada.`,
      );
      if (!ok) return;
      executarGravacao(`Aceite gravado (${reg.nome} · ${reg.dataBR})`, () => gravarAceite(reg));
    },
    [executarGravacao],
  );

  const aoRejeitar = useCallback(
    (reg, modo) => {
      const trava = motivoSemDecisao(reg);
      if (trava) {
        setRecado(`Não dá para recusar: ${trava}.`);
        return;
      }
      // TRAVA DA ADVERTÊNCIA INDEVIDA: sem aviso registrado, a recusa é sempre
      // 'dispensada'. Com aviso, o modo 'completo' é escolha explícita do DP.
      const modoReal = reg.temAviso ? modo : "rejeitar";
      if (modo === "completo" && !reg.temAviso) {
        setRecado(
          "Sem aviso registrado neste crachá+dia (nem ponto_caso.aviso_enviado_em nem ponto_ocorrencias.lancado_em): recusar aqui não pode virar advertência.",
        );
        return;
      }
      const texto =
        modoReal === "completo"
          ? `REJEITAR o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}) MANTENDO a cadeia de advertência e correção.\n\n` +
            `Existe aviso registrado neste crachá+dia, então esta recusa PODE virar ADVERTÊNCIA depois.\n` +
            `Grava: aceite=rejeitado, ajuste=errado, correcao_status="" (vazio = segue o fluxo).\n\n` +
            `A advertência e a correção continuam sendo do robô, e o robô NÃO é disparado aqui.`
          : `REJEITAR o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}) e ENCERRAR.\n\n` +
            `Grava: aceite=rejeitado, ajuste=errado, correcao_status="dispensada".\n` +
            `"dispensada" tira o caso da fila de advertência E de correção — para sempre.\n\n` +
            `${reg.temAviso ? "Há aviso no dia, mas você está escolhendo NÃO advertir." : "Não há aviso no dia: recusar não é advertir."}`;
      if (!confirmar(texto)) return;
      executarGravacao(`Recusa gravada (${reg.nome} · ${reg.dataBR})`, () =>
        gravarRecusa(reg, modoReal),
      );
    },
    [executarGravacao],
  );

  const aoDesfazer = useCallback(
    (reg) => {
      if (reg.decJa?.subiu) {
        setRecado("O bot já executou este caso no Transnet: desfazer aqui não desfaz lá.");
        return;
      }
      if (
        !confirmar(
          `DESFAZER a decisão do dia ${reg.dataBR} de ${reg.nome}.\n\n` +
            `Grava: aceite=pendente, ajuste=null, aceito_em=null. O caso volta para a fila.`,
        )
      )
        return;
      executarGravacao(`Decisão desfeita (${reg.nome} · ${reg.dataBR})`, () => gravarDesfazer(reg));
    },
    [executarGravacao],
  );

  const aoMarcar = useCallback(
    (reg, aceitarIds, rejeitarIds) => {
      const trava = motivoSemDecisao(reg);
      if (trava) {
        setRecado(`Não dá para marcar: ${trava}.`);
        return;
      }
      if (!aceitarIds.length && !rejeitarIds.length) {
        setRecado("Nenhuma marcação.");
        return;
      }
      if (
        !confirmar(
          `MARCAR POR OCORRÊNCIA o dia ${reg.dataBR} de ${reg.nome}.\n\n` +
            `Aceitar: ${aceitarIds.join(", ") || "—"}\nRejeitar: ${rejeitarIds.join(", ") || "—"}\n\n` +
            `Grava ajuste_ids com A:/R: e mantém aceite=pendente — marcar é decidir, lançar é outro passo.`,
        )
      )
        return;
      executarGravacao(`Marcação gravada (${reg.nome} · ${reg.dataBR})`, () =>
        gravarMarcacao(reg, aceitarIds, rejeitarIds),
      );
    },
    [executarGravacao],
  );

  /* ── decisão em LOTE — com as travas do trabalhador ── */

  const emLote = useCallback(
    (acao) => {
      const alvo = linhas.filter((r) => selIds.includes(r.k));
      if (!alvo.length) {
        setRecado("Nenhuma linha marcada.");
        return;
      }
      const bloqueados = alvo
        .map((r) => ({ r, motivo: motivoForaDoLote(r, acao) }))
        .filter((x) => x.motivo);
      if (bloqueados.length) {
        setRecado(
          `Lote recusado — ${bloqueados.length} linha(s) não podem entrar em decisão em massa: ` +
            bloqueados
              .slice(0, 6)
              .map((x) => `${x.r.nome} ${x.r.dataBR} (${x.motivo})`)
              .join(" · ") +
            (bloqueados.length > 6 ? " …" : "") +
            ". Desmarque essas linhas ou abra cada caso.",
        );
        return;
      }
      const verbo = acao === "aceitar" ? "ACEITAR" : "REJEITAR (encerra, sem advertência)";
      if (
        !confirmar(
          `${verbo} ${alvo.length} dia(s):\n\n` +
            alvo
              .slice(0, 12)
              .map((r) => `· ${r.nome} ${r.dataBR}`)
              .join("\n") +
            (alvo.length > 12 ? `\n… e mais ${alvo.length - 12}` : "") +
            `\n\n${
              acao === "aceitar"
                ? "Grava aceite=aceito em cada caso."
                : 'Grava aceite=rejeitado + correcao_status="dispensada" — nenhum destes dias tem aviso, então nenhum vira advertência.'
            }\nNÃO roda o bot.`,
        )
      )
        return;
      executarGravacao(`${alvo.length} caso(s) gravado(s)`, async () => {
        const avisos = [];
        for (const reg of alvo) {
          // um a um: o upsert em lote esconderia qual linha falhou
          const a = acao === "aceitar" ? await gravarAceite(reg) : await gravarRecusa(reg, "rejeitar");
          if (a) avisos.push(a);
        }
        return avisos.join(" · ");
      });
    },
    [linhas, selIds, executarGravacao],
  );

  /* ── colunas de cada grade (formato do TabelaDP: id/titulo/valor/render) ── */

  const acoesDecisao = {
    gravando,
    aoAceitar,
    aoRejeitar,
    aoDesfazer,
    aoAbrir: abrir,
  };

  const colColaborador = {
    id: "nome",
    titulo: "Colaborador",
    largura: 190,
    valor: (r) => r.nome,
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
    id: "dia",
    titulo: "Dia",
    largura: 90,
    classe: "dp-num",
    valor: (r) => r.dataBR,
  };
  const colChapa = {
    id: "cracha",
    titulo: "Chapa",
    largura: 100,
    classe: "dp-num dp-mono",
    valor: (r) => r.cracha,
  };
  const colAjustes = {
    id: "aj",
    titulo: "Ajustes",
    largura: 110,
    ordenavel: true,
    valor: (r) => r.nAjustes,
    render: (r) => <CelulaAjustes reg={r} aoAbrir={() => abrir(r)} />,
  };
  const colPontas = {
    id: "pontas",
    titulo: "Veredito E/S",
    largura: 190,
    valor: (r) => r.diaStatus || r.veredito || "",
    render: (r) => <PontasES reg={r} />,
  };
  const colSituacao = {
    id: "sit",
    titulo: "Situação",
    largura: 170,
    valor: (r) => SIT[r.situacao]?.rotulo || r.situacao,
    render: (r) => <CelulaSituacao reg={r} />,
  };

  // app.js:183 (COLS_CONF) — Pedidos: quem · dia · veredito por ponta · decisão · ajustes.
  const COLS_PEDIDO = [
    colColaborador,
    colDia,
    colPontas,
    {
      id: "dec",
      titulo: "Decisão",
      largura: 230,
      ordenavel: false,
      valor: (r) => (r.decJa ? (r.decJa.aceito ? "aceito" : "recusado") : "a decidir"),
      render: (r) => <CelulaDecisao reg={r} {...acoesDecisao} />,
    },
    colAjustes,
  ];

  // app.js:2647 (COLS_ENV) — Meus avisos.
  const COLS_AVISO = [
    colColaborador,
    colChapa,
    { id: "data", titulo: "Data", largura: 90, classe: "dp-num", valor: (r) => r.dataBR },
    { id: "oq", titulo: "O que", largura: 160, valor: (r) => r.tipoLabel, render: (r) => <Selo>{r.tipoLabel}</Selo> },
    {
      id: "atual",
      titulo: "Ponto atual",
      largura: 150,
      valor: (r) => textoBatidas(r.antes),
      render: (r) => <Cartao batidas={r.antes} />,
    },
    {
      id: "alvo",
      titulo: "Pedimos (alvo)",
      largura: 140,
      valor: (r) => `${r.alvo[0] || ""} ${r.alvo[1] || ""}`.trim(),
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
    {
      id: "prazo",
      titulo: "Prazo (48h)",
      largura: 140,
      valor: (r) => (r.restam == null ? "" : Math.round(r.restam)),
      render: (r) => <CelulaPrazo reg={r} />,
    },
    {
      id: "acao",
      titulo: "Ação",
      largura: 240,
      ordenavel: false,
      valor: (r) => r.situacaoAviso,
      render: (r) =>
        r.situacaoAviso === "vencido" ? (
          <div style={PILHA}>
            <BotaoExecucao tom="erro">⚠ Vencido — advertir e corrigir (robô)</BotaoExecucao>
            <span style={{ ...MINI, color: "var(--dp-danger-ink)" }}>
              não entra em lote — só a cadeia advertência → correção
            </span>
          </div>
        ) : (
          <CelulaDecisao reg={r} {...acoesDecisao} />
        ),
    },
  ];

  const COLS_COMENT = [
    colColaborador,
    colChapa,
    { id: "data", titulo: "Data", largura: 90, classe: "dp-num", valor: (r) => r.dataBR },
    { id: "oq", titulo: "O que", largura: 180, valor: (r) => r.tipoLabel, render: (r) => <Selo>{r.tipoLabel}</Selo> },
    {
      id: "atual",
      titulo: "Ponto atual",
      largura: 150,
      valor: (r) => textoBatidas(r.antes),
      render: (r) => <Cartao batidas={r.antes} />,
    },
    {
      id: "quando",
      titulo: "Enviado em",
      largura: 140,
      classe: "dp-num",
      valor: (r) => txt(r.caso.aviso_enviado_em),
      render: (r) => <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_enviado_em)}</span>,
    },
  ];

  const colQuando = {
    id: "quando",
    titulo: "Quando",
    largura: 140,
    classe: "dp-num",
    valor: (r) =>
      txt(
        r.caso.correcao_final_em ||
          r.caso.advertencia_enviada_em ||
          r.caso.conferido_em ||
          r.caso.aceito_em ||
          r.caso.atualizado_em,
      ),
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
  };

  const COLS_LISTA = [colColaborador, colDia, colSituacao, colPontas, colQuando, colAjustes];

  // Execução pendente: é aqui que mora o DESFAZER (o bot ainda não executou).
  const COLS_EXEC = [
    colColaborador,
    colDia,
    colSituacao,
    colPontas,
    colQuando,
    {
      id: "dec",
      titulo: "Decisão",
      largura: 240,
      ordenavel: false,
      valor: (r) => (r.decJa ? (r.decJa.aceito ? "aceito" : "recusado") : ""),
      render: (r) => <CelulaDecisao reg={r} {...acoesDecisao} />,
    },
  ];

  const COLS_CANCEL = [
    colColaborador,
    colDia,
    { id: "oq", titulo: "O que", largura: 180, valor: (r) => r.tipoLabel, render: (r) => <Selo>{r.tipoLabel}</Selo> },
    {
      id: "quando",
      titulo: "Cancelado em",
      largura: 150,
      classe: "dp-num",
      valor: (r) => txt(r.caso.aviso_cancelado_em),
      render: (r) => <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_cancelado_em)}</span>,
    },
    {
      id: "acao",
      titulo: "Ação",
      largura: 220,
      ordenavel: false,
      valor: () => "",
      render: () => <BotaoExecucao>🗑 Cancelar no Transnet (robô)</BotaoExecucao>,
    },
  ];

  // Uma CHAVE por grade: as colunas mudam por porta/aba, e a preferência de
  // coluna é por tela (app_config `tbl_p5_conf`, `tbl_p5_env`…).
  const GRADE = {
    conf: { chave: "p5_conf", colunas: COLS_PEDIDO, selecionavel: true },
    aguard: { chave: "p5_env", colunas: COLS_AVISO, selecionavel: true },
    coment: { chave: "p5_com", colunas: COLS_COMENT, selecionavel: false },
    cancel: { chave: "p5_cancel", colunas: COLS_CANCEL, selecionavel: false },
    exec: { chave: "p5_exec", colunas: COLS_EXEC, selecionavel: false },
  };
  const grade = GRADE[abaAtiva] || { chave: "p5_lista", colunas: COLS_LISTA, selecionavel: false };

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

  const barraLote = grade.selecionavel ? (
    <div style={{ ...FILA, gap: 8 }}>
      <span className="dp-muted dp-num" style={MINI}>
        {selIds.length ? `${selIds.length} marcada(s)` : "marque linhas para decidir em lote"}
      </span>
      <BotaoAcao
        tom="ok"
        titulo="Aceita cada dia marcado (grava aceite=aceito). Dia misto, aviso vencido e dia sem simulação confiável são recusados pelo lote."
        disabled={!selIds.length || gravando}
        onClick={() => emLote("aceitar")}
      >
        ✓ Aceitar marcados
      </BotaoAcao>
      <BotaoAcao
        tom="erro"
        titulo="Só entra no lote o dia SEM aviso registrado: a recusa encerra (dispensada) e nunca vira advertência. Dia com aviso tem de ser aberto."
        disabled={!selIds.length || gravando}
        onClick={() => emLote("rejeitar")}
      >
        ✗ Rejeitar marcados (sem aviso)
      </BotaoAcao>
    </div>
  ) : null;

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
          {registros[0]?.realocados ? (
            <span
              className="dp-faint dp-num"
              title="A batida que o pedido aponta não estava no cartão do dia declarado e estava no do outro dia de referência (motor: realocaDia)."
            >
              · {registros[0].realocados} pedido(s) realocado(s) de dia
            </span>
          ) : null}
          <span style={{ flex: 1 }} />
          <span className="dp-faint dp-num">lido em {fmtDataHora(base?.lidoEm)}</span>
          <button type="button" className="dp-btn" onClick={carregar} disabled={gravando}>
            ↻ Recarregar
          </button>
          <Selo cor={gravando ? "alerta" : "accent"} titulo={AVISO_EXEC}>
            {gravando ? "gravando…" : "grava decisão · não executa"}
          </Selo>
        </>
      }
      resumo={
        /* A regra que manda na tela — sempre visível, no topo (PORTE.md §5). */
        <>
          <Selo cor="erro" quebra>
            Recusar não é advertir — advertência só existe depois de aviso registrado.
          </Selo>{" "}
          <strong>O que esta tela GRAVA</strong> (em <span className="dp-mono">ponto_caso</span>, e o
          contrato antes/depois em <span className="dp-mono">ponto_ajustes_app</span>): aceite,
          recusa, marcação por ocorrência e desfazer.{" "}
          <strong>O que ela NÃO faz:</strong> rodar o robô, advertir, corrigir ou cancelar a
          ocorrência no Transnet — decidir e executar são dois passos. Recusa sem aviso encerra o
          caso (<span className="dp-mono">dispensada</span>) e nunca vira advertência. Entrada e
          saída são julgadas separadamente: uma nunca anula a outra; dia misto e aviso vencido não
          entram em decisão em lote. Veredito, régua e simulação vêm do motor validado
          (<span className="dp-mono">regrasPonto.js</span>) — tolerância {TOLERANCIA_MIN} min ·
          prazo do colaborador {PRAZO_HORAS} h.
          {recado ? (
            <>
              {" "}
              <Selo cor={recado.startsWith("Falhou") ? "erro" : "ok"} quebra>
                {recado}
              </Selo>
            </>
          ) : null}
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
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 650 }}>{p.label}</span>
                {cont.porta[p.id] ? (
                  <span className="dp-pill danger n">{cont.porta[p.id]}</span>
                ) : null}
              </div>
              <p
                className={ativa ? "" : "dp-muted"}
                style={{ ...MINI, margin: "5px 0 0", lineHeight: 1.4 }}
              >
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
                setSelIds([]);
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

      <TabelaDP
        key={`${grade.chave}-${versao}`}
        chave={grade.chave}
        colunas={grade.colunas}
        linhas={linhas}
        classeLinha={(l) => classeDaLinha(l, porta)}
        aoClicarLinha={(l) => abrir(l)}
        idLinha={(l) => l.k}
        selecionavel={grade.selecionavel}
        aoSelecionar={(ids) => setSelIds(ids)}
        acoes={barraLote}
        nomeCsv={`dp360_ocorrencias_${porta}_${abaAtiva}`}
        vazio={VAZIOS[abaAtiva] || "Nada por aqui."}
        pinPadrao={2}
      />

      <Detalhe
        reg={regAberto}
        aoFechar={() => setAberto(null)}
        gravando={gravando}
        aoAceitar={aoAceitar}
        aoRejeitar={aoRejeitar}
        aoDesfazer={aoDesfazer}
        aoMarcar={aoMarcar}
      />
    </AbaShell>
  );
}

/* ============================================================================
 * O QUE CONTINUA FORA DESTA TELA (de propósito)
 *
 * · EXECUÇÃO. Aceitar/rejeitar aqui NÃO aceita nem rejeita no Transnet: quem faz
 *   isso é o robô, e o disparo (Edge Function `dispatch-bot`) exige escopo
 *   explícito [{cracha, date_ref}]. Um clique sem escopo já processou 34 casos
 *   indevidos. O robô é quem grava advertencia_enviada_em / correcao_final_em.
 * · ADVERTIR e CORRIGIR. A decisão gravada aqui (recusa com aviso, correcao_status
 *   vazio) apenas MANTÉM o caso na fila da cadeia; nada é enviado a ninguém.
 * · CANCELAR AVISO (aviso_cancelado_em) e cancelar a ocorrência no Transnet:
 *   dependem do robô (sincronizar_cancelamentos_ocorrencias).
 * · ALVO MANUAL da correção (confirmar_errados(alvo=…) → ponto_ajustes_app
 *   .alvo_etapa2): é a régua de interno, e exige um campo de digitação com
 *   validação própria. Enquanto não existir, a recusa vai sem alvo — que é o
 *   mesmo comportamento do Python quando o operador não digita nada.
 * · ALVO CONGELADO (alvo_entrada/alvo_saida) e ponto_antes/ponto_depois já
 *   gravados: NUNCA são reescritos por esta tela.
 * ========================================================================== */
