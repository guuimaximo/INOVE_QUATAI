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
