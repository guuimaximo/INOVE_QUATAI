/**
 * O ENCAIXE DO CARTÃO EM QUATRO — porte de `ferramenta/montador.py` (passo 4, "encaixe dos
 * slots", linha 417).
 *
 * POR QUE ISTO EXISTE. O porte usava só o `simulador.py` (a PRÉVIA: aplica os pedidos e
 * devolve as batidas). A ferramenta usa o `montador.py` para dizer como o cartão FICA — e
 * o montador tem um passo que o simulador não tem: quando sobra batida, ele encaixa as
 * quatro e descarta o resto. Sem esse passo, todo cartão que terminava em 3 ou 5 batidas
 * era declarado "não fecha" e a tela não mostrava alvo nenhum. O dono foi direto ao ponto:
 * "tem que fazer fechar em 4, por isso tem o montador".
 *
 * A REGRA (LIÇÃO 2 + LIÇÃO 9 do LICOES_OCORRENCIAS.md): o dia tem FORMA — entrada, saída
 * do almoço, volta do almoço, saída. Sobrando batida, ficam a PRIMEIRA, o par de almoço
 * PLAUSÍVEL e a ÚLTIMA; o resto sai (e sai visível, nunca em silêncio).
 *
 * O que este módulo NÃO porta, de propósito: o tapa-buraco (precisa do GPS, que esta tela
 * não lê), a releitura pelo hábito de entrada e a reconstrução pelo GPS. São recursos de
 * ÚLTIMO caso do montador; o encaixe é o passo normal, e é ele que faltava.
 */

/** montador.py:14 — as constantes são as DELE, não as do simulador (que usa 27 min). */
export const MAX_ALMOCO = 120;
const MIN_ALMOCO = 20;
const TOL_COLADA = 6;
/**
 * montador.py:26 — piso do almoço do MOTORISTA. Quem decide a duração dele é a matriz da
 * Revisão (15 min na faixa de 4-6 h, 30 acima de 6, 60 na reserva), e o portão dos 27 min
 * a reduz ainda mais quando o parado não comporta. Com piso único de 20, o cartão saía com
 * "almoço de 15 min" e não fechava — 629 dias de motorista no `ponto_diario` têm almoço
 * abaixo de 20 min publicado pela view, 467 deles os 15 exatos da faixa. Aqui o piso só
 * precisa separar almoço de batida COLADA, que já tem o seu número.
 */
const MIN_ALMOCO_MOTORISTA = TOL_COLADA + 1;

export const pisoAlmoco = (cat) =>
  String(cat || "").toUpperCase() === "MOTORISTA" ? MIN_ALMOCO_MOTORISTA : MIN_ALMOCO;

/**
 * montador.py:114 (`_par_almoco`) — LIÇÃO 9: a volta do almoço é a que FORMA intervalo
 * plausível com a saída, não simplesmente a próxima batida (EDUARDA 07/08: 12:56→13:05 são
 * 9 min, não é almoço).
 *
 * E o almoço é o par plausível mais PRÓXIMO DO MEIO do dia, não o mais longo: ANDERSON
 * 11/08 tinha 12:11→13:02 (51 min, o certo) e 14:00→16:42; BIANCA 06/08 tinha 12:39→13:39
 * (60, o certo) e 13:39→14:56 (77, mais longo).
 *
 * Devolve `[saida, volta]` em minutos, ou `null`.
 */
export function parAlmoco(mins, cat) {
  const ms = mins || [];
  if (ms.length < 2) return null;
  const meio = (ms[0] + ms[ms.length - 1]) / 2;
  const piso = pisoAlmoco(cat);
  const cands = [];
  for (let i = 0; i < ms.length - 1; i += 1) {
    const d = ms[i + 1] - ms[i];
    if (d >= piso && d <= MAX_ALMOCO) cands.push([i, ms[i], ms[i + 1]]);
  }
  if (!cands.length) return null;
  // o almoço fica ENTRE entrada e saída: descarta par que use a primeira ou a última batida
  const dentro = cands.filter(([i]) => i > 0 && i + 1 < ms.length - 1);
  const esc = dentro.length ? dentro : cands;
  let melhor = esc[0];
  let menor = Infinity;
  esc.forEach((c) => {
    const dist = Math.abs((c[1] + c[2]) / 2 - meio);
    if (dist < menor) {
      menor = dist;
      melhor = c;
    }
  });
  return [melhor[1], melhor[2]];
}

/**
 * montador.py:417 — o passo 4 inteiro.
 *
 * Recebe o cartão em minutos (já com os pedidos aplicados) e devolve `{ fica, fora, nota }`:
 *   · `fica` — o cartão encaixado, 4 batidas, quando deu;
 *   · `fora` — as batidas descartadas pelo encaixe (a tela mostra riscadas);
 *   · `nota` — o que impediu, quando não deu ("não achei par de almoço pra encaixar").
 *
 * O ALVO É 4 — com uma exceção, que é a do Python: MOTORISTA com menos de 4 batidas fecha
 * em 2 (é o cartão sem almoço, legítimo). Cartão que já fecha volta intocado: encaixar o
 * que já tem forma só criaria diferença onde não há.
 */
export function encaixaEmQuatro(mins, cat) {
  const ms = [...new Set(mins || [])].sort((a, b) => a - b);
  const alvoN = String(cat || "").toUpperCase() !== "MOTORISTA" ? 4 : ms.length >= 4 ? 4 : 2;
  if (ms.length <= alvoN || alvoN !== 4) return { fica: ms, fora: [], nota: "" };
  const alm = parAlmoco(ms, cat);
  if (!alm) return { fica: ms, fora: [], nota: "não achei par de almoço pra encaixar" };
  const novo = [ms[0], alm[0], alm[1], ms[ms.length - 1]];
  return {
    fica: [...new Set(novo)].sort((a, b) => a - b),
    fora: ms.filter((v) => !novo.includes(v)),
    nota: "",
  };
}

/** montador.py:159 (`valida`) — LIÇÃO 12: o resultado tem que ser um cartão POSSÍVEL. */
export function validaCartao(mins, cat) {
  const ms = mins || [];
  const c = String(cat || "").toUpperCase();
  if (ms.length !== new Set(ms).size) return "slot repetido";
  if (ms.some((v, i) => i > 0 && v < ms[i - 1])) return "fora de ordem";
  if (c === "MOTORISTA") {
    if (![2, 4].includes(ms.length)) return `${ms.length} batidas (motorista: 2 ou 4)`;
  } else if (ms.length !== 4) {
    return `${ms.length} batidas (interno/aprendiz: 4)`;
  }
  if (ms.length === 4) {
    const d = ms[2] - ms[1];
    if (d < pisoAlmoco(c) || d > MAX_ALMOCO) return `almoço de ${d} min`;
  }
  return "";
}
