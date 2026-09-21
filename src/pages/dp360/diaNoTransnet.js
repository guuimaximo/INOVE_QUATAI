// diaNoTransnet.js — O QUE FAZ O TRANSNET RECUSAR UM DIA SEM DIZER POR QUÊ (16/09/2026).
//
// Quando o Transnet recusa um cartão, ele só diz "Existem erros que impeçam a inserção de
// pontos para o período informado. Verifique as mensagens na coluna [Situação]!" — e a
// mensagem da coluna só aparece com o mouse em cima do X vermelho, que o robô não lê. O DP
// ficava sem saber o que fazer, com o cartão "aparentemente correto".
//
// Os motivos abaixo foram achados olhando a base, caso a caso (dono, 16/09/2026: "preciso
// saber o porquê não subiu e o que fazer para subir"):
//   · RICARDO 30060898 31/08 — o dia tem 04-ATESTADO MEDICO no Transnet;
//   · DOUGLAS 30060983 e SILVANO 30060436 28/08 — o fim do turno ficou gravado no dia 29/08.
//     O mesmo desenho já tinha recusado SILVANO 21/08, CLAUDINEI 21/08 e NELSON 22/08
//     várias vezes, até o DP arrumar à mão; e há mais 15 pares iguais na base.
//
// SEM React e SEM rede: a Revisão, as Ocorrências e o Histórico leem a MESMA regra.
// Extensão `.js` explícita nos imports para o Node conseguir testar este arquivo.
import { hm2min, min2hm } from "./regrasPonto.js";

const txt = (v) => String(v ?? "").trim();
const dois = (n) => String(n).padStart(2, "0");

/** dd/mm de um dia ISO, por recorte de texto (sem `Date`, sem fuso). */
const ddmm = (iso) => {
  const v = txt(iso);
  return v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : v;
};

/** O dia seguinte de um ISO `aaaa-mm-dd`. Conta em UTC puro: nada de fuso local aqui. */
export function somaUmDia(iso) {
  const [a, m, d] = txt(iso).slice(0, 10).split("-").map(Number);
  if (!a || !m || !d) return "";
  const dt = new Date(Date.UTC(a, m - 1, d + 1));
  return `${dt.getUTCFullYear()}-${dois(dt.getUTCMonth() + 1)}-${dois(dt.getUTCDate())}`;
}

/**
 * A VIRADA DO DIA DESENROLADA: todo horário menor que o anterior ganha 24 h.
 * "21:44 · 00:57" é "21:44 · 24:57" — o 00:57 é a saída depois da meia-noite, não uma
 * batida antes da entrada. Slot vazio continua vazio e não conta como anterior.
 */
export function desenrolaSlots(slots) {
  let anterior = null;
  return (slots || []).map((h) => {
    const m = hm2min(h);
    if (m == null) return "";
    let x = m;
    while (anterior != null && x < anterior) x += 1440;
    anterior = x;
    return min2hm(x);
  });
}

/**
 * O DIA COM ATESTADO MÉDICO NÃO RECEBE PONTO.
 *
 * RICARDO 30060898 31/08: o robô preencheu o cartão e o Transnet recusou; na foto, a coluna
 * Ocorrência da linha mostra "04 ATESTADO MEDICO". O dono (16/09/2026): "é alerta e está
 * certo em bloquear — tem que alertar que tem atestado médico".
 *
 * O ATESTADO DE HORAS (24-ATESTADO HORAS) FICA DE FORA: ele convive com o ponto — 36 dias
 * da base têm os dois. Só o atestado do dia inteiro trava.
 *
 * Devolve `null` quando o dia não tem atestado.
 */
export function atestadoDoDia(linha) {
  const te = txt(linha?.te_descricao_dia);
  const tipo = txt(linha?.tipo_dia).toUpperCase();
  if (tipo !== "ATESTADO" && !/ATESTADO/i.test(te)) return null;
  if (/HORA/i.test(te)) return null;
  const nome = te || "atestado médico";
  return {
    nome,
    texto:
      `o dia tem ${nome} no Transnet, e ele não aceita ponto em dia de atestado. ` +
      "Se a pessoa trabalhou, tire o atestado no Transnet antes de lançar; " +
      "se o atestado vale, não há ponto para lançar",
  };
}

/** As batidas de uma linha do `ponto_diario`, em minutos ("E01:19 | S01:20" → [79, 80]). */
export function batidasDaLinha(linha) {
  return (txt(linha?.todas_batidas).match(/\d{1,2}:\d{2}/g) || [])
    .map(hm2min)
    .filter((v) => v != null);
}

/**
 * O FIM DO TURNO GRAVADO NO DIA SEGUINTE, DENTRO DA JORNADA QUE VAI SER LANÇADA.
 *
 * Quem sai depois da meia-noite às vezes tem a saída (e o almoço) registrada no DIA
 * SEGUINTE: DOUGLAS 28/08 ficou com "13:55 · 16:28 · 16:58 · 16:59" e o 29/08 com
 * "01:19 · 01:20". Lançar o 28/08 com saída 01:20 põe a jornada POR CIMA dessas batidas,
 * e o Transnet recusa.
 *
 * SÓ CONTA A BATIDA QUE CAI DENTRO DA JORNADA (até a saída, inclusive). A prova veio do
 * mesmo dia 16/09: o 30060835 29/08 subiu com saída 01:42 e o 30/08 com "01:44 · 01:45" —
 * batida logo DEPOIS da saída não atrapalhou. Nos dois recusados ela caía antes ou em cima
 * da saída (DOUGLAS 01:19 e 01:20 contra 01:20; SILVANO 00:11 e 00:41 contra 01:50). Nos
 * 9 lançamentos com virada de dia dos logs guardados, a regra separa todos.
 *
 * `saida` é a saída que vai ser lançada (desenrolada: "25:20"). Só vale para quem vira o
 * dia. Devolve `null` quando nenhuma batida do dia seguinte cai dentro da jornada.
 */
export function fimNoDiaSeguinte(saida, linhaSeguinte, isoSeguinte) {
  const s = hm2min(saida);
  if (s == null || s < 1440 || !linhaSeguinte) return null;
  const presas = batidasDaLinha(linhaSeguinte).filter((m) => m <= s - 1440);
  if (!presas.length) return null;
  const dia = ddmm(isoSeguinte || linhaSeguinte.date_ref);
  const horas = presas.map(min2hm).join(" · ");
  return {
    dia,
    horas,
    texto:
      `o dia ${dia} já tem batida dentro deste turno (${horas}): é o fim dele, gravado no ` +
      `dia seguinte, e o Transnet não lança uma jornada por cima de outra. ` +
      `Apague essas batidas no ${dia} e lance de novo`,
  };
}

/** A frase genérica de recusa do Transnet — a que não diz nada sem a coluna [Situação]. */
export const ehRecusaSemMotivo = (frase) => /existem erros que impe/i.test(txt(frase));

/* ═══════════════ a sobra da véspera: o fim do turno de ontem gravado hoje ═══════════════ */

// main.py:3083 (`_sug_sem_op`): "1ª batida de madrugada (< 03:00) e isolada (gap > 4h da
// próxima) é sobra do turno da véspera — não é a entrada do dia".
const MADRUGADA_ATE = 3 * 60;
const BURACO_ISOLA = 4 * 60;
// Escala que começa de madrugada: a batida das 01:00 é a ENTRADA dele (NELIO 30060246,
// escala 01:30). Sem esta trava a regra roubaria o começo do turno de quem entra cedo.
const ESCALA_DE_MADRUGADA = 5 * 60;
// main.py:1573 `SUG_JORNADA_MAX_MIN`: 98,4% das jornadas fecham em até 13 h. Juntar a
// sobra a um dia que passaria disso não é devolver o fim do turno, é colar dois turnos.
const JORNADA_MAX = 13 * 60;

/**
 * A SOBRA DA VÉSPERA NO COMEÇO DO DIA (18/09/2026, pedido do dono).
 *
 * Quem sai depois da meia-noite e esquece de bater a saída no próprio turno às vezes bate
 * no app já com o dia virado, e o Transnet grava no DIA SEGUINTE: JOSE AUGUSTO 30061213
 * ficou com 14/09 "15:00 · 15:01" e 15/09 "00:58 · 14:50 · 18:50 · 19:20 · 23:30 · 23:31"
 * — o 00:58 é a saída do dia 14. A regra da ferramenta olhava só a 1ª batida; aqui ela
 * vale para um BLOCO, porque às vezes vão almoço e saída juntos (EDUARDO 30060711 06/09:
 * "00:08 · 00:38 · 01:38 · 01:39").
 *
 * Devolve `{ bloco, resto }` em minutos, ou null.
 */
export function sobraDaVespera(linha) {
  const b = batidasDaLinha(linha);
  if (!b.length || b[0] >= MADRUGADA_ATE) return null;
  const esc = hm2min(linha?.esc_entrada);
  if (esc != null && esc < ESCALA_DE_MADRUGADA) return null;
  let k = 0;
  while (k < b.length && b[k] < MADRUGADA_ATE) k++;
  const bloco = b.slice(0, k);
  const resto = b.slice(k);
  if (resto.length && resto[0] - bloco[bloco.length - 1] <= BURACO_ISOLA) return null;
  return { bloco, resto };
}

/**
 * O FIM DO TURNO DE `linhaDia` ESTÁ GRAVADO EM `linhaSeguinte`?
 *
 * Só quando devolver o bloco FECHA o turno: a véspera tem batida própria (tirada a sobra
 * que ela mesma deve ao dia anterior), não fechou depois da meia-noite, e o turno com a
 * sobra cabe em 13 h. Medido de 01/08 a 17/09: 26 dias, 22 pessoas; em 10 o dia seguinte
 * era folga e só tinha a sobra.
 *
 * Devolve `{ dia, horas, movidas, resto, jornada }` (`movidas` em notação 24+), ou null.
 */
export function fimDoTurnoNoDiaSeguinte(linhaDia, linhaSeguinte, isoSeguinte) {
  const sobra = sobraDaVespera(linhaSeguinte);
  if (!sobra) return null;
  const propria = sobraDaVespera(linhaDia);
  const doDia = propria ? propria.resto : batidasDaLinha(linhaDia);
  if (!doDia.length) return null;
  const ultima = doDia[doDia.length - 1];
  if (ultima >= 1440) return null;
  const movidas = sobra.bloco.map((m) => m + 1440);
  if (movidas[0] <= ultima) return null;
  const jornada = movidas[movidas.length - 1] - doDia[0];
  if (jornada > JORNADA_MAX) return null;
  return {
    dia: ddmm(isoSeguinte || linhaSeguinte?.date_ref),
    horas: sobra.bloco.map(min2hm).join(" · "),
    movidas: movidas.map(min2hm),
    resto: sobra.resto.map(min2hm),
    jornada,
  };
}

/* ═══════════ os dois cartões do robô `virada` (bot_virada.py, no DP360) ═══════════ */

// ferramenta/montador.py `_tapa_buraco` (LIÇÃO 4): batida a ≤ 1 min da anterior é o
// tapa-buraco do Transnet — a pessoa esqueceu uma batida e o sistema somou 1 min na última
// para fechar o cartão. Sai o SEGUNDO do par; a batida real é a primeira (15:00 · 15:01).
const TAPA_BURACO = 1;
function semTapaBuraco(mins) {
  const out = [];
  for (const m of mins) {
    if (out.length && m - out[out.length - 1] <= TAPA_BURACO) continue;
    out.push(m);
  }
  return out;
}

/** hora da linha desenrolada a partir da entrada: antes dela é do dia seguinte */
function aPartirDe(h, ancora) {
  const m = hm2min(h);
  if (m == null) return null;
  return ancora != null && m < ancora ? m + 1440 : m;
}

/**
 * Os 4 campos a partir das batidas: 4 → elas; 2 → entrada e saída, com a refeição que a
 * importação propôs no meio quando ela cabe (motorista: o almoço é lançado por nós — a mesma
 * refeição que a Revisão lançaria); outro número → incompleto: parte da sugestão do dia, e o
 * DP confere na prévia. `saidaFixa` (o D) é a última batida movida: é ela a saída, sempre.
 * `slots` sai em notação 24+.
 */
function slotsDoCartao(marcas, linha, saidaFixa = null, semHoras = []) {
  const fmt = (m) => (m == null ? "" : min2hm(m));
  if (marcas.length === 4) return { slots: marcas.map(fmt), completo: true, nota: "as batidas dele" };
  if (marcas.length === 2) {
    const [e, s] = marcas;
    const as = aPartirDe(linha?.almoco_saida_sug, e);
    const av = aPartirDe(linha?.almoco_volta_sug, e);
    if (as != null && av != null && e < as && as < av && av < s) {
      const curto = s - e >= 6 * 60 && av - as < 30;
      return {
        slots: [fmt(e), fmt(as), fmt(av), fmt(s)],
        completo: !curto,
        nota: curto ? `almoço proposto de ${av - as} min — confira` : "almoço da refeição proposta",
      };
    }
    // jornada de 6 h ou mais sem almoço nenhum: pode ser, mas o DP confere
    const longa = s - e >= 6 * 60;
    return {
      slots: [fmt(e), "", "", fmt(s)],
      completo: !longa,
      nota: longa ? `sem almoço numa jornada de ${Math.floor((s - e) / 60)}h${String((s - e) % 60).padStart(2, "0")} — confira` : "sem almoço",
    };
  }
  /* INCOMPLETO: parte da sugestão do dia — mas NUNCA das horas da sobra. A view calculou a
     sugestão com a sobra dentro do dia (JAIRO 12/09: almoço "00:34 · 01:31", que é o fim do
     turno do 11/09); reusá-la devolveria a batida ao lugar de onde o robô a está tirando. */
  // sem módulo de 24 h: a sobra está no COMEÇO do dia (00:55) e a saída do próprio dia vem
  // em 24+ (24:54) — PAULO MARCOS 03/09 sai todo dia perto da hora em que a sobra foi batida
  const perto = (a, b) => a != null && b != null && Math.abs(a - b) <= 2;
  const livre = (h) => {
    const m = hm2min(h);
    return m == null || semHoras.some((x) => perto(m, x)) ? "" : h;
  };
  const sug = desenrolaSlots(
    [linha?.entrada_sug, linha?.almoco_saida_sug, linha?.almoco_volta_sug, linha?.saida_sug].map(livre),
  );
  const sugM = sug.map(hm2min);
  const nota = `${marcas.length} batida(s) — confira e complete o cartão`;
  if (marcas.length === 3) {
    // três batidas: falta a entrada ou a saída. A primeira é a entrada se cai perto da
    // entrada que se esperava (sugestão, senão escala); aí o que falta é a saída.
    const esperada = sugM[0] ?? hm2min(linha?.esc_entrada);
    const primeiraEhEntrada = esperada == null || Math.abs(marcas[0] - esperada) <= 90;
    let slots;
    if (primeiraEhEntrada) {
      const saida =
        saidaFixa != null && saidaFixa > marcas[2] ? saidaFixa : sugM[3] != null && sugM[3] > marcas[2] ? sugM[3] : null;
      slots = [marcas[0], marcas[1], marcas[2], saida];
    } else {
      const entrada = sugM[0] != null && sugM[0] < marcas[0] ? sugM[0] : null;
      slots = [entrada, marcas[0], marcas[1], marcas[2]];
    }
    return { slots: slots.map(fmt), completo: false, nota };
  }
  // sem sugestão nenhuma: as batidas que houver, nas pontas
  if (!sug[0] && !sug[3]) {
    sug[0] = fmt(marcas[0]);
    sug[3] = marcas.length > 1 ? fmt(marcas[marcas.length - 1]) : "";
  }
  // a última batida movida é a saída — a não ser que ela seja o próprio almoço proposto
  const almocoAte = hm2min(sug[2]);
  if (saidaFixa != null && (almocoAte == null || saidaFixa > almocoAte)) sug[3] = min2hm(saidaFixa);
  return { slots: sug, completo: false, nota };
}

/**
 * O CARTÃO PODE SUBIR? Entrada e saída; almoço inteiro ou nenhum; tudo em ordem com a virada
 * desenrolada; até 13 h. Devolve o motivo, ou "".
 */
export function problemaDoCartao(slots) {
  const [e, as, av, s] = (slots || []).map((h) => txt(h));
  if (!e || !s) return "falta entrada ou saída";
  if (!!as !== !!av) return "almoço pela metade";
  const mins = desenrolaSlots([e, as, av, s]).map(hm2min);
  const cheios = mins.filter((m) => m != null);
  for (let i = 1; i < cheios.length; i++) if (cheios[i] <= cheios[i - 1]) return "horários fora de ordem";
  if (cheios[cheios.length - 1] - cheios[0] > JORNADA_MAX) return "passa de 13 h";
  return "";
}

/**
 * O CASO DA VIRADA COMO O DP VAI VER E O ROBÔ VAI LANÇAR (18/09/2026).
 *
 * `linhaDia` é o dia certo (D) e `linhaSeguinte` o D+1. Devolve null quando não é caso de
 * virada.
 *
 *   dia:      o D com a sobra no fim (sem o tapa-buraco e sem a sobra que o próprio D deve
 *             à véspera, quando há sequência);
 *   seguinte: "excluir" quando o D+1 só tinha a sobra (a tela de lançamento não salva dia
 *             vazio — o robô apaga o registro); "relancar" com o que sobrou nele; "nenhuma"
 *             quando a Revisão já relançou o D+1.
 *
 * Dias em sequência: ver `sequenciaDaVirada`.
 */
export function casoDaVirada({ linhaDia, linhaSeguinte, isoDia, isoSeguinte, seguinteLancado = null }) {
  const fim = fimDoTurnoNoDiaSeguinte(linhaDia, linhaSeguinte, isoSeguinte);
  if (!fim) return null;
  const propria = sobraDaVespera(linhaDia);
  const doDia = propria ? propria.resto : batidasDaLinha(linhaDia);
  const movidas = fim.movidas.map(hm2min);
  const dia = slotsDoCartao(semTapaBuraco([...doDia, ...movidas]), linhaDia, movidas[movidas.length - 1]);

  const sobra = sobraDaVespera(linhaSeguinte);
  const resto = semTapaBuraco(sobra.resto);
  /* O DIA SEGUINTE JÁ FOI RELANÇADO PELA REVISÃO (18/09/2026: 16/09 de NAELSON, ROGERIO,
     LUCIO e LUCIANO, lançados às 09:56). O lançamento grava os 4 campos e zera as extras, então
     a sobra já saiu do Transnet — a `ponto_diario` só vai saber na próxima importação. Aí não
     há o que limpar: o robô só confere que ela não está mais lá e grava o dia certo. */
  const seguinte = seguinteLancado
    ? {
        acao: "nenhuma",
        slots: null,
        completo: true,
        nota: `já relançado pela Revisão${seguinteLancado.quando ? ` (${seguinteLancado.quando})` : ""} — a sobra saiu de lá`,
      }
    : resto.length
      ? { acao: "relancar", ...slotsDoCartao(resto, linhaSeguinte, null, sobra.bloco) }
      : { acao: "excluir", slots: null, completo: true, nota: "o dia era folga e só tinha a sobra: o registro é apagado" };

  return {
    isoDia,
    isoSeguinte,
    sobra: sobra.bloco.map(min2hm),
    // a sobra que o PRÓPRIO D deve à véspera (o D é o dia seguinte de outro caso)
    comecaComSobra: propria ? propria.bloco.map(min2hm) : null,
    antesDia: batidasDaLinha(linhaDia).map(min2hm),
    antesSeguinte: batidasDaLinha(linhaSeguinte).map(min2hm),
    dia,
    seguinte,
    bloqueio: "",
  };
}

/**
 * DIAS EM SEQUÊNCIA — O ROBÔ FAZ TUDO (dono, 18/09/2026: "não quero na mão, quero que o bot
 * faça tudo").
 *
 * LUCIO 30060646: 14/09 "14:48 · 14:49", 15/09 "00:15 · 00:45 · 14:49 · …", 16/09 "01:41 · …" —
 * cada dia recebe a saída do anterior e perde a sua para o próximo. Arrumar um par sozinho
 * estraga o outro: gravar o 15/09 com a saída 01:41 regrava o registro inteiro, e o 00:15 ·
 * 00:45 some antes de ir para o 14/09.
 *
 * A saída é a ordem: do ÚLTIMO par para o primeiro. O dia certo de cada par é gravado sem a
 * sobra que ele deve à véspera (`casoDaVirada` já monta assim) — e é isso que deixa limpo o
 * dia seguinte do par anterior. Então só o último par limpa o dia seguinte dele; os outros vão
 * com "nenhuma", e o robô confere no Transnet que a sobra saiu mesmo antes de gravar. Se um
 * passo falha, o seguinte encontra a sobra lá e para sem mexer.
 *
 * `dias` = [{ iso, linha, lancado }] consecutivos e em ordem crescente; `alvo` = índice do dia
 * que o DP está olhando. Devolve os pares da sequência que passa por ele, na ordem do robô.
 */
export function sequenciaDaVirada(dias, alvo) {
  const pares = [];
  for (let k = 0; k + 1 < dias.length; k++)
    pares[k] = casoDaVirada({
      linhaDia: dias[k].linha,
      linhaSeguinte: dias[k + 1].linha,
      isoDia: dias[k].iso,
      isoSeguinte: dias[k + 1].iso,
      seguinteLancado: dias[k + 1].lancado || null,
    });
  const i = pares[alvo] ? alvo : pares[alvo - 1] ? alvo - 1 : -1;
  if (i < 0) return [];
  let ini = i;
  let fim = i;
  while (ini - 1 >= 0 && pares[ini - 1]) ini--;
  while (fim + 1 < pares.length && pares[fim + 1]) fim++;

  // o primeiro dia da sequência não pode começar com sobra de ninguém: ou a sequência começa
  // antes do que a tela leu, ou é batida de madrugada que não fecha turno nenhum — apagá-la
  // seria perder registro
  const primeiro = pares[ini];
  let bloqueio = "";
  if (primeiro.comecaComSobra)
    bloqueio =
      ini === 0
        ? `a sequência começa antes do ${ddmm(primeiro.isoDia)} — abra a Revisão do dia anterior`
        : `o ${ddmm(primeiro.isoDia)} começa com ${primeiro.comecaComSobra.join(" · ")}, que não fecha turno nenhum — confira à mão`;

  const total = fim - ini + 1;
  const saida = [];
  for (let k = fim; k >= ini; k--) {
    const caso = { ...pares[k], bloqueio };
    if (k < fim)
      caso.seguinte = {
        acao: "nenhuma",
        slots: null,
        completo: true,
        nota: `limpo no passo anterior (o ${ddmm(caso.isoSeguinte)} é gravado sem a sobra)`,
      };
    caso.sequencia = total > 1 ? { passo: fim - k + 1, total } : null;
    saida.push(caso);
  }
  return saida;
}

/** dd/mm/aaaa de um ISO */
const br = (iso) => `${txt(iso).slice(8, 10)}/${txt(iso).slice(5, 7)}/${txt(iso).slice(0, 4)}`;

/** O item que vai para o robô (o `casos` do virada.yml), com os cartões que o DP confirmou. */
export function casoParaORobo({ cracha, nome, caso, slotsDia, slotsSeguinte }) {
  const cartao = ([e, as, av, s]) => ({ entrada: e || "", alm_saida: as || "", alm_volta: av || "", saida: s || "" });
  return {
    cracha: txt(cracha),
    nome: txt(nome),
    dia: br(caso.isoDia),
    seguinte: br(caso.isoSeguinte),
    sobra: caso.sobra,
    seguinte_acao: caso.seguinte.acao,
    ...(caso.seguinte.acao === "relancar" ? { seguinte_cartao: cartao(slotsSeguinte) } : {}),
    dia_cartao: cartao(slotsDia),
  };
}

/* ═══════════ O ALMOÇO DE MEIO DE JORNADA PRECISA DE UM FIM (21/09/2026) ═══════════
 *
 * Dono, no JOAO CAETANO 3202677 · 25/08: "ele inventou o almoço e aí jogou a correção para
 * frente... por que deu almoço de meio de jornada se não tinha final?".
 *
 * O importador fecha o almoço pela matriz quando não há batida de refeição. A `MATRIZ_PARADO`
 * ancora no fim conhecido do dia; a `MATRIZ_MEIO_JORNADA` divide a jornada ao meio — e num
 * dia SEM FIM não existe meio para dividir. O que sai é um almoço inventado (16:00/17:00 num
 * cartão que tem só 04:29), e ele estraga tudo que vem depois: a ponta seguinte precisa cair
 * DEPOIS do almoço, então 07:30 vira 31:30 e o dia fecha com 26 h líquidas.
 *
 * Medido no lake (janela de 70 dias): 220 dias com `MATRIZ_MEIO_JORNADA`, e 212 deles não têm
 * saída — nem apurada, nem de alvo. Ou seja, 96% do que essa fonte produz é almoço sem fim de
 * jornada. As outras matrizes (PARADO, PARADO_MAIOR) têm alvo de saída em 100% dos dias e
 * ficam como estão.
 *
 * Dia assim não tem almoço para mostrar nem para travar: o cartão fica com as pontas que
 * existem e o DP crava as quatro à mão se quiser. */
export function almocoInventado(linha) {
  const fonte = txt(linha?.fonte_almoco).toUpperCase();
  if (!fonte.startsWith("MATRIZ_MEIO")) return false;
  return !txt(linha?.saida) && !txt(linha?.alvo_saida);
}

/** A linha do dia sem o almoço que a matriz inventou (ver `almocoInventado`). */
export function semAlmocoInventado(linha) {
  if (!linha || !almocoInventado(linha)) return linha;
  return {
    ...linha,
    alvo_saida_almoco: "",
    alvo_volta_almoco: "",
    almoco_travado: "",
    fonte_almoco: "SEM_FIM_DE_JORNADA",
  };
}

/** O dia cujo almoço saiu por não ter fim de jornada (marca de `semAlmocoInventado`).
 *  É por ele que o miolo do motorista deixa de ser travado: sem refeição apurada não há o
 *  que travar, e o DP precisa dos quatro campos para cravar o cartão à mão. */
export const almocoSemFim = (linha) =>
  txt(linha?.fonte_almoco).toUpperCase() === "SEM_FIM_DE_JORNADA";
