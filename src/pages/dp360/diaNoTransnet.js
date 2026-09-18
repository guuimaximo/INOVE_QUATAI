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
