// ============================================================================
// AS TRAVAS DO "LANÇAR O PONTO SUGERIDO" — um lugar só.
//
// Porte de `Sistemas/PONTO/app/ui/app.js`:6003 (lote da Revisão) e :6168
// (`editorSug`, um dia) → `main.py` `lancar_bot_p2` (~2820) → `_fila_correcoes`
// (~2786), tendo `_sug_bloqueio` (~2748, já portado como `sugBloqueio`, em
// `./CartaoDoDia`) como ÚLTIMO PORTÃO antes do Transnet.
//
// POR QUE ESTE ARQUIVO EXISTE. A MESMA régua era escrita duas vezes: uma em
// `abas/Revisao.jsx` (`montarLoteAjuste`, o lote da grade) e outra em
// `abas/Folgas.jsx` (`montarAjusteDoDia`, um dia do detalhe da pessoa). A
// segunda nasceu copiando a primeira, e o próprio comentário de lá registrava a
// dívida: "enquanto não for, mexer numa trava exige mexer nas duas". Este
// projeto já tinha evitado essa armadilha quatro vezes — `regrasPonto.js`,
// `regrasGps.js`, `regrasGordura.js`, `regrasDia.js` existem exatamente para a
// regra morar em UM lugar. Aqui é o quinto.
//
// O ROBÔ É O MESMO E ESCREVE O CARTÃO INTEIRO. `dispararRoboDP360("ponto", …)`
// = workflow `ponto.yml` = `bot_ponto.py --lote`, que lê as SEIS colunas do
// `csv.DictReader` (`cracha,data,entrada,alm_saida,alm_volta,saida`), crachá de
// 8 dígitos, data dd/mm/aaaa e hora em notação 24+ depois de desenrolada a
// virada. Não existe "corrigir só a saída": `bot_ponto.lancar_registro` recusa
// ponta em branco com SEM_REAL e zera os campos extras. É daí que vem o peso
// das travas — cada linha que passa daqui REESCREVE o cartão de ponto de um dia
// de alguém.
//
// AS DUAS ORIGENS, E A ÚNICA COISA QUE MUDA ENTRE ELAS.
//   · `"view"`  — a Revisão. Os quatro horários vêm normalizados da view
//     (`entrada_sug`, `almoco_saida_sug`, `almoco_volta_sug`, `saida_sug`), já
//     com o overlay do Real manual aplicado pela aba. O `sugBloqueio` é lido
//     sobre a LINHA (a aba costuma passar o veredito já calculado, para não
//     rodar a régua duas vezes por linha).
//   · `"digitado"` — as Folgas. O DP acabou de digitar as duas PONTAS na tela,
//     então (a) existe um passo a mais, "o que foi digitado é hora?", que na
//     Revisão não faz sentido; e (b) o `sugBloqueio` é avaliado sobre o que o DP
//     DIGITOU, não sobre a view — o teto de 13 h e a jornada negativa valem
//     sobre o horário que vai ser GRAVADO. O contrato da view (alvo confiável /
//     almoço confiável) NÃO é promovido: digitar aqui não é cravar o Real
//     manual, então dia cujo alvo exige decisão do DP continua barrado e a tela
//     manda a pessoa para a Revisão.
//
// O ALMOÇO TRAVADO manda nas duas (main.py:906-910): `almoco_travado` significa
// que a matriz de meio de jornada já cravou o miolo (na view,
// `alvo_saida_almoco_final_min IS NOT NULL`), e por isso as duas células do
// miolo não são editáveis — nem na célula SUG da Revisão, nem no editor das
// Folgas — e o que vai no payload é o `almoco_*_sug` da VIEW, nunca um horário
// digitado. Na origem `"view"` isso é o comportamento normal: lá o miolo SEMPRE
// sai da view.
// ============================================================================

import { cra8, chaveDia, ehPontoInvertido, ehVerdadeiro, fmtHora, sugBloqueio } from "./CartaoDoDia";
// Aritmética de relógio é do MOTOR, nunca escrita à mão: `hm2min` aceita "1420"
// (o que a tela do Cartão de Ponto devolve) e `min2hm` preserva a notação 24+.
import { hm2min, min2hm } from "./regrasPonto";

const txt = (v) => String(v ?? "").trim();

/* ---------------------------- o CSV do robô ---------------------------- */

export const CAMPOS_CSV_AJUSTE = ["cracha", "data", "entrada", "alm_saida", "alm_volta", "saida"];

// main.py `_ddmm` — a tela do Transnet (e o input `data` do workflow) é
// dd/mm/aaaa. Recorte de string, NUNCA `new Date()`: a data já vem em ISO e
// virar objeto Date só criaria chance de o fuso empurrar o dia.
export const ddmmaaaa = (iso) => {
  const v = txt(iso);
  return v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v;
};

// Sem aspas: crachá é dígito, data é dd/mm/aaaa e hora é HH:MM (ou 25:40). É o
// mesmo formato da Refeição — um arquivo só para o mesmo robô.
export const csvDoAjustePonto = (fila) =>
  [
    CAMPOS_CSV_AJUSTE.join(","),
    ...fila.map((l) => CAMPOS_CSV_AJUSTE.map((c) => l[c]).join(",")),
  ].join("\n");

/* ------------------------- candidatura e leitura ------------------------- */

/* A LINHA SE APLICA AO LANÇAMENTO?
   Dia OK não tem o que corrigir: o cartão já bate com a régua, e mandá-lo ao robô
   reescreveria por reescrever. Ele não é "barrado" — não é candidato, do mesmo
   jeito que a linha sem marcação faltando não é candidata ao comunicado. Quem é
   candidato e não passa aparece na tela com nome e motivo; ninguém some em
   silêncio. */
export const aplicaAjuste = (l) => String(l?.status_ponto ?? "").toUpperCase() !== "OK";

/** main.py:906-910 — a matriz de meio de jornada já cravou o miolo deste dia. */
export const almocoTravado = (linha) => ehVerdadeiro(linha?.almoco_travado);

// Aceita o que a tela do Cartão de Ponto devolve ("1420") e devolve HH:MM, ou
// `null` quando o texto não é hora. Vazio é vazio (o miolo pode não existir).
export function horaDigitada(valor) {
  const bruto = txt(valor);
  if (!bruto) return "";
  const min = hm2min(bruto);
  if (min === null || min < 0) return null;
  return min2hm(min);
}

/* ------------------------------ os motivos ------------------------------ */
// As frases das duas telas DIVERGIAM em quatro travas, e a divergência é
// informação, não descuido: na Revisão o horário foi SUGERIDO pela view; nas
// Folgas ele foi PREENCHIDO pelo DP. A extração preserva as duas — mudar a
// frase mudaria o que a tela diz ao DP, e isso é comportamento.

const MOTIVO_INVERTIDO =
  "ponto invertido — a view não propõe lançamento, exige decisão manual do DP";

const MOTIVO_MEXIDO =
  "o cartão deste dia já foi mexido no Transnet depois do último import — " +
  "lançar por cima devolveria as pontas antigas e desfaria a correção";

const FRASES = {
  view: {
    semPonta: (falta) =>
      `sem ${falta} sugerida — o robô grava o cartão inteiro e recusa ponta em branco (SEM_REAL)`,
    meiaJanela: (a, b) =>
      `só uma ponta do almoço foi sugerida (${a || "—"} → ${b || "—"}) — ` +
      "o robô gravaria 00:00 na outra e criaria um intervalo que não existiu",
    ilegivel: "horário ilegível na sugestão — não dá para montar as quatro batidas",
    naoCabe: (a1, a2, ent, sai) =>
      `o almoço ${a1}–${a2} não cabe entre a entrada ${ent} e a saída ${sai} do alvo`,
  },
  digitado: {
    semPonta: (falta) =>
      `sem ${falta} — o robô grava o cartão inteiro e recusa ponta em branco (SEM_REAL)`,
    meiaJanela: (a, b) =>
      `só uma ponta do almoço foi preenchida (${a || "—"} → ${b || "—"}) — ` +
      "o robô gravaria 00:00 na outra e criaria um intervalo que não existiu",
    ilegivel: "horário ilegível — não dá para montar as quatro batidas",
    naoCabe: (a1, a2, ent, sai) =>
      `o almoço ${a1}–${a2} não cabe entre a entrada ${ent} e a saída ${sai}`,
  },
};

/* ------------------------------- a régua ------------------------------- */

/**
 * DECIDE UM DIA: vai para o robô, ou fica de fora com o motivo?
 *
 * @param {object} linha    linha da `ponto_diario` (com o overlay do Real manual
 *                          já aplicado pela tela), crua — nada é recalculado.
 * @param {object} opcoes
 * @param {object} [opcoes.caso]      linha de `ponto_caso` do dia (ou null).
 * @param {object} [opcoes.digitado]  origem "digitado": `{entrada, alm_saida,
 *                                    alm_volta, saida}` como o DP escreveu.
 * @param {string} [opcoes.bloqueio]  origem "view": o `sugBloqueio` já calculado
 *                                    pela aba (evita rodar a régua duas vezes).
 * @param {"view"|"digitado"} [opcoes.origem]
 *
 * @returns {{dia, cartaoHoje, fonte, motivoLinha, motivo, alvo, csv}}
 *          `motivo` vazio e `csv` preenchido = pode lançar. `motivo` preenchido
 *          e `csv` null = fica de fora, dizendo por quê. NUNCA devolve null
 *          calado: quem não vai para o robô aparece na tela com o motivo.
 *
 * Não faz I/O.
 */
export function avaliarAjustePonto(linha, { caso = null, digitado = null, bloqueio, origem = "view" } = {}) {
  const frase = FRASES[origem] || FRASES.view;
  const dia = txt(linha?.date_ref).slice(0, 10);
  // O cartão de HOJE, para a tela mostrar lado a lado o que vai ser sobrescrito.
  // `fmtHora` preserva a notação 24+ (25:09 continua 25:09).
  const cartaoHoje = [linha?.entrada, linha?.saida_almoco, linha?.volta_almoco, linha?.saida]
    .map((h) => fmtHora(h));
  const base = {
    dia,
    cartaoHoje,
    // De onde a view tirou o alvo — vira a coluna `fonte` do histórico por pessoa.
    fonte: txt(linha?.fonte_alvo) || txt(linha?.sugestao_fonte),
    motivoLinha: txt(linha?.motivo),
  };
  const fora = (motivo) => ({ ...base, motivo, alvo: null, csv: null });

  // 1) PONTO_INVERTIDO É DIAGNÓSTICO, NÃO LANÇAMENTO (`_fila_correcoes`, 1º
  //    skip: `acao_sugerida == AJUSTAR_MANUAL` ou `motivo == PONTO_INVERTIDO`).
  //    Cartão rotacionado é defeito de posição das batidas — quem decide o que
  //    fazer é o DP, linha a linha, na Revisão.
  if (ehPontoInvertido(linha)) return fora(MOTIVO_INVERTIDO);

  // 2) O QUE FOI DIGITADO É HORA? Só existe na origem "digitado": na Revisão os
  //    horários já vêm normalizados da view.
  //    MIOLO TRAVADO: o valor é o da view, o que o DP digitou não é lido.
  const travado = almocoTravado(linha);
  let entrada;
  let saida;
  let almIni;
  let almFim;
  if (origem === "digitado") {
    entrada = horaDigitada(digitado?.entrada);
    saida = horaDigitada(digitado?.saida);
    almIni = travado ? fmtHora(linha?.almoco_saida_sug) : horaDigitada(digitado?.alm_saida);
    almFim = travado ? fmtHora(linha?.almoco_volta_sug) : horaDigitada(digitado?.alm_volta);
    const ilegivel = [
      entrada === null && "entrada",
      almIni === null && "saída do almoço",
      almFim === null && "volta do almoço",
      saida === null && "saída",
    ].filter(Boolean);
    if (ilegivel.length) return fora(`horário ilegível em ${ilegivel.join(", ")} — use HH:MM (ou 1420)`);
  } else {
    // O MIOLO vem de `almoco_saida_sug`/`almoco_volta_sug`, que é o alvo da
    // própria view — e é isso que o dia de ALMOÇO TRAVADO manda. O overlay do
    // Real manual respeita a mesma trava (`aplicarRealManual`), então um horário
    // digitado pelo DP nunca chega aqui num dia travado.
    entrada = fmtHora(linha?.entrada_sug);
    saida = fmtHora(linha?.saida_sug);
    almIni = fmtHora(linha?.almoco_saida_sug);
    almFim = fmtHora(linha?.almoco_volta_sug);
  }

  /* 3) O ÚLTIMO PORTÃO ANTES DO TRANSNET (`_sug_bloqueio`). É o mesmo veredito
        que já apaga o botão de avisar e marca a célula SUG com ⚠ — um lugar só
        decide, e a frase que a tela mostra é a que vira o motivo do barrado.
        Na origem "digitado" ele é lido sobre a linha COM o que o DP digitou: é
        sobre o horário que vai ser GRAVADO que o teto de jornada e a jornada
        negativa valem. */
  const portao =
    origem === "digitado"
      ? sugBloqueio({
          ...linha,
          entrada_sug: entrada,
          saida_sug: saida,
          almoco_saida_sug: almIni,
          almoco_volta_sug: almFim,
        })
      : bloqueio ?? sugBloqueio(linha);
  if (portao) return fora(portao);

  // 4) CARTÃO JÁ MEXIDO NO TRANSNET DEPOIS DO NOSSO RETRATO (lição da Refeição,
  //    main.py:2856: "o ponto_diario só atualiza no import diário, não pelo bot
  //    na hora"). As pontas que mandamos são as do nosso retrato; se o cartão
  //    foi corrigido lá no meio-tempo, lançar por cima DEVOLVE as pontas velhas
  //    e desfaz a correção, sem ninguém ver. Não dá para saber isso sem ler o
  //    Transnet — dá para saber quando ALGUÉM MEXEU: `conferido_em` (a decisão
  //    foi executada) ou `correcao_final_em` (a correção rodou).
  if (txt(caso?.conferido_em) || txt(caso?.correcao_final_em)) return fora(MOTIVO_MEXIDO);

  // 5) AS DUAS PONTAS (`_fila_correcoes`, teste final: entrada e saída
  //    preenchidas). Lá quem não tinha as duas sumia da contagem; aqui aparece
  //    com o motivo — era invisível a diferença entre "N com sugestão" e o que o
  //    robô recebia.
  if (!entrada || !saida) {
    const falta = [!entrada && "ENTRADA", !saida && "SAÍDA"].filter(Boolean).join(" e ");
    return fora(frase.semPonta(falta));
  }

  // 6) O MIOLO VAI INTEIRO OU NÃO VAI. Meia janela grava 00:00 na outra ponta e
  //    inventa um intervalo que ninguém fez. Vazio nas duas é dia SEM almoço — o
  //    bot escreve 00:00 nos intervalos, que é como o Transnet representa "não
  //    teve".
  if (Boolean(almIni) !== Boolean(almFim)) return fora(frase.meiaJanela(almIni, almFim));

  // 7) A VIRADA DE MEIA-NOITE, DESENROLADA (main.py `_desenrola_cartao`, e é o
  //    que a Refeição já faz antes de mandar). A view emite os `*_sug` em 24+,
  //    mas o Real manual que o DP crava na célula não: "23:50" de entrada com
  //    "06:10" de saída viraria jornada negativa. O bot reduz mod 24 na hora de
  //    digitar (`bot_ponto._mod24`), então quem manda a notação é a fila.
  const mEntrada = hm2min(entrada);
  let mSaida = hm2min(saida);
  let mAlmIni = almIni ? hm2min(almIni) : null;
  let mAlmFim = almFim ? hm2min(almFim) : null;
  if (mEntrada == null || mSaida == null || (almIni && (mAlmIni == null || mAlmFim == null))) {
    return fora(frase.ilegivel);
  }
  while (mSaida < mEntrada) mSaida += 1440;
  if (mAlmIni != null && mAlmFim != null) {
    while (mAlmIni < mEntrada) mAlmIni += 1440;
    while (mAlmFim < mAlmIni) mAlmFim += 1440;
    // O MIOLO TEM DE CABER DENTRO DO CARTÃO. Por construção da view ele cabe (as
    // quatro pontas saem do mesmo alvo), mas o Real manual do DP sobrescreve só
    // as PONTAS — cravar uma saída às 14:00 num dia cuja volta do almoço é 15:00
    // faria o robô escrever volta DEPOIS da saída. Mesma checagem da Refeição.
    if (mAlmFim > mSaida) return fora(frase.naoCabe(almIni, almFim, entrada, saida));
  }

  const alvo = [
    min2hm(mEntrada),
    mAlmIni == null ? "" : min2hm(mAlmIni),
    mAlmFim == null ? "" : min2hm(mAlmFim),
    min2hm(mSaida),
  ];
  return {
    ...base,
    motivo: "",
    alvo,
    csv: {
      cracha: cra8(linha?.cracha),
      data: ddmmaaaa(dia), // da LINHA, nunca de `new Date()`
      entrada: alvo[0],
      alm_saida: alvo[1],
      alm_volta: alvo[2],
      saida: alvo[3],
    },
  };
}

/* --------------------------- os dois chamadores --------------------------- */

/**
 * A REVISÃO, em lote (app.js:6003). Divide os candidatos entre o que vai para o
 * robô (`dentro`) e o que fica de fora (`fora`, sempre com nome e motivo).
 *
 * Não faz I/O: `casos` (ponto_caso do dia) e `bloqueios` (sugBloqueio por linha)
 * já estão carregados pela aba, indexados por `chaveDia`.
 */
export function montarLoteAjuste(linhas, casos, bloqueios) {
  const dentro = [];
  const fora = [];

  for (const l of linhas || []) {
    if (!aplicaAjuste(l)) continue;

    const chave = chaveDia(l.cracha, l.date_ref);
    const veredito = avaliarAjustePonto(l, {
      caso: casos?.[chave],
      bloqueio: bloqueios?.[chave],
      origem: "view",
    });
    const base = {
      chave,
      cracha: cra8(l.cracha),
      nome: l.nm_funcionario || "",
      dia: veredito.dia,
      motivoLinha: veredito.motivoLinha,
      fonte: veredito.fonte,
      cartaoHoje: veredito.cartaoHoje,
    };
    if (veredito.csv) dentro.push({ ...base, csv: veredito.csv });
    else fora.push({ ...base, motivo: veredito.motivo });
  }

  return { dentro, fora };
}

/**
 * AS FOLGAS, um dia (app.js:6168 `editorSug`). Mesma régua, com os horários que
 * o DP acabou de digitar nas duas PONTAS.
 *
 * Devolve `{ csv, cartaoHoje, alvo, dia, fonte }` quando pode lançar, ou
 * `{ fora }` com o motivo — nunca `null` calado.
 *
 * `cartao` já vem com o overlay do Real manual (`aplicarRealManual`); `caso` é a
 * linha de `ponto_caso` do dia. Não faz I/O.
 */
export function montarAjusteDoDia(cartao, edicao, caso) {
  const v = avaliarAjustePonto(cartao, { caso, digitado: edicao, origem: "digitado" });
  if (!v.csv) return { fora: v.motivo, cartaoHoje: v.cartaoHoje, dia: v.dia };
  return { dia: v.dia, cartaoHoje: v.cartaoHoje, alvo: v.alvo, fonte: v.fonte, csv: v.csv };
}
