// ============================================================================
// O DIA CONSOLIDOU?
//
// Porte de `main.py` `_bucket` (~7455) e do passo 1 de `get_abandonos` (~7568).
//
// POR QUE ISSO EXISTE, e por que vale para mais de uma tela: a `ponto_diario`
// tem UMA LINHA POR PESSOA POR DIA desde que a escala existe — a linha nasce
// antes de a batida chegar. Enquanto o ponto do dia não é importado, todas as
// linhas daquele dia dizem `SEM_PONTO` com o cartão vazio.
//
// Uma tela que não sabe disso mostra a garagem inteira como gente que não bateu
// ponto. Foi o que aconteceu na Revisão em 06/09/2026: 246 motoristas em
// REVISAR no dia 04/09, todos SEM_PONTO, todos com "Todas as batidas" vazio —
// e a base confirmando: 369 linhas, ZERO com batida, contra 291 de 369 no dia
// 02/09. Não era uma garagem faltosa; era um dia que não chegou.
//
// São DUAS perguntas, com réguas diferentes, e a diferença foi medida (ver o
// bloco de números junto das constantes):
//   · `consolidado` — porte literal do original (>= 30% de quem tem balde
//     bateu). É a régua do ABANDONO: domingo fica de fora, e é assim que tem
//     de ser, porque contar falta num dia de folga geral não faz sentido.
//   · `importado`   — o ponto do dia chegou do Transnet? Régua própria e baixa.
//     Usar os 30% aqui acusaria o domingo (24%, com 89 pessoas que bateram) de
//     "dia não chegou" — uma mentira, e das que fazem alguém avisar quem não
//     devia.
//
// O denominador das duas é o mesmo: quem `_bucket` classifica
// (MOTORISTA/INTERNO/APRENDIZ). Férias, atestado e afastado ficam de fora.
// ============================================================================

const txt = (valor) => String(valor ?? "").trim();

// Convenção do lake: booleano da `ponto_diario` chega como STRING "true"/"false".
// `=== false` derruba a regra sem erro nenhum aparecer.
const ehFalso = (valor) => valor === false || txt(valor).toLowerCase() === "false";

// main.py:7455 — `_DASH_CATS`. Quem está fora destas três é ignorado pelo balde
// (devolve null): não conta para consolidar o dia.
export const CATEGORIAS_DASH = new Set(["MOTORISTA", "INTERNO", "APRENDIZ"]);

// main.py:7601 — os três baldes que provam que a pessoa APARECEU no dia.
export const COM_PONTO = new Set(["ok", "incorreto", "sem_operacao"]);

// main.py:7580 — `cp >= 0.3 * tot`. É a régua do ABANDONO: o dia só entra na
// contagem de faltas quando a garagem apareceu em massa.
export const FRACAO_CONSOLIDADO = 0.3;

// …E POR QUE ELA NÃO SERVE PARA DIZER "O DIA NÃO CHEGOU".
//
// Medido na base em 06/09/2026, com esta mesma função:
//
//     2026-09-04 sex    0/369    0%   ← não importado
//     2026-09-03 qui    0/369    0%   ← não importado
//     2026-09-02 qua  289/369   78%
//     2026-08-30 dom   89/370   24%   ← DOMINGO: chegou, só rodou pouco
//     2026-08-29 sáb  159/371   43%
//
// Pelos 30%, o domingo seria acusado de "não chegou" — e 89 pessoas bateram
// ponto nele; as linhas delas são casos de verdade para revisar. As duas
// perguntas são diferentes:
//   · "o dia conta para abandono?"  → 30% (a régua do original, acima)
//   · "o ponto do dia foi importado?" → praticamente ninguém bateu.
// Por isso a segunda tem régua própria e baixa. Entre 0% e 24% não existe caso
// real conhecido: ou o dia entrou, ou não entrou.
export const FRACAO_IMPORTADO = 0.05;

// As colunas que o balde lê. Pedir menos que isto faz a classificação mentir
// em silêncio (um `undefined` vira string vazia e o dia muda de balde).
export const COLUNAS_CONSOLIDACAO = [
  "date_ref",
  "categoria",
  "status_ponto",
  "te_descricao_dia",
  "classificacao",
  "jornada_transnet",
  "teve_operacao",
];

/** main.py `_bucket`: em que balde esta linha-dia cai (null = fora da conta). */
export function balde(linha) {
  const categoria = txt(linha?.categoria).toUpperCase();
  if (!CATEGORIAS_DASH.has(categoria)) return null;

  const status = txt(linha?.status_ponto);
  if (status === "OK") return "ok";

  if (status === "SEM_PONTO") {
    const lancado = txt(linha?.te_descricao_dia);
    const classificacao = txt(linha?.classificacao).toUpperCase();
    return lancado || classificacao === "AFASTADO" ? "justificado" : "sem_ponto";
  }

  if (status === "REVISAR") {
    // Motorista que bateu ponto mas não operou (sem Citatti/bilhetagem).
    if (categoria === "MOTORISTA" && txt(linha?.jornada_transnet) && ehFalso(linha?.teve_operacao)) {
      return "sem_operacao";
    }
    return "incorreto";
  }

  return null;
}

/**
 * Consolidação de UM dia, a partir das linhas daquele dia.
 * Devolve `{ total, comPonto, fracao, consolidado }` — `total` já é só quem tem
 * balde, como no original.
 */
export function consolidacaoDoDia(linhas) {
  let total = 0;
  let comPonto = 0;
  for (const linha of linhas || []) {
    const b = balde(linha);
    if (b === null) continue;
    total += 1;
    if (COM_PONTO.has(b)) comPonto += 1;
  }
  return medir(total, comPonto);
}

/** As duas leituras de um dia, a partir dos contadores. */
function medir(total, comPonto) {
  const fracao = total ? comPonto / total : 0;
  return {
    total,
    comPonto,
    fracao,
    // conta para abandono (régua do original)
    consolidado: total > 0 && comPonto >= FRACAO_CONSOLIDADO * total,
    // o ponto do dia já foi importado do Transnet
    importado: total > 0 && comPonto >= FRACAO_IMPORTADO * total,
  };
}

/**
 * O mesmo, para um lote que mistura vários dias: `Map(dia → consolidação)`.
 * É o passo 1 do `get_abandonos`, e serve para uma tela escolher a data que
 * abre — abrir num dia que não chegou é mostrar a garagem inteira como faltosa.
 */
export function consolidacaoPorDia(linhas) {
  const acumulado = new Map();
  for (const linha of linhas || []) {
    const dia = txt(linha?.date_ref).slice(0, 10);
    if (!dia) continue;
    const b = balde(linha);
    if (b === null) continue;
    const par = acumulado.get(dia) || [0, 0];
    par[0] += 1;
    if (COM_PONTO.has(b)) par[1] += 1;
    acumulado.set(dia, par);
  }
  const mapa = new Map();
  for (const [dia, [total, comPonto]] of acumulado) mapa.set(dia, medir(total, comPonto));
  return mapa;
}

/** A data mais recente que já consolidou (ou "" se nenhuma). Régua do abandono. */
export function diaMaisRecenteConsolidado(datas, mapa) {
  for (const dia of datas || []) {
    if (mapa?.get(dia)?.consolidado) return dia;
  }
  return "";
}

/**
 * A data mais recente cujo ponto JÁ FOI IMPORTADO — é nela que uma tela de
 * conferência deve abrir. Diferente da de cima de propósito: domingo entra aqui
 * (chegou, só rodou pouco) e não entra lá.
 */
export function diaMaisRecenteImportado(datas, mapa) {
  for (const dia of datas || []) {
    if (mapa?.get(dia)?.importado) return dia;
  }
  return "";
}
