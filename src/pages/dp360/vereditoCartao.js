// vereditoCartao.js — O CARTÃO DO POP-UP DE OCORRÊNCIAS, EM QUATRO COMPARTIMENTOS.
//
// SEM React, SEM rede, SEM Supabase: entra o registro do dia (`reg`), as marcas que estão
// na tela e o que o DP digitou; sai o cartão com a ORIGEM de cada compartimento. É a única
// conta do pop-up — ele não executa robô, não adverte, não cancela nada.
//
// POR QUE ELE É UM MÓDULO À PARTE, e não mais um bloco dentro das 5.600 linhas da aba:
// esta é a lógica que decide o que vai ser lançado no ponto de uma pessoa, e ela tem de ser
// testável fora do navegador (é assim que `regrasPonto.js` e `regrasMontador.js` já vivem).
// O teste diferencial de HENDESON 30060848 · 02/09 e ALECSANDRO 30061220 · 01/09 roda em
// Node importando este arquivo direto.
//
// NENHUMA RÉGUA NOVA MORA AQUI. O alvo chega pronto em `reg.regua` (o alvo publicado pela
// Revisão com o Real manual por cima — a mesma cascata do `cartaoFinal` da aba), a refeição
// chega pronta nas colunas do dia, e a validação do cartão é o `validaCartao` do montador.
//
// O DESENHO (aprovado pelo dono): a precedência da origem de cada ponta é
//   cravado à mão > pedido aceito > completado com o alvo > batida dele > falta.

// Extensão `.js` EXPLÍCITA de propósito: o Vite resolve sem ela, o Node não — e este
// módulo existe justamente para ser importado por `node` no teste diferencial.
import { CONSTANTES, hm2min, jornadaDoCartao, min2hm, textoBatidas } from "./regrasPonto.js";
import { encaixaEmQuatro, validaCartao } from "./regrasMontador.js";
import { almocoSemFim } from "./diaNoTransnet";

const txt = (v) => String(v ?? "").trim();

/* ══════════ A LEITURA DO DIA — o cartão de hoje e a régua, em quatro slots ══════════
 *
 * As quatro funções abaixo VIERAM da aba (`Ocorrencias.jsx`) sem uma vírgula de mudança de
 * regra. Elas moraram lá enquanto só a grade as usava; agora o pop-up mede contra elas, e
 * "quem lê o cartão do dia" tem de ser testável em Node — é o que este módulo é. A aba
 * continua sendo a única a chamá-las na tela; aqui elas só ficam onde se pode provar.
 */

// "03:07" / "3:07" → "03:07"; qualquer outra coisa → "". É o `hora()` de app.js.
export function horaSlot(v) {
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
export function slotsDoCartao({ cp, caso, lim }) {
  const limpas = (lim || []).filter((t) => t != null).map(min2hm).filter(Boolean);
  const brutoQuatro = limpas.slice(0, 4);

  // 1) AS DUAS BATIDAS SÃO O ALMOÇO QUE O DP JÁ LANÇOU → elas não são as pontas. Sem
  //    tolerância nenhuma: só o par IDÊNTICO.
  //
  //    E O PAR TEM DUAS FONTES, não uma (10/09/2026 — ALECSANDRO 30061220 · 01/09). Lendo
  //    só o congelado do aviso, este dia saía "20:03 · — · — · 20:33" na coluna do ponto e
  //    "14:10 · 20:03 · 20:33 · 23:32" na do alvo: as MESMAS horas em posições diferentes
  //    nas duas colunas, que é exatamente o defeito que esta função existe para não
  //    cometer. O caso dele congelou `alvo_alm_saida` VAZIO, mas a Revisão publicou o par
  //    no dia (`alvo_saida_almoco`/`alvo_volta_almoco`, fonte_almoco = CARTAO_PRESERVADO):
  //    é a mesma afirmação — "este par é o almoço" —, feita pela apuração do dia em vez do
  //    aviso. Continua sem tolerância: só o par idêntico.
  const almoco = [
    horaSlot(caso?.alvo_alm_saida) || horaSlot(cp?.alvo_saida_almoco) || horaSlot(cp?.almoco_saida_sug),
    horaSlot(caso?.alvo_alm_volta) || horaSlot(cp?.alvo_volta_almoco) || horaSlot(cp?.almoco_volta_sug),
  ];
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

// Os quatro campos congelados do `ponto_caso` — o que PEDIMOS naquele crachá+dia.
export const alvoQuatroSlots = (caso) =>
  [caso?.alvo_entrada, caso?.alvo_alm_saida, caso?.alvo_alm_volta, caso?.alvo_saida].map(horaSlot);

/* ══ O QUE A CORREÇÃO LANÇA — O ALVO PUBLICADO PELA REVISÃO (09/09/2026) ═══════════
 *
 * Régua da ferramenta. Duas coisas diferentes se chamam "alvo" no DP360:
 *
 *   · `ponto_caso.alvo_*`  — o que PEDIMOS no aviso, congelado no dia do envio;
 *   · `ponto_diario.alvo_*` — o que a REVISÃO PUBLICA para o dia, recalculado, e que já
 *     vem com a ponta batida preservada quando ela está dentro da régua ("só a ponta errada
 *     muda").
 *
 * QUEM É LANÇADO É O PUBLICADO: `corrigir_pontos` diz "REGRA SIMPLES E AUDITÁVEL: lança
 * exatamente a coluna Pedimos (alvo)", e essa coluna sai de `_aplica_alvo`, que lê o alvo
 * publicado da Revisão.
 *
 * No ALECSANDRO 30061220 · 01/09 o congelado dava "20:03 — — 20:33": o aviso congelou
 * `alvo_entrada = 20:03`, que é a batida do ALMOÇO dele. O publicado do mesmo dia é
 * 13:43 · 20:03 · 20:33 · 23:32 — e o Real manual do DP crava a entrada em 14:10, que entra
 * por cima (é o topo da cascata da régua).
 *
 * Slot que ninguém publicou fica com o que está no cartão de hoje — nada se inventa.
 *
 * A RÉGUA DA GORDURA NÃO É DEGRAU DESTA ESCADA (24/09/2026). `alvo_entrada_ref`/`alvo_saida_ref`
 * estavam aqui entre o publicado e a sugestão, e a ferramenta original diz com todas as
 * letras o que eles são: "Referência crua da operação já com a tolerância. É a régua usada no
 * cálculo da gordura, NÃO o cartão final sugerido" (main.py:6955) — o alvo dela é
 * `alvo_entrada or entrada_sug`, sem a régua. O efeito aqui: justamente no dia em que a
 * Revisão SE RECUSOU a publicar alvo (JORNADA_SUSPEITA, `requer_alvo_manual`), o pop-up
 * mostrava a régua como "do alvo — o que a correção vai lançar". FERNANDO 30061069 20/09
 * bateu 11:55 e o cartão dizia 12:20. Medido: 11 entradas e 23 saídas no pop-up de
 * ocorrências; nenhuma chegou a ser congelada ou lançada. A gordura continua lendo a régua. */
export function alvoPublicado(cp, rm, slotsHoje) {
  const hoje = slotsHoje || ["", "", "", ""];
  const cascata = [
    [rm?.entrada, cp?.alvo_entrada, cp?.entrada_sug],
    [rm?.alm_saida, cp?.alvo_saida_almoco, cp?.almoco_saida_sug],
    [rm?.alm_volta, cp?.alvo_volta_almoco, cp?.almoco_volta_sug],
    [rm?.saida, cp?.alvo_saida, cp?.saida_sug],
  ];
  const slots = cascata.map((degraus, i) => {
    for (const v of degraus) {
      const h = horaSlot(v);
      if (h) return h;
    }
    return hoje[i] || "";
  });
  return slots.some(Boolean) ? slots : null;
}

/* ─────────────────── os quatro compartimentos do Transnet ─────────────────── */

/**
 * A ORDEM É A DO CARTÃO, e `ponta` é o rótulo que o MOTOR usa (`julgaAcoes` devolve
 * exatamente estas quatro strings em `item.ponta`) — é por ele que um pedido encontra o
 * compartimento que ele mira. Nunca casar por texto solto.
 */
export const COMPARTIMENTOS = [
  { chave: "entrada", rotulo: "entrada", ponta: CONSTANTES.PONTAS.ENTRADA },
  { chave: "almSaida", rotulo: "saída almoço", ponta: CONSTANTES.PONTAS.ALM_SAIDA },
  { chave: "almVolta", rotulo: "volta almoço", ponta: CONSTANTES.PONTAS.ALM_VOLTA },
  { chave: "saida", rotulo: "saída", ponta: CONSTANTES.PONTAS.SAIDA },
];

// os dois do meio são a REFEIÇÃO; as duas pontas são o que o dia tem de ter sempre
export const MIOLO = ["almSaida", "almVolta"];

/** A hora de almoço do interno/aprendiz (main.py `_TPL.interno_almoco`: "o descanso mínimo
 *  de 1 hora é um direito do colaborador"). Não vale para motorista. */
export const ALMOCO_INTERNO_MIN = 60;
// as duas pontas têm campo à mão em qualquer categoria
export const PONTAS_MANUAIS = ["entrada", "saida"];

/* ══ O ALMOÇO À MÃO É DO INTERNO (dono, 15/09/2026) ══════════════════════════
 * "Para internos tem que dar a opção de colocar a hora de almoço manual também." No
 * motorista o miolo continua sem campo: é a refeição que NÓS lançamos, travada. No
 * interno/aprendiz ele é livre — o montador encaixa quando dá, e quando não dá (o cartão
 * de seis batidas do WILKER 30061203) quem sabe onde fica o almoço é o DP. */
export const camposAMao = (categoria, { travado } = {}) =>
  (travado === undefined ? mioloTravado(categoria) : travado)
    ? PONTAS_MANUAIS
    : COMPARTIMENTOS.map((c) => c.chave);

/* O TRAÇO NO CAMPO = "ESTA PONTA FICA VAZIA". É o que sobra quando o DP arrasta a hora
 * de um compartimento para outro: sem ele, a ponta de onde a hora saiu voltaria a mostrar
 * a batida de hoje, e a mesma hora apareceria em dois lugares. */
export const VAZIO_A_MAO = "-";

/**
 * DE ONDE VEIO A PONTA — a pílula do bloco. `cor` é a classe `.dp-pill` do dp360.css.
 * A ordem desta lista É a precedência do desenho.
 */
export const ORIGENS = {
  manual: { rotulo: "cravado à mão", cor: "accent", ajuda: "você digitou no campo à mão — é o topo da precedência." },
  movido: { rotulo: "batida movida", cor: "accent", ajuda: "é uma batida dele que você mudou de compartimento — a hora é dele, a posição é sua." },
  limpo: { rotulo: "vazia à mão", cor: "accent", ajuda: "você deixou esta ponta vazia (o traço no campo à mão). Apague o traço para ela voltar." },
  pedido: { rotulo: "pedido aceito", cor: "ok", ajuda: "é o horário que ele pediu e você aceitou; quem lança é o robô `ajustes`." },
  alvo: { rotulo: "do alvo", cor: "accent", ajuda: "é o alvo publicado pela Revisão — o que a correção vai lançar nesta ponta." },
  escala: { rotulo: "da escala", cor: "alerta", ajuda: "não há batida nem alvo apurado neste dia: o horário é o PROGRAMADO da escala, a jornada combinada com ele. Confira antes de gravar." },
  encaixe: { rotulo: "encaixe do montador", cor: "mute", ajuda: "sobrou batida no cartão e o montador encaixou as quatro (montador.py:417)." },
  batida: { rotulo: "batida dele", cor: "mute", ajuda: "já está no cartão e ninguém mexeu nesta ponta — fica como está." },
  refeicao: { rotulo: "🔒 travado", cor: "mute", ajuda: "a refeição do motorista vem da apuração do dia e não muda por marcação nenhuma." },
  vazio: { rotulo: "sem almoço", cor: "mute", ajuda: "a Revisão não apurou almoço neste dia — o cartão do motorista fecha em 2." },
  falta: { rotulo: "falta", cor: "danger", ajuda: "não há de onde tirar esta ponta — o cartão não fecha assim." },
};

/**
 * REFEIÇÃO TRAVADA É SÓ DO MOTORISTA (decisão do dono).
 * "O almoço do motorista foi inserido por NÓS, no passo da Refeição" — então marcação
 * nenhuma o move, e ocorrência que mira o miolo dele é RECUSA. No interno/aprendiz nada
 * trava: o miolo é livre e quem o encaixa é o montador de sempre.
 */
export const mioloTravado = (categoria) => txt(categoria).toUpperCase() === "MOTORISTA";

export const pedidoMiraOMiolo = (item) =>
  [CONSTANTES.PONTAS.ALM_SAIDA, CONSTANTES.PONTAS.ALM_VOLTA].includes(txt(item?.ponta));

export const MOTIVO_MIOLO =
  "a refeição do motorista é travada — o miolo vem da apuração do dia (as colunas da " +
  "importação, a mesma fonte da Revisão) e não muda por marcação: este pedido é recusa.";

/**
 * A MARCA QUE VALE para uma ocorrência. O miolo do motorista não se discute: é "R", com o
 * motivo escrito na tela. Fora dele, vale o que está marcado.
 */
export function marcaDaOcorrencia(reg, marcas, i) {
  const it = (reg?.acoes || [])[i];
  if (!it) return "";
  if (mioloTravado(reg?.categoria) && pedidoMiraOMiolo(it)) return "R";
  return txt((marcas || {})[i]);
}

/**
 * O HORÁRIO QUE O PEDIDO QUER DEIXAR NO CARTÃO.
 * 'Alteração' chega como 'D/ 09:19 P/ 08:30' — o que entra no compartimento é o `P/`, o
 * MESMO destino que `julgaAcoes` julga (senão a tela mostraria um horário e o motor mediria
 * outro).
 */
export function horaDoPedido(item) {
  const h = txt(item?.hora);
  const p = /P\/\s*(\d{1,2}:\d{2})/i.exec(h);
  return hm2min(p ? p[1] : h);
}

/* ───────────────────────── o campo "cravar à mão" ────────────────────────── */

/**
 * O CAMPO ACEITA "2200" E "22:00" — é a mesma leitura do motor (`hm2min`: só dígitos, os
 * dois últimos são minutos). O que ele acrescenta é o MOTIVO CURTO, porque aqui o valor
 * entra no cartão sozinho, sem botão "Usar": quando não entra, a tela tem de dizer por quê
 * embaixo do campo.
 *
 * `47` como teto de hora não é folga: o cartão vira o dia e 25:53 é hora legítima nesta
 * tela (`min2hm(1553)`).
 */
export function leHoraDigitada(bruto) {
  const s = txt(bruto);
  if (!s) return { min: null, erro: "" };
  if (s === VAZIO_A_MAO || s === "—") return { min: null, erro: "", vazio: true };
  let h;
  let mi;
  if (s.includes(":")) {
    const p = /^(\d{1,2}):(\d{1,2})$/.exec(s);
    if (!p) return { min: null, erro: "inválida" };
    if (p[2].length < 2) return { min: null, erro: "incompleta" };
    h = Number(p[1]);
    mi = Number(p[2]);
  } else {
    if (!/^\d+$/.test(s)) return { min: null, erro: "inválida" };
    if (s.length < 3) return { min: null, erro: "incompleta" };
    if (s.length > 4) return { min: null, erro: "inválida" };
    h = Number(s.slice(0, -2));
    mi = Number(s.slice(-2));
  }
  if (mi > 59 || h > 47) return { min: null, erro: "inválida" };
  return { min: h * 60 + mi, erro: "" };
}

/**
 * O ESTIRÃO MÁXIMO entre dois compartimentos — a jornada máxima que a própria ferramenta
 * admite (`SUG_JORNADA_MAX_MIN`, main.py:2745 = 13 h). Não é régua nova: é o teto que já
 * existe, usado aqui só para saber se um horário digitado cabe no MESMO dia do cartão.
 */
const LIMITE_ESTIRAO = CONSTANTES.SUG_JORNADA_MAX_MIN;

/**
 * A ORDEM DO CARTÃO — a única crítica do campo à mão, e é a do desenho: a entrada tem de
 * ser ANTES da saída do almoço, a saída DEPOIS da volta do almoço.
 *
 * E ela não pode ser feita no relógio cru, porque o cartão VIRA O DIA: o motorista que
 * entra 22:00 e almoça 01:30 teria a entrada recusada por "estar depois do almoço". Então
 * desenrola a virada e reprova só o que estoura o estirão — 22:00 contra um almoço de
 * 21:31 viraria um trecho de 23 h 31 até o almoço, que não é dia de trabalho de ninguém.
 */
export function criticaOrdem(chave, min, ref) {
  if (min == null || ref == null) return "";
  if (chave === "entrada") {
    let r = ref;
    while (r < min) r += 1440;
    return r - min <= LIMITE_ESTIRAO ? "" : `antes de ${min2hm(ref)}`;
  }
  let v = min;
  while (v < ref) v += 1440;
  return v - ref <= LIMITE_ESTIRAO ? "" : `depois de ${min2hm(ref)}`;
}

/**
 * ══ A LEITURA CRONOLÓGICA — quando o motor desiste, o relógio responde ══════
 *
 * Aplica os pedidos às batidas e devolve o cartão EM ORDEM: a alteração (`D/ x P/ y`) tira
 * o `x` e põe o `y`; a inserção põe. Minutos ordenados, sem repetição.
 *
 * POR QUE ELA EXISTE. O `simulaCartao` não respondeu para a MARIVANIA 30060671 · 28/08: as
 * duas batidas dela (08:03 e 08:05) estão a 2 minutos, o `removeFantasmas` joga a primeira
 * fora como toque repetido do coletor, sobra UMA e ele devolve "cartão com 1 batida só — o
 * ponto do dia ainda não fechou", sem cartão nenhum. O motor está certo no que julga: um
 * cartão de uma batida não fecha. O que ele não vê é que O PEDIDO DELA DESFAZ O PAR COLADO
 * — a alteração move justamente a batida de 08:05 para 12:00.
 *
 * E ORDEM É A LEITURA CERTA porque no Transnet não existe "compartimento": o cartão é uma
 * lista de batidas, e entrada/saída-almoço/volta/saída é como ela se LÊ. Foi por ler pelo
 * rótulo que a ocorrência declara — e não pelo relógio — que o 12:00 dela sumia atrás do
 * 13:00, os dois se dizendo "saída almoço".
 *
 * NÃO SUBSTITUI O MOTOR: só responde quando ele não respondeu, e só para quem tem o miolo
 * livre (interno/aprendiz). No motorista o almoço é o que NÓS lançamos, e não se reordena.
 *
 * E QUANDO SOBRA BATIDA, QUEM ESCOLHE É O MONTADOR. Medido no lake em 11/09/2026, sobre os
 * 276 crachá+dia pendentes: o motor fechava 84 (30%); a leitura em ordem levou a 125 (45%);
 * e passar o que sobrou pelo `encaixaEmQuatro` — o passo do montador que descarta a batida
 * que sobra (montador.py:417) — levou a 175 (63%). São os cartões de 5, 6 e 8 batidas: o
 * colaborador manda vários pedidos, a soma passa de quatro, e empilhar tudo não é cartão.
 *
 * @param batidas minutos do cartão de hoje (`null` é ignorado)
 * @param pedidos itens com `hora` — "13:00" ou "D/ 08:05 P/ 12:00"
 * @param cat     categoria, para o encaixe saber a régua (motorista fecha em 2 ou 4)
 */
export function cartaoCronologico(batidas, pedidos, cat) {
  const fora = new Set();
  const postos = [];
  (pedidos || []).forEach((it) => {
    const alt = /D\/\s*(\d{1,2}:\d{2})\s*P\/\s*(\d{1,2}:\d{2})/i.exec(txt(it?.hora));
    if (alt) {
      const de = hm2min(alt[1]);
      if (de != null) fora.add(de);
    }
    const m = horaDoPedido(it);
    if (m != null) postos.push(m);
  });
  if (!postos.length) return null;
  const mins = [...(batidas || []).filter((v) => v != null && !fora.has(v)), ...postos]
    .filter((v) => v != null)
    .sort((a, b) => a - b);
  const unicos = [...new Set(mins)];
  if (!validaCartao(unicos, cat)) return unicos;
  // sobrou batida (ou o cartão não fecha assim): o montador escolhe as quatro
  const fica = encaixaEmQuatro(unicos, cat)?.fica || [];
  return fica.length && !validaCartao(fica, cat) ? fica : unicos;
}

/**
 * ══ O ÚLTIMO DEGRAU DO ALVO: A ESCALA ══════════════════════════════════════
 *
 * "Essa ferramenta tem que dar o alvo" (dono, 11/09/2026). Medido no lake no mesmo dia,
 * sobre os 276 crachá+dia pendentes: o pedido resolve 175, o alvo publicado pela Revisão
 * resolve outros 48, e sobram 36 — quase todos INTERNO/APRENDIZ, porque o alvo do
 * `ponto_diario` nasce da operação real do motorista (Citatti/GPS/escala) e o interno não
 * tem operação. Desses 36, TRINTA E SEIS têm escala. Só 3 dias não têm nem uma coisa nem
 * outra.
 *
 * Então a escala é o último degrau: ela é a jornada combinada com a pessoa, e é a mesma
 * régua que o DP usaria à mão. O cartão sai com a origem "da escala" em cada ponta — quem
 * olha vê na hora que aquilo não é batida nem alvo apurado, é o programado.
 *
 * O MIOLO segue a regra de cada um: no motorista, a refeição apurada do dia (a que NÓS
 * lançamos) — sem ela o cartão dele fecha em 2, que é legítimo; no interno, UMA HORA no
 * meio da jornada, que é o descanso que a carta `interno_almoco` cobra dele.
 */
export function alvoDaEscala(cartao, categoria) {
  const cp = cartao || {};
  const e = hm2min(horaSlot(cp.esc_entrada));
  const s0 = hm2min(horaSlot(cp.esc_saida));
  if (e == null || s0 == null) return null;
  let s = s0;
  while (s <= e) s += 1440;                       // jornada que vira a meia-noite
  if (mioloTravado(categoria)) {
    const as = hm2min(horaSlot(cp.almoco_saida_sug));
    const av = hm2min(horaSlot(cp.almoco_volta_sug));
    const dentro = as != null && av != null && as > e && av > as && av < s;
    return dentro
      ? [min2hm(e), min2hm(as), min2hm(av), min2hm(s)]
      : [min2hm(e), "", "", min2hm(s)];
  }
  // interno/aprendiz: uma hora no meio, e só quando a jornada comporta
  if (s - e < ALMOCO_INTERNO_MIN + 120) return [min2hm(e), "", "", min2hm(s)];
  const meio = Math.round((e + s) / 2);
  const saida = meio - ALMOCO_INTERNO_MIN / 2;
  return [min2hm(e), min2hm(saida), min2hm(saida + ALMOCO_INTERNO_MIN), min2hm(s)];
}

/* ═══════════ RECUSAR E CORRIGIR O PONTO ASSIM (dono, 15/09/2026) ══════════════
 *
 * "Consigo recusar os dois e ajustar o cartão ali mesmo?" — é o botão do desktop
 * "✎ Recusar os pedidos e corrigir o ponto assim" (app.js:5626 `aplicarComoAlteracao`):
 * recusa as ocorrências e grava o cartão montado como REAL MANUAL, que é o topo da régua e
 * o que a correção lança. As duas funções abaixo são as duas pontas dessa ida e volta.
 */

/**
 * O CARTÃO DO POP-UP VIRANDO REAL MANUAL. Devolve `{ campos, erro }`.
 *
 * `campos` só traz o que deve ser ESCRITO — coluna ausente no upsert não é tocada, a mesma
 * regra do Cartão do dia. As horas vão como o cartão as desenha ("27:06" na saída que vira
 * a meia-noite): é a forma que o `ponto_real_manual` e o CSV do robô `ponto` já aceitam.
 *
 * O ALMOÇO TRAVADO PELA REVISÃO (`almoco_travado`) não entra — o servidor recusaria o dia
 * inteiro. No motorista ele fica de fora e a correção o tira da régua publicada; no interno,
 * se o DP mexeu justamente nele, é erro dito com todas as letras, antes de gravar qualquer
 * coisa. No motorista sem trava o almoço vai junto: é o que está na tela, e sem ele a
 * correção lançaria o dia sem a refeição que ele já tem.
 */
export function camposParaRealManual(v, { almocoTravado = false } = {}) {
  if (!v) return { campos: null, erro: "sem cartão" };
  if (!v.fecha) return { campos: null, erro: v.problema || "o cartão montado não fecha" };
  const cheios = (v.blocos || []).filter((b) => b.min != null);
  const hora = (chave) => (v.blocos || []).find((b) => b.chave === chave)?.hora || "";
  const campos = { entrada: hora("entrada"), saida: hora("saida") };
  if (!campos.entrada || !campos.saida) return { campos: null, erro: "falta entrada ou saída" };
  const temAlmoco = cheios.length === 4;
  if (almocoTravado) {
    const mexeuNoMiolo = (v.blocos || [])
      .filter((b) => MIOLO.includes(b.chave))
      .some((b) => ["manual", "movido", "limpo"].includes(b.origem));
    if (mexeuNoMiolo)
      return {
        campos: null,
        erro: "o almoço deste dia foi travado pela Revisão — ele não pode ser cravado à mão",
      };
    return { campos, erro: "" };
  }
  campos.alm_saida = temAlmoco ? hora("almSaida") : null;
  campos.alm_volta = temAlmoco ? hora("almVolta") : null;
  return { campos, erro: "" };
}

/**
 * O CARTÃO QUE A CORREÇÃO DE UM DIA RECUSADO LANÇA — a volta do caminho acima.
 *
 * É o Real manual do dia com a régua publicada por baixo (`alvoPublicado`, a mesma cascata
 * do pop-up e da Revisão): entrada e saída vêm do Real; o almoço, do Real ou, sem ele, da
 * refeição publicada. Sem Real manual NÃO há cartão — um dia recusado sem ninguém ter dito
 * como ele fica não se corrige no chute.
 *
 * A virada do dia é desenrolada como no pop-up (o "03:06" de saída de quem entra 20:13 é
 * 27:06), e quem diz se o cartão existe é o `validaCartao` do montador — mais a hora de
 * almoço do interno, que é proposta nossa e não se lança menor que 1 hora.
 */
export function cartaoDaRecusaCorrigida(reg) {
  const rm = reg?.realManual || {};
  const vazio = { slots: ["", "", "", ""], mins: [], problema: "", semRealManual: true };
  if (!horaSlot(rm.entrada) && !horaSlot(rm.saida)) return vazio;
  const slots = alvoPublicado(reg?.cartao || {}, rm, ["", "", "", ""]) || ["", "", "", ""];
  let anterior = null;
  const desenrolado = slots.map((h) => {
    const m = hm2min(h);
    if (m == null) return "";
    let x = m;
    while (anterior != null && x < anterior) x += 1440;
    anterior = x;
    return min2hm(x);
  });
  const mins = desenrolado.map(hm2min).filter((m) => m != null);
  const cat = txt(reg?.categoria).toUpperCase();
  let problema = validaCartao(mins, cat);
  if (!problema && !mioloTravado(cat) && mins.length === 4 && mins[2] - mins[1] < ALMOCO_INTERNO_MIN)
    problema = `almoço de ${mins[2] - mins[1]} min — não dá para lançar menos de 1 hora para o interno`;
  return { slots: desenrolado, mins, problema, semRealManual: false };
}

/* ─────────────────────── mover um card de lugar ─────────────────────────── */

/**
 * ARRASTAR UM CARD (dono, 15/09/2026: "dá a opção de movimentar eles para fechar o ponto").
 *
 * Recebe os blocos que estão na tela e devolve os CAMPOS À MÃO que produzem o novo arranjo
 * — mover não é um estado à parte, é um atalho de digitação: o DP vê nos campos o que
 * mexeu, e apaga ali o que não quiser.
 *   · soltou numa ponta VAZIA → a hora vai para lá e a de origem fica vazia (o traço);
 *   · soltou numa ponta OCUPADA → as do meio andam uma casa na direção de onde ela saiu,
 *     como se reordena uma lista. Entre vizinhos isso é uma troca.
 * Reordenar, e não trocar, é o que fecha o cartão de gente como o WILKER 30061203 · 20/08
 * (03:06 · 20:13 · 22:11 · 23:05): o 03:06 é o fim da jornada da noite, e arrastá-lo para a
 * saída tem de deixar 20:13 · 22:11 · 23:05 · 03:06 — trocar deixaria 23:05 na entrada.
 *
 * O miolo travado do motorista não entra na conta: nem sai, nem recebe, nem anda.
 * Devolve `null` quando não há o que mover.
 */
export function moverCompartimento(blocos, de, para) {
  const lista = blocos || [];
  const moveis = lista.map((b, i) => (b.travado ? -1 : i)).filter((i) => i >= 0);
  const a = moveis.indexOf(de);
  const b = moveis.indexOf(para);
  if (a < 0 || b < 0 || a === b) return null;
  const relogio = (m) => (m == null ? null : ((m % 1440) + 1440) % 1440);
  const horas = moveis.map((i) => relogio(lista[i].min));
  if (horas[a] == null) return null;
  const novo = [...horas];
  if (horas[b] == null) {
    novo[b] = horas[a];
    novo[a] = null;
  } else {
    const [h] = novo.splice(a, 1);
    novo.splice(b, 0, h);
  }
  const campos = {};
  moveis.forEach((i, k) => {
    if (novo[k] === horas[k]) return;
    campos[lista[i].chave] = novo[k] == null ? VAZIO_A_MAO : min2hm(novo[k]);
  });
  return Object.keys(campos).length ? campos : null;
}

/** O vizinho móvel de um compartimento (−1 = o de antes, +1 = o de depois), ou −1. */
export function vizinhoMovel(blocos, i, sentido) {
  const moveis = (blocos || []).map((b, j) => (b.travado ? -1 : j)).filter((j) => j >= 0);
  const k = moveis.indexOf(i);
  return k < 0 ? -1 : (moveis[k + sentido] ?? -1);
}

/* ──────────────────── os quatro compartimentos, montados ─────────────────── */

/**
 * O CARTÃO DO POP-UP: quatro compartimentos, cada um com o horário final e a ORIGEM.
 *
 * Entradas:
 *   `reg`          — o registro do dia (`slotsHoje`, `regua`, `acoes`, `categoria`)
 *   `marcas`       — { índice da ocorrência: "A" | "R" | "" }, o que está na tela AGORA
 *   `manual`       — { entrada, almSaida, almVolta, saida } como o DP digitou (texto cru;
 *                    o miolo só vale no interno, e o traço deixa a ponta vazia)
 *   `completar`    — { entrada: true, … } as pontas em que ele clicou "completar com o alvo"
 *   `ficaMontador` — o cartão que o montador encaixou (só interno/aprendiz usa o miolo dele)
 *
 * A PRECEDÊNCIA (o desenho, à risca):
 *   cravado à mão > pedido aceito > completado com o alvo > batida dele > falta.
 * O degrau do alvo só é alcançável na ponta VAZIA — é a definição dele: "completar".
 *
 * E DUAS REGRAS DE CATEGORIA:
 *   · MOTORISTA — o miolo é a refeição APURADA do dia e não muda com marcação nenhuma;
 *     miolo vazio não é falta (o cartão dele fecha em 2, e isso é legítimo);
 *   · INTERNO/APRENDIZ — nada trava: o miolo é livre e quem o encaixa é `encaixaEmQuatro`,
 *     o montador que a tela já usa.
 */
export function montaCompartimentos({
  reg,
  marcas = {},
  manual = {},
  completar = {},
  ficaMontador = null,
} = {}) {
  const cat = txt(reg?.categoria).toUpperCase();
  // "da escala" é horário PROGRAMADO, não apurado — a ponta tem de dizer isso.
  const origemDaRegua = txt(reg?.reguaFonte) === "escala" ? "escala" : "alvo";
  /* O CADEADO DO ALMOÇO SEGUE O DIA, NÃO A CATEGORIA (21/09/2026).
   *
   * Dono, no JARDEL 30027746 · 29/08: "tira o bloqueio do almoço, deixa livre — olha esse
   * almoço nada a ver". O cartão dele é 05:14 · 14:57 · 21:12 · 21:42: o montador chamou de
   * almoço as duas batidas do meio, 375 min, e o cadeado impedia o DP de arrumar.
   *
   * O cadeado vinha SÓ da categoria (MOTORISTA trava sempre). Mas quem diz se a refeição foi
   * apurada é a linha do dia — e nela `almoco_travado` estava FALSE, com `almoco_confiavel`
   * também false. Ou seja: a tela trancava o que o próprio lake dizia não ter apurado, e
   * `camposParaRealManual` (a gravação) já olhava esse mesmo campo — a tela é que discordava
   * dela. Agora as duas leem o dia: sem refeição apurada, o miolo é livre, o cadeado some e
   * o "Cravar à mão" abre as quatro pontas. Com refeição apurada (o `almoco_travado` do
   * CARTAO_PRESERVADO e das matrizes), nada muda: continua sendo a que nós lançamos.
   *
   * O pedido do colaborador que mira o miolo segue recusado por regra própria
   * (`pedidoMiraOMiolo` + MOTIVO_MIOLO): aquilo é sobre quem PODE mudar a refeição, e não
   * sobre o DP poder consertar o cartão. */
  const travaMiolo = mioloTravado(cat) && reg?.almocoTravado === true && !almocoSemFim(reg?.cartao);
  const hoje = (reg?.slotsHoje || ["", "", "", ""]).map((h) => hm2min(h));
  const regua = (reg?.regua || ["", "", "", ""]).map((h) => hm2min(h));
  const acoes = reg?.acoes || [];
  /* SEM PEDIDO NENHUM = ele não respondeu ao aviso. Aí não há decisão a tomar, e o alvo
   * entra sozinho nas pontas que faltam: exigir um clique seria pedir ao DP que "aprove" a
   * única coisa que a correção pode lançar. (É o caso ALECSANDRO 30061220 · 01/09.)
   *
   * E "sem pedido" NÃO é `acoes.length === 0`: a captura traz linha de ocorrência com
   * tipo e horário VAZIOS (o ALECSANDRO tem uma, a 761810; o HENDESON tem a 766214), e ela
   * chega aqui como um item sem hora. Quem conta é o item que tem HORÁRIO — é ele que
   * mexeria no cartão. */
  const semPedido = acoes.every((it) => horaDoPedido(it) == null);

  /* ══ O DIA QUE VAI PARA A CORREÇÃO FICA NO ALVO — INTEIRO (10/09/2026) ══════
   *
   * Dito pelo dono com todas as letras: "o vencido que não respondeu fica no alvo que
   * colocamos". E vale igual para o dia RECUSADO: a tabela do desfecho é a mesma — recusa
   * com aviso e vencido sem resposta saem pelos robôs `comunicado` e `ponto`, e o que o
   * `ponto` escreve é o alvo.
   *
   * A batida dele NÃO pode mandar nesses dias, e o CLAUDINEI 30060664 · 02/09 é a prova:
   * bateu 01:00 · 10:59 · 16:32 · 17:02, e o alvo é 10:59 · 16:32 · 17:02 · 25:03 (a
   * jornada que virou a meia-noite). Deixando as pontas na batida dele, o cartão saía
   * 01:00 …17:02 — a saída repetindo a volta do almoço, e nem fechava. O alvo é justamente
   * o cartão certo do dia; foi ele que a gente cobrou no aviso.
   *
   * O botão "completar com o alvo" continua existindo, e só para o OUTRO caso: o dia que
   * termina ACEITO e tem ponta sem batida. Ali quem escolhe é o DP. */
  /* ── E SÓ QUANDO A CORREÇÃO EXISTE (15/09/2026) ──────────────────────────
   * MARIA EDUARDA 30061195 · 24/08 (APRENDIZ): duas alterações, o DP aceitou "10:32 → 10:00"
   * e recusou a outra. O cartão mostrava 10:32 · 12:51 · 13:51 · 17:05 — a batida dela,
   * inteira — com a etiqueta "é o alvo · o que a correção vai lançar". Não era: o dia não
   * tem aviso nosso (então não há advertência nem correção) e não tem alvo publicado
   * nenhum. O que vai acontecer ali é o robô ACEITAR o 10:00.
   * A regra vale onde ela nasceu: dia com AVISO, que segue para a correção, e que tem RÉGUA
   * para ela lançar. Sem isso, quem manda no cartão é o que foi decidido. */
  const recusou = acoes.some((_, i) => marcaDaOcorrencia(reg, marcas, i) === "R");
  const temCorrecao = Boolean(reg?.temAviso) && regua.some((v) => v != null);
  const alvoManda = semPedido ? regua.some((v) => v != null) : recusou && temCorrecao;

  // o horário que a MARCAÇÃO aceitou em cada compartimento (a primeira, havendo mais de uma)
  const aceito = {};
  const horasAceitas = new Set();
  acoes.forEach((it, i) => {
    if (marcaDaOcorrencia(reg, marcas, i) !== "A") return;
    const m = horaDoPedido(it);
    if (m != null) horasAceitas.add(m);
    const comp = COMPARTIMENTOS.find((c) => c.ponta === txt(it.ponta));
    if (!comp || m == null || aceito[comp.chave] != null) return;
    aceito[comp.chave] = m;
  });

  /* ══ NO INTERNO, O MONTADOR MANDA NO CARTÃO INTEIRO (10/09/2026) ═══════════
   *
   * MARIVANIA 30060671 · 28/08 é o caso que mostrou o defeito. Ela bateu 08:03 e 08:05
   * (dois toques no relógio, 2 minutos) e mandou três pedidos: ALTERAR a batida de 08:05
   * para 12:00, INSERIR 13:00 e INSERIR 17:56. Qualquer analista de DP lê isso na hora:
   * a jornada foi 08:03 → 17:56 com almoço das 12:00 às 13:00, uma hora, a regra do interno.
   *
   * A tela lia outra coisa. O motor encaixa cada ocorrência num compartimento pelo que ela
   * DECLARA, e tanto o 12:00 quanto o 13:00 caíram em "saída almoço" — o primeiro ganhava o
   * slot, o segundo era descartado em silêncio, e o cartão saía 08:03 · 13:00 · (falta) ·
   * 17:56. Aceitar os três produzia um cartão que não fecha, com o 12:00 dela sumido.
   *
   * O montador já sabia a resposta: `simulaCartao` + `encaixaEmQuatro` põem as batidas
   * resultantes nas quatro posições POR ORDEM — que é como se lê um cartão. Ele só estava
   * sendo usado no miolo. Agora, quando o interno fecha em quatro, ele manda nas quatro.
   *
   * NO MOTORISTA NADA DISSO VALE: o miolo dele é a refeição que NÓS lançamos, travada, e
   * não se reordena por pedido nenhum. */
  const encaixe = !travaMiolo && (ficaMontador || []).length === 4 ? ficaMontador : null;

  /* ── QUANDO O MOTOR DESISTE, A LEITURA CRONOLÓGICA ────────────────────────
   * O `simulaCartao` não respondeu para a MARIVANIA: as duas batidas dela (08:03 e 08:05)
   * estão a 2 minutos, o `removeFantasmas` joga a primeira fora como toque repetido do
   * coletor, sobra UMA batida e ele devolve "cartão com 1 batida só — o ponto do dia ainda
   * não fechou", sem cartão nenhum. O motor está certo no que ele julga: um cartão de uma
   * batida não fecha. O que ele não vê é que O PEDIDO DELA DESFAZ O PAR COLADO — a
   * alteração move justamente a batida de 08:05 para 12:00.
   *
   * Então, para interno/aprendiz, quando o montador não devolve as quatro posições, o
   * cartão é montado pela ÚNICA leitura que não inventa nada: as batidas dele, menos as que
   * uma alteração aceita tira, mais as que os pedidos aceitos põem, EM ORDEM.
   *
   * E ordem é a leitura certa porque no Transnet não existe "compartimento": o cartão é
   * uma lista de batidas, e entrada/saída-almoço/volta/saída é como ela se LÊ. Foi por ler
   * pelo rótulo que a ocorrência declara — e não pelo relógio — que o 12:00 dela sumia
   * atrás do 13:00, os dois se dizendo "saída almoço". */
  /* UMA CONTA SÓ, e ela mora em `cartaoCronologico` (acima): é a MESMA que a coluna da
   * grade usa. Duas implementações da mesma leitura é como esta tela já teve três cartões
   * para o mesmo dia. */
  const aceitosDoDia = acoes.filter((_, i) => marcaDaOcorrencia(reg, marcas, i) === "A");
  /* E NO MOTORISTA ELA RESPONDE AS PONTAS (15/09/2026 — NAELSON 30061225 · 23/08). Ele não
   * bateu nada e pediu duas inserções, 13:30 e 18:00. O motor não soube dizer a que ponta
   * cada uma pertence ("não dá para julgar"), e como a leitura em ordem estava trancada
   * para o motorista o pop-up desenhava um cartão VAZIO — "falta entrada e saída" — do dia
   * cujo contrato congelado, na lista ao lado, já era `13:30 · 18:00`. A tela dizia duas
   * coisas sobre o mesmo dia.
   * O miolo dele continua intocado: a leitura só entra quando devolve DUAS batidas, que é o
   * cartão de pontas do motorista; a refeição segue vindo da apuração do dia. */
  const cronologico = (() => {
    if (encaixe || !aceitosDoDia.length) return null;
    const lido = cartaoCronologico(hoje, aceitosDoDia, cat) || [];
    if (!travaMiolo) return lido.length === 4 ? lido : null;
    return lido.length === 2 ? [lido[0], null, null, lido[1]] : null;
  })();
  const quatro = encaixe || cronologico;

  /* O QUE NÃO COUBE NO CARTÃO TEM DE APARECER. Quando sobra batida, o montador escolhe
   * quatro e DESCARTA o resto — e o resto pode ser um pedido que o DP acabou de aceitar.
   * O cartão ao lado ficaria bonito e o robô `ajustes` faria outra coisa: ele só clica
   * "aceitar", e o Transnet insere a batida de qualquer jeito, produzindo um cartão de
   * cinco. Então a tela diz, em vez de prometer o que não vai acontecer. */
  const foraDoCartao = quatro
    ? [...horasAceitas].filter((m) => !quatro.includes(m)).sort((a, b) => a - b).map(min2hm)
    : [];
  const origemDoEncaixe = (m, i) =>
    m === hoje[i] ? "batida" : horasAceitas.has(m) ? "pedido" : "encaixe";

  /* ── o campo à mão: entra ao digitar, e só se a ordem do cartão aceitar ──
   * A referência de cada ponta é o MIOLO (entrada × saída do almoço, saída × volta do
   * almoço); num dia sem miolo, é a outra ponta. */
  /* NO INTERNO O MIOLO TAMBÉM TEM CAMPO (15/09/2026), e aí a referência de cada campo passa
   * a ser o VIZINHO que o DP está vendo: o que ele digitou manda, depois a régua, depois a
   * batida. A saída do almoço mede contra a entrada; a volta, contra a saída do almoço. A
   * ponta deixada vazia à mão (o traço) não serve de referência para ninguém. */
  const criticas = {};
  const mao = {};
  const maoVazia = {};
  // os campos seguem o MIOLO do dia, não só a categoria: dia sem refeição apurada dá os quatro
  const campos = camposAMao(cat, { travado: travaMiolo });
  const lidos = {};
  campos.forEach((chave) => {
    lidos[chave] = leHoraDigitada(manual[chave]);
  });
  const idx = (chave) => COMPARTIMENTOS.findIndex((c) => c.chave === chave);
  const pega = (i) => {
    const l = lidos[COMPARTIMENTOS[i].chave];
    if (l?.vazio) return null;
    if (l && !l.erro && l.min != null) return l.min;
    return regua[i] != null ? regua[i] : hoje[i];
  };
  campos.forEach((chave) => {
    const { min, erro, vazio } = lidos[chave];
    if (erro) {
      criticas[chave] = erro;
      return;
    }
    if (vazio) {
      maoVazia[chave] = true;
      return;
    }
    if (min == null) return;
    const i = idx(chave);
    // a ponta mede contra o miolo e, sem miolo, contra a outra ponta; o miolo mede contra
    // o compartimento de antes
    const refs =
      chave === "entrada" ? [1, 2, 3] : chave === "saida" ? [2, 1, 0] : i === 1 ? [0] : [1, 0];
    const iRef = refs.find((j) => pega(j) != null);
    const ref = iRef == null ? null : pega(iRef);
    const critica = criticaOrdem(chave, min, ref);
    if (critica) {
      criticas[chave] = critica;
      return;
    }
    mao[chave] = min;
  });

  /* DE ONDE VEIO A HORA À MÃO. Quem arrasta um card não inventa horário: a hora continua
   * sendo a batida dele (ou o pedido que ele fez), só em outro compartimento — e o almoço
   * de 57 min que ELE bateu é fato, não proposta nossa (a regra da hora, lá embaixo). */
  const clock = (m) => ((m % 1440) + 1440) % 1440;
  const batidasDeHoje = new Set(hoje.filter((m) => m != null).map(clock));
  const aceitasNoRelogio = new Set([...horasAceitas].map(clock));
  const origemAMao = (m, i) =>
    hoje[i] != null && clock(m) === clock(hoje[i])
      ? "batida"
      : batidasDeHoje.has(clock(m))
        ? "movido"
        : aceitasNoRelogio.has(clock(m))
          ? "pedido"
          : "manual";

  const montaBruto = (alvoManda) => COMPARTIMENTOS.map((c, i) => {
    const base = { chave: c.chave, rotulo: c.rotulo, ponta: c.ponta, travado: false, porClique: false };
    const tocada = mao[c.chave] != null || maoVazia[c.chave];
    // O INTERNO QUE FECHA EM QUATRO: o cartão já está ordenado — pelo montador, ou pela
    // leitura cronológica quando ele desiste. No motorista ela só responde as PONTAS: o
    // miolo é a refeição travada e cai no bloco de baixo.
    if (quatro && !alvoManda && !tocada && !(travaMiolo && MIOLO.includes(c.chave)))
      return { ...base, min: quatro[i], origem: origemDoEncaixe(quatro[i], i) };
    if (MIOLO.includes(c.chave)) {
      if (travaMiolo) {
        // A REFEIÇÃO DE REFERÊNCIA VEM DA IMPORTAÇÃO (as colunas do dia — a mesma fonte da
        // Revisão), nunca recalculada aqui. Sem apuração, o miolo fica VAZIO: a view não
        // inventa almoço (`fonte_almoco` nulo, `almoco_faixa` SEM_BASE) e nós também não.
        const m = regua[i] != null ? regua[i] : hoje[i];
        return { ...base, travado: true, min: m == null ? null : m, origem: m == null ? "vazio" : "refeicao" };
      }
      // (o encaixe do interno já respondeu acima, pelas quatro posições)
    }
    if (maoVazia[c.chave]) return { ...base, min: null, origem: "limpo" };
    if (mao[c.chave] != null) return { ...base, min: mao[c.chave], origem: origemAMao(mao[c.chave], i) };
    if (aceito[c.chave] != null) return { ...base, min: aceito[c.chave], origem: "pedido" };
    // o dia da correção: o alvo manda na ponta inteira, tenha ela batida ou não
    if (alvoManda && regua[i] != null)
      return { ...base, min: regua[i], origem: regua[i] === hoje[i] ? "batida" : origemDaRegua };
    const vazia = hoje[i] == null;
    if (vazia && completar[c.chave] && regua[i] != null)
      return { ...base, min: regua[i], origem: origemDaRegua, porClique: true };
    if (hoje[i] != null) return { ...base, min: hoje[i], origem: "batida" };
    return { ...base, min: null, origem: "falta" };
  });

  /* ══ SE O PEDIDO NÃO FECHA, O CARTÃO É O ALVO (dono, 11/09/2026) ═══════════
   * "Essa ferramenta tem que dar o alvo." Até aqui, quando o pedido dele não montava um
   * cartão possível, a tela dizia "não fecha — falta a volta do almoço" e parava: o DP
   * ficava com um dia sem cartão nenhum para lançar, que é justamente o trabalho que ele
   * veio fazer. Agora, quando o que sai do pedido não fecha E existe alvo que fecha, o
   * cartão passa a ser o ALVO — o mesmo caminho do dia recusado e do vencido, porque o
   * desfecho é o mesmo: esse dia vai para a correção, e quem escreve é o robô `ponto`.
   *
   * Medido no lake: isso leva a cobertura de 63% para 81% dos crachá+dia pendentes (e a
   * escala, o último degrau da régua, cobre quase todo o resto). */
  let bruto = montaBruto(alvoManda);
  let mandouOAlvo = alvoManda;
  if (!alvoManda) {
    const comPedido = bruto.map((b) => b.min).filter((v) => v != null);
    /* O BOTÃO DO DONO TEM PREFERÊNCIA. Quando o que falta é uma ponta VAZIA e o alvo tem
     * ela, quem completa é ele, no clique — foi o desenho de 10/09 ("ao invés de não marcar,
     * põe um botão para completar com o alvo se não tiver batida"). Trocar o cartão inteiro
     * aqui apagaria esse botão justamente no caso para o qual ele foi feito. O alvo assume
     * quando o cartão não tem conserto por clique: batida a mais, fora de ordem, almoço
     * curto — aí não é ponta faltando, é cartão que não existe. */
    const faltas = bruto.map((b, i) => [b, i]).filter(([b]) => b.origem === "falta");
    const todasCompletaveis = faltas.length > 0 && faltas.every(([, i]) => regua[i] != null);
    if (!todasCompletaveis && (validaCartao(comPedido, cat) || comPedido.length < 2)) {
      const comAlvo = montaBruto(true);
      const mins = comAlvo.map((b) => b.min).filter((v) => v != null);
      if (mins.length && !validaCartao(mins, cat)) {
        bruto = comAlvo;
        mandouOAlvo = true;
      }
    }
  }

  /* ── a virada do dia, como o `_desenrola` do montador ──
   * Compartimento seguinte nunca é menor que o anterior: o 02:10 pedido na saída de um dia
   * que entra 16:10 é 26:10, e é assim que ele tem de ser medido e desenhado. */
  let anterior = null;
  const blocos = bruto.map((b, i) => {
    if (b.min == null) return { ...b, hora: "", alvo: regua[i] == null ? "" : min2hm(regua[i]), dist: null };
    let v = b.min;
    while (anterior != null && v < anterior) v += 1440;
    anterior = v;
    // a distância do alvo, com o alvo trazido para o MESMO dia do compartimento
    let alvoM = regua[i];
    if (alvoM != null) {
      while (alvoM < v - 720) alvoM += 1440;
      while (alvoM > v + 720) alvoM -= 1440;
    }
    return {
      ...b,
      min: v,
      hora: min2hm(v),
      alvo: alvoM == null ? "" : min2hm(alvoM),
      dist: alvoM == null ? null : v - alvoM,
    };
  });

  const mins = blocos.map((b) => b.min).filter((v) => v != null);
  // O CARTÃO POSSÍVEL É O DO MONTADOR (`validaCartao`, montador.py:159): ordem, 2 ou 4 no
  // motorista, 4 no interno, e almoço dentro da faixa. Não há segunda opinião aqui.
  /* ══ O ALMOÇO DO INTERNO É DE UMA HORA (dono, 10/09/2026) ═════════════════
   * "Para interno a regra é totalmente diferente de refeição: é 1 hora e não 30 min."
   *
   * O `validaCartao` é o montador — ele diz o que o cartão pode ser FISICAMENTE, e o piso
   * dele (20 min) só serve para separar almoço de batida colada. A regra do INTERNO é
   * trabalhista e já está escrita em outro lugar desta casa: o aviso `interno_almoco`
   * ("o intervalo de almoço ficou abaixo de 1 hora... o descanso mínimo de 1 hora é um
   * direito do colaborador"). Avisar disso e depois LANÇAR 40 minutos seria a tela
   * desmentindo a própria carta.
   *
   * No motorista nada muda: lá o intervalo sai da matriz da Revisão (15 min na faixa de
   * 4-6 h, 30 acima de 6) e quem o lança somos nós, no passo da Refeição. */
  /* A HORA DO INTERNO VALE PARA O QUE NÓS PROPOMOS — NÃO PARA A BATIDA DELE.
   * Medido no lake em 11/09/2026, nos cartões OK de interno/aprendiz: o almoço mediano é
   * mesmo 60 min (a regra do dono bate com a prática), mas almoço ABAIXO de 60 acontece o
   * tempo todo — 15% dos dias do aprendiz, 37% dos dias do interno acima de 6 h, 52% nos
   * dias até 4 h. São 1.657 dias já fechados. Tratar isso como "cartão que não fecha"
   * barraria o ponto real de gente que trabalhou.
   *
   * Então: quando o miolo vem da BATIDA dele, 57 minutos é fato, e a tela só AVISA (é para
   * isso que existe a carta `interno_almoco`). Quando o miolo é proposta NOSSA — alvo,
   * escala ou cravado à mão —, aí a hora é obrigatória: não se lança para alguém um
   * intervalo menor do que o direito dele. */
  const origemMiolo = [bruto[1]?.origem, bruto[2]?.origem];
  const mioloProposto = origemMiolo.every((o) => ["alvo", "escala", "manual"].includes(o));
  /* O PISO DE UMA HORA É DA CATEGORIA, NÃO DA TRAVA (22/09/2026) ─────────────
   *
   * Dono, com o cartão do NELSON 30061207 (15/09) na tela: "aqui ele não deixa o almoço,
   * sendo que o almoço ali era para interno". Ele está certo — o NELSON é MOTORISTA, e a
   * tela cobrava dele a hora de almoço do interno, barrando um cartão de 30 min, que é
   * justamente a refeição padrão do motorista.
   *
   * A causa era `!travaMiolo`, que mistura duas coisas: `travaMiolo` só é verdadeiro no
   * motorista COM almoço travado nesta linha. Num dia sem batida — o do NELSON não tem
   * nenhuma — a trava não vale, e o piso do interno caía sobre o motorista.
   *
   * Quem manda aqui é a CATEGORIA, e o outro lugar que aplica a mesma regra
   * (`cartaoDoRealManual`) já fazia certo com `!mioloTravado(cat)`. Os dois passam a
   * concordar — e a constante já dizia isto na primeira linha: "Não vale para motorista". */
  const almocoCurto =
    !mioloTravado(cat) && mins.length === 4 && mins[2] - mins[1] < ALMOCO_INTERNO_MIN;
  const problema =
    validaCartao(mins, cat) ||
    (almocoCurto && mioloProposto
      ? `almoço de ${mins[2] - mins[1]} min — não dá para LANÇAR menos de 1 hora para o interno`
      : "");
  const avisoAlmoco =
    almocoCurto && !mioloProposto
      ? `ele fez ${mins[2] - mins[1]} min de almoço — abaixo da hora a que tem direito`
      : "";
  /* O DP MEXEU NO CARTÃO À MÃO? É o que decide o que a tela diz sobre o destino dele: com
   * aceite, o robô `ajustes` lança o contrato por cima quando o Transnet não fica igual
   * (bot_ajustes_app.py:1646); tudo recusado, ele vira Real manual ("recusar e corrigir
   * assim"). */
  const tocou = Object.keys(mao).length > 0 || Object.keys(maoVazia).length > 0;
  const aMao = { tocou };
  const { liquida, almoco } = jornadaDoCartao(mins);
  const contagem = { A: 0, R: 0, sem: 0 };
  acoes.forEach((_, i) => {
    const m = marcaDaOcorrencia(reg, marcas, i);
    contagem[m === "A" ? "A" : m === "R" ? "R" : "sem"] += 1;
  });

  return {
    blocos,
    mins,
    fecha: !problema,
    problema,
    // QUAL PONTA FALTA — é isto que a caixa vermelha diz; "não fecha" sozinho não ajuda.
    faltando: blocos.filter((b) => b.origem === "falta").map((b) => b.rotulo),
    liquida,
    almoco,
    contagem,
    semPedido,
    alvoManda: mandouOAlvo,
    avisoAlmoco,
    foraDoCartao,
    criticas,
    aMao,
    // os campos que o "cravar à mão" desenha: duas pontas no motorista, as quatro no interno
    campos,
    travaMiolo,
    // O DIA É CONSEQUÊNCIA DAS MARCAS: havendo recusa, a recusa manda (é ela que abre a
    // cadeia de advertência/correção) — a mesma regra do `aplicar_marcados`.
    dia: contagem.R > 0 ? "recusado" : contagem.A > 0 ? "aceito" : "",
    // o contrato congelado é O CARTÃO QUE O DP ESTÁ VENDO, e só quando ele fecha
    contrato: !problema && contagem.A > 0 ? textoBatidas(mins) : "",
    // "Completar <ponta> com o alvo (HH:MM)" — só na ponta que FALTA e que tem alvo
    completavel: Object.fromEntries(
      blocos.map((b, i) => [b.chave, b.origem === "falta" && regua[i] != null ? min2hm(regua[i]) : ""]),
    ),
  };
}

export default { COMPARTIMENTOS, ORIGENS, montaCompartimentos, marcaDaOcorrencia, leHoraDigitada, criticaOrdem, moverCompartimento };
