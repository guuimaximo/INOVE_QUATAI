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
// São DUAS perguntas, e cada uma já tem resposta no original:
//
//   · "o dia CHEGOU?" → `datasComPonto` (main.py:7067). O seletor da Revisão da
//     ferramenta é montado SÓ com dias que têm alguém com `tem_ponto = true`.
//     Dia sem ponto importado simplesmente não existe na lista.
//   · "o dia conta para ABANDONO?" → `consolidado` (main.py:7580, >= 30% de quem
//     tem balde bateu). Régua diferente de propósito: domingo tem ponto (98
//     pessoas bateram em 30/08) mas não deve contar falta.
//
// O denominador do `consolidado` é quem `_bucket` classifica
// (MOTORISTA/INTERNO/APRENDIZ) — férias, atestado e afastado ficam de fora.
// ============================================================================

const txt = (valor) => String(valor ?? "").trim();

// Convenção do lake: booleano da `ponto_diario` chega como STRING "true"/"false".
// `=== false` derruba a regra sem erro nenhum aparecer.
const ehFalso = (valor) => valor === false || txt(valor).toLowerCase() === "false";

// main.py:7455 — `_DASH_CATS`. Quem está fora destas três é ignorado pelo balde
// (devolve null): não conta para consolidar o dia.
const CATEGORIAS_DASH = new Set(["MOTORISTA", "INTERNO", "APRENDIZ"]);

// main.py:7601 — os três baldes que provam que a pessoa APARECEU no dia.
export const COM_PONTO = new Set(["ok", "incorreto", "sem_operacao"]);

// main.py:7580 — `cp >= 0.3 * tot`. É a régua do ABANDONO: o dia só entra na
// contagem de faltas quando a garagem apareceu em massa.
export const FRACAO_CONSOLIDADO = 0.3;

// …E POR QUE ELA NÃO RESPONDE "O DIA CHEGOU?". Medido na base em 06/09/2026:
//
//     2026-09-04 sex    0/369    0%   ← não chegou
//     2026-09-03 qui    0/369    0%   ← não chegou
//     2026-09-02 qua  289/369   78%
//     2026-08-30 dom   89/370   24%   ← DOMINGO: chegou, só rodou pouco
//     2026-08-29 sáb  159/371   43%
//
// Pelos 30% o domingo seria acusado de "não chegou", e 98 pessoas bateram ponto
// nele. Para essa pergunta a resposta é `datasComPonto`, abaixo — que é o que a
// ferramenta usa, e não depende de limiar nenhum.

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

// Colunas do índice do seletor — as três do original (main.py:7066,
// `ler_ponto_diario_resumo_revisao`).
export const COLUNAS_INDICE_DATAS = ["date_ref", "categoria", "tem_ponto"];

/**
 * PORTE de main.py:7066-7071 (`get_revisao_datas`).
 *
 * O seletor de dia da Revisão nasce SÓ das linhas com `tem_ponto = true`. Um dia
 * cujo ponto ainda não foi importado do Transnet não entra na lista — e é isso
 * que impede a tela de abrir num dia em que a garagem inteira aparece como
 * SEM_PONTO (as linhas existem desde que a escala existe; a batida chega depois).
 *
 * Devolve também `semPonto`: os dias que TÊM linha mas não têm ninguém com
 * ponto. O original descarta esses dias em silêncio, e aí ninguém entende por
 * que ontem sumiu do seletor. Aqui eles voltam como aviso, não como opção.
 *
 * `tem_ponto` chega como STRING "true"/"false" (convenção do lake).
 */
export function datasComPonto(linhas) {
  const comPonto = new Set();
  const todos = new Set();
  const categorias = new Set();
  for (const l of linhas || []) {
    const dia = txt(l?.date_ref).slice(0, 10);
    if (!dia) continue;
    todos.add(dia);
    if (txt(l?.tem_ponto).toLowerCase() !== "true") continue;
    comPonto.add(dia);
    const cat = txt(l?.categoria).toUpperCase();
    if (cat) categorias.add(cat);
  }
  const desc = (a, b) => b.localeCompare(a);
  return {
    datas: [...comPonto].sort(desc),
    semPonto: [...todos].filter((d) => !comPonto.has(d)).sort(desc),
    categorias: [...categorias].sort(),
  };
}
