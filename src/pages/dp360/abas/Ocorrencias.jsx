// ============================================================================
// DP360 · Passo 5 — OCORRÊNCIAS  (porte do app antigo Sistemas/PONTO)
//
// FONTE DA VERDADE (não invente regra — tudo aqui tem origem):
//   app/ui/app.js → viewP5 (~354), P5PORTAS (~133), P5ABAS (~134), SIT (~166),
//     COLS_CONF (~183), DEC/decCheckboxes/seloLancar/aplicarDecisoes (~208-352),
//     viewConfDecisao (~2058), viewConfLista (~3311), abreDetalheDia (~638)
//   app/main.py  → get_conferencia (~8959), _situacao (~7834), _reaberto (~7822),
//     marcar_ajustes (~9542), aplicar_marcados (~9649), confirmar_certos (~9498),
//     confirmar_errados (~9664), desfazer_decisao (~9519), _grava_contrato (~9467),
//     resolver_fora_do_robo (~8289), lancar_dia_ocorrencia (~4389)
//   src/pages/dp360/regrasPonto.js → O MOTOR. Nenhum veredito é calculado à mão aqui.
//   docs/dp360/PORTE.md → as anedotas (WILKER, DEVANIR, RICHARD, ALLAN, PEDRO,
//     CLAUDINEI/NELSON/SILVANO, ALEX, LUCIANO) e as regras que cada uma protege.
//
// AS TRÊS INVARIANTES DESTA TELA, e é delas que sai o desenho:
//   1. DECIDIR ≠ EXECUTAR. Gravar em `ponto_caso` é um passo; mandar ao robô é outro.
//   2. RECUSAR ≠ ADVERTIR. Advertência só existe depois de aviso registrado — por
//      isso a navegação é PORTA (de onde o dia veio) e depois aba.
//   3. UMA PERGUNTA, UMA RESPOSTA. Um cartão de hoje (`hoje`), um cartão final
//      (`cartaoFinal`), UMA marcação (`selIds`), uma função de linhas (`linhasDaAba`).
//      Toda vez que esta tela teve duas respostas para a mesma pergunta, alguém
//      decidiu pela resposta errada.
//   4. QUEM DECIDE É O CASO; QUEM LANÇA É A LISTA (10/09/2026). No pop-up, veredito e
//      mais nada — o cartão se monta ali, com a refeição travada e a origem de cada
//      ponta. Na lista, nenhuma caixinha de aceitar/rejeitar: ela mostra se ele
//      respondeu, e a aba "Fila de lançamento" manda o robô no que já foi decidido.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import {
  dispararRoboDP360,
  lerDP360,
  lerTudoDP360,
  statusRoboDP360,
  upsertDP360,
} from "../../../services/dp360Api";
// A TRILHA DO ROBÔ mora no projeto do PRÓPRIO INOVE (`dp360_robo_execucao`), não na base
// de importação — por isso o cliente normal, e não o gateway. Leitura só de Administrador
// (a policy exige nível admin), que é quem abre esta tela.
import { supabase } from "../../../supabase";
// O CARTÃO DO DIA é o pop-up COMPARTILHADO — o MESMO da Revisão e da Gordura. Ele já lê
// sozinho gordura, ajustes, reserva e GPS do crachá×dia, e traz o REAL MANUAL, que é o
// topo da cascata da régua. Daqui não vai prop nova nenhuma.
import { encaixaEmQuatro, validaCartao } from "../regrasMontador";
// A LEITURA DO DIA E O CARTÃO DO POP-UP, em módulo próprio e SEM React — do mesmo jeito que
// `regrasPonto`/`regrasMontador`. É lá que mora "de onde veio cada ponta", porque é a conta
// que decide o que vai ser lançado no ponto de uma pessoa e ela tem de ser provável fora do
// navegador (o teste diferencial de HENDESON 02/09 e ALECSANDRO 01/09 importa esse arquivo).
import {
  COMPARTIMENTOS,
  MOTIVO_MIOLO,
  ORIGENS,
  alvoPublicado,
  alvoQuatroSlots,
  horaSlot,
  marcaDaOcorrencia,
  mioloTravado,
  montaCompartimentos,
  pedidoMiraOMiolo,
  slotsDoCartao,
} from "../vereditoCartao";
import CartaoDoDia, {
  agoraUtc,
  aplicarRealManual,
  quemEstaUsando,
} from "../CartaoDoDia";
import {
  CONSTANTES,
  batidasDoCartao,
  bloqueioSimulacao,
  faltaAlmoco,
  hm2min,
  jornadaDoCartao,
  julgaAcoes,
  julgaRef,
  min2hm,
  normData,
  realocaDia,
  refDaPonta,
  removeFantasmas,
  resumoAcoes,
  simulaCartao,
  textoBatidas,
} from "../regrasPonto";

/* ─────────────────────────── constantes do domínio ───────────────────────── */

const JANELA_DIAS = 70;                        // PORTE.md §4
/**
 * O QUE A BASE DO DP GUARDA — janela DESLIZANTE de 120 dias.
 *
 * Medido em 09/09/2026: `ponto_diario` tem exatamente 120 dias corridos, sem um buraco,
 * de 12/05 a 08/09. Não é falha de importação: o dia envelhece e sai.
 *
 * Isso importa aqui porque o Transnet deixa o colaborador abrir pedido para dia MUITO
 * antigo, e a captura traz esses pedidos hoje. Aí o pedido existe e o DIA não — 457 linhas
 * assim, todas em 43 dias anteriores a 12/05, e em nenhum deles a tabela tem uma única
 * linha, de ninguém. Sem o dia não há escala, e sem escala o motor não tem onde ancorar a
 * batida pedida: a simulação volta vazia e a coluna do alvo fica muda.
 */
const RETENCAO_DIAS = 120;
const TOLERANCIA_MIN = CONSTANTES.TOL_AJUSTE_MIN; // main.py:9959 — do MOTOR, não cópia
const PRAZO_HORAS = 48;                        // main.py PRAZO_HORAS

// dp360-api ROBOS.ajustes.inputs.modo — strings EXATAS: o gateway compara com a
// lista e devolve 400 em qualquer variação. Nunca montar por concatenação.
const MODO_EXECUTAR = "executar decisoes";
/**
 * ajustes.yml:20 — o cancelamento em lote do "Pedido do colaborador".
 *
 * Ele NAO e uma recusa gravada aqui e executada depois: o robo abre a GRADE AO VIVO do
 * Transnet, pareia por crachá + data, recusa só os IDs que a leitura de agora ainda mostra
 * pendentes, e só então fecha o caso como `cancelado`. Por isso ele não depende da foto
 * D-1 do lake para saber se ainda existe ocorrência aberta lá.
 *
 * E se a grade mudar no meio e algum ID não confirmar, o caso FICA em "A decidir" — some
 * da fila só o que foi provado resolvido. É o contrário do fechamento otimista.
 */
const MODO_CANCELAR = "cancelar pedidos";
const MODO_CONFERIR = "conferir (so leitura)";

// O terceiro modo do robô, "capturar a grade", NÃO tem botão aqui: a
// `ponto_ajustes_app` é alimentada pelo IMPORTADOR DIÁRIO (view
// `7_vw_ponto_ajustes_app_046`, cabeçalho "SUBSTITUI A CAPTURA AO VIVO"), então a
// ocorrência entra sozinha. Ver PORTE.md.

const AVISO_CONFERIR =
  "Lê o cartão ao vivo e compara com o contrato. NÃO muda nada no Transnet — nem no ensaio, " +
  "nem valendo. Valendo, fecha só no NOSSO banco (conferido_em) o que bateu. " +
  "Existe porque EFETUADO na grade não prova que os horários mudaram no cartão.";

// ── Os três botões que continuam DESLIGADOS, e por quê ────────────────────
// Nenhum deles é o robô `ajustes`, e nenhum carimba sozinho: advertencia_enviada_em
// e correcao_final_em são gravados por QUEM LÊ O RESULTADO do run — coisa que esta
// tela não faz. Ligar hoje mandaria carta na ficha de alguém sem registrar que saiu.
const MOTIVO_ADVERTIR =
  "Ainda não: advertir é o robô `comunicado` (motivo 103) e corrigir o cartão é o robô `ponto`. " +
  "Quem carimba advertencia_enviada_em/correcao_final_em é quem lê o resultado do run, e esta tela não lê run.";
const MOTIVO_CANCELAR =
  "Ainda não: cancelar a ocorrência enviada é `--cancelar-enviadas`, que o workflow ajustes.yml não expõe.";
const MOTIVO_VENCIDO =
  "Ainda não: o vencido não tem decisão gravada para o robô `ajustes` executar (ele não mexeu no ponto), " +
  "e a saída dele é advertência → correção — robôs `comunicado` e `ponto`.";

// app.js:133 — as duas portas + comunicados. A PORTA DEFINE A CONSEQUÊNCIA.
const PORTAS = [
  {
    id: "pedido",
    label: "Pedido do colaborador",
    consequencia: "sem aviso nosso no dia: recusar aqui SÓ recusa — nunca vira advertência.",
  },
  {
    id: "aviso",
    label: "Enviamos para ajuste",
    consequencia: "avisamos este crachá+dia: o ajuste é RESPOSTA, e recusar PODE advertir e corrigir.",
  },
  {
    id: "coment",
    label: "Comunicados",
    consequencia: "avisos que só informam (almoço, bateu ponto fora). Não pedem ação.",
  },
];
const PORTA_DE = (id) => PORTAS.find((p) => p.id === id) || PORTAS[0];

// app.js:134 (P5ABAS) — o caminho é o mesmo nas duas portas: decidir → executar → desfecho.
/* CADA ESTADO É UMA ABA, e a linha não repete o estado (desenho de 10/09/2026).
 * "Execução pendente" virou "Fila de lançamento": o nome antigo não dizia se o caso estava
 * esperando VOCÊ mandar ou o robô responder, e o dono leu a fila como "o robô não rodou"
 * quando ela era, na verdade, "ninguém mandou". A fila esvazia por CONFIRMAÇÃO (o
 * `conferido_em` do bot), nunca por disparo. */
const ABAS = {
  pedido: [
    ["conf", "A decidir"],
    ["exec", "Fila de lançamento"],
    ["ok", "Ponto OK"],
    ["recusados", "Recusados"],
    ["fechado", "Ponto fechado"],
  ],
  aviso: [
    ["aguard", "A decidir"],
    ["exec", "Fila de lançamento"],
    ["ok", "Ponto OK"],
    ["disc", "Advertências e correções"],
    ["cancel", "Cancelamento"],
    ["fechado", "Ponto fechado"],
  ],
  coment: [["coment", "Comunicados"]],
};
// A aba de entrada de cada porta — é ela que o contador da porta conta.
const ABA_DE_ENTRADA = { pedido: "conf", aviso: "aguard", coment: "coment" };

// app.js:166 (SIT) — situação → rótulo + cor.
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

const DESFECHOS = ["ok", "advertido", "corrigido", "ponto_fechado"]; // main.py:7808
const DESTINOS = [...DESFECHOS, "exec_pendente", "recusa_exec_pendente"];
const SIT_DISC = ["advertido", "corrigido"]; // app.js:2849

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

// CARIMBO DE GRAVAÇÃO: o `datetime.now().isoformat()` do Python — hora LOCAL, sem fuso.
// Não pode ser toISOString(): `_reaberto` compara `aviso_enviado_em > conferido_em` COMO
// TEXTO, e misturar UTC com os carimbos locais da tabela desloca a comparação em 3 horas.
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

// minutos → "9h20". Só formatação; a jornada quem calcula é `jornadaDoCartao`.
function horasLiquidas(min) {
  if (min == null || Number.isNaN(min)) return "";
  const v = Math.max(0, Math.round(min));
  return `${Math.floor(v / 60)}h${String(v % 60).padStart(2, "0")}`;
}

function confirmar(texto) {
  if (typeof window === "undefined" || typeof window.confirm !== "function") return false;
  return window.confirm(texto);
}

/* ─────────────────────────── regras portadas do DP ───────────────────────── */

// main.py:2905 — (label, grupo, monitora). `monitora` = o aviso pede ajuste e roda os
// 48h; sem ele o caso é só comunicado. Ele escolhe a LISTA, nunca a porta (app.js:3322).
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
    // PEDIR EXCLUSÃO de batida repetida do coletor. `monitora: false` é o ponto: advertir
    // por exclusão não feita levaria o `bot_ponto` a lançar um cartão inventado — o erro
    // oposto ao que este aviso conserta.
    if (tp === "exclusao")
      return { label: "Pedir exclusão de batida", grupo: "motorista", monitora: false };
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
  // Ponto fechado é DESFECHO, não pendência: vem antes de tudo, até de corrigido.
  if (txt(c.correcao_status) === "ponto_fechado") return "ponto_fechado";
  if (txt(c.correcao_final_em)) return "corrigido";
  if (txt(c.aceite) === "rejeitado") {
    const dispensada = txt(c.correcao_status) === "dispensada";
    if (temAviso && !dispensada) return txt(c.conferido_em) ? "advertido" : "recusa_exec_pendente";
    if (temAviso) return txt(c.conferido_em) ? "ok" : "recusa_exec_pendente";
    return txt(c.conferido_em) ? "recusado" : "recusa_exec_pendente";
  }
  if (txt(c.aceite) === "aceito") return txt(c.conferido_em) ? "ok" : "exec_pendente";
  return { certo: "conf_certo", errado: "conf_errado" }[veredito] || "conf";
}

// app.js:1586 (diaStatus) — o status do DIA a partir das pontas cobradas.
// PONTA INDEPENDENTE: uma nunca anula a outra; misto obriga abrir o caso.
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

// app.js:222 (decJa) — "eu já decidi esse?". `pendente` é o DEFAULT da coluna, não uma
// decisão: só aceito/rejeitado contam. Ciclo reaberto não conta.
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
// MARCADO NÃO É TRATADO: a cláusula de `ajuste_ids` saiu em 25/08 porque ela disparava
// exatamente no estado em que o DP ainda tem trabalho — o caso sumia e a caixinha
// "lançar" nunca era desenhada (5 casos de 20/08 decididos e invisíveis).
function jaTratado(reg) {
  if (["advertido", "corrigido", "ajustou"].includes(reg.situacaoAviso)) return true;
  if (reg.reaberto) return false; // aviso novo reabre
  return ["aceito", "rejeitado"].includes(txt(reg.caso?.aceite));
}

/* ─────────────────────────────── carga de dados ──────────────────────────── */

// `dt_referencia_ponto` é o SEGUNDO dia de referência do lake — é ele que alimenta a
// realocação de dia do motor (main.py:6445). Sem a coluna, 71 pedidos eram julgados
// contra o cartão do dia errado.
const COLS_AJUSTES =
  "id_ocorrencia,cracha,nome,date_ref,escala,tipo_ajuste,dia_posterior,ponto_antes," +
  "ponto_depois,horario_ajuste,alvo_etapa2,verdict,situacao_ajuste,respondido_por," +
  "origem,abertura,capturado_em,aceito_em,batida_atual,batida_nova,dt_referencia_ponto";

// `almoco_travado` é a trava da REVISÃO e vale para quem escreve `ponto_real_manual`
// (main.py:392). Ela entra aqui porque "Recusar e corrigir assim" crava as quatro pontas
// no Real — e a recusa tem de ser abortada ANTES do primeiro upsert.
const COLS_DIARIO =
  "cracha,date_ref,todas_batidas,batidas_limpas,jornada_liquida_min,entrada,saida," +
  "saida_almoco,volta_almoco,esc_entrada,esc_saida,entrada_sug,saida_sug," +
  "almoco_saida_sug,almoco_volta_sug,status_ponto,motivo,nm_funcao,categoria,almoco_travado," +
  // `tem_ponto` é a régua da FERRAMENTA para "este dia chegou do Transnet?"
  // (main.py:7067 monta o seletor de datas com ela; processar_ponto.py:29 filtra as
  // linhas da Revisão pelo mesmo campo). É ela que decide o que entra na fila.
  "tem_ponto," +
  // O ALVO PUBLICADO PELA REVISÃO — é ele que a correção lança, e ele já vem com a
  // ponta batida preservada ("só a ponta errada muda"). `*_ref` é a régua interna da
  // view e serve de reserva; `*_sug` é o último degrau.
  "alvo_entrada,alvo_saida,alvo_saida_almoco,alvo_volta_almoco,alvo_entrada_ref,alvo_saida_ref," +
  // o carimbo de ONDE a view tirou o almoço do dia (CARTAO_PRESERVADO, MODULO_REFEICAO,
  // MATRIZ_PARADO...): é o que a tela mostra ao completar um cartão de 3 batidas
  "fonte_almoco";

// `real_inicio`/`real_fim` NÃO são enfeite: é deles que sai o degrau "gordura" da cascata
// do alvo (ver `alvoDaGordura`). `alvo_entrada`/`alvo_saida` NÃO entram aqui porque NÃO
// SÃO COLUNAS de `ponto_gordura` — o Python as calcula em memória (main.py:4780
// `_alvo_gordura`), e pedi-las ao PostgREST derrubaria a leitura inteira com 400.
const COLS_GORDURA =
  "cracha,nm_funcionario,data_ref,esc_inicio,esc_fim,sst_vinculo,sst_desvinculo," +
  "val_inicio,val_fim,op_inicio,op_fim,real_inicio,real_fim,gordura_entrada," +
  "gordura_saida,nivel_entrada,nivel_saida";

/**
 * Lê o lake SÓ NOS PARES (crachá, dia) que estão em cena.
 *
 * POR QUE POR DIA E NÃO POR BLOCO DE CRACHÁS: `cracha in (…) AND data in (…)` traz o
 * produto cartesiano — 345 crachás × 159 datas ≈ 55 mil linhas por tabela para os ~6 mil
 * pares que interessam. Agrupando por dia, cada requisição leva só os crachás que têm
 * pedido NAQUELE dia: dezenas de linhas, uma página.
 *
 * `pares` = Map "cra8|dia" → { crachas: Set(cru e cra8), iso }. As DUAS variantes viajam
 * porque a chave da montagem casa por `cra8` mas a linha do lake pode estar gravada com o
 * crachá cru — perder isso faz a conferência perder par em silêncio.
 */
const LIMITE_CHAMADAS = 8; // teto do CONJUNTO das tabelas: a Edge Function é a mesma de todas as telas

// As TRÊS tabelas do lake que a conferência precisa (o lake não padronizou a coluna de
// data). `ponto_intervalo` SAIU: era um quarto das requisições, e o `reg.intervalo` que
// ela alimentava nunca foi lido por ninguém — nem por célula, nem por veredito.
const TABELAS_LAKE = [
  { chave: "diario", tabela: "ponto_diario", colData: "date_ref", colunas: COLS_DIARIO },
  { chave: "gordura", tabela: "ponto_gordura", colData: "data_ref", colunas: COLS_GORDURA },
];

/**
 * O REAL MANUAL NÃO ENTRA NA VARREDURA POR DIA — ele cabe INTEIRO numa requisição.
 *
 * Ele é escrito à mão pelo DP, não pelo importador: a tabela toda tem 386 linhas (medido
 * em 09/09/2026, cobrindo 29/07 a 02/09). Pedir uma requisição por dia para isso gastava
 * 161 chamadas para trazer, somadas, algumas centenas de linhas — um terço de todo o
 * custo da tela para a menor das três tabelas.
 * Sem recorte de colunas: o real manual é a régua do DP e a tela usa a linha inteira.
 */
const TABELA_REAL = { chave: "realManual", tabela: "ponto_real_manual", colData: "date_ref" };

/**
 * DIA VELHO NÃO SE PERGUNTA. O lake é uma janela deslizante de 120 dias (ver
 * `RETENCAO_DIAS`), e o Transnet deixa abrir pedido para dia muito mais antigo: 43 dos 161
 * dias em cena hoje estão FORA da janela, e em cada um deles as três tabelas devolvem
 * lista vazia — 129 requisições para não trazer nada.
 * A margem de 10 dias é de propósito: se a retenção mudar um pouco, é melhor gastar meia
 * dúzia de chamadas do que sumir com o cartão de um dia que existe.
 */
const IDADE_MAXIMA_LAKE = RETENCAO_DIAS + 10;
const diasDeIdade = (iso) =>
  Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86400000);

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
  const porDia = new Map();
  pares.forEach(({ crachas, iso }) => {
    if (!iso || !crachas.size) return;
    if (!porDia.has(iso)) porDia.set(iso, new Set());
    const alvo = porDia.get(iso);
    crachas.forEach((c) => alvo.add(c));
  });

  const vazio = { diario: [], gordura: [], realManual: [] };
  if (!porDia.size) {
    aoAvancar?.(0, 0);
    return vazio;
  }

  const trabalhos = [];
  porDia.forEach((crachas, iso) => {
    if (diasDeIdade(iso) > IDADE_MAXIMA_LAKE) return;   // fora da janela do lake
    const lista = [...crachas].join(",");
    TABELAS_LAKE.forEach((t) => trabalhos.push({ t, iso, lista }));
  });
  const diasEmCena = [...porDia.keys()].filter((iso) => diasDeIdade(iso) <= IDADE_MAXIMA_LAKE);

  // PROGRESSO HONESTO: o total de dias é sabido AQUI, antes de qualquer chamada. Um dia só
  // conta como lido quando TODAS as tabelas dele voltaram — contar leitura solta faria a
  // barra correr mais rápido do que o trabalho.
  const totalDias = diasEmCena.length;
  const faltamNoDia = new Map(diasEmCena.map((iso) => [iso, TABELAS_LAKE.length]));
  let diasFeitos = 0;
  aoAvancar?.(0, totalDias);

  const out = { diario: [], gordura: [], realManual: [] };
  // uma requisição só, em paralelo com a varredura, cobrindo a janela inteira em cena
  const dias = [...diasEmCena].sort();
  const real = dias.length
    ? lerTudoDP360(TABELA_REAL.tabela, {
        ordem: "date_ref.asc",
        filtros: { date_ref: `gte.${dias[0]}` },
      }).catch(() => [])
    : Promise.resolve([]);

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
      // varredura, e o erro sobe pelo `emPool`
      const resta = (faltamNoDia.get(iso) ?? 1) - 1;
      faltamNoDia.set(iso, resta);
      if (resta === 0) {
        diasFeitos += 1;
        aoAvancar?.(diasFeitos, totalDias);
      }
    }
  });
  out.realManual = await real;
  return out;
}

async function carregarOcorrencias(aoAvancar) {
  const inicio = isoDiasAtras(JANELA_DIAS);

  const [casos, ajustesBrutos, ocorrencias] = await Promise.all([
    lerTudoDP360("ponto_caso", { ordem: "date_ref.desc", filtros: { date_ref: `gte.${inicio}` } }),
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

  // PEDIDO VÁLIDO vs LIXO (supabase_client.ler_ajustes_app): o lake guarda avisos,
  // advertências e atestados na MESMA tabela, sem `tipo_ajuste`. Essas linhas não são
  // pedido do colaborador — descartá-las é regra, não otimização.
  const pedidos = ajustesBrutos.filter((o) => txt(o.tipo_ajuste));
  const descartados = ajustesBrutos.length - pedidos.length;

  // PARES em cena = crachá × dia dos pedidos + dos casos. O dia ALTERNATIVO do pedido
  // entra como par próprio: sem o cartão do outro dia a realocação do motor não tem contra
  // o que casar a batida.
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

  const { diario, gordura, realManual } = await lerLakePorPares(pares, aoAvancar);

  return {
    casos, pedidos, ocorrencias, diario, gordura, realManual, descartados,
    lidoEm: agoraISOLocal(),
  };
}

/* ── O CARTÃO DO DIA (app.js:2158) ────────────────────────────────────────────
 * O Real manual do DP é o TOPO da cascata da régua (`refDaPonta`). Julgando um pedido, o
 * DP que discorda da régua não tinha onde cravar: precisava sair da tela e ir à Revisão.
 *
 * A LINHA VEM DO BANCO NA HORA, não de `reg.cartao`: `COLS_DIARIO` é um recorte estreito
 * de propósito e o cartão usa colunas que não estão nele; e o overlay do Real manual tem
 * de ser aplicado sobre a linha CRUA, senão apagar o Real deixaria os `_sug` com o valor
 * antigo. É uma leitura de UMA pessoa num dia, só quando alguém clica. */
const variantesDoCracha = (c) => [
  ...new Set([txt(c), txt(c).replace(/^0+/, ""), cra8(c)].filter(Boolean)),
];

async function lerCartaoDoDia(cracha, dia) {
  const iso = normData(dia) || txt(dia).slice(0, 10);
  const filtros = { cracha: `in.(${variantesDoCracha(cracha).join(",")})`, date_ref: `eq.${iso}` };
  const [diario, reais, casos] = await Promise.all([
    lerDP360("ponto_diario", { filtros, limite: 5 }),
    // o Real manual e o caso são camadas: sem eles o cartão abre, só sem overlay
    lerDP360("ponto_real_manual", { filtros, limite: 5 }).catch(() => []),
    lerDP360("ponto_caso", { filtros, limite: 5 }).catch(() => []),
  ]);
  const linha = diario?.[0];
  if (!linha) return null;
  return { linha: aplicarRealManual(linha, reais?.[0] || null), caso: casos?.[0] || null };
}

/* ═══════════════ OS DOIS CARTÕES DA TELA — e são só dois ═════════════════════
 *
 * Esta tela chegou a desenhar o "cartão de hoje" de TRÊS maneiras (`reg.antes` cru, o
 * `hoje` recalculado dentro do montador e `slotsDoCartao`) e o "depois" de mais duas.
 * Elas discordavam, e o que subia para o robô era sempre a última que alguém escreveu —
 * o caso DEVANIR 30017485 20/08 (`…12:22` num quadro, `…12:24` no outro).
 *
 * Agora existem DOIS cartões, os dois montados UMA vez em `montarRegistros` e nunca
 * recalculados adiante:
 *
 *   `reg.hoje`       — o cartão de hoje em MINUTOS, como o motor o vê (desenrolado: a
 *                      batida `00:42` depois de uma saída `24:53` é `24:42`). É o que o
 *                      montador compara e o que `antesTexto` congela no contrato — os
 *                      dois lados do par antes/depois saem do MESMO desenrolo.
 *   `reg.slotsHoje`  — o MESMO cartão nos quatro compartimentos do Transnet
 *                      (entrada · saída almoço · volta almoço · saída), pela leitura
 *                      TIPADA de `todas_batidas`. É a coluna "Ponto (bateu)".
 *
 * `reg.antes` (o cartão limpo sem fantasmas, NÃO desenrolado) continua existindo, mas
 * só como ENTRADA DO VEREDITO — é a assinatura crua que `julgaRef` recebe no Python
 * (`_julga_ref(lim, sim, …)`). Ele não é desenhado em lugar nenhum.
 */

// Cartão em MINUTOS → quatro slots. Não há marca E/S para ler numa simulação, então aqui
// vale a forma da Gordura: duas batidas são as pontas — com a mesma exceção de cima (se as
// duas horas são o almoço já lançado, elas não são as pontas).
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

/**
 * ══ O ALVO É O CARTÃO FINAL INTEIRO ═══════════════════════════════════════════
 *
 * Decisão do dono: "os pontos de alvo têm que ter todos — como vai ficar o final depois de
 * lançado". O alvo não é "as pontas que foram pedidas": é o cartão como ele fica quando o
 * robô terminar. Antes desta função a tela tinha QUATRO desenhos de alvo (a coluna da
 * grade, o bloco do caso — que chegava a escrever "E não pedido · S não pedido" —, o
 * contexto do dia e o relatório impresso), e três deles mostravam só as pontas.
 *
 * A REGRA, e ela não simula nada:
 *   · onde o caso congelou alvo, vale o ALVO — é o horário que o robô vai lançar, e a tela
 *     não pode prometer coisa diferente do que a correção executa;
 *   · onde não congelou, vale O QUE JÁ ESTÁ NO CARTÃO — o robô não toca nesse compartimento,
 *     então ele fica como está. É isto que completa os quatro;
 *   · miolo vazio CONTINUA VAZIO. É assim que o Transnet representa "não teve almoço", e
 *     inventar horário ali seria pior do que deixar em branco.
 *
 * `mudou[i]` separa PEDIDO de HERDADO sem uma palavra de texto: só o slot que sai diferente
 * do cartão de hoje é destacado (o `.dp-chip.new`, a mesma marca que a Gordura usa).
 *
 * NÃO EXISTE SEGUNDA PROJEÇÃO AQUI. Quem responde "como o cartão fica com as suas marcas" é
 * o montador, e só ele. Esta função responde outra pergunta — "o que foi pedido, e como o
 * dia fica quando isso for lançado" — usando exclusivamente dado gravado.
 */
/**
 * O CARTÃO DEPOIS DO PEDIDO, EM QUATRO COMPARTIMENTOS.
 *
 * Quem decide QUEM É QUEM já é o montador: o encaixe (`encaixaEmQuatro`) escolhe a
 * primeira batida, o par de almoço plausível e a última, e joga o resto fora. Aqui só
 * resta pôr o resultado nos campos — e a forma é a mesma que o montador usa (`quatroSlots`:
 * duas batidas são as pontas, quatro entram em ordem).
 *
 * DUAS TENTATIVAS ANTES DESTA, e as duas erraram por querer preservar posição:
 *   · slotar a simulação com `quatroSlots` SEM olhar o cartão de hoje mostrava as mesmas
 *     horas em posições diferentes nas colunas "bateu" e "alvo" quando o pedido não mudava
 *     nada (MARCELO 06/09). Por isso o pedido que não muda nada devolve o desenho de hoje,
 *     intacto;
 *   · preservar o compartimento de cada batida quebrava quando o PAPEL da batida muda:
 *     HENDESON 02/09 bateu duas vezes (pontas, `21:31 · — · — · 22:01`) e o pedido as
 *     transforma no MIOLO de um cartão de quatro (`16:10 · 21:31 · 22:01 · 26:10`).
 *     Guardar a posição antiga não deixava o 16:10 entrar em lugar nenhum.
 *
 * CARTÃO IMPOSSÍVEL? ENTÃO VALE O ALVO (montador.py:387, "cartão incompleto reparado pela
 * sugestão da Revisão"). Foi o dono quem apontou: "mas aí vamos pegar o alvo — por isso o
 * alvo é importante". E é isso mesmo: o pedido diz o que a PESSOA quer mexer, mas quem diz
 * como o dia TEM de ficar é a régua que a Revisão apurou e publicou (as quatro sugestões do
 * `ponto_diario`). Quando aplicar o pedido ao pé da letra produz cartão que não existe —
 * uma inserção numa ponta que já tem batida deixa o cartão com 3 —, o alvo é a resposta, e
 * não a recusa.
 *
 * A trava é a mesma do Python: só entra com as QUATRO sugestões preenchidas e só se elas
 * formarem um cartão válido. Sugestão pela metade não vira alvo — slot vazio não se
 * inventa (LIÇÃO 21).
 *
 * `null` = nem o pedido nem o alvo formam cartão, e o motivo é o do próprio `valida`.
 */
function projetarNosSlots(slotsHoje, hojeMin, simMin, almocoLancado, cat, ...reguas) {
  const antes = (hojeMin || []).map(min2hm);
  const depois = (simMin || []).map(min2hm);
  const igual = antes.length === depois.length && antes.every((h, i) => h === depois[i]);
  if (igual) return { slots: slotsHoje || ["", "", "", ""], problema: "", fonte: "cartão" };
  const problema = validaCartao(simMin || [], cat);
  if (!problema) return { slots: quatroSlots(simMin, almocoLancado), problema: "", fonte: "pedido" };

  // AS RÉGUAS, NA ORDEM DA CASCATA: o Real manual do DP primeiro (é o topo em todo o
  // resto da tela — `refDaPonta` —, e é ele que o DP crava quando a view não apurou), e só
  // depois a sugestão publicada pela Revisão. Cada uma vale INTEIRA ou não vale: régua pela
  // metade não completa cartão, porque slot vazio não se inventa (LIÇÃO 21).
  for (const [fonte, bruta] of reguas) {
    const quatro = (bruta || []).map(horaSlot);
    if (!quatro.every(Boolean)) continue;
    // desenrola a virada, como o `_desenrola` do montador antes de validar
    const mins = quatro.map(hm2min);
    for (let i = 1; i < mins.length; i += 1) while (mins[i] < mins[i - 1]) mins[i] += 1440;
    if (!validaCartao(mins, cat)) return { slots: mins.map(min2hm), problema: "", fonte };
  }
  return { slots: null, problema, fonte: "" };
}

/* ══ O CARTÃO DE 3 BATIDAS — O QUE FALTA É O ALMOÇO, NÃO A DECISÃO (09/09/2026) ═══════
 *
 * "O motor ou coloca 4 pontos ou 2 pontos, e não 3" (o dono). O montador faz hoje o MESMO
 * que a ferramenta (`montador.py`: no MOTORISTA o encaixe em quatro só roda quando já há
 * 4+ batidas, o conserto pelo GPS é desligado — "no MOTORISTA o almoço foi inserido por
 * NÓS" — e a LIÇÃO 21 proíbe inventar slot). Então o cartão de 3 não é defeito do porte: é
 * um dia a que falta a OUTRA PONTA DO ALMOÇO, e a tela passa a dizer QUAL batida falta.
 *
 * DE ONDE VEM O ALMOÇO — e só dali: da SUGESTÃO DO DIA (`almoco_saida_sug` /
 * `almoco_volta_sug`), que a view `vw_ponto_revisao_motorista` apura pela cascata
 * CARTAO_PRESERVADO → MODULO_REFEICAO → MATRIZ_PARADO(_BATIDO/_MAIOR) → MATRIZ_MEIO_JORNADA
 * e carimba em `fonte_almoco`. NÃO é o Citatti da aba Refeição lido à parte: o módulo de
 * refeição entra NESSA cascata (MODULO_REFEICAO) quando carimbou, e aí já chega aqui pelas
 * colunas do dia. Quando a view não acha base ela NÃO INVENTA (`fonte_almoco` nulo,
 * `almoco_faixa` SEM_BASE) e o dia vai para a mão do DP — aqui também: devolve `null`.
 *
 * ISTO NÃO VIRA CONTRATO. O `montado.contrato` congela o que o robô `ajustes` deixa no
 * Transnet ao aceitar a ocorrência — e ele não lança almoço. Congelar aqui a batida do
 * almoço faria a conferência acusar divergência contra o cartão vivo. É leitura.
 *
 * SEM CHAMADOR HOJE (10/09/2026): quem a lia era o card do montador, que saiu do pop-up
 * (“só veredito”). Fica de pé para a tarefa que leva esse card para a tela principal. */
function fechaComAlmocoDoDia(fica, cartao, categoria) {
  const mins = (fica || []).filter((v) => v != null);
  if (mins.length !== 3) return null;
  const ini = hm2min(horaSlot(cartao?.almoco_saida_sug));
  const fim = hm2min(horaSlot(cartao?.almoco_volta_sug));
  if (ini == null || fim == null) return null;
  // a batida do meio é a ponta do almoço que ELE bateu; a que falta é a outra
  const meio = mins[1];
  const perto = (a, b) => Math.min(Math.abs(a - b), 1440 - Math.abs(a - b)) <= CONSTANTES.TOL_FANTASMA;
  const falta = perto(meio, ini) ? fim : perto(meio, fim) ? ini : null;
  if (falta == null) return null;
  let v = falta;
  while (v < mins[0]) v += 1440;                 // desenrola para o dia deste cartão
  const cheio = [...mins, v].sort((a, b) => a - b);
  // só vale se fechar de verdade (mesmo `valida` do Python: ordem, 4 slots, almoço possível)
  if (validaCartao(cheio, categoria)) return null;
  return {
    cartao: cheio,
    falta: v,
    lado: falta === fim ? "volta do almoço" : "saída para o almoço",
    par: `${min2hm(ini)}–${min2hm(fim)}`,
    fonte: txt(cartao?.fonte_almoco),
  };
}

function cartaoFinal(slotsHoje, caso, slotsPedido, problemaPedido, fontePedido, trava, cp, rm) {
  const hoje = slotsHoje || ["", "", "", ""];
  const alvo = alvoQuatroSlots(caso);
  // `slotsPedido === null` = a projeção não cabe em quatro campos; então não há terceiro
  // degrau, e a coluna cai no cartão de hoje (com o aviso vindo de `naoFecha`).
  const pedido = slotsPedido || ["", "", "", ""];
  /* QUEM MANDA DEPENDE DA DECISÃO, porque são DOIS robôs diferentes (09/09/2026, apontado
   * pelo dono no caso EDUARDO 30054702 · 21/08):
   *   · ACEITAR chama o robô `ajustes`, que só clica ACEITAR na ocorrência do Transnet —
   *     o cartão vira O QUE ELE PEDIU (ali: 03:20), nunca o alvo do aviso;
   *   · RECUSAR é que manda o dia para advertir/corrigir, e aí sim quem é lançado é o
   *     ALVO congelado no aviso (ali: 02:58).
   * O alvo congelado vinha ganhando nos dois casos, e a tela prometia 02:58 num dia que ia
   * virar 03:20 — discordando do próprio card do montador, no mesmo pop-up. Agora o alvo do
   * aviso continua desenhado, mas em linha PRÓPRIA (`alvoAviso`), dita como o que a
   * CORREÇÃO lançaria. */
  // REABERTO NÃO É RECUSADO: a recusa do ciclo anterior não manda no aviso novo — é a mesma
  // regra de `casoDoCiclo`/`decisaoJaTomada`, que zeram a decisão quando o aviso reabre.
  const recusado = txt(caso?.aceite) === "rejeitado" && !ehReaberto(caso);
  /* SÓ GANHA DO ALVO O PEDIDO QUE MUDA ALGUMA COISA (09/09/2026 — regressão que eu mesmo
   * abri hoje de manhã e o dono pegou no ALECSANDRO 30061220 · 01/09: "mandamos ajuste,
   * está vencido, o alvo não tem nada").
   *
   * Dia com aviso e SEM pedido (ou com pedido que não altera o cartão) não vira nada por
   * aceite nenhum: ele segue para advertência e correção, e o que a correção lança é o
   * ALVO congelado no aviso — que era justamente o que sumia da coluna. `projetarNosSlots`
   * já carimba isso: fonte "cartão" quer dizer "a simulação deu igual ao cartão de hoje",
   * que é o caso de quem não pediu nada.
   *
   * A ferramenta separa as duas perguntas em campos diferentes (app/ui/app.js:1867 desenha
   * "Ponto no cartão hoje", "Alvo (o que pedimos no aviso)" e "Como o ponto vai ficar").
   * Aqui a coluna é uma só — "o cartão final" —, então quem manda nela é quem VAI lançar:
   * o robô `ajustes` quando há pedido a aceitar, a correção quando não há. */
  const pedidoManda = !recusado && pedido.some(Boolean) && txt(fontePedido) !== "cartão";
  // SEM AVISO NÃO HÁ CORREÇÃO: na porta do pedido quem lança é sempre o robô `ajustes`,
  // então o publicado da Revisão não entra — ele é o cartão da CADEIA DE CORREÇÃO.
  const temAviso = Boolean(txt(caso?.aviso_enviado_em) || alvo.some(Boolean));
  const publicado = temAviso ? alvoPublicado(cp, rm, hoje) : null;
  const slots = pedidoManda
    ? pedido.map((v, i) => v || publicado?.[i] || alvo[i] || hoje[i] || "")
    : (publicado || alvo.map((v, i) => v || pedido[i] || hoje[i] || ""));
  return {
    slots,
    // mudou = sai diferente do cartão de hoje (destacado); igual = fica como está
    mudou: slots.map((v, i) => Boolean(v) && v !== (hoje[i] || "")),
    temAlvo: slots.some(Boolean),
    // sem nada congelado, o que está desenhado é PROJEÇÃO do pedido em aberto —
    // vira alvo de verdade quando a decisão é gravada.
    congelado: alvo.some(Boolean),
    // O QUE PEDIMOS NO AVISO, sempre que existir. Não é mais o cartão final: é a
    // COMPARAÇÃO — "cobramos X e vamos lançar Y?" —, o mesmo alerta que a ferramenta dá
    // (app/ui/app.js:1850). O alvo do aviso foi congelado no envio e a base mudou desde
    // então; quem lança é o publicado.
    alvoAviso: alvo.some(Boolean) ? alvo : null,
    difereDoAviso: alvo.some(Boolean) && alvo.some((v, i) => Boolean(v) && v !== slots[i]),
    // de onde saiu o cartão desenhado, para a legenda não prometer o robô errado
    publicado: Boolean(publicado) && !pedidoManda,
    // SÓ QUANDO NÃO HÁ ALVO CONGELADO. Com alvo congelado o cartão final é o do aviso —
    // dado gravado, não projeção —, e o aviso "não fecha" estava passando por cima dele.
    naoFecha: slotsPedido === null && !alvo.some(Boolean),
    // o motivo é o do Python (`valida`): "3 batidas (motorista: 2 ou 4)", "almoço de N min"
    problema: txt(problemaPedido),
    // de onde saiu o desenho: o pedido (ou a régua que o completou), o cartão de hoje, ou —
    // no dia recusado — o alvo congelado no aviso
    fonte: pedidoManda
      ? txt(fontePedido)
      : publicado
        ? "revisão publicada"
        : alvo.some(Boolean)
          ? "aviso"
          : txt(fontePedido),
    // e, quando não há desenho nenhum, o que está travando
    trava: txt(trava),
  };
}

/**
 * O DEGRAU "GORDURA" DA CASCATA DO ALVO (main.py:4780 `_alvo_gordura`, lido por
 * `_julga_acoes` em main.py:6582).
 *
 * A cascata do Python é `caso.alvo_* → g.alvo_* → cp.*_sug`. O degrau do meio estava MORTO
 * no porte: `julgaAcoes` lê `g.alvo_entrada`, mas `ponto_gordura` NÃO TEM essa coluna — o
 * Python a calcula em memória antes de julgar. Pedir a coluna ao PostgREST não resolveria
 * nada (derrubaria a leitura com 400); o que resolve é fazer a mesma conta, com as colunas
 * que já lemos.
 *
 * A conta é a do Python, e as tolerâncias são as do MOTOR (10 min na entrada, 8 na saída):
 * o alvo é a operação real com a tolerância que o próprio aviso concede.
 *
 * O que NÃO está portado, de propósito: o encaixe na escala do ramo não-Revisão
 * (main.py:4828) depende de `tn_entrada`, que não está em `COLS_GORDURA`; e o degrau da
 * Revisão, que o Python prefere, já chega aqui pelo último degrau da cascata
 * (`cp.entrada_sug`/`saida_sug` são a sugestão publicada pela Revisão).
 */
function alvoDaGordura(g, cp) {
  const ri = hm2min(g?.real_inicio);
  const rf = hm2min(g?.real_fim);
  // A SUGESTÃO DO DIA GANHA. No Python quem manda no degrau da gordura é o alvo PUBLICADO
  // pela Revisão (main.py:4808) — a régua que o colaborador viu no aviso — e a conta
  // `real ∓ tolerância` é o que sobra "para o dia que a Revisão não apurou". Aqui a régua
  // publicada que temos em mãos é a sugestão do dia, que já é o degrau seguinte da cascata:
  // então, onde ela existe, esta função devolve vazio e deixa a cascata seguir.
  // Sem isso o degrau revivido passaria POR CIMA da régua publicada — e o motorista seria
  // cobrado contra um horário que o aviso nunca pediu, que é exatamente o defeito que a
  // unificação da régua no Python foi corrigir (FRANCISCO 3202768 01/09).
  return {
    alvo_entrada:
      txt(cp?.entrada_sug) !== "" || ri === null
        ? ""
        : min2hm(Math.max(0, ri - CONSTANTES.TOL_ENTRADA_MIN)),
    alvo_saida:
      txt(cp?.saida_sug) !== "" || rf === null ? "" : min2hm(rf + CONSTANTES.TOL_SAIDA_MIN),
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

// main.py:9070 (_prev) — a prévia simula CADA pedido uma vez, e só os que ainda estão
// abertos. Reenvio do mesmo pedido (17% do volume) quebrava a simulação, e
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
  const { casos, pedidos, ocorrencias, diario, gordura, realManual } = base;

  const chave = (cracha, data) => `${cra8(cracha)}|${normData(data)}`;
  const indexar = (linhas, colData) => {
    const m = new Map();
    (linhas || []).forEach((r) => m.set(chave(r.cracha, r[colData]), r));
    return m;
  };

  const mapaCaso = indexar(casos, "date_ref");
  // `ponto_ocorrencias` é a tabela das ocorrências (DSR/Comp/Curso) que o BOT lançou — é
  // ela que diz se o dia sem ponto já foi lançado, para ninguém lançar duas vezes.
  const mapaOcorrencia = indexar(ocorrencias, "date_ref");
  const mapaDiario = indexar(diario, "date_ref");
  const mapaGordura = indexar(gordura, "data_ref");
  const mapaReal = indexar(realManual, "date_ref");

  // ── REALOCAÇÃO DE DIA (motor: realocaDia — porte de main.py:6445) ─────────
  // O lake traz DOIS dias de referência e eles divergem em 79% dos pedidos. Quando a
  // batida que ele quer mexer não está no cartão do nosso dia e está no do outro, o dia é
  // o outro. Roda ANTES de agrupar: o grupo do dia errado julgava contra o cartão errado.
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

  // main.py:8190 (_dias_com_aviso) — houve aviso no dia? DUAS fontes: o carimbo do caso e
  // a ocorrência lançada. Ler só uma fazia a advertência nunca sair da fila. É o mesmo
  // separador que decide se uma RECUSA pode virar advertência.
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

  let registros = [];
  chaves.forEach(({ cracha, iso }, k) => {
    const grupo = grupos.get(k) || [];
    const casoBruto = mapaCaso.get(k) || null;
    const temAvisoCaso = Boolean(txt(casoBruto?.aviso_enviado_em));

    // linhas sem pedido e sem aviso não são caso nenhum (só ruído do join)
    if (!grupo.length && !temAvisoCaso) return;

    const cp = mapaDiario.get(k) || {};
    const temLinhaDoDia = mapaDiario.has(k);
    const g = mapaGordura.get(k) || {};
    const rm = mapaReal.get(k) || {};
    const caso = casoBruto || {};
    const reaberto = ehReaberto(caso);
    const ciclo = casoDoCiclo(caso);
    const temAviso = diasComAviso.has(k);

    const primeiro = grupo[0] || {};
    const ultimo = grupo[grupo.length - 1] || {};
    const cat = categoriaPorCracha.get(cra8(cracha)) || "MOTORISTA";

    // ── O CARTÃO ANTES (main.py:9057) ────────────────────────────────────────
    // Fonte = `todas_batidas` do nosso ponto_diario; a grade do Transnet distorce. Sem
    // cartão, o `ponto_antes` congelado no pedido. Tudo em MINUTOS, como o motor trabalha.
    const antesCartao = batidasDoCartao(cp);
    const antesMin = antesCartao.length ? antesCartao : batidasDoCartao(primeiro.ponto_antes);

    // main.py:9124 — `lim` = o cartão ANTES com os FANTASMAS REMOVIDOS. É contra ele que o
    // veredito mede "que ponta ele mexeu" (batida duplicada em ≤6 min é o MESMO evento).
    // `desenrolar:false` reproduz a chamada crua do Python — e é SÓ entrada de veredito:
    // quem é desenhado é o `hoje`, abaixo.
    const { limpas: lim, fora: fantasmas } = removeFantasmas(antesMin, { desenrolar: false });

    const refsEscala = [hm2min(cp.esc_entrada), hm2min(cp.esc_saida)].filter((v) => v != null);
    const fechado = txt(cp.status_ponto).toUpperCase() === "SEM_PONTO";
    // main.py:9088 — "sem cartão" tem DUAS causas e a nota do simulador só conhece uma.
    const arruma = (lista) =>
      (lista || [])
        .filter((n) => !String(n).startsWith("_fantasma"))
        .map((n) =>
          fechado && String(n).includes("aguardando o dia fechar")
            ? "não bateu ponto no dia — nada a conferir"
            : n,
        );

    // ── O CARTÃO DE HOJE, UMA VEZ SÓ ────────────────────────────────────────
    // Mesmo motor, mesma entrada e mesmas referências do "depois": é o `simulaCartao` com
    // pedido NENHUM. Sem isto, um cartão desenrolado (24:42) comparado com o cru (00:42)
    // diria "mudou" num dia em que nada mudou — e `antesTexto` congelava o não desenrolado
    // enquanto `depoisTexto` congelava o desenrolado, deixando o robô conferindo um par
    // que nunca bateria.
    const hoje = simulaCartao({
      batidas: antesMin,
      pedidos: [],
      refs: refsEscala,
      cartaoFechado: fechado,
    }).batidas;

    // ── O CARTÃO DEPOIS = SIMULAÇÃO (motor: simulaCartao) ────────────────────
    const prev = pedidosDaPrevia(grupo);
    const previa = simulaCartao({
      batidas: antesMin,
      pedidos: prev.map(pedidoDoMotor),
      refs: refsEscala,
      cartaoFechado: fechado,
    });
    let notas = arruma(previa.notas);
    let sim = previa.batidas;

    // main.py:9098-9122 — O "DEPOIS" TEM QUE RESPEITAR A DECISÃO. Enquanto aberto ele é a
    // prévia; depois de decidido vira EVIDÊNCIA, e evidência que ignora a decisão mente.
    const decidido = ["aceito", "rejeitado"].includes(txt(ciclo.aceite));
    if (decidido) {
      const ids = txt(ciclo.ajuste_ids).split(",").map((x) => x.trim()).filter(Boolean);
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

    // ── A RÉGUA (motor: refDaPonta) — main.py:9132 ───────────────────────────
    // Real manual do DP > ALVO congelado > sugestão do dia > escada do canon.
    const fontesE = { sst: g.sst_vinculo, val: g.val_inicio, citatti: g.op_inicio, escala: cp.esc_entrada };
    const fontesS = { sst: g.sst_desvinculo, val: g.val_fim, citatti: g.op_fim, escala: cp.esc_saida };
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

    // ── O VEREDITO DO DIA (motor: julgaRef) — main.py:7926 ───────────────────
    // Mede o cartão simulado contra a RÉGUA, por ponta, e só a ponta que o pedido mexeu.
    const jr = julgaRef({
      cartaoAntes: lim,
      cartaoDepois: sim,
      refs: { entrada: refE, saida: refS },
      tol: TOLERANCIA_MIN,
    });
    if (!jr.combinado && jr.motivo) notas = [...notas, jr.motivo]; // main.py:9160

    // cobrado = o aviso pediu essa ponta (main.py:9151)
    const pontaCaso = txt(caso.ponta).toLowerCase();
    const cobrEntrada = Boolean(txt(caso.alvo_entrada)) || ["entrada", "ambos"].includes(pontaCaso);
    const cobrSaida = Boolean(txt(caso.alvo_saida)) || ["saida", "ambos"].includes(pontaCaso);

    // main.py:9155 (_pst): cobrado e não mexeu = pendente; não pedido = fora.
    const pst = (st, cobr) => (st === "certo" || st === "errado" ? st : cobr ? "pendente" : "");
    const verEntrada = pst(jr.entrada, cobrEntrada);
    const verSaida = pst(jr.saida, cobrSaida);
    const veredito = jr.combinado || "";

    // ── VEREDITO POR OCORRÊNCIA (motor: julgaAcoes) ─────────────────────────
    // É o que permite decidir um dia MISTO sem "rejeitar tudo" (eram 124 casos). A régua
    // dele é OUTRA — o ALVO do aviso, não a cascata da régua: é o que PEDIMOS, e é contra
    // isso que o pedido dele responde. A cascata do alvo é a do Python, com o degrau da
    // gordura agora vivo (ver `alvoDaGordura`).
    const acoes = julgaAcoes({
      pedidos: grupo.map(pedidoDoMotor),
      alvo: {
        entrada: caso.alvo_entrada,
        saida: caso.alvo_saida,
        almSaida: caso.alvo_alm_saida,
        almVolta: caso.alvo_alm_volta,
        origem: caso.origem,
      },
      gordura: { ...g, ...alvoDaGordura(g, cp) },
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

    // os DOIS cartões da tela — montados aqui e nunca recalculados adiante
    const slotsHoje = slotsDoCartao({ cp, caso, lim });
    // NA PORTA "PEDIDO" NUNCA HÁ ALVO CONGELADO — é a definição da porta: não avisamos
    // ninguém, então o `ponto_caso` não guardou alvo. A coluna dizia "sem alvo congelado"
    // em 100% das linhas, e o DP decide sem ver o que vai ser lançado. O terceiro degrau
    // da cascata é o cartão COM O PEDIDO APLICADO — o mesmo `sim` que o montador desenha,
    // e que já respeita a decisão depois que ela é gravada.
    // O ENCAIXE ANTES DA PROJEÇÃO. Cartão que sai da simulação com 5 batidas não é
    // "cartão que não fecha": é cartão com batida sobrando, e o montador da ferramenta
    // encaixa as quatro (primeira · par de almoço plausível · última) e descarta o resto
    // (montador.py:417). Sem este passo a coluna dizia "não fecha em 4" e não mostrava
    // alvo nenhum — e o dono foi direto ao ponto: "tem que fazer fechar em 4, por isso
    // tem o montador".
    const encaixado = encaixaEmQuatro(sim, cat).fica;
    const proj = projetarNosSlots(
      slotsHoje, hoje, encaixado, [caso.alvo_alm_saida, caso.alvo_alm_volta], cat,
      ["Real manual", [rm.entrada, rm.alm_saida, rm.alm_volta, rm.saida]],
      ["revisão", [cp.entrada_sug, cp.almoco_saida_sug, cp.almoco_volta_sug, cp.saida_sug]],
    );
    // POR QUE NÃO HÁ CARTÃO — a coluna vazia não explicava nada, e "sem batida nem
    // pedido" (o rótulo que eu tinha posto) era falso: TODOS têm pedido. O que falta é
    // o DIA: sem linha no `ponto_diario` não há escala, e sem escala o motor não tem onde
    // ancorar a batida pedida (é a escala que desempata AM/PM e ancora a inserção num dia
    // sem cartão) — então a simulação devolve zero batida e a coluna fica muda.
    const diasDeIdade = Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86400000);
    const travaCartao = !temLinhaDoDia
      ? diasDeIdade > RETENCAO_DIAS
        ? `o dia saiu da base do DP (ela guarda ${RETENCAO_DIAS} dias; este tem ${diasDeIdade}) — sem escala, o pedido não tem onde ancorar`
        : "o dia não está na base do DP — sem escala, o pedido não tem onde ancorar"
      // SEM_PONTO AGORA QUER DIZER OUTRA COISA. Enquanto dia não-importado entrava na fila,
      // esta frase era verdade duas vezes: o dia não tinha chegado. Com o filtro de
      // `tem_ponto` (o dia só entra quando chegou), o que sobra aqui é a pessoa que não
      // bateu num dia que ESTÁ na base — falta, folga ou atestado. Dizer "não chegou do
      // Transnet" mandaria o DP esperar uma carga que já veio.
      : txt(cp.status_ponto).toUpperCase() === "SEM_PONTO"
        ? "ele não bateu ponto neste dia — o dia está na base"
        : !hoje.length && !sim.length
          ? "cartão vazio e o pedido não produziu batida"
          : "";
    const final = cartaoFinal(slotsHoje, caso, proj.slots, proj.problema, proj.fonte, travaCartao, cp, rm);
    /* A RÉGUA DAS QUATRO PONTAS — o alvo PUBLICADO pela Revisão com o Real manual por cima.
     * É o MESMO `alvoPublicado` que a cascata do cartão final já usa; nenhuma régua nova.
     *
     * Ela existe em campo próprio porque o pop-up do caso mede contra ela ("no alvo",
     * "+17 min") e é dela que sai o "Completar <ponta> com o alvo". O `alvo.slots` não
     * serve: ali o pedido aceito manda, e o pop-up precisa justamente da distância ENTRE o
     * pedido e o alvo.
     *
     * `["","","",""]` como base é de propósito: aqui o slot que ninguém publicou tem de
     * ficar VAZIO. Passando `slotsHoje`, a batida de hoje se disfarçaria de alvo e o
     * "completar com o alvo" ofereceria a própria batida que está faltando. */
    const regua = alvoPublicado(cp, rm, ["", "", "", ""]) || alvoQuatroSlots(caso);

    // ── monitor de avisos (main.py:4283-4361) ───────────────────────────────
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
      // REGRA: quem MEXEU sai do "vencido" mesmo fora do prazo. O prazo é para corrigir;
      // corrigiu, cumpriu a função (main.py:4348).
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
      iso,
      dataBR: paraBR(iso),
      nome: txt(primeiro.nome) || txt(caso.nm_funcionario) || txt(g.nm_funcionario) || "—",
      categoria: cat,
      funcao: txt(cp.nm_funcao),
      caso,
      ciclo,
      cartao: cp,
      gordura: g,
      // O REAL MANUAL DO DP já era lido aqui para montar a régua (`refDaPonta`), mas morria
      // dentro do cálculo: o pop-up do caso não tinha como dizer se alguém já cravou o
      // horário — e ele é o TOPO da cascata, acima do alvo do aviso e da sugestão do dia.
      realManual: rm,
      ajustes: grupo,
      nAjustes: grupo.length,
      realocado: txt(primeiro._realocadoDe),
      capturadoEm: txt(ultimo.capturado_em),
      // ── os dois cartões, e a entrada do veredito ──
      hoje,                                 // minutos, desenrolado — o cartão de hoje
      slotsHoje,                            // o mesmo cartão nos quatro compartimentos
      antes: lim,                           // entrada do veredito (NÃO é desenhado)
      antesBruto: antesMin,
      antesFonte: antesCartao.length ? "cartão" : "grade",
      // `ponto_antes` E O RETRATO DA GRADE, NAO UM DESENHO NOSSO.
      // A coluna e COMPARTILHADA com a ferramenta do PC: ela grava aqui o cartao cru
      // (main.py:2427) e o le de volta no relatorio como "o retrato da GRADE no momento
      // da decisao" (main.py:5485). Se congelarmos o cartao DESENROLADO, um dia que vira
      // a meia-noite entra como `24:08` onde a grade mostra `00:08` — a ferramenta
      // imprimiria uma hora que nao existe no relogio de ninguem.
      // Entao vai o cru, na ordem em que veio: `antesBruto` = `todas_batidas` sem os
      // marcadores E/S, que e exatamente o `_batidas_de` do Python (main.py:7798) — e
      // NAO o `lim`, que passa pelo removedor de fantasmas e "descarta a entrada em ~400
      // dias" (a advertencia esta escrita la mesmo, main.py:7802).
      antesTexto: textoBatidas(antesMin),
      depois: sim,
      alvo: final,                          // o cartão FINAL, quatro slots + `mudou`
      regua,                                // as quatro pontas do alvo publicado (o pop-up)
      // DIA SEM PONTO = ZERO batida NO CARTÃO (main.py:6199). Sai de `antesCartao`, nunca
      // de `antesMin`: este último cai no `ponto_antes` CONGELADO quando o cartão está
      // vazio, e aí um dia sem batida nenhuma pareceria ter batidas.
      semBatida: antesCartao.length === 0,
      ocorrenciaDia: mapaOcorrencia.get(k) || null,
      almocoTravado: ehVerdadeiro(cp.almoco_travado),
      fantasmas,
      notas,
      bloqueio,
      escala: [txt(cp.esc_entrada) || txt(g.esc_inicio), txt(cp.esc_saida) || txt(g.esc_fim)],
      baseE: refE.rotulo,
      baseS: refS.rotulo,
      refE: refE.ref == null ? "" : min2hm(refE.ref),
      refS: refS.ref == null ? "" : min2hm(refS.ref),
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
      restam,
      foraPrazo,
      decJa: decisaoJaTomada(caso),
    });
  });

  /* ── SÓ OS DIAS QUE ESTÃO COM PONTO (09/09/2026, decisão do dono) ─────────────
   * Dia cujo cartão ainda não foi importado entrava na fila mesmo assim: as batidas vinham
   * do `ponto_antes` do próprio pedido (o retrato da grade do Transnet), mas sem cartão não
   * há sugestão, não há gordura, não há almoço apurado — e o caso chegava ao DP sem régua
   * nenhuma, dizendo "o ponto deste dia não chegou do Transnet". Em 09/09 eram seis dias
   * assim (03/09 a 08/09), com ZERO linha de `tem_ponto` em 369 por dia.
   *
   * A RÉGUA É A DA FERRAMENTA, não uma inventada aqui: o dia chegou quando existe ao menos
   * uma linha com `tem_ponto = true` naquele `date_ref` (main.py:7067 usa exatamente isso
   * para montar o seletor de datas). É régua de DIA, não de pessoa — quem não bateu num dia
   * que chegou continua na fila, com o "Dia sem ponto — lançar a ocorrência" inteiro.
   *
   * E o que sai NÃO some calado: a contagem sobe para o resumo da aba. Pendência escondida
   * é o que esta tela passou a existir para não fazer. */
  const diasComPonto = new Set(
    (diario || []).filter((l) => ehVerdadeiro(l.tem_ponto)).map((l) => normData(l.date_ref)).filter(Boolean),
  );
  /* DIA VELHO DEMAIS PARA O LAKE NÃO É DIA QUE NÃO CHEGOU. O pedido entra pela data em que
   * foi CAPTURADO (janela de 70 dias), mas o Transnet deixa pedir ajuste de dia muito mais
   * antigo — e para esses o lake nem é lido (`IDADE_MAXIMA_LAKE`). Eles já têm a trava certa
   * na coluna do alvo ("o dia saiu da base"); esconder aqui seria trocar um aviso por um
   * sumiço. */
  const noLake = (iso) => diasDeIdade(iso) <= IDADE_MAXIMA_LAKE;
  const semPontoNoDia = (r) => noLake(r.iso) && !diasComPonto.has(r.iso);
  const esperandoPonto = registros.filter(semPontoNoDia).length;
  registros = registros.filter((r) => !semPontoNoDia(r));
  // vai na LISTA, não só nas linhas: quando TODOS os casos estão esperando o ponto, não
  // sobra linha nenhuma para carregar o número — e é justamente aí que ele importa.
  registros.esperandoPonto = esperandoPonto;

  registros.forEach((r) => {
    r.diaStatus = statusDoDia(r);
    r.realocados = realocados;
    r.esperandoPonto = esperandoPonto;
  });
  registros.sort((a, b) => b.iso.localeCompare(a.iso) || a.nome.localeCompare(b.nome));
  return registros;
}

/* ────────────────────────── filtros de porta e aba ───────────────────────── */

/**
 * app.js:3322 — A PORTA SE PARTE EM DOIS, NÃO EM TRÊS.
 *
 * `daPorta = r => p5Porta === "aviso" ? temAvisoNoDia(r) : !temAvisoNoDia(r)`. `monitora`
 * escolhe a LISTA (a caixa de entrada é "A decidir" ou "Comunicados"), nunca a porta.
 *
 * O porte tinha partido em TRÊS critérios exclusivos (`aviso: temAviso && monitora`,
 * `coment: temAviso && !monitora`), e o efeito era um buraco: um caso com aviso que não
 * monitora — "bateu ponto fora", "pedir exclusão de batida" — só existia na porta
 * Comunicados, que tem UMA aba. Se ele estivesse em execução pendente, em ponto OK ou em
 * ponto fechado, sumia da tela inteira: nenhuma aba o mostrava.
 */
const daPorta = (porta) => (r) => (porta === "pedido" ? !r.temAviso : r.temAviso);

// app.js:2069 — o Transnet já efetuou/recusou: não existe mais decisão humana.
const resolvidoNoTransnet = (r) => ["EFETUADO", "RECUSADO"].includes(r.desfecho);

/**
 * app.js:2088 — O SELETOR DA ABA "A DECIDIR" TEM DOIS ESTADOS, e isso é a regra.
 *
 * Ele já teve CINCO, e quatro eram desfecho: traziam de volta para a caixa de entrada
 * linhas que já vivem na aba do desfecho. Medido em 27/08: das 34 linhas, 13 pediam
 * decisão e 21 eram recusas já executadas — as MESMAS 21 de "Recusados". Ver duas vezes o
 * mesmo caso é o caminho para decidir duas vezes.
 */
const EIXOS_CONF = [
  ["PENDENTE", "Aguardam a minha decisão"],
  ["TODOS", "Incluir as que o robô ainda não executou"],
];
const porEixoStatus = (eixo) => (r) => (eixo === "TODOS" ? true : !r.decJa);

/**
 * A ÚNICA função que diz QUE LINHAS uma aba tem.
 *
 * Ela alimenta a grade, o contador da porta, o contador da aba, o chip e o "N casos". Não
 * é economia de código: quando a grade e o contador tinham filtros próprios, o chip dizia
 * um número, a aba dizia outro e a lista mostrava um terceiro — e o DP não tinha como
 * saber qual dos três era o trabalho dele.
 */
function linhasDaAba(registros, porta, aba) {
  const base = (registros || []).filter(daPorta(porta));
  // app.js:2077 — a caixa de entrada da decisão do DP. O `!decJa` NÃO entra aqui: ele é o
  // eixo `EIXOS_CONF`, aplicado depois (com "Pendente" como padrão).
  if (aba === "conf")
    return base.filter(
      (r) =>
        ["conf_certo", "conf_errado", "conf", "recusado"].includes(r.situacao) &&
        !resolvidoNoTransnet(r),
    );
  // app.js:2883 — caixa de entrada de "Meus avisos": só o que MONITORA, e nunca o desfecho.
  if (aba === "aguard")
    return base.filter((r) => r.monitora && !SIT_DISC.includes(r.situacaoAviso) && !jaTratado(r));
  // a outra lista da mesma porta: aviso que só informa e não pede ação.
  if (aba === "coment") return base.filter((r) => !r.monitora);
  // CANCELAMENTO É DA PORTA, como todas as outras abas. Ela filtrava `registros` cru, então
  // a aba da porta "Enviamos para ajuste" mostrava cancelamento de todas as portas.
  if (aba === "cancel")
    return base.filter(
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

// app.js:438 — quanto trabalho espera VOCÊ. Sai de `linhasDaAba`, com o MESMO eixo padrão
// da aba (`PENDENTE`): contador que conta outra coisa que a lista é contador que mente.
function contagens(registros) {
  const daEntrada = (porta) =>
    linhasDaAba(registros, porta, ABA_DE_ENTRADA[porta]).filter(porEixoStatus("PENDENTE")).length;
  const porta = { pedido: daEntrada("pedido"), aviso: daEntrada("aviso"), coment: 0 };
  const aba = {};
  Object.entries(ABAS).forEach(([p, lista]) => {
    lista.forEach(([id]) => {
      const n =
        id === ABA_DE_ENTRADA[p]
          ? porta[p]
          : id === "exec"
            ? linhasDaAba(registros, p, id).length
            : 0; // só a fila de entrada e a do robô pedem ação; o resto é desfecho
      aba[`${p}:${id}`] = n;
    });
  });
  return { porta, aba };
}

/* ═══════════════════════════ GRAVAÇÃO DA DECISÃO ═════════════════════════════
 * Campos: os de main.py, um a um. Nada inventado.
 *   confirmar_certos (9498) · confirmar_errados (9664) · marcar_ajustes (9542)
 *   aplicar_marcados (9649) · desfazer_decisao (9519) · _grava_contrato (9467)
 * O QUE ESTA TELA NÃO FAZ: advertir, corrigir o cartão, cancelar a ocorrência.
 * ═══════════════════════════════════════════════════════════════════════════ */

// A CHAVE DA LINHA EXISTENTE MANDA. O upsert casa por (cracha, date_ref); se a linha do
// caso guarda '030061089' e a gente grava '30061089', nasce uma linha irmã e a decisão
// fica invisível para o resto do fluxo.
function chaveDoCaso(reg) {
  const c = reg.caso || {};
  if (txt(c.cracha) && txt(c.date_ref)) return { cracha: c.cracha, date_ref: c.date_ref };
  return { cracha: reg.cracha, date_ref: reg.iso };
}

const idsDoDia = (reg) => (reg.ajustes || []).map((o) => txt(o.id_ocorrencia)).filter(Boolean);

/**
 * main.py:9467 (_grava_contrato) — o CONTRATO da decisão: como o cartão estava e como tem
 * que ficar. CONGELAMENTO: nunca reescreve um contrato que já existe — o primeiro é o que
 * o DP aprovou, o resto é ruído. Falhar aqui não pode derrubar a decisão.
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

/**
 * main.py:9498 (confirmar_certos) — aceite do DIA INTEIRO.
 *
 * O "DEPOIS" SÓ É CONGELADO QUANDO O CARTÃO FECHA EM 2 OU 4 (app.js:193 `contratoDoDia`):
 * "meia projeção não é contrato — é chute, e o bot usaria isso pra REESCREVER o ponto de
 * alguém". Uma simulação de 3 batidas NÃO gera nota, então o `bloqueio` sozinho a deixava
 * passar.
 *
 * ACEITAR O DIA É ACEITAR TUDO, e é por isso que o contrato dele é a projeção de aceitar
 * tudo — calculada AQUI, no clique, e não guardada num campo que outra parte da tela
 * pudesse desenhar como se fosse "o cartão". Quem tem marcação por ocorrência não passa
 * por aqui: passa pelo veredito do caso (`gravarMarcacao`), que grava as marcas e o lado do
 * dia de uma vez.
 */
async function gravarAceite(reg) {
  const agora = agoraISOLocal();
  const ids = idsDoDia(reg);
  const cartaoFecha = [2, 4].includes((reg.depois || []).length);
  const aviso = await gravaContrato(
    reg,
    ids,
    reg.antesTexto,
    reg.bloqueio || !cartaoFecha ? "" : textoBatidas(reg.depois),
  );
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
 * O `depois` NÃO é congelado numa recusa: o ponto fica como estava, e um contrato de
 * "depois" numa recusa viraria plano de execução de um cartão que ninguém aprovou.
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

/**
 * main.py:9542 (marcar_ajustes) — veredito POR OCORRÊNCIA (A:/R: em ajuste_ids).
 * `aceite` fica PENDENTE de propósito: marcar é decidir, lançar é o passo seguinte. É o
 * caminho do dia MISTO, que não cabe em decisão de dia inteiro.
 *
 * O CONTRATO É O CARTÃO QUE O DP VIU, e chega pronto do MONTADOR — não é recalculado aqui
 * (main.py:9573: "o DP viu o cartao ao marcar, e e esse que vale"). Uma segunda simulação
 * com outra entrada é como esta tela acabou com três cartões para o mesmo dia.
 */
/* ══ O VEREDITO É UM ATO SÓ (10/09/2026) ═════════════════════════════════════
 *
 * Marcar por ocorrência gravava `ajuste_ids` com A:/R: e deixava `aceite = "pendente"` de
 * propósito: na ferramenta o segundo passo era o `aplicar_marcados` do lote. E foi essa
 * espera que já custou caro duas vezes — cinco casos de 20/08 ficaram decididos e
 * invisíveis (30017485, 30060990, 30060654, 30061228, 30060192), porque o robô só executa
 * `aceite ∈ (aceito, rejeitado)` e ninguém promoveu a marcação.
 *
 * Agora não existe segundo passo: a tela principal não decide mais nada, então guardar a
 * marcação com o aceite pendente seria guardá-la sem porta de saída OUTRA VEZ. O veredito
 * grava as marcas E o lado do dia no mesmo ato, e o caso cai na "Fila de lançamento".
 *
 * O QUE ELE NÃO TOCA: `correcao_status`. Escrever "dispensada" aqui fecharia a porta da
 * correção que o DP registrou no caso (RICHARD 30061188 07/08) — e é a ausência dela que
 * manda a recusa COM aviso para advertência e correção. O lado do dia segue a regra do
 * `decidir_ajustes`: havendo recusa, a recusa manda. */
async function gravarMarcacao(reg, aceitar, rejeitar, cartaoDoMontador) {
  const ace = (aceitar || []).map(txt).filter(Boolean);
  const rej = (rejeitar || []).map(txt).filter(Boolean);
  if (!ace.length && !rej.length) throw new Error("Nenhuma marcação.");
  const agora = agoraISOLocal();
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: rej.length ? "rejeitado" : "aceito",
    ajuste: rej.length ? "errado" : "certo",
    ajuste_ids: [...ace.map((i) => `A:${i}`), ...rej.map((i) => `R:${i}`)].join(","),
    aceito_em: agora,
    atualizado_em: agora,
  });
  // Sem aceite não há cartão a prometer: recusa não congela `depois`.
  const depois = ace.length ? txt(cartaoDoMontador) : "";
  return gravaContrato(reg, [...ace, ...rej], reg.antesTexto, depois);
}

/* A PROMOÇÃO SEPARADA (main.py:9649 `aplicar_marcados`) SAIU DAQUI em 10/09/2026: com o
 * veredito gravando o aceite no mesmo ato (ver `gravarMarcacao`), não há mais estado
 * intermediário para promover. A lição que ela carregava está lá, onde agora importa. */

/* ── A SAÍDA PARA O QUE O ROBÔ NÃO CONSEGUE (main.py:8289) ────────────────────
 * Até existir isto, um lançamento recusado não tinha fim: voltava à fila em TODA rodada,
 * para sempre (CLAUDINEI 21/08, NELSON 22/08 e SILVANO 21/08 rodaram três vezes cada).
 *
 * SÃO DOIS DESFECHOS, e a diferença é o histórico da pessoa:
 *   lancado_a_mao → alguém foi ao Transnet e lançou. Fecha como CORRIGIDO e por isso
 *                   carimba `correcao_final_em`.
 *   nao_da        → a competência está encerrada. Fecha como PONTO FECHADO e NÃO carimba
 *                   `correcao_final_em`: o ponto não foi corrigido, e dizer que foi seria
 *                   mentir no histórico.
 * Nos dois o texto vai para `ponto_caso.usuario` (corte de 200 caracteres, do Python).
 * Não inventa horário, não toca no cartão e não dispara robô nenhum. */
const FORA_DO_ROBO = {
  lancado_a_mao: {
    status: "corrigido",
    nota: "corrigido à mão pelo DP (fora do robô)",
    fecha: true,
  },
  nao_da: {
    status: "ponto_fechado",
    nota: "o Transnet não aceita este dia — resolvido fora do robô",
    fecha: false,
  },
};

// Só as duas chaves declaradas — nunca o que o Object empresta ("constructor" e companhia
// devolveriam objeto truthy e gravariam correcao_status=undefined).
const desfechoForaDoRobo = (como) =>
  Object.keys(FORA_DO_ROBO).includes(txt(como)) ? FORA_DO_ROBO[txt(como)] : null;

async function gravarForaDoRobo(reg, como, nota) {
  const cfg = desfechoForaDoRobo(como);
  if (!cfg) throw new Error("Diga o que houve: 'lancado_a_mao' ou 'nao_da'.");
  const agora = agoraISOLocal();
  const obs = txt(nota);
  const linha = {
    ...chaveDoCaso(reg),
    correcao_status: cfg.status,
    atualizado_em: agora,
    usuario: `${cfg.nota}${obs ? ` — ${obs}` : ""}`.slice(0, 200),
  };
  if (cfg.fecha) linha.correcao_final_em = agora;
  await upsertDP360("ponto_caso", linha);
  return "";
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

/* ══ "RECUSAR OS PEDIDOS E CORRIGIR O PONTO ASSIM" (app.js:1211 → :5612) ═══════
 *
 * `julgaAcoes` marca `viraAlteracao` quando a ponta JÁ TEM batida no cartão — aí INSERIR
 * não corrige, acrescenta, e o cartão fica com 3 ou 5 batidas (195 casos). A saída é
 * reprojetar os MESMOS pedidos como ALTERAÇÃO e usar o cartão que sai daí como alvo,
 * cravado no Real manual.
 *
 * SÓ QUANDO TODOS SÃO DE FORMA. Com um pedido BOM no meio, projetar só os "vira alteração"
 * joga a correção dele fora e o cartão sai PIOR do que estava (ALEX 30061167 18/08).
 *
 * UM MOTOR SÓ, e é o do montador: `simulaCartao` sobre `antesBruto`, com as refs do cartão.
 *
 * SEM CHAMADOR HOJE (10/09/2026): quem a lia era o card `ComoAlteracao`, que saiu do pop-up
 * (“só veredito”). Fica de pé para a tarefa que leva esse card para a tela principal. */
function projecaoComoAlteracao(reg) {
  const itens = reg?.acoes || [];
  if (!itens.length) return null;
  if (!itens.every((it) => txt(it.viraAlteracao))) return null;
  const cp = reg.cartao || {};
  const refs = [hm2min(cp.esc_entrada), hm2min(cp.esc_saida)].filter((v) => v != null);
  const fechado = txt(cp.status_ponto).toUpperCase() === "SEM_PONTO";
  const pedidos = itens.map((it) => {
    // `temposDoAjuste` lê exatamente esta forma: 'D/ 11:13 P/ 04:30' → [673, 270].
    const hora = `D/ ${txt(it.viraAlteracao)} P/ ${txt(it.hora)}`;
    return { tipo: "Alteração", hora, ajuste: hora, id: txt((it.ids || [])[0]) };
  });
  const sim = simulaCartao({ batidas: reg.antesBruto, pedidos, refs, cartaoFechado: fechado });
  const notas = sim.notas.filter((n) => !String(n).startsWith("_fantasma"));
  return {
    pontos: sim.batidas,
    texto: textoBatidas(sim.batidas),
    notas,
    bloqueio: bloqueioSimulacao(notas),
    fecha: [2, 4].includes(sim.batidas.length),
    jornada: jornadaDoCartao(sim.batidas).liquida,
    semAlmoco: faltaAlmoco(sim.batidas),
    ids: itens.flatMap((it) => it.ids || []).map(txt).filter(Boolean),
  };
}

/**
 * Grava a saída acima. DUAS diferenças deliberadas para o original, e as duas apertam:
 *
 * 1) `correcao_status = "pendente"`, NUNCA `dispensada` (RICHARD 30061188 07/08,
 *    main.py:9565): `dispensada` fecha a porta da CORREÇÃO junto com a da advertência, e
 *    este botão está justamente dizendo "corrige o ponto assim".
 * 2) O `aceite` já vai como `rejeitado`. Lá ele fica pendente porque existe o
 *    `aplicar_marcados` para promover; aqui promover passaria por `gravarRecusa`, que
 *    regravaria `correcao_status` e apagaria a intenção que acabou de ser registrada.
 *
 * O Real manual respeita a MESMA trava da Revisão (`almoco_travado`): num dia de almoço
 * travado o alm_* não é escrito — e a recusa é abortada ANTES do primeiro upsert.
 */
async function gravarComoAlteracao(reg, ids, pontos) {
  const rej = (ids || []).map(txt).filter(Boolean);
  if (!rej.length) throw new Error("Nenhum pedido para recusar.");
  const horas = (pontos || []).map(min2hm);
  if (![2, 4].includes(horas.length))
    throw new Error("O cartão corrigido tem de fechar em 2 ou 4 batidas.");
  const campos =
    horas.length === 4
      ? { entrada: horas[0], alm_saida: horas[1], alm_volta: horas[2], saida: horas[3] }
      : { entrada: horas[0], alm_saida: null, alm_volta: null, saida: horas[1] };
  if (reg.almocoTravado && (campos.alm_saida || campos.alm_volta))
    throw new Error("O almoço deste motorista foi travado pela regra da Revisão.");

  const agora = agoraISOLocal();
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: "rejeitado",
    ajuste: "errado",
    ajuste_ids: rej.map((i) => `R:${i}`).join(","),
    aceito_em: agora,
    correcao_status: "pendente",
    atualizado_em: agora,
  });
  const aviso = await gravaContrato(reg, rej, reg.antesTexto, textoBatidas(pontos));
  try {
    await upsertDP360("ponto_real_manual", {
      cracha: cra8(reg.cracha),
      date_ref: reg.iso,
      ...campos,
      definido_por: quemEstaUsando(),
      // `definido_em` é carimbo de INSTANTE (timestamptz): aqui o UTC é o certo, e é o que
      // o Python grava. O carimbo LOCAL vale para os campos de `ponto_caso`.
      definido_em: agoraUtc(),
    });
  } catch (e) {
    return `recusa gravada, mas o cartão certo NÃO virou Real manual: ${e?.message || e}`;
  }
  return aviso;
}

/* ══ LANÇAR DIA SEM PONTO (main.py:4389) ══════════════════════════════════════
 * Dia com ZERO batida não é correção de ponta: não há ponta. Sem esta saída ele entra no
 * motor de correção, vira um cartão de 4 campos inventado, o Transnet recusa e ele gira na
 * fila PARA SEMPRE (14 dias do WILKER 30061203, medidos em 28/08).
 * É o robô `ocorrencias`, o MESMO da Folgas, com o MESMO CSV. O TIPO é decisão do DP
 * (main.py:4398): nenhuma fonte diz por que a pessoa não bateu ponto. */
const TIPOS_DIA_SEM_PONTO = [
  ["05", "DSR"],
  ["40", "Compensação"],
  ["29", "Curso"],
];
const TIPO_DIA_LBL = Object.fromEntries(TIPOS_DIA_SEM_PONTO);
const rotuloTipoDia = (t) => `${t}-${TIPO_DIA_LBL[txt(t)] || t}`;

// main.py `_ddmm` — o bot preenche a tela do Transnet, que é dd/mm/aaaa.
const ddmmaaaa = (iso) => {
  const v = txt(iso);
  return v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v;
};

// O CSV que o bot lê (csv.DictReader com fieldnames cracha,data,tipo). Mesmo montador da
// Folgas: sem aspas e sem ponto-e-vírgula, porque nenhum dos três tem vírgula.
function csvDiasSemPonto(linhas) {
  return ["cracha,data,tipo", ...linhas.map((l) => `${l.cracha},${l.data},${l.tipo}`)].join("\n");
}

/**
 * RELÊ O CARTÃO ANTES DE LANÇAR (main.py:4415). A tela manda o que está vendo, e o que ela
 * vê pode ter mudado — lançar DSR num dia em que a pessoa trabalhou é o erro que este
 * guarda impede. Barra em vez de descartar em silêncio.
 */
async function conferirDiasSemBatida(regs) {
  const porDia = new Map();
  (regs || []).forEach((r) => {
    if (!r?.iso) return;
    if (!porDia.has(r.iso)) porDia.set(r.iso, new Set());
    const alvo = porDia.get(r.iso);
    alvo.add(txt(r.cracha));
    alvo.add(cra8(r.cracha));
  });
  const comBatida = new Set();
  await emPool([...porDia.entries()], LIMITE_CHAMADAS, async ([iso, crachas]) => {
    const linhas = await lerTudoDP360("ponto_diario", {
      colunas: "cracha,date_ref,todas_batidas,batidas_limpas",
      ordem: "cracha.asc",
      filtros: { cracha: `in.(${[...crachas].join(",")})`, date_ref: `eq.${iso}` },
    });
    linhas.forEach((l) => {
      if (batidasDoCartao(l).length) comBatida.add(`${cra8(l.cracha)}|${normData(l.date_ref)}`);
    });
  });
  const ok = [];
  const barrados = [];
  (regs || []).forEach((r) => (comBatida.has(r.k) ? barrados : ok).push(r));
  return { ok, barrados };
}

/* ───────── as travas que protegem o trabalhador (não são conveniência de tela) ───────── */

// Este dia não comporta decisão NENHUMA — nem em lote, nem no caso aberto.
function motivoSemDecisao(reg) {
  if (reg.decJa) return "já decidido";
  if (resolvidoNoTransnet(reg)) return "o Transnet já resolveu";
  // NÃO EXISTE DECISÃO SOBRE O NADA. Dia sem pedido nenhum não se aceita nem se recusa:
  // gravaria aceite com ajuste_ids vazio e tiraria o caso da fila de advertência em
  // silêncio — o oposto do que o dia pede.
  if (!reg.nAjustes) return "ele não mexeu no ponto — não há pedido para decidir";
  // VENCIDO: segue só a cadeia advertência → correção. Nunca aceite/recusa, nunca lote.
  if (reg.situacaoAviso === "vencido")
    return "aviso vencido — segue só a cadeia advertência → correção";
  // PEDIDO POSTERIOR: ele abriu o pedido DEPOIS de o dia já ter sido julgado, advertido e
  // corrigido. Aceitar aqui DESFAZ a correção já lançada, e re-advertir seria punir duas
  // vezes o mesmo fato. A única saída é recusar (main.py:2222 `recusar_posterior`).
  if (txt(reg.caso?.correcao_final_em) || reg.situacaoAviso === "posterior")
    return "o dia já foi corrigido — pedido posterior só se recusa, nunca se aceita";
  return "";
}

// Por que este dia não pode entrar em decisão de DIA INTEIRO (na linha ou em lote).
function motivoForaDoLote(reg, acao) {
  const base = motivoSemDecisao(reg);
  if (base) return base;
  // DIA MISTO: uma ponta certa e outra errada obriga abrir o caso — a decisão correta é
  // por OCORRÊNCIA, não do dia inteiro.
  if (reg.diaStatus === "misto") return "dia misto — decidir por ocorrência, no caso aberto";
  // Sem simulação confiável não há cartão para prometer ao robô. (Recusar continua podendo:
  // "recusa não precisa de cartão nem de contrato".)
  if (reg.bloqueio) return reg.bloqueio;
  // Recusa de um dia COM aviso pode virar ADVERTÊNCIA: só no caso aberto, à mão.
  if (acao === "rejeitar" && reg.temAviso)
    return "tem aviso no dia — a recusa pode virar advertência: abra o caso";
  return "";
}

/**
 * Por que ESTE dia não pode receber "lançar dia sem ponto" (main.py:4389).
 * NÃO herda `motivoSemDecisao`: este caminho não decide pedido nenhum — o dia justamente
 * NÃO TEM pedido a julgar, e é por isso que ele girava na fila.
 */
function motivoSemLancarDia(reg) {
  if (!reg) return "sem caso";
  if (!reg.semBatida)
    return `o cartão tem batida (${reg.antesTexto || "—"}) — não é dia sem ponto`;
  const oc = reg.ocorrenciaDia;
  if (oc && txt(oc.lancado_em))
    return `o robô já lançou ${rotuloTipoDia(oc.tipo)} neste dia em ${fmtDataHora(oc.lancado_em)}`;
  const c = reg.caso || {};
  if (txt(c.correcao_status) === "ponto_fechado")
    return "competência fechada no Transnet — o robô não consegue lançar este dia";
  if (txt(c.correcao_final_em)) return "este dia já está registrado como corrigido";
  return "";
}

/** Por que ESTE dia não pode receber "recusar os pedidos e corrigir o ponto assim". */
function motivoSemComoAlteracao(reg, proj) {
  const base = motivoSemDecisao(reg);
  if (base) return base;
  if (!proj) return "nem todos os pedidos são 'era alteração' — esta saída vale só quando são todos";
  if (proj.bloqueio) return proj.bloqueio;
  if (!proj.fecha)
    return `a projeção como alteração dá ${proj.pontos.length} batida(s) — o cartão não fecha em 2 ou 4`;
  if (reg.almocoTravado && proj.pontos.length === 4)
    return "o almoço deste motorista foi travado pela regra da Revisão — o Real manual não aceita alm_saida/alm_volta";
  return "";
}

/**
 * A FILA DO BOT, que é a MESMA para executar e para conferir.
 *
 * `bot_ajustes_app.executar_decisoes` (:1203) e `conferir_pendentes` (:640) filtram
 * `ponto_caso` com a MESMA condição: `aceite` ∈ (aceito, rejeitado) e `conferido_em`
 * vazio. Se a tela oferecesse o que o bot descarta, o disparo gastaria um run para não
 * fazer nada e o DP acharia que o robô falhou.
 *
 * `qual` muda só o TEXTO, NUNCA o filtro. O fechamento manual entra AQUI de propósito: ele
 * é o desfecho de um caso que ESTÁ na fila do bot, não uma porta paralela.
 */
function motivoForaDaFilaDoBot(reg, qual) {
  if (!reg) return "sem caso";
  const bruto = reg.caso || {};
  const ciclo = reg.ciclo || {};
  // CICLO REABERTO: o `aceite` guardado é do ciclo VELHO e o bot lê a linha crua. Na
  // conferência seria pior: `--confirmar` carimbaria `conferido_em` = agora, que passa a
  // ser MAIOR que `aviso_enviado_em`, e `_reaberto` deixaria de ver o ciclo novo — o
  // pedido novo sumiria fechado sem ninguém julgar.
  if (reg.reaberto)
    return "ciclo reaberto — chegou aviso novo depois da decisão: decida de novo antes de mandar o robô";
  if (!["aceito", "rejeitado"].includes(txt(ciclo.aceite)))
    return (
      {
        conferir:
          "nenhuma decisão gravada — o bot só confere o que foi decidido: aceite ou recuse primeiro",
        // Fechar à mão não é uma terceira forma de decidir: é o registro do DESFECHO de
        // uma decisão que já existe.
        fechar:
          "nenhuma decisão gravada — fechar à mão registra o DESFECHO de uma decisão, não decide por ela: aceite ou recuse primeiro",
      }[qual] || "nenhuma decisão gravada — decidir e executar são dois passos: aceite ou recuse primeiro"
    );
  if (txt(bruto.conferido_em))
    return (
      {
        conferir: "este dia já foi conferido e fechado (conferido_em) — o bot só olha o que continua aberto",
        fechar: "o robô já conferiu e fechou este dia (conferido_em) — não sobrou nada para fechar à mão",
      }[qual] || "o robô já executou este dia no Transnet — não se repete"
    );
  return "";
}

// Por que ESTE dia não pode ir para o robô EXECUTAR.
function motivoSemExecucao(reg) {
  const base = motivoForaDaFilaDoBot(reg, "executar");
  if (base) return base;
  // dia já provado FECHADO no Transnet só gera escrita recusada (o ALLAN 30060284 levou
  // nove antes de alguém perceber).
  if (txt(reg.caso?.correcao_status) === "ponto_fechado")
    return "competência fechada no Transnet — o robô não consegue lançar este dia";
  const p = planoDaExecucao(reg);
  if (!p.aceitar.length && !p.rejeitar.length && !p.jaResolvidos.length)
    return "nenhuma ocorrência do Transnet ligada a este dia — o robô não teria o que clicar";
  return "";
}

/**
 * Por que ESTE dia não pode ir para o robô CONFERIR.
 * A conferência NÃO clica em ocorrência nenhuma — ela abre o CARTÃO e compara com o
 * contrato. Por isso não tem a última trava da execução: não existe clique para faltar.
 * O que ela ganha é o dia FECHADO: ali o cartão nunca vai bater, o bot já não rebaixa mais
 * o caso (bot_ajustes_app.py:748) e conferir de novo só gasta run.
 */
function motivoSemConferencia(reg) {
  const base = motivoForaDaFilaDoBot(reg, "conferir");
  if (base) return base;
  if (txt(reg.caso?.correcao_status) === "ponto_fechado")
    return "dia já provado FECHADO no Transnet — a leitura nunca vai bater e o bot não rebaixa mais o caso";
  return "";
}

/**
 * Por que ESTE dia não pode ser fechado À MÃO (main.py:8289).
 * O que NÃO herda da execução: "nenhuma ocorrência ligada" (aqui ninguém clica em nada — a
 * pessoa JÁ resolveu fora, e barrar por isso prenderia justamente o caso que este botão
 * existe para soltar) e "competência fechada" (que é a razão de existir do `nao_da`).
 * O que GANHA: caso que já tem desfecho gravado não se fecha de novo — reescrever apagaria
 * a nota de histórico do primeiro fechamento.
 */
function motivoSemFechamentoManual(reg) {
  const base = motivoForaDaFilaDoBot(reg, "fechar");
  if (base) return base;
  const bruto = reg.caso || {};
  if (txt(bruto.correcao_status) === "ponto_fechado")
    return "este dia já está registrado como ponto fechado — o desfecho já está gravado";
  if (txt(bruto.correcao_final_em))
    return "este dia já está registrado como corrigido — o desfecho já está gravado";
  return "";
}

/* ═════════════════ EXECUÇÃO — só o que JÁ FOI DECIDIDO E GRAVADO ══════════════ */

/**
 * O que o robô vai clicar, contado ANTES do disparo (espelho de
 * `bot_ajustes_app.executar_decisoes`). `ajuste_ids` com prefixo A:/R: aponta as
 * ocorrências exatas que o DP viu — é o que permite o dia MISTO. Sem prefixo, o `aceite`
 * do caso vale para todas. O que o Transnet já resolveu saiu da grade: não é clique.
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
 * app.js:97 — AS MARCAS JÁ GRAVADAS, ocorrência por ocorrência. Map id → "A" | "R".
 *
 * Lição de 22/08: até então só voltava a marca de dia JÁ APLICADO. Quem marcava um dia
 * misto e reabria o caso via a PRÉ-MARCAÇÃO AUTOMÁTICA no lugar da própria escolha — e
 * concluía, com razão, que nada tinha sido gravado. Gravou; a tela é que não mostrava.
 *
 * IRMÃ de `planoDaExecucao`: esta diz O QUE O DP MARCOU (por isso ignora id sem prefixo
 * num dia pendente), aquela diz O QUE O ROBÔ VAI CLICAR (por isso completa com o `aceite`).
 */
function marcasGravadas(reg) {
  const ciclo = reg?.ciclo || {};
  const lado = { aceito: "A", rejeitado: "R" }[txt(ciclo.aceite)] || "";
  const marcas = new Map();
  txt(ciclo.ajuste_ids)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .forEach((b) => {
      const p = b.slice(0, 2);
      if (p === "A:" || p === "R:") marcas.set(b.slice(2), p === "A:" ? "A" : "R");
      else if (lado) marcas.set(b, lado);
    });
  return marcas;
}

/**
 * app.js:272 (`seloLancar`) — O DIA ESTÁ MARCADO E AINDA NÃO FOI LANÇADO.
 *
 * Devolve `{ nA, nR, lado }` ou null. Era o estado do meio — A:/R: gravado e `aceite` ainda
 * pendente — e desde 10/09/2026 o veredito não o produz mais: ele grava as marcas e o lado
 * do dia no mesmo ato. Sobrevive para LER o que a ferramenta do PC marcou e ainda não
 * lançou, que continua chegando por ela.
 *
 * `ciclo`, não `caso`: no ciclo reaberto as marcas do ciclo velho não valem.
 */
function selosDaMarcacao(reg) {
  const c = reg?.ciclo || {};
  if (["aceito", "rejeitado"].includes(txt(c.aceite))) return null; // já aplicado
  const ids = txt(c.ajuste_ids).split(",").map((x) => x.trim()).filter(Boolean);
  const nA = ids.filter((x) => x.startsWith("A:")).length;
  const nR = ids.filter((x) => x.startsWith("R:")).length;
  if (!nA && !nR) return null;
  // o dia inteiro segue o lado marcado; havendo recusa, a recusa manda (é ela que abre
  // advertência/correção) — mesma regra do `decidir_ajustes`.
  return { nA, nR, lado: nR ? "rejeitar" : "aceitar" };
}

/**
 * O ESCOPO DO DISPARO — o input `casos` do workflow.
 *
 * `ajustes.yml` compara o input com "[]" e, se for vazio, roda SEM `--casos`: a FILA
 * INTEIRA. Nos DOIS modos (as duas ramificações do yml têm o mesmo `if`). Por isso esta
 * função devolve "" em vez de "[]" quando não dá para montar a chave: mandar escopo vazio
 * não é "não filtrar", é rodar tudo. Foi um clique sem escopo que processou 34 casos
 * indevidos em 24/08.
 *
 * E se UMA das linhas não tiver chave, o escopo INTEIRO é recusado — descartar em silêncio
 * esconderia de quem clicou que uma das pessoas marcadas não vai ser tocada.
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

const casosDoRegistro = (reg) => casosDeRegistros([reg]);

// O rótulo honesto do que o robô vai fazer — nunca promete a carta de advertência nem a
// correção do cartão, que são outros dois robôs.
function rotuloDaExecucao(reg) {
  const ciclo = reg?.ciclo || {};
  if (txt(ciclo.aceite) === "aceito") return "Aceitar no Transnet";
  const dispensada = txt(ciclo.correcao_status) === "dispensada";
  if (reg?.temAviso && !dispensada) return "Recusar no Transnet (abre advertência e correção)";
  return "Recusar no Transnet (encerra)";
}

// app.js:2492 — o que vem A SEGUIR, dito com todas as letras.
function proximoPassoDoCaso(reg) {
  const c = reg.caso || {};
  const exec = Boolean(txt(c.conferido_em) || txt(c.correcao_final_em));
  const aceite = txt(c.aceite);
  const dispensada = txt(c.correcao_status) === "dispensada";
  if (exec) {
    return reg.temAviso && aceite === "rejeitado" && !dispensada && !txt(c.advertencia_enviada_em)
      ? "Próximo passo: enviar a advertência e corrigir o ponto."
      : "Ciclo encerrado — nada pendente neste dia.";
  }
  if (aceite === "rejeitado" && !reg.temAviso)
    return "Próximo passo: enviar o AVISO de correção e dar 48h. Sem aviso não existe advertência.";
  if (aceite && aceite !== "pendente")
    return "Próximo passo: o bot executar no Transnet e travar o dia.";
  if (selosDaMarcacao(reg))
    return "Próximo passo: marcar “lançar” na grade e usar “Aplicar decisões” — a marcação já está gravada.";
  return "Próximo passo: decidir os pedidos.";
}

// app.js `gordDe` — GORDURA é o tempo fora do alvo que CUSTA: entrar antes, sair depois.
// Entrar depois ou sair antes é ele trabalhando de graça e não entra na conta.
function gorduraContraAlvo(batidas, alvoEntrada, alvoSaida) {
  const b = (batidas || []).filter((t) => t != null).slice().sort((x, y) => x - y);
  const aE = hm2min(alvoEntrada);
  const aS = hm2min(alvoSaida);
  if (!b.length || (aE == null && aS == null)) return null;
  const ent = aE != null ? Math.max(0, aE - b[0]) : 0;
  const sai = aS != null ? Math.max(0, b[b.length - 1] - aS) : 0;
  return { total: ent + sai, ent, sai };
}

/* ─────────────────────────── peças visuais reusáveis ─────────────────────── */

// cor lógica do domínio → pílula da ferramenta (dp360.css .dp-pill).
const PILL = { ok: "ok", erro: "danger", alerta: "warn", neutro: "mute", accent: "accent" };

// app.js:166 — na ferramenta a situação pinta a LINHA INTEIRA: a cor da linha É a
// informação, não enfeite. Puro visual: nada aqui decide nada.
const LINHA_SIT = {
  conf_certo: "row-ok", conf_errado: "row-sem", conf: "row-sug",
  ok: "row-ok", advertido: "row-sem", corrigido: "row-ok",
  exec_pendente: "row-sug", recusa_exec_pendente: "row-sug",
  ponto_fechado: "row-sem", recusado: "row-sem", aguardando: "row-sug",
  comunicado: "", posterior: "row-sug", ajustou: "row-ok",
  ajustou_certo: "row-ok", ajustou_errado: "row-sem", ajustou_julgar: "row-sug",
  vencido: "row-sem", cancelado: "",
};

// Ciclo reaberto pinta de azul: é aviso novo por cima, não desfecho.
function classeDaLinha(reg, porta) {
  if (reg.reaberto) return "row-msg";
  const chave =
    porta === "aviso" && reg.situacaoAviso in LINHA_SIT ? reg.situacaoAviso : reg.situacao;
  return LINHA_SIT[chave] || "";
}

const PILHA = { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3 };
const FILA = { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" };
const MINI = { fontSize: 11, fontWeight: 600 };
const ROTULO_CARD = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" };

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

// O passo que AINDA NÃO EXISTE. Na ferramenta um passo indisponível simplesmente não é
// desenhado; aqui ele fica, apagado, só onde a ausência seria lida como bug — e o motivo
// mora na dica, em UMA linha. Botão morto com quatro linhas de `title` é o que empurrava a
// decisão para fora da tela.
function BotaoExecucao({ children, tom = "neutro", motivo }) {
  const cor = { ok: "var(--dp-ok-ink)", erro: "var(--dp-danger-ink)" }[tom];
  return (
    <button type="button" disabled title={motivo} className="dp-btn" style={cor ? { color: cor } : undefined}>
      {children}
    </button>
  );
}

/* ───────────────────────────── cartões desenhados ────────────────────────── */

const SLOT_ES = ["E", "S", "E", "S"];

/**
 * OS QUATRO SLOTS SÃO UMA GRADE DE QUATRO COLUNAS, NÃO UMA FILA QUE QUEBRA.
 * Com `flex-wrap` quatro chips de 5 caracteres não cabiam na coluna: quebravam três em
 * cima e um embaixo, e cada linha da tabela ficava com uma altura diferente. Grade de
 * `1fr` nunca quebra e mantém o mesmo slot na MESMA posição horizontal em todas as linhas
 * — então "Ponto (bateu)" e "Alvo" leem-se de cima a baixo.
 * `mudou` = o slot que o alvo muda (destacado com `.dp-chip.new`, a marca da Gordura).
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

/**
 * O CARTÃO INTEIRO, batida por batida — e é assim de propósito.
 * "Devolver só entrada e saída ESCONDIA as batidas do meio, e aí aceitar e recusar
 * pintavam o mesmo cartão — o DP não via o efeito da própria decisão" (app.js:11). E o
 * resultado que ESTOURA os quatro campos é justamente o que precisa aparecer.
 * `contra` = o cartão de hoje; batida que não está lá sai marcada.
 */
function CartaoInteiro({ batidas, contra = null, vazio = "—" }) {
  const b = (batidas || []).filter((t) => t != null);
  if (!b.length) return <span className="dp-chip none">{vazio}</span>;
  const conhecidas = contra && contra.length ? new Set(contra) : null;
  return (
    <span style={FILA}>
      {b.map((t, i) => (
        <span
          key={`${t}-${i}`}
          className={`dp-chip${conhecidas && !conhecidas.has(t) ? " new" : ""}`}
          title={conhecidas && !conhecidas.has(t) ? "batida que o ajuste acrescenta" : undefined}
        >
          {min2hm(t)}
        </span>
      ))}
    </span>
  );
}

// app.js depoisFlags — o que sumiu do cartão sai riscado.
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

/**
 * O ALVO, DESENHADO NUM LUGAR SÓ.
 *
 * Tudo que mostra alvo nesta tela passa por aqui — a coluna da grade, o caso aberto e o
 * papel. Antes eram quatro desenhos diferentes, e um deles chegava a escrever "E não
 * pedido · S não pedido", que não é cartão nenhum.
 * Slot destacado = veio do pedido; slot normal = herdado do cartão de hoje (o robô não
 * toca nele). Ver `cartaoFinal`.
 */
function CartaoAlvo({ alvo, legenda = false }) {
  // O QUE ESTÁ TRAVANDO, DITO NA LINHA. Antes a coluna mostrava só a pílula do defeito
  // (ou um traço), e para saber por quê era preciso abrir o caso. O motivo é curto: cabe
  // ao lado.
  if (alvo?.naoFecha)
    return (
      <span style={PILHA}>
        <span className="dp-pill warn" title="O cartão que sai deste pedido não é um cartão possível (montador.py `valida`), e o robô não lança cartão impossível.">
          {alvo.problema || "cartão impossível"}
        </span>
        <span className="dp-faint" style={MINI}>
          {alvo.trava || "sem régua publicada para completar — decida por ocorrência"}
        </span>
      </span>
    );
  if (!alvo?.temAlvo)
    return (
      <span style={PILHA}>
        <span className="dp-pill mute" title="Não há cartão final a desenhar para este dia.">
          sem cartão
        </span>
        <span className="dp-faint" style={MINI}>
          {alvo?.trava || "o pedido não produziu batida neste dia"}
        </span>
      </span>
    );
  return (
    <span
      style={legenda ? PILHA : undefined}
      title={
        {
          aviso: "DIA RECUSADO: quem lança é a cadeia de correção, e o que ela lança é o ALVO que o aviso congelou. Os horários destacados são os que mudam.",
          pedido: "O cartão como fica quando o pedido for ACEITO — é o que o robô `ajustes` deixa no Transnet, clicando aceitar na ocorrência. Se o dia for RECUSADO, quem vale é o alvo publicado pela Revisão.",
          "revisão publicada":
            "O cartão que a CORREÇÃO lança: o alvo publicado pela Revisão para este dia (ponto_diario.alvo_*), com o Real manual do DP por cima quando existe. Ele já preserva a ponta que está dentro da régua — só a ponta errada muda. O alvo congelado no aviso aparece embaixo, para comparar.",
          revisão:
            "O PEDIDO NÃO FECHA SOZINHO — aplicá-lo ao pé da letra deixaria o cartão impossível. Então vale o ALVO: as quatro sugestões que a Revisão apurou e publicou para este dia. Não foi isto que o colaborador pediu; é o que o dia tem de virar.",
          "Real manual":
            "O PEDIDO NÃO FECHA SOZINHO. Então vale a régua que o DP cravou à mão na Revisão (ponto_real_manual) — o topo da cascata, acima da sugestão da view.",
          cartão: "O pedido não muda nada neste cartão — ele fica como está.",
        }[alvo.fonte] ||
        "O cartão como fica se o pedido for aceito. Ainda não há alvo congelado: ele vira definitivo quando a decisão for gravada."
      }
    >
      <LinhaCartao horas={alvo.slots} mudou={alvo.mudou} />
      {alvo.fonte === "revisão" || alvo.fonte === "Real manual" ? (
        <span className="dp-pill mute" style={MINI} title="montador.py:387 — cartão incompleto reparado pela régua do dia.">
          {alvo.fonte === "revisão" ? "alvo da Revisão" : "alvo do Real manual"}
        </span>
      ) : null}
      {legenda ? (
        <span className="dp-faint" style={MINI}>
          {{
            aviso: "dia recusado — a correção lança o alvo congelado no aviso · destacado = o que muda",
            "revisão publicada": "é o que a correção lança · alvo publicado pela Revisão (a ponta que já está certa fica)",
            revisão: "o pedido não fecha o cartão — vale a régua que a Revisão publicou para o dia",
            "Real manual": "o pedido não fecha o cartão — vale o Real manual que o DP cravou",
            cartão: "o pedido não muda nada · o cartão fica como está",
          }[alvo.fonte] ||
            "como fica se o pedido for ACEITO · destacado = o que muda · normal = fica como está"}
        </span>
      ) : null}
      {legenda ? <AlvoDoAviso alvo={alvo} /> : null}
    </span>
  );
}

/* O ALVO DO AVISO, EM LINHA PRÓPRIA (09/09/2026).
 *
 * Ele não é mais o cartão final — aceitar o pedido lança O QUE ELE PEDIU —, mas continua
 * sendo o que a cadeia de advertência/correção lançaria neste dia. Some quando o dia foi
 * recusado (aí ele JÁ é o cartão desenhado acima) e quando bate com o final, para não
 * desenhar duas vezes o mesmo cartão. */
function AlvoDoAviso({ alvo }) {
  if (!alvo?.alvoAviso || !alvo.difereDoAviso || alvo.fonte === "aviso") return null;
  return (
    <span
      style={{ ...FILA, marginTop: 2 }}
      title="O que PEDIMOS no aviso (ponto_caso.alvo_*), congelado no dia do envio. A correção lança o alvo PUBLICADO pela Revisão, que é recalculado — quando os dois divergem, confira antes: a advertência cobra o horário do aviso."
    >
      <span className="dp-faint" style={MINI}>pedimos no aviso:</span>
      <LinhaCartao horas={alvo.alvoAviso} />
    </span>
  );
}

// app.js:3819 (pontasChips) — o veredito POR PONTA. As pontas são INDEPENDENTES: uma nunca
// anula a outra, e o dia misto não entra em decisão de dia inteiro.
function PontasES({ reg }) {
  const chip = (lado, st, cobr) => {
    if (!cobr && !st) return null;
    const L = lado === "entrada" ? "E" : "S";
    if (st === "certo")
      return <Selo key={L} cor="ok" titulo={`${lado}: certo — aceitar`}>{L} ✓</Selo>;
    if (st === "errado")
      return <Selo key={L} cor="erro" titulo={`${lado}: errado — rejeitar`}>{L} ✗</Selo>;
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
      return <Selo cor="alerta" quebra titulo={reg.bloqueio}>• não dá para julgar</Selo>;
    if (reg.veredito === "certo")
      return <Selo cor="ok" titulo={reg.baseVeredito}>✓ certo</Selo>;
    if (reg.veredito === "errado")
      return <Selo cor="erro" titulo={reg.baseVeredito}>✗ errado</Selo>;
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

/* ────────────────────────── células das grades ───────────────────────────── */

/**
 * ══ A COLUNA "DECISÃO" — UM LOTE SÓ, TRÊS ESTADOS ═════════════════════════════
 *
 * A ferramenta tem UM estado de lote (`DEC`, app.js:208) e a linha mostra exatamente um
 * dos três estados do ciclo. Esta tela tinha DOIS mecanismos que se ignoravam (`selIds` na
 * ✔ e `marcasLote` no ⌁) e quatro botões na mesma barra, então "marcar sugestão" enchia um
 * estado e "aceitar marcados" consumia o outro.
 *
 *   1. JÁ DECIDIDO      → selo (app.js:250 `decSelo`). Enviado = travado; aguardando bot =
 *                         ainda dá para executar ou desfazer.
 *   2. JÁ MARCADO       → ✓N ✗N + a caixinha "lançar" (app.js:272 `seloLancar`). É o estado
 *                         do meio, e era ele que não tinha porta de saída.
 *   3. A DECIDIR        → as duas caixinhas exclusivas (app.js:241 `decCheckboxes`).
 *
 * A caixinha "lançar" NASCE SEMPRE DESMARCADA. Cheguei a ligá-la sozinha para quem voltava
 * marcado do caso aberto e o DP cortou na hora (24/08): "quando entro a flag de lançar já
 * está, não pode — tem que estar apenas no que eu colocar". Marcar no caso é dizer O QUE
 * cada pedido merece; marcar aqui é dizer QUAIS dias vão nesta rodada.
 */
/* A ÚLTIMA COLUNA DA FILA É AÇÃO, NÃO VEREDITO (10/09/2026). O veredito tem coluna própria
 * ao lado; repeti-lo aqui era a mesma resposta em dois lugares. O que só esta coluna sabe é
 * o passo: já subiu ao Transnet, ou ainda espera o disparo — e, enquanto espera, o Desfazer.
 * As caixinhas de aceitar/rejeitar e o "lançar" saíram: quem decide é o caso. */
function CelulaDecisao({ reg, gravando, aoAbrir, aoDesfazer }) {
  if (reg.decJa)
    return reg.decJa.subiu ? (
      <span style={PILHA}>
        <Selo cor="ok" titulo={`O bot carimbou conferido_em em ${reg.decJa.quando} — o dia está travado. Para mexer, use Desfazer antes de conferir.`}>
          🔒 subiu ao Transnet
        </Selo>
        <span className="dp-faint" style={MINI}>{reg.decJa.quando}</span>
      </span>
    ) : (
      <span style={PILHA}>
        <span className="dp-faint" style={MINI}>
          aguardando lançamento · marque a ✔ e use “Executar marcados”
        </span>
        <BotaoAcao
          titulo="Desfaz a decisão e devolve o caso para “A decidir” (main.py:desfazer_decisao). Só vale enquanto o bot não executou."
          onClick={(e) => { e.stopPropagation(); aoDesfazer(reg); }}
          disabled={gravando}
        >
          ↩ Desfazer
        </BotaoAcao>
      </span>
    );

  const marcado = selosDaMarcacao(reg);
  return (
    <div style={PILHA}>
      <span className="dp-faint" style={MINI}>
        {marcado ? "marcado por ocorrência — grave o veredito no caso" : "sem veredito — decida no caso"}
      </span>
      <button
        type="button"
        className="dp-btn"
        onClick={(e) => { e.stopPropagation(); aoAbrir(reg); }}
        title="Abre o caso: é lá que o cartão se monta e o veredito é gravado."
      >
        abrir o caso ▸
      </button>
    </div>
  );
}

// app.js:3972 — PRAZO = 48h desde `aviso_enviado_em`.
/* RESPONDEU OU NÃO — a pergunta que a coluna "Situação" não respondia (10/09/2026).
 *
 * Vencido SEM resposta e vencido TENDO respondido pedem coisas opostas do DP: o primeiro
 * segue para advertência e correção sem nada a julgar; o segundo tem pedido para julgar. Os
 * dois apareciam como "Vencido", e a diferença só saía abrindo o caso.
 *
 * A pílula diz a resposta (e quantos ajustes vieram); o prazo desce para a linha de baixo,
 * onde é contexto — e não compete com ela. */
function CelulaResposta({ reg }) {
  const n = reg.nAjustes || 0;
  // SEM AVISO NOSSO NÃO EXISTE "RESPONDEU": na porta do pedido ele mandou o ajuste por
  // conta, e não há prazo correndo. Dizer "respondeu" ali seria inventar uma pergunta
  // nossa que nunca foi feita.
  if (!reg.temAviso)
    return (
      <span style={PILHA}>
        <Selo titulo="Ele mandou o ajuste por conta — não houve aviso nosso neste dia, então não há prazo de 48h correndo.">
          pedido dele
        </Selo>
        <span className="dp-faint" style={MINI}>sem aviso nosso</span>
      </span>
    );
  return (
    <span style={PILHA}>
      <Selo cor={n ? "accent" : "erro"} titulo={n
        ? `${n} ajuste(s) capturado(s) do app neste crachá+dia — há pedido para julgar.`
        : "Ele não mexeu no ponto depois do aviso. Sem pedido não há o que julgar: o dia segue para advertência e correção."}>
        {n ? `respondeu · ${n} ajuste${n > 1 ? "s" : ""}` : "não respondeu"}
      </Selo>
      <span className="dp-faint" style={MINI}><CelulaPrazo reg={reg} /></span>
    </span>
  );
}

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
    return <Selo cor="alerta" titulo="Ele mexeu no ponto, mas só depois das 48h">ajustou fora do prazo</Selo>;
  if (["ajustou", "ajustou_certo", "ajustou_errado", "ajustou_julgar"].includes(reg.situacaoAviso))
    return <Selo cor="ok">ajustou a tempo</Selo>;
  if (reg.restam > 0)
    return <Selo cor="alerta">faltam <span className="dp-num">{tempoHoras(reg.restam)}</span></Selo>;
  return <Selo cor="erro">vencido há <span className="dp-num">{tempoHoras(-reg.restam)}</span></Selo>;
}

function CelulaAjustes({ reg, aoAbrir }) {
  // stopPropagation: a linha inteira também abre o caso; sem isso o clique dispara duas
  // vezes e o painel abre e fecha no mesmo gesto.
  const clique = (e) => { e.stopPropagation(); aoAbrir(); };
  if (!reg.nAjustes)
    return (
      <button type="button" onClick={clique} className="dp-btn"
        title="Ele não mexeu no ponto depois do aviso. Abra para ver o caso.">
        não mexeu
      </button>
    );
  const cor =
    { certo: "var(--dp-ok-ink)", errado: "var(--dp-danger-ink)" }[reg.diaStatus] ||
    "var(--dp-warn-ink)";
  return (
    <button type="button" onClick={clique} className="dp-btn" style={{ color: cor }}
      title="Abrir a mesa do dia: cada ajuste contra o alvo">
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

/* ══════════════ O POP-UP DO CASO É SÓ VEREDITO (desenho aprovado pelo dono) ════════════
 *
 * UMA PERGUNTA, UM LUGAR. O pop-up responde "este pedido vale?" e mais nada: robô, executar,
 * conferir, advertir, cancelar aviso e cancelar pedido saíram daqui e vão para a TELA
 * PRINCIPAL. Enquanto os dois viviam no mesmo modal, decidir e lançar ficavam a um clique de
 * distância — e o clique errado mexe no ponto de alguém.
 *
 * As peças abaixo são as do desenho, e só elas:
 *   ESQUERDA  · `ItemAcao`     — uma ocorrência: horário, o que é, o veredito do motor, os
 *                                dois rádios (aceitar/rejeitar; "não marcar" não existe mais)
 *             · `CravarAMao`   — as duas pontas à mão
 *   DIREITA   · `BlocoPonta`   — um compartimento: rótulo, horário final, DE ONDE VEIO e a
 *                                distância do alvo
 *             · `CompletarComAlvo` / `ResumoDoCartao`
 * A conta é do `montaCompartimentos` (`vereditoCartao.js`), testado em Node. Nada aqui
 * calcula horário.
 */

// "inserir na entrada" — o pedido dito como o DP fala, não como o lake grava.
const oQuePediu = (it) => {
  const t = txt(it?.tipo).toLowerCase();
  const verbo = t.startsWith("inser")
    ? "inserir"
    : t.startsWith("exclus")
      ? "excluir"
      : t.startsWith("altera")
        ? "alterar"
        : txt(it?.tipo) || "ocorrência sem tipo";
  const onde = txt(it?.ponta).toLowerCase();
  return onde ? `${verbo} na ${onde}` : verbo;
};

/**
 * A PÍLULA DO VEREDITO. O número é do MOTOR (`julgaAcoes.dif`) — a distância que ELE mediu
 * contra o alvo daquela ponta —, nunca uma conta desta tela: "17 min além do alvo" é o que o
 * HENDESON 30060848 · 02/09 pediu na saída (02:10 contra o alvo 25:53).
 * As ressalvas do motor (órfã, redundante, sem alvo na ponta) vêm na frente do número: elas
 * mudam o QUE aceitar significa, não só o quanto ele errou.
 */
function pilulaDoVeredito(it) {
  if (it?.ok === true)
    return { cor: "ok", rotulo: it.excl ? "tirou o horário errado" : "bate com o alvo" };
  if (it?.ok === false) {
    if (it.orfao) return { cor: "danger", rotulo: "a batida de origem não está no cartão" };
    if (it.redundante) return { cor: "danger", rotulo: `já tem ${it.redundante} no cartão` };
    if (it.dif != null) return { cor: "danger", rotulo: `${it.dif} min além do alvo` };
    return { cor: "danger", rotulo: "não bate com o alvo" };
  }
  return { cor: "warn", rotulo: it?.semAlvoPonta ? "esta ponta não tem alvo" : "não dá para julgar" };
}

/**
 * UMA OCORRÊNCIA — e duas saídas, não três.
 *
 * "Não marcar" saiu (decisão do dono): ele era o estado em que o DP olhava o caso e não
 * respondia, e o dia ficava marcado pela metade. Aqui toda ocorrência sai aceita ou
 * recusada — e o botão do rodapé fica travado enquanto sobrar uma sem resposta.
 */
function ItemAcao({ item, marca, aoMarcar, travado, motivo }) {
  const p = pilulaDoVeredito(item);
  const detalhe = [
    item.ponta ? `ponta: ${item.ponta}` : "",
    item.alvo ? `alvo ${item.alvo}` : "",
    item.dif != null ? `${item.dif} min de diferença` : "",
    item.menos ? "pediu MENOS: abriu mão de tempo" : "",
    item.viraAlteracao ? `o certo seria ALTERAR a batida ${item.viraAlteracao}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className={`oc-item${travado ? " oc-item-off" : ""}`}>
      <div style={FILA}>
        <span className="dp-mono dp-num oc-vd-hora-ped">{item.hora || "—"}</span>
        <span style={{ fontWeight: 600 }}>{oQuePediu(item)}</span>
        {item.n > 1 ? (
          <Selo titulo="pedido reenviado — as ocorrências repetidas vão na MESMA marca">×{item.n}</Selo>
        ) : null}
        <span className={`dp-pill ${p.cor}`} title={detalhe || undefined}>{p.rotulo}</span>
      </div>
      <div style={{ ...FILA, marginTop: 5 }}>
        {[
          ["A", "aceitar", "ok"],
          ["R", "rejeitar", "x"],
        ].map(([v, rot, cls]) => (
          <label
            key={v}
            className={`oc-dec-cb ${cls}${marca === v ? " on" : ""}${travado ? " off" : ""}`}
            title={travado ? motivo || "decisão já gravada" : undefined}
          >
            <input type="radio" disabled={travado} checked={marca === v} onChange={() => aoMarcar(v)} />
            {rot}
          </label>
        ))}
        <span className="dp-faint" style={MINI}>
          {item.ids?.length ? `ocorrência ${item.ids.join(", ")}` : "sem id de ocorrência"}
        </span>
      </div>
      {motivo ? <div className="oc-vd-motivo">🔒 {motivo}</div> : null}
    </li>
  );
}

/* ── CRAVAR À MÃO — as duas pontas, e nada além delas ─────────────────────────────
 *
 * ENTRA SOZINHO AO DIGITAR: não há botão "Usar" porque não há segundo estado — o que está no
 * campo é o que está no cartão ao lado, imediatamente.
 *
 * O miolo NÃO tem campo: no motorista ele é a refeição travada, e no interno é o montador
 * que o encaixa.
 *
 * E ELE NÃO GRAVA `ponto_real_manual`. O que ele faz é formar o cartão que o botão do rodapé
 * congela como contrato (`ponto_depois`). Cravar de verdade na régua do dia é no Cartão do
 * dia — o botão está no topo deste pop-up.
 */
function CravarAMao({ valores, criticas, travado, aoMudar }) {
  return (
    <div className="oc-vd-mao">
      <div className="oc-vd-mao-t">✎ Cravar à mão</div>
      <div className="oc-vd-mao-campos">
        {[
          ["entrada", "entrada"],
          ["saida", "saída"],
        ].map(([chave, rot]) => (
          <label key={chave} className="oc-vd-campo">
            <span>{rot}</span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="2200"
              maxLength={5}
              className={criticas[chave] ? "ruim" : ""}
              disabled={travado}
              value={valores[chave] || ""}
              onChange={(e) => aoMudar(chave, e.target.value)}
            />
            <em>{criticas[chave] || ""}</em>
          </label>
        ))}
      </div>
      <div className="dp-faint" style={MINI}>
        entra no cartão ao digitar · aceita <span className="dp-mono">2200</span> e{" "}
        <span className="dp-mono">22:00</span> · não grava régua: forma o cartão do contrato
      </div>
    </div>
  );
}

/* ── UM COMPARTIMENTO DO CARTÃO ───────────────────────────────────────────────────
 * O horário grande, a pílula que diz DE ONDE ELE VEIO e, embaixo, a distância do alvo. A
 * pílula é o ponto do desenho: o DP não pode olhar um cartão fechado sem saber se aquela
 * hora é a batida do colaborador, o que ele pediu, o alvo ou o que o DP mesmo cravou. */
function BlocoPonta({ bloco, aoDesfazer }) {
  const o = ORIGENS[bloco.origem] || ORIGENS.batida;
  const d = bloco.dist;
  return (
    <div
      className={`oc-vd-bloco${bloco.origem === "falta" ? " falta" : ""}${bloco.travado ? " travado" : ""}`}
    >
      <div className="oc-vd-bloco-r">{bloco.rotulo}</div>
      <div className="oc-vd-bloco-h dp-mono dp-num">{bloco.hora || "—"}</div>
      <div style={FILA}>
        <span className={`dp-pill ${o.cor}`} title={o.ajuda}>{o.rotulo}</span>
        {bloco.porClique ? (
          <button
            type="button"
            className="oc-vd-undo"
            title="tirar o alvo desta ponta e deixá-la vazia de novo"
            onClick={aoDesfazer}
          >
            ↩
          </button>
        ) : null}
      </div>
      <div className="oc-vd-bloco-d">
        {!bloco.hora
          ? bloco.alvo
            ? `alvo ${bloco.alvo}`
            : "sem alvo"
          : d == null
            ? "sem alvo para medir"
            : d === 0
              ? "no alvo"
              : `${d > 0 ? "+" : "−"}${Math.abs(d)} min`}
      </div>
    </div>
  );
}

/* ── COMPLETAR A PONTA VAZIA COM O ALVO ───────────────────────────────────────────
 * Só na ponta que FALTA, e só quando existe alvo publicado para ela. Não é o que o
 * colaborador pediu: é o que o dia tem de virar (é a régua que a Revisão apurou). */
function CompletarComAlvo({ v, travado, aoCompletar }) {
  const pontas = COMPARTIMENTOS.filter((c) => v.completavel[c.chave]);
  if (!pontas.length) return null;
  return (
    <div className="oc-vd-completar">
      {pontas.map((c) => (
        <BotaoAcao
          key={c.chave}
          disabled={travado}
          titulo="Põe o alvo publicado pela Revisão nesta ponta (ponto_diario.alvo_*, com o Real manual do DP por cima). NÃO é o que o colaborador pediu — é o que o dia tem de virar."
          onClick={() => aoCompletar(c.chave)}
        >
          + Completar {c.rotulo} com o alvo ({v.completavel[c.chave]})
        </BotaoAcao>
      ))}
    </div>
  );
}

/* ── A CAIXA DE RESUMO ────────────────────────────────────────────────────────────
 * Verde quando o cartão fecha (em 2 ou 4, a régua do `validaCartao`), com a jornada líquida
 * e a duração do almoço. Vermelha quando não fecha, dizendo QUAL PONTA FALTA — "não fecha"
 * sozinho não diz a ninguém o que fazer.
 * E no dia SEM PEDIDO ela troca de frase: ali não há nada a aceitar, então o cartão que está
 * na tela é simplesmente o que a correção vai lançar. */
function ResumoDoCartao({ v }) {
  if (v.fecha)
    return (
      <div className="oc-vd-resumo ok">
        ✓ <b>{v.semPedido ? "é isto que a correção vai lançar" : `fecha em ${v.mins.length}`}</b>
        {v.liquida != null ? ` · ${horasLiquidas(v.liquida)} líquidas` : ""}
        {v.almoco != null ? ` · almoço de ${v.almoco} min` : " · sem almoço no cartão"}
      </div>
    );
  return (
    <div className="oc-vd-resumo ruim">
      ✗ <b>o cartão não fecha</b>
      {v.faltando.length ? (
        <>
          {" — falta "}
          <b>{v.faltando.join(" e ")}</b>
        </>
      ) : null}
      {v.problema ? <span className="dp-faint">{` · ${v.problema}`}</span> : null}
    </div>
  );
}

/* ════════════ O QUE SAIU DO POP-UP — E O QUE AINDA NÃO TEM CASA ══════════════════════
 *
 * Daqui até o `RelatorioCaso` moram as peças que o pop-up NÃO desenha mais: `Montador`,
 * `ComoAlteracao`, `LancarDiaSemPonto`, `ForaDoRobo` e `BarraRobo`. Nenhuma foi apagada de
 * propósito — a ordem do dono foi "REMOVA do modal, não mova agora".
 *
 * DEPOIS DA TELA PRINCIPAL (10/09/2026), duas já estão cobertas e não voltam:
 *   · `BarraRobo` — executar e conferir são o lote da "Fila de lançamento", e o estado do
 *     robô é a faixa no topo da lista, lida do GitHub;
 *   · `Montador` — quem monta o cartão agora é `montaCompartimentos`, com a origem de cada
 *     ponta à vista. Duas respostas para "como o cartão fica" foi exatamente o defeito que
 *     a anedota do DEVANIR registra.
 * `LancarDiaSemPonto` segue viva, na barra de lote da grade.
 *
 * AS DUAS QUE FICARAM SEM BOTÃO EM LUGAR NENHUM — e o dono precisa decidir onde ficam:
 *   · `ComoAlteracao` ("✎ Recusar os pedidos e corrigir o ponto assim"): recusa as
 *     ocorrências e crava o cartão no `ponto_real_manual`. Hoje o DP faz o mesmo em dois
 *     passos — crava no Cartão do dia (botão no topo do pop-up) e recusa no veredito;
 *   · `ForaDoRobo` ("fechar à mão", main.py:8289): encerra o caso que o robô não conseguiu.
 *     O caminho seguro existe na fila ("Conferir marcados e fechar no nosso banco"), que só
 *     carimba quando o cartão ao vivo bate; o que não existe mais é fechar SEM conferir.
 * Enquanto não houver essa decisão, elas ficam aqui — com os motivos e as anedotas que
 * carregam. Apagar antes seria decidir no lugar dele.
 */

/* ══════════════════ O MONTADOR — a mesa do dia ═══════════════════════════════
 *
 * UM MOTOR SÓ, E É O `simulaCartao`. A ferramenta chegou a ter TRÊS respostas para "como o
 * cartão fica" e elas discordavam: DEVANIR 30017485 20/08 saía `…12:22` num quadro e
 * `…12:24` no outro, e o que subia para o robô era o segundo. Em 24/08 os dois primeiros
 * saíram da tela (app.js:680). Aqui vale a mesma regra: quem responde "como o cartão fica"
 * é ESTE card, e o contrato congelado é o cartão desenhado nele.
 *
 * "hoje" NÃO é recalculado aqui: é `reg.hoje`, montado uma vez em `montarRegistros`, com a
 * mesma entrada e as mesmas referências do "fica".
 *
 * O QUE ELE NÃO FAZ: não julga. O veredito de cada pedido é do `julgaAcoes` e compara com o
 * ALVO, não com o cartão simulado — por isso um dia com a simulação bloqueada continua
 * tendo veredito, e o card continua na tela dizendo que a projeção não fecha.
 */
function Montador({ reg, montado, almoco }) {
  if (!montado) return null;
  const { travado, atual, fica, bloqueio, contagem, notas } = montado;
  // VERMELHO SÓ QUANDO PRECISA AJUSTAR (app.js:321): cartão já certo é discreto.
  const estado = bloqueio || !montado.fecha ? "falta" : montado.mudou ? "muda" : "ok";
  const titulo = travado
    ? "🔒 Como o cartão FICOU"
    : { falta: "⚠ O cartão não fecha", muda: "⚠ Como o cartão vai ficar", ok: "✓ O cartão já está certo" }[estado];
  const total = (reg.acoes || []).length;
  return (
    <div className={`oc-mt ${travado ? "travado" : estado}`}>
      <div className="oc-mt-tit">
        {titulo}
        <span className="oc-mt-sub">
          {travado
            ? `decisão gravada: ${reg.decJa.aceito ? "aceito" : "recusado"} em ${reg.decJa.quando}` +
              `${reg.decJa.subiu ? " · o robô já executou" : " · aguardando o robô"}`
            : `${contagem.A} de ${total} marcado(s) para aceitar` +
              `${contagem.R ? ` · ${contagem.R} para recusar` : ""}` +
              `${contagem.sem ? ` · ${contagem.sem} sem marca` : ""}`}
        </span>
      </div>

      <div className="oc-mt-l">
        <span className="oc-mt-k">hoje</span>
        <CartaoInteiro batidas={atual} vazio="sem cartão" />
        {reg.fantasmas?.length ? (
          <span className="dp-faint" style={MINI}
            title="batidas duplicadas em ≤6 min — o mesmo evento registrado duas vezes; o motor colapsa e mostra a última">
            fantasmas: {reg.fantasmas.map(min2hm).join(" · ")}
          </span>
        ) : null}
      </div>
      <div className="oc-mt-l">
        <span className="oc-mt-k">{travado ? "ficou" : "fica"}</span>
        <CartaoInteiro batidas={fica} contra={atual} vazio="—" />
        <Removidas antes={atual} depois={fica} />
        {montado.jornada != null ? (
          <span className="dp-faint" style={MINI}>{horasLiquidas(montado.jornada)} líquidas</span>
        ) : null}
        {montado.semAlmoco ? (
          <Selo cor="alerta" titulo="jornada acima de 6h sem par de intervalo no cartão">falta o almoço</Selo>
        ) : null}
      </div>
      {/* O ALVO, no MESMO desenho da grade e do papel: o cartão final depois de lançado.
          A legenda dizia "é o que o robô lança" sem dizer QUAL robô — e no dia com aviso ela
          desenhava o alvo da CORREÇÃO logo abaixo de um "fica" que era o do ACEITE. */}
      {reg.alvo.temAlvo ? (
        <div className="oc-mt-l">
          <span className="oc-mt-k">alvo</span>
          <CartaoAlvo alvo={reg.alvo} />
          <span className="dp-faint" style={MINI}>
            {["aviso", "revisão publicada"].includes(reg.alvo.fonte)
              ? "é o que a CORREÇÃO lança · alvo publicado pela Revisão · destacado = o que muda"
              : "é o que o robô lança ao ACEITAR · destacado = o que muda · normal = fica como está"}
          </span>
          <AlvoDoAviso alvo={reg.alvo} />
        </div>
      ) : null}

      {/* CARTÃO TEM QUE FECHAR EM 2 OU 4 (app.js:1090). Três batidas não é cartão — é ponto
          quebrado, e o Transnet não tem onde guardar a terceira. */}
      {!montado.fecha ? (
        <div className="oc-mt-n forte">
          ✗ <b>{fica.length} batida(s) — o cartão não fecha.</b> Ele tem que ter 2 (entrada e saída)
          ou 4 (com almoço). Aceite os que batem e recuse o resto.
        </div>
      ) : null}

      {/* E QUANDO O QUE FALTA É O ALMOÇO, A TELA DIZ QUAL BATIDA FALTA E DE ONDE ELA SAI. */}
      {!montado.fecha && almoco ? (
        <div className="oc-mt-n">
          ▸ <b>O que falta é a {almoco.lado}, não a decisão.</b> O almoço apurado deste dia
          (Revisão · {almoco.fonte || "sem carimbo"} · {almoco.par}) fecha o dia em 4:
          <span style={{ ...FILA, marginTop: 4 }}>
            <LinhaCartao
              horas={almoco.cartao.map(min2hm)}
              mudou={almoco.cartao.map((v) => v === almoco.falta)}
            />
            <span className="dp-faint" style={MINI}>
              não entra no contrato: o robô daqui só aceita/recusa a ocorrência — a batida do
              almoço quem põe é a Refeição.
            </span>
          </span>
        </div>
      ) : null}

      {/* SEM ALMOÇO APURADO a view NÃO INVENTA (`fonte_almoco` nulo, faixa SEM_BASE) — e a
          tela também não. Diz por que o dia não fecha e para onde ir. */}
      {!montado.fecha && !almoco && fica.length === 3 ? (
        <div className="oc-mt-n dp-faint">
          falta uma ponta do almoço, e a Revisão não apurou almoço para este dia (sem base):
          quem crava é o DP, no <b>Cartão do dia</b> — seção “Real manual do DP”.
        </div>
      ) : null}

      {/* SIMULAÇÃO BLOQUEADA: avisa e NÃO some com o card. O julgamento de cada pedido
          continua valendo, porque ele compara com o alvo e não com o cartão simulado. */}
      {bloqueio ? (
        <div className="oc-mt-n">
          ⚠ <b>A projeção não fecha:</b> {bloqueio}. O veredito de cada pedido continua valendo (ele
          compara com o alvo). Enquanto o cartão não fechar, nada é congelado como contrato.
        </div>
      ) : null}

      {notas.length ? (
        <div className="oc-mt-n dp-faint">o que o motor viu: {notas.join(" · ")}</div>
      ) : null}

      {/* Marcado para aceitar, mas o Transnet já resolveu: não entra na simulação — o
          EFETUADO já está DENTRO do cartão de hoje, e reaplicá-lo duplicaria a batida. */}
      {!travado && montado.resolvidos ? (
        <div className="oc-mt-n dp-faint">
          {montado.resolvidos} pedido(s) marcado(s) para aceitar já estão EFETUADO/RECUSADO no
          Transnet — não entram na projeção.
        </div>
      ) : null}
    </div>
  );
}

/* ── A SAÍDA "ERA ALTERAÇÃO" (app.js:1195 → :5612) ────────────────────────────
 * Fica GRUDADA no montador e ABAIXO dele: é a resposta a "e se a operação certa fosse
 * alteração?", e o cartão desenhado aqui é EXATAMENTE o que vira Real manual. Não aparece
 * quando a projeção não fecha — um cartão de 3 batidas não é alvo de correção nenhum.
 * ELE NÃO SUBSTITUI O MONTADOR: são perguntas diferentes sobre o mesmo dia. */
function ComoAlteracao({ reg, proj, gravando, aoAplicar }) {
  if (!proj || !proj.fecha || proj.bloqueio) return null;
  const trava = motivoSemComoAlteracao(reg, proj);
  const n = (reg.acoes || []).length;
  return (
    <div className="oc-alt">
      <div className="oc-alt-t">✎ O cartão certo, se fossem alterações</div>
      <div className="oc-mt-l">
        <span className="oc-mt-k">fica</span>
        <CartaoInteiro batidas={proj.pontos} contra={reg.hoje} />
        {proj.jornada != null ? (
          <span className="dp-faint" style={MINI}>{horasLiquidas(proj.jornada)} líquidas</span>
        ) : null}
        {proj.semAlmoco ? (
          <Selo cor="alerta" titulo="jornada acima de 6h sem par de intervalo no cartão">falta o almoço</Selo>
        ) : null}
      </div>
      <div className="oc-mt-n">
        {n === 1 ? "O pedido deste dia é" : `Os ${n} pedidos deste dia são`}{" "}
        <b>alteração, não inserção</b>: a ponta já tem batida, então aceitar não corrige —
        acrescenta, e o cartão fica com 3 ou 5 batidas. Do jeito que vieram, são <b>recusa</b>. O que
        vale é o cartão acima: ele é gravado como <span className="dp-mono">ponto_real_manual</span>,
        o topo da régua e o alvo que a correção lança.
      </div>
      <div className="dp-det-bot-acoes">
        <BotaoAcao
          tom="erro"
          disabled={Boolean(trava) || gravando}
          titulo={
            trava ||
            "Recusa as ocorrências (R:), grava correcao_status='pendente' — nunca 'dispensada', que fecharia a porta da correção — e crava este cartão no Real manual. NÃO dispara robô nenhum."
          }
          onClick={() => aoAplicar(reg, proj)}
        >
          ✎ Recusar os pedidos e corrigir o ponto assim
        </BotaoAcao>
      </div>
      {trava ? <div className="oc-mt-n dp-faint">indisponível: {trava}</div> : null}
    </div>
  );
}

/* ── LANÇAR DIA SEM PONTO (main.py:4389 · app.js:1615) ────────────────────────
 * O TIPO é um `<select>`, como no original: são três opções mutuamente exclusivas do QUE
 * ACONTECEU. ENSAIO e VALENDO continuam dois BOTÕES — a regra desta tela e a da Folgas: um
 * checkbox marcado por engano lança de verdade na ficha de alguém.
 * O ESCOPO é sempre a lista que chega em `regs`, nunca "a fila". */
function LancarDiaSemPonto({ regs, candidatos = 0, ocupado, aoLancar, titulo, noCasoAberto = false }) {
  const [tipo, setTipo] = useState("05");
  const lista = regs || [];
  const bloqueados = lista.map((r) => ({ r, motivo: motivoSemLancarDia(r) })).filter((x) => x.motivo);
  const elegiveis = lista.filter((r) => !motivoSemLancarDia(r));
  return (
    <div className="oc-lancar">
      <div className="dp-det-bot-linha oc-lancar-t">
        <b>📅 {titulo}</b>
        <span className="dp-faint">
          {" "}· zero batida no cartão · robô <span className="dp-mono">ocorrencias</span>, o mesmo da
          Folgas. Não há ponta a corrigir: o tipo é a SUA decisão e fica registrado quem mandou.
        </span>
      </div>
      {elegiveis.length ? (
        <div className="dp-det-bot-acoes">
          <select
            className="oc-sel"
            value={tipo}
            disabled={ocupado}
            onChange={(e) => setTipo(e.target.value)}
            title="O que aconteceu neste dia. Nenhuma fonte responde isso — é decisão do DP."
          >
            {TIPOS_DIA_SEM_PONTO.map(([k, l]) => (
              <option key={k} value={k}>{l} ({k})</option>
            ))}
          </select>
          <BotaoAcao disabled={ocupado} titulo="O robô navega e NÃO confirma."
            onClick={() => aoLancar(elegiveis, tipo, false, noCasoAberto)}>
            🤖 Ensaio
          </BotaoAcao>
          <BotaoAcao tom="erro" disabled={ocupado} titulo="Lança de verdade na ficha do colaborador, no Transnet."
            onClick={() => aoLancar(elegiveis, tipo, true, noCasoAberto)}>
            ⚠ Lançar {elegiveis.length} dia(s) de verdade
          </BotaoAcao>
        </div>
      ) : (
        <div className="dp-det-bot-linha">
          <Selo cor="alerta" quebra>
            {lista.length
              ? noCasoAberto
                ? "este dia não pode ser lançado"
                : "nenhuma das linhas marcadas pode ser lançada"
              : `marque na grade (✔) os dias sem ponto para lançar — ${candidatos} nesta lista`}
          </Selo>
        </div>
      )}
      {bloqueados.length ? (
        <div className="dp-det-bot-linha dp-faint">
          {bloqueados.length} fora:{" "}
          {bloqueados.slice(0, 4).map((x) => `${x.r.nome} ${x.r.dataBR} (${x.motivo})`).join(" · ")}
          {bloqueados.length > 4 ? " …" : ""}
        </div>
      ) : null}
    </div>
  );
}

/* ── A SAÍDA DE EXCEÇÃO: FECHAR À MÃO (app.js:7308 → main.py:8289) ────────────
 * É o único caminho do rodapé que não passa por robô nenhum, e por isso fica FECHADO até
 * alguém dizer que o robô não deu conta: encostado nos botões do robô, aberto, ele seria
 * lido como "o jeito rápido" — e o jeito rápido de tirar um caso da fila é gravar desfecho
 * sem ninguém ter ido ao Transnet. Os dois desfechos são BOTÕES SEPARADOS: "lancei à mão" e
 * "o Transnet não aceita" escrevem histórias diferentes na ficha da pessoa. */
function ForaDoRobo({ reg, ocupado, aoFecharAMao }) {
  const [aberto, setAberto] = useState(false);
  const [nota, setNota] = useState("");
  const trava = motivoSemFechamentoManual(reg);

  if (!aberto)
    return (
      <div className="dp-det-bot-linha oc-fora-chamada">
        <button type="button" className="oc-fora-abrir" onClick={() => setAberto(true)}
          title="Saída de exceção: registrar que este caso foi resolvido FORA do robô, para ele parar de voltar à fila em toda rodada.">
          O robô não deu conta deste caso?
        </button>
      </div>
    );

  return (
    <div className="oc-fora">
      <div className="dp-det-bot-linha oc-fora-tit">
        {/* o "esconder" vem PRIMEIRO no DOM porque flutua à direita */}
        <button type="button" className="oc-fora-abrir" onClick={() => setAberto(false)}
          title="Fecha este bloco. Nada foi gravado.">esconder</button>
        <b>⚠ Exceção — fechar à mão, sem robô</b>
        <span className="dp-faint"> · {reg.nome} · {reg.dataBR} · nada é lançado no Transnet por aqui</span>
      </div>
      {trava ? (
        <div className="dp-det-bot-linha">
          <Selo cor="alerta" quebra titulo="Fechar à mão registra o DESFECHO de uma decisão que já existe.">
            indisponível para este caso: {trava}
          </Selo>
        </div>
      ) : (
        <>
          <div className="dp-det-bot-linha">
            Use isto <b>só depois</b> de o robô ter tentado e não ter conseguido. Um lançamento
            recusado sem desfecho volta para a fila <b>em toda rodada, para sempre</b>.
            <b> O cartão não é tocado e nenhum horário é inventado</b>: fica registrado o que você
            fez, em <span className="dp-mono">ponto_caso</span>, com nota no histórico.
          </div>
          <label className="dp-det-bot-linha oc-fora-campo">
            {/* 140 é o que sobra dentro dos 200 caracteres que o Python guarda em `usuario`,
                contando o maior dos dois textos fixos: nada é cortado em silêncio. */}
            <span className="dp-faint">Observação (opcional, até 140 caracteres)</span>
            <input className="oc-fora-nota" value={nota} maxLength={140} disabled={ocupado}
              placeholder="ex.: lançado pelo DP em 03/09, protocolo do Transnet"
              onChange={(e) => setNota(e.target.value)} />
          </label>
          <div className="dp-det-bot-acoes">
            <BotaoAcao tom="ok" disabled={ocupado}
              titulo="Alguém foi ao Transnet e lançou: grava correcao_status='corrigido' E correcao_final_em."
              onClick={() => aoFecharAMao(reg, "lancado_a_mao", nota)}>
              ✔ Lancei à mão — fechar como corrigido
            </BotaoAcao>
            <BotaoAcao tom="erro" disabled={ocupado}
              titulo="Competência encerrada: grava correcao_status='ponto_fechado' e NÃO carimba correcao_final_em — o ponto não foi corrigido, e o histórico não pode dizer que foi."
              onClick={() => aoFecharAMao(reg, "nao_da", nota)}>
              🔒 O Transnet não aceita esse dia — fechar como ponto fechado
            </BotaoAcao>
          </div>
        </>
      )}
    </div>
  );
}

/* ── O ROBÔ, EM UMA LINHA ─────────────────────────────────────────────────────
 * Na ferramenta os botões de robô moram na barra, numa linha. Aqui eles ocupavam mais
 * altura que a decisão inteira — três blocos de texto explicando o que cada `title` já diz.
 * O que NÃO encolheu: ensaio e valendo continuam BOTÕES SEPARADOS (um checkbox marcado por
 * engano vira decisão de verdade na ficha de um trabalhador), o escopo continua escrito, e
 * a trava continua dita por extenso quando o botão não existe. */
function BarraRobo({ reg, disparando, gravando, aoExecutar, aoConferir, aoFecharAMao, aoCancelar, resultado }) {
  const trava = motivoSemExecucao(reg);
  const plano = trava ? null : planoDaExecucao(reg);
  const travaConf = motivoSemConferencia(reg);
  // MESMO MOTIVO, UMA FRASE. Executar e conferir esperam a MESMA coisa — a decisão
  // gravada —, e a linha do robô dizia duas vezes, em dois selos compridos lado a lado:
  // "executar: nenhuma decisão gravada — decidir e executar são dois passos" e
  // "conferir: nenhuma decisão gravada — o bot só confere o que foi decidido". Duas
  // frases para um impedimento só é o que fazia o rodapé parecer um parágrafo.
  // A causa é o pedaço antes do travessão; o resto é a explicação de cada verbo. Mesma
  // causa = um impedimento só, e aí vale a frase da execução, que já diz o que fazer.
  const causa = (m) => txt(m).split(" — ")[0];
  const travaUnica = trava && travaConf && causa(trava) === causa(travaConf) ? trava : "";
  return (
    <div className="dp-det-bot">
      <div className="oc-robo">
        <b>Robô</b>
        <span className="dp-faint">escopo: {reg.nome} · {reg.dataBR} (1 crachá+dia)</span>
        {travaUnica ? (
          <Selo cor="alerta" quebra titulo="O robô executa e confere a MESMA fila: decisão gravada. Decidir e executar são dois passos.">
            {travaUnica}
          </Selo>
        ) : (
        <>
        {trava ? (
          <Selo cor="alerta" quebra titulo="O robô só executa decisão já gravada — decidir e executar são dois passos.">
            executar: {trava}
          </Selo>
        ) : (
          <>
            <button type="button" className="dp-btn" disabled={disparando}
              onClick={() => aoExecutar(reg, false)}
              title="O robô navega, marca e NÃO clica — serve para conferir antes de valer.">
              🤖 Ensaio
            </button>
            <button type="button" className="dp-btn" style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando} onClick={() => aoExecutar(reg, true)}
              title={`Vale de verdade no Transnet: ${rotuloDaExecucao(reg)}. O robô vai aceitar ${plano.aceitar.length} e rejeitar ${plano.rejeitar.length} ocorrência(s)${plano.jaResolvidos.length ? ` (${plano.jaResolvidos.length} o Transnet já resolveu)` : ""}, e carimba conferido_em — é esse carimbo que trava o dia.`}>
              ⚠ {rotuloDaExecucao(reg)} ({plano.aceitar.length}✓ {plano.rejeitar.length}✗)
            </button>
          </>
        )}
        <span className="oc-sep" aria-hidden="true" />
        {travaConf ? (
          <Selo cor="alerta" quebra titulo="O bot confere a MESMA fila que executa: decisão gravada e conferido_em vazio.">
            conferir: {travaConf}
          </Selo>
        ) : (
          <>
            <button type="button" className="dp-btn" disabled={disparando}
              onClick={() => aoConferir([reg], false, true)} title={AVISO_CONFERIR}>
              🔍 Conferir — ensaio
            </button>
            <button type="button" className="dp-btn" style={{ color: "var(--dp-ok-ink)" }}
              disabled={disparando} onClick={() => aoConferir([reg], true, true)}
              title={`${AVISO_CONFERIR} É a conferência que tira o caso de "Execução pendente": quem carimba conferido_em é o bot, nunca o navegador.`}>
              🔒 Conferir e fechar no nosso banco
            </button>
          </>
        )}
        </>
        )}
        {/* SÓ NA PORTA DO AVISO: advertir e cancelar pressupõem aviso registrado neste
            crachá+dia. Num pedido do colaborador nem desligados eles devem aparecer — botão
            morto ainda ensina que aquilo seria possível, e aqui não é. */}
        {reg.temAviso ? (
          <>
            <span className="oc-sep" aria-hidden="true" />
            <BotaoExecucao tom="erro" motivo={MOTIVO_ADVERTIR}>Advertir e corrigir</BotaoExecucao>
            {/* DESISTIR DA OCORRÊNCIA DELE sem fechar o caso e ir marcar a caixinha na
                grade. VAI VALENDO: é assim na ferramenta (`app/ui/app.js:308` chama
                `cancelar_pedidos_lote` com confirmar=true direto, e quem segura é o
                `confirm()`). NÃO é o "Cancelar aviso" ao lado — aquele desfaz a NOSSA
                ocorrência no Transnet (`--cancelar-enviadas`) e segue fora do ar. */}
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando || gravando}
              title="Recusa no Transnet os IDs deste crachá+dia que ainda estiverem pendentes na grade AO VIVO e fecha o caso como cancelado. Não é rejeitar: cancelar não decide nada e não adverte ninguém."
              onClick={() => aoCancelar([reg], true, true)}
            >
              ✗ Cancelar este pedido
            </button>
            <BotaoExecucao motivo={MOTIVO_CANCELAR}>Cancelar aviso</BotaoExecucao>
          </>
        ) : null}
        {disparando ? <span className="dp-pill accent">disparando…</span> : null}
      </div>
      {resultado ? (
        <div className="dp-det-bot-linha">
          <Selo cor={resultado.tipo === "ok" ? "ok" : "erro"} quebra>{resultado.texto}</Selo>
          {resultado.painel ? (
            <>{" "}<a className="dp-btn" href={resultado.painel} target="_blank" rel="noreferrer">ver o robô rodando</a></>
          ) : null}
        </div>
      ) : null}
      {/* O TERCEIRO CAMINHO, por último de propósito: só faz sentido quando o robô já
          tentou. `key` = o caso: trocar de caso NUNCA pode carregar a observação digitada
          para a ficha de outra pessoa. */}
      <ForaDoRobo key={reg.k} reg={reg} ocupado={disparando || gravando} aoFecharAMao={aoFecharAMao} />
    </div>
  );
}

/* ══════════ O HISTÓRICO DO CASO, PARA IMPRIMIR (app.js:2258) ═════════════════
 * A peça de evidência que se anexa. A ordem é a do original — a HISTÓRIA, não a estrutura
 * dos dados. O bloco vive dentro do caso aberto, escondido na tela (`.oc-rel` é
 * `display:none`), e só existe no papel; as regras de `@media print` estão presas à classe
 * `oc-imprimindo`, que só esta tela põe no <body> no clique.
 *
 * O PAPEL SAI DO MESMO CARTÃO QUE ESTÁ NA TELA (`montado.fica` chega por prop — desde
 * 10/09/2026 são os quatro compartimentos do pop-up). Antes ele imprimia a prévia de
 * "aceitar tudo" enquanto a tela mostrava o cartão das marcas: duas respostas para o mesmo
 * dia, e a que ia para a pasta era a que ninguém tinha aprovado. */
function imprimirHistorico() {
  if (typeof window === "undefined" || typeof window.print !== "function") return;
  const corpo = window.document?.body;
  if (!corpo) return;
  corpo.classList.add("oc-imprimindo");
  window.addEventListener("afterprint", () => corpo.classList.remove("oc-imprimindo"), { once: true });
  window.print();
}

const SLOT_ROTULO = ["Entrada", "S. almoço", "V. almoço", "Saída"];

function RelatorioCaso({ reg, montado }) {
  const c = reg.caso || {};
  const exec = Boolean(txt(c.conferido_em) || txt(c.correcao_final_em));
  const quandoFechou = txt(c.conferido_em) || txt(c.correcao_final_em);
  const fica = montado?.fica?.length ? montado.fica : reg.hoje;
  const jornadaAntes = jornadaDoCartao(reg.hoje).liquida;
  const jornadaDepois = jornadaDoCartao(fica).liquida;
  const gordAntes = gorduraContraAlvo(reg.hoje, c.alvo_entrada, c.alvo_saida);
  const gordFim = gorduraContraAlvo(fica, c.alvo_entrada, c.alvo_saida);
  const aceite = txt(c.aceite);
  const estado = exec
    ? ["ok", "✓ Aplicado", txt(c.conferido_em) ? "o bot executou e travou o dia" : "advertido e corrigido"]
    : !aceite || aceite === "pendente"
      ? selosDaMarcacao(reg)
        ? ["alerta", "⏳ Marcado", "decidido por ocorrência, falta lançar"]
        : ["neutro", "• A decidir", "esperando você"]
      : ["alerta", "⏳ Aguardando bot", "decidido, falta subir no Transnet"];
  // O rótulo da segunda linha diz DE ONDE ela vem. Chamar tudo de "depois" é o que fazia o
  // DP ler uma projeção como se fosse o cartão que subiu.
  const rotuloFica = exec ? "Aplicado" : reg.decJa ? "Contrato da decisão" : "Como fica (suas marcas)";
  const etapas = [
    ["📤", "Aviso enviado", c.aviso_enviado_em, ""],
    ["👁", "Aviso conferido no Transnet", c.aviso_conferido_em, ""],
    ["⚖️", `Decisão do DP (${aceite || "pendente"})`, c.aceito_em,
      aceite === "aceito" ? "aceitou — o ponto fica como ele pediu"
        : aceite === "rejeitado" ? "recusou os pedidos deste dia" : ""],
    ["🤖", "Executado no Transnet", c.conferido_em, ""],
    ["⚠", "Advertência enviada", c.advertencia_enviada_em, ""],
    ["🔧", "Correção do ponto", c.correcao_final_em, ""],
    ["🗑", "Aviso cancelado", c.aviso_cancelado_em, ""],
  ];
  const kpi = (rot, val, sub, cor) => (
    <div className={`oc-rel-k${cor ? ` ${cor}` : ""}`}>
      <div className="oc-rel-kr">{rot}</div>
      <div className="oc-rel-kv">{val}</div>
      <div className="oc-rel-ks">{sub}</div>
    </div>
  );
  // CARTÃO QUE NÃO FECHA NÃO CABE NOS 4 SLOTS (app.js:2384): espremer 7 batidas em 4 colunas
  // descartava as 3 últimas EM SILÊNCIO — escondendo justo a batida que é o motivo de a
  // correção existir. Fora do par 2/4, sai o cartão INTEIRO.
  const linhaCartao = (rot, slots, jornada, gord, cru) => (
    <tr>
      <th>{rot}</th>
      {cru && cru.length && ![2, 4].includes(cru.length) ? (
        <td colSpan={4} className="oc-rel-cru">{cru.map(min2hm).join(" · ")}</td>
      ) : (
        slots.map((h, i) => <td key={`s${i}`}>{h || "—"}</td>)
      )}
      <td>{jornada == null ? "—" : horasLiquidas(jornada)}</td>
      <td>{gord ? horasLiquidas(gord.total) : "—"}</td>
    </tr>
  );
  return (
    <div className="oc-rel">
      <div className="oc-rel-h">
        <b>Histórico do caso</b>
        <span>
          {reg.nome} · crachá {reg.cracha} · {reg.dataBR}
          {reg.funcao ? ` · ${reg.funcao}` : ""} · {reg.categoria}
        </span>
      </div>
      <div className="oc-rel-kpis">
        {kpi("Jornada",
          `${jornadaAntes == null ? "—" : horasLiquidas(jornadaAntes)} → ${jornadaDepois == null ? "—" : horasLiquidas(jornadaDepois)}`,
          "cartão hoje → como fica")}
        {kpi("Gordura no fim", gordFim ? horasLiquidas(gordFim.total) : "—",
          txt(c.alvo_entrada) || txt(c.alvo_saida)
            ? `alvo ${txt(c.alvo_entrada) || "—"} – ${txt(c.alvo_saida) || "—"}`
            : "sem alvo congelado para medir",
          gordFim && gordFim.total > 0 ? "ruim" : gordFim ? "boa" : "")}
        {kpi("Estado", estado[1], estado[2], estado[0] === "ok" ? "boa" : "")}
      </div>

      <div className="oc-rel-b">
        <div className="oc-rel-bt">O ponto</div>
        <div className="oc-rel-esc">
          escala <b>{reg.escala[0] || "—"} – {reg.escala[1] || "—"}</b>
          {" "}· régua {reg.baseE || "sem base"} / {reg.baseS || "sem base"} · tolerância {TOLERANCIA_MIN} min
        </div>
        <table className="oc-rel-cart">
          <tbody>
            <tr>
              <th />
              {SLOT_ROTULO.map((r) => <th key={r}>{r}</th>)}
              <th>Jornada</th>
              <th>Gordura</th>
            </tr>
            {linhaCartao("Bateu", reg.slotsHoje, jornadaAntes, gordAntes, reg.hoje)}
            {reg.alvo.temAlvo
              ? linhaCartao("Alvo (o final)", reg.alvo.slots, null, null, null)
              : null}
            {linhaCartao(rotuloFica, quatroSlots(fica, [c.alvo_alm_saida, c.alvo_alm_volta]), jornadaDepois, gordFim, fica)}
          </tbody>
        </table>
        <div className="oc-rel-sub">
          {reg.hoje.length} batida(s) hoje · {fica.length} depois
          {exec ? ` · aplicado no Transnet em ${fmtDataHora(quandoFechou)}` : ""}
          {reg.bloqueio ? ` · a projeção não fecha: ${reg.bloqueio}` : ""}
        </div>
      </div>

      <div className="oc-rel-b">
        <div className="oc-rel-bt">
          O que ele pediu — {aceite === "aceito" ? "você aceitou" : aceite === "rejeitado" ? "você recusou" : "sem decisão ainda"}
        </div>
        {reg.acoes?.length ? (
          <ul className="oc-rel-peds">
            {reg.acoes.map((a, i) => (
              <li key={`p${i}`}>
                <b>{a.tipo || "—"}</b> {a.hora || "—"}{a.n > 1 ? ` (${a.n}×)` : ""} —{" "}
                {a.redundante ? "já tinha essa batida"
                  : a.ok === null ? "sem base para julgar"
                    : a.excl ? (a.ok ? "tirou o errado" : "tirou o certo")
                      : a.ok ? "bate com o alvo" : "não bate com o alvo"}
                {a.alvo ? ` · alvo ${a.alvo}${a.dif != null ? ` · ${a.dif} min` : ""}` : ""}
                {a.viraAlteracao ? ` · era alteração de ${a.viraAlteracao}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <div className="oc-rel-sub">nenhum pedido registrado neste crachá+dia</div>
        )}
      </div>

      <div className="oc-rel-b">
        <div className="oc-rel-bt">A trilha do processo</div>
        <ul className="oc-rel-tl">
          {etapas.map(([ico, rot, valor, sub]) => (
            <li key={rot} className={txt(valor) ? "on" : ""}>
              <span>{txt(valor) ? ico : "–"}</span>
              <b>{rot}</b>
              <i>{txt(valor) ? fmtDataHora(valor) : "—"}</i>
              {txt(valor) && sub ? <em>{sub}</em> : null}
            </li>
          ))}
        </ul>
        <div className="oc-rel-prox">{proximoPassoDoCaso(reg)}</div>
        {txt(c.correcao_status) ? (
          <div className="oc-rel-sub">
            correcao_status: {txt(c.correcao_status)}
            {txt(c.usuario) ? ` · usuario: ${txt(c.usuario)}` : ""}
          </div>
        ) : null}
      </div>

      <div className="oc-rel-f">
        Gerado pela Gestão DP · DP360 · Ocorrências · impresso em {fmtDataHora(agoraISOLocal())}
        {" "}· veredito, régua e simulação do motor validado (regrasPonto.js)
      </div>
    </div>
  );
}

/* ───────────────────────────── o caso aberto (modal) ─────────────────────── */

/**
 * O POP-UP DO CASO — SÓ VEREDITO (reescrito em 10/09/2026 sobre o desenho aprovado).
 *
 * O QUE ELE FAZ: pergunta, ocorrência por ocorrência, se o pedido vale — e mostra o cartão
 * que sai daquelas respostas, compartimento por compartimento, dizendo DE ONDE cada horário
 * veio. Um botão no rodapé grava esse veredito (`gravarMarcacao`, o que já existia).
 *
 * O QUE ELE NÃO FAZ MAIS, e é o ponto do desenho: nada de robô, executar, conferir,
 * advertir, cancelar aviso, cancelar pedido, "Aceitar o dia", "Rejeitar o dia inteiro",
 * "Lançar esta marcação", "Recusar e corrigir assim" e "Lançar dia sem ponto". TODO
 * LANÇAMENTO É NA TELA PRINCIPAL. Enquanto decidir e lançar moravam no mesmo modal, os dois
 * ficavam a um clique de distância — e o clique errado mexe no ponto de uma pessoa.
 *
 * E O DIA NÃO TEM MAIS BOTÃO PRÓPRIO: ele é CONSEQUÊNCIA das marcas (havendo recusa, o dia
 * fica recusado — a mesma regra do `aplicar_marcados`). Dois caminhos para decidir o mesmo
 * dia era o que fazia "Aceitar o dia" apagar a marcação por ocorrência que o DP acabara de
 * fazer.
 *
 * O QUE SAIU DA DIREITA: escala, régua do dia, operação real, refeição, Real manual,
 * veredito por ponta e linha do tempo. O DP olha isso no CARTÃO DO DIA (botão no topo) — o
 * mesmo pop-up compartilhado da Revisão e da Gordura, que já mostra tudo aquilo e é onde se
 * crava a régua de verdade.
 */
function Detalhe({ reg, aoFechar, gravando, aoMarcar, aoAbrirCartao, abrindoCartao, erroCartao }) {
  /* ── AS MARCAS: uma por ocorrência, e agora só A ou R ────────────────────────
   * A MARCA GRAVADA MANDA; só o que não tem marca cai na pré-marcação do MOTOR
   * (`julgaAcoes.ok`). Reabrir um dia já marcado e repintar tudo pelo veredito faz o DP
   * julgar duas vezes a mesma coisa — e a segunda opinião pode sair diferente da que já
   * está gravada (app.js:141).
   * Sem régua (`ok === null`) NÃO se marca nada: a ferramenta não pode empurrar "aceitar"
   * num dia sem base nenhuma — quem decide é o operador (app.js:137). É por isso que o
   * botão do rodapé fica travado enquanto sobrar ocorrência sem resposta. */
  const inicial = useMemo(() => {
    const gravadas = marcasGravadas(reg);
    const m = {};
    (reg?.acoes || []).forEach((it, i) => {
      const jaMarcada = (it.ids || []).map((id) => gravadas.get(txt(id))).find(Boolean);
      m[i] = jaMarcada || (it.ok === true ? "A" : it.ok === false ? "R" : "");
    });
    return m;
  }, [reg?.acoes, reg?.ciclo]);
  const [marcas, setMarcas] = useState(inicial);
  useEffect(() => setMarcas(inicial), [inicial]);

  // o que o DP digitou à mão e as pontas que ele mandou completar com o alvo — zeram quando
  // o pop-up troca de caso, senão o dia seguinte abriria com o horário do anterior no campo
  const [manual, setManual] = useState({ entrada: "", saida: "" });
  const [completar, setCompletar] = useState({});
  useEffect(() => {
    setManual({ entrada: "", saida: "" });
    setCompletar({});
  }, [reg?.k]);

  /* ── O MIOLO DO INTERNO É DO MONTADOR ───────────────────────────────────────
   * No MOTORISTA a refeição é travada e nada disto é usado. No interno/aprendiz o miolo é
   * LIVRE, e quem diz onde ele cai é o montador de sempre: `simulaCartao` com as
   * ocorrências aceitas + `encaixaEmQuatro` (montador.py:417, o passo que descarta a batida
   * que sobra). Mesmas refs da prévia (main.py:9064): a escala do CARTÃO, e só ela. */
  const ficaMontador = useMemo(() => {
    if (!reg || mioloTravado(reg.categoria)) return null;
    const cp = reg.cartao || {};
    const refs = [hm2min(cp.esc_entrada), hm2min(cp.esc_saida)].filter((v) => v != null);
    const fechado = txt(cp.status_ponto).toUpperCase() === "SEM_PONTO";
    const idsA = new Set(
      (reg.acoes || [])
        .flatMap((it, i) => (marcaDaOcorrencia(reg, marcas, i) === "A" ? it.ids || [] : []))
        .map(txt),
    );
    const aceitos = pedidosDaPrevia(reg.ajustes || []).filter((o) => idsA.has(txt(o.id_ocorrencia)));
    const sim = simulaCartao({
      batidas: reg.antesBruto,
      pedidos: aceitos.map(pedidoDoMotor),
      refs,
      cartaoFechado: fechado,
    });
    return encaixaEmQuatro(sim.batidas, reg.categoria).fica;
  }, [reg, marcas]);

  /* ── O CARTÃO: uma conta só, e ela mora fora daqui (`vereditoCartao.js`) ──── */
  const v = useMemo(
    () => (reg ? montaCompartimentos({ reg, marcas, manual, completar, ficaMontador }) : null),
    [reg, marcas, manual, completar, ficaMontador],
  );

  if (!reg || !v) return null;
  const travado = Boolean(reg.decJa) || gravando;
  // a trava de gravar é a de MARCAR (as quatro de `motivoSemDecisao`), nunca a do dia
  // inteiro: o dia MISTO e o dia com a simulação bloqueada são exatamente os que só se
  // resolvem por ocorrência.
  const travaMarcar = motivoSemDecisao(reg);
  const idsMarcados = (letra) =>
    (reg.acoes || []).flatMap((it, i) => (marcaDaOcorrencia(reg, marcas, i) === letra ? it.ids : []));
  const aceitarIds = idsMarcados("A");
  const rejeitarIds = idsMarcados("R");
  const semResposta = v.contagem.sem;
  const motivoBotao = reg.decJa
    ? `decisão já gravada: ${reg.decJa.aceito ? "aceito" : "recusado"} em ${reg.decJa.quando}`
    : travaMarcar
      ? travaMarcar
      : !reg.acoes?.length
        ? "não há pedido neste dia para julgar — este dia segue para a correção, na tela principal"
        : semResposta
          ? `falta responder ${semResposta} ocorrência(s): cada uma sai aceita ou recusada`
          : "";

  return (
    /* MODAL, como na ferramenta (app.js:638 monta em `modal-root`). O cabeçalho fica fixo e
       só o corpo rola, senão o X sai de vista. */
    <div
      className="rv-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Caso de ${reg.nome} em ${reg.dataBR}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <div className="dp-card rv-box oc-det-modal" style={{ borderColor: "var(--dp-accent)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ ...ROTULO_CARD, color: "var(--dp-accent)" }}>
              Veredito · {PORTA_DE(reg.temAviso ? "aviso" : "pedido").label}
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
          <div style={{ ...FILA, flexWrap: "nowrap" }}>
            {/* O CARTÃO DO DIA é para onde foi tudo o que saiu da coluna da direita: escala,
                régua, fontes, GPS, linha do tempo — e o Real manual, que é onde se crava a
                régua de verdade. Por isso ele CONTINUA aqui: é leitura, não lançamento. */}
            <BotaoAcao
              disabled={abrindoCartao}
              titulo="Abre o cartão do dia (o mesmo pop-up da Revisão e da Gordura): escala, fontes, sugestão, GPS, linha do tempo — e o Real manual do DP, o topo da régua."
              onClick={() => aoAbrirCartao(reg)}
            >
              {abrindoCartao ? "abrindo…" : "🗂 Cartão do dia"}
            </BotaoAcao>
            <BotaoAcao
              titulo="Imprime o histórico deste caso: o ponto, o alvo, o que ele pediu e a trilha. Sai do MESMO cartão que está na tela."
              onClick={imprimirHistorico}
            >
              🖨 Imprimir
            </BotaoAcao>
            <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar detalhe">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* O CARTÃO DO DIA NÃO ABRIU? O MOTIVO FICA AQUI, e não atrás do pop-up. */}
        {erroCartao ? (
          <div className="oc-mt-n forte" style={{ marginTop: 8 }} role="alert">
            ⚠ <b>O cartão do dia não abriu:</b> {erroCartao}
          </div>
        ) : null}

        <div className="rv-corpo oc-det-corpo">
          <div className="oc-det-grid">
            {/* ─────────────── ESQUERDA: O QUE ELE PEDIU ─────────────── */}
            <div className="dp-card">
              <div className="dp-muted" style={ROTULO_CARD}>O que ele pediu</div>
              {reg.acoes?.length ? (
                <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
                  {reg.acoes.map((it, i) => {
                    /* REFEIÇÃO TRAVADA — SÓ MOTORISTA. Ocorrência que mira o miolo dele é
                       recusada COM O MOTIVO: o almoço do motorista foi inserido por NÓS, no
                       passo da Refeição, e aceitar aqui prometeria uma mudança que nenhum
                       robô desta tela faz. */
                    const trancada = mioloTravado(reg.categoria) && pedidoMiraOMiolo(it);
                    return (
                      <ItemAcao
                        key={`${it.tipo}-${it.hora}-${i}`}
                        item={it}
                        marca={marcaDaOcorrencia(reg, marcas, i)}
                        travado={travado || trancada}
                        motivo={trancada ? MOTIVO_MIOLO : ""}
                        aoMarcar={(x) => setMarcas((m) => ({ ...m, [i]: x }))}
                      />
                    );
                  })}
                </ul>
              ) : (
                <p className="dp-muted" style={{ margin: "8px 0 0" }}>
                  Nenhum pedido neste crachá+dia — ele não mexeu no ponto depois do aviso.
                  <b> Não há veredito a dar aqui:</b> o dia segue para advertência e correção,
                  e o que vai ser lançado é o alvo ao lado — o mesmo que a gente cobrou no aviso.
                  O disparo é na tela principal.
                </p>
              )}
              <CravarAMao
                valores={manual}
                criticas={v.criticas}
                travado={travado}
                aoMudar={(chave, valor) => setManual((m) => ({ ...m, [chave]: valor }))}
              />
            </div>

            {/* ─────────────── DIREITA: O CARTÃO ─────────────── */}
            <div className="dp-card">
              <div className="dp-muted" style={ROTULO_CARD}>
                O cartão
                {/* DIA DA CORREÇÃO: o cartão não é uma projeção do que ele pediu, é o ALVO —
                    e quem escreve é o robô `ponto`, depois da advertência. Dizer isso aqui
                    evita a leitura errada de que a batida dele "ficou". */}
                {v.alvoManda ? (
                  <span style={{ marginLeft: 8, textTransform: "none", letterSpacing: 0 }}>
                    <Selo cor="accent" titulo="Este dia vai para a correção (recusado, ou sem pedido nenhum). O que se lança é o alvo publicado pela Revisão — o mesmo que foi cobrado no aviso —, não a batida que está no cartão hoje.">
                      é o alvo · o que a correção vai lançar
                    </Selo>
                  </span>
                ) : null}
              </div>
              <div className="oc-vd-blocos">
                {v.blocos.map((b) => (
                  <BlocoPonta
                    key={b.chave}
                    bloco={b}
                    aoDesfazer={() => setCompletar((c) => ({ ...c, [b.chave]: false }))}
                  />
                ))}
              </div>
              <CompletarComAlvo
                v={v}
                travado={travado}
                aoCompletar={(chave) => setCompletar((c) => ({ ...c, [chave]: true }))}
              />
              <ResumoDoCartao v={v} />
            </div>
          </div>

          {/* ─── OS DOIS CARTÕES DE REFERÊNCIA, nas MESMAS quatro colunas ───
              Largura total e alinhados slot a slot com os blocos acima: é assim que se lê de
              cima a baixo "ele bateu X, o alvo é Y, e o cartão vai ficar Z". Nada além
              destas duas linhas — escala, operação real e refeição estão no Cartão do dia. */}
          <div className="oc-vd-ref">
            <div className="oc-vd-ref-l">
              <span className="oc-vd-ref-k">Ponto (bateu)</span>
              <LinhaCartao horas={reg.slotsHoje} />
            </div>
            <div className="oc-vd-ref-l">
              <span className="oc-vd-ref-k">Alvo</span>
              <LinhaCartao horas={reg.regua} />
            </div>
          </div>

          {/* ─────────────── O RODAPÉ: UM BOTÃO ───────────────
              Ele grava o veredito POR OCORRÊNCIA (`marcar_ajustes`: A:/R: em `ajuste_ids`) e
              congela como contrato o cartão desenhado acima. O dia é consequência das
              marcas. O LANÇAMENTO — robô, advertência, correção — é na tela principal. */}
          <div className="oc-vd-rodape">
            <BotaoAcao
              tom={v.dia === "recusado" ? "erro" : "ok"}
              disabled={Boolean(motivoBotao) || (!aceitarIds.length && !rejeitarIds.length)}
              titulo={
                motivoBotao ||
                "Grava A:/R: por ocorrência em ajuste_ids (main.py:marcar_ajustes) e congela como contrato o cartão ao lado. O aceite do dia sai das marcas: havendo recusa, o dia fica recusado."
              }
              onClick={() => aoMarcar(reg, aceitarIds, rejeitarIds, v.contrato)}
            >
              Gravar veredito ({v.contagem.A} aceitar / {v.contagem.R} recusar)
            </BotaoAcao>
            <span style={MINI}>
              {v.dia === "recusado" ? (
                <>o dia fica <b>recusado</b></>
              ) : v.dia === "aceito" ? (
                <>o dia fica <b>aceito</b></>
              ) : (
                <span className="dp-faint">nada marcado ainda</span>
              )}
            </span>
            <span className="oc-vd-rodape-fim dp-faint" style={MINI}>
              o lançamento é na tela principal
            </span>
          </div>
          {motivoBotao ? (
            <div className="oc-mt-n dp-faint" style={{ marginTop: 4 }}>
              não dá para gravar: {motivoBotao}
            </div>
          ) : null}

          {/* O HISTÓRICO IMPRESSO: no DOM, escondido na tela e visível só no papel — é o
              mesmo caso aberto e o MESMO cartão, então o papel não tem como contar uma
              história diferente da que está na tela. */}
          <RelatorioCaso reg={reg} montado={{ fica: v.mins }} />
        </div>
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
  // Os dois eixos da aba "A decidir" (app.js `dfstatus` e `dt5`). O padrão é o do original.
  const [eixoStatus, setEixoStatus] = useState("PENDENTE");
  const [eixoData, setEixoData] = useState("TODAS");
  const [aberto, setAberto] = useState(null);
  // o chip clicado na aba "Advertências e correções" (TODOS · advertido · corrigido)
  const [sitDisc, setSitDisc] = useState("TODOS");
  // A CONTAGEM É O FILTRO também em "A decidir" — e aqui o corte é a RESPOSTA dele, porque
  // é ela que separa quem tem pedido para julgar de quem só tem prazo correndo.
  const [respFiltro, setRespFiltro] = useState("TODOS");
  const [gravando, setGravando] = useState(false);
  const [recado, setRecado] = useState("");
  const [versao, setVersao] = useState(0);
  const [disparando, setDisparando] = useState(false);
  const [resultadoRobo, setResultadoRobo] = useState(null);
  const [cartaoDia, setCartaoDia] = useState(null);
  const [abrindoCartao, setAbrindoCartao] = useState(false);
  // POR QUE O CARTÃO DO DIA NÃO ABRIU, DITO ONDE SE CLICOU (09/09/2026). O motivo ia só para
  // o `recado`, que é desenhado no topo da ABA — atrás do modal do caso. Daí "clico e não
  // acontece nada": a tela respondia num lugar que o próprio pop-up cobre.
  const [erroCartao, setErroCartao] = useState("");
  const [progresso, setProgresso] = useState(null);
  // recarga que NÃO tira a lista da tela (ver `buscar`)
  const [atualizando, setAtualizando] = useState(false);
  // Gravou alguma coisa DENTRO do cartão? A releitura da aba custa a varredura do lake por
  // dia — vale a pena UMA vez, ao fechar, e não a cada campo salvo.
  const cartaoGravou = useRef(false);

  /* ══ A MARCAÇÃO DA GRADE, E É UMA SÓ ════════════════════════════════════════
   * `selIds` (a ✔ da grade) NÃO decide nada — e desde 10/09/2026 é a ÚNICA marcação da
   * tela. Ela escopa o que age sobre linhas sem julgar nenhuma: executar o que já foi
   * decidido, conferir no Transnet (só leitura), cancelar o pedido e lançar dia sem ponto.
   * O `dec` (as caixinhas de aceitar/rejeitar) morreu com o lote de decisão: dois mecanismos
   * de marcação coexistiam e se ignoravam — "marcar sugestão" enchia um, "conferir marcados"
   * consumia o outro —, e o que decide agora é o veredito do caso. */
  const [selIds, setSelIds] = useState([]);

  // Esc fecha o caso, como qualquer pop-up.
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") setAberto(null); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  /**
   * DUAS RECARGAS, E A DIFERENÇA É A TELA — NÃO A CONSULTA.
   *
   * `carregar` é a de ENTRAR: não há o que mostrar, então o indicador toma a tela.
   * `atualizarSilencioso` é a de DEPOIS DE GRAVAR: a lista já está lá, o DP acabou de
   * decidir uma linha, e apagar tudo para remontar do zero é a pior hora de tirar a tela
   * dele — some o lugar onde ele estava, a rolagem volta pro topo e ele espera olhando
   * vazio. Aqui a lista FICA, com o dado velho, e só um "atualizando" discreto aparece na
   * barra até o dado novo chegar por baixo.
   *
   * A consulta é a mesma nas duas: quem decide não pode ficar com base desatualizada.
   */
  const buscar = useCallback(async (silencioso) => {
    if (silencioso) setAtualizando(true);
    else setCarregando(true);
    setProgresso(null);
    try {
      const dados = await carregarOcorrencias(
        silencioso ? undefined : (feitos, total) => setProgresso({ feitos, total }),
      );
      setBase(dados);
      setErro("");
    } catch (falha) {
      setErro(falha?.message || "Falha ao consultar a base DP360.");
    } finally {
      setCarregando(false);
      setAtualizando(false);
      setProgresso(null);
    }
  }, []);
  const carregar = useCallback(() => buscar(false), [buscar]);
  const atualizarSilencioso = useCallback(() => buscar(true), [buscar]);

  useEffect(() => {
    let ativo = true;
    carregarOcorrencias((feitos, total) => { if (ativo) setProgresso({ feitos, total }); })
      .then((dados) => { if (ativo) setBase(dados); })
      .catch((falha) => { if (ativo) setErro(falha?.message || "Falha ao consultar a base DP360."); })
      .finally(() => {
        if (!ativo) return;
        setCarregando(false);
        setProgresso(null);
      });
    return () => { ativo = false; };
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

  // As linhas da aba ANTES dos dois eixos próprios de "A decidir". A busca entra aqui
  // porque ela vale nas contagens de chip (o chip conta o que a pessoa está vendo).
  const daAba = useMemo(() => {
    const lista = linhasDaAba(porFuncao, porta, abaAtiva);
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((r) => r.nome.toLowerCase().includes(q) || r.cracha.toLowerCase().includes(q));
  }, [porFuncao, porta, abaAtiva, busca]);

  // Os dois eixos só existem na caixa de entrada da decisão do DP. Nas outras abas não há o
  // que filtrar por status — elas JÁ são um status.
  const temEixos = abaAtiva === ABA_DE_ENTRADA[porta] && abaAtiva !== "coment";

  // As datas presentes NAS LINHAS DA ABA (não a janela de 70 dias) — o `revd` do original.
  const datasDaAba = useMemo(() => {
    if (!temEixos) return [];
    return [...new Set(daAba.map((r) => r.iso).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  }, [daAba, temEixos]);

  // Data escolhida que sumiu da lista não pode deixar a aba vazia sem explicação.
  const dataAtiva = datasDaAba.includes(eixoData) ? eixoData : "TODAS";

  const noRecorteDeData = useMemo(
    () => (dataAtiva === "TODAS" ? daAba : daAba.filter((r) => r.iso === dataAtiva)),
    [daAba, dataAtiva],
  );

  // CONTAGEM DE CHIP = o efeito de mudar AQUELE eixo, mantendo o resto dos filtros (é assim
  // na Refeição, na Gordura e na Fraudes). Por isso a função, a busca e a data entram na
  // conta, e o eixo do status NÃO entra na sua própria conta.
  const contEixo = useMemo(() => {
    if (!temEixos) return { PENDENTE: 0, TODOS: 0 };
    const pendentes = noRecorteDeData.filter((r) => !r.decJa).length;
    return { PENDENTE: pendentes, TODOS: noRecorteDeData.length };
  }, [noRecorteDeData, temEixos]);

  const naAba = useMemo(
    () => (temEixos ? noRecorteDeData.filter(porEixoStatus(eixoStatus)) : daAba),
    [daAba, noRecorteDeData, temEixos, eixoStatus],
  );

  /* ── AS CONTAGENS SÃO O FILTRO (app.js:3009) ──────────────────────────────────
   * Régua da ferramenta, dita lá com todas as letras: "elas já diziam quanto tem de cada
   * coisa e não faziam nada — clicar era o passo óbvio que faltava". Na aba de Advertências
   * e correções são dois desfechos e mais nada: ⚠ advertido e 🔧 corrigido. Clicar de novo
   * no mesmo chip volta para todos. */
  const respostaDe = (r) =>
    r.situacaoAviso === "vencido" ? "vencido" : r.nAjustes ? "resp" : "semresp";
  const linhas = useMemo(() => {
    if (abaAtiva === "disc" && sitDisc !== "TODOS") return naAba.filter((r) => r.situacao === sitDisc);
    if (respFiltro !== "TODOS") return naAba.filter((r) => respostaDe(r) === respFiltro);
    return naAba;
  }, [naAba, abaAtiva, sitDisc, respFiltro, porta]);

  // Filtro que sobrevive à navegação é como se abre uma aba que parece vazia — e como se
  // aplica uma decisão de outra aba sem ver a linha.
  const zerar = () => {
    setEixoStatus("PENDENTE");
    setEixoData("TODAS");
    setSitDisc("TODOS");
    setRespFiltro("TODOS");
    setAberto(null);
    setSelIds([]);
  };
  const trocarPorta = (id) => {
    setPorta(id);
    setAba((ABAS[id] || ABAS.pedido)[0][0]);
    zerar();
  };
  const trocarAba = (id) => {
    setAba(id);
    zerar();
  };

  // O recado do robô é DAQUELE caso: trocar de caso sem limpar faria o resultado de um
  // disparo aparecer no rodapé de outra pessoa.
  /* ── O ROBÔ ESTÁ RODANDO? ENTÃO A TELA AVISA (09/09/2026, pedido do dono) ─────
   * "Execução pendente" dizia que 63 casos esperavam o bot e a tela não dizia se o bot
   * estava a caminho — e a saída natural de quem não sabe é clicar de novo, que no Transnet
   * significa lançar duas vezes na ficha de alguém.
   *
   * A fonte é a trilha do disparo (`dp360_robo_execucao`), gravada pelo gateway ANTES do
   * POST no GitHub: `run_status` vem do run casado (queued · in_progress · completed) e
   * `run_conclusao` do desfecho. Ela é do INOVE, não do lake.
   *
   * HONESTIDADE DO STATUS: ele é o do momento do casamento e não se atualiza sozinho — por
   * isso a faixa mostra a HORA do disparo e o link do run, em vez de afirmar "está rodando
   * agora" com um dado que pode ter envelhecido. Sem trilha (ou sem permissão), some. */
  const [execRobo, setExecRobo] = useState([]);
  const lerExecucoes = useCallback(async () => {
    /* DUAS FONTES, E A SEGUNDA É A QUE FALTAVA (09/09/2026, o dono: "não do INOVE, mas da
     * ferramenta"). A trilha só conhece o que sai daqui; o robô também é disparado pelo app
     * do PC, direto no GitHub. Para quem olha a fila tanto faz quem mandou — o que importa é
     * se tem bot no Transnet agora. Então o GITHUB manda, e a trilha entra só para dizer
     * QUEM disparou quando o run saiu daqui. */
    const [trilha, runs] = await Promise.all([
      supabase
        .from("dp360_robo_execucao")
        .select("id,robo,confirmar,disparado_em,autor_nome,run_id,run_url")
        .gte("disparado_em", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
        .order("disparado_em", { ascending: false })
        .limit(20)
        .then((r) => r.data || [])
        .catch(() => []),
      statusRoboDP360(6).catch(() => []),
    ]);
    const porRun = new Map((trilha || []).map((x) => [String(x.run_id ?? ""), x]));
    setExecRobo(
      (runs || []).map((x) => {
        const daqui = porRun.get(String(x.id ?? ""));
        return {
          id: x.id,
          robo: x.nome || "robô",
          confirmar: daqui ? daqui.confirmar : true,
          disparado_em: x.comecou_em,
          autor_nome: daqui?.autor_nome || (x.ator ? `${x.ator} (GitHub)` : ""),
          daqui: Boolean(daqui),
          run_url: x.url,
          run_status: x.status,
          run_conclusao: x.conclusao,
        };
      }),
    );
  }, []);
  useEffect(() => { lerExecucoes(); }, [lerExecucoes, versao]);

  const abrir = (reg) => {
    setResultadoRobo(null);
    setErroCartao("");
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
        // A ✔ é PRÉ-AÇÃO sobre o estado que acabou de mudar: mantê-la depois de gravar é
        // oferecer um segundo clique sobre um dado velho.
        setSelIds([]);
        setVersao((v) => v + 1);
        await atualizarSilencioso();
      } catch (e) {
        // o erro REAL do gateway (o dp360Api já desembrulha o motivo do 4xx)
        setRecado(`Falhou: ${e?.message || e}`);
      } finally {
        setGravando(false);
      }
    },
    [atualizarSilencioso],
  );

  const aoAceitar = useCallback(
    (reg) => {
      const trava = motivoForaDoLote(reg, "aceitar");
      if (trava) { setRecado(`Não dá para aceitar: ${trava}.`); return; }
      const marcado = selosDaMarcacao(reg);
      const contrato =
        reg.bloqueio || ![2, 4].includes((reg.depois || []).length) ? "" : textoBatidas(reg.depois);
      if (
        !confirmar(
          `ACEITAR o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}).\n\n` +
            (marcado
              ? `⚠ ESTE DIA JÁ ESTÁ MARCADO por ocorrência (${marcado.nA} aceitar / ${marcado.nR} recusar).\n` +
                `Aceitar o dia inteiro APAGA essa marcação: ajuste_ids é reescrito com os ${reg.nAjustes} ids SEM prefixo.\n` +
                `Para valer o que você marcou, cancele e use "Lançar esta marcação".\n\n`
              : "") +
            `Grava em ponto_caso: aceite=aceito, ajuste=certo, aceito_em, ajuste_ids (${reg.nAjustes} ocorrência(s)).\n` +
            `Contrato antes/depois: ${reg.antesTexto || "—"} → ${contrato || "— (nada congelado)"}.\n\n` +
            `NÃO roda o robô: gravar é um passo, executar é outro.`,
        )
      )
        return;
      executarGravacao(`Aceite gravado (${reg.nome} · ${reg.dataBR})`, () => gravarAceite(reg));
    },
    [executarGravacao],
  );

  const aoRejeitar = useCallback(
    (reg, modo) => {
      const trava = motivoSemDecisao(reg);
      if (trava) { setRecado(`Não dá para recusar: ${trava}.`); return; }
      // TRAVA DA ADVERTÊNCIA INDEVIDA: sem aviso registrado, a recusa é sempre 'dispensada'.
      if (modo === "completo" && !reg.temAviso) {
        setRecado("Sem aviso registrado neste crachá+dia: recusar aqui não pode virar advertência.");
        return;
      }
      const modoReal = reg.temAviso ? modo : "rejeitar";
      const marcado = selosDaMarcacao(reg);
      const texto =
        (marcado
          ? `⚠ ESTE DIA JÁ ESTÁ MARCADO por ocorrência (${marcado.nA}✓ ${marcado.nR}✗) — recusar o dia inteiro APAGA a marcação.\n\n`
          : "") +
        (modoReal === "completo"
          ? `REJEITAR o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}) MANTENDO a cadeia de advertência e correção.\n\n` +
            `Existe aviso registrado neste crachá+dia, então esta recusa PODE virar ADVERTÊNCIA depois.\n` +
            `Grava: aceite=rejeitado, ajuste=errado, correcao_status="" (vazio = segue o fluxo).\n\n` +
            `A advertência e a correção continuam sendo do robô, e o robô NÃO é disparado aqui.`
          : `REJEITAR o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}) e ENCERRAR.\n\n` +
            `Grava: aceite=rejeitado, ajuste=errado, correcao_status="dispensada".\n` +
            `"dispensada" tira o caso da fila de advertência E de correção — para sempre.\n\n` +
            `${reg.temAviso ? "Há aviso no dia, mas você está escolhendo NÃO advertir." : "Não há aviso no dia: recusar não é advertir."}`);
      if (!confirmar(texto)) return;
      executarGravacao(`Recusa gravada (${reg.nome} · ${reg.dataBR})`, () => gravarRecusa(reg, modoReal));
    },
    [executarGravacao],
  );

  const aoDesfazer = useCallback(
    (reg) => {
      if (reg.decJa?.subiu) {
        setRecado("O bot já executou este caso no Transnet: desfazer aqui não desfaz lá.");
        return;
      }
      if (!confirmar(
        `DESFAZER a decisão do dia ${reg.dataBR} de ${reg.nome}.\n\n` +
          `Grava: aceite=pendente, ajuste=null, aceito_em=null. O caso volta para a fila.`,
      )) return;
      executarGravacao(`Decisão desfeita (${reg.nome} · ${reg.dataBR})`, () => gravarDesfazer(reg));
    },
    [executarGravacao],
  );

  const aoMarcar = useCallback(
    (reg, aceitarIds, rejeitarIds, cartaoDoMontador) => {
      const trava = motivoSemDecisao(reg);
      if (trava) { setRecado(`Não dá para marcar: ${trava}.`); return; }
      if (!aceitarIds.length && !rejeitarIds.length) { setRecado("Nenhuma marcação."); return; }
      // O CARTÃO VAI NA CONFIRMAÇÃO porque é ELE que fica congelado como contrato — é o que
      // o DP acabou de ver no card do montador, e é contra ele que o robô confere.
      const contrato = txt(cartaoDoMontador);
      if (!confirmar(
        `MARCAR POR OCORRÊNCIA o dia ${reg.dataBR} de ${reg.nome}.\n\n` +
          `Aceitar: ${aceitarIds.join(", ") || "—"}\nRejeitar: ${rejeitarIds.join(", ") || "—"}\n\n` +
          `Cartão congelado como contrato (o do card do montador): ${reg.antesTexto || "—"} → ` +
          `${contrato || "— (nada congelado: sem aceite, ou a projeção não fecha em 2/4)"}\n\n` +
          `Grava ajuste_ids com A:/R: e o dia como ${rejeitarIds.length ? "RECUSADO" : "ACEITO"} ` +
          `(havendo recusa, a recusa manda). correcao_status NÃO é tocado — a porta da correção fica aberta.

` +
          `O caso sai de "A decidir" e cai na FILA DE LANÇAMENTO. Nada vai ao Transnet agora: ` +
          `o robô é disparado de lá, com a ✔ e o botão "Executar marcados".`,
      )) return;
      executarGravacao(`Marcação gravada (${reg.nome} · ${reg.dataBR})`, () =>
        gravarMarcacao(reg, aceitarIds, rejeitarIds, contrato),
      );
    },
    [executarGravacao],
  );

  /* ── FECHAR À MÃO o caso que o robô não conseguiu (main.py:8289) ────────────
   * A confirmação diz os campos EXATOS de cada desfecho, porque os dois gravam coisas
   * diferentes e a diferença é o histórico da pessoa: um diz que o ponto foi corrigido, o
   * outro diz que o dia vai ficar errado. */
  const aoFecharAMao = useCallback(
    (reg, como, nota) => {
      const trava = motivoSemFechamentoManual(reg);
      if (trava) { setRecado(`Não dá para fechar à mão: ${trava}.`); return; }
      const cfg = desfechoForaDoRobo(como);
      if (!cfg) { setRecado("Diga o que houve: 'lancado_a_mao' ou 'nao_da'."); return; }
      const obs = txt(nota);
      const notaFinal = `${cfg.nota}${obs ? ` — ${obs}` : ""}`.slice(0, 200);
      const cabeca =
        como === "lancado_a_mao"
          ? `FECHAR À MÃO como CORRIGIDO o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}).\n\n` +
            `Você está dizendo que ALGUÉM FOI AO TRANSNET E LANÇOU.`
          : `FECHAR À MÃO como PONTO FECHADO o dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}).\n\n` +
            `Você está dizendo que O TRANSNET NÃO ACEITA ESSE DIA (competência encerrada). ` +
            `O dia VAI FICAR ERRADO, e fica registrado como tal — não como pendência.`;
      const campos =
        como === "lancado_a_mao"
          ? `Grava: correcao_status="corrigido", correcao_final_em=agora, usuario="${notaFinal}".`
          : `Grava: correcao_status="ponto_fechado", usuario="${notaFinal}".\n` +
            `NÃO grava correcao_final_em: o ponto NÃO foi corrigido, e dizer que foi seria mentir no histórico.`;
      if (!confirmar(
        `${cabeca}\n\n${campos}\n\n` +
          `NÃO muda a decisão gravada (aceite=${txt(reg.ciclo?.aceite) || "—"}), não toca no cartão, ` +
          `não inventa horário e NÃO dispara robô nenhum.`,
      )) return;
      executarGravacao(`Caso fechado à mão · ${cfg.status} (${reg.nome} · ${reg.dataBR})`, () =>
        gravarForaDoRobo(reg, como, nota),
      );
    },
    [executarGravacao],
  );

  /* ── O CARTÃO DO DIA — o pop-up COMPARTILHADO. Nada é gravado por aqui: quem grava é o
   * próprio cartão (Real manual, ponto conferido, pedido de exclusão), com as travas dele. */
  const abrirCartaoDoDia = useCallback(async (reg) => {
    if (!reg) return;
    setAbrindoCartao(true);
    setRecado("");
    setErroCartao("");
    try {
      const dados = await lerCartaoDoDia(reg.cracha, reg.iso);
      if (!dados) {
        const motivo = `Sem linha em ponto_diario para ${reg.nome} · ${reg.dataBR} — não há cartão do dia para abrir.`;
        setRecado(motivo);
        setErroCartao(motivo);
        return;
      }
      cartaoGravou.current = false;
      setCartaoDia(dados);
    } catch (e) {
      const motivo = `Falhou: ${e?.message || e}`;
      setRecado(motivo);
      setErroCartao(motivo);
    } finally {
      setAbrindoCartao(false);
    }
  }, []);

  /* O `aoRecarregar` do cartão: relê a LINHA do banco (o cartão nunca pinta estado
   * otimista). A ABA inteira NÃO é relida aqui — a varredura do lake custa segundos e o
   * AbaShell trocaria os filhos pelo "carregando" com o pop-up aberto por cima. Ela é
   * relida UMA vez, ao FECHAR: o Real manual é o topo da cascata da régua, e a grade atrás
   * não pode ficar mostrando o veredito de antes do horário cravado. */
  const recarregarCartaoDoDia = useCallback(async (cracha, dia) => {
    const dados = await lerCartaoDoDia(cracha, dia);
    if (dados) setCartaoDia(dados);
    cartaoGravou.current = true;
  }, []);

  const fecharCartaoDoDia = useCallback(() => {
    setCartaoDia(null);
    if (!cartaoGravou.current) return;
    cartaoGravou.current = false;
    setRecado("Cartão do dia fechado — relendo a fila com o que foi cravado…");
    carregar();
  }, [carregar]);

  const aoComoAlteracao = useCallback(
    (reg, proj) => {
      const trava = motivoSemComoAlteracao(reg, proj);
      if (trava) { setRecado(`Não dá para recusar e corrigir assim: ${trava}.`); return; }
      const horas = proj.pontos.map(min2hm);
      const campos =
        horas.length === 4
          ? `entrada=${horas[0]}, alm_saida=${horas[1]}, alm_volta=${horas[2]}, saida=${horas[3]}`
          : `entrada=${horas[0]}, saida=${horas[1]} (sem almoço)`;
      if (!confirmar(
        `RECUSAR os ${proj.ids.length} pedido(s) do dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}) ` +
          `E CRAVAR O CARTÃO CERTO.\n\n` +
          `Do jeito que vieram eles quebram o cartão: a ponta já tem batida, então inserir ` +
          `acrescenta em vez de corrigir. O certo era ALTERAR.\n\n` +
          `Cartão que fica como alvo da correção: ${reg.antesTexto || "—"} → ${proj.texto}\n\n` +
          `Grava em ponto_caso: aceite=rejeitado, ajuste=errado, ajuste_ids=R:${proj.ids.join(",R:")}, ` +
          `correcao_status="pendente" (NUNCA "dispensada" — ela fecharia a porta da correção).\n` +
          `Grava em ponto_real_manual: ${campos} — é ele que vira a régua e o alvo.\n\n` +
          `NÃO roda robô nenhum.`,
      )) return;
      executarGravacao(`Recusado e cartão certo cravado (${reg.nome} · ${reg.dataBR})`, () =>
        gravarComoAlteracao(reg, proj.ids, proj.pontos),
      );
    },
    [executarGravacao],
  );

  /* ── LANÇAR DIA SEM PONTO — robô `ocorrencias`, o MESMO da Folgas.
   * A garantia que é do original: o CARTÃO É RELIDO antes do disparo (main.py:4415). */
  const aoLancarDiaSemPonto = useCallback(
    async (regs, tipo, valendo, noCasoAberto = false) => {
      const lista = (regs || []).filter(Boolean);
      // ONDE O RECADO APARECE é dito pelo CHAMADOR: ver o resultado de um disparo da barra
      // brotar no rodapé de OUTRO caso aberto faz alguém achar que lançou quem não lançou.
      const avisar = (tipoAviso, texto, painel) => {
        if (noCasoAberto) setResultadoRobo({ tipo: tipoAviso, texto, painel: painel || "" });
        setRecado(texto);
      };
      if (!lista.length) { avisar("erro", "Nenhum dia sem ponto selecionado."); return; }
      if (!TIPO_DIA_LBL[txt(tipo)]) {
        avisar("erro", "Escolha o tipo: DSR (05), Compensação (40) ou Curso (29).");
        return;
      }
      const nomes =
        lista.slice(0, 12).map((r) => `· ${r.nome} ${r.dataBR}`).join("\n") +
        (lista.length > 12 ? `\n… e mais ${lista.length - 12}` : "");
      if (!confirmar(
        `${valendo ? "LANÇAR DE VERDADE no Transnet" : "ENSAIO (o robô navega e NÃO confirma)"}: ` +
          `${lista.length} dia(s) SEM PONTO como ${rotuloTipoDia(tipo)}.\n\n${nomes}\n\n` +
          `Nenhum destes dias tem batida no cartão — não é corrigir ponta, é dizer o que aconteceu. ` +
          `O tipo é a SUA decisão: nenhuma fonte responde isso.\n\n` +
          `Robô: ocorrencias (o mesmo da Folgas) · CSV cracha,data,tipo.\n` +
          `${valendo ? "Lança na ficha do colaborador. O resultado por dia NÃO volta sozinho: fica no run." : "Nada é confirmado e nada é gravado."}\n` +
          `O cartão de cada dia é RELIDO antes do disparo — quem tiver ganhado batida fica de fora.`,
      )) return;

      setDisparando(true);
      if (noCasoAberto) setResultadoRobo(null);
      setRecado("");
      try {
        const { ok, barrados } = await conferirDiasSemBatida(lista);
        if (!ok.length) {
          avisar("erro", `Nenhum dia elegível: ${barrados.length} tem batida no cartão agora — não é dia sem ponto.`);
          return;
        }
        const csv = csvDiasSemPonto(
          ok.map((r) => ({ cracha: cra8(r.cracha), data: ddmmaaaa(r.iso), tipo: txt(tipo) })),
        );
        const r = await dispararRoboDP360("ocorrencias", { csv, confirmar: valendo ? "true" : "false" });
        avisar(
          "ok",
          `${valendo ? "Lançamento" : "Ensaio"} disparado — ${ok.length} dia(s) como ${rotuloTipoDia(tipo)}.` +
            (barrados.length ? ` ${barrados.length} ficou/ficaram de fora: o cartão ganhou batida.` : "") +
            ` O resultado por dia NÃO volta sozinho: a evidência fica no run.`,
          r?.painel || "",
        );
        await atualizarSilencioso();
      } catch (e) {
        avisar("erro", `Falhou: ${e?.message || "Não foi possível disparar o robô."}`);
      } finally {
        setDisparando(false);
      }
    },
    [atualizarSilencioso],
  );

  /* ── EXECUÇÃO: manda ao robô uma decisão JÁ GRAVADA, um crachá+dia por vez ──
   * 1. só executa o que já foi DECIDIDO (motivoSemExecucao é o mesmo filtro do bot);
   * 2. o ESCOPO viaja sempre — escopo vazio faria o workflow rodar a fila inteira;
   * 3. ENSAIO e VALENDO são chamadas diferentes, cada uma com a sua confirmação;
   * 4. o erro que aparece é o do gateway, e a tela recarrega depois. */
  const aoExecutarRobo = useCallback(
    async (reg, valendo) => {
      const trava = motivoSemExecucao(reg);
      if (trava) { setResultadoRobo({ tipo: "erro", texto: `Não dá para executar: ${trava}.` }); return; }
      const casos = casosDoRegistro(reg);
      if (!casos) {
        setResultadoRobo({
          tipo: "erro",
          texto: "Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow rodar a fila inteira.",
        });
        return;
      }
      const plano = planoDaExecucao(reg);
      const rotulo = rotuloDaExecucao(reg);
      if (!confirmar(
        `${valendo ? `EXECUTAR DE VERDADE no Transnet — ${rotulo}.` : `ENSAIO (o robô navega, marca e NÃO clica) — ${rotulo}.`}\n\n` +
          `Pessoa: ${reg.nome} (${reg.cracha}) · dia ${reg.dataBR}.\n` +
          `Decisão já gravada: aceite=${txt(reg.ciclo.aceite)}` +
          `${txt(reg.ciclo.correcao_status) ? `, correcao_status=${txt(reg.ciclo.correcao_status)}` : ""}.\n\n` +
          `O robô vai aceitar ${plano.aceitar.length} e rejeitar ${plano.rejeitar.length} ocorrência(s)` +
          `${plano.jaResolvidos.length ? ` (${plano.jaResolvidos.length} o Transnet já resolveu — só confere)` : ""}.\n` +
          `Robô: ajustes · modo "${MODO_EXECUTAR}" · casos = 1 crachá+dia (só este).\n` +
          `${valendo ? "Ele carimba conferido_em em ponto_caso — é esse carimbo que trava o dia." : "Nada é clicado e nada é carimbado."}\n\n` +
          `${reg.temAviso && txt(reg.ciclo.aceite) === "rejeitado" && txt(reg.ciclo.correcao_status) !== "dispensada"
            ? "Esta recusa MANTÉM o caso na cadeia de advertência e correção — mas o robô NÃO envia a advertência nem corrige o cartão."
            : "A advertência e a correção do cartão continuam fora desta tela."}`,
      )) return;

      setDisparando(true);
      setResultadoRobo(null);
      setRecado("");
      try {
        const r = await dispararRoboDP360("ajustes", {
          modo: MODO_EXECUTAR, casos, confirmar: valendo ? "true" : "false",
        });
        const texto =
          `${valendo ? "Execução" : "Ensaio"} disparado — ${reg.nome} · ${reg.dataBR}` +
          ` (${plano.aceitar.length} aceitar / ${plano.rejeitar.length} rejeitar).` +
          ` O resultado não volta sozinho: a prova fica no run.`;
        setResultadoRobo({ tipo: "ok", texto, painel: r?.painel || "" });
        setRecado(texto);
        await atualizarSilencioso();
      } catch (e) {
        const motivo = e?.message || "Não foi possível disparar o robô.";
        setResultadoRobo({ tipo: "erro", texto: `Falhou: ${motivo}` });
        setRecado(`Falhou: ${motivo}`);
      } finally {
        setDisparando(false);
      }
    },
    [atualizarSilencioso],
  );

  /* ── EXECUTAR EM LOTE — o passo que faltava (09/09/2026) ─────────────────────
   * O dono, olhando 63 casos parados: "mas não podia ficar em pronto para executar, tinha
   * que ter executado lá — alguma coisa aconteceu". Aconteceu isto: na FERRAMENTA o
   * "Aplicar decisões" grava E dispara o bot no mesmo clique (`app/ui/app.js:377`:
   * `executar_decisoes` logo depois dos `confirmar_*`, sob o aviso "Aplicar no Transnet
   * agora — isso altera o ponto de verdade"). O porte parou na gravação e mandou executar
   * caso a caso, no pop-up: 64 decisões viraram 64 aberturas que ninguém faz. A fila
   * decidiu e parou.
   *
   * UM DISPARO, N CASOS — não N disparos: o robô `ajustes` recebe a lista de crachá+dia no
   * `casos` (é o mesmo caminho do cancelamento em lote), então o escopo continua fechado e
   * o run é um só. As travas são as MESMAS de um caso (`motivoSemExecucao`), linha a linha,
   * e uma linha travada recusa o lote inteiro em vez de sair calada. */
  const aoExecutarLote = useCallback(
    async (regs) => {
      const lista = (regs || []).filter(Boolean);
      if (!lista.length) { setRecado("Marque as linhas que o robô deve executar."); return; }
      const bloqueados = lista.map((r) => ({ r, motivo: motivoSemExecucao(r) })).filter((x) => x.motivo);
      if (bloqueados.length) {
        setRecado(
          `Lote recusado — ${bloqueados.length} caso(s) não podem ir ao robô: ` +
            bloqueados.slice(0, 6).map((x) => `${x.r.nome} ${x.r.dataBR} (${x.motivo})`).join(" · ") +
            (bloqueados.length > 6 ? " …" : "") + ".",
        );
        return;
      }
      const casos = casosDeRegistros(lista);
      if (!casos) {
        setRecado("Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow rodar a fila inteira.");
        return;
      }
      const soma = lista.reduce(
        (acc, r) => {
          const p = planoDaExecucao(r);
          return { a: acc.a + p.aceitar.length, r: acc.r + p.rejeitar.length, j: acc.j + p.jaResolvidos.length };
        },
        { a: 0, r: 0, j: 0 },
      );
      const comAviso = lista.filter((r) => r.temAviso && txt(r.ciclo.aceite) === "rejeitado"
        && txt(r.ciclo.correcao_status) !== "dispensada").length;
      if (!confirmar(
        `EXECUTAR DE VERDADE no Transnet — ${lista.length} crachá+dia.

` +
          lista.slice(0, 12).map((r) => `· ${r.nome} ${r.dataBR}`).join("\n") +
          (lista.length > 12 ? `\n… e mais ${lista.length - 12}` : "") + "\n\n" +
          `O robô vai aceitar ${soma.a} e rejeitar ${soma.r} ocorrência(s)` +
          `${soma.j ? ` (${soma.j} o Transnet já resolveu — só confere)` : ""}.\n` +
          `Robô: ajustes · modo "${MODO_EXECUTAR}" · casos = ${lista.length} crachá+dia (só estes), em UM disparo.\n` +
          "Ele carimba conferido_em em ponto_caso — é esse carimbo que tira o caso da \"Fila de lançamento\".\n\n" +
          (comAviso
            ? `ATENÇÃO: ${comAviso} recusa(s) MANTÊM o caso na cadeia de advertência e correção — mas o robô NÃO envia a advertência nem corrige o cartão. Isso continua fora desta tela.`
            : "A advertência e a correção do cartão continuam fora desta tela."),
      )) return;

      setDisparando(true);
      setRecado("");
      try {
        const r = await dispararRoboDP360("ajustes", { modo: MODO_EXECUTAR, casos, confirmar: "true" });
        setRecado(
          `Execução disparada — ${lista.length} crachá+dia (${soma.a} aceitar / ${soma.r} rejeitar).` +
            " O resultado não volta sozinho: a prova fica no run." + (r?.painel ? ` ${r.painel}` : ""),
        );
        setSelIds([]);
        await lerExecucoes();
        await atualizarSilencioso();
      } catch (e) {
        setRecado(`Falhou: ${e?.message || "não foi possível disparar o robô."}`);
      } finally {
        setDisparando(false);
      }
    },
    [atualizarSilencioso, lerExecucoes],
  );

  /* ── CONFERÊNCIA: lê o cartão ao vivo, NÃO mexe no Transnet ────────────────
   * Dois escopos, um handler: as linhas MARCADAS na ✔ e o CASO ABERTO. O `confirmar` não
   * liga escrita no Transnet — liga a escrita no NOSSO banco. */
  const aoConferirRobo = useCallback(
    async (regs, valendo, noCasoAberto = false) => {
      const lista = (regs || []).filter(Boolean);
      const avisar = (texto) => {
        if (noCasoAberto) setResultadoRobo({ tipo: "erro", texto });
        setRecado(texto);
      };
      if (!lista.length) { avisar("Nenhuma linha marcada para conferir."); return; }
      const bloqueados = lista.map((r) => ({ r, motivo: motivoSemConferencia(r) })).filter((x) => x.motivo);
      if (bloqueados.length) {
        avisar(
          `Não dá para conferir — ${bloqueados.length} caso(s) fora da fila do bot: ` +
            bloqueados.slice(0, 6).map((x) => `${x.r.nome} ${x.r.dataBR} (${x.motivo})`).join(" · ") +
            (bloqueados.length > 6 ? " …" : "") + ".",
        );
        return;
      }
      const casos = casosDeRegistros(lista);
      if (!casos) {
        avisar("Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow conferir a fila inteira.");
        return;
      }
      const nomes =
        lista.slice(0, 12).map((r) => `· ${r.nome} ${r.dataBR}`).join("\n") +
        (lista.length > 12 ? `\n… e mais ${lista.length - 12}` : "");
      if (!confirmar(
        `${valendo ? "CONFERIR E FECHAR NO NOSSO BANCO" : "CONFERIR — ENSAIO (só lê e mostra)"}: ` +
          `${lista.length} crachá+dia.\n\n${nomes}\n\n` +
          `O robô abre o CARTÃO ao vivo e compara com o contrato congelado.\n` +
          `EM NENHUM DOS DOIS BOTÕES ele muda alguma coisa no Transnet.\n\n` +
          `${valendo
            ? "Valendo, o que bater é fechado NO NOSSO BANCO: conferido_em, aviso_conferido_em e o veredito — e o dia que o Transnet não aceita vira correcao_status='ponto_fechado'. É esse carimbo que tira o caso da \"Fila de lançamento\"."
            : "No ensaio nada é gravado: nem no Transnet, nem no nosso banco."}\n\n` +
          `Robô: ajustes · modo "${MODO_CONFERIR}" · casos = ${lista.length} crachá+dia (só estes).`,
      )) return;

      setDisparando(true);
      if (noCasoAberto) setResultadoRobo(null);
      setRecado("");
      try {
        const r = await dispararRoboDP360("ajustes", {
          modo: MODO_CONFERIR, casos, confirmar: valendo ? "true" : "false",
        });
        const texto =
          `Conferência ${valendo ? "valendo" : "em ensaio"} disparada — ${lista.length} crachá+dia.` +
          ` ${valendo ? "O bot carimba conferido_em durante o run — recarregue daqui a pouco." : "A leitura fica no log do run."}`;
        if (noCasoAberto) setResultadoRobo({ tipo: "ok", texto, painel: r?.painel || "" });
        setRecado(texto);
        await atualizarSilencioso();
      } catch (e) {
        const motivo = e?.message || "Não foi possível disparar o robô.";
        if (noCasoAberto) setResultadoRobo({ tipo: "erro", texto: `Falhou: ${motivo}` });
        setRecado(`Falhou: ${motivo}`);
      } finally {
        setDisparando(false);
      }
    },
    [atualizarSilencioso],
  );

  /* O LOTE DE DECISÃO FOI EMBORA (10/09/2026) — e com ele "Marcar sugestão", "Aplicar
   * decisões" e o disparo que vinha grudado na gravação.
   *
   * Os três serviam a uma tela que decidia de fora: a sugestão marcava dezenas de dias pelo
   * `diaStatus`, o aplicar gravava tudo e já mandava o robô no mesmo clique. Ninguém via o
   * cartão que aquela decisão produzia — e o cartão é o contrato que o robô vai escrever no
   * Transnet. Agora o veredito é no caso, um por um, e ele já grava o lado do dia — o caso
   * cai na aba "Fila de lançamento", onde o disparo é explícito.
   *
   * A ✔ da grade (`selIds`) é o que escopa os lotes que restaram: executar, conferir,
   * cancelar e lançar dia sem ponto. Nenhum deles julga nada. */

  /* ── CANCELAR SELECIONADOS (docs/ALTERACAO_FILA_OCORRENCIAS_SUPABASE.md) ────
   * A SELEÇÃO É A MESMA CAIXINHA, E O LADO NÃO IMPORTA. As caixas de Aceitar e Rejeitar
   * dizem, aqui, apenas QUAIS colaboradores e dias entram no lote — cancelar não é
   * "rejeitar em massa": é desistir do pedido no Transnet e fechar o caso.
   *
   * Por isso ele também não passa pelas travas do lote de decisão: elas existem para
   * proteger quem vai DECIDIR (dia misto, simulação bloqueada, recusa que vira
   * advertência). Cancelar não decide nada e não adverte ninguém.
   *
   * Quem confere se ainda há o que recusar é o ROBÔ, na grade ao vivo — a tela nunca
   * afirma isso a partir do lake, que é foto de D-1.
   */
  const aoCancelarSelecionados = useCallback(
    async (valendo, regs = null, noCasoAberto = false) => {
      // DOIS ESCOPOS, UM HANDLER: as linhas MARCADAS na grade, ou o CASO ABERTO (que manda
      // a si mesmo). O recado do caso aberto vai para o rodapé do pop-up — o `recado` da
      // aba fica ATRÁS do modal, e ali "clico e não acontece nada" outra vez.
      const dizer = (texto, erro = false) => {
        if (noCasoAberto) setResultadoRobo({ tipo: erro ? "erro" : "ok", texto });
        else setRecado(texto);
      };
      const lista = regs?.length ? regs.filter(Boolean) : [];
      if (!lista.length) {
        dizer("Marque na ✔ da grade quais dias entram no cancelamento.", true);
        return;
      }
      const casos = casosDeRegistros(lista);
      if (!casos) {
        dizer(
          "Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow rodar a fila inteira.",
          true,
        );
        return;
      }
      const nomes =
        lista.slice(0, 12).map((r) => `· ${r.nome} ${r.dataBR}`).join("\n") +
        (lista.length > 12 ? `\n… e mais ${lista.length - 12}` : "");
      if (
        !confirmar(
          `${valendo ? "CANCELAR DE VERDADE no Transnet" : "ENSAIO (o robô lê a grade e NÃO clica)"}: ` +
            `${lista.length} crachá+dia.\n\n${nomes}\n\n` +
            "O robô abre a grade AO VIVO, pareia por crachá + data e RECUSA no Transnet só os " +
            "IDs que ainda estiverem pendentes. Dia que já não tem pendência lá, ele não toca.\n" +
            `Robô: ajustes · modo "${MODO_CANCELAR}" · casos = ${lista.length} crachá+dia (só estes).\n\n` +
            `${
              valendo
                ? "O caso só é fechado como CANCELADO quando TODOS os IDs achados naquele dia confirmarem a recusa. Se a grade mudar no meio e algum não confirmar, o dia CONTINUA em \"A decidir\" — pendência real não se esconde."
                : "Nada é clicado no Transnet e nada é gravado aqui."
            }`,
        )
      )
        return;

      setDisparando(true);
      setRecado("");
      try {
        const r = await dispararRoboDP360("ajustes", {
          modo: MODO_CANCELAR,
          casos,
          confirmar: valendo ? "true" : "false",
        });
        const texto =
          `${valendo ? "Cancelamento" : "Ensaio do cancelamento"} disparado — ${lista.length} crachá+dia.` +
          " O resultado não volta sozinho: a prova fica no run.";
        if (noCasoAberto) setResultadoRobo({ tipo: "ok", texto, painel: r?.painel || "" });
        else setRecado(texto + (r?.painel ? ` ${r.painel}` : ""));
        // a ✔ só se apaga quando o cancelamento saiu de verdade — e não quando o disparo
        // veio do caso aberto, que não usa a marcação da grade.
        if (valendo && !regs?.length) setSelIds([]);
        await atualizarSilencioso();
      } catch (e) {
        dizer(`Falhou: ${e?.message || "não foi possível disparar o robô."}`, true);
      } finally {
        setDisparando(false);
      }
    },
    [atualizarSilencioso],
  );

  /* ── colunas de cada grade (formato do TabelaDP: id/titulo/valor/render) ── */

  const acoesDecisao = { gravando, aoAbrir: abrir, aoDesfazer };

  const colColaborador = {
    id: "nome",
    titulo: "Colaborador",
    largura: 190,
    valor: (r) => r.nome,
    render: (r) => (
      <div>
        <div style={{ fontWeight: 650 }}>{r.nome}</div>
        <div className="dp-faint dp-num" style={MINI}>{r.cracha} · {r.categoria}</div>
      </div>
    ),
  };
  const colDia = { id: "dia", titulo: "Dia", largura: 90, classe: "dp-num", valor: (r) => r.dataBR };
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
  const colResposta = {
    id: "resp",
    titulo: "Situação",
    largura: 190,
    ordenavel: true,
    valor: (r) => `${r.nAjustes ? 1 : 0}|${r.restam == null ? 9999 : Math.round(r.restam)}`,
    render: (r) => <CelulaResposta reg={r} />,
  };
  // NA FILA A COLUNA NÃO É O ALVO, É O CONTRATO: o alvo é o que a correção faria; aqui já
  // existe decisão gravada, e o que o robô vai fazer valer é o cartão congelado.
  const colVaiLancar = {
    id: "vailancar",
    titulo: "Vai lançar",
    largura: 268,
    classe: "oc-cel-cartao",
    valor: (r) => (r.alvo.temAlvo ? r.alvo.slots.filter(Boolean).join(" ") : ""),
    render: (r) => <CartaoAlvo alvo={r.alvo} />,
  };
  // O VEREDITO NÃO É O QUE VAI SER LANÇADO — é o julgamento dos pedidos dele. Os dois
  // convivem na fila: a coluna acima diz o cartão, esta diz a decisão que o robô carrega.
  const colVeredito = {
    id: "ver",
    titulo: "Veredito",
    largura: 200,
    valor: (r) => (r.decJa ? (r.decJa.aceito ? "aceito" : "recusado") : ""),
    render: (r) => {
      const p = planoDaExecucao(r);
      return (
        <span style={PILHA}>
          <Selo cor={r.decJa?.aceito ? "ok" : "erro"}>
            {r.decJa?.aceito ? "aceito" : "recusado"}
          </Selo>
          <span className="dp-faint" style={MINI}>
            {p.aceitar.length ? `aceita ${p.aceitar.length}` : ""}
            {p.aceitar.length && p.rejeitar.length ? " · " : ""}
            {p.rejeitar.length ? `recusa ${p.rejeitar.length}` : ""}
            {r.temAviso && !r.decJa?.aceito ? " · vai para correção" : ""}
          </span>
        </span>
      );
    },
  };
  const colSituacao = {
    id: "sit",
    titulo: "Situação",
    largura: 170,
    valor: (r) => SIT[r.situacao]?.rotulo || r.situacao,
    render: (r) => <CelulaSituacao reg={r} />,
  };
  const colDecisao = (largura) => ({
    id: "dec",
    titulo: "Ação",
    largura,
    ordenavel: false,
    valor: (r) => (r.decJa ? (r.decJa.aceito ? "aceito" : "recusado") : "a decidir"),
    render: (r) => <CelulaDecisao reg={r} {...acoesDecisao} />,
  });
  // ── O CARTÃO EM QUATRO COMPARTIMENTOS ────────────────────────────────────
  // LARGURA FIXA E IGUAL NAS DUAS: `oc-slots` divide a célula em quatro colunas de `1fr`,
  // então a largura da COLUNA é o que garante os quatro horários numa linha só. 268 px é a
  // conta do pior caso — quatro chips de cinco caracteres (25:40 inclusive) com a marca
  // E/S. Encolher não faz o cartão quebrar (grade não quebra), faz o texto ser cortado.
  const colBateu = {
    id: "bateu",
    titulo: "Ponto (bateu)",
    largura: 268,
    classe: "oc-cel-cartao",
    valor: (r) => r.slotsHoje.filter(Boolean).join(" "),
    render: (r) => <LinhaCartao horas={r.slotsHoje} />,
  };
  const colAlvo = {
    id: "alvo",
    titulo: "Alvo (o cartão final)",
    largura: 268,
    classe: "oc-cel-cartao",
    valor: (r) => (r.alvo.temAlvo ? r.alvo.slots.filter(Boolean).join(" ") : ""),
    render: (r) => <CartaoAlvo alvo={r.alvo} />,
  };
  const colQuando = {
    id: "quando",
    titulo: "Quando",
    largura: 140,
    classe: "dp-num",
    valor: (r) =>
      txt(r.caso.correcao_final_em || r.caso.advertencia_enviada_em || r.caso.conferido_em ||
        r.caso.aceito_em || r.caso.atualizado_em),
    render: (r) => (
      <span className="dp-muted dp-num">
        {fmtDataHora(r.caso.correcao_final_em || r.caso.advertencia_enviada_em ||
          r.caso.conferido_em || r.caso.aceito_em || r.caso.atualizado_em)}
      </span>
    ),
  };
  const colOque = {
    id: "oq", titulo: "O que", largura: 170,
    valor: (r) => r.tipoLabel, render: (r) => <Selo>{r.tipoLabel}</Selo>,
  };

  // app.js:183 (COLS_CONF) — Pedidos: quem · dia · veredito por ponta · decisão · ajustes.
  // O CARTÃO ENTRA AQUI TAMBÉM: o alvo é o cartão final, e ele responde "como o dia fica"
  // sem abrir o caso — que é a pergunta que trazia o DP ao pop-up em toda linha.
  /* A DECISÃO SAIU DA GRADE (10/09/2026). Ela é do caso — é lá que o cartão se monta com a
   * refeição travada, a origem de cada ponta e o manual. Decidir de fora é decidir sem ver
   * o cartão que a decisão produz, e foi assim que a tela acabou com dois lugares para a
   * mesma coisa. `colDecisao` e o lote de decisão continuam definidos porque a aba da FILA
   * ainda usa o Desfazer. */
  const COLS_PEDIDO = [colColaborador, colDia, colBateu, colAlvo, colPontas, colResposta, colAjustes];

  // app.js:2647 (COLS_ENV) — Meus avisos. Aqui o ajuste é RESPOSTA a um aviso nosso: o
  // assunto é o dia todo, e o alvo tem os quatro compartimentos.
  // A coluna "Decisão" saiu daqui pelo mesmo motivo da porta do pedido: decidir é no caso.
  // O prazo virou a segunda linha da Situação, onde ele é contexto da resposta.
  const COLS_AVISO = [colColaborador, colDia, colOque, colBateu, colAlvo, colResposta, colAjustes];

  const COLS_COMENT = [colColaborador, colDia, colOque, colBateu, {
    id: "quando", titulo: "Enviado em", largura: 140, classe: "dp-num",
    valor: (r) => txt(r.caso.aviso_enviado_em),
    render: (r) => <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_enviado_em)}</span>,
  }];

  const COLS_LISTA = [colColaborador, colDia, colSituacao, colBateu, colAlvo, colPontas, colQuando, colAjustes];

  // Execução pendente: é aqui que mora o DESFAZER (o bot ainda não executou).
  const COLS_EXEC = [colColaborador, colDia, colBateu, colVaiLancar, colVeredito, colQuando, colDecisao(200)];

  const COLS_CANCEL = [colColaborador, colDia, colOque, {
    id: "quando", titulo: "Cancelado em", largura: 150, classe: "dp-num",
    valor: (r) => txt(r.caso.aviso_cancelado_em),
    render: (r) => <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_cancelado_em)}</span>,
  }];

  /* Uma CHAVE por grade: as colunas mudam por porta/aba, e a preferência de coluna é por
   * tela (app_config `tbl_p5_conf`…).
   * O QUE CADA GRADE DEIXA FAZER EM LOTE, e não é por gosto:
   *  · `loteDecisao` (A decidir) — grava aceite/recusa/promoção. Nada de robô.
   *  · `loteConferir` (Execução pendente) — a fila do bot é ESTA. Conferir em lote é o
   *    caminho de volta do resultado, e não decide nada.
   * Não existe EXECUÇÃO em lote: executar escreve no Transnet, e isso é um caso por vez. */
  const GRADE = {
    conf: { chave: "p5_conf", colunas: COLS_PEDIDO, loteDecisao: true, semPonto: true },
    aguard: { chave: "p5_env", colunas: COLS_AVISO, loteDecisao: true, semPonto: true },
    coment: { chave: "p5_com", colunas: COLS_COMENT },
    cancel: { chave: "p5_cancel", colunas: COLS_CANCEL },
    exec: { chave: "p5_exec", colunas: COLS_EXEC, selecionavel: true, loteConferir: true },
  };
  const grade = GRADE[abaAtiva] || { chave: "p5_lista", colunas: COLS_LISTA };
  // A ✔ só existe onde ela SERVE para alguma coisa: conferir no Transnet e lançar dia sem
  // ponto. Nas abas de decisão ela era um segundo mecanismo de lote competindo com o `dec`.
  const selecionavel = Boolean(grade.selecionavel || grade.semPonto);

  const VAZIOS = {
    conf: "Nenhum pedido aguardando decisão. Aguarde a captura do Transnet.",
    aguard: "Nenhum aviso esperando você — quem recebeu o aviso já foi tratado.",
    exec: "Nenhuma decisão aguardando o robô. É aqui que mora a fila dele: abra o caso para EXECUTAR, ou marque linhas para CONFERIR ao vivo — é a conferência que fecha o caso no nosso banco.",
    ok: "Nenhum dia fechado como OK nesta porta.",
    recusados: "Nenhuma recusa nesta porta.",
    disc: "Nenhuma advertência ou correção — e isso pode estar certo: só adverte quem recebeu aviso.",
    fechado: "Nenhum dia travado por competência fechada.",
    cancel: "Nenhum aviso cancelado.",
    coment: "Nenhum comunicado no período.",
  };

  const marcados = linhas.filter((r) => selIds.includes(r.k));
  // DIA SEM PONTO: os candidatos são os da lista em tela; o escopo do disparo são os
  // MARCADOS entre eles — nunca "a fila", que é a regra desta tela inteira.
  const semPontoNaTela = linhas.filter((r) => r.semBatida);
  const semPontoMarcados = marcados.filter((r) => r.semBatida);

  /* 3ª BARRA (só nas abas que agem em lote): ações à esquerda, ferramentas à direita — a
     mesma forma da ferramenta. Ela vive no `acoes` do TabelaDP, que é a barra do ⚙. */
  /* A ABA DE ENTRADA NÃO DECIDE (10/09/2026). Saíram daqui "Marcar sugestão" e "Aplicar
   * decisões": os dois davam veredito sem ver o cartão que o veredito produz — e é o cartão
   * que vira contrato para o robô. A decisão é no caso, um de cada vez, com a refeição
   * travada e a origem de cada ponta à vista.
   *
   * O que sobrou em lote nesta aba é o que NÃO é decisão: cancelar o pedido (desistir dele
   * no Transnet) e lançar dia sem ponto. Os dois continuam onde estavam. */
  const vencidosMarcados = marcados.filter((r) => r.situacaoAviso === "vencido");
  /* A MESMA BARRA NAS DUAS PORTAS (pedido do dono, 10/09/2026). O corte é o mesmo — o que
   * dá para julgar —, e o chip que não tem ninguém não é desenhado: na porta do pedido todo
   * mundo mandou ajuste, então sobra "Todos" e a tela fica igual à do aviso sem chip vazio. */
  const contaResposta = (id) => naAba.filter((r) => respostaDe(r) === id).length;
  const chipsResposta = [
    ["TODOS", "Todos", naAba.length, "Tudo o que está esperando veredito nesta porta."],
    ["resp", "✎ respondeu", contaResposta("resp"),
      "Ele mexeu no ponto: há pedido para julgar no caso."],
    ["semresp", "· não respondeu", contaResposta("semresp"),
      "Nenhum ajuste com horário — nada a julgar. Com aviso nosso, o prazo ainda corre."],
    ["vencido", "⚠ vencido", contaResposta("vencido"),
      "Passou das 48h sem ele mexer no ponto. Não se dá veredito: vai para advertência e depois correção, com o alvo."],
  ].filter(([id, , n]) => id === "TODOS" || n > 0);
  const barraLote = grade.loteDecisao ? (
    <div style={{ ...FILA, gap: 6 }}>
      {/* AS CONTAGENS SÃO O FILTRO (a régua da ferramenta, app.js:3009), e o corte desta aba
          é a RESPOSTA: vencido SEM resposta segue para advertência e correção sem nada a
          julgar; vencido TENDO respondido tem pedido para julgar. Clicar de novo no mesmo
          chip volta para todos.
          SÓ NA PORTA DO AVISO: é lá que existe pergunta nossa. Na porta do pedido todo mundo
          "respondeu" por definição — a lista nasce do ajuste dele —, e os três chips seriam
          um deles com o total e dois zerados. */}
      {chipsResposta.map(([id, rotulo, n, dica]) => (
        <button
          key={id}
          type="button"
          className="dp-btn"
          aria-pressed={respFiltro === id}
          style={respFiltro === id ? { borderColor: "var(--dp-accent)", color: "var(--dp-accent)" } : undefined}
          title={dica}
          onClick={() => setRespFiltro((atual) => (atual === id ? "TODOS" : id))}
        >
          {rotulo} <b className="dp-num">{n}</b>
        </button>
      ))}
      <span className="dp-faint dp-num" style={MINI}>
        {respFiltro === "TODOS" ? `${naAba.length} caso(s)` : `${linhas.length} de ${naAba.length}`}
      </span>
      <span className="oc-sep" aria-hidden="true" />
      <span className="dp-muted" style={MINI}>
        abra o caso para dar o veredito — aqui não se decide
      </span>
      {/* O QUE NÃO É DECISÃO CONTINUA EM LOTE. Cancelar é desistir do pedido no Transnet, e
          vive na porta do AVISO (decisão do dono, 09/09/2026: "o cancelamento não é no pedido
          do colaborador, tem que ter no enviamos para ajuste"). A seleção agora é a ✔ da
          grade — as caixinhas de aceitar/rejeitar saíram junto com a decisão. */}
      {porta === "aviso" ? (
        <>
          {vencidosMarcados.length ? (
            <BotaoExecucao tom="erro" motivo={MOTIVO_VENCIDO}>
              ⚠ Advertir e corrigir ({vencidosMarcados.length})
            </BotaoExecucao>
          ) : null}
          <BotaoAcao
            tom="erro"
            titulo="Recusa no Transnet os IDs ainda pendentes dos dias marcados na ✔ e fecha o caso como cancelado. Não é veredito: é desistir do pedido."
            disabled={!marcados.length || gravando || disparando}
            onClick={() => aoCancelarSelecionados(true, marcados)}
          >
            ✗ Cancelar marcados ({marcados.length})
          </BotaoAcao>
        </>
      ) : null}
    </div>
  ) : grade.loteConferir ? (
    <div style={{ ...FILA, gap: 8 }}>
      <span className="dp-muted dp-num" style={MINI} title={AVISO_CONFERIR}>
        {selIds.length ? `${selIds.length} marcada(s) na ✔` : "marque linhas para conferir no Transnet (só leitura)"}
      </span>
      {/* O QUE ESTAVA FALTANDO: mandar o robô executar o que já foi decidido. Sem ele a aba
          só sabia CONFERIR — e conferir não executa nada. */}
      <BotaoAcao
        tom="erro"
        titulo="Dispara o robô UMA vez para todos os dias marcados: ele aceita ou rejeita no Transnet o que a decisão gravada manda, e carimba conferido_em. Escreve no ponto de verdade."
        disabled={!selIds.length || gravando || disparando}
        onClick={() => aoExecutarLote(marcados)}
      >
        ▶ Executar marcados ({selIds.length})
      </BotaoAcao>
      {/* SEM ENSAIO (decisão do dono, 09/09/2026). Este botão já é só leitura no Transnet —
          o ensaio dele só mudava se o carimbo cai no NOSSO banco, e para isso existe a
          confirmação, que diz exatamente o que vai ser gravado. */}
      <BotaoAcao
        tom="ok"
        titulo="Lê o cartão ao vivo e, no que bater com o combinado, carimba conferido_em no NOSSO banco. O Transnet continua intocado."
        disabled={!selIds.length || gravando || disparando}
        onClick={() => aoConferirRobo(marcados, true)}
      >
        🔒 Conferir marcados e fechar no nosso banco
      </BotaoAcao>
    </div>
  ) : abaAtiva === "disc" ? (
    <div style={{ ...FILA, gap: 6 }}>
      {[
        ["TODOS", "Todos", naAba.length],
        ["advertido", "⚠ advertido", naAba.filter((r) => r.situacao === "advertido").length],
        ["corrigido", "🔧 corrigido", naAba.filter((r) => r.situacao === "corrigido").length],
      ].map(([id, rotulo, n]) => (
        <button
          key={id}
          type="button"
          className="dp-btn"
          aria-pressed={sitDisc === id}
          style={sitDisc === id ? { borderColor: "var(--dp-accent)", color: "var(--dp-accent)" } : undefined}
          title={
            id === "TODOS"
              ? "Tudo o que já virou desfecho nesta porta."
              : id === "advertido"
                ? "A advertência subiu; o ponto ainda não foi corrigido."
                : "O ponto foi corrigido (correcao_final_em carimbado)."
          }
          onClick={() => setSitDisc((atual) => (atual === id ? "TODOS" : id))}
        >
          {rotulo} <b className="dp-num">{n}</b>
        </button>
      ))}
      <span className="dp-faint dp-num" style={MINI}>
        {sitDisc === "TODOS" ? `${naAba.length} caso(s)` : `${linhas.length} de ${naAba.length}`}
      </span>
    </div>
  ) : null;

  /* ══ A MOLDURA — a MESMA da Gordura (abas/Gordura.jsx) ═══════════════════════
   * O dono foi explícito: "Gordura e Ocorrências têm que ser iguais, olha exatamente como
   * está na ferramenta". Lá as duas telas dividem a mesma estrutura:
   *   1ª barra: seletores à esquerda (função · porta · data) · busca e recarregar à direita;
   *   2ª barra: abas/chips à esquerda · contagem e resumo à direita;
   *   3ª barra (só o P5): ações de lote (o `acoes` do TabelaDP);
   *   tabela; e o detalhe em MODAL.
   * A Ocorrências tinha crescido POR FORA do AbaShell — três cartões de porta com dois
   * parágrafos cada, uma linha de abas, um painel de captura e um texto de regras, tudo
   * acima da grade. Nada disso existe na ferramenta. */
  const portaAtual = PORTA_DE(porta);

  const filtros = (
    <>
      <select value={funcao} onChange={(e) => setFuncao(e.target.value)} title="Filtro global por função">
        {FUNCOES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {/* A PORTA — o primeiro nível da navegação, e ela DEFINE A CONSEQUÊNCIA da recusa. Por
          isso a consequência da porta escolhida fica escrita ao lado, sempre: quem não a lê
          não descobre que existe uma porta em que recusar pode advertir. */}
      <select
        value={porta}
        onChange={(e) => trocarPorta(e.target.value)}
        title="De onde o dia veio. É isto que decide se a recusa pode virar advertência."
      >
        {PORTAS.map((p) => (
          <option key={p.id} value={p.id} title={p.consequencia}>
            {p.label}{cont.porta[p.id] ? ` (${cont.porta[p.id]})` : ""}
          </option>
        ))}
      </select>
      {temEixos && datasDaAba.length > 1 ? (
        <select
          className="oc-sel"
          value={dataAtiva}
          onChange={(e) => setEixoData(e.target.value)}
          title="Data de referência — só os dias que existem nas linhas desta aba."
        >
          <option value="TODAS">Referência: todas ({datasDaAba.length} dias)</option>
          {datasDaAba.map((d) => <option key={d} value={d}>{paraBR(d)}</option>)}
        </select>
      ) : null}
      <span className="dp-faint">{portaAtual.consequencia}</span>
      <span style={{ flex: 1 }} />
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar nome ou chapa"
        style={{ width: 210 }}
      />
      <button type="button" className="dp-btn" onClick={carregar} disabled={gravando || disparando}>
        ↻ Recarregar
      </button>
    </>
  );

  const resumo = (
    <>
      {/* AS ABAS SÃO ABAS, O EIXO É UM SELETOR (app.js:2110 `#dfstatus`).
          Eram sete pílulas idênticas em fila — as cinco abas e os dois eixos com a mesma
          forma, a mesma cor e o mesmo contador —, e nada dizia que as duas últimas eram
          um filtro DENTRO da primeira, não irmãs dela. Aqui as abas viram uma trilha só,
          com sublinhado no ativo, e o eixo volta a ser o `<select>` que a ferramenta usa,
          encostado à direita delas. */}
      <span className="oc-linha-abas">
        <span className="oc-abas" role="tablist">
          {abasDaPorta.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === abaAtiva}
              onClick={() => trocarAba(id)}
              className={`oc-aba${id === abaAtiva ? " on" : ""}`}
            >
              {label}
              <Contador n={cont.aba[`${porta}:${id}`] ?? 0} />
            </button>
          ))}
        </span>
        {temEixos ? (
          <select
            className="oc-sel oc-eixo"
            value={eixoStatus}
            onChange={(e) => setEixoStatus(e.target.value)}
            title="O que a aba “A decidir” mostra. O que o Transnet já efetuou ou recusou nunca aparece aqui — isso vive nas abas de desfecho."
          >
            {EIXOS_CONF.map(([id, rotulo]) => (
              <option key={id} value={id}>
                {rotulo} ({contEixo[id]})
              </option>
            ))}
          </select>
        ) : null}
      </span>
      <span style={{ flex: 1 }} />
      {/* ENQUANTO CARREGA NÃO SE DIZ "0 casos": numa tela que ainda está lendo isso é
          afirmação falsa sobre o trabalho do DP — parece fila vazia, é fila desconhecida. No
          lugar vai a barra, que conta DIA LIDO SOBRE DIA EM CENA. */}
      {carregando ? (
        /* A BARRA MUDOU DE LUGAR, não sumiu: ela agora é a do `AbaShell`, no meio da tela
           (com o mesmo `progresso`). Duas barras contando a MESMA coisa a 100px uma da
           outra é ruído — aqui fica só a frase, que é o que falta na linha do resumo. */
        <span className="dp-muted dp-num" style={MINI}>
          {progresso?.total
            ? `lendo o cartão de cada dia — ${progresso.feitos} de ${progresso.total}`
            : "lendo o estado do DP…"}
        </span>
      ) : (
        <span className="dp-muted dp-num">
          <b className="dp-num">{linhas.length}</b> {linhas.length === 1 ? "caso" : "casos"} · janela de{" "}
          {JANELA_DIAS} dias · lido em {fmtDataHora(base?.lidoEm)}
          {base?.descartados ? (
            <span className="dp-faint" title="Linhas de ponto_ajustes_app sem tipo_ajuste (avisos, advertências, atestados). Não são pedido do colaborador.">
              {" "}· {base.descartados} descartada(s)
            </span>
          ) : null}
          {registros.esperandoPonto ? (
            <span
              className="dp-faint"
              title="Casos de dias cujo cartão ainda não foi importado (nenhuma linha com tem_ponto no dia). Sem cartão não há sugestão, gordura nem almoço apurado — eles voltam sozinhos quando o ponto do dia subir."
            >
              {" "}· {registros.esperandoPonto} esperando o ponto do dia
            </span>
          ) : null}
          {registros[0]?.realocados ? (
            <span className="dp-faint" title="A batida que o pedido aponta não estava no cartão do dia declarado e estava no do outro dia de referência (motor: realocaDia).">
              {" "}· {registros[0].realocados} realocado(s) de dia
            </span>
          ) : null}
        </span>
      )}
      {/* O ROBÔ A CAMINHO — antes do recado, porque muda o que a pessoa deve fazer agora. */}
      {execRobo.map((x) => {
        const rodando = ["queued", "in_progress"].includes(txt(x.run_status));
        const falhou = txt(x.run_status) === "completed" && txt(x.run_conclusao) !== "success";
        if (!rodando && !falhou) return null;
        return (
          <Selo
            key={x.id}
            cor={rodando ? "alerta" : "erro"}
            quebra
            titulo={
              `Run #${x.id} do repo do robô, lido AGORA no GitHub — vale para qualquer origem, inclusive o que a ` +
              "ferramenta do PC dispara sem passar pelo INOVE. Enquanto houver robô rodando, não dispare de novo o mesmo escopo."
            }
          >
            {rodando ? "⚙ robô rodando agora" : "⚠ o robô terminou mal"} · {txt(x.robo)}
            {x.confirmar ? "" : " (ensaio)"} · começou {fmtDataHora(x.disparado_em)}
            {txt(x.autor_nome) ? ` por ${txt(x.autor_nome)}` : ""}
            {x.daqui ? "" : " · disparado fora do INOVE (ferramenta)"}
            {falhou ? ` · ${txt(x.run_conclusao) || "sem conclusão"}` : ""}
            {txt(x.run_url) ? (
              <>
                {" "}
                <a href={x.run_url} target="_blank" rel="noreferrer">ver o run</a>
              </>
            ) : null}
          </Selo>
        );
      })}
      {/* O RECADO é a resposta ao último clique — fica sempre visível, nunca atrás de botão. */}
      {recado ? <Selo cor={recado.startsWith("Falhou") ? "erro" : "ok"} quebra>{recado}</Selo> : null}
      {/* O QUE ESTÁ ACONTECENDO, COM PALAVRA. Gravar, disparar e reler são três esperas
          diferentes e o DP precisa saber em qual delas está — principalmente na terceira,
          que é a longa (a releitura varre o lake dia a dia) e agora acontece SEM tirar a
          lista da tela. Círculo sozinho não diz nada; aqui ele vem com o nome. */}
      {gravando || disparando || atualizando ? (
        <Selo cor="alerta">
          <span className="dp-espera-circulo mini" aria-hidden="true" />
          {gravando ? "gravando…" : disparando ? "disparando o robô…" : "carregando de novo…"}
        </Selo>
      ) : null}
    </>
  );

  return (
    <>
      <AbaShell carregando={carregando} progresso={progresso} erro={erro} filtros={filtros} resumo={resumo}>
        {/* DIA SEM PONTO — PAINEL, não botão de lote (app.js:2952). Não é parte do fluxo de
            decisão: estes dias não têm pedido para julgar, e o painel tem um seletor de tipo
            e dois botões — amassado na barra do lote viraria só mais um botão de veredito.
            SÓ NAS CAIXAS DE ENTRADA: nas abas de desfecho o dia já teve um fim, e oferecer
            ali um lançamento novo é convidar a reabrir o que foi fechado. */}
        {/* SÓ APARECE QUANDO HÁ DIA MARCADO. Ele vivia aberto no topo da tela, com o
            título, a explicação e a pílula "marque na grade (✔)" — três linhas de texto
            acima da grade em toda visita, para uma ação que começa NA GRADE, na coluna ✔.
            Marcou, o painel aparece com o seletor de tipo e os dois botões; sem marca, a
            grade começa onde deve começar. */}
        {grade.semPonto && semPontoMarcados.length ? (
          <div className="oc-lote-linha">
            <LancarDiaSemPonto
              regs={semPontoMarcados}
              candidatos={semPontoNaTela.length}
              ocupado={gravando || disparando}
              aoLancar={aoLancarDiaSemPonto}
              titulo={`Lançar dia(s) sem ponto — ${semPontoNaTela.length} nesta lista`}
            />
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
          selecionavel={selecionavel}
          aoSelecionar={(ids) => setSelIds(ids)}
          acoes={barraLote}
          nomeCsv={`dp360_ocorrencias_${porta}_${abaAtiva}`}
          vazio={VAZIOS[abaAtiva] || "Nada por aqui."}
          pinPadrao={2}
        />

        {/* O POP-UP É SÓ VEREDITO: `aoMarcar` é o ÚNICO gravador que chega nele. Os outros
            (aceitar/rejeitar o dia, aplicar marcados, robô, conferir, fechar à mão,
            cancelar, corrigir assim, lançar dia sem ponto) continuam vivos nesta tela e
            vão para a TELA PRINCIPAL — não passam mais por aqui. */}
        <Detalhe
          reg={regAberto}
          aoFechar={() => setAberto(null)}
          gravando={gravando || disparando}
          aoMarcar={aoMarcar}
          aoAbrirCartao={abrirCartaoDoDia}
          abrindoCartao={abrindoCartao}
          erroCartao={erroCartao}
        />
      </AbaShell>

      {/* O CARTÃO DO DIA abre POR CIMA de tudo, como na Revisão e na Gordura. FICA FORA DO
          `AbaShell` DE PROPÓSITO: quando a aba recarrega, o AbaShell troca os FILHOS pela
          linha de "carregando" — o pop-up sumiria no meio da edição e voltaria com o
          formulário zerado. Aqui ele atravessa a releitura inteiro. É o MESMO componente
          compartilhado: nenhuma prop nova, nenhuma regra dele contornada. */}
      {cartaoDia ? (
        <CartaoDoDia
          linha={cartaoDia.linha}
          caso={cartaoDia.caso}
          // A Ocorrências não carrega GPS por dia (a Revisão carrega e passa pronto): aqui o
          // cartão lê ponto_gps/gps_carro deste crachá×dia sozinho.
          gpsAuto
          aoFechar={fecharCartaoDoDia}
          aoRecarregar={recarregarCartaoDoDia}
          rodapeInfo={
            <>
              O <b>Real manual</b> que você cravar aqui vira a <b>régua do veredito por ponta</b> —
              o topo da cascata, acima do alvo congelado e da sugestão do dia. Ele <b>não</b> muda o
              alvo já congelado no aviso, que é o que o robô lança. Ao <b>fechar</b>, a fila de
              Ocorrências é relida.
            </>
          }
        />
      ) : null}
    </>
  );
}

/* ============================================================================
 * O QUE ESTA TELA EXECUTA — e o que continua fora (de propósito)
 *
 * · EXECUÇÃO (LIGADA). Só no caso aberto, só uma decisão JÁ GRAVADA, e sempre com escopo
 *   explícito. `ajustes.yml` roda a FILA INTEIRA quando `casos` chega vazio, e um clique
 *   sem escopo já processou 34 casos indevidos (24/08). Não existe execução em lote, e o
 *   `confirmar` nasce falso no gateway: sem "true", é ensaio.
 * · CONFERÊNCIA (LIGADA). Modo "conferir (so leitura)", dois escopos: as linhas marcadas de
 *   "Execução pendente" e o caso aberto. Não muda NADA no Transnet; o `confirmar` liga a
 *   escrita no NOSSO banco. É o caminho de VOLTA do resultado — sem ele o caso mora em
 *   "Execução pendente" para sempre, porque quem carimba `conferido_em` é o bot.
 * · LANÇAR A MARCAÇÃO (LIGADO). main.py:9649 (aplicar_marcados) — a porta de saída que
 *   faltava. Promove aceite pendente → aceito/rejeitado SEM tocar em `ajuste_ids` nem em
 *   `correcao_status`. Na grade ela é a caixinha "lançar" ao lado dos selos ✓N ✗N; no caso
 *   aberto é o botão do bloco de marcação. Sem ela, marcar por ocorrência gravava e o dia
 *   nunca subia.
 * · FECHAR À MÃO (LIGADO, e é EXCEÇÃO). main.py:8289. Não dispara robô e não escreve no
 *   Transnet: grava o DESFECHO de um caso que o robô não consegue executar. Dois desfechos,
 *   dois botões separados. A trava é a MESMA fila do bot — sem decisão gravada não há
 *   desfecho a registrar, e é assim que decidir ≠ executar continua de pé.
 * · LANÇAR DIA SEM PONTO (LIGADO). main.py:4389 — robô `ocorrencias`, o MESMO da Folgas,
 *   com o MESMO CSV e os mesmos três tipos. Só dia com ZERO batida, e o cartão é RELIDO
 *   antes do disparo. O TIPO É DECISÃO DO DP.
 * · CARTÃO DO DIA (LIGADO). Abre o `../CartaoDoDia`, o pop-up COMPARTILHADO, sem prop nova.
 *   É por ele que o DP crava o REAL MANUAL, que manda na régua do veredito por ponta.
 * · RECUSAR E CORRIGIR ASSIM (LIGADO). Só quando TODOS os pedidos são "era alteração" e a
 *   reprojeção fecha em 2/4. `correcao_status='pendente'`, NUNCA 'dispensada'.
 * · IMPRIMIR O HISTÓRICO (LIGADO). Sai do MESMO caso e do MESMO montador que estão na tela.
 * · CAPTURA DA GRADE (FORA). A `ponto_ajustes_app` é alimentada pelo importador diário; o
 *   botão só adiantaria o dia de hoje, o yml roda a captura sem ensaio e o congelamento da
 *   prova (main.py:1550 `_pos_captura`) roda na máquina depois do run.
 * · ADVERTIR e CORRIGIR (FORA — MOTIVO_ADVERTIR). São outros dois robôs e outros dois
 *   carimbos, gravados por quem LÊ o resultado do run. A recusa executada aqui apenas
 *   MANTÉM o caso na fila da cadeia; nenhuma carta é enviada a ninguém.
 * · CANCELAR A OCORRÊNCIA no Transnet (FORA — MOTIVO_CANCELAR): é `--cancelar-enviadas`,
 *   modo que o `ajustes.yml` não expõe.
 * · ALVO MANUAL da correção (ponto_ajustes_app.alvo_etapa2): exige um campo de digitação
 *   com validação própria. Sem ele a recusa vai sem alvo — o mesmo comportamento do Python
 *   quando o operador não digita nada.
 * · ALVO CONGELADO (alvo_*) e ponto_antes/ponto_depois já gravados: NUNCA são reescritos.
 * ========================================================================== */
