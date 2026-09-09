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
//      (`cartaoFinal`), um lote (`dec`), uma função de linhas (`linhasDaAba`).
//      Toda vez que esta tela teve duas respostas para a mesma pergunta, alguém
//      decidiu pela resposta errada.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import { dispararRoboDP360, lerDP360, lerTudoDP360, upsertDP360 } from "../../../services/dp360Api";
// O CARTÃO DO DIA é o pop-up COMPARTILHADO — o MESMO da Revisão e da Gordura. Ele já lê
// sozinho gordura, ajustes, reserva e GPS do crachá×dia, e traz o REAL MANUAL, que é o
// topo da cascata da régua. Daqui não vai prop nova nenhuma.
import { encaixaEmQuatro, validaCartao } from "../regrasMontador";
import CartaoDoDia, {
  agoraUtc,
  aplicarRealManual,
  lerReservaDoDia,
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
  "almoco_saida_sug,almoco_volta_sug,status_ponto,motivo,nm_funcao,categoria,almoco_travado";

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
    const lista = [...crachas].join(",");
    TABELAS_LAKE.forEach((t) => trabalhos.push({ t, iso, lista }));
  });

  // PROGRESSO HONESTO: o total de dias é sabido AQUI, antes de qualquer chamada. Um dia só
  // conta como lido quando TODAS as tabelas dele voltaram — contar leitura solta faria a
  // barra correr mais rápido do que o trabalho.
  const totalDias = porDia.size;
  const faltamNoDia = new Map([...porDia.keys()].map((iso) => [iso, TABELAS_LAKE.length]));
  let diasFeitos = 0;
  aoAvancar?.(0, totalDias);

  const out = { diario: [], gordura: [], realManual: [] };
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

// "03:07" / "3:07" → "03:07"; qualquer outra coisa → "". É o `hora()` de app.js.
function horaSlot(v) {
  const s = txt(v);
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/**
 * PORTE de app.js `cartoesAviso` (~2760) — os quatro slots do cartão ATUAL.
 *
 * O caso que provou a regra: LUCIANO DA SILVA 30060552, 28/08/2026. `todas_batidas` =
 * "E03:07 | S03:37", e o caso congelou alvo_entrada 01:00 · alm 03:07–03:37 · alvo_saida
 * 10:49. Ele NÃO bateu entrada nem saída — bateu só o miolo do almoço que o DP já tinha
 * lançado. A regra "duas batidas = pontas" (que é da GORDURA, onde vem amarrada às marcas
 * E/S) desenhava `E 03:07 · — · — · S 03:37` e a tela mostrava as MESMAS horas em posições
 * diferentes nas duas colunas. Medido na base: 84 cartões mudam de desenho com a leitura
 * abaixo, e todos na direção do alvo congelado.
 */
function slotsDoCartao({ cp, caso, lim }) {
  const limpas = (lim || []).filter((t) => t != null).map(min2hm).filter(Boolean);
  const brutoQuatro = limpas.slice(0, 4);

  // 1) AS DUAS BATIDAS SÃO O ALMOÇO QUE O DP JÁ LANÇOU → elas não são as pontas. Sem
  //    tolerância nenhuma: só o par IDÊNTICO ao congelado.
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
  //    inserção tem cinco ou mais marcas, e aí `ponto_diario.saida` (4ª posição) não é a
  //    saída do dia — ANDRE 27/08: E04:14 S11:27 E11:57 S14:45 E14:47 S17:32, a grade
  //    dizia 14:45 e o Transnet dizia 17:32.
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

// Os quatro campos congelados do `ponto_caso` — o que PEDIMOS naquele crachá+dia.
const alvoQuatroSlots = (caso) =>
  [caso?.alvo_entrada, caso?.alvo_alm_saida, caso?.alvo_alm_volta, caso?.alvo_saida].map(horaSlot);

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

function cartaoFinal(slotsHoje, caso, slotsPedido, problemaPedido, fontePedido, trava) {
  const hoje = slotsHoje || ["", "", "", ""];
  const alvo = alvoQuatroSlots(caso);
  // `slotsPedido === null` = a projeção não cabe em quatro campos; então não há terceiro
  // degrau, e a coluna cai no cartão de hoje (com o aviso vindo de `naoFecha`).
  const pedido = slotsPedido || ["", "", "", ""];
  // A CASCATA: alvo congelado → o que o pedido faz com o cartão → o que já está lá.
  const slots = alvo.map((v, i) => v || pedido[i] || hoje[i] || "");
  return {
    slots,
    // mudou = sai diferente do cartão de hoje (destacado); igual = fica como está
    mudou: slots.map((v, i) => Boolean(v) && v !== (hoje[i] || "")),
    temAlvo: slots.some(Boolean),
    // sem nada congelado, o que está desenhado é PROJEÇÃO do pedido em aberto —
    // vira alvo de verdade quando a decisão é gravada.
    congelado: alvo.some(Boolean),
    // SÓ QUANDO NÃO HÁ ALVO CONGELADO. Com alvo congelado o cartão final é o do aviso —
    // dado gravado, não projeção —, e o aviso "não fecha" estava passando por cima dele.
    naoFecha: slotsPedido === null && !alvo.some(Boolean),
    // o motivo é o do Python (`valida`): "3 batidas (motorista: 2 ou 4)", "almoço de N min"
    problema: txt(problemaPedido),
    // de onde saiu o desenho: alvo congelado, cartão de hoje, pedido, ou a régua da Revisão
    fonte: alvo.some(Boolean) ? "aviso" : txt(fontePedido),
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

  const registros = [];
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
      : txt(cp.status_ponto).toUpperCase() === "SEM_PONTO"
        ? "o ponto deste dia não chegou do Transnet"
        : !hoje.length && !sim.length
          ? "cartão vazio e o pedido não produziu batida"
          : "";
    const final = cartaoFinal(slotsHoje, caso, proj.slots, proj.problema, proj.fonte, travaCartao);

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

  registros.forEach((r) => {
    r.diaStatus = statusDoDia(r);
    r.realocados = realocados;
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
 * por aqui: passa por `aplicarMarcados`.
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
async function gravarMarcacao(reg, aceitar, rejeitar, cartaoDoMontador) {
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
  // Sem aceite não há cartão a prometer: recusa não congela `depois`.
  const depois = ace.length ? txt(cartaoDoMontador) : "";
  return gravaContrato(reg, [...ace, ...rej], reg.antesTexto, depois);
}

/**
 * ══ A PORTA DE SAÍDA DA MARCAÇÃO (main.py:9649 aplicar_marcados) ══════════════
 *
 * Promove MARCADO → DECIDIDO, e SÓ ISSO: o `aceite` muda, `ajuste_ids` e
 * `correcao_status` ficam como estavam.
 *
 * POR QUE ELA TEM DE EXISTIR, e é a lição de 25/08 da ferramenta: marcar por ocorrência
 * grava `ajuste_ids` com A:/R: e deixa o `aceite` pendente — de propósito. Sem este
 * segundo passo a decisão fica GUARDADA SEM PORTA DE SAÍDA: o robô só executa
 * aceite ∈ (aceito, rejeitado), então o dia marcado nunca sobe. Foram 5 casos do dia 20/08
 * decididos e invisíveis (30017485, 30060990, 30060654, 30061228, 30060192).
 *
 * POR QUE NÃO SE REDECIDE POR CIMA: `confirmar_errados` regravaria
 * `correcao_status='dispensada'` e apagaria a intenção de corrigir que o DP registrou no
 * caso aberto (RICHARD 30061188 07/08). E `confirmar_certos`/`confirmar_errados`
 * reescrevem `ajuste_ids` com TODOS os ids SEM prefixo — apagariam as marcas A/R, que é
 * justamente o que distingue o que ele aceitou do que ele recusou num dia misto.
 *
 * O lado do dia segue a mesma regra do `decidir_ajustes`: havendo recusa, a recusa manda
 * (é ela que abre advertência/correção).
 */
async function aplicarMarcados(reg) {
  const m = selosDaMarcacao(reg);
  if (!m) return ""; // sem marcação por ocorrência, ou já aplicado
  const rej = m.nR > 0;
  await upsertDP360("ponto_caso", {
    ...chaveDoCaso(reg),
    aceite: rej ? "rejeitado" : "aceito",
    ajuste: rej ? "errado" : "certo",
    atualizado_em: agoraISOLocal(),
  });
  return "";
}

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
 */
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
 * Devolve `{ nA, nR, lado }` ou null. É o estado do meio, que a tela não tinha: A:/R:
 * gravado e `aceite` ainda pendente. Sem ele, o trabalho feito no caso aberto era
 * invisível na grade — e a porta de saída (`aplicarMarcados`) não tinha onde ser oferecida.
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
          aviso: "O cartão como fica quando a correção for lançada. Os horários destacados são os que o aviso congelou.",
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
            aviso: "o cartão como fica depois de lançado · destacado = pedido · normal = fica como está",
            revisão: "o pedido não fecha o cartão — vale a régua que a Revisão publicou para o dia",
            "Real manual": "o pedido não fecha o cartão — vale o Real manual que o DP cravou",
            cartão: "o pedido não muda nada · o cartão fica como está",
          }[alvo.fonte] ||
            "como fica se o pedido for aceito · destacado = o que muda · normal = fica como está"}
        </span>
      ) : null}
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
function CelulaDecisao({ reg, dec, gravando, aoDecidir, aoAbrir, aoDesfazer }) {
  if (reg.decJa) {
    return (
      <div style={PILHA}>
        {reg.decJa.subiu ? (
          <Selo cor="ok" titulo={`Executado no Transnet em ${reg.decJa.quando} — o dia está travado. Para mexer, use Desfazer.`}>
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
                titulo="Abre o caso: a execução no Transnet fica no rodapé do detalhe, com o escopo de um crachá+dia."
                onClick={(e) => { e.stopPropagation(); aoAbrir(reg); }}
              >
                🤖 Executar…
              </BotaoAcao>
              <BotaoAcao
                titulo="Desfaz a decisão e devolve o caso para a fila (main.py:desfazer_decisao). Só vale enquanto o bot não executou."
                onClick={(e) => { e.stopPropagation(); aoDesfazer(reg); }}
                disabled={gravando}
              >
                ↩ Desfazer
              </BotaoAcao>
            </div>
          </>
        )}
      </div>
    );
  }

  const marcado = selosDaMarcacao(reg);
  if (marcado) {
    const trava = motivoSemDecisao(reg);
    return (
      <div style={PILHA}>
        <div style={FILA}>
          {marcado.nA ? <span className="oc-vbadge certo">✓{marcado.nA}</span> : null}
          {marcado.nR ? <span className="oc-vbadge errado">✗{marcado.nR}</span> : null}
          <span className="dp-faint" style={MINI}>marcado por ocorrência</span>
        </div>
        <label
          className={`oc-lancar-chk${trava ? " off" : ""}`}
          onClick={(e) => e.stopPropagation()}
          title={
            trava ||
            `Inclui este dia no próximo “Aplicar decisões”. O lado (${marcado.lado}) já veio do que você marcou no caso — aplicar só PROMOVE a marcação, sem redecidir.`
          }
        >
          <input
            type="checkbox"
            disabled={Boolean(trava) || gravando}
            checked={dec === marcado.lado}
            onChange={(e) => aoDecidir(reg, e.target.checked ? marcado.lado : "")}
          />
          lançar
        </label>
      </div>
    );
  }

  const travaAceitar = motivoForaDoLote(reg, "aceitar");
  const travaRejeitar = motivoForaDoLote(reg, "rejeitar");
  // exclusividade: marcar uma desmarca a outra (app.js `onDecChange`)
  const caixa = (lado, rotulo, trava, classe) => (
    <label
      className={`oc-dec-cb ${classe}${dec === lado ? " on" : ""}${trava ? " off" : ""}`}
      onClick={(e) => e.stopPropagation()}
      title={trava || `Marca este dia para ${rotulo.toLowerCase()} no próximo “Aplicar decisões”. Nada é gravado agora.`}
    >
      <input
        type="checkbox"
        disabled={Boolean(trava) || gravando}
        checked={dec === lado}
        onChange={(e) => aoDecidir(reg, e.target.checked ? lado : "")}
      />
      {rotulo}
    </label>
  );
  return (
    <div style={PILHA}>
      <div className="oc-dec">
        {caixa("aceitar", "Aceitar", travaAceitar, "ok")}
        {caixa("rejeitar", "Rejeitar", travaRejeitar, "x")}
      </div>
      {reg.diaStatus === "misto" ? (
        <button
          type="button"
          className="dp-btn"
          style={{ color: "var(--dp-warn-ink)" }}
          onClick={(e) => { e.stopPropagation(); aoAbrir(reg); }}
          title="Uma ponta certa e outra errada: a decisão correta é por ocorrência, e ela mora no caso aberto."
        >
          dia misto — decidir no caso ▸
        </button>
      ) : travaAceitar && travaRejeitar ? (
        <span className="dp-faint" style={MINI}>{travaAceitar}</span>
      ) : (
        <span className="dp-faint" style={MINI}>
          {reg.diaStatus === "certo"
            ? "sugestão: aceitar"
            : reg.diaStatus === "errado"
              ? `sugestão: rejeitar${reg.temAviso ? " (com aviso: abra o caso)" : ""}`
              : ""}
        </span>
      )}
    </div>
  );
}

// app.js:3972 — PRAZO = 48h desde `aviso_enviado_em`.
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

function Linha({ rotulo, children }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, padding: "3px 0" }}>
      <span className="dp-muted" style={{ ...ROTULO_CARD, width: 150, flexShrink: 0 }}>{rotulo}</span>
      <span>{children}</span>
    </div>
  );
}

// Um item do julgaAcoes (motor) — o veredito daquele pedido contra o ALVO da ponta.
function ItemAcao({ item, marca, aoMarcar, travado }) {
  const cor = item.ok === true ? "ok" : item.ok === false ? "erro" : "alerta";
  const rotulo =
    item.ok === true ? "bate com o alvo" : item.ok === false ? "não bate" : "não dá para julgar";
  return (
    <li className="oc-item">
      <div style={FILA}>
        <Selo>{item.tipo || "—"}</Selo>
        <span className="dp-mono dp-num" style={{ fontWeight: 600 }}>{item.hora || "—"}</span>
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
          <Selo cor="alerta" titulo={`já existe ${item.redundante} no cartão`}>redundante</Selo>
        ) : null}
        {item.viraAlteracao ? (
          <Selo cor="alerta" titulo={`o certo seria ALTERAR a batida ${item.viraAlteracao}`}>era alteração</Selo>
        ) : null}
        {item.orfao ? (
          <Selo cor="erro" titulo="a batida de origem não está no cartão — aceitar não faz nada">órfã</Selo>
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
            <input type="radio" disabled={travado} checked={marca === v} onChange={() => aoMarcar(v)} />
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
function Montador({ reg, montado }) {
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
      {/* O ALVO, no MESMO desenho da grade e do papel: o cartão final depois de lançado. */}
      {reg.alvo.temAlvo ? (
        <div className="oc-mt-l">
          <span className="oc-mt-k">alvo</span>
          <CartaoAlvo alvo={reg.alvo} />
          <span className="dp-faint" style={MINI}>
            é o que o robô lança · destacado = pedido · normal = fica como está
          </span>
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
function BarraRobo({ reg, disparando, gravando, aoExecutar, aoConferir, aoFecharAMao, resultado }) {
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
 * O PAPEL SAI DO MESMO MONTADOR QUE ESTÁ NA TELA (`montado` chega por prop). Antes ele
 * imprimia a prévia de "aceitar tudo" enquanto a tela mostrava o cartão das marcas: duas
 * respostas para o mesmo dia, e a que ia para a pasta era a que ninguém tinha aprovado. */
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

function Detalhe({
  reg, aoFechar, gravando: gravandoProp, aoAceitar, aoRejeitar, aoDesfazer, aoMarcar,
  aoAplicarMarcados, disparando, aoExecutar, aoConferir, aoFecharAMao, aoAbrirCartao,
  abrindoCartao, aoComoAlteracao, aoLancarDia, resultadoRobo,
}) {
  // ENQUANTO O DISPARO ESTÁ NO AR, A DECISÃO NÃO MUDA. O robô já levou a decisão gravada;
  // trocá-la agora deixaria o banco e o Transnet contando histórias diferentes sobre o
  // mesmo dia da mesma pessoa.
  const gravando = gravandoProp || disparando;

  // MARCAÇÃO POR OCORRÊNCIA. A MARCA GRAVADA MANDA; só o que não tem marca cai na
  // pré-marcação do MOTOR (julgaAcoes.ok). Reabrir um dia já marcado e repintar tudo pelo
  // veredito faz o DP julgar duas vezes a mesma coisa — e a segunda opinião pode sair
  // diferente da que já está gravada (app.js:141).
  const inicial = useMemo(() => {
    const gravadas = marcasGravadas(reg);
    const m = {};
    (reg?.acoes || []).forEach((it, i) => {
      const jaMarcada = (it.ids || []).map((id) => gravadas.get(txt(id))).find(Boolean);
      // Sem régua (ok === null) NÃO se marca nada: a ferramenta não pode empurrar "aceitar"
      // num dia sem base nenhuma — quem decide é o operador (app.js:137).
      m[i] = jaMarcada || (it.ok === true ? "A" : it.ok === false ? "R" : "");
    });
    return m;
  }, [reg?.acoes, reg?.ciclo]);
  const [marcas, setMarcas] = useState(inicial);
  useEffect(() => setMarcas(inicial), [inicial]);

  /* ── O MONTADOR: como o cartão fica com as marcas que estão na tela AGORA ──── */
  const montado = useMemo(() => {
    if (!reg) return null;
    const cp = reg.cartao || {};
    // MESMAS refs da prévia (main.py:9064): a escala do CARTÃO, e só ela. São elas que
    // desempatam o AM/PM e ancoram a inserção num dia sem cartão.
    const refs = [hm2min(cp.esc_entrada), hm2min(cp.esc_saida)].filter((v) => v != null);
    const fechado = txt(cp.status_ponto).toUpperCase() === "SEM_PONTO";
    const arruma = (lista) =>
      (lista || [])
        .filter((n) => !String(n).startsWith("_fantasma"))
        .map((n) =>
          fechado && String(n).includes("aguardando o dia fechar")
            ? "não bateu ponto no dia — nada a conferir"
            : n,
        );

    // "hoje" NÃO é recalculado: é o `reg.hoje` de `montarRegistros`, mesma entrada e mesmas
    // referências do "fica". Duas contas para a mesma pergunta é como esta tela acabou com
    // três cartões diferentes para o mesmo dia.
    const atual = reg.hoje;

    const contagem = { A: 0, R: 0, sem: 0 };
    (reg.acoes || []).forEach((_, i) => {
      const v = marcas[i];
      contagem[v === "A" ? "A" : v === "R" ? "R" : "sem"] += 1;
    });
    const idsA = new Set(
      (reg.acoes || []).flatMap((it, i) => (marcas[i] === "A" ? it.ids || [] : [])).map(txt),
    );
    const resolvidos = (reg.ajustes || []).filter(
      (o) =>
        idsA.has(txt(o.id_ocorrencia)) &&
        ["EFETUADO", "RECUSADO"].includes(txt(o.situacao_ajuste).toUpperCase()),
    ).length;

    const monta = ({ fica: cru, notas: notasCru, bloqueio, aceitos, travado }) => {
      // montador.py:417 — passo 4. O `simulaCartao` é a PRÉVIA (aplica os pedidos); quem
      // diz como o cartão FICA é o montador, e ele encaixa as quatro quando sobra batida.
      const enc = encaixaEmQuatro(cru, reg.categoria);
      const fica = enc.fica;
      const notas = enc.nota ? [...notasCru, enc.nota] : notasCru;
      return {
      travado, atual, fica, notas, bloqueio, contagem, resolvidos,
      jornada: jornadaDoCartao(fica).liquida,
      semAlmoco: faltaAlmoco(fica),
      fecha: [2, 4].includes(fica.length),
      mudou: textoBatidas(atual) !== textoBatidas(fica),
      // O CONTRATO SÓ EXISTE QUANDO O CARTÃO FECHA (app.js:1330): sem aceite não há o que
      // prometer, e um cartão de 3 batidas nunca pode virar plano de execução.
      contrato: !travado && aceitos && !bloqueio && [2, 4].includes(fica.length) ? textoBatidas(fica) : "",
      };
    };

    // DIA JÁ DECIDIDO: aqui é o cartão que FICOU — `montarRegistros` já monta o `depois`
    // respeitando a decisão (e o contrato congelado manda por cima). Nada de prévia num
    // caso fechado. O bloqueio vem PRONTO de lá em vez de ser remedido.
    if (reg.decJa)
      return monta({ fica: reg.depois || [], notas: arruma(reg.notas), bloqueio: reg.bloqueio, aceitos: 0, travado: true });

    const aceitos = pedidosDaPrevia(reg.ajustes || []).filter((o) => idsA.has(txt(o.id_ocorrencia)));
    const sim = simulaCartao({
      batidas: reg.antesBruto,
      pedidos: aceitos.map(pedidoDoMotor),
      refs,
      cartaoFechado: fechado,
    });
    const notas = arruma(sim.notas);
    return monta({ fica: sim.batidas, notas, bloqueio: bloqueioSimulacao(notas), aceitos: aceitos.length, travado: false });
  }, [reg, marcas]);

  /* ── "E SE FOSSEM ALTERAÇÕES?" — NÃO depende das marcas: reprojeta os pedidos COMO
   * VIERAM, com a operação certa. Por isso mora fora do `montado`. */
  const comoAlteracao = useMemo(() => projecaoComoAlteracao(reg), [reg]);

  /* ── A RESERVA LANÇADA, do Controle de Reservas do INOVE ────────────────────
   * Leitura de UMA pessoa num dia, só quando o caso abre — a tabela não está (nem deve
   * estar) na allowlist do gateway do DP360, e o leitor já existe no cartão compartilhado.
   * Engole o próprio erro: sem reserva (ou sem permissão) o selo não aparece. */
  const [reserva, setReserva] = useState(null);
  useEffect(() => {
    let vivo = true;
    setReserva(null);
    if (!reg?.cracha || !reg?.iso) return undefined;
    lerReservaDoDia(reg.cracha, reg.iso).then((r) => { if (vivo) setReserva(r); });
    return () => { vivo = false; };
  }, [reg?.cracha, reg?.iso]);

  if (!reg) return null;
  const c = reg.caso;
  const g = reg.gordura || {};
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
  // aceitar o dia precisa de cartão simulável e de dia não-misto; recusar, não (main.py).
  const travaAceite = motivoForaDoLote(reg, "aceitar");
  const travaRecusa = motivoSemDecisao(reg);
  // MARCAR NÃO É DECIDIR O DIA, e por isso a trava dele é a de baixo — as quatro de
  // `motivoSemDecisao`, nunca as três de `motivoForaDoLote`. É de propósito: o dia MISTO e
  // o dia com a simulação bloqueada são exatamente os que só se resolvem por ocorrência.
  const travaMarcar = motivoSemDecisao(reg);
  const marcado = selosDaMarcacao(reg);
  const desfecho = txt(reg.desfecho);
  const corDesfecho = { EFETUADO: "ok", RECUSADO: "erro", PENDENTE: "alerta" }[desfecho] || "neutro";
  // nível RESERVA vem CRU da `ponto_gordura` (gordura acima de 120 min = provável standby).
  // É pista, não lançamento: quem manda é o documento do gestor.
  const nivelReserva = [txt(g.nivel_entrada), txt(g.nivel_saida)].includes("RESERVA");

  return (
    /* MODAL, como na ferramenta (app.js:638 monta em `modal-root`). Era um card no fim da
       página: com 40 linhas na grade, clicar numa linha não fazia nada VISÍVEL. O cabeçalho
       fica fixo e só o corpo rola, senão o X sai de vista. */
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
              Caso · {PORTA_DE(reg.temAviso ? "aviso" : "pedido").label}
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
            {/* O CARTÃO DO DIA: o pop-up compartilhado (Revisão/Gordura), com o Real manual
                dentro — é aqui que o DP que discorda da régua crava o horário sem sair da
                tela e sem reachar data + categoria + pessoa na Revisão. */}
            <BotaoAcao
              disabled={abrindoCartao}
              titulo="Abre o cartão do dia (o mesmo pop-up da Revisão e da Gordura): fontes, sugestão, GPS, linha do tempo — e o Real manual, que é o TOPO da régua do veredito por ponta."
              onClick={() => aoAbrirCartao(reg)}
            >
              {abrindoCartao ? "abrindo…" : "🗂 Cartão do dia"}
            </BotaoAcao>
            <BotaoAcao
              titulo="Imprime o histórico deste caso: KPIs, o ponto, o alvo, o que ele pediu, a trilha e o próximo passo. Sai do MESMO cartão que está na tela."
              onClick={imprimirHistorico}
            >
              🖨 Imprimir
            </BotaoAcao>
            <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar detalhe">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="rv-corpo oc-det-corpo">
          {/* O CONTEXTO, EM UMA LINHA. Ele repetia o alvo que já está em dois outros lugares
              e ocupava um bloco de quatro colunas; o alvo agora tem um desenho só (o card
              do cartão, ao lado), e aqui fica o que não está em lugar nenhum: a origem, o
              que o Transnet respondeu e a reserva. */}
          <div className="oc-ctx">
            <span>
              {/* app.js:59 — sem aviso nosso, ele mesmo viu e corrigiu. A diferença decide se
                  a recusa pode virar advertência, então é dita por extenso. */}
              <b>
                {txt(c.aviso_enviado_em)
                  ? `avisamos em ${fmtDataHora(c.aviso_enviado_em)}`
                  : reg.temAviso
                    ? "avisamos neste dia (ocorrência lançada)"
                    : "iniciativa do colaborador"}
              </b>
              {" · "}{reg.tipoLabel}
            </span>
            {desfecho ? (
              <Selo cor={corDesfecho} titulo="Desfecho lido do lake — a grade do Transnet é cópia do dia anterior, então um PENDENTE pode estar velho.">
                Transnet: {desfecho.toLowerCase()}
              </Selo>
            ) : null}
            {reserva ? (
              <Selo cor="accent" titulo={`Reserva lançada pelo gestor no INOVE${txt(reserva.hora_entrada) || txt(reserva.hora_saida) ? ` — ${txt(reserva.hora_entrada) || "—"} às ${txt(reserva.hora_saida) || "—"}` : ""}${txt(reserva.cobertura) ? ` · cobertura: ${txt(reserva.cobertura)}` : ""} · o real vira a união reserva ∪ operação`}>
                🅡 reserva INOVE
              </Selo>
            ) : nivelReserva ? (
              <Selo cor="alerta" titulo="A gordura classificou a ponta como RESERVA (acima de 120 min): provável standby/prontidão, tempo legítimo.">
                🅡 nível reserva (gordura)
              </Selo>
            ) : null}
            {/* Sem fonte de operação, isto virava "operação real — – —": três traços que
                ocupam a linha para dizer que não há nada a dizer. */}
            {txt(g.real_inicio) || txt(g.real_fim) ? (
              <span className="dp-faint">
                operação real {txt(g.real_inicio) || "—"} – {txt(g.real_fim) || "—"}
              </span>
            ) : null}
          </div>

          <div className="oc-det-grid">
            <div className="dp-card">
              <div className="dp-muted" style={ROTULO_CARD}>
                O pedido do colaborador — veredito por ocorrência
              </div>
              {reg.ajustes.length ? (
                <>
                  {/* AS DUAS RÉGUAS, DITAS COM O NOME DELAS. Elas são duas de propósito e
                      medem coisas diferentes: o veredito do DIA compara o cartão simulado
                      com a RÉGUA (real manual > alvo congelado > sugestão > canon); o
                      veredito de CADA PEDIDO compara o horário pedido com o ALVO do aviso —
                      o que a gente pediu que ele batesse. O rodapé desta tela prometia que o
                      Real manual mandava nas duas, e não manda: ele é a régua do dia. Quando
                      as duas discordam, quem decide é o operador, e para isso ele precisa
                      saber contra o que cada uma mediu. */}
                  <div className="dp-faint" style={{ ...MINI, margin: "6px 0" }}>
                    alvo do aviso: {reg.alvoPar?.[0] || "—"} / {reg.alvoPar?.[1] || "—"} (fonte:{" "}
                    {reg.fonteAlvo || "sem alvo"}) · resumo do motor: {reg.resumoAcoes?.resumo || "—"}
                  </div>
                  {/* A DECISÃO JÁ TOMADA VEM PRIMEIRO e cala o veredito automático
                      (app.js:258): reabrir um dia marcado e pedir o veredito de novo faz o
                      DP julgar duas vezes a mesma coisa. As marcas abaixo são as DELE. */}
                  {marcado ? (
                    <div className="oc-mt-marcado">
                      <b>✓ Você já marcou este dia</b> — {marcado.nA} para aceitar e {marcado.nR} para
                      recusar, gravados em <span className="dp-mono">ajuste_ids</span>.{" "}
                      <span className="dp-muted">
                        O <span className="dp-mono">aceite</span> continua <b>pendente</b>: marcar é
                        decidir, lançar é o passo seguinte.
                      </span>{" "}
                      <BotaoAcao
                        tom={marcado.lado === "aceitar" ? "ok" : "erro"}
                        disabled={Boolean(travaMarcar) || gravando}
                        titulo={
                          travaMarcar ||
                          `main.py:aplicar_marcados — promove a marcação para aceite=${marcado.lado === "aceitar" ? "aceito" : "rejeitado"} SEM redecidir: ajuste_ids e correcao_status ficam como estão. Depois disso o robô pode executar.`
                        }
                        onClick={() => aoAplicarMarcados(reg)}
                      >
                        ▸ Lançar esta marcação ({marcado.nA}✓ {marcado.nR}✗)
                      </BotaoAcao>
                    </div>
                  ) : null}
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
                  {/* O CARD DO MONTADOR fica GRUDADO nas marcas e ACIMA do botão que grava:
                      é ele que responde "como o cartão fica seguindo as suas marcas", e o
                      contrato congelado é exatamente o que está desenhado nele. */}
                  <Montador reg={reg} montado={montado} />
                  <ComoAlteracao reg={reg} proj={comoAlteracao} gravando={gravando} aoAplicar={aoComoAlteracao} />
                  <div style={{ ...FILA, marginTop: 8 }}>
                    <BotaoAcao
                      titulo={
                        travaMarcar
                          ? `Não dá para marcar: ${travaMarcar}`
                          : "Grava A:/R: por ocorrência em ajuste_ids (main.py:marcar_ajustes) e congela como contrato o cartão do card acima. O aceite do dia continua PENDENTE: depois use “Lançar esta marcação”, aqui ou na grade."
                      }
                      disabled={Boolean(travaMarcar) || gravando || (!aceitarIds.length && !rejeitarIds.length)}
                      onClick={() => aoMarcar(reg, aceitarIds, rejeitarIds, montado?.contrato)}
                    >
                      Gravar marcação por ocorrência ({aceitarIds.length}A / {rejeitarIds.length}R)
                    </BotaoAcao>
                    <span className="dp-faint" style={MINI}>é por aqui que o dia MISTO se decide</span>
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
                          <Selo cor={
                            txt(o.situacao_ajuste).toUpperCase() === "RECUSADO" ? "erro"
                              : txt(o.situacao_ajuste).toUpperCase() === "EFETUADO" ? "ok" : "alerta"
                          }>
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
              {/* DIA SEM BATIDA NENHUMA. Vale nos DOIS ramos de propósito: o caso típico é o
                  dia sem pedido, mas um dia sem cartão também pode ter pedido — e nos dois a
                  saída é a mesma, porque não existe ponta para corrigir. */}
              {reg.semBatida ? (
                <LancarDiaSemPonto
                  regs={[reg]}
                  ocupado={gravando || disparando}
                  aoLancar={aoLancarDia}
                  noCasoAberto
                  titulo="Dia sem ponto — lançar a ocorrência"
                />
              ) : null}
            </div>

            <div className="dp-card">
              <div className="dp-muted" style={ROTULO_CARD}>O cartão e a régua</div>
              <div style={{ marginTop: 8 }}>
                {/* O CARTÃO DE HOJE nos quatro compartimentos — o MESMO desenho da grade. */}
                <Linha rotulo={`Bateu (${reg.antesFonte})`}>
                  <span style={PILHA}>
                    <LinhaCartao horas={reg.slotsHoje} />
                    {reg.fantasmas?.length ? (
                      <span className="dp-faint" style={MINI}
                        title="batidas duplicadas em ≤6 min — o mesmo evento registrado duas vezes">
                        fantasmas: {reg.fantasmas.map(min2hm).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </Linha>
                {/* O ALVO É O CARTÃO FINAL INTEIRO — o mesmo `cartaoFinal` da coluna da grade
                    e do papel. Antes este bloco chegava a escrever "E não pedido · S não
                    pedido", que não é cartão nenhum. */}
                <Linha rotulo="Alvo (o final)">
                  <CartaoAlvo alvo={reg.alvo} legenda />
                </Linha>
                <Linha rotulo="Escala">
                  <span className="dp-mono dp-num">{reg.escala[0] || "—"} – {reg.escala[1] || "—"}</span>
                </Linha>
                <Linha rotulo="Régua do dia">
                  <span className="dp-muted">
                    E <span className="dp-mono dp-num">{reg.refE || "—"}</span> ({reg.baseE || "sem base"})
                    {" "}· S <span className="dp-mono dp-num">{reg.refS || "—"}</span> ({reg.baseS || "sem base"})
                    {" "}· tolerância {TOLERANCIA_MIN} min
                  </span>
                </Linha>
                <Linha rotulo="Veredito por ponta"><PontasES reg={reg} /></Linha>
                <Linha rotulo="Situação"><CelulaSituacao reg={reg} /></Linha>
                {reg.notas?.length ? (
                  <Linha rotulo="O que o motor viu">
                    <span className="dp-muted" style={MINI}>{reg.notas.join(" · ")}</span>
                  </Linha>
                ) : null}
                {etapas.length ? (
                  <Linha rotulo="Linha do tempo">
                    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {etapas.map(([rotulo, valor]) => (
                        <li key={rotulo} style={{ ...FILA, gap: 6 }}>
                          <span style={{ color: "var(--dp-ok-ink)" }}>✓</span>
                          <span style={{ fontWeight: 600 }}>{rotulo}</span>
                          <span className="dp-muted dp-num">{fmtDataHora(valor)}</span>
                        </li>
                      ))}
                    </ol>
                  </Linha>
                ) : null}
                {txt(c.correcao_status) ? (
                  <Linha rotulo="Desfecho gravado">
                    <span className="dp-faint" style={MINI}>
                      correcao_status: {txt(c.correcao_status)}
                      {/* `usuario` vai com o NOME CRU da coluna: é terra de ninguém — a
                          conciliação e o bot também escrevem ali. */}
                      {txt(c.usuario) ? <>{" · "}<span className="dp-mono">usuario</span>: {txt(c.usuario)}</> : null}
                    </span>
                  </Linha>
                ) : null}
              </div>
            </div>
          </div>

          {/* DECISÃO DO DIA. As duas recusas são botões DIFERENTES de propósito: "recusar" e
              "advertir" nunca podem sair do mesmo clique. */}
          <div className="dp-card" style={{ marginTop: 12, background: "var(--dp-surface-2)" }}>
            {/* NOME DE TABELA NÃO É TÍTULO. `ponto_caso` dizia onde grava para quem
                nunca vai abrir o banco, e roubava a linha do que o título tem de dizer:
                que esta decisão vale o DIA INTEIRO, e que executar vem depois. */}
            <div className="dp-muted" style={ROTULO_CARD}
              title="Grava a decisão do dia em ponto_caso. Gravar não executa: quem mexe no Transnet é o robô, no passo seguinte.">
              Decisão do dia inteiro <span className="dp-faint">· a execução é o passo seguinte</span>
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
                    <BotaoAcao titulo="main.py:desfazer_decisao — aceite volta a 'pendente'"
                      disabled={gravando} onClick={() => aoDesfazer(reg)}>
                      ↩ Desfazer decisão
                    </BotaoAcao>
                  )}
                </>
              ) : (
                <>
                  <BotaoAcao
                    tom="ok"
                    titulo={
                      travaAceite ||
                      (marcado
                        ? "ATENÇÃO: aceita TODAS as ocorrências e reescreve ajuste_ids sem os prefixos A:/R: — apagaria a sua marcação. Para valer o que está marcado, use “Lançar esta marcação”."
                        : "Grava aceite=aceito, ajuste=certo e o contrato antes/depois")
                    }
                    disabled={Boolean(travaAceite) || gravando}
                    onClick={() => aoAceitar(reg)}
                  >
                    Aceitar o dia
                  </BotaoAcao>
                  {reg.temAviso ? (
                    <>
                      <BotaoAcao
                        tom="erro"
                        titulo={travaRecusa || "Rejeita E MANTÉM o caso na cadeia de advertência/correção (correcao_status vazio). Só é possível porque existe aviso registrado neste crachá+dia."}
                        disabled={Boolean(travaRecusa) || gravando}
                        onClick={() => aoRejeitar(reg, "completo")}
                      >
                        Rejeitar → advertência e correção
                      </BotaoAcao>
                      <BotaoAcao
                        titulo={travaRecusa || "Rejeita e ENCERRA: correcao_status='dispensada' tira o caso da fila de advertência para sempre."}
                        disabled={Boolean(travaRecusa) || gravando}
                        onClick={() => aoRejeitar(reg, "rejeitar")}
                      >
                        Só rejeitar (dispensa advertência)
                      </BotaoAcao>
                    </>
                  ) : (
                    <BotaoAcao
                      tom="erro"
                      titulo={travaRecusa || "Sem aviso no dia: a recusa encerra o caso (dispensada) e NUNCA vira advertência."}
                      disabled={Boolean(travaRecusa) || gravando}
                      onClick={() => aoRejeitar(reg, "rejeitar")}
                    >
                      Rejeitar (encerra — sem advertência)
                    </BotaoAcao>
                  )}
                </>
              )}
              <span className="dp-faint" style={MINI}>
                {reg.temAviso
                  ? "há aviso neste crachá+dia: a recusa PODE virar advertência, por isso o desfecho é escolhido à mão."
                  : "sem aviso neste crachá+dia: a recusa encerra o caso e nunca vira advertência."}
              </span>
            </div>

            {/* EXECUÇÃO — bloco SEPARADO do de decisão: são dois atos, e o de baixo depende
                de o de cima já ter acontecido. */}
            <BarraRobo
              reg={reg}
              disparando={disparando}
              gravando={gravando}
              aoExecutar={aoExecutar}
              aoConferir={aoConferir}
              aoFecharAMao={aoFecharAMao}
              resultado={resultadoRobo}
            />
          </div>

          {/* O HISTÓRICO IMPRESSO: no DOM, escondido na tela e visível só no papel — é o
              mesmo caso aberto e o MESMO montador, então o papel não tem como contar uma
              história diferente da que está na tela. */}
          <RelatorioCaso reg={reg} montado={montado} />
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
  const [gravando, setGravando] = useState(false);
  const [recado, setRecado] = useState("");
  const [versao, setVersao] = useState(0);
  const [disparando, setDisparando] = useState(false);
  const [resultadoRobo, setResultadoRobo] = useState(null);
  const [cartaoDia, setCartaoDia] = useState(null);
  const [abrindoCartao, setAbrindoCartao] = useState(false);
  const [progresso, setProgresso] = useState(null);
  // Gravou alguma coisa DENTRO do cartão? A releitura da aba custa a varredura do lake por
  // dia — vale a pena UMA vez, ao fechar, e não a cada campo salvo.
  const cartaoGravou = useRef(false);

  /* ══ O LOTE, E É UM SÓ (app.js:208 `DEC`) ═══════════════════════════════════
   * `dec` = { k -> "aceitar" | "rejeitar" }. É PRÉ-DECISÃO: enquanto ninguém aplica,
   * `ponto_caso` não muda. Ele é preenchido pelas caixinhas da linha, pelo "lançar" do dia
   * já marcado e pelo "⌁ Marcar sugestão"; e é consumido por "✓ Aplicar decisões". Um
   * estado, três entradas, uma saída.
   *
   * `selIds` (a ✔ da grade) NÃO decide nada. Ela sobrevive para as duas ações que agem
   * sobre linhas sem julgar nenhuma: CONFERIR no Transnet (só leitura) e LANÇAR DIA SEM
   * PONTO. Antes os dois mecanismos coexistiam e se ignoravam — "marcar sugestão" enchia um
   * e "aceitar marcados" consumia o outro. */
  const [dec, setDec] = useState({});
  const [selIds, setSelIds] = useState([]);

  // Esc fecha o caso, como qualquer pop-up.
  useEffect(() => {
    if (!aberto) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") setAberto(null); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setProgresso(null);
    try {
      const dados = await carregarOcorrencias((feitos, total) => setProgresso({ feitos, total }));
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

  const linhas = useMemo(
    () => (temEixos ? noRecorteDeData.filter(porEixoStatus(eixoStatus)) : daAba),
    [daAba, noRecorteDeData, temEixos, eixoStatus],
  );

  // Filtro que sobrevive à navegação é como se abre uma aba que parece vazia — e como se
  // aplica uma decisão de outra aba sem ver a linha.
  const zerar = () => {
    setEixoStatus("PENDENTE");
    setEixoData("TODAS");
    setAberto(null);
    setSelIds([]);
    setDec({});
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
        // As marcas do lote são PRÉ-DECISÃO sobre o estado que acabou de mudar: mantê-las
        // depois de gravar é oferecer um segundo clique sobre um dado velho.
        setDec({});
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
          `Grava ajuste_ids com A:/R: e mantém aceite=pendente. Marcar é decidir; para LANÇAR, ` +
          `use depois "Lançar esta marcação" (aqui ou na grade) — é ele que promove a decisão ` +
          `sem redecidir por cima.`,
      )) return;
      executarGravacao(`Marcação gravada (${reg.nome} · ${reg.dataBR})`, () =>
        gravarMarcacao(reg, aceitarIds, rejeitarIds, contrato),
      );
    },
    [executarGravacao],
  );

  /** A promoção de UM caso — a mesma que o lote faz em massa (main.py:aplicar_marcados). */
  const aoAplicarMarcados = useCallback(
    (reg) => {
      const m = selosDaMarcacao(reg);
      if (!m) { setRecado("Este dia não tem marcação por ocorrência para lançar."); return; }
      const trava = motivoSemDecisao(reg);
      if (trava) { setRecado(`Não dá para lançar a marcação: ${trava}.`); return; }
      if (!confirmar(
        `LANÇAR A MARCAÇÃO do dia ${reg.dataBR} de ${reg.nome} (${reg.cracha}).\n\n` +
          `${m.nA} aceitar · ${m.nR} recusar, já gravados em ajuste_ids.\n` +
          `Grava só o aceite=${m.lado === "rejeitar" ? "rejeitado" : "aceito"} (havendo recusa, a recusa manda). ` +
          `ajuste_ids e correcao_status NÃO são tocados — a intenção que você registrou fica.\n\n` +
          `Depois disso o robô pode executar. NÃO roda o robô aqui.`,
      )) return;
      executarGravacao(`Marcação lançada (${reg.nome} · ${reg.dataBR})`, () => aplicarMarcados(reg));
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
    try {
      const dados = await lerCartaoDoDia(reg.cracha, reg.iso);
      if (!dados) {
        setRecado(`Sem linha em ponto_diario para ${reg.nome} · ${reg.dataBR} — não há cartão do dia para abrir.`);
        return;
      }
      cartaoGravou.current = false;
      setCartaoDia(dados);
    } catch (e) {
      setRecado(`Falhou: ${e?.message || e}`);
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
        await carregar();
      } catch (e) {
        avisar("erro", `Falhou: ${e?.message || "Não foi possível disparar o robô."}`);
      } finally {
        setDisparando(false);
      }
    },
    [carregar],
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
            ? "Valendo, o que bater é fechado NO NOSSO BANCO: conferido_em, aviso_conferido_em e o veredito — e o dia que o Transnet não aceita vira correcao_status='ponto_fechado'. É esse carimbo que tira o caso de \"Execução pendente\"."
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

  /* ══ O LOTE: MARCAR SUGESTÃO → APLICAR DECISÕES (app.js:2092 e :315) ═════════
   *
   * `dec` é preenchido de três jeitos e consumido por um só. O que ele NUNCA faz é propor o
   * que o clique depois recusaria: cada linha passa por `motivoForaDoLote` com a ação
   * sugerida ANTES de ser marcada, e a trava é revalidada na hora de aplicar — a tela pode
   * ter recarregado no meio, e o que valia então pode não valer mais.
   *
   * O BOTÃO DIZ O QUE O PRÓXIMO CLIQUE FAZ (app.js:2131): com algo marcado, vira
   * "Desmarcar (N)". O escopo é o que está EM TELA (`linhas`), como no original. */
  const contDec = useMemo(() => {
    let ac = 0;
    let rj = 0;
    linhas.forEach((r) => {
      if (dec[r.k] === "aceitar") ac += 1;
      else if (dec[r.k] === "rejeitar") rj += 1;
    });
    return { ac, rj, total: ac + rj };
  }, [linhas, dec]);

  const aoDecidirLinha = useCallback((reg, lado) => {
    setDec((m) => {
      const novo = { ...m };
      if (lado) novo[reg.k] = lado;
      else delete novo[reg.k];
      return novo;
    });
  }, []);

  const marcarSugestao = useCallback(() => {
    const chaves = linhas.map((r) => r.k);
    const jaMarcadas = chaves.filter((k) => dec[k]).length;
    if (jaMarcadas) {
      setDec((m) => {
        const novo = { ...m };
        chaves.forEach((k) => delete novo[k]);
        return novo;
      });
      setRecado(`${jaMarcadas} marcação(ões) desfeita(s) — nada tinha sido gravado.`);
      return;
    }
    const novo = {};
    let fora = 0;
    let semSugestao = 0;
    linhas.forEach((r) => {
      // DIA JÁ MARCADO por ocorrência: a sugestão dele é o LADO QUE ELE MESMO ESCOLHEU, não
      // o veredito do dia — aplicar vai PROMOVER a marcação, não redecidir por cima.
      const marcado = selosDaMarcacao(r);
      if (marcado) {
        if (motivoSemDecisao(r)) { fora += 1; return; }
        novo[r.k] = marcado.lado;
        return;
      }
      const acao = r.diaStatus === "certo" ? "aceitar" : r.diaStatus === "errado" ? "rejeitar" : "";
      if (!acao) { semSugestao += 1; return; }
      if (motivoForaDoLote(r, acao)) { fora += 1; return; }
      novo[r.k] = acao;
    });
    const ac = Object.values(novo).filter((v) => v === "aceitar").length;
    const rj = Object.values(novo).length - ac;
    setDec(novo);
    setRecado(
      ac + rj
        ? `Marcado: ${ac} para aceitar, ${rj} para recusar. NADA foi gravado — confira as linhas e use “Aplicar decisões”.` +
            (fora ? ` ${fora} fora do lote (misto, vencido, sem simulação ou com aviso).` : "") +
            (semSugestao ? ` ${semSugestao} sem veredito para sugerir.` : "")
        : "Nenhuma linha desta lista tem veredito que possa entrar em lote.",
    );
  }, [linhas, dec]);

  /**
   * APLICA O LOTE — e o caminho depende do estado de cada linha (app.js:315).
   *
   * Dia JÁ MARCADO por ocorrência → `aplicar_marcados`: PROMOVE. Redecidir por cima com
   * `confirmar_certos`/`confirmar_errados` reescreveria `ajuste_ids` sem os prefixos (o dia
   * misto perderia o que foi aceito e o que foi recusado) e regravaria `correcao_status`,
   * apagando a intenção de corrigir. Por isso a trava dele é `motivoSemDecisao`, NÃO
   * `motivoForaDoLote`: um dia misto é exatamente o que se marca por ocorrência, e barrá-lo
   * aqui deixaria a marcação outra vez sem porta de saída.
   *
   * Dia NÃO marcado → decisão de dia inteiro, com a trava do lote de sempre.
   */
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
    async (valendo) => {
      const lista = linhas.filter((r) => dec[r.k]);
      if (!lista.length) {
        setRecado("Marque nas caixinhas quais dias entram no cancelamento.");
        return;
      }
      const casos = casosDeRegistros(lista);
      if (!casos) {
        avisar(
          "Sem crachá+dia para escopar o robô — disparo cancelado. Escopo vazio faria o workflow rodar a fila inteira.",
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
        setRecado(texto + (r?.painel ? ` ${r.painel}` : ""));
        // a marcação só se apaga quando ela virou disparo de verdade; no ensaio ela
        // continua ali, que é o ponto do ensaio (conferir e então mandar valendo).
        if (valendo) setDec({});
        await carregar();
      } catch (e) {
        setRecado(`Falhou: ${e?.message || "não foi possível disparar o robô."}`);
      } finally {
        setDisparando(false);
      }
    },
    [linhas, dec, carregar],
  );

  const aplicarDecisoes = useCallback(() => {
    const alvo = linhas.filter((r) => dec[r.k]);
    if (!alvo.length) { setRecado("Marque Aceitar ou Rejeitar em ao menos uma linha."); return; }

    const promover = alvo.filter((r) => selosDaMarcacao(r));
    const novos = alvo.filter((r) => !selosDaMarcacao(r));

    const bloqueados = [
      ...promover.map((r) => ({ r, motivo: motivoSemDecisao(r) })),
      ...novos.map((r) => ({ r, motivo: motivoForaDoLote(r, dec[r.k]) })),
    ].filter((x) => x.motivo);
    if (bloqueados.length) {
      setRecado(
        `Lote recusado — ${bloqueados.length} linha(s) não podem entrar: ` +
          bloqueados.slice(0, 6).map((x) => `${x.r.nome} ${x.r.dataBR} (${x.motivo})`).join(" · ") +
          (bloqueados.length > 6 ? " …" : "") + ". Tire a marca dessas linhas ou abra cada caso.",
      );
      return;
    }

    const ac = novos.filter((r) => dec[r.k] === "aceitar");
    const rj = novos.filter((r) => dec[r.k] === "rejeitar");
    const lista = (regs) =>
      regs.slice(0, 8).map((r) => `· ${r.nome} ${r.dataBR}`).join("\n") +
      (regs.length > 8 ? `\n… e mais ${regs.length - 8}` : "");
    if (!confirmar(
      `APLICAR ${alvo.length} decisão(ões):\n\n` +
        (promover.length
          ? `LANÇAR A MARCAÇÃO (${promover.length}) — já decididos por ocorrência, só promove:\n${lista(promover)}\n\n`
          : "") +
        (ac.length ? `ACEITAR o dia (${ac.length}):\n${lista(ac)}\n\n` : "") +
        (rj.length ? `REJEITAR e ENCERRAR (${rj.length}):\n${lista(rj)}\n\n` : "") +
        (promover.length
          ? `Nos marcados, só o aceite muda: ajuste_ids e correcao_status ficam como estão.\n`
          : "") +
        (rj.length
          ? `Nas recusas de dia inteiro: correcao_status="dispensada" — nenhum destes dias tem aviso, então nenhuma vira advertência.\n`
          : "") +
        `\nNÃO roda o robô: o disparo é sempre de UM caso, no caso aberto.`,
    )) return;

    executarGravacao(`${alvo.length} caso(s) gravado(s)`, async () => {
      const avisos = [];
      // um a um: o upsert em lote esconderia qual linha falhou
      for (const reg of promover) {
        const a = await aplicarMarcados(reg);
        if (a) avisos.push(a);
      }
      for (const reg of novos) {
        const a = dec[reg.k] === "aceitar" ? await gravarAceite(reg) : await gravarRecusa(reg, "rejeitar");
        if (a) avisos.push(a);
      }
      return avisos.join(" · ");
    });
  }, [linhas, dec, executarGravacao]);

  /* ── colunas de cada grade (formato do TabelaDP: id/titulo/valor/render) ── */

  const acoesDecisao = {
    gravando,
    aoDecidir: aoDecidirLinha,
    aoAbrir: abrir,
    aoDesfazer,
  };

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
  const colSituacao = {
    id: "sit",
    titulo: "Situação",
    largura: 170,
    valor: (r) => SIT[r.situacao]?.rotulo || r.situacao,
    render: (r) => <CelulaSituacao reg={r} />,
  };
  const colDecisao = (largura) => ({
    id: "dec",
    titulo: "Decisão",
    largura,
    ordenavel: false,
    valor: (r) => (r.decJa ? (r.decJa.aceito ? "aceito" : "recusado") : dec[r.k] || "a decidir"),
    render: (r) => <CelulaDecisao reg={r} dec={dec[r.k] || ""} {...acoesDecisao} />,
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
  const COLS_PEDIDO = [colColaborador, colDia, colBateu, colAlvo, colPontas, colDecisao(230), colAjustes];

  // app.js:2647 (COLS_ENV) — Meus avisos. Aqui o ajuste é RESPOSTA a um aviso nosso: o
  // assunto é o dia todo, e o alvo tem os quatro compartimentos.
  const COLS_AVISO = [
    colColaborador, colDia, colOque, colBateu, colAlvo, colAjustes,
    {
      id: "prazo", titulo: "Prazo (48h)", largura: 140,
      valor: (r) => (r.restam == null ? "" : Math.round(r.restam)),
      render: (r) => <CelulaPrazo reg={r} />,
    },
    {
      id: "acao", titulo: "Decisão", largura: 240, ordenavel: false,
      valor: (r) => r.situacaoAviso,
      render: (r) =>
        r.situacaoAviso === "vencido" ? (
          <div style={PILHA}>
            <BotaoExecucao tom="erro" motivo={MOTIVO_VENCIDO}>⚠ Vencido — advertir e corrigir</BotaoExecucao>
            <span style={{ ...MINI, color: "var(--dp-danger-ink)" }}>
              não entra em lote — só a cadeia advertência → correção
            </span>
          </div>
        ) : (
          <CelulaDecisao reg={r} dec={dec[r.k] || ""} {...acoesDecisao} />
        ),
    },
  ];

  const COLS_COMENT = [colColaborador, colDia, colOque, colBateu, {
    id: "quando", titulo: "Enviado em", largura: 140, classe: "dp-num",
    valor: (r) => txt(r.caso.aviso_enviado_em),
    render: (r) => <span className="dp-muted dp-num">{fmtDataHora(r.caso.aviso_enviado_em)}</span>,
  }];

  const COLS_LISTA = [colColaborador, colDia, colSituacao, colBateu, colAlvo, colPontas, colQuando, colAjustes];

  // Execução pendente: é aqui que mora o DESFAZER (o bot ainda não executou).
  const COLS_EXEC = [colColaborador, colDia, colSituacao, colBateu, colAlvo, colQuando, colDecisao(240)];

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
  const barraLote = grade.loteDecisao ? (
    <div style={{ ...FILA, gap: 8 }}>
      <BotaoAcao
        titulo={
          contDec.total
            ? "Tira a marcação de todos os dias desta lista. Nada tinha sido gravado."
            : "Marca em cada linha o veredito sugerido (certo→aceitar, errado→rejeitar); dia já marcado por ocorrência recebe o lado que VOCÊ escolheu lá dentro. NÃO grava. Dia misto, aviso vencido, dia sem simulação confiável e recusa de dia COM aviso continuam fora."
        }
        disabled={gravando || !linhas.length}
        onClick={marcarSugestao}
      >
        {contDec.total ? `⌁ Desmarcar (${contDec.total})` : "⌁ Marcar sugestão"}
      </BotaoAcao>
      <BotaoAcao
        tom="ok"
        titulo="Grava o lote: dia já marcado por ocorrência é PROMOVIDO (aplicar_marcados, sem redecidir); dia novo recebe aceite=aceito ou aceite=rejeitado+dispensada. NÃO roda o robô."
        disabled={!contDec.total || gravando}
        onClick={aplicarDecisoes}
      >
        {contDec.total ? `✓ Aplicar decisões (${contDec.ac}✓ ${contDec.rj}✗)` : "✓ Aplicar decisões"}
      </BotaoAcao>
      {/* CANCELAR usa a MESMA marcação, ignorando o lado — e vive só na porta do pedido:
          na do aviso, desistir é "Cancelar aviso", dentro do caso, e é outra coisa (lá
          existe aviso nosso, e cancelar mexe no prazo das 48 h). */}
      {porta === "pedido" ? (
        <>
          <span className="oc-sep" aria-hidden="true" />
          <BotaoAcao
            titulo="O robô abre a grade ao vivo e mostra o que RECUSARIA nos dias marcados. Não clica em nada e não grava."
            disabled={!contDec.total || gravando || disparando}
            onClick={() => aoCancelarSelecionados(false)}
          >
            🤖 Cancelar — ensaio
          </BotaoAcao>
          <BotaoAcao
            tom="erro"
            titulo="Recusa no Transnet os IDs ainda pendentes dos dias marcados e fecha o caso como cancelado. O lado da caixinha (aceitar/rejeitar) é ignorado: aqui ela é só a seleção."
            disabled={!contDec.total || gravando || disparando}
            onClick={() => aoCancelarSelecionados(true)}
          >
            ✗ Cancelar selecionados ({contDec.total})
          </BotaoAcao>
        </>
      ) : null}
      <span className="dp-muted dp-num" style={MINI}>
        {contDec.total ? "nada gravado até aplicar" : "marque nas caixinhas da coluna Decisão"}
      </span>
    </div>
  ) : grade.loteConferir ? (
    <div style={{ ...FILA, gap: 8 }}>
      <span className="dp-muted dp-num" style={MINI} title={AVISO_CONFERIR}>
        {selIds.length ? `${selIds.length} marcada(s) na ✔` : "marque linhas para conferir no Transnet (só leitura)"}
      </span>
      <BotaoAcao
        titulo="Lê o cartão ao vivo de cada dia marcado e mostra o resultado no run. Não grava nada."
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
          {registros[0]?.realocados ? (
            <span className="dp-faint" title="A batida que o pedido aponta não estava no cartão do dia declarado e estava no do outro dia de referência (motor: realocaDia).">
              {" "}· {registros[0].realocados} realocado(s) de dia
            </span>
          ) : null}
        </span>
      )}
      {/* O RECADO é a resposta ao último clique — fica sempre visível, nunca atrás de botão. */}
      {recado ? <Selo cor={recado.startsWith("Falhou") ? "erro" : "ok"} quebra>{recado}</Selo> : null}
      {gravando || disparando ? (
        <Selo cor="alerta">{gravando ? "gravando…" : "disparando o robô…"}</Selo>
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

        <Detalhe
          reg={regAberto}
          aoFechar={() => setAberto(null)}
          gravando={gravando}
          aoAceitar={aoAceitar}
          aoRejeitar={aoRejeitar}
          aoDesfazer={aoDesfazer}
          aoMarcar={aoMarcar}
          aoAplicarMarcados={aoAplicarMarcados}
          disparando={disparando}
          aoExecutar={aoExecutarRobo}
          aoConferir={aoConferirRobo}
          aoFecharAMao={aoFecharAMao}
          aoAbrirCartao={abrirCartaoDoDia}
          abrindoCartao={abrindoCartao}
          aoComoAlteracao={aoComoAlteracao}
          aoLancarDia={aoLancarDiaSemPonto}
          resultadoRobo={resultadoRobo}
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
