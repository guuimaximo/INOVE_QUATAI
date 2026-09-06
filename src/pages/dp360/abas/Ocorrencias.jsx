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
// ⚠ ESCOPO DESTA FASE — DECIDE, E EXECUTA SÓ O QUE JÁ FOI DECIDIDO.
// Aceitar / rejeitar / marcar por ocorrência / desfazer GRAVAM em `ponto_caso`
// (e o contrato antes/depois em `ponto_ajustes_app`). DEPOIS de gravado, o caso
// pode ser mandado ao robô — e só então alguma coisa muda no Transnet.
//
// DECIDIR ≠ EXECUTAR continua valendo, e agora é a trava do disparo: o botão do
// robô não decide nada. Ele só empurra para o Transnet uma decisão que JÁ está
// gravada (`aceite` ∈ aceito/rejeitado e `conferido_em` vazio) — exatamente o
// mesmo filtro que o bot aplica lá dentro (bot_ajustes_app.executar_decisoes).
// Caso sem decisão gravada não tem botão de robô.
//
// O ESCOPO VIAJA SEMPRE. O workflow `ajustes.yml` roda a FILA INTEIRA quando o
// input `casos` chega vazio ou "[]" (main.py `_nuvem_traduz`: "sem ele, um clique
// em quatro casos conferia a fila inteira"). Aqui o escopo é sempre UM crachá+dia
// — o do caso aberto — e o disparo é recusado se ele não puder ser montado. Foi
// um clique sem escopo que processou 34 casos indevidos em 24/08.
//
// O QUE CONTINUA FORA (e por quê, em MOTIVO_ADVERTIR / MOTIVO_CANCELAR): a carta
// de advertência é o robô `comunicado`, a correção do cartão é o robô `ponto`, e
// cancelar a ocorrência enviada é um modo que `ajustes.yml` nem expõe.
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
import { dispararRoboDP360, lerDP360, lerTudoDP360, upsertDP360 } from "../../../services/dp360Api";
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

/* ─────────────────────── o que o robô faz e o que não faz ──────────────────
 * O robô que esta tela dispara é UM só: `ajustes` (workflow ajustes.yml →
 * bot/bot_ajustes_app.py), e ele tem exatamente TRÊS modos, nem um a mais —
 * dp360-api ROBOS.ajustes recusa qualquer outro valor:
 *   "conferir (so leitura)" · "capturar a grade" · "executar decisoes"
 *
 * OS TRÊS EXISTEM NO CAMINHO DA NUVEM, e os três estão ligados aqui. (Um
 * comentário anterior deste arquivo dizia que conferir e capturar "não existem
 * no caminho da nuvem" — está ERRADO e foi corrigido: `main.py:970-978`
 * (`_nuvem_traduz`) traduz `--conferir` e `--capturar` para o mesmo workflow, e
 * `ajustes.yml:16-19` expõe os três no `workflow_dispatch`.)
 *
 * O que continua fora do caminho da nuvem é outra coisa, e por outro motivo:
 * `--cancelar-enviadas`, `--listar-enviadas` e `--ao-vivo`, que `_nuvem_traduz`
 * deixa locais de propósito (devolve None e o trabalho roda na máquina), e os
 * robôs `comunicado` (advertência) e `ponto` (correção do cartão), que não são
 * o robô `ajustes`.
 * ───────────────────────────────────────────────────────────────────────── */

// dp360-api ROBOS.ajustes.inputs.modo — strings EXATAS, nunca montadas por
// concatenação: o gateway compara com a lista e devolve 400 em qualquer variação.
const MODO_EXECUTAR = "executar decisoes";
const MODO_CONFERIR = "conferir (so leitura)";
const MODO_CAPTURAR = "capturar a grade";

// O que o disparo desta tela faz, em uma frase (rodapé e selo do cabeçalho).
const AVISO_EXEC =
  "O robô executa só o que JÁ FOI DECIDIDO e gravado, um crachá+dia por vez; confere ao vivo " +
  "(só leitura) o que já foi executado; e captura a grade do Transnet para a base. " +
  "Advertência, correção do cartão e cancelamento continuam fora desta tela.";

// ── O QUE A CONFERÊNCIA É, E POR QUE ELA IMPORTA ──────────────────────────
// main.py:2204 (conferir_transnet) → bot_ajustes_app.py:622 (conferir_pendentes).
// Ela LÊ o cartão ao vivo e NÃO MUDA NADA NO TRANSNET — nem com `confirmar`.
// Com `confirmar` ela fecha no NOSSO banco o que bateu com o combinado:
// `bot_ajustes_app.py:718-728` grava conferido_em, aviso_conferido_em e o veredito;
// `:739-752` grava correcao_status='ponto_fechado' quando o Transnet não aceita o dia.
// É o CAMINHO DE VOLTA do resultado — sem ela o caso fica preso em "Execução
// pendente" para sempre, porque quem carimba `conferido_em` é o bot, não a tela.
// A razão de existir, na frase do original: "EFETUADO na grade não prova que os
// horários foram alterados no cartão" (PEDRO 30060491, 06/08).
const AVISO_CONFERIR =
  "Lê o cartão ao vivo e compara com o contrato. NÃO muda nada no Transnet — nem no ensaio, " +
  "nem valendo. Valendo, fecha só no NOSSO banco (conferido_em) o que bateu.";

// ── O QUE A CAPTURA É, E O BURACO QUE ELA TEM AQUI ────────────────────────
// main.py:1540 (capturar_ocorrencias) → bot_ajustes_app.py:810 (capturar).
// Varre a grade do Transnet e grava as ocorrências no Supabase (:543 e :827).
// SEM ESCOPO de propósito: a grade inteira é o objeto, não um crachá+dia.
//
// O QUE NÃO DÁ PARA PORTAR — e por isso está escrito na tela, não só aqui:
// o original tem um PÓS-PROCESSO na máquina (main.py:1550 `_pos_captura`) que
//   (a) carimba `app_config.ultima_captura` (main.py:1565) e
//   (b) roda `congelar_antes()` (main.py:8923), que tira a foto antes/depois/
//       veredito ANTES de qualquer aceite.
// Os dois rodam DEPOIS que o run termina, na máquina que disparou. O INOVE
// dispara e não espera o run (não lê resultado de run nenhum — é a mesma razão
// pela qual advertir/corrigir continuam fora). Então:
//   · esta tela NÃO carimba `ultima_captura` no disparo — seria mentira, a
//     captura ainda nem começou quando o botão volta;
//   · ela LÊ `app_config.ultima_captura` e mostra, para o DP saber o quanto a
//     grade está velha (e o carimbo só se move quando alguém roda a ferramenta
//     desktop — está dito na tela);
//   · o CONGELAMENTO DA PROVA não acontece por este caminho. No INOVE a prova é
//     congelada em `gravaContrato`, na hora da DECISÃO — que é depois, e só para
//     o que o DP decidiu. Consequência real: a ocorrência que chega pela nuvem
//     entra sem antes/depois congelado, e o "antes" que vier a ser congelado é o
//     cartão de quando se decidiu, não o de quando se capturou.
const AVISO_CAPTURA =
  "Varre a grade inteira do Transnet e grava as ocorrências novas na base (sem escopo — não é " +
  "por crachá+dia). NÃO carimba a última captura e NÃO congela a prova: o congelamento do " +
  "original roda na máquina depois do run, e aqui a prova só é congelada na hora da decisão.";

// ── POR QUE "Advertir e corrigir" CONTINUA DESLIGADO ──────────────────────
// No DP360 esse botão é uma CORRENTE DE TRÊS ELOS (app.js:1719 rejeitarCompleto):
//   1) recusar no Transnet   → robô `ajustes`  (este é o elo que ligou aqui)
//   2) enviar a advertência  → robô `comunicado`, motivo "103 (ADVERTENCIA)"
//   3) corrigir o cartão     → robô `ponto`, com o alvo da correção
// Os elos 2 e 3 não são o robô `ajustes`, e nenhum dos dois carimba sozinho:
// `advertencia_enviada_em` e `correcao_final_em` são gravados por QUEM LÊ O
// RESULTADO do run (main.py:8283 e 8332) — e esta tela não lê run nenhum. Ligar
// o botão hoje mandaria carta na ficha de alguém sem registrar que ela saiu, e
// tentaria corrigir o cartão sem o alvo (que esta tela ainda não digita).
const MOTIVO_ADVERTIR =
  "Ainda não: advertir é o robô `comunicado` (motivo 103) e corrigir o cartão é o robô `ponto` — " +
  "nenhum dos dois é o robô `ajustes`, e quem carimba advertencia_enviada_em/correcao_final_em é " +
  "quem lê o resultado do run, coisa que esta tela não faz. Sairia carta sem registro e correção sem alvo.";

// ── POR QUE "Cancelar no Transnet" CONTINUA DESLIGADO ─────────────────────
// Cancelar a ocorrência que NÓS enviamos é `bot_ajustes_app.py --cancelar-enviadas`
// (precedido de `--listar-enviadas`). main.py `_nuvem_traduz` traduz para a nuvem
// só --conferir / --capturar / --executar; os outros modos ficam locais de
// propósito. O workflow ajustes.yml não tem opção para isso, então não existe
// caminho de nuvem — e forçar um modo fora da lista o gateway recusa (403).
const MOTIVO_CANCELAR =
  "Ainda não: cancelar a ocorrência enviada é `--cancelar-enviadas`, que o workflow ajustes.yml não expõe " +
  "(só conferir, capturar e executar). Não há caminho de nuvem para isso hoje — continua no robô local.";

// ── POR QUE O "VENCIDO" CONTINUA DESLIGADO ────────────────────────────────
// Duas razões independentes, e cada uma sozinha já bastaria:
//  · o vencido NÃO TEM DECISÃO GRAVADA (ele não mexeu no ponto — não há pedido
//    para aceitar nem recusar), e o robô `ajustes` só age sobre `aceite` gravado:
//    não haveria o que executar mesmo que o botão existisse;
//  · a saída dele é advertência → correção, que são os robôs `comunicado` e
//    `ponto` (main.py:2932 advertir_vencida / 3060 corrigir_vencida).
const MOTIVO_VENCIDO =
  "Ainda não: o vencido não tem decisão gravada para o robô `ajustes` executar (ele não mexeu no ponto), " +
  "e a saída dele é advertência → correção — robôs `comunicado` e `ponto`, que esta tela ainda não dispara.";

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

/**
 * Lê uma tabela do lake SÓ NOS PARES (crachá, dia) que estão em cena.
 *
 * POR QUE POR DIA, E NÃO POR BLOCO DE CRACHÁS (medido na base, janela de 70 dias):
 * eram 345 crachás × 159 datas = ~55 mil linhas por tabela para os ~6 mil pares que
 * interessam — nove vezes mais dado do que o necessário, em QUATRO tabelas, e a aba
 * ficava dezenas de segundos em "carregando". O produto cartesiano é o problema:
 * `cracha in (…) AND data in (…)` traz o cruzamento inteiro, não os pares.
 *
 * (São 159 datas e não 70 porque o filtro dos pedidos é por `capturado_em`: um
 * pedido capturado esta semana pode falar de um dia bem mais antigo. Isso está
 * certo e não se mexe.)
 *
 * Agrupando POR DIA, cada requisição leva só os crachás que têm pedido NAQUELE dia:
 * algumas dezenas de linhas — UMA página, sempre (o paginador para na primeira, que
 * já vem com menos que o limite).
 *
 * A CONTA, sem enfeitar: antes eram ~240 requisições de mil linhas (~55 mil linhas
 * por tabela); agora são ~159 por tabela, ~636 no total, de algumas dezenas de
 * linhas (~6 mil por tabela). O volume cai 9×; o número de chamadas SOBE ~2,5×. Vale
 * porque o que estava doendo era o volume, mas é por isso que o teto de chamadas
 * simultâneas existe e é compartilhado — e é o primeiro número a mexer se ainda
 * estiver lento. O passo seguinte, se precisar, é o gateway aceitar par exato
 * (`or=(and(cracha.eq,data.eq),…)`), que hoje ele não expõe.
 *
 * `pares` = Map "cra8|dia" → { crachas: Set(variantes cru e cra8), iso }. As DUAS
 * variantes do crachá viajam porque a chave da montagem casa por `cra8`, mas a
 * linha do lake pode estar gravada com o crachá cru — perder isso faz a conferência
 * perder par em silêncio.
 */
// O TETO DE CHAMADAS SIMULTÂNEAS é do CONJUNTO das quatro tabelas, não de cada uma:
// a Edge Function `dp360-api` é a mesma de todas as telas do DP360, e quatro pools de
// 6 seriam 24 chamadas em voo — trocar o problema de lugar.
const LIMITE_CHAMADAS = 8;

// As quatro tabelas do lake que a conferência precisa, com a coluna de data de cada
// uma (o lake não padronizou: umas são `date_ref`, outras `data_ref`). Crachá é
// `cracha` nas quatro.
const TABELAS_LAKE = [
  { chave: "diario", tabela: "ponto_diario", colData: "date_ref", colunas: COLS_DIARIO },
  { chave: "gordura", tabela: "ponto_gordura", colData: "data_ref", colunas: COLS_GORDURA },
  { chave: "intervalo", tabela: "ponto_intervalo", colData: "data_ref", colunas: COLS_INTERVALO },
  // sem recorte de colunas: o real manual é a régua do DP e a tela usa a linha inteira
  { chave: "realManual", tabela: "ponto_real_manual", colData: "date_ref", colunas: undefined },
];

// Roda `tarefa` sobre `itens` com no máximo `limite` em voo ao mesmo tempo.
async function emPool(itens, limite, tarefa) {
  const fila = [...itens];
  const trabalhador = async () => {
    for (;;) {
      const item = fila.shift();
      if (item === undefined) return;
      await tarefa(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, fila.length) }, trabalhador));
}

async function lerLakePorPares(pares, aoAvancar) {
  // um dia → os crachás que têm pedido NAQUELE dia (as duas variantes)
  const porDia = new Map();
  pares.forEach(({ crachas, iso }) => {
    if (!iso || !crachas.size) return;
    if (!porDia.has(iso)) porDia.set(iso, new Set());
    const alvo = porDia.get(iso);
    crachas.forEach((c) => alvo.add(c));
  });

  const vazio = { diario: [], gordura: [], intervalo: [], realManual: [] };
  if (!porDia.size) {
    aoAvancar?.(0, 0);
    return vazio;
  }

  // um único pool para as quatro tabelas × os dias em cena
  const trabalhos = [];
  porDia.forEach((crachas, iso) => {
    const lista = [...crachas].join(",");
    TABELAS_LAKE.forEach((t) => trabalhos.push({ t, iso, lista }));
  });

  // PROGRESSO HONESTO: o total de dias é sabido AQUI, antes de qualquer chamada — a
  // barra conta dia lido / dia em cena, não uma animação que finge avanço. Um dia só
  // conta como lido quando as QUATRO tabelas dele voltaram; contar leitura solta faria
  // a barra correr quatro vezes mais rápido do que o trabalho.
  const totalDias = porDia.size;
  const faltamNoDia = new Map([...porDia.keys()].map((iso) => [iso, TABELAS_LAKE.length]));
  let diasFeitos = 0;
  aoAvancar?.(0, totalDias);

  const out = { diario: [], gordura: [], intervalo: [], realManual: [] };
  await emPool(trabalhos, LIMITE_CHAMADAS, async ({ t, iso, lista }) => {
    try {
      const linhas = await lerTudoDP360(t.tabela, {
        colunas: t.colunas,
        ordem: "cracha.asc",
        filtros: { cracha: `in.(${lista})`, [t.colData]: `eq.${iso}` },
      });
      out[t.chave].push(...linhas);
    } finally {
      // o dia conta como lido mesmo se a leitura falhou: a barra mede o AVANÇO da
      // varredura, e o erro sobe pelo `emPool` para a tela mostrar do jeito de sempre
      const resta = (faltamNoDia.get(iso) ?? 1) - 1;
      faltamNoDia.set(iso, resta);
      if (resta === 0) {
        diasFeitos += 1;
        aoAvancar?.(diasFeitos, totalDias);
      }
    }
  });
  return out;
}

/**
 * `app_config.ultima_captura` — QUANDO A GRADE FOI CAPTURADA PELA ÚLTIMA VEZ.
 *
 * Quem carimba é `main.py:1565` (_marcar_captura), na MÁQUINA, depois que o run
 * termina. O disparo daqui não carimba (ver AVISO_CAPTURA), então este valor diz
 * "a última vez que alguém capturou pela ferramenta desktop" — e é exatamente por
 * isso que ele é útil: mostra o quanto a grade pode estar velha.
 *
 * Falhar aqui NÃO pode derrubar a tela: é um dado de contexto, não a conferência.
 */
async function lerUltimaCaptura() {
  try {
    const linhas = await lerDP360("app_config", {
      colunas: "chave,valor",
      filtros: { chave: "eq.ultima_captura" },
      limite: 1,
    });
    const bruto = linhas?.[0]?.valor;
    // a coluna é jsonb e o valor foi gravado como string — pode voltar com aspas
    return txt(typeof bruto === "string" ? bruto : bruto == null ? "" : JSON.stringify(bruto))
      .replace(/^"|"$/g, "");
  } catch {
    return "";
  }
}

async function carregarOcorrencias(aoAvancar) {
  const inicio = isoDiasAtras(JANELA_DIAS);

  const [casos, ajustesBrutos, ocorrencias, ultimaCaptura] = await Promise.all([
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
    lerUltimaCaptura(),
  ]);

  // ── PEDIDO VÁLIDO vs LIXO (obrigatório, supabase_client.ler_ajustes_app) ──
  // O lake guarda avisos, advertências e atestados na MESMA tabela, sem
  // `tipo_ajuste`. Essas linhas NÃO são pedido do colaborador — entram como lixo
  // na conferência e inflam a fila de decisão. Descarte é regra, não otimização.
  const pedidos = ajustesBrutos.filter((o) => txt(o.tipo_ajuste));
  const descartados = ajustesBrutos.length - pedidos.length;

  // PARES em cena = crachá × dia dos pedidos + dos casos. NÃO é "os crachás" ×
  // "as datas": é o par, e é essa diferença que faz a leitura do lake caber em ~6 mil
  // linhas em vez de ~55 mil (ver lerLakePorPares).
  //
  // O dia ALTERNATIVO do pedido entra como par próprio: sem o cartão do outro dia a
  // realocação do motor (realocaDia) não tem contra o que casar a batida.
  //
  // A chave do par é `cra8|dia` — a MESMA forma que a montagem usa. As duas variantes
  // do crachá (cru e cra8) ficam juntas no par porque a linha do lake pode estar
  // gravada de qualquer um dos dois jeitos; perder uma faz a conferência perder par
  // em silêncio.
  const pares = new Map();
  const anota = (cracha, data) => {
    const c = txt(cracha);
    const iso = normData(data);
    if (!c || !iso) return;
    const k = `${cra8(c)}|${iso}`;
    if (!pares.has(k)) pares.set(k, { crachas: new Set(), iso });
    const par = pares.get(k);
    par.crachas.add(c);
    par.crachas.add(cra8(c));
  };
  pedidos.forEach((o) => {
    anota(o.cracha, o.date_ref);
    anota(o.cracha, o.dt_referencia_ponto);
  });
  casos.forEach((c) => anota(c.cracha, c.date_ref));

  const { diario, gordura, intervalo, realManual } = await lerLakePorPares(pares, aoAvancar);

  // A ocorrência mais nova que ESTÁ na base. Diferente de `ultimaCaptura`: este
  // carimbo se move quando a captura roda pela nuvem (o bot grava `capturado_em` em
  // cada linha — bot_ajustes_app.py:1601), o outro só quando roda pela ferramenta.
  let capturaMaisNova = "";
  ajustesBrutos.forEach((o) => {
    const q = txt(o.capturado_em);
    if (q > capturaMaisNova) capturaMaisNova = q;
  });

  return {
    casos,
    pedidos,
    ocorrencias,
    diario,
    gordura,
    intervalo,
    realManual,
    descartados,
    ultimaCaptura,
    capturaMaisNova,
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

    // os quatro compartimentos do cartão (só a porta do aviso desenha assim)
    const slotsAntes = slotsDoCartao({ cp, caso, lim });
    const slotsAlvo = alvoQuatroSlots(caso);
    const almocoLancado = [caso.alvo_alm_saida, caso.alvo_alm_volta];

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
      // ── os quatro compartimentos (porta "Enviamos para ajuste") ─────────────
      // As HORAS saem do MESMO cartão limpo que o motor julga (`lim`) — duas fontes
      // para a mesma hora é como se cria divergência entre o que a tela mostra e o
      // que o veredito usou. Quem diz a POSIÇÃO de cada hora é `slotsDoCartao`.
      slotsAntes,
      slotsDepois: quatroSlots(sim, almocoLancado),
      slotsAlvo,
      // slot destacado = o alvo é diferente do que está no cartão hoje
      slotsAlvoMudou: slotsAlvo.map((v, i) => Boolean(v) && v !== slotsAntes[i]),
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

/**
 * app.js:2088 (`viewConfDecisao`) — O SELETOR DA ABA "A DECIDIR" TEM DOIS ESTADOS, E
 * ISSO É A REGRA, NÃO PREGUIÇA DE PORTE.
 *
 * Ele já teve CINCO, e quatro deles eram desfecho ("Já decidi", "Efetuado", "Recusado
 * no Transnet"): traziam de volta para a caixa de entrada linhas que já vivem na aba
 * do desfecho. Medido em 27/08: das 34 linhas da aba, 13 pediam decisão e 21 eram
 * recusas já executadas e carimbadas — as MESMAS 21 que estão em "Recusados". Ver
 * duas vezes o mesmo caso é o caminho para decidir duas vezes. Sobrou "Todos" como
 * saída de emergência, dizendo quantas estão no desfecho.
 *
 * NÃO RECRIE OS CINCO ESTADOS. O que o Transnet já efetuou ou recusou nunca aparece
 * aqui — nem por "Todos" (o `resolvidoNoTransnet` fica no filtro base, fora do eixo).
 */
const EIXOS_CONF = [
  ["PENDENTE", "Pendente — aguarda MINHA decisão"],
  ["TODOS", "Pendentes e decisões ainda não executadas"],
];

// O eixo do status, aplicado sobre as linhas que a aba já selecionou.
const porEixoStatus = (eixo) => (r) => (eixo === "TODOS" ? true : !r.decJa);

function linhasDaAba(registros, porta, aba) {
  const base = registros.filter(daPorta(porta));
  if (aba === "conf") {
    // app.js:2077 — a caixa de entrada da decisão do DP. O `!decJa` NÃO entra aqui:
    // ele é o eixo `EIXOS_CONF`, aplicado depois (com "Pendente" como padrão), senão
    // a opção "Todos" do original não teria o que mostrar.
    return base.filter(
      (r) =>
        ["conf_certo", "conf_errado", "conf", "recusado"].includes(r.situacao) &&
        !resolvidoNoTransnet(r),
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

/* ═════════════════ EXECUÇÃO — só o que JÁ FOI DECIDIDO E GRAVADO ══════════════
 * O botão do robô NÃO decide. Ele empurra para o Transnet uma decisão que já está
 * em `ponto_caso`, e nada mais. Quem quiser executar um caso sem decisão tem de
 * decidir primeiro, na mesma tela, com a confirmação que nomeia a pessoa.
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * A FILA DO BOT, que é a MESMA para executar e para conferir.
 *
 * `bot_ajustes_app.executar_decisoes` (:1203) e `conferir_pendentes` (:640) filtram
 * `ponto_caso` com a MESMA condição, palavra por palavra: `aceite` ∈ (aceito,
 * rejeitado) e `conferido_em` vazio. Por isso a trava é uma só — se a tela
 * oferecesse o que o bot descarta, o disparo gastaria um run para não fazer nada e
 * o DP acharia que o robô falhou.
 *
 * `qual` muda só o TEXTO do motivo, NUNCA o filtro: as três perguntas abaixo são as
 * mesmas nos dois modos.
 */
function motivoForaDaFilaDoBot(reg, qual) {
  if (!reg) return "sem caso";
  const bruto = reg.caso || {};
  const ciclo = reg.ciclo || {};
  // CICLO REABERTO: o `aceite` guardado é do ciclo VELHO e o bot lê a linha crua —
  // ele executaria a decisão anterior contra um pedido novo. E na conferência seria
  // pior ainda: `--confirmar` carimbaria `conferido_em` = agora, que passa a ser
  // MAIOR que `aviso_enviado_em`, e `_reaberto` (que compara os dois como texto)
  // deixaria de ver o ciclo novo — o pedido novo sumiria fechado sem ninguém julgar.
  if (reg.reaberto)
    return "ciclo reaberto — chegou aviso novo depois da decisão: decida de novo antes de mandar o robô";
  if (!["aceito", "rejeitado"].includes(txt(ciclo.aceite)))
    return qual === "conferir"
      ? "nenhuma decisão gravada — o bot só confere o que foi decidido: aceite ou recuse primeiro"
      : "nenhuma decisão gravada — decidir e executar são dois passos: aceite ou recuse primeiro";
  if (txt(bruto.conferido_em))
    return qual === "conferir"
      ? "este dia já foi conferido e fechado (conferido_em) — o bot só olha o que continua aberto"
      : "o robô já executou este dia no Transnet — não se repete";
  return "";
}

// Por que ESTE dia não pode ir para o robô EXECUTAR.
function motivoSemExecucao(reg) {
  const base = motivoForaDaFilaDoBot(reg, "executar");
  if (base) return base;
  const bruto = reg.caso || {};
  // main.py/bot: dia já provado FECHADO no Transnet só gera escrita recusada
  // (o ALLAN 30060284 levou nove antes de alguém perceber).
  if (txt(bruto.correcao_status) === "ponto_fechado")
    return "competência fechada no Transnet — o robô não consegue lançar este dia";
  const p = planoDaExecucao(reg);
  if (!p.aceitar.length && !p.rejeitar.length && !p.jaResolvidos.length)
    return "nenhuma ocorrência do Transnet ligada a este dia — o robô não teria o que clicar";
  return "";
}

/**
 * Por que ESTE dia não pode ir para o robô CONFERIR.
 *
 * A conferência NÃO clica em ocorrência nenhuma — ela abre o CARTÃO do dia e
 * compara com o contrato congelado. Por isso não tem a última trava da execução
 * ("nenhuma ocorrência ligada a este dia"): não existe clique para faltar.
 *
 * O que ela ganha por cima é o dia FECHADO: num dia de competência encerrada o
 * cartão nunca vai bater com o contrato, o bot já não rebaixa mais o caso
 * (bot_ajustes_app.py:748) e conferir de novo só gasta run. Foi esse laço que levou
 * o ALLAN 30060284 a NOVE escritas recusadas.
 */
function motivoSemConferencia(reg) {
  const base = motivoForaDaFilaDoBot(reg, "conferir");
  if (base) return base;
  if (txt(reg.caso?.correcao_status) === "ponto_fechado")
    return "dia já provado FECHADO no Transnet — a leitura nunca vai bater e o bot não rebaixa mais o caso";
  return "";
}

/**
 * O que o robô vai clicar, contado ANTES do disparo (espelho de
 * bot_ajustes_app.executar_decisoes e de main.py:contar_execucao).
 *
 * O QUE A DECISÃO CONGELOU MANDA: `ajuste_ids` com prefixo A:/R: aponta as
 * ocorrências exatas que o DP viu — é o que permite o dia MISTO (aceitou umas,
 * recusou outras). Sem prefixo, o `aceite` do caso vale para todas as ocorrências
 * do dia. O que o Transnet já resolveu (EFETUADO/RECUSADO) saiu da grade: não é
 * clique, é só conferência.
 */
function planoDaExecucao(reg) {
  const ciclo = reg?.ciclo || {};
  const padrao = txt(ciclo.aceite) === "aceito" ? "aceitar" : "rejeitar";
  const porId = new Map();
  txt(ciclo.ajuste_ids)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((b) => {
      if (b.slice(0, 2) === "A:") porId.set(b.slice(2), "aceitar");
      else if (b.slice(0, 2) === "R:") porId.set(b.slice(2), "rejeitar");
      else porId.set(b, padrao);
    });
  if (!porId.size) idsDoDia(reg).forEach((id) => porId.set(id, padrao));
  const resolvidos = new Set(
    (reg?.ajustes || [])
      .filter((o) => ["EFETUADO", "RECUSADO"].includes(txt(o.situacao_ajuste).toUpperCase()))
      .map((o) => txt(o.id_ocorrencia)),
  );
  const plano = { aceitar: [], rejeitar: [], jaResolvidos: [] };
  porId.forEach((acao, id) => {
    if (!id) return;
    if (resolvidos.has(id)) plano.jaResolvidos.push(id);
    else plano[acao].push(id);
  });
  return plano;
}

/**
 * O ESCOPO DO DISPARO — o input `casos` do workflow.
 *
 * `ajustes.yml` compara o input com "[]" e, se for vazio, roda `--executar` (ou
 * `--conferir`) SEM `--casos`: a FILA INTEIRA. Nos DOIS modos — as duas ramificações
 * do yml (:58-65 e :69-79) têm exatamente o mesmo `if`. Por isso esta função devolve
 * "" (e o disparo é recusado lá em cima) em vez de devolver "[]" quando não dá para
 * montar a chave: mandar escopo vazio não é "não filtrar", é rodar tudo.
 *
 * E se UMA das linhas não tiver chave, o escopo inteiro é recusado — não se manda a
 * lista "quase certa". Descartar em silêncio esconderia de quem clicou que uma das
 * pessoas marcadas não vai ser tocada.
 */
function casosDeRegistros(regs) {
  const lista = [];
  for (const reg of regs || []) {
    const { cracha, date_ref } = chaveDoCaso(reg);
    const c = txt(cracha);
    const d = normData(date_ref) || txt(date_ref).slice(0, 10);
    if (!c || !d) return "";
    lista.push({ cracha: c, date_ref: d });
  }
  if (!lista.length) return "";
  return JSON.stringify(lista);
}

// O escopo de UM caso — o da execução, que nunca é em lote.
const casosDoRegistro = (reg) => casosDeRegistros([reg]);

// O rótulo honesto do que o robô vai fazer com ESTA decisão — nunca promete a
// carta de advertência nem a correção do cartão, que são outros dois robôs.
function rotuloDaExecucao(reg) {
  const ciclo = reg?.ciclo || {};
  if (txt(ciclo.aceite) === "aceito") return "Aceitar no Transnet";
  const dispensada = txt(ciclo.correcao_status) === "dispensada";
  if (reg?.temAviso && !dispensada) return "Recusar no Transnet (abre advertência e correção)";
  return "Recusar no Transnet (encerra)";
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

// O passo de execução que AINDA NÃO EXISTE. `motivo` é obrigatório na prática: um
// botão morto sem motivo faz o DP achar que a tela quebrou e clicar dez vezes —
// aqui ele diz qual robô falta e por quê, na própria dica.
function BotaoExecucao({ children, tom = "neutro", motivo = AVISO_EXEC }) {
  const cor = { ok: "var(--dp-ok-ink)", erro: "var(--dp-danger-ink)" }[tom];
  return (
    <button type="button" disabled title={motivo} className="dp-btn" style={cor ? { color: cor } : undefined}>
      {children}
    </button>
  );
}

// Rodapé de execução do caso aberto: ENSAIO e VALENDO são botões SEPARADOS, como
// em Folgas. Um checkbox "confirmar" marcado por engano vira decisão de verdade na
// ficha de um trabalhador; dois botões obrigam a escolher, e cada confirmação diz
// qual dos dois é. O escopo (1 crachá+dia) fica escrito na cara, não implícito.
function RodapeRobo({ reg, disparando, aoExecutar, aoConferir, resultado }) {
  const trava = motivoSemExecucao(reg);
  const plano = trava ? null : planoDaExecucao(reg);
  const travaConf = motivoSemConferencia(reg);
  return (
    <div className="dp-det-bot">
      <div className="dp-det-bot-linha">
        <b>Execução no Transnet — robô `ajustes`, modo “{MODO_EXECUTAR}”</b>
        <span className="dp-faint">
          {" "}
          · escopo: só {reg.nome} · {reg.dataBR} (1 crachá+dia — o input `casos` nunca vai vazio,
          senão o workflow roda a fila inteira)
        </span>
      </div>
      {trava ? (
        <div className="dp-det-bot-linha">
          <Selo cor="alerta" quebra titulo="O robô só executa decisão já gravada — decidir e executar são dois passos.">
            robô indisponível para este caso: {trava}
          </Selo>
        </div>
      ) : (
        <>
          <div className="dp-det-bot-linha">
            O robô vai <b>{plano.aceitar.length}</b> aceitar e <b>{plano.rejeitar.length}</b> rejeitar
            no Transnet
            {plano.jaResolvidos.length ? (
              <span className="dp-faint">
                {" "}
                · {plano.jaResolvidos.length} já resolvida(s) lá (não clica, só confere)
              </span>
            ) : null}
            . Ele carimba <span className="dp-mono">conferido_em</span> em{" "}
            <span className="dp-mono">ponto_caso</span> — é esse carimbo que trava o dia.
          </div>
          <div className="dp-det-bot-acoes">
            <button
              type="button"
              className="dp-btn"
              disabled={disparando}
              onClick={() => aoExecutar(reg, false)}
              title="O robô navega, marca e NÃO clica — serve para conferir o lote antes de valer"
            >
              🤖 Ensaio
            </button>
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando}
              onClick={() => aoExecutar(reg, true)}
              title={`Vale de verdade no Transnet: ${rotuloDaExecucao(reg)}`}
            >
              ⚠ {rotuloDaExecucao(reg)} — de verdade
            </button>
          </div>
        </>
      )}
      {/* ── CONFERIR (SÓ LEITURA) — o CAMINHO DE VOLTA do resultado ─────────────
          Bloco separado do de cima porque é OUTRO ato: executar ESCREVE no Transnet,
          conferir só LÊ. E é este que fecha o ciclo — enquanto ninguém confere, o
          caso fica em "Execução pendente" para sempre, porque quem carimba
          `conferido_em` é o bot, nunca o navegador. */}
      <div
        className="dp-det-bot-linha"
        title={AVISO_CONFERIR}
        style={{ borderTop: "1px solid var(--dp-border)", paddingTop: 8, marginTop: 2 }}
      >
        <b>Conferir no Transnet — robô `ajustes`, modo “{MODO_CONFERIR}”</b>
        <span className="dp-faint">
          {" "}
          · escopo: só {reg.nome} · {reg.dataBR} (1 crachá+dia — `casos` nunca vai vazio, senão o
          workflow confere a fila inteira)
        </span>
      </div>
      {travaConf ? (
        <div className="dp-det-bot-linha">
          <Selo
            cor="alerta"
            quebra
            titulo="O bot confere a MESMA fila que executa: decisão gravada e conferido_em vazio."
          >
            conferência indisponível para este caso: {travaConf}
          </Selo>
        </div>
      ) : (
        <>
          <div className="dp-det-bot-linha">
            Abre o <b>cartão ao vivo</b> e compara com o contrato congelado.{" "}
            <b>Não muda nada no Transnet</b> — nem no ensaio, nem valendo. Valendo, fecha só no{" "}
            <b>nosso banco</b>: <span className="dp-mono">conferido_em</span>,{" "}
            <span className="dp-mono">aviso_conferido_em</span> e o veredito; e{" "}
            <span className="dp-mono">correcao_status='ponto_fechado'</span> quando o Transnet não
            aceita o dia.
          </div>
          <div className="dp-det-bot-acoes">
            <button
              type="button"
              className="dp-btn"
              disabled={disparando}
              onClick={() => aoConferir([reg], false, true)}
              title="Lê o cartão e mostra o resultado no run. Não grava nada — nem no Transnet, nem aqui."
            >
              🔍 Ensaio — só ler e mostrar
            </button>
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-ok-ink)" }}
              disabled={disparando}
              onClick={() => aoConferir([reg], true, true)}
              title="Lê o cartão e, no que bater com o combinado, carimba conferido_em no NOSSO banco. O Transnet continua intocado."
            >
              🔒 Conferir e fechar no nosso banco
            </button>
          </div>
          <div className="dp-det-bot-linha dp-faint">
            Por que existe: “EFETUADO na grade não prova que os horários foram alterados no cartão”
            (PEDRO 30060491, 06/08).
          </div>
        </>
      )}

      {/* SÓ NA PORTA DO AVISO. Advertir e cancelar o aviso pressupõem que existe aviso
          registrado neste crachá+dia; num pedido do colaborador nem desligados eles
          deveriam aparecer — botão morto ainda ensina que aquilo seria possível, e
          aqui não é: recusar não é advertir. */}
      {reg.temAviso ? (
        <div className="dp-det-bot-acoes">
          <BotaoExecucao tom="erro" motivo={MOTIVO_ADVERTIR}>
            Advertir e corrigir (robô)
          </BotaoExecucao>
          <BotaoExecucao motivo={MOTIVO_CANCELAR}>Cancelar aviso no Transnet</BotaoExecucao>
        </div>
      ) : null}
      {disparando ? <span className="dp-pill accent">disparando…</span> : null}
      {resultado ? (
        <div className="dp-det-bot-linha">
          <Selo cor={resultado.tipo === "ok" ? "ok" : "erro"} quebra>
            {resultado.texto}
          </Selo>
          {resultado.painel ? (
            <>
              {" "}
              <a className="dp-btn" href={resultado.painel} target="_blank" rel="noreferrer">
                ver o robô rodando
              </a>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
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

/* ─────────────────── o cartão em QUATRO COMPARTIMENTOS ─────────────────────
 * A MESMA apresentação da Gordura (abas/Gordura.jsx `LinhaCartao`, ~528), e de
 * propósito: entrada · saída almoço · volta almoço · saída, cada slot um `.dp-chip`
 * com a marca E/S, slot vazio como `.dp-chip.none`, slot que o alvo mudou com `.new`.
 * Não é uma terceira maneira de desenhar cartão — é a de lá, reusada.
 *
 * ONDE ELA VALE: na porta "Enviamos para ajuste". Ali o ajuste é RESPOSTA a um aviso
 * nosso, e o que interessa é o cartão INTEIRO — o que estava e o que fica —, não só a
 * ponta que o pedido tocou. Na porta "Pedido do colaborador" o `Cartao` continua como
 * está: lá o assunto é a ponta que ele mexeu.
 */
const SLOT_ES = ["E", "S", "E", "S"];

// "03:07" / "3:07" → "03:07"; qualquer outra coisa (vazio, "--") → "". É o `hora()`
// que app.js usa dentro de `cartoesAviso`, sem inventar formato.
function horaSlot(v) {
  const s = txt(v);
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/**
 * PORTE de app.js `cartoesAviso` (~2760) — os quatro slots do cartão ATUAL na porta
 * do aviso. Não é régua nova: é a que a ferramenta já usa nesta MESMA fila.
 *
 * POR QUE ISTO EXISTE (o caso real que provou o defeito): LUCIANO DA SILVA 30060552,
 * 28/08/2026. `ponto_diario.todas_batidas` = "E03:07 | S03:37"; o `ponto_caso`
 * congelou alvo_entrada 01:00 · alm 03:07–03:37 · alvo_saida 10:49, e o lake diz
 * `motivo=FALTA_ENTRADA_E_SAIDA`, `pede_entrada=true`, `pede_saida=true`,
 * `almoco_saida_sug=03:07`, `almoco_volta_sug=03:37`. Ou seja: ele NÃO bateu entrada
 * nem saída — bateu só o miolo do almoço que o DP já tinha lançado no cartão.
 * A regra antiga aqui ("duas batidas = pontas") desenhava `E 03:07 · — · — · S 03:37`
 * e a tela mostrava as MESMAS duas horas em posições diferentes nas duas colunas.
 * O lado errado era o do BATEU; o alvo congelado estava certo.
 *
 * A regra "duas batidas são as pontas" é da GORDURA (`cartoesGordura`), e lá ela vem
 * amarrada às marcas E/S do cartão. Copiá-la para cá sem a amarra foi o erro: nesta
 * porta a ferramenta usa OUTRA função, `cartoesAviso`, que sabe reconhecer o almoço
 * lançado. É ela que está portada abaixo, na mesma ordem.
 *
 * MEDIDO NA BASE antes de trocar (janela de 20/06 a hoje, 798 cartões da porta do
 * aviso): 84 mudam de desenho, e todos na direção do alvo congelado —
 *   · 6 são o almoço lançado que virava pontas (o caso acima);
 *   · 1 é `E10:45 S11:12 E11:15 S11:16` com alvo `04:18 · 11:12 · 11:15 · 13:39`:
 *     a regra antiga jogava 10:45/11:16 nas pontas e deixava o almoço VAZIO,
 *     enquanto o alvo diz que 11:12–11:15 é exatamente o almoço;
 *   · 75 são cartão de quatro marcas em que a regra antiga cortava a saída fora
 *     (`09:50 · 10:20 · 14:46 · —`) por pegar "os quatro primeiros" de uma lista já
 *     sem o fantasma — agora a saída é a ÚLTIMA S tipada, como no original;
 *   · 2 são cartão de oito marcas (o caso ANDRE do comentário abaixo).
 *
 * `lim` (o cartão limpo que o motor julga) é a fonte das HORAS nos dois caminhos que
 * não dependem da tipagem. A leitura tipada usa `todas_batidas` COMO ELA É — inclusive
 * a batida colada que o motor colapsa —, porque esta coluna se chama "Ponto (bateu)":
 * ela mostra o que a pessoa registrou, e é o veredito, não a coluna, que julga.
 */
function slotsDoCartao({ cp, caso, lim }) {
  const limpas = (lim || []).filter((t) => t != null).map(min2hm).filter(Boolean);
  const brutoQuatro = limpas.slice(0, 4);

  // 1) AS DUAS BATIDAS SÃO O ALMOÇO QUE O DP JÁ LANÇOU → elas NÃO são as pontas.
  //    Mostra vazio em entrada/saída, que é justamente o que o aviso está cobrando.
  //    Sem tolerância nenhuma nesta identificação: só o par IDÊNTICO ao congelado.
  const almoco = [horaSlot(caso?.alvo_alm_saida), horaSlot(caso?.alvo_alm_volta)];
  if (
    brutoQuatro.length === 2 &&
    almoco.every(Boolean) &&
    brutoQuatro[0] === almoco[0] &&
    brutoQuatro[1] === almoco[1]
  ) {
    return ["", brutoQuatro[0], brutoQuatro[1], ""];
  }

  // 2) LEITURA TIPADA: primeira E, primeiro intervalo S→E e a ÚLTIMA S. Cartão com
  //    inserção tem cinco ou mais marcas, e aí `ponto_diario.saida` (4ª posição) não
  //    é a saída do dia — o caso ANDRE 27/08 do original: E04:14 S11:27 E11:57 S14:45
  //    E14:47 S17:32, a grade dizia 14:45 e o Transnet dizia 17:32.
  const marcas = [...txt(cp?.todas_batidas).matchAll(/\b([ES])\s*(\d{1,2}:\d{2})/gi)]
    .map((m) => ({ tipo: m[1].toUpperCase(), hora: horaSlot(m[2]) }))
    .filter((m) => m.hora);
  const iEnt = marcas.findIndex((m) => m.tipo === "E");
  const iAlmSai = marcas.findIndex((m, i) => i > iEnt && m.tipo === "S");
  const iAlmVolta = marcas.findIndex((m, i) => i > iAlmSai && m.tipo === "E");
  const iSai = marcas.reduce((ultimo, m, i) => (i > iAlmVolta && m.tipo === "S" ? i : ultimo), -1);
  let tipado = [];
  if (iEnt >= 0 && iSai >= 0) {
    const temAlm = iAlmSai >= 0 && iAlmVolta >= 0;
    tipado = [
      marcas[iEnt].hora,
      temAlm ? marcas[iAlmSai].hora : "",
      temAlm ? marcas[iAlmVolta].hora : "",
      marcas[iSai].hora,
    ];
  }

  // 3) o cartão apurado pela ferramenta; e, em último caso, as horas na ordem crua.
  const apurado = [cp?.entrada, cp?.saida_almoco, cp?.volta_almoco, cp?.saida].map(horaSlot);
  if (tipado[0] && tipado[3]) return tipado;
  if (apurado[0] && apurado[3]) return apurado;
  return [0, 1, 2, 3].map((i) => brutoQuatro[i] || "");
}

// O cartão DEPOIS é SIMULAÇÃO (minutos do motor), não texto tipado: não há marca E/S
// para ler, então aqui vale a forma da Gordura — duas batidas são as pontas. A única
// exceção é a mesma do cartão de cima: se as duas horas são o almoço já lançado, elas
// não são as pontas (senão a coluna "depois" repetiria o defeito que acabou de sair).
function quatroSlots(minutos, almocoLancado) {
  const b = (minutos || []).filter((t) => t != null);
  if (!b.length) return ["", "", "", ""];
  const hm = b.map(min2hm);
  if (hm.length === 2) {
    const alm = [horaSlot(almocoLancado?.[0]), horaSlot(almocoLancado?.[1])];
    if (alm.every(Boolean) && hm[0] === alm[0] && hm[1] === alm[1]) return ["", hm[0], hm[1], ""];
    return [hm[0], "", "", hm[1]];
  }
  const quatro = hm.slice(0, 4);
  while (quatro.length < 4) quatro.push("");
  return quatro;
}

// Alvo do caso nos mesmos quatro slots. É o que PEDIMOS naquele crachá+dia — os
// campos congelados do `ponto_caso`, não um alvo recalculado agora.
const alvoQuatroSlots = (caso) =>
  [caso?.alvo_entrada, caso?.alvo_alm_saida, caso?.alvo_alm_volta, caso?.alvo_saida].map((v) =>
    txt(v),
  );

/**
 * OS QUATRO SLOTS SÃO UMA GRADE DE QUATRO COLUNAS, NÃO UMA FILA QUE QUEBRA.
 * Com `flex-wrap` (o que estava aqui) quatro chips de 5 caracteres não cabiam na
 * coluna: quebravam três em cima e um embaixo, e cada linha da tabela ficava com uma
 * altura diferente. Grade de `1fr` resolve as duas coisas de uma vez — nunca quebra
 * (grade não quebra) e o mesmo slot fica na MESMA posição horizontal em todas as
 * linhas, então a coluna "Ponto (bateu)" e a "Alvo" leem-se de cima a baixo.
 * A largura das duas colunas é fixa (`largura` do TabelaDP) e foi dimensionada para
 * a hora mais larga que existe aqui — cinco caracteres, notação 25:40 inclusive.
 */
function LinhaCartao({ horas, mudou }) {
  return (
    <span className="oc-slots">
      {(horas || ["", "", "", ""]).map((h, i) =>
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
            <Selo titulo={`Marcado em ${reg.decJa.quando}. Ainda não subiu: falta rodar o robô.`}>
              ✓ decidido · {reg.decJa.aceito ? "aceito" : "recusado"} — aguardando bot
            </Selo>
            <div style={FILA}>
              {/* O disparo mora no CASO ABERTO, nunca na grade: é lá que a pessoa, o dia e
                  o que o robô vai clicar aparecem por extenso antes de qualquer clique. */}
              <BotaoAcao
                titulo="Abre o caso: a execução no Transnet (ensaio ou valendo) fica no rodapé do detalhe, com o escopo de um crachá+dia."
                onClick={(e) => {
                  e.stopPropagation();
                  aoAbrir(reg);
                }}
              >
                🤖 Executar…
              </BotaoAcao>
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
            </div>
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
          titulo={trava || "Grava aceite=aceito no caso (não roda o robô — abra o caso para executar)"}
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

function Detalhe({
  reg,
  aoFechar,
  gravando: gravandoProp,
  aoAceitar,
  aoRejeitar,
  aoDesfazer,
  aoMarcar,
  disparando,
  aoExecutar,
  aoConferir,
  resultadoRobo,
}) {
  // ENQUANTO O DISPARO ESTÁ NO AR, A DECISÃO NÃO MUDA. O robô já levou a decisão que
  // estava gravada; trocá-la agora deixaria o banco e o Transnet contando histórias
  // diferentes sobre o mesmo dia da mesma pessoa.
  const gravando = gravandoProp || disparando;
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
            {/* Na porta do aviso o assunto é o DIA todo, então o alvo aparece nos
                quatro compartimentos, como na Gordura. Fora dela o alvo continua
                sendo lido por ponta — que é o que o pedido do colaborador toca. */}
            <Linha rotulo="Pedimos (alvo)">
              {reg.temAviso ? (
                <span style={PILHA}>
                  <LinhaCartao horas={reg.slotsAlvo} mudou={reg.slotsAlvoMudou} />
                  <span className="dp-faint" style={MINI}>
                    {reg.slotsAlvo.some(Boolean)
                      ? "entrada · saída almoço · volta almoço · saída (destacado = diferente do cartão de hoje)"
                      : "o aviso deste dia não congelou alvo nenhum no caso"}
                  </span>
                </span>
              ) : (
                <span className="dp-mono dp-num">
                  E {reg.alvo[0] || (reg.cobrEntrada ? "—" : "não pedido")} · S{" "}
                  {reg.alvo[1] || (reg.cobrSaida ? "—" : "não pedido")}
                </span>
              )}
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
          Decisão do DP — grava em ponto_caso · a execução no Transnet é o passo seguinte
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
        </div>
        <p className="dp-faint" style={{ ...MINI, margin: "8px 0 0" }}>
          {reg.temAviso
            ? "Existe aviso registrado neste crachá+dia (ponto_caso.aviso_enviado_em ou ponto_ocorrencias.lancado_em): a recusa PODE virar advertência — por isso o desfecho é escolhido à mão."
            : "Não há aviso registrado neste crachá+dia em nenhuma das duas fontes: a recusa encerra o caso e nunca vira advertência."}{" "}
          Gravar aqui não roda o robô — a execução é o passo de baixo, e ela só existe depois
          desta decisão estar gravada.
        </p>

        {/* EXECUÇÃO — bloco SEPARADO do bloco de decisão, de propósito: são dois atos
            diferentes, e o de baixo depende do de cima já ter acontecido. */}
        <RodapeRobo
          reg={reg}
          disparando={disparando}
          aoExecutar={aoExecutar}
          aoConferir={aoConferir}
          resultado={resultadoRobo}
        />
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
  // Os dois eixos da aba "A decidir" (app.js `dfstatus` e `dt5`). O padrão é o do
  // original: só o que ainda aguarda decisão, todas as datas.
  const [eixoStatus, setEixoStatus] = useState("PENDENTE");
  const [eixoData, setEixoData] = useState("TODAS");
  const [aberto, setAberto] = useState(null);
  const [gravando, setGravando] = useState(false);
  const [recado, setRecado] = useState("");
  const [selIds, setSelIds] = useState([]);
  const [versao, setVersao] = useState(0);
  const [disparando, setDisparando] = useState(false);
  const [resultadoRobo, setResultadoRobo] = useState(null);
  // A leitura do lake é por dia e o total de dias é sabido antes de começar: dá para
  // mostrar avanço de verdade. `null` = ainda na primeira fase (o estado do DP), que
  // é indeterminada — e barra indeterminada é honesta, barra que finge não é.
  const [progresso, setProgresso] = useState(null);
  // O texto grande das regras vive RECOLHIDO. Ele não some (é onde as travas do
  // trabalhador estão explicadas); fica atrás do botão, fechado por padrão.
  const [explica, setExplica] = useState(false);
  // O cartão da captura também: é ação RARA (o importador diário traz tudo sozinho),
  // e ele ocupava a mesma altura em toda visita. Fechado por padrão, a um clique.
  const [verCaptura, setVerCaptura] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setProgresso(null);
    try {
      const dados = await carregarOcorrencias((feitos, total) =>
        setProgresso({ feitos, total }),
      );
      setBase(dados);
      setErro("");
    } catch (falha) {
      setErro(falha?.message || "Falha ao consultar a base DP360.");
    } finally {
      setCarregando(false);
      setProgresso(null);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    carregarOcorrencias((feitos, total) => {
      if (ativo) setProgresso({ feitos, total });
    })
      .then((dados) => {
        if (ativo) setBase(dados);
      })
      .catch((falha) => {
        if (ativo) setErro(falha?.message || "Falha ao consultar a base DP360.");
      })
      .finally(() => {
        if (!ativo) return;
        setCarregando(false);
        setProgresso(null);
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

  // As linhas da aba ANTES dos dois eixos próprios de "A decidir". A busca já entra
  // aqui porque ela vale nas duas contagens de chip (o chip conta o que a pessoa está
  // vendo, não a base inteira).
  const daAba = useMemo(() => {
    const lista = linhasDaAba(porFuncao, porta, abaAtiva);
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.cracha.toLowerCase().includes(q),
    );
  }, [porFuncao, porta, abaAtiva, busca]);

  // Os dois eixos só existem na caixa de entrada da decisão do DP (`conf`). Nas outras
  // abas da porta não há o que filtrar por status — elas JÁ são um status.
  const temEixosConf = abaAtiva === "conf";

  // As datas presentes NAS LINHAS DA ABA (não a janela de 70 dias da leitura), do dia
  // mais novo para o mais antigo — `revd` do original.
  const datasDaAba = useMemo(() => {
    if (!temEixosConf) return [];
    const vistas = new Set(daAba.map((r) => r.iso).filter(Boolean));
    return [...vistas].sort((a, b) => b.localeCompare(a));
  }, [daAba, temEixosConf]);

  // Data escolhida que sumiu da lista (mudou de porta, de função, ou o dado saiu da
  // janela) não pode deixar a aba vazia sem explicação: vale como "todas".
  const dataAtiva = datasDaAba.includes(eixoData) ? eixoData : "TODAS";

  // O recorte do eixo DATA, que os dois usos abaixo compartilham.
  const noRecorteDeData = useMemo(
    () => (dataAtiva === "TODAS" ? daAba : daAba.filter((r) => r.iso === dataAtiva)),
    [daAba, dataAtiva],
  );

  // CONTAGEM DE CHIP = o efeito de mudar AQUELE eixo, mantendo o resto dos filtros (é
  // assim na Refeição, na Gordura e na Fraudes). Por isso a função, a busca e a data
  // entram na conta dos dois chips, e o eixo do status NÃO entra na sua própria conta.
  const contEixo = useMemo(() => {
    if (!temEixosConf) return { PENDENTE: 0, decididos: 0 };
    const pendentes = noRecorteDeData.filter((r) => !r.decJa).length;
    return { PENDENTE: pendentes, decididos: noRecorteDeData.length - pendentes };
  }, [noRecorteDeData, temEixosConf]);

  const linhas = useMemo(
    () => (temEixosConf ? noRecorteDeData.filter(porEixoStatus(eixoStatus)) : daAba),
    [daAba, noRecorteDeData, temEixosConf, eixoStatus],
  );

  // Os eixos de "A decidir" voltam ao padrão a cada troca de porta/aba — é o que o
  // original faz (`viewConfDecisao` nasce com dfStatus=PENDENTE e data5=TODAS).
  // Filtro que sobrevive à navegação é como se abre uma aba que parece vazia.
  const zerarEixos = () => {
    setEixoStatus("PENDENTE");
    setEixoData("TODAS");
  };

  const trocarPorta = (id) => {
    setPorta(id);
    setAba((ABAS[id] || ABAS.pedido)[0][0]);
    setAberto(null);
    setSelIds([]);
    zerarEixos();
  };

  // O recado do robô é DAQUELE caso: trocar de caso sem limpar faria o resultado de
  // um disparo aparecer no rodapé de outra pessoa.
  const abrir = (reg) => {
    setResultadoRobo(null);
    setAberto((atual) => (atual?.k === reg.k ? null : reg));
  };

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
          `NÃO roda o robô: gravar é um passo, executar é outro. Para mandar ao Transnet, ` +
          `abra o caso e use a execução do rodapé.`,
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

  /* ── EXECUÇÃO: manda ao robô uma decisão JÁ GRAVADA, um crachá+dia por vez ──
   *
   * As quatro coisas que este caminho garante, e nenhuma é conveniência de tela:
   *  1. só executa o que já foi DECIDIDO (motivoSemExecucao é o mesmo filtro do bot);
   *  2. o ESCOPO viaja sempre — `casos` com um par crachá+dia; escopo vazio faria o
   *     workflow rodar a fila inteira, então sem escopo o disparo é recusado aqui;
   *  3. ENSAIO e VALENDO são chamadas diferentes, cada uma com a sua confirmação —
   *     o servidor ainda força ensaio se `confirmar` não vier "true";
   *  4. o erro que aparece é o do gateway (dp360Api já desembrulha o motivo do 4xx),
   *     e a tela recarrega depois para ninguém decidir em cima de dado velho.
   */
  const aoExecutarRobo = useCallback(
    async (reg, valendo) => {
      const trava = motivoSemExecucao(reg);
      if (trava) {
        setResultadoRobo({ tipo: "erro", texto: `Não dá para executar: ${trava}.` });
        return;
      }
      const casos = casosDoRegistro(reg);
      if (!casos) {
        // NUNCA cair para "[]": ajustes.yml trata escopo vazio como fila inteira.
        setResultadoRobo({
          tipo: "erro",
          texto:
            "Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow rodar a fila inteira.",
        });
        return;
      }
      const plano = planoDaExecucao(reg);
      const rotulo = rotuloDaExecucao(reg);
      const cabeca = valendo
        ? `EXECUTAR DE VERDADE no Transnet — ${rotulo}.`
        : `ENSAIO (o robô navega, marca e NÃO clica) — ${rotulo}.`;
      const ok = confirmar(
        `${cabeca}\n\n` +
          `Pessoa: ${reg.nome} (${reg.cracha}) · dia ${reg.dataBR}.\n` +
          `Decisão já gravada: aceite=${txt(reg.ciclo.aceite)}` +
          `${txt(reg.ciclo.correcao_status) ? `, correcao_status=${txt(reg.ciclo.correcao_status)}` : ""}.\n\n` +
          `O robô vai aceitar ${plano.aceitar.length} e rejeitar ${plano.rejeitar.length} ocorrência(s)` +
          `${plano.jaResolvidos.length ? ` (${plano.jaResolvidos.length} o Transnet já resolveu — só confere)` : ""}.\n` +
          `Robô: ajustes · modo "${MODO_EXECUTAR}" · casos = 1 crachá+dia (só este).\n` +
          `${valendo ? "Ele carimba conferido_em em ponto_caso — é esse carimbo que trava o dia." : "Nada é clicado e nada é carimbado."}\n\n` +
          `${
            reg.temAviso && txt(reg.ciclo.aceite) === "rejeitado" && txt(reg.ciclo.correcao_status) !== "dispensada"
              ? "Esta recusa MANTÉM o caso na cadeia de advertência e correção — mas o robô NÃO envia a advertência nem corrige o cartão: isso continua fora desta tela."
              : "A advertência e a correção do cartão continuam fora desta tela."
          }\n` +
          `Quem executa é o robô, no GitHub Actions, e o disparo fica registrado com o seu nome.`,
      );
      if (!ok) return;

      setDisparando(true);
      setResultadoRobo(null);
      setRecado("");
      try {
        const r = await dispararRoboDP360("ajustes", {
          modo: MODO_EXECUTAR,
          casos,
          confirmar: valendo ? "true" : "false",
        });
        const texto =
          `${valendo ? "Execução" : "Ensaio"} disparado — ${reg.nome} · ${reg.dataBR}` +
          ` (${plano.aceitar.length} aceitar / ${plano.rejeitar.length} rejeitar).` +
          ` O resultado não volta sozinho: a prova fica no run.`;
        setResultadoRobo({ tipo: "ok", texto, painel: r?.painel || "" });
        setRecado(texto);
        await carregar();
      } catch (e) {
        const motivo = e?.message || "Não foi possível disparar o robô.";
        setResultadoRobo({ tipo: "erro", texto: `Falhou: ${motivo}` });
        setRecado(`Falhou: ${motivo}`);
      } finally {
        setDisparando(false);
      }
    },
    [carregar],
  );

  /* ── CONFERÊNCIA: lê o cartão ao vivo, NÃO mexe no Transnet ────────────────
   *
   * Porte de main.py:2204 (conferir_transnet). Dois escopos, um handler: as linhas
   * MARCADAS na grade e o CASO ABERTO — em ambos o escopo viaja explícito, porque
   * `ajustes.yml` roda a fila inteira com `casos` vazio (é o mesmo `if` da execução).
   *
   * A diferença para a execução, e é ela que muda o texto da confirmação: nenhum
   * dos dois botões escreve no Transnet. O que o `confirmar` liga é a escrita no
   * NOSSO banco — conferido_em / aviso_conferido_em / veredito, e ponto_fechado
   * quando o dia não aceita lançamento.
   */
  const aoConferirRobo = useCallback(
    async (regs, valendo, noCasoAberto = false) => {
      const lista = (regs || []).filter(Boolean);
      // ONDE O RECADO APARECE é dito pelo CHAMADOR, não deduzido do tamanho da lista:
      // marcar uma linha só na grade e ver o resultado brotar no rodapé de OUTRO caso
      // aberto é o tipo de confusão que faz alguém achar que conferiu quem não conferiu.
      const avisar = (texto) => {
        if (noCasoAberto) setResultadoRobo({ tipo: "erro", texto });
        setRecado(texto);
      };
      if (!lista.length) {
        avisar("Nenhuma linha marcada para conferir.");
        return;
      }
      const bloqueados = lista
        .map((r) => ({ r, motivo: motivoSemConferencia(r) }))
        .filter((x) => x.motivo);
      if (bloqueados.length) {
        avisar(
          `Não dá para conferir — ${bloqueados.length} caso(s) fora da fila do bot: ` +
            bloqueados
              .slice(0, 6)
              .map((x) => `${x.r.nome} ${x.r.dataBR} (${x.motivo})`)
              .join(" · ") +
            (bloqueados.length > 6 ? " …" : "") +
            ".",
        );
        return;
      }
      const casos = casosDeRegistros(lista);
      if (!casos) {
        // NUNCA cair para "[]": ajustes.yml trata escopo vazio como fila inteira, e
        // no modo conferir com `--confirmar` isso fecharia casos que ninguém olhou.
        avisar(
          "Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow conferir a fila inteira.",
        );
        return;
      }
      const nomes =
        lista
          .slice(0, 12)
          .map((r) => `· ${r.nome} ${r.dataBR}`)
          .join("\n") + (lista.length > 12 ? `\n… e mais ${lista.length - 12}` : "");
      const ok = confirmar(
        `${valendo ? "CONFERIR E FECHAR NO NOSSO BANCO" : "CONFERIR — ENSAIO (só lê e mostra)"}: ` +
          `${lista.length} crachá+dia.\n\n${nomes}\n\n` +
          `O robô abre o CARTÃO ao vivo e compara com o contrato congelado.\n` +
          `EM NENHUM DOS DOIS BOTÕES ele muda alguma coisa no Transnet.\n\n` +
          `${
            valendo
              ? "Valendo, o que bater com o combinado é fechado NO NOSSO BANCO: conferido_em, " +
                "aviso_conferido_em e o veredito em ponto_caso — e o dia que o Transnet não aceita " +
                "vira correcao_status='ponto_fechado'. É esse carimbo que tira o caso de \"Execução pendente\"."
              : "No ensaio nada é gravado: nem no Transnet, nem no nosso banco. Só o retrato, no run."
          }\n\n` +
          `Por que isto existe: EFETUADO na grade não prova que os horários foram alterados no ` +
          `cartão (PEDRO 30060491, 06/08).\n` +
          `Robô: ajustes · modo "${MODO_CONFERIR}" · casos = ${lista.length} crachá+dia (só estes).`,
      );
      if (!ok) return;

      setDisparando(true);
      if (noCasoAberto) setResultadoRobo(null);
      setRecado("");
      try {
        const r = await dispararRoboDP360("ajustes", {
          modo: MODO_CONFERIR,
          casos,
          confirmar: valendo ? "true" : "false",
        });
        const texto =
          `Conferência ${valendo ? "valendo" : "em ensaio"} disparada — ${lista.length} crachá+dia.` +
          ` O resultado não volta sozinho: ${
            valendo
              ? "o bot carimba conferido_em no nosso banco durante o run — recarregue daqui a pouco."
              : "a leitura fica no log do run."
          }`;
        if (noCasoAberto) setResultadoRobo({ tipo: "ok", texto, painel: r?.painel || "" });
        setRecado(texto);
        await carregar();
      } catch (e) {
        const motivo = e?.message || "Não foi possível disparar o robô.";
        if (noCasoAberto) setResultadoRobo({ tipo: "erro", texto: `Falhou: ${motivo}` });
        setRecado(`Falhou: ${motivo}`);
      } finally {
        setDisparando(false);
      }
    },
    [carregar],
  );

  /* ── CAPTURA DA GRADE: sem escopo, e sem o pós-processo do original ────────
   *
   * Porte de main.py:1540 (capturar_ocorrencias). Varre a grade inteira do Transnet
   * e grava as ocorrências no Supabase (bot_ajustes_app.py:543 e :827).
   *
   * ATENÇÃO AO QUE ELE **NÃO** É. Este botão não é o caminho normal de entrada da
   * ocorrência, e eu escrevi o contrário aqui antes. A `ponto_ajustes_app` é
   * alimentada pelo IMPORTADOR DIÁRIO, da view `7_vw_ponto_ajustes_app_046`, e o
   * comentário dela é literal: "SUBSTITUI A CAPTURA AO VIVO … antes um bot lia a
   * grade viva a cada 10 min (a ocorrência não estava no lake, evaporava no
   * aceite); agora `app_ocorrencia` está no datalake e PERSISTE".
   * (`importador_supabase.py:234-241` faz o upsert por `id_ocorrencia`.)
   *
   * Ou seja: ocorrência nova entra sozinha, com latência de D-1, sem ninguém abrir
   * nada. O que este botão dá é o DIA DE HOJE — a grade viva, antes de o importador
   * passar. Use quando o caso é de hoje; para o resto, esperar sai mais barato.
   *
   * UM BOTÃO SÓ, E É DE PROPÓSITO. `ajustes.yml:66-68` roda a captura SEM `$CONF`:
   *   "capturar a grade") python bot_ajustes_app.py --capturar --headless ;;
   * O `confirmar` não chega ao bot neste modo, e `capturar()` grava no Supabase
   * sempre. Ou seja: NÃO EXISTE ENSAIO DE CAPTURA. Botar aqui um botão "Ensaio" que
   * na verdade escreve a grade inteira na base seria exatamente a mentira que o
   * resto desta tela evita — então o disparo vai com `confirmar:"true"`, que é o que
   * mantém a trilha (dp360_auditoria) honesta sobre um run que escreve de verdade.
   * (Ensaio × valendo continua valendo como DOIS BOTÕES onde existem dois
   * comportamentos: executar e conferir.)
   *
   * O escopo é "[]" porque a captura não tem escopo — a grade inteira é o objeto, e
   * o yml nem lê `casos` neste modo. É a única vez em que "[]" é a resposta certa.
   */
  const aoCapturar = useCallback(async () => {
    const ok = confirmar(
      `CAPTURAR A GRADE do Transnet — de verdade.\n\n` +
        `Varre a tela "Ocorrências APP" inteira e grava as ocorrências novas na base ` +
        `(ponto_ajustes_app). NÃO aceita, NÃO rejeita e NÃO decide nada.\n\n` +
        `SEM ESCOPO: não é por crachá+dia — é a grade toda. É assim no original ` +
        `(bot_ajustes_app.py --capturar) e o workflow nem lê o filtro neste modo.\n\n` +
        `NÃO EXISTE ENSAIO desta ação: ajustes.yml roda a captura sem --confirmar, e a ` +
        `captura sempre grava. Por isso há um botão só.\n\n` +
        `DUAS COISAS QUE ESTE CAMINHO NÃO FAZ (e o original faz na máquina, depois do run):\n` +
        `· não carimba a "última captura" — ela continua marcando a última vez que a ` +
        `ferramenta desktop capturou;\n` +
        `· não congela a prova (antes/depois/veredito). Aqui a prova só é congelada na ` +
        `hora da DECISÃO, que é depois.\n\n` +
        `O INOVE dispara e não espera o run: o resultado aparece na base aos poucos, ` +
        `então recarregue daqui a pouco.`,
    );
    if (!ok) return;
    setDisparando(true);
    setRecado("");
    try {
      await dispararRoboDP360("ajustes", {
        modo: MODO_CAPTURAR,
        casos: "[]", // a captura não tem escopo — ver o comentário acima
        confirmar: "true",
      });
      setRecado(
        "Captura da grade disparada. O bot grava as ocorrências durante o run — recarregue daqui a " +
          "pouco. A “última captura” não se move por aqui, e a prova não é congelada neste caminho.",
      );
      await carregar();
    } catch (e) {
      setRecado(`Falhou: ${e?.message || "Não foi possível disparar o robô."}`);
    } finally {
      setDisparando(false);
    }
  }, [carregar]);

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
            }\nNÃO roda o robô: o disparo é sempre de UM caso, no caso aberto — não existe execução em lote.`,
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
    // ── O CARTÃO INTEIRO, EM QUATRO COMPARTIMENTOS (como na Gordura) ─────────
    // Nesta porta o ajuste é RESPOSTA a um aviso nosso: o assunto é o dia todo, não
    // a ponta. Por isso as duas colunas mostram os quatro slots — o que estava
    // (`Ponto (bateu)`) e o que fica (`Alvo`), com o slot que muda destacado.
    //
    // LARGURA FIXA E IGUAL NAS DUAS: `oc-slots` divide a célula em quatro colunas de
    // `1fr`, então a largura da COLUNA é o que garante os quatro horários numa linha
    // só. 268 px é a conta do pior caso — quatro chips de cinco caracteres (25:40
    // inclusive) com a marca E/S, mais os vãos e o respiro da célula. Encolher isto
    // não faz o cartão quebrar de novo (grade não quebra), faz o texto ser cortado:
    // se um dia precisar apertar, tire a marca E/S antes de tirar largura.
    {
      id: "atual",
      titulo: "Ponto (bateu)",
      largura: 268,
      classe: "oc-cel-cartao",
      valor: (r) => r.slotsAntes.filter(Boolean).join(" "),
      render: (r) => <LinhaCartao horas={r.slotsAntes} />,
    },
    {
      id: "alvo",
      titulo: "Alvo (o que pedimos)",
      largura: 268,
      classe: "oc-cel-cartao",
      valor: (r) => r.slotsAlvo.filter(Boolean).join(" "),
      render: (r) =>
        r.slotsAlvo.some(Boolean) ? (
          <LinhaCartao horas={r.slotsAlvo} mudou={r.slotsAlvoMudou} />
        ) : (
          <span className="dp-faint" title="O aviso deste dia não congelou alvo nenhum no caso.">
            sem alvo congelado
          </span>
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
            <BotaoExecucao tom="erro" motivo={MOTIVO_VENCIDO}>
              ⚠ Vencido — advertir e corrigir (robô)
            </BotaoExecucao>
            <span style={{ ...MINI, color: "var(--dp-danger-ink)" }}>
              não entra em lote — só a cadeia advertência → correção, que ainda é robô de fora
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
      render: () => (
        <BotaoExecucao motivo={MOTIVO_CANCELAR}>🗑 Cancelar no Transnet (robô)</BotaoExecucao>
      ),
    },
  ];

  // Uma CHAVE por grade: as colunas mudam por porta/aba, e a preferência de
  // coluna é por tela (app_config `tbl_p5_conf`, `tbl_p5_env`…).
  //
  // O QUE CADA GRADE DEIXA FAZER EM LOTE é diferente, e não por gosto:
  //  · `loteDecisao` (A decidir / Meus avisos) — grava aceite/recusa. Nada de robô.
  //  · `loteConferir` (Execução pendente) — a fila do bot é ESTA: decisão gravada e
  //    `conferido_em` vazio é a definição de exec_pendente. Conferir em lote aqui é
  //    o caminho de volta do resultado, e não decide nada.
  // Não existe EXECUÇÃO em lote em nenhuma delas: executar escreve no Transnet, e
  // isso continua sendo um caso por vez, no caso aberto.
  const GRADE = {
    conf: { chave: "p5_conf", colunas: COLS_PEDIDO, selecionavel: true, loteDecisao: true },
    aguard: { chave: "p5_env", colunas: COLS_AVISO, selecionavel: true, loteDecisao: true },
    coment: { chave: "p5_com", colunas: COLS_COMENT, selecionavel: false },
    cancel: { chave: "p5_cancel", colunas: COLS_CANCEL, selecionavel: false },
    exec: { chave: "p5_exec", colunas: COLS_EXEC, selecionavel: true, loteConferir: true },
  };
  const grade = GRADE[abaAtiva] || { chave: "p5_lista", colunas: COLS_LISTA, selecionavel: false };

  const VAZIOS = {
    conf: "Nenhum pedido aguardando decisão. Aguarde a captura do Transnet.",
    aguard: "Nenhum aviso esperando você — quem recebeu o aviso já foi tratado.",
    exec: "Nenhuma decisão aguardando o robô. (É aqui que mora a fila dele: abra o caso para EXECUTAR no Transnet, ou marque linhas para CONFERIR ao vivo — é a conferência que fecha o caso no nosso banco.)",
    ok: "Nenhum dia fechado como OK nesta porta.",
    recusados: "Nenhuma recusa nesta porta.",
    disc: "Nenhuma advertência ou correção — e isso pode estar certo: só adverte quem recebeu aviso.",
    fechado: "Nenhum dia travado por competência fechada.",
    cancel: "Nenhum aviso cancelado.",
    coment: "Nenhum comunicado no período.",
  };

  const marcados = linhas.filter((r) => selIds.includes(r.k));

  const barraLote = grade.selecionavel ? (
    <div style={{ ...FILA, gap: 8 }}>
      <span
        className="dp-muted dp-num"
        style={MINI}
        title={grade.loteConferir ? AVISO_CONFERIR : undefined}
      >
        {selIds.length
          ? `${selIds.length} marcada(s)`
          : grade.loteConferir
            ? "marque linhas para conferir no Transnet (só leitura)"
            : "marque linhas para decidir em lote"}
      </span>
      {grade.loteDecisao ? (
        <>
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
        </>
      ) : null}
      {/* CONFERIR EM LOTE — pode, e por um motivo simples: não decide nada e não
          escreve no Transnet. O escopo continua viajando (um par crachá+dia por
          linha marcada) e o disparo é recusado inteiro se alguma linha não tiver
          chave — nunca vai "[]", que o workflow leria como a fila toda. */}
      {grade.loteConferir ? (
        <>
          <BotaoAcao
            titulo="Lê o cartão ao vivo de cada dia marcado e mostra o resultado no run. Não grava nada — nem no Transnet, nem aqui."
            disabled={!selIds.length || gravando || disparando}
            onClick={() => aoConferirRobo(marcados, false)}
          >
            🔍 Conferir marcados — ensaio
          </BotaoAcao>
          <BotaoAcao
            tom="ok"
            titulo="Lê o cartão ao vivo e, no que bater com o combinado, carimba conferido_em no NOSSO banco. O Transnet continua intocado."
            disabled={!selIds.length || gravando || disparando}
            onClick={() => aoConferirRobo(marcados, true)}
          >
            🔒 Conferir marcados e fechar no nosso banco
          </BotaoAcao>
        </>
      ) : null}
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
          {/* ENQUANTO CARREGA NÃO SE DIZ "0 casos". "0 casos" numa tela que ainda
              está lendo é afirmação falsa sobre o trabalho do DP — parece fila vazia,
              é fila desconhecida. No lugar vai a barra, e ela CONTA DIA LIDO SOBRE DIA
              EM CENA (a leitura do lake é por dia): número de verdade, não animação. */}
          {carregando ? (
            <span style={{ ...FILA, gap: 8 }}>
              <span
                className={`oc-prog${progresso ? "" : " indeterminada"}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progresso?.total || undefined}
                aria-valuenow={progresso?.feitos}
                aria-label="Lendo a base DP360"
              >
                <span
                  className="oc-prog-fill"
                  style={
                    progresso?.total
                      ? { width: `${Math.round((progresso.feitos / progresso.total) * 100)}%` }
                      : undefined
                  }
                />
              </span>
              <span className="dp-muted dp-num" style={MINI}>
                {progresso?.total
                  ? `lendo o cartão de cada dia — ${progresso.feitos} de ${progresso.total}`
                  : "lendo o estado do DP…"}
              </span>
            </span>
          ) : (
            <span className="dp-muted dp-num">
              {linhas.length} {linhas.length === 1 ? "caso" : "casos"} · janela de {JANELA_DIAS} dias
            </span>
          )}
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
          <button
            type="button"
            className="dp-btn"
            onClick={carregar}
            disabled={gravando || disparando}
          >
            ↻ Recarregar
          </button>
          <Selo
            cor={gravando || disparando ? "alerta" : "accent"}
            titulo={AVISO_EXEC}
          >
            {gravando
              ? "gravando…"
              : disparando
                ? "disparando o robô…"
                : "decide · executa só o já decidido"}
          </Selo>
        </>
      }
      resumo={
        /* AS REGRAS DA TELA — RECOLHIDAS, NÃO APAGADAS (PORTE.md §5).
         *
         * Este texto é onde as travas do trabalhador estão explicadas: recusar ≠
         * advertir, o que a tela grava, o que ela executa e o que continua fora.
         * Apagar deixaria a tela sem o porquê, e o porquê é o que impede alguém de
         * "consertar" uma trava achando que é chatice. Mas ele também estava comendo
         * o topo de quem já sabe — então mora atrás do botão, fechado por padrão.
         *
         * O RECADO (resultado de gravação/disparo) fica SEMPRE visível: ele é a
         * resposta ao último clique, não explicação de tela. */
        <>
          <button
            type="button"
            className="dp-btn"
            aria-expanded={explica}
            onClick={() => setExplica((v) => !v)}
            title="As regras que mandam nesta tela: recusar ≠ advertir, o que ela grava, o que ela executa e o que continua fora."
          >
            {explica ? "▾" : "▸"} entenda esta tela
          </button>
          {recado ? (
            <>
              {" "}
              <Selo cor={recado.startsWith("Falhou") ? "erro" : "ok"} quebra>
                {recado}
              </Selo>
            </>
          ) : null}
          {explica ? (
          <div style={{ marginTop: 8, lineHeight: 1.55 }}>
            <Selo cor="erro" quebra>
              Recusar não é advertir — advertência só existe depois de aviso registrado.
            </Selo>{" "}
            <strong>O que esta tela GRAVA</strong> (em <span className="dp-mono">ponto_caso</span>, e o
            contrato antes/depois em <span className="dp-mono">ponto_ajustes_app</span>): aceite,
            recusa, marcação por ocorrência e desfazer.{" "}
            <strong>O que ela EXECUTA</strong> (robô <span className="dp-mono">ajustes</span>, nos
            três modos que o workflow expõe): <em>executar</em> leva ao Transnet uma decisão que já
            está gravada — no caso aberto, um crachá+dia por disparo; <em>conferir</em> lê o cartão ao
            vivo, não muda nada no Transnet e, valendo, fecha no nosso banco o que bateu (é o que tira
            o caso de “Execução pendente”) — nas linhas marcadas ou no caso aberto; <em>capturar</em>{" "}
            varre a grade e traz as ocorrências novas para a base, sem escopo. Decidir e executar
            continuam sendo dois passos, e nenhum botão de robô decide nada.{" "}
            <strong>O que ela NÃO faz:</strong> enviar a advertência, corrigir o cartão ou cancelar a
            ocorrência — esses são os robôs <span className="dp-mono">comunicado</span> e{" "}
            <span className="dp-mono">ponto</span>, e um modo que o workflow nem expõe; os botões
            estão desligados e dizem por quê. Também não congela a prova na captura: isso só acontece
            na decisão. Recusa sem aviso encerra o
            caso (<span className="dp-mono">dispensada</span>) e nunca vira advertência. Entrada e
            saída são julgadas separadamente: uma nunca anula a outra; dia misto e aviso vencido não
            entram em decisão em lote. Veredito, régua e simulação vêm do motor validado
            (<span className="dp-mono">regrasPonto.js</span>) — tolerância {TOLERANCIA_MIN} min ·
            prazo do colaborador {PRAZO_HORAS} h.
          </div>
          ) : null}
        </>
      }
    >
      {/* PORTAS — o primeiro nível da navegação. Cada porta diz a CONSEQUÊNCIA da
          recusa; por isso o texto de ajuda fica visível nas três, não só na ativa —
          isso NÃO mudou, e não deve mudar: quem lê a ajuda só da porta ativa não
          descobre que existe uma porta onde a recusa vira advertência.
          O que mudou foi só o RESPIRO: `oc-portas` aperta o cartão (menos padding,
          entrelinha menor) sem tirar uma palavra do texto. */}
      <div className="oc-portas">
        {PORTAS.map((p) => {
          const ativa = p.id === porta;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => trocarPorta(p.id)}
              title={p.ajuda}
              className={`dp-card oc-porta${ativa ? " on" : ""}`}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 650 }}>{p.label}</span>
                {cont.porta[p.id] ? (
                  <span className="dp-pill danger n">{cont.porta[p.id]}</span>
                ) : null}
              </div>
              <p className={ativa ? "" : "dp-muted"}>{p.ajuda}</p>
            </button>
          );
        })}
      </div>

      {/* ABAS da porta escolhida (segundo nível) + os filtros DA ABA, numa linha só.
          Eram três linhas empilhadas — abas, cartão da captura e nada de filtro; agora
          é uma, e o que saiu da vista continua a um clique. */}
      <div className="oc-linha-abas">
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
                zerarEixos();
              }}
              className={`dp-chip-f${ativa ? " on" : ""}`}
            >
              {label}
              <Contador n={n} />
            </button>
          );
        })}

        {/* ── OS DOIS FILTROS DE "A DECIDIR" (app.js `dfstatus` e `dt5`) ─────────
            O original usa dois <select>. Aqui o status vira CHIP COM CONTAGEM — o
            idioma que a Refeição, a Gordura e a Fraudes já usam (`dp-chip-f`): a
            pessoa vê quantos casos sobram em cada opção SEM abrir o seletor, e dois
            chips ocupam menos que um select largo. A data continua select porque são
            muitas (uma por dia da janela) e chip viraria uma parede.
            As contagens seguem a regra das outras abas: cada chip conta o efeito de
            mudar AQUELE eixo, mantendo os outros filtros (função, busca e data). */}
        {temEixosConf ? (
          <>
            <span className="oc-sep" aria-hidden="true" />
            {EIXOS_CONF.map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEixoStatus(id)}
                className={`dp-chip-f${eixoStatus === id ? " on" : ""}`}
                title={
                  id === "PENDENTE"
                    ? "Só o que ainda aguarda a SUA decisão."
                    : `Inclui as decisões que o bot ainda não executou (${contEixo.decididos}). ` +
                      "O que o Transnet já efetuou ou recusou nunca aparece aqui — isso vive nas abas de desfecho, e ver o mesmo caso duas vezes é o caminho para decidir duas vezes."
                }
              >
                {rotulo}
                <Contador n={id === "PENDENTE" ? contEixo.PENDENTE : contEixo.decididos} />
              </button>
            ))}
            {datasDaAba.length > 1 ? (
              <select
                className="oc-sel"
                value={dataAtiva}
                onChange={(e) => setEixoData(e.target.value)}
                title="Data de referência — só os dias que existem nas linhas desta aba."
              >
                <option value="TODAS">Referência: todas ({datasDaAba.length} dias)</option>
                {datasDaAba.map((d) => (
                  <option key={d} value={d}>
                    {paraBR(d)}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        ) : null}

        <span className="oc-empurra" />

        {/* ── CAPTURA DA GRADE — ação de TELA, não de linha, e RARA ──────────────
            Ela não tem escopo (é a grade inteira do Transnet) e não decide nada. Era
            um cartão aberto no topo o tempo todo, com dois parágrafos que ninguém
            relê depois da primeira vez — altura fixa pagando por uma ação que se usa
            de vez em quando. Agora é um botão que ABRE o cartão; nada foi apagado, e
            o que este caminho NÃO faz (o carimbo e o congelamento da prova, que no
            original rodam na máquina depois do run) continua escrito lá dentro. */}
        <button
          type="button"
          className={`dp-chip-f${verCaptura ? " on" : ""}`}
          aria-expanded={verCaptura}
          onClick={() => setVerCaptura((v) => !v)}
          title={AVISO_CAPTURA}
        >
          {verCaptura ? "▾" : "▸"} 🤖 Captura da grade
        </button>
      </div>

      {/* A ajuda da porta ativa NÃO se repete aqui: ela já está escrita dentro do
          cartão da porta, dois blocos acima, e a repetição só apertava o topo. */}

      {verCaptura ? (
        <div className="dp-card oc-captura">
          <div style={{ ...FILA, gap: 10 }}>
            <button
              type="button"
              className="dp-btn"
              onClick={aoCapturar}
              disabled={gravando || disparando}
              title={AVISO_CAPTURA}
            >
              🤖 Capturar a grade do Transnet
            </button>
            <span className="dp-muted" style={MINI}>
              Robô <span className="dp-mono">ajustes</span> · modo “{MODO_CAPTURAR}” · sem escopo (a
              grade inteira). Só LÊ a grade e grava as ocorrências novas na base — não aceita, não
              rejeita, não decide. <b>Não é o caminho normal:</b> a ocorrência entra sozinha pelo
              importador diário (latência de um dia). Isto aqui serve para trazer <b>o dia de
              hoje</b>, antes de o importador passar.
            </span>
          </div>
          <div style={{ ...FILA, gap: 10, marginTop: 6 }}>
            <Selo
              titulo="app_config.ultima_captura — carimbado por main.py:1565, na máquina, DEPOIS do run. Um disparo daqui não move este carimbo."
              quebra
            >
              última captura carimbada: {fmtDataHora(base?.ultimaCaptura)}
            </Selo>
            <Selo
              cor={base?.capturaMaisNova ? "accent" : "neutro"}
              titulo="O maior `capturado_em` de ponto_ajustes_app. ESTE se move quando a captura roda pela nuvem, porque o bot carimba cada linha que grava."
              quebra
            >
              ocorrência mais nova na base: {fmtDataHora(base?.capturaMaisNova)}
            </Selo>
            <span className="dp-faint" style={MINI}>
              O carimbo da esquerda só se move pela ferramenta desktop — o disparo daqui não o toca,
              porque quando o botão volta a captura ainda nem começou. E o{" "}
              <b>congelamento da prova não acontece por este caminho</b>: no original ele roda na
              máquina depois do run (<span className="dp-mono">congelar_antes</span>); aqui a prova
              (antes/depois) é congelada só na hora da <b>decisão</b>, que é depois — então a
              ocorrência capturada pela nuvem entra sem prova congelada.
            </span>
          </div>
        </div>
      ) : null}

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
        disparando={disparando}
        aoExecutar={aoExecutarRobo}
        aoConferir={aoConferirRobo}
        resultadoRobo={resultadoRobo}
      />
    </AbaShell>
  );
}

/* ============================================================================
 * O QUE ESTA TELA EXECUTA — e o que continua fora (de propósito)
 *
 * · EXECUÇÃO (LIGADA). Só no caso aberto, só uma decisão JÁ GRAVADA, e sempre com
 *   escopo explícito: `dispararRoboDP360("ajustes", { modo: "executar decisoes",
 *   casos: '[{"cracha":…,"date_ref":…}]', confirmar })`. O escopo não é enfeite —
 *   `ajustes.yml` roda a FILA INTEIRA quando `casos` chega vazio, e um clique sem
 *   escopo já processou 34 casos indevidos (24/08). Não existe execução em lote
 *   nesta tela, e o `confirmar` nasce falso no gateway: sem "true", é ensaio.
 *   Quem carimba `conferido_em` é o robô, não o navegador.
 * · CONFERÊNCIA (LIGADA). Modo "conferir (so leitura)", dois escopos: as LINHAS
 *   MARCADAS da aba "Execução pendente" e o CASO ABERTO. Lê o cartão ao vivo e não
 *   muda NADA no Transnet em nenhum dos dois botões; o `confirmar` liga a escrita no
 *   NOSSO banco (conferido_em / aviso_conferido_em / veredito, e ponto_fechado no dia
 *   que o Transnet recusa). É o caminho de VOLTA do resultado — sem ele o caso mora
 *   em "Execução pendente" para sempre. O escopo viaja igual, e a regra do "[]" vale
 *   igual: as duas ramificações do yml têm o mesmo `if`.
 * · CAPTURA (LIGADA, com um buraco declarado). Modo "capturar a grade", SEM escopo
 *   (`casos:"[]"` — a única vez em que "[]" é a resposta certa, porque o yml nem lê o
 *   filtro nesse modo). UM BOTÃO SÓ: `ajustes.yml:66-68` roda a captura sem `$CONF`,
 *   então não existe ensaio de captura — ela sempre grava, e um botão "Ensaio" que
 *   escreve a grade inteira seria mentira. O BURACO: o pós-processo do original
 *   (`main.py:1550 _pos_captura`) carimba `ultima_captura` e roda `congelar_antes()`
 *   NA MÁQUINA, depois do run. Aqui o disparo não espera o run, então esta tela LÊ e
 *   mostra `app_config.ultima_captura` mas NÃO o carimba, e o congelamento da prova
 *   não acontece por este caminho — a prova é congelada em `gravaContrato`, na hora
 *   da decisão, que é depois. Está escrito na tela, não só aqui.
 * · ADVERTIR e CORRIGIR (FORA — ver MOTIVO_ADVERTIR). São outros dois robôs
 *   (`comunicado` motivo 103 e `ponto`) e outros dois carimbos
 *   (advertencia_enviada_em / correcao_final_em), gravados por quem LÊ o resultado
 *   do run — coisa que esta tela não faz. A recusa executada aqui apenas MANTÉM o
 *   caso na fila da cadeia; nenhuma carta é enviada a ninguém.
 * · CANCELAR AVISO (aviso_cancelado_em) e cancelar a ocorrência no Transnet
 *   (FORA — ver MOTIVO_CANCELAR): é `--cancelar-enviadas`, modo que o workflow
 *   `ajustes.yml` não expõe; o gateway recusa qualquer modo fora dos três.
 * · ALVO MANUAL da correção (confirmar_errados(alvo=…) → ponto_ajustes_app
 *   .alvo_etapa2): é a régua de interno, e exige um campo de digitação com
 *   validação própria. Enquanto não existir, a recusa vai sem alvo — que é o
 *   mesmo comportamento do Python quando o operador não digita nada.
 * · ALVO CONGELADO (alvo_entrada/alvo_saida) e ponto_antes/ponto_depois já
 *   gravados: NUNCA são reescritos por esta tela.
 * ========================================================================== */
