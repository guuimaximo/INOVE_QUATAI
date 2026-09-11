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
import { validaCartao } from "./regrasMontador.js";

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
 * Slot que ninguém publicou fica com o que está no cartão de hoje — nada se inventa. */
export function alvoPublicado(cp, rm, slotsHoje) {
  const hoje = slotsHoje || ["", "", "", ""];
  const cascata = [
    [rm?.entrada, cp?.alvo_entrada, cp?.alvo_entrada_ref, cp?.entrada_sug],
    [rm?.alm_saida, cp?.alvo_saida_almoco, cp?.almoco_saida_sug],
    [rm?.alm_volta, cp?.alvo_volta_almoco, cp?.almoco_volta_sug],
    [rm?.saida, cp?.alvo_saida, cp?.alvo_saida_ref, cp?.saida_sug],
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
// só as pontas têm campo à mão: o miolo do motorista é travado e o do interno é do montador
export const PONTAS_MANUAIS = ["entrada", "saida"];

/**
 * DE ONDE VEIO A PONTA — a pílula do bloco. `cor` é a classe `.dp-pill` do dp360.css.
 * A ordem desta lista É a precedência do desenho.
 */
export const ORIGENS = {
  manual: { rotulo: "cravado à mão", cor: "accent", ajuda: "você digitou no campo à mão — é o topo da precedência." },
  pedido: { rotulo: "pedido aceito", cor: "ok", ajuda: "é o horário que ele pediu e você aceitou; quem lança é o robô `ajustes`." },
  alvo: { rotulo: "do alvo", cor: "accent", ajuda: "é o alvo publicado pela Revisão — o que a correção vai lançar nesta ponta." },
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
 * @param batidas minutos do cartão de hoje (`null` é ignorado)
 * @param pedidos itens com `hora` — "13:00" ou "D/ 08:05 P/ 12:00"
 */
export function cartaoCronologico(batidas, pedidos) {
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
  return [...new Set(mins)];
}

/* ──────────────────── os quatro compartimentos, montados ─────────────────── */

/**
 * O CARTÃO DO POP-UP: quatro compartimentos, cada um com o horário final e a ORIGEM.
 *
 * Entradas:
 *   `reg`          — o registro do dia (`slotsHoje`, `regua`, `acoes`, `categoria`)
 *   `marcas`       — { índice da ocorrência: "A" | "R" | "" }, o que está na tela AGORA
 *   `manual`       — { entrada, saida } como o DP digitou (texto cru)
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
  const travaMiolo = mioloTravado(cat);
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
  const recusou = acoes.some((_, i) => marcaDaOcorrencia(reg, marcas, i) === "R");
  const alvoManda = semPedido || recusou;

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
  const cronologico = (() => {
    if (travaMiolo || encaixe) return null;
    const fora = new Set();
    const postos = [];
    let houveAceite = false;
    acoes.forEach((it, i) => {
      if (marcaDaOcorrencia(reg, marcas, i) !== "A") return;
      houveAceite = true;
      const alt = /D\/\s*(\d{1,2}:\d{2})\s*P\/\s*(\d{1,2}:\d{2})/i.exec(txt(it?.hora));
      if (alt) {
        const de = hm2min(alt[1]);
        if (de != null) fora.add(de);
      }
      const m = horaDoPedido(it);
      if (m != null) postos.push(m);
    });
    if (!houveAceite) return null;
    const mins = [...hoje.filter((v) => v != null && !fora.has(v)), ...postos]
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    const unicos = [...new Set(mins)];
    return unicos.length === 4 ? unicos : null;
  })();
  const quatro = encaixe || cronologico;
  const origemDoEncaixe = (m, i) =>
    m === hoje[i] ? "batida" : horasAceitas.has(m) ? "pedido" : "encaixe";

  /* ── o campo à mão: entra ao digitar, e só se a ordem do cartão aceitar ──
   * A referência de cada ponta é o MIOLO (entrada × saída do almoço, saída × volta do
   * almoço); num dia sem miolo, é a outra ponta. */
  const criticas = {};
  const mao = {};
  PONTAS_MANUAIS.forEach((chave) => {
    const { min, erro } = leHoraDigitada(manual[chave]);
    if (erro) {
      criticas[chave] = erro;
      return;
    }
    if (min == null) return;
    const iMiolo = chave === "entrada" ? 1 : 2;
    const iOutra = chave === "entrada" ? 3 : 0;
    const pega = (i) => (regua[i] != null ? regua[i] : hoje[i]);
    const ref = pega(iMiolo) != null ? pega(iMiolo) : pega(iOutra);
    const critica = criticaOrdem(chave, min, ref);
    if (critica) {
      criticas[chave] = critica;
      return;
    }
    mao[chave] = min;
  });

  const bruto = COMPARTIMENTOS.map((c, i) => {
    const base = { chave: c.chave, rotulo: c.rotulo, ponta: c.ponta, travado: false, porClique: false };
    // O INTERNO QUE FECHA EM QUATRO: o cartão já está ordenado — pelo montador, ou pela
    // leitura cronológica quando ele desiste.
    if (quatro && !alvoManda && mao[c.chave] == null)
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
    if (mao[c.chave] != null) return { ...base, min: mao[c.chave], origem: "manual" };
    if (aceito[c.chave] != null) return { ...base, min: aceito[c.chave], origem: "pedido" };
    // o dia da correção: o alvo manda na ponta inteira, tenha ela batida ou não
    if (alvoManda && regua[i] != null)
      return { ...base, min: regua[i], origem: regua[i] === hoje[i] ? "batida" : "alvo" };
    const vazia = hoje[i] == null;
    if (vazia && completar[c.chave] && regua[i] != null)
      return { ...base, min: regua[i], origem: "alvo", porClique: true };
    if (hoje[i] != null) return { ...base, min: hoje[i], origem: "batida" };
    return { ...base, min: null, origem: "falta" };
  });

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
  const problema =
    validaCartao(mins, cat) ||
    (!travaMiolo && mins.length === 4 && mins[2] - mins[1] < ALMOCO_INTERNO_MIN
      ? `almoço de ${mins[2] - mins[1]} min — o interno tem direito a 1 hora`
      : "");
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
    alvoManda,
    criticas,
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

export default { COMPARTIMENTOS, ORIGENS, montaCompartimentos, marcaDaOcorrencia, leHoraDigitada, criticaOrdem };
