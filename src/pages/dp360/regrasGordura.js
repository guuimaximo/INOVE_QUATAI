/* =============================================================================
   regrasGordura.js — AS QUATRO CAMADAS DA GORDURA (o `_gord()` do app antigo).

   MÓDULO PURO: sem React, sem rede, sem estado. Recebe dados, devolve resultado.
   Quem lê da base e quem desenha a tela são as telas (abas/Gordura.jsx e
   DP360Resumo.jsx). Isto aqui é só a régua, no mesmo espírito de `regrasPonto.js`
   e `regrasGps.js`.

   POR QUE ESTE ARQUIVO EXISTE
   ---------------------------------------------------------------------------
   A `ponto_gordura` CRUA não é o número que o DP usa. O app antigo aplica quatro
   camadas na LEITURA e só então mostra, filtra, avisa e cobra:

     main.py:4699 (`_gord`)
       _aplica_alvo( _aplica_reserva_gps( _aplica_reserva(
         _aplica_prioridade_citatti_linha99( sc.ler_gordura() ) ) ) )

   Quem reimplementa por cima da tabela crua devolve um número DIFERENTE do que a
   ferramenta mostra — e número que não bate ninguém usa pra decidir. Por isso as
   camadas moram AQUI, uma vez só, e as duas telas importam daqui.

   A ORDEM IMPORTA (e é a do main.py):
     1. linha 99   — o Citatti vira a fonte das duas pontas;
     2. reserva do INOVE — o lançamento do gestor alarga a operação real e marca
        `tem_reserva_inove`;
     3. reserva por GPS  — só age quando NÃO existe o lançamento acima;
     4. alvo       — a última palavra sobre `gordura_entrada`/`gordura_saida`, com
        o alvo publicado pela Revisão mandando sobre a conta local.

   FONTES DA VERDADE (mexeu aqui, mexe lá):
     app/main.py:4699  `_gord`
     app/main.py:4706  `_aplica_prioridade_citatti_linha99`
     app/main.py:4753  `_aplica_alvo`
     app/main.py:4844  `_aplica_reserva`
     app/main.py:4899  `_aplica_reserva_gps`
     app/main.py:7643  `PORTA_GORDURA` / 7644 `_SEM_REGUA` / 7647 `_ponta_conta`
     app/main.py:117-118 `TOL_ENTRADA_MIN` / `TOL_SAIDA_MIN`

   TUDO É TEXTO. Em `ponto_gordura` TODAS as colunas são `text` — inclusive
   minutos e booleanos ("true"/"false"). Nada aqui pode assumir number/boolean
   nativo, e nada pode comparar texto com `>=` esperando ordem numérica.

   AS CAMADAS NÃO MUTAM A LINHA ORIGINAL: cada uma devolve uma cópia (`{...g}`),
   ao contrário do Python, que altera o dict no lugar. O resultado é o mesmo — o
   Python guarda o retorno em `self._gordura` e é isso que todo mundo lê.
   ========================================================================== */

/* ------------------------------- constantes ------------------------------- */

// RÉGUA FIXA DO DP (main.py:117-118, decisão de 24/08/2026: "10 e 8 em tudo").
// NÃO é configuração de tela: ele bate o ponto e ainda anda até o carro
// (entrada −10 min) e, no fim, estaciona/confere e volta ao relógio (saída +8).
// Estes números também vivem no SQL da Revisão — mexeu aqui, mexe lá.
export const TOL_ENTRADA = 10;
export const TOL_SAIDA = 8;

// Assinatura da reserva sem lançamento (main.py:4895-4896).
export const RES_GPS_ESCALA = 15; // GPS × escala: até isso é a mesma hora
export const RES_GPS_BILH = 30; // bilhetagem depois disso do GPS = esperando, não rodando

// Tolerância aplicada DEPOIS da união com a reserva lançada (main.py:4876 e 4884).
// AMBIGUIDADE (herdada do original): aqui o Python usa 10 nas DUAS pontas, enquanto a
// régua declarada na tela e usada em `camadaAlvo` é 10 na entrada e 8 na SAÍDA
// (TOL_SAIDA). Ou seja, uma saída com 9 min de gordura vira TOLERANCIA_OPERACIONAL
// nesta camada e seria P-alguma-coisa em qualquer outro caminho. Portado como está para
// não divergir do app antigo; se o DP decidir alinhar, é só trocar esta constante por
// TOL_SAIDA no lado da saída.
export const TOL_RESERVA_INOVE = 10;

// main.py:7643 — porta única dos INDICADORES históricos do painel, que não
// distinguem ponta. Não confundir com a régua do aviso (`pontaConta`, 10/8).
export const PORTA_GORDURA = 10;

// main.py:7644 `_SEM_REGUA` — nível sem régua confiável: a ponta não recebe aviso
// e não entra em oportunidade nenhuma, por maior que seja o número.
export const NIVEIS_SEM_REGUA = new Set([
  "NAO_CALCULAR", "SEM_DADO", "ANOMALIA_TEMPORAL", "PONTO_INCOMPLETO", "",
]);

// main.py:3838 — a escada de confiança, na ordem em que o painel a apresenta.
export const NIVEIS_P = ["P1", "P2", "P3", "P3_SEM_CONFIRMACAO", "P4"];

// main.py:3785 — UM DIA NÃO TEM 12 HORAS DE GORDURA. Acima disso é defeito de
// cálculo (virada de meia-noite mal desenrolada), não oportunidade.
export const TETO_GORDURA_DIA = 720;

// A linha é pintada/contada pelo PIOR nível presente, nesta precedência.
export const PRECEDENCIA = ["P1", "P2", "P3", "P4", "RESERVA", "OPERACAO_FORA_PONTO"];

/* ------------------------- conversões (campos são TEXTO) ------------------- */

export const txt = (v) => (v == null ? "" : String(v).trim());
export const ehVerdade = (v) => ["true", "t", "1", "sim", "yes", "y"].includes(txt(v).toLowerCase());
export const num = (v) => {
  const n = Number.parseFloat(txt(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
export const modulo = (v) => Math.abs(num(v) || 0);
// Crachá com menos de 8 dígitos vira 8 com zeros à esquerda (main.py `_cracha8`).
export const cracha8 = (c) => {
  const s = txt(c);
  return /^\d+$/.test(s) && s.length > 0 && s.length < 8 ? s.padStart(8, "0") : s;
};
export const dia10 = (d) => txt(d).slice(0, 10);
/** Chave de join entre gordura, ponto, caso, linha 99 e reserva. */
export const chaveDe = (cra, dia) => `${cracha8(cra)}|${dia10(dia)}`;

// "0130" -> "01:30" (a escala vem sem os dois pontos na gordura; main.py `_hhmm`).
// Texto que não vira horário volta vazio — melhor a célula ficar "—" do que exibir lixo.
export function fmtHora(valor) {
  const s = txt(valor);
  if (!s) return "";
  if (s.includes(":")) return s.slice(0, 5);
  const d = s.replace(/\D/g, "");
  if (d.length === 3) return `0${d[0]}:${d.slice(1)}`;
  if (d.length === 4) return `${d.slice(0, 2)}:${d.slice(2)}`;
  return "";
}

/** "01:30" -> 90. Aceita a notação >24h do cartão ("26:08" -> 1568). */
export function hm2m(valor) {
  const t = fmtHora(valor);
  const m = /^(\d{1,3}):(\d{2})$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** 1568 -> "26:08" (preserva a virada de dia). */
export function m2hm(minutos) {
  const v = Math.round(minutos);
  const h = Math.floor(v / 60);
  const m = ((v % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Variante de t (t−24h, t, t+24h) mais perto de ref — é o que faz 02:08 casar com a
// batida 26:08 do cartão em vez de virar 02:08 da madrugada errada (main.py `_var`).
export const variante = (t, ref) =>
  [t - 1440, t, t + 1440].reduce((a, b) => (Math.abs(b - ref) < Math.abs(a - ref) ? b : a));

// Minutos entre dois horários no relógio, sempre 0..720 (main.py `_dif_relogio`).
export const difRelogio = (a, b) => {
  const d = Math.abs(a - b) % 1440;
  return Math.min(d, 1440 - d);
};

/* NOTA sobre duplicação com `regrasPonto.js`: lá existem `varHora` e `difRelogio`
   com a mesma intenção, mas escritos a partir do simulador (com `Math.trunc` e
   com a lista de candidatos avaliada em outra ordem de empate). Estas aqui são as
   que a Gordura roda hoje e produzem os números que o DP já conferiu; trocar por
   as de lá seria mudar o número sem ninguém pedir. Ficam as duas, cada uma no seu
   caminho, e esta nota pra ninguém "consertar" achando que é cópia esquecida. */

/* ------------------------------ régua da lista ----------------------------- */

/**
 * 1º corte da lista da Gordura: só quem tem gordura acima da régua fixa em ALGUMA
 * ponta. As pontas são INDEPENDENTES — uma saída fora da régua entra mesmo com a
 * entrada dentro dela, e uma ponta nunca anula a outra.
 */
export const passaRegua = (o) =>
  modulo(o.gordura_entrada) > TOL_ENTRADA || modulo(o.gordura_saida) > TOL_SAIDA;

/**
 * Piso de exibição: NÃO é régua, é filtro de tela ("hoje só quero olhar acima de
 * 30 min"). Olha a ponta MAIOR do dia.
 */
export const maiorPonta = (o) => Math.max(modulo(o.gordura_entrada), modulo(o.gordura_saida));

/**
 * main.py:7647 (`_ponta_conta`) — A MESMA TRAVA DO AVISO: esta ponta pode receber
 * aviso? Só fora da régua fixa do respectivo lado (10 na entrada, 8 na saída) e só
 * em nível com régua. Filtrar por lista de níveis à mão deixava entrar o que o
 * resto do sistema já recusa (OZIEL 06/08 aparecia com 1440 min — 24h exatas, de
 * virada de meia-noite mal desenrolada — num dia TOLERANCIA_OPERACIONAL).
 *
 * Repare que o Python compara o MÓDULO: a ponta negativa (OPERACAO_FORA_PONTO)
 * passa nesta trava. Quem soma oportunidade precisa exigir `> 0` por fora, como o
 * `get_dashboard_detalhe` faz.
 */
export function pontaConta(nivel, gordura, ponta = "entrada") {
  if (NIVEIS_SEM_REGUA.has(txt(nivel).toUpperCase())) return false;
  const porta = String(ponta).toLowerCase().startsWith("sai") ? TOL_SAIDA : TOL_ENTRADA;
  const v = num(gordura);
  return v != null && Math.abs(v) > porta;
}

/** P3 e P3⁻ contam como o mesmo nível nos chips e na pintura da linha. */
export const nivKey = (n) => {
  const k = txt(n).toUpperCase();
  return k === "P3_SEM_CONFIRMACAO" ? "P3" : k;
};

/* ----------------- as quatro camadas (main.py `_gord`, 4699-4704) ---------- */

const VAZIO_SET = new Set();
const VAZIO_MAP = new Map();

/**
 * CAMADA 1 — `_aplica_prioridade_citatti_linha99` (main.py:4706).
 * Na linha 99 o Citatti é a fonte principal das DUAS pontas. A 99 costuma ser a
 * primeira viagem, antes da tabela regular: bilhetagem e SST podem começar depois
 * dela, e usá-los como média colocava o almoço da própria 99 antes da entrada do
 * cartão.
 *
 * @param g      linha crua da `ponto_gordura`
 * @param com99  Set de `chaveDe(cracha, dia)` vindo da `ponto_linha99`
 */
export function camadaLinha99(g, com99) {
  const chaves = com99 || VAZIO_SET;
  if (!chaves.has(chaveDe(g.cracha, g.data_ref))) return g;
  const out = { ...g };
  const oi = hm2m(g.op_inicio);
  const of = hm2m(g.op_fim);
  if (oi != null) {
    out.real_inicio_sem_linha99 = txt(g.real_inicio);
    out.real_inicio = m2hm(oi);
  }
  if (of != null) {
    out.real_fim_sem_linha99 = txt(g.real_fim);
    out.real_fim = m2hm(of);
  }
  out.prioridade_citatti_linha99 = true;
  out.fonte_operacao = "Citatti · linha 99";
  return out;
}

/**
 * CAMADA 2 — `_aplica_reserva` (main.py:4844-4885): RESERVA LANÇADA PELO GESTOR.
 * Quem estava de reserva estava À DISPOSIÇÃO desde a hora lançada; a espera até
 * assumir a tabela NÃO é gordura. Então a operação real vale a UNIÃO
 * reserva ∪ operação: início = min(entrada da reserva, real) e fim = max(saída da
 * reserva, real). Medido no original: 31 de 55 dias com reserva cobravam
 * indevidamente (62,5 h). Os valores antigos ficam em `*_sem_reserva` para não
 * perder o rastro do que mudou.
 *
 * A reserva mora na base do PRÓPRIO INOVE (`reservas_motoristas`), não na base de
 * importação — por isso quem lê é a tela, com o cliente Supabase normal, e entrega
 * aqui um Map já indexado.
 *
 * @param g         linha da gordura (já com a camada 1)
 * @param reservas  Map `chaveDe(cracha, dia)` -> { hora_entrada, hora_saida, cobertura }
 */
export function camadaReservaInove(g, reservas) {
  const r = (reservas || VAZIO_MAP).get(chaveDe(g.cracha, g.data_ref));
  if (!r) return g;

  // AMBIGUIDADE (também do original): min/max são no relógio cru, sem `variante`. A
  // reserva vem de um formulário e é sempre 00:00-23:59, enquanto `real_fim` pode passar
  // das 24h ("26:08") no turno que cruza a meia-noite. Nesse caso o max já escolhe o
  // real, que é o certo; mas uma reserva lançada de madrugada num turno virado pode não
  // casar de volta. main.py:4863-4866 tem exatamente a mesma limitação — não inventei
  // correção aqui para não divergir do número que o DP já conhece.
  const rem = hm2m(r.hora_entrada); // reserva: entrada lançada
  const rsm = hm2m(r.hora_saida); // reserva: saída lançada
  const oi = hm2m(g.real_inicio);
  const of = hm2m(g.real_fim);
  const inicios = [rem, oi].filter((v) => v != null);
  const fins = [rsm, of].filter((v) => v != null);
  const ni = inicios.length ? Math.min(...inicios) : null;
  const nf = fins.length ? Math.max(...fins) : null;
  const pe = hm2m(g.tn_entrada);
  const ps = hm2m(g.tn_saida);

  const out = { ...g };
  // Marca SEMPRE que existe lançamento, mesmo quando nenhuma ponta muda: é esta flag
  // que faz `camadaReservaGps` sair do caminho (main.py:4868 lendo em 4901).
  out.tem_reserva_inove = true;
  out.reserva_inove_entrada = fmtHora(r.hora_entrada);
  out.reserva_inove_saida = fmtHora(r.hora_saida);
  out.reserva_inove_cobertura = txt(r.cobertura);

  if (ni != null && ni !== oi) {
    out.real_inicio_sem_reserva = txt(g.real_inicio);
    out.gordura_entrada_sem_reserva = txt(g.gordura_entrada);
    out.nivel_entrada_sem_reserva = txt(g.nivel_entrada);
    out.real_inicio = m2hm(ni);
    if (pe != null) {
      const ge = Math.round((ni - pe) * 10) / 10;
      out.gordura_entrada = String(ge);
      // main.py:4876 — 10 min, ver AMBIGUIDADE em TOL_RESERVA_INOVE.
      out.nivel_entrada =
        Math.abs(ge) <= TOL_RESERVA_INOVE ? "TOLERANCIA_OPERACIONAL" : txt(g.nivel_entrada);
    }
  }
  if (nf != null && nf !== of) {
    out.real_fim_sem_reserva = txt(g.real_fim);
    out.gordura_saida_sem_reserva = txt(g.gordura_saida);
    out.nivel_saida_sem_reserva = txt(g.nivel_saida);
    out.real_fim = m2hm(nf);
    if (ps != null) {
      const gs = Math.round((ps - nf) * 10) / 10;
      out.gordura_saida = String(gs);
      // main.py:4884 — também 10 aqui, e NÃO TOL_SAIDA (8). Inconsistência do original.
      out.nivel_saida =
        Math.abs(gs) <= TOL_RESERVA_INOVE ? "TOLERANCIA_OPERACIONAL" : txt(g.nivel_saida);
    }
  }
  return out;
}

/**
 * CAMADA 3 — `_aplica_reserva_gps` (main.py:4899): reserva SEM lançamento,
 * detectada pelo próprio dado. Na reserva o motorista está à disposição mas não
 * vende passagem: a bilhetagem só começa quando ele assume uma tabela, e o tempo de
 * espera sumia da jornada. A assinatura é GPS concordando com a ESCALA e a
 * bilhetagem aparecendo bem depois (AGNALDO: escala 01:30, GPS 01:34, bilhetagem
 * 03:01 — perdia 87 min TODO DIA; medido: 96 dias, 109,8 h).
 * Só age quando ninguém lançou a reserva — o documento do gestor manda.
 */
export function camadaReservaGps(g) {
  if (ehVerdade(g.tem_reserva_inove)) return g; // o lançamento do gestor já mandou
  const e = hm2m(g.esc_inicio);
  const o = hm2m(g.op_inicio);
  const v = hm2m(g.val_inicio);
  const r = hm2m(g.real_inicio);
  if ([e, o, v, r].some((x) => x == null)) return g;
  const assinatura =
    Math.abs(o - e) <= RES_GPS_ESCALA && v - o >= RES_GPS_BILH && Math.abs(r - v) <= 2;
  if (!assinatura) return g; // sem a assinatura, ou o real já não é a bilhetagem
  const out = { ...g };
  out.real_inicio_sem_reserva = txt(g.real_inicio);
  out.gordura_entrada_sem_reserva = txt(g.gordura_entrada);
  out.nivel_entrada_sem_reserva = txt(g.nivel_entrada);
  out.reserva_por_gps = true;
  out.real_inicio = m2hm(o);
  const pe = hm2m(g.tn_entrada);
  if (pe != null) {
    const ge = Math.round((o - pe) * 10) / 10;
    out.gordura_entrada = String(ge);
    // main.py:4923 — 10 nas duas pontas aqui também (ver TOL_RESERVA_INOVE).
    out.nivel_entrada = Math.abs(ge) <= 10 ? "TOLERANCIA_OPERACIONAL" : txt(g.nivel_entrada);
  }
  return out;
}

/**
 * CAMADA 4 — `_aplica_alvo` (main.py:4753): ALVO DA CORREÇÃO = real ∓ tolerância,
 * e QUEM APURA A OPERAÇÃO É A REVISÃO (decisão do DP, 03-04/09/2026): o alvo
 * publicado em `ponto_diario` manda. A gordura exibida e filtrada é a diferença
 * PONTO × ALVO, não PONTO × operação bruta — senão o motorista é COBRADO contra um
 * horário e AVISADO com outro (FRANCISCO 3202768 01/09: alvo 03:30 na gordura e
 * 03:26 na Revisão, e a tela cobrava 18 min contra um alvo que o aviso nunca
 * pediu). A conta local abaixo só alcança o dia que a Revisão não apurou.
 *
 * É a ÚLTIMA palavra sobre `gordura_entrada`/`gordura_saida` e sobre quem cai em
 * TOLERANCIA_OPERACIONAL / OPERACAO_FORA_PONTO — por isso é a última camada.
 *
 * @param g   linha da gordura (já com as camadas 1-3)
 * @param pd  linha da `ponto_diario` do mesmo crachá|dia (`{}` quando não houver)
 */
export function camadaAlvo(g, pd) {
  const p = pd || {};
  const out = { ...g };
  // O ALVO PUBLICADO, NÃO A REFERÊNCIA (main.py:4776-4785): `alvo_entrada_ref` é a
  // régua interna da view; `alvo_entrada` é o alvo que a Revisão PUBLICA. A régua
  // tem que ser uma só até no número exibido.
  const revE = fmtHora(p.alvo_entrada || p.alvo_entrada_ref);
  const revS = fmtHora(p.alvo_saida || p.alvo_saida_ref);
  const ri = hm2m(g.real_inicio);
  const rf = hm2m(g.real_fim);
  const pe = hm2m(g.tn_entrada);
  const ps = hm2m(g.tn_saida);

  if (hm2m(revE) != null) {
    out.alvo_entrada = revE;
    out.fonte_alvo_gordura = "revisao";
  } else if (ri != null) {
    let alvoEntrada = Math.max(0, ri - TOL_ENTRADA);
    // Encaixe na escala com a MESMA régua da Revisão: ela olha a BATIDA, com janela
    // de 30 min — bateu perto da escala, vale o maior entre os dois (a escala já vem
    // com tolerância; não se aplica tolerância sobre tolerância).
    const esc = hm2m(g.esc_inicio || g.esc_entrada);
    if (esc != null && pe != null && difRelogio(pe, esc) <= 30) alvoEntrada = Math.max(pe, esc);
    out.alvo_entrada = m2hm(alvoEntrada);
    out.fonte_alvo_gordura = "gordura";
  }
  if (hm2m(revS) != null) {
    out.alvo_saida = revS;
    out.fonte_alvo_gordura = "revisao";
  } else if (rf != null) {
    out.alvo_saida = m2hm(rf + TOL_SAIDA);
    if (!out.fonte_alvo_gordura) out.fonte_alvo_gordura = "gordura";
  }

  const ae = hm2m(out.alvo_entrada);
  const af = hm2m(out.alvo_saida);
  if (pe != null && ae != null) {
    // `00:42` depois de uma saída `24:53` é 24:42, não 00:42 do início do dia:
    // alinha a ponta do alvo à mesma volta do relógio do cartão antes de subtrair.
    const ge = Math.round((variante(ae, pe) - pe) * 10) / 10;
    out.gordura_entrada = String(ge);
    if (Math.abs(ge) <= TOL_ENTRADA) out.nivel_entrada = "TOLERANCIA_OPERACIONAL";
    else if (ge < 0) out.nivel_entrada = "OPERACAO_FORA_PONTO";
  }
  if (ps != null && af != null) {
    const gs = Math.round((ps - variante(af, ps)) * 10) / 10;
    out.gordura_saida = String(gs);
    if (Math.abs(gs) <= TOL_SAIDA) out.nivel_saida = "TOLERANCIA_OPERACIONAL";
    else if (gs < 0) out.nivel_saida = "OPERACAO_FORA_PONTO";
  }
  return out;
}

/**
 * AS QUATRO CAMADAS, NA ORDEM DO `_gord()` (main.py:4699-4704).
 * É o único ponto de entrada que as telas deveriam usar: a ordem é regra, não
 * detalhe de implementação (a reserva por GPS só age quando NÃO há lançamento do
 * gestor, e o alvo é sempre a última palavra sobre a gordura).
 *
 * @param bruta        linha crua da `ponto_gordura`
 * @param com99        Set de `chaveDe` da `ponto_linha99` (opcional)
 * @param reservas     Map de `chaveDe` -> reserva do INOVE (opcional)
 * @param pontoDiario  linha da `ponto_diario` do mesmo crachá|dia (opcional)
 */
export function aplicarCamadasGordura(bruta, { com99, reservas, pontoDiario } = {}) {
  return camadaAlvo(
    camadaReservaGps(camadaReservaInove(camadaLinha99(bruta, com99), reservas)),
    pontoDiario,
  );
}
