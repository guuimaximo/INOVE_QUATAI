// regrasPonto.js — MOTOR DE REGRAS DO PONTO (simulador do cartão + veredito)
// Porte 1:1 do Python do projeto PONTO para JS puro. SEM React, SEM rede, SEM Supabase.
// Entrada = objetos/arrays JS · saída = objetos/arrays JS. Determinístico e testável.
//
// FONTES DA VERDADE (todo comentário abaixo cita arquivo:linha da origem):
//   ferramenta/simulador.py  — hm2min, min2hm, var, acha, encaixa, limpa_fantasmas,
//                              cartao_utilizavel, _resolve_ampm, simula, almoco_da_refeicao
//   app/main.py              — _dif_relogio, _ordena_pontas, _slot_da_ponta, _realoca_dia,
//                              _julga_acoes, _resumo_acoes, _ref_ponta, _julga_ref,
//                              _almoco_matriz, constantes
//
// CONVENÇÃO DE HORÁRIO (simulador.py:7-8): o cartão usa notação >24h pra preservar a virada
// de dia (26:08 = 02:08 do dia seguinte). Tudo aqui trabalha em MINUTOS desde 00:00.
//
// Nenhuma função usa Date — não há data local envolvida, só minutos. (Regra do projeto:
// jamais `new Date().toISOString()` pra data local.)

/* ─────────────────────────────── CONSTANTES ─────────────────────────────── */

// main.py:117 — minutos ANTES do início da operação (o motorista bate e ainda ANDA até o carro)
const TOL_ENTRADA_MIN = 10;
// main.py:118 — minutos DEPOIS do fim da operação (estaciona, confere e volta ao relógio)
const TOL_SAIDA_MIN = 8;
// main.py:5517 — o que ele pediu "bate" com o alvo se estiver a até isso
const TOL_AJUSTE_MIN = 10;
// main.py:6166 — teto do "pediu menos"; acima disso não é escolha dele, é ponta/dia errado
const TOL_MENOS_MIN = 60;
// simulador.py:58 — o app manda o horário com ~1 min de diferença do cartão; 5 cobre a folga
const TOL_CASA = 5;
// simulador.py:99 — duas batidas a <=6 min são o MESMO evento (bug do coletor)
const TOL_FANTASMA = 6;
// main.py:6454 — tolerância do casamento batida×cartão na realocação de dia
const TOL_REALOCA_DIA = 5;
// simulador.py:332 — piso do intervalo: abaixo disso o Citatti pegou parada curta, não refeição
const MIN_ALMOCO = 27;
// main.py:121 / main.py:4587 — teto do miolo: acima disso o par do meio não é refeição
const MAX_ALMOCO_MIN = 120;
// main.py:7882 — margem de concordância entre fontes (CANON 6.5)
const DELTA_FONTE = 20;
// simulador.py:62 — o Cartão de Ponto do Transnet tem 4 campos por dia
const MAX_BATIDAS = 4;
// simulador.py:327 — jornada abaixo disso não exige intervalo
const JORNADA_EXIGE_ALMOCO = 360;
// main.py:2745 — SUG_JORNADA_MAX_MIN = 13*60; acima disso não é jornada, é defeito
const SUG_JORNADA_MAX_MIN = 780;
// main.py:6007 — ALM_FAIXAS da matriz da Revisão (quem OPEROU)
const ALM_FAIXAS = [[360, 30], [240, 15]];
// main.py:7140 — mesma matriz pra PONTO_SEM_OPERACAO: 60 min acima de 6h em vez de 30
const ALM_FAIXAS_SEM_OPERACAO = [[360, 60], [240, 15]];
// simulador.py:166 — fração de cartões utilizáveis pra considerar o dia consolidado
const FRACAO_CONSOLIDADO = 0.80;
// main.py:6168 — sinal que significa "trabalha MENOS" em cada ponta
const LADO_MENOS = { Entrada: +1, 'Saída': -1, 'Saída almoço': -1, 'Volta almoço': +1 };

// Rótulos das pontas, exatamente como o Python os escreve (com acento) — as chaves de
// LADO_MENOS, de `mira` e de `_slot_da_ponta` dependem desse texto.
const PONTA_ENTRADA = 'Entrada';
const PONTA_SAIDA = 'Saída';
const PONTA_ALM_SAIDA = 'Saída almoço';
const PONTA_ALM_VOLTA = 'Volta almoço';

/* ───────────────────────── PRIMITIVAS DE HORÁRIO ───────────────────────── */

const RE_HM = /\d{1,2}:\d{2}/g;              // simulador.py:12 (_RE_HM)
const RE_HM_UM = /\d{1,2}:\d{2}/;

/**
 * simulador.py:15 (hm2min) — '26:08' -> 1568; '02:08' -> 128; '0440' -> 280
 * (a tela do Cartão de Ponto devolve o valor cru, sem dois-pontos). Vazio/inválido -> null.
 * Aceita >24h de propósito: 25:43 -> 1543.
 */
export function hm2min(s) {
  const txt = String(s === null || s === undefined ? '' : s).trim();
  if (!txt) return null;
  let h;
  let m;
  if (txt.includes(':')) {
    const p = txt.split(':');
    h = p[0];
    m = p[1];
  } else {
    const d = txt.replace(/\D/g, '');
    if (d.length < 3) return null;           // simulador.py:26-27
    h = d.slice(0, -2);
    m = d.slice(-2);
  }
  h = String(h === undefined ? '' : h).trim();
  m = String(m === undefined ? '' : m).trim();
  // Python usa int(): só aceita inteiro puro. '1a' -> ValueError -> None.
  if (!/^[+-]?\d+$/.test(h) || !/^[+-]?\d+$/.test(m)) return null;
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

/**
 * simulador.py:34 (min2hm) — 860 -> '14:20'; 1568 -> '26:08' (preserva a virada de dia).
 * Horário negativo NÃO existe: devolve vazio em vez de imprimir '-10:35'.
 * Trunca antes de dividir, igual ao `int(m)//60` do Python (452.5 -> '07:32').
 */
export function min2hm(m) {
  if (m === null || m === undefined || Number.isNaN(m) || m < 0) return '';
  const i = Math.trunc(m);
  const hh = String(Math.trunc(i / 60)).padStart(2, '0');
  const mm = String(i % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Normaliza um valor "hora" pra minutos. Número finito passa direto (já é minuto);
 * string vai pro hm2min. Não existe no Python — lá tudo entra como string. Existe aqui
 * pra você conseguir alimentar as funções direto com minutos nos testes.
 */
export function paraMinutos(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return hm2min(v);
}

/**
 * simulador.py:43 (tempos_do_ajuste) — extrai os HH:MM de um 'horario_ajuste' do Transnet.
 * '04:45' -> [285]; 'D/ 11:13 P/ 04:30' -> [673, 270].
 */
export function temposDoAjuste(s) {
  const achados = String(s === null || s === undefined ? '' : s).match(RE_HM) || [];
  return achados.map(hm2min);
}

/**
 * simulador.py:49 (var) — variante de t (t-24h, t, t+24h) mais perto de ref. É o que faz
 * 02:08 casar com a batida 26:08 do cartão em vez de virar 02:08 na madrugada errada.
 * Empate: o Python `min` fica com o PRIMEIRO da tupla (t-1440) — preservado.
 */
export function varHora(t, ref) {
  const cands = [t - 1440, t, t + 1440];
  let melhor = cands[0];
  let d = Math.abs(cands[0] - ref);
  for (let k = 1; k < cands.length; k += 1) {
    const dk = Math.abs(cands[k] - ref);
    if (dk < d) { d = dk; melhor = cands[k]; }
  }
  return melhor;
}

/**
 * main.py:6439 (_dif_relogio) — minutos entre dois horários no relógio, sempre 0..720.
 * Aguenta a notação 24+ (25:14 = 1514) porque reduz módulo 1440 ANTES de dobrar pelo
 * caminho mais curto. O jeito antigo (min(d, 1440-d) sem o módulo) devolvia NEGATIVO com
 * d > 1440 e "-14 <= 10" dava BATE numa diferença de 14 min (caso RONALDO, main.py:6603-6607).
 */
export function difRelogio(a, b) {
  const d = Math.abs(Math.trunc(a) - Math.trunc(b)) % 1440;
  return Math.min(d, 1440 - d);
}

/**
 * simulador.py:102 (_desenrola) / simulador.py:300 (canon) — desenrola a virada de dia:
 * batida menor que a anterior ganha +24h (00:01 depois de 13:30 vira 24:01).
 * NÃO ordena: a ordem do cartão já é cronológica, e ordenar quebraria o par que a virada
 * desloca. Aceita array de minutos, de 'HH:MM' ou a string 'HH:MM,HH:MM,...'.
 */
export function desenrola(batidas) {
  const lista = Array.isArray(batidas)
    ? batidas
    : String(batidas === null || batidas === undefined ? '' : batidas).split(',');
  const out = [];
  for (const x of lista) {
    let t = paraMinutos(x);
    if (t === null || t === undefined) continue;
    while (out.length && t < out[out.length - 1]) t += 1440;
    out.push(t);
  }
  return out;
}

/**
 * main.py:7731 (_batidas_de) + main.py:6456 (_b de _realoca_dia) — batidas do cartão em
 * minutos, a partir do que o lake entrega. Aceita:
 *   - array de minutos / 'HH:MM'
 *   - string 'E13:36 | S18:27 | E19:14 | S23:02'  (todas_batidas — o que a tela do Transnet mostra)
 *   - string '13:36,18:27'
 *   - objeto do ponto_diario ({todas_batidas} tem prioridade; `batidas_limpas` NÃO serve
 *     sozinho: ele descarta a entrada em ~400 dias — main.py:7734)
 * NÃO desenrola e NÃO ordena: devolve na ordem em que veio, igual ao Python.
 */
export function batidasDoCartao(fonte) {
  if (fonte === null || fonte === undefined) return [];
  if (Array.isArray(fonte)) {
    return fonte.map(paraMinutos).filter((v) => v !== null && v !== undefined);
  }
  let txt;
  if (typeof fonte === 'object') {
    txt = String(fonte.todas_batidas || fonte.todasBatidas || '').trim()
      || String(fonte.batidas_limpas || fonte.batidasLimpas || '').trim();
  } else {
    txt = String(fonte).trim();
  }
  if (!txt) return [];
  return txt
    .split(/[|,]/)
    .map((x) => x.trim().replace(/^[ES]+/, '').trim())   // lstrip("ES") do Python
    .filter(Boolean)
    .map(hm2min)
    .filter((v) => v !== null && v !== undefined);
}

/** simulador.py:384 (texto_batidas) — [886,1274] -> '14:46,21:14'. */
export function textoBatidas(mins) {
  return (mins || []).map(min2hm).join(',');
}

/* ══════════════════════ 1. difRelogio ══════════════════════ (acima) */

/* ══════════════════════ 2. ordenaPontas ══════════════════════ */

/**
 * main.py:174 (_ordena_pontas) — ordena pela SEQUÊNCIA DA JORNADA, não pela hora do relógio:
 * turno que cruza meia-noite tem a madrugada no FIM. Rotaciona pelo MAIOR intervalo
 * (o descanso noturno). Itens sem horário vão pro fim, na ordem original.
 *
 * Aceita array de minutos, de 'HH:MM' ou de objetos {m}. Devolve os MESMOS itens reordenados
 * (não converte o que você passou), pra você conseguir carregar metadado junto.
 */
export function ordenaPontas(batidas) {
  const itens = (batidas || []).map((x) => ({
    orig: x,
    m: (x && typeof x === 'object' && !Array.isArray(x)) ? paraMinutos(x.m) : paraMinutos(x),
  }));
  const wm = itens.filter((x) => x.m !== null && x.m !== undefined);
  const sem = itens.filter((x) => x.m === null || x.m === undefined);
  if (wm.length <= 1) return wm.concat(sem).map((x) => x.orig);
  wm.sort((a, b) => a.m - b.m);                       // sort estável, igual ao Python
  const n = wm.length;
  let gmax = -1;
  let cut = 0;
  for (let k = 0; k < n; k += 1) {
    const cur = wm[k].m;
    const nxt = (k + 1 < n) ? wm[k + 1].m : wm[0].m + 1440;   // fecha o ciclo de 24h
    if (nxt - cur > gmax) { gmax = nxt - cur; cut = (k + 1) % n; }
  }
  return wm.slice(cut).concat(wm.slice(0, cut)).concat(sem).map((x) => x.orig);
}

/* ══════════════════════ 3. removeFantasmas ══════════════════════ */

/**
 * simulador.py:112 (limpa_fantasmas) — colapsa batida duplicada em sequência (<= 6 min).
 * Duas batidas quase coladas (13:02 e 13:04) são o MESMO evento registrado duas vezes —
 * bug do coletor. Fica a ÚLTIMA: é a confirmação mais recente (simulador.py:97).
 * Devolve { limpas, fora } — sem isso, um cartão de 4 campos que na verdade tem 3 batidas
 * reais estoura o limite quando o motorista pede inserção.
 *
 * ATENÇÃO: o Python compara `t - lim[-1] <= 6` SEM valor absoluto, então a lista PRECISA
 * chegar cronológica (desenrolada). No Python isso é garantido pelo chamador —
 * `simula` faz `limpa_fantasmas(_desenrola(antes))` (simulador.py:242). Aqui o default é
 * desenrolar; passe {desenrolar:false} pra reproduzir a chamada crua.
 */
export function removeFantasmas(batidas, { desenrolar = true } = {}) {
  const base = desenrolar
    ? desenrola(batidas)
    : (batidas || []).map(paraMinutos).filter((v) => v !== null && v !== undefined);
  const limpas = [];
  const fora = [];
  for (const t of base) {
    if (limpas.length && (t - limpas[limpas.length - 1]) <= TOL_FANTASMA) {
      fora.push(limpas[limpas.length - 1]);   // a anterior vira fantasma
      limpas[limpas.length - 1] = t;          // preserva a última/maior do grupo
      continue;
    }
    limpas.push(t);
  }
  return { limpas, fora };
}

/* ══════════════════════ 4. almocoDaRefeicao ══════════════════════ */

// float(v) do Python: None/''/lixo -> None (exceção). Number('') === 0 em JS, então filtra antes.
function _num(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * simulador.py:335 (almoco_da_refeicao) — intervalo de refeição de UM dia, a partir da
 * linha do `ponto_intervalo`. A REGRA DOS 27 MIN:
 *   CITATTI é a fonte principal; se o intervalo dele vier abaixo de 27 min, cai pro SST —
 *   não é arredondamento, são janelas diferentes (o Citatti às vezes marca uma parada de
 *   16 min e o SST mostra a refeição de 46 min horas depois: 1.154 dias com Citatti curto,
 *   236 deles com o SST mostrando o intervalo real — simulador.py:330-331).
 * Escada: Citatti>=27 → SST>=27 → Citatti curto (visível de propósito) → nada.
 *
 * Devolve { inicio, fim, duracaoMin, origem, detalhe, origemTexto }.
 *   origem: 'Citatti' | 'SST' | '' (origem vazia = sem intervalo utilizável)
 *   detalhe: a parte explicativa que o Python concatena na origem
 *   origemTexto: a string EXATA que o Python devolve como `origem`, pra bater com o histórico
 *
 * AMBIGUIDADE: o Python monta o rótulo com `round(cd)` — arredondamento bancário
 * (round(0.5) -> 0, round(1.5) -> 2). O JS Math.round arredonda 0.5 sempre pra cima.
 * Só afeta o TEXTO quando a duração vem fracionária (na base ela é inteira). Não afeta
 * nenhuma decisão — a comparação usa `cd`/`sd` crus.
 */
export function almocoDaRefeicao(linhaIntervalo) {
  const iv = linhaIntervalo || {};
  const ci = iv.sugestao_inicio;
  const cf = iv.sugestao_fim;
  const cd = _num(iv.sugestao_duracao_min);
  const si = iv.sugestao_sst_inicio;
  const sf = iv.sugestao_sst_fim;
  const sd = _num(iv.sugestao_sst_duracao_min);

  if (cd !== null && cd >= MIN_ALMOCO) {
    return {
      inicio: ci, fim: cf, duracaoMin: cd, origem: 'Citatti', detalhe: '', origemTexto: 'Citatti',
    };
  }
  if (sd !== null && sd >= MIN_ALMOCO) {
    const det = cd !== null ? `Citatti ${Math.round(cd)}min < ${MIN_ALMOCO}` : '';
    return {
      inicio: si,
      fim: sf,
      duracaoMin: sd,
      origem: 'SST',
      detalhe: det,
      origemTexto: `SST${det ? ` (${det})` : ''}`,
    };
  }
  // nenhuma das duas alcança o piso: devolve a do Citatti pra ficar visível que é curta
  if (cd !== null) {
    const det = `${Math.round(cd)}min — abaixo de ${MIN_ALMOCO}`;
    return {
      inicio: ci, fim: cf, duracaoMin: cd, origem: 'Citatti', detalhe: det, origemTexto: `Citatti ${det}`,
    };
  }
  return {
    inicio: '', fim: '', duracaoMin: null, origem: '', detalhe: '', origemTexto: '',
  };
}

/* ══════════════════════ 5. almocoMatriz ══════════════════════ */

/**
 * Minutos de jornada entre duas pontas, desenrolando a virada (main.py:6026-6028).
 */
export function jornadaEntreMin(ent, sai) {
  const a = paraMinutos(ent);
  let b = paraMinutos(sai);
  if (a === null || b === null || a === undefined || b === undefined) return null;
  while (b < a) b += 1440;
  return b - a;
}

/**
 * main.py:6009 (_almoco_matriz) + main.py:7140 (_sug_sem_op) — A MATRIZ DA REVISÃO:
 * quanto de almoço a jornada exige.
 *   < 240 min  -> 0   (abaixo de 4h não insere)
 *   240..359   -> 15
 *   >= 360     -> 30  se OPEROU · 60 se NÃO operou (PONTO_SEM_OPERACAO)
 * Aplicada ao cartão CORRIGIDO, não ao batido: a view calcula o almoço em cima do cartão
 * como ele está hoje, e em dia quebrado isso dá jornada de 1 minuto -> nenhum almoço
 * (caso LUCAS 20/08, main.py:6013-6016).
 *
 * AMBIGUIDADE (duas fontes, dois eixos diferentes):
 *  · O Python de main.py:6021 zera a matriz por CATEGORIA (`categoria != 'MOTORISTA' -> 0`,
 *    "interno/aprendiz seguem o alvo de 60 min da view 4"), não por "operou".
 *  · O 60 de "não operou" vem de outro lugar: main.py:7140, o ramo PONTO_SEM_OPERACAO, que
 *    só roda pra MOTORISTA e usa `dur = 60 if (pn-p1) >= 360 else 15`.
 *  Ou seja: no Python `operou` e `categoria` são gates SEPARADOS e nenhuma função única
 *  combina os dois. Aqui `operou` é o eixo pedido; o gate de categoria fica em
 *  `almocoMatrizPorCategoria`, que é o porte literal de _almoco_matriz.
 */
export function almocoMatriz(jornadaMin, operou = true) {
  if (jornadaMin === null || jornadaMin === undefined || Number.isNaN(jornadaMin)) return 0;
  const faixas = operou ? ALM_FAIXAS : ALM_FAIXAS_SEM_OPERACAO;
  for (const [minimo, dur] of faixas) {
    if (jornadaMin >= minimo) return dur;
  }
  return 0;
}

/**
 * main.py:6009 (_almoco_matriz) LITERAL — inclusive o gate de categoria.
 * Só motorista: interno/aprendiz seguem o alvo de 60 min da view 4 (main.py:6018).
 */
export function almocoMatrizPorCategoria(ent, sai, categoria) {
  if (String(categoria || '').toUpperCase() !== 'MOTORISTA') return 0;
  return almocoMatriz(jornadaEntreMin(ent, sai), true);
}

/**
 * main.py:4587 — TETO DO MIOLO. O par do meio só é refeição se durar <= 120 min
 * (MAX_ALMOCO_MIN). "O dia que estoura o teto não vira 30 calado: cai para a próxima
 * fonte e, se nem ela tiver base, o dia sai sem sugestão em vez de com um número inventado."
 * Devolve null quando não dá pra medir.
 */
export function mioloEhRefeicao(inicio, fim) {
  const dur = jornadaEntreMin(inicio, fim);
  if (dur === null) return null;
  if (dur <= 0) return false;                 // main.py:4580-4581 (b <= a -> descarta)
  return dur <= MAX_ALMOCO_MIN;
}

/**
 * simulador.py:362 (jornada) — (liquida, almoco) a partir das batidas já desenroladas.
 * 4 batidas = entrada, saída do almoço, volta, saída -> desconta o intervalo.
 * 2 batidas = entrada e saída, sem intervalo. Outras quantidades: só o span.
 */
export function jornadaDoCartao(mins) {
  const b = (mins || []).map(paraMinutos).filter((x) => x !== null && x !== undefined);
  if (b.length < 2) return { liquida: null, almoco: null };
  const span = b[b.length - 1] - b[0];
  if (b.length === 4) {
    const alm = b[2] - b[1];
    return { liquida: span - alm, almoco: alm };
  }
  return { liquida: span, almoco: null };
}

/** simulador.py:377 (falta_almoco) — jornada passa de 6h e o cartão não tem intervalo? */
export function faltaAlmoco(mins) {
  const { liquida, almoco } = jornadaDoCartao(mins);
  return liquida !== null && almoco === null && liquida > JORNADA_EXIGE_ALMOCO;
}

/* ══════════════════════ 6. simulaCartao ══════════════════════ */

/**
 * simulador.py:65 (acha) — índice da batida que o motorista quis mexer.
 * Empate na distância: o Python `min` sobre a tupla (d, n) fica com o MENOR índice.
 */
export function acha(bat, t, tol = TOL_CASA) {
  if (!bat || !bat.length) return null;
  let melhorD = Infinity;
  let melhorI = null;
  for (let n = 0; n < bat.length; n += 1) {
    const p = bat[n];
    const d = Math.abs(varHora(t, p) - p);
    if (d < melhorD) { melhorD = d; melhorI = n; }
  }
  return melhorD <= tol ? melhorI : null;
}

/**
 * simulador.py:73 (encaixa) — a batida inserida entra na ORDEM cronológica do dia de
 * trabalho. Encaixa pela distância à JANELA das batidas existentes, não à primeira delas:
 * entrada esquecida entra ANTES (04:05 num dia que começa 07:32) e saída esquecida entra
 * DEPOIS (00:30 num dia que começa 13:58 vira 24:30).
 * Sem cartão, a âncora é a ESCALA. Sem escala também, fica o horário como veio.
 * A variante t-1440 só entra se continuar sendo um horário que EXISTE (piso de zero):
 * sem ele, inserir 14:35 ancorado em 01:40 virava -10:35 (simulador.py:82-83).
 * Empate: o Python `min` fica com o primeiro da ordem (t-1440, t, t+1440).
 */
export function encaixa(bat, t, refs = null) {
  const janela = (bat && bat.length)
    ? bat
    : (refs || []).filter((r) => r !== null && r !== undefined);
  if (!janela.length) return t;
  const lo = Math.min(...janela);
  const hi = Math.max(...janela);
  const dist = (v) => {
    if (v >= lo && v <= hi) return 0;
    return v < lo ? lo - v : v - hi;
  };
  const cands = [t - 1440, t, t + 1440].filter((v) => v >= 0);
  if (!cands.length) return t;                 // default=t do Python
  let melhor = cands[0];
  let dm = dist(cands[0]);
  for (let k = 1; k < cands.length; k += 1) {
    const dk = dist(cands[k]);
    if (dk < dm) { dm = dk; melhor = cands[k]; }
  }
  return melhor;
}

/**
 * simulador.py:131 (cartao_utilizavel) — o cartão serve de base pra simular o ajuste?
 * Precisa de pelo menos 2 batidas REAIS (já sem fantasma): menos que isso costuma
 * significar que o ponto do dia ainda não fechou (17/07: 173 de 363 pessoas com duas
 * batidas a 1 minuto — o coletor falhou).
 * EXCEÇÃO: dia JÁ fechado + nenhuma batida (SEM_PONTO) + só INSERÇÕES = a inserção É o
 * ponto que ela está criando do zero, e o 'depois' é legítimo.
 */
export function cartaoUtilizavel(batLimpas, cartaoFechado = false, soInsercoes = false) {
  const n = (batLimpas || []).length;
  if (n >= 2) return { ok: true, motivo: '' };
  if (cartaoFechado && soInsercoes && n === 0) return { ok: true, motivo: '' };
  if (cartaoFechado) return { ok: false, motivo: 'não bateu ponto no dia — nada a conferir' };
  if (n === 0) return { ok: false, motivo: 'sem cartão de ponto — aguardando o dia fechar' };
  return { ok: false, motivo: 'cartão com 1 batida só — ponto do dia ainda não fechou' };
}

// texto do 'ajuste' de um pedido: aceita os nomes que o lake usa em cada tabela
function _txtAjuste(o) {
  if (!o) return '';
  const v = o.ajuste !== undefined && o.ajuste !== null && String(o.ajuste).trim()
    ? o.ajuste
    : (o.hora !== undefined && o.hora !== null && String(o.hora).trim() ? o.hora : o.horario_ajuste);
  return String(v === null || v === undefined ? '' : v);
}

function _tipo(o) {
  return String((o && o.tipo) || '').toLowerCase();
}

/**
 * simulador.py:192 (_resolve_ampm) — duas INSERÇÕES a exatamente 12h uma da outra são o
 * mesmo pedido digitado errado (confundiu AM/PM, abriu a ocorrência, viu o erro e abriu
 * outra). Só resolve quando UMA das duas encosta numa referência (escala/operação) e a
 * outra não. Se as duas encostam, ou nenhuma, devolve as duas e deixa a nota falar:
 * 12h de diferença também é uma jornada legítima (06:00/18:00), e chutar aqui mexe no
 * pagamento de alguém (simulador.py:198-200).
 */
export function resolveAmPm(ocorrs, refs, tol = 10) {
  const lista = ocorrs || [];
  const ins = [];
  lista.forEach((o, i) => { if (_tipo(o).startsWith('inser')) ins.push([i, o]); });
  const rs = (refs || []).filter((r) => r !== null && r !== undefined);
  if (ins.length < 2 || !rs.length) return { pedidos: lista, notas: [] };

  const encosta = (t) => rs.some(
    (r) => Math.min(...[t - 1440, t, t + 1440].map((v) => Math.abs(v - r))) <= tol,
  );

  const fora = new Set();
  const notas = [];
  for (let a = 0; a < ins.length; a += 1) {
    for (let b = a + 1; b < ins.length; b += 1) {
      const [ia, oa] = ins[a];
      const [ib, ob] = ins[b];
      const ta = temposDoAjuste(_txtAjuste(oa));
      const tb = temposDoAjuste(_txtAjuste(ob));
      if (!ta.length || !tb.length || fora.has(ia) || fora.has(ib)) continue;
      if (Math.abs(ta[0] - tb[0]) !== 720) continue;          // 12h exatas
      const ea = encosta(ta[0]);
      const eb = encosta(tb[0]);
      if (ea && !eb) {
        fora.add(ib);
        notas.push(`AM/PM: ${min2hm(tb[0])} descartado, ${min2hm(ta[0])} bate com a escala`);
      } else if (eb && !ea) {
        fora.add(ia);
        notas.push(`AM/PM: ${min2hm(ta[0])} descartado, ${min2hm(tb[0])} bate com a escala`);
      } else {
        notas.push(`${min2hm(ta[0])} e ${min2hm(tb[0])} estão a 12h — possível AM/PM, mas não dá pra decidir qual vale`);
      }
    }
  }
  return { pedidos: lista.filter((_, i) => !fora.has(i)), notas };
}

/**
 * simulador.py:234 (simula) — APLICA OS PEDIDOS SOBRE O CARTÃO REAL e devolve como o
 * ponto vai ficar depois do ajuste.
 *   Alteração troca a batida no lugar · Exclusão tira · Inserção encaixa na ordem.
 *
 * Parâmetros:
 *   batidas       — o cartão ANTES (array de minutos / 'HH:MM' / string 'E.. | S..')
 *   pedidos       — [{tipo, ajuste|hora}] — tipo começa com 'inser'/'altera'/'exclu'
 *   escala        — referências pra ancorar inserção sem cartão e pra resolver AM/PM
 *                   (é o `refs` do Python: escala/operação em minutos)
 *   cartaoFechado — true quando o dia já fechou e a pessoa não bateu ponto (SEM_PONTO)
 *
 * Devolve { batidas (minutos), horarios ('HH:MM'), notas }.
 * NOTA = pedido que não deu pra aplicar. A PRESENÇA DE NOTA é o sinal de que esse dia NÃO
 * pode ser congelado nem julgado (simulador.py:239-240) — use `bloqueioSimulacao`.
 */
export function simulaCartao({
  batidas = [], pedidos = [], escala = null, refs = null, cartaoFechado = false,
} = {}) {
  const referencias = (refs !== null && refs !== undefined ? refs : escala) || null;
  const refsMin = (referencias || []).map(paraMinutos).filter((r) => r !== null && r !== undefined);

  // desenrola a virada de dia ANTES de qualquer coisa (00:01 -> 24:01) — simulador.py:241
  const { limpas, fora: fantasmas } = removeFantasmas(
    Array.isArray(batidas) ? batidas : batidasDoCartao(batidas),
    { desenrolar: true },
  );
  const bat = limpas.slice();
  const notas = [];
  if (fantasmas.length) notas.push(`_fantasma:${fantasmas.map(min2hm).join(',')}`);

  const soIns = !!(pedidos && pedidos.length)
    && pedidos.every((o) => _tipo(o).startsWith('inser'));
  const { ok, motivo } = cartaoUtilizavel(bat, cartaoFechado, soIns);
  if (!ok) return { batidas: [], horarios: [], notas: notas.concat([motivo]) };

  const amp = resolveAmPm(pedidos || [], refsMin);
  const lista = amp.pedidos;
  notas.push(...amp.notas);

  for (const o of lista) {
    const tipo = _tipo(o);
    const ts = temposDoAjuste(_txtAjuste(o)).filter((t) => t !== null && t !== undefined);
    if (!ts.length) continue;

    if (tipo.startsWith('altera') && ts.length >= 2) {
      const i = acha(bat, ts[0]);
      if (i === null) { notas.push(`alterar ${min2hm(ts[0])}: não achei no cartão`); continue; }
      const novo = varHora(ts[1], bat[i]);
      // PONTA NOVA, NÃO SUBSTITUIÇÃO (simulador.py:264-272). Quem esqueceu de bater a
      // ENTRADA tem o cartão deslocado: a primeira batida não é a entrada, é a saída pro
      // almoço. O app só deixa "alterar" uma batida existente, então ele aponta a primeira
      // e pede o horário de entrada — mas trocar apaga a saída do almoço.
      // CLAUDIO 12/08: cartão 19:34 20:04 21:46 (+fantasma), pediu alterar 19:34 -> 13:20.
      // Substituindo dava 13:20 20:04 21:46 (perdeu o 19:34 e o almoço). O certo é
      // 13:20 19:34 20:04 21:46. Só vale na PONTA e indo PRA FORA do intervalo, e só
      // quando sobra campo.
      const ponta = (i === 0 && novo < bat[0])
        || (i === bat.length - 1 && novo > bat[bat.length - 1]);
      if (ponta && bat.length < MAX_BATIDAS) bat.push(novo);
      else bat[i] = novo;
    } else if (tipo.startsWith('exclu')) {
      const i = acha(bat, ts[0]);
      if (i === null) { notas.push(`excluir ${min2hm(ts[0])}: não achei no cartão`); continue; }
      bat.splice(i, 1);                              // exclusão sem origem vira órfã (nota)
    } else if (tipo.startsWith('inser')) {
      const novo = encaixa(bat, ts[0], refsMin);
      // inserção redundante: já existe batida praticamente no mesmo minuto (tol=1)
      if (acha(bat, novo, 1) !== null) { notas.push(`inserir ${min2hm(novo)}: já existe no cartão`); continue; }
      bat.push(novo);
    } else {
      notas.push(`tipo '${(o && o.tipo) || ''}' não simulado`);
    }
    bat.sort((a, b) => a - b);                       // numérico! o sort padrão do JS é textual
  }

  // simulador.py:293-296 — o cartão só tem 4 campos: passar disso é resultado impossível de
  // lançar na tela. Vira nota (= não congela, não julga) em vez de virar prova falsa.
  if (bat.length > MAX_BATIDAS) {
    notas.push(`resultado com ${bat.length} batidas: o cartão só tem ${MAX_BATIDAS} campos`);
  }
  return { batidas: bat, horarios: bat.map(min2hm), notas };
}

// main.py:6695 (_NOTA_GRAVE) — notas do simulador que INVALIDAM o dia. Reenvio do mesmo
// pedido ("já existe") NÃO entra aqui: é ruído conhecido (17% do volume).
const NOTA_GRAVE = [
  ['não achei no cartão', 'a batida que ele quer mexer não está no cartão'],
  ['só tem 4 campos', 'o resultado passa dos 4 campos do cartão'],
  ['ainda não fechou', 'o ponto do dia ainda não fechou'],
  ['1 batida', 'o ponto do dia ainda não fechou'],
  ['não bateu ponto', 'ele não bateu ponto no dia'],
  ['não simulado', 'tipo de pedido que não sabemos simular'],
];

/** main.py:6702 (_bloqueio_simulacao) — por que este dia NÃO pode ser julgado, ou ''. */
export function bloqueioSimulacao(notas) {
  const n = (Array.isArray(notas) ? notas.join(' ') : String(notas || '')).toLowerCase();
  for (const [chave, motivo] of NOTA_GRAVE) {
    if (n.includes(chave)) return motivo;
  }
  return '';
}

/* ══════════════════════ 7. refPonta ══════════════════════ */

// Aceita tanto {sst, val, citatti, escala} quanto a linha crua do lake
// (sst_vinculo/val_inicio/op_inicio/esc_entrada · sst_desvinculo/val_fim/op_fim/esc_saida).
function _fontesDaPonta(fontes, ponta) {
  const f = fontes || {};
  const ehSaida = String(ponta || '').toLowerCase().startsWith('sa');   // 'saida' | 'saída'
  const pega = (curto, entradaKey, saidaKey) => {
    if (f[curto] !== undefined && f[curto] !== null && String(f[curto]).trim() !== '') return f[curto];
    return ehSaida ? f[saidaKey] : f[entradaKey];
  };
  return {
    sst: pega('sst', 'sst_vinculo', 'sst_desvinculo'),
    val: pega('val', 'val_inicio', 'val_fim'),
    citatti: (f.citatti !== undefined && f.citatti !== null && String(f.citatti).trim() !== '')
      ? f.citatti
      : (f.ct !== undefined && f.ct !== null && String(f.ct).trim() !== ''
        ? f.ct
        : (ehSaida ? f.op_fim : f.op_inicio)),
    escala: pega('escala', 'esc_entrada', 'esc_saida'),
  };
}

/**
 * main.py:7885 (_ref_ponta) — A ESCADA DO CANON pra achar a referência de UMA ponta.
 * Ordem: SST+Validador concordando (P1/P2) > fonte forte apoiada pelo Citatti (P3) >
 * Citatti sozinho quando falta bilhetagem > escala. DELTA_FONTE=20 é a margem que faz
 * duas fontes "concordarem".
 *
 * Cuidado com o SST: ele é o VÍNCULO do motorista. Se ele desconectou no meio e seguiu
 * rodando, o sst_desvinculo marca a desconexão, não o fim da jornada — por isso, quando o
 * Citatti existe e diverge do SST, o Citatti manda (main.py:7892-7894).
 *
 * Devolve { ref (minutos, pode ser fracionário na média SST+bilhetagem), rotulo }.
 *
 * AMBIGUIDADE: as comparações usam |a-b| CRU, não a distância circular de 24h
 * (difRelogio). Duas fontes em 23:55 e 00:05 NÃO "concordam" aqui (|1435-5| = 1430),
 * embora estejam a 10 min de relógio. É o comportamento do Python e está preservado.
 * AMBIGUIDADE 2: a média (s+v)/2 pode dar .5 e é devolvida fracionária — o Python também
 * devolve float, e min2hm trunca só na hora de imprimir.
 */
export function refPonta({ ponta = 'entrada', fontes = {} } = {}) {
  const src = _fontesDaPonta(fontes, ponta);
  const s = paraMinutos(src.sst);
  const v = paraMinutos(src.val);
  const c = paraMinutos(src.citatti);
  const e = paraMinutos(src.escala);
  const nn = (x) => x !== null && x !== undefined;

  if (nn(s) && nn(v) && Math.abs(s - v) <= DELTA_FONTE) {
    return { ref: (s + v) / 2, rotulo: 'real (SST+bilhetagem)' };
  }
  if (nn(v) && nn(c) && Math.abs(v - c) <= DELTA_FONTE) {
    return { ref: v, rotulo: 'real (bilhetagem+Citatti)' };
  }
  if (nn(v) && nn(c)) {
    // Havendo as duas fontes mas sem concordância perfeita, o DP definiu que a referência
    // continua sendo a bilhetagem confrontada com o Citatti — jamais o SST (main.py:7902-7905).
    return { ref: v, rotulo: `bilhetagem (Citatti divergiu ${Math.abs(v - c)} min)` };
  }
  if (nn(s) && nn(c) && Math.abs(s - c) <= DELTA_FONTE) {
    // concordando, vale o Citatti: o SST marca vínculo/desvínculo, o Citatti marca a operação.
    return { ref: c, rotulo: 'Citatti (confirmado pelo SST)' };
  }
  if (nn(c) && !nn(v)) {
    return { ref: c, rotulo: `Citatti${nn(s) ? ' (SST divergiu — desconexão?)' : ''}` };
  }
  // fallback de fonte única: SST antes da bilhetagem — a bilhetagem tem as pontas sujas
  // (validador abre na preparação da garagem e fecha em sessão fantasma) — main.py:7915-7918
  if (nn(s)) return { ref: s, rotulo: 'SST' };
  if (nn(v)) return { ref: v, rotulo: 'bilhetagem' };
  return nn(e) ? { ref: e, rotulo: 'escala' } : { ref: null, rotulo: '' };
}

/* ══════════════════════ 8. julgaRef ══════════════════════ */

/**
 * main.py:9138-9147 — A CASCATA DA RÉGUA DO VEREDITO, por ponta:
 *   Real manual do DP > ALVO congelado no caso (o que saiu no aviso) > sugestão viva do dia
 *   > escada do canon (refPonta).
 * O alvo congelado é o que amarra o julgamento ao que foi PEDIDO naquele dia.
 */
export function refDaPonta({
  ponta = 'entrada', realManual = {}, alvoCongelado = {}, sugestaoDia = {}, fontes = {},
} = {}) {
  const ehSaida = String(ponta).toLowerCase().startsWith('sa');
  const pick = (obj) => {
    const o = obj || {};
    if (ehSaida) return o.saida !== undefined ? o.saida : o['saída'];
    return o.entrada;
  };
  const rm = paraMinutos(pick(realManual));
  const al = paraMinutos(pick(alvoCongelado));
  const su = paraMinutos(pick(sugestaoDia));
  if (rm !== null && rm !== undefined) return { ref: rm, rotulo: 'Real (você)' };
  if (al !== null && al !== undefined) return { ref: al, rotulo: 'régua do aviso' };
  if (su !== null && su !== undefined) return { ref: su, rotulo: 'sugestão do aviso' };
  return refPonta({ ponta, fontes });
}

/**
 * main.py:7926 (_julga_ref) — O VEREDITO POR PONTA. Julga o cartão simulado contra a melhor
 * referência disponível EM CADA PONTA: o REAL da operação quando existe, senão a ESCALA.
 *
 * SÓ ENTRA NA CONTA A PONTA QUE O PEDIDO MEXEU: quem só ajustou a saída não pode ser
 * reprovado pela entrada. O "mexeu" é decidido comparando cartaoDepois[0]/[−1] com
 * cartaoAntes[0]/[−1] (não pela lista de pedidos — ver AMBIGUIDADE abaixo).
 *
 * "SEM BASE" (main.py:7955-7961): sem cartão E só a escala como referência = não dá pra
 * julgar, nem certo nem errado — o motorista cria a jornada inteira lendo a escala e a
 * gente conferiria contra a mesma escala. Circular. Vale pra qualquer veredito, não só
 * "certo": senão uma escala corrompida (00:10 a 01:30) reprova o cara sem base nenhuma.
 *
 * Parâmetros:
 *   cartaoAntes   — cartão real já limpo de fantasmas (`lim` no Python; main.py:9124)
 *   cartaoDepois  — saída de simulaCartao().batidas (`sim`)
 *   referencias   — fontes do canon por ponta: {entrada:{sst,val,citatti,escala}, saida:{...}}
 *                   (aceita também a linha crua da gordura em `referencias.fontes`)
 *   realManual / alvoCongelado / sugestaoDia — {entrada, saida}
 *   tol           — folga do veredito (o chamador passa 10)
 *
 * Devolve { entrada, saida, combinado, base, motivo, refs }
 *   entrada/saida/combinado: 'certo' | 'errado' | null
 *   combinado é o AND das pontas (certo só se TODAS certas)
 *   motivo é preenchido só quando não deu pra julgar (é o `base` do Python nesse caso)
 *
 * AMBIGUIDADE: o parâmetro `pedidos` existe na assinatura pedida, mas o Python NÃO o usa —
 * `_julga_ref` deriva "que ponta ele mexeu" do diff antes×depois. Ele é aceito e IGNORADO
 * de propósito, pra não inventar regra. Consequência real: um pedido que mexe numa ponta e
 * resulta no MESMO minuto (alteração 08:00 -> 08:00) não conta como mexida.
 */
export function julgaRef({
  cartaoAntes = [], cartaoDepois = [], pedidos = null, referencias = {},
  realManual = {}, alvoCongelado = {}, sugestaoDia = {}, tol = TOL_AJUSTE_MIN,
  refs = null,
} = {}) {
  void pedidos;   // ver AMBIGUIDADE acima — o Python não usa

  const antes = (cartaoAntes || []).map(paraMinutos).filter((x) => x !== null && x !== undefined);
  const depois = (cartaoDepois || []).map(paraMinutos).filter((x) => x !== null && x !== undefined);
  const vazio = {
    entrada: null, saida: null, combinado: null, base: '', motivo: '', refs: {},
  };
  if (!depois.length) return vazio;

  const fontesDe = (p) => {
    const r = referencias || {};
    if (r[p] || r['saída']) return (p === 'saida' ? (r.saida || r['saída']) : r.entrada) || r.fontes || r;
    return r.fontes || r;
  };
  // `refs` pré-resolvido = a assinatura CRUA do Python, `_julga_ref(antes, depois, ref_ent,
  // ref_sai, tol)`, que já recebe as tuplas prontas. Quando você passa, a cascata
  // (realManual > alvoCongelado > sugestaoDia > refPonta) é ignorada. Serve pra testar o
  // núcleo do veredito isolado da escolha da régua.
  const refEnt = (refs && refs.entrada) ? refs.entrada : refDaPonta({
    ponta: 'entrada', realManual, alvoCongelado, sugestaoDia, fontes: fontesDe('entrada'),
  });
  const refSai = (refs && (refs.saida || refs['saída'])) ? (refs.saida || refs['saída']) : refDaPonta({
    ponta: 'saida', realManual, alvoCongelado, sugestaoDia, fontes: fontesDe('saida'),
  });

  // main.py:7939-7942 — só a ponta que o pedido MEXEU. Sem cartão antes, as duas contam.
  const alvos = [];
  if (!antes.length || depois[0] !== antes[0]) alvos.push(['entrada', depois[0], refEnt]);
  if (!antes.length || depois[depois.length - 1] !== antes[antes.length - 1]) {
    alvos.push(['saida', depois[depois.length - 1], refSai]);
  }

  const pontas = {};
  const checks = [];
  const bases = [];
  for (const [lado, batida, { ref, rotulo }] of alvos) {
    if (ref === null || ref === undefined) continue;
    const ok = Math.abs(varHora(ref, batida) - batida) <= tol;
    pontas[lado] = ok ? 'certo' : 'errado';
    checks.push(ok);
    bases.push(rotulo);
  }
  if (!checks.length) {
    return { ...vazio, refs: { entrada: refEnt, saida: refSai } };
  }
  const ver = checks.every(Boolean) ? 'certo' : 'errado';
  const base = [...new Set(bases)].join(' · ');   // dict.fromkeys = dedup preservando ordem

  if (!antes.length && bases.every((b) => String(b).includes('escala'))) {
    return {
      entrada: null,
      saida: null,
      combinado: null,
      base: '',
      motivo: 'sem cartão — inserção de jornada inteira, escala não valida',
      refs: { entrada: refEnt, saida: refSai },
    };
  }
  return {
    entrada: pontas.entrada || null,
    saida: pontas.saida || null,
    combinado: ver,
    base,
    motivo: '',
    refs: { entrada: refEnt, saida: refSai },
  };
}

/* ══════════════════════ 9. julgaAcoes ══════════════════════ */

/**
 * main.py:6418 (_slot_da_ponta) — qual batida do cartão OCUPA aquela ponta.
 * Cartão de 2 = entrada e saída; de 4 = entrada, saída almoço, volta almoço, saída.
 * Com 1, 3 ou 5+ não dá pra dizer quem é quem sem chutar -> null.
 * Batida dupla (<=6 min) é UMA batida: sem colapsar, EDVALDO 11/08 (04:36·04:37) parecia
 * ter entrada E saída e a ferramenta sugeria alterar o 04:37 pra uma saída das 09:24.
 *
 * AMBIGUIDADE (preservada): o Python faz `ant = t` FORA do if, então o encadeamento compara
 * cada batida com a ANTERIOR CRUA, não com o início do grupo. Três batidas a 5 min uma da
 * outra (10:00, 10:05, 10:10) colapsam todas em 10:10, embora a distância total seja 10 min.
 */
export function slotDaPonta(bat, ponta) {
  const b = [];
  let ant = null;
  for (const t of (bat || []).slice().sort((x, y) => x - y)) {
    if (ant === null || t - ant > TOL_FANTASMA) b.push(t);
    else b[b.length - 1] = t;
    ant = t;
  }
  if (b.length === 2) {
    if (ponta === PONTA_ENTRADA) return b[0];
    if (ponta === PONTA_SAIDA) return b[1];
    return null;
  }
  if (b.length === 4) {
    const mapa = {
      [PONTA_ENTRADA]: b[0],
      [PONTA_ALM_SAIDA]: b[1],
      [PONTA_ALM_VOLTA]: b[2],
      [PONTA_SAIDA]: b[3],
    };
    return mapa[ponta] !== undefined ? mapa[ponta] : null;
  }
  return null;
}

function _txt(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

// primeiro valor não-vazio (o `a or b or c` do Python sobre strings)
function _ou(...vs) {
  for (const v of vs) if (_txt(v)) return v;
  return '';
}

function _argmin(lista, fn) {
  let melhor = null;
  let dm = Infinity;
  for (const x of lista) {
    const d = fn(x);
    if (d < dm) { dm = d; melhor = x; }     // `<` estrito = empate fica com o primeiro
  }
  return melhor;
}

/**
 * main.py:6497 (_julga_acoes) — VEREDITO POR AJUSTE INDIVIDUAL: o que ele pediu × o ALVO
 * (operação com tolerância). É a régua única dos dois caminhos (o DP avisou, ou ele
 * corrigiu sozinho). Consolida duplicatas (17% do volume é reenvio do mesmo pedido) e
 * devolve cada horário ÚNICO com: a ponta que ele mirou, o alvo dela, a diferença e ok/não.
 * Sem alvo no dia (sem operação) -> veredito vazio: não julga no escuro.
 *
 * ALVO DAS PONTAS EM CASCATA (main.py:6504-6531):
 *   0) alvo congelado do aviso  1) alvo da gordura  2) sugestão  3) operação ∓ tolerância
 *      (entrada = op_inicio − 10 · saída = op_fim + 8)
 *   O (0) é o que manda: é o horário que SAIU no aviso. Sem ele, a tela recalculava ao vivo
 *   e mostrava outro número (CARLOS 09/08 pediu 13:48 e a tela cobrava 13:52).
 *
 * MIRA = âncoras da ESCALA (main.py:6548-6550): servem só pra dizer QUAL ponta o pedido é —
 * nunca pra julgar. Se a ponta mirada não tem alvo, o resultado é "não julgo", NÃO
 * "comparo com a que sobrou" (ANDRE 07/08: sem alvo de entrada, a alteração pra 04:10 foi
 * medida contra a SAÍDA 14:54, dif de 644 min).
 *
 * "PEDIU MENOS" (main.py:6612-6624): só pra Inserção/Alteração (na exclusão ele não propõe
 * horário). Dentro de TOL_MENOS_MIN=60 na direção que ENTREGA tempo, vale como CERTO —
 * abriu mão de tempo. Além de 60, `alem=true`: não se julga (ok=null), porque aí não foi
 * escolha, foi a ferramenta casar a ponta ou o dia errado.
 *
 * EXCLUSÃO tem a RÉGUA INVERTIDA (main.py:6659-6663): ele está TIRANDO aquele horário.
 * Tirar um horário que NÃO bate com o alvo é o certo; tirar um que bate é que seria errado.
 *
 * INSERÇÃO REDUNDANTE (main.py:6626-6658): ele já TEM batida ali. Cada pedido, sozinho,
 * "bate" com o alvo — e mesmo assim aceitar estraga o cartão (cria segunda entrada e
 * segunda saída, e o meio vira almoço falso: DAVID 24/07 virava 04:13·04:15·09:22·09:30
 * com 5h07 de "almoço"). Marca `viraAlteracao` e derruba `perto`.
 *
 * Parâmetros (mapeamento com o Python):
 *   pedidos  = `acoes`   [{tipo, hora, id, depoisConf}]
 *   alvo     = `caso`    {entrada, saida, almSaida, almVolta, origem}   (alvo CONGELADO)
 *   gordura  = `g`       {alvoEntrada, alvoSaida, opInicio, opFim, valInicio, valFim}
 *   sugestao = `cp` sug  {entrada, saida, almocoSaida, almocoVolta}
 *   escala   = `cp` esc  {entrada, saida}
 *   cartao   = batidas do cartão (array/string/objeto do ponto_diario)
 *
 * Devolve { itens, fonteAlvo, alvoPar }.
 * Campos de cada item (nome JS -> chave Python): tipo, hora, n, ponta, alvo, dif, ok, excl,
 *   ids, depoisConf(depois_conf), menos, redundante, viraAlteracao(vira_alteracao),
 *   orfao, semAlvoPonta(sem_alvo_ponta).
 */
export function julgaAcoes({
  pedidos = [], alvo = {}, gordura = {}, sugestao = {}, escala = {}, cartao = [],
} = {}) {
  const caso = alvo || {};
  const g = gordura || {};
  const sug = sugestao || {};
  const esc = escala || {};

  // ---- cascata do alvo (main.py:6514-6531)
  let e = _ou(caso.entrada || caso.alvo_entrada, g.alvoEntrada || g.alvo_entrada,
    sug.entrada || sug.entrada_sug);
  let s = _ou(caso.saida || caso.alvo_saida, g.alvoSaida || g.alvo_saida,
    sug.saida || sug.saida_sug);
  let fonte;
  if (_txt(caso.entrada || caso.alvo_entrada) || _txt(caso.saida || caso.alvo_saida)) {
    const orig = _txt(caso.origem);
    fonte = `aviso${orig ? ` (${orig})` : ''}`;
  } else if (_txt(g.alvoEntrada || g.alvo_entrada) || _txt(g.alvoSaida || g.alvo_saida)) {
    fonte = 'gordura';
  } else {
    fonte = (_txt(e) || _txt(s)) ? 'sugestão' : '';
  }
  if (!_txt(e) && !_txt(s)) {
    let oi = hm2min(g.opInicio || g.op_inicio);
    let of = hm2min(g.opFim || g.op_fim);
    if (oi === null) oi = hm2min(g.valInicio || g.val_inicio);
    if (of === null) of = hm2min(g.valFim || g.val_fim);
    if (oi !== null) e = min2hm(Math.max(0, oi - TOL_ENTRADA_MIN));
    if (of !== null) s = min2hm(of + TOL_SAIDA_MIN);
    if (_txt(e) || _txt(s)) fonte = 'operação';
  }

  const alvos = [];
  for (const [rot, v] of [[PONTA_ENTRADA, e], [PONTA_SAIDA, s]]) {
    const m = hm2min(v);
    if (m !== null) alvos.push([rot, m, v]);
  }
  // main.py:6537-6545 — o almoço só entra como alvo se as PONTAS existirem, senão ele vira
  // o único alvo do dia e puxa pra si ajustes de entrada/saída (foi o que quebrou o FLAVIO).
  const almS = _ou(caso.almSaida || caso.alvo_alm_saida, sug.almocoSaida || sug.almoco_saida_sug);
  const almV = _ou(caso.almVolta || caso.alvo_alm_volta, sug.almocoVolta || sug.almoco_volta_sug);
  if (alvos.length) {
    for (const [rot, v] of [[PONTA_ALM_SAIDA, almS], [PONTA_ALM_VOLTA, almV]]) {
      const m = hm2min(v);
      if (m !== null) alvos.push([rot, m, v]);
    }
  }

  const batCp = batidasDoCartao(cartao);
  const mira = [
    [PONTA_ENTRADA, hm2min(esc.entrada || esc.esc_entrada)],
    [PONTA_SAIDA, hm2min(esc.saida || esc.esc_saida)],
    [PONTA_ALM_SAIDA, hm2min(almS)],
    [PONTA_ALM_VOLTA, hm2min(almV)],
  ].filter(([, m]) => m !== null);

  const vistos = new Map();
  const out = [];
  for (const a of (pedidos || [])) {
    const tipoTxt = _txt(a && a.tipo);
    const horaTxt = _txt((a && a.hora) !== undefined && (a && a.hora) !== null ? a.hora : (a && a.ajuste));
    const ch = `${tipoTxt}\u0000${horaTxt}`;
    if (vistos.has(ch)) {                     // duplicata: agrupa em vez de repetir na tela
      const it = vistos.get(ch);
      it.n += 1;
      if (a && a.id) it.ids.push(String(a.id));
      if (a && (a.depoisConf || a.depois_conf)) it.depoisConf = true;
      continue;
    }
    const item = {
      tipo: tipoTxt,
      hora: horaTxt,
      n: 1,
      ponta: '',
      alvo: '',
      dif: null,
      ok: null,
      excl: false,
      // AS OCORRÊNCIAS QUE ESTE ITEM REPRESENTA (main.py:6573-6575): sem elas a decisão só
      // sabia falar por DIA, e um caso misto virava "rejeita tudo" (124 casos).
      ids: (a && a.id) ? [String(a.id)] : [],
      depoisConf: !!(a && (a.depoisConf || a.depois_conf)),
    };

    // 'Alteração' vem como 'D/ 09:19 P/ 08:30' — o que vale julgar é o horário NOVO
    const alt = /D\/\s*(\d{1,2}:\d{2})\s*P\/\s*(\d{1,2}:\d{2})/i.exec(horaTxt);
    let hm = hm2min(horaTxt);
    if (hm === null) {
      const mm = /P\/\s*(\d{1,2}:\d{2})/.exec(horaTxt);
      hm = mm ? hm2min(mm[1]) : null;
    }

    let cand = alvos;
    if (hm !== null && alvos.length && mira.length) {
      // QUAL PONTA ELE MIROU — pela ESCALA, não pelo alvo que sobrou (main.py:6585-6592)
      const mp = _argmin(mira, (x) => difRelogio(hm, x[1]))[0];
      const rotsComAlvo = new Set(alvos.map((x) => x[0]));
      if (!rotsComAlvo.has(mp)) {
        item.ponta = mp;
        item.alvo = '';
        item.dif = null;
        item.ok = null;
        item.semAlvoPonta = true;
        vistos.set(ch, item);
        out.push(item);
        continue;
      }
      // `cand` é LOCAL de propósito: reatribuir `alvos` estragava os pedidos seguintes
      // (DAVID 24/07 — main.py:6590-6592)
      const filtrado = alvos.filter((x) => x[0] === mp);
      cand = filtrado.length ? filtrado : alvos;
    }

    if (hm !== null && cand.length) {
      const [rot, am, av] = _argmin(cand, (x) => difRelogio(hm, x[1]));
      const d = difRelogio(hm, am);
      let perto = d <= TOL_AJUSTE_MIN;
      const exc = tipoTxt.toLowerCase().startsWith('exclus');

      // PEDIU MENOS (main.py:6612-6624). Alinha ao dia do alvo antes de olhar o sinal:
      // 01:00 contra 25:14 parece "10 horas antes" quando são 14 minutos antes.
      let menos = false;
      let alem = false;
      if (!perto && !exc) {
        const h2 = Math.abs(hm + 1440 - am) < Math.abs(hm - am) ? hm + 1440 : hm;
        const lado = LADO_MENOS[rot];
        if (lado && (h2 - am) * lado >= 0) {
          if (d <= TOL_MENOS_MIN) { menos = true; perto = true; }  // abriu mão de tempo: vale como certo
          else alem = true;                                        // longe demais: não julga
        }
      }
      item.menos = menos;

      if (!exc && !tipoTxt.toLowerCase().startsWith('altera')) {
        const dup = batCp.find((b) => difRelogio(hm, b) <= TOL_AJUSTE_MIN);
        if (dup !== undefined) {
          item.redundante = min2hm(dup);
          perto = false;                       // aceitar duplica: nunca é o certo
          // MAS REDUNDANTE NÃO QUER DIZER "sem intenção" (main.py:6638-6644): ele quis
          // ALTERAR a ponta nos dois casos, só a distância mudou (RICHARD 07/08).
          item.viraAlteracao = min2hm(dup);
        } else {
          // A OPERAÇÃO ERRADA NO APP DELES (main.py:6647-6657): o cartão já tem batida nessa
          // ponta, então INSERIR não corrige — acrescenta, e o cartão fica com 3 ou 5 batidas
          // (195 casos). O que ele queria era ALTERAR a batida da ponta. Mas a batida tem que
          // ESTAR na ponta: se está longe do alvo, o cartão está deslocado e INSERIR é o certo
          // mesmo (CARLOS 12/08: primeira batida 09:58 com alvo de entrada 03:25).
          const atual = slotDaPonta(batCp, rot);
          if (atual !== null && difRelogio(atual, am) <= TOL_MENOS_MIN) {
            item.viraAlteracao = min2hm(atual);
          }
        }
      }

      item.ponta = rot;
      item.alvo = av;
      item.dif = d;
      item.excl = exc;
      // EXCLUSÃO: régua invertida. `alem`: sem veredito (não pré-marca e não adverte).
      item.ok = alem ? null : (exc ? !perto : perto);

      // ALTERAÇÃO SÓ EXISTE se a origem ainda estiver no cartão (main.py:6668-6685).
      // A régua antiga julgava só o destino: 15:08 -> 14:50 virava "aceitar" mesmo sem
      // 15:08 no cartão e com 14:50 já registrado. Nesse cenário aceitar não faz nada
      // (ou cria duplicata) — é sempre recusa. É a EXCLUSÃO/ALTERAÇÃO ÓRFÃ.
      if (alt) {
        const deM = hm2min(alt[1]);
        const paraM = hm2min(alt[2]);
        const origemExiste = deM !== null && batCp.some((b) => difRelogio(deM, b) === 0);
        const destinoExistente = paraM !== null
          ? batCp.find((b) => difRelogio(paraM, b) === 0)
          : undefined;
        if (!origemExiste) {
          item.orfao = true;
          item.ok = false;
          if (destinoExistente !== undefined) item.redundante = min2hm(destinoExistente);
        } else if (destinoExistente !== undefined && difRelogio(deM, destinoExistente) !== 0) {
          item.redundante = min2hm(destinoExistente);
          item.ok = false;
        }
      }
    }
    vistos.set(ch, item);
    out.push(item);
  }

  return { itens: out, fonteAlvo: fonte, alvoPar: [e, s] };
}

/* ══════════════════════ 10. resumoAcoes ══════════════════════ */

/**
 * main.py:6711 (_resumo_acoes) — VEREDITO DO CASO: certo | errado | misto — ou POR QUE não
 * deu pra julgar. 'Sem régua' não diz nada ao operador; são 3 situações diferentes:
 *   sem_operacao_interno — interno/aprendiz não dirige, essa régua nunca se aplica
 *   sem_operacao         — motorista sem operação apurada no dia (folga/falta/sem tabela)
 *   fora_janela          — o dia é anterior à janela da gordura, não temos como julgar
 * Só entram na conta os itens com `ok` diferente de null (os que deu pra julgar).
 *
 * Aceita a saída de julgaAcoes (o objeto inteiro ou só o array `itens`).
 */
export function resumoAcoes(vereditos, { categoria = '', temGordura = false } = {}) {
  const julg = Array.isArray(vereditos) ? vereditos : ((vereditos && vereditos.itens) || []);
  const com = julg.filter((x) => x && x.ok !== null && x.ok !== undefined);
  if (com.length) {
    const ok = com.filter((x) => x.ok).length;
    const nk = com.length - ok;
    const resumo = nk === 0 ? 'certo' : (ok === 0 ? 'errado' : 'misto');
    return { resumo, ok, errados: nk };
  }
  const cat = String(categoria || '').toUpperCase();
  if (cat.startsWith('INTERN') || cat.startsWith('APREND')) {
    return { resumo: 'sem_operacao_interno', ok: 0, errados: 0 };
  }
  return { resumo: temGordura ? 'sem_operacao' : 'fora_janela', ok: 0, errados: 0 };
}

/* ══════════════════════ 11. realocaDia ══════════════════════ */

/** main.py:7658 (_norm_data) — dd/mm/aaaa ou aaaa-mm-dd -> aaaa-mm-dd. Sem Date, sem fuso. */
export function normData(s) {
  const t = _txt(s);
  if (t.includes('/')) {
    const p = t.split('/');
    if (p.length === 3) return `${p[2]}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`;
  }
  return t;
}

/**
 * main.py:6445 (_realoca_dia) — O PEDIDO ESTÁ NO DIA CERTO?
 * O lake traz DOIS dias de referência e eles divergem em 79% dos pedidos. `dt_referencia`
 * (nosso date_ref) acerta muito mais — 371 x 71 medido sobre alterações/exclusões — então
 * ele continua mandando. MAS quando a batida que ele quer mexer NÃO está no cartão desse
 * dia e ESTÁ no cartão do outro, o dia é o outro (HELOIZA 26/05 -> a batida é 15/06;
 * MARIVANIA 22/07 -> 05/08).
 * Só mexe em Alteração/Exclusão: são as únicas que apontam uma batida existente —
 * Inserção cria batida nova e não tem o que casar.
 * Tolerância ±5 min, testada também com ±1440 (virada de dia).
 *
 * Parâmetros:
 *   pedido        — {tipo, batida_atual|batidaAtual, ajuste, date_ref|dateRef,
 *                    date_ref_alt|dtReferenciaPonto}
 *   cartaoDoDia   — batidas do cartão do date_ref
 *   cartaoDoDiaAlt— batidas do cartão do dt_referencia_ponto
 * Devolve { realocou, dateRef, diaRealocado, batida, motivo }.
 *
 * AMBIGUIDADE (bug do Python preservado, main.py:6474): a origem faz
 * `self._hm2min(o.get("batida_atual")) or self._hm2min(<1º HH:MM do ajuste>)`.
 * O `or` do Python trata 0 como falso, então uma `batida_atual` de "00:00" (0 minutos)
 * cai no fallback do ajuste em vez de valer. Reproduzido aqui de propósito.
 */
export function realocaDia({ pedido = {}, cartaoDoDia = [], cartaoDoDiaAlt = [] } = {}) {
  const tp = String(pedido.tipo || '').toLowerCase();
  const nada = (motivo) => ({
    realocou: false, dateRef: normData(pedido.date_ref || pedido.dateRef), diaRealocado: '', batida: null, motivo,
  });
  if (!(tp.startsWith('altera') || tp.startsWith('exclu'))) {
    return nada('tipo não aponta batida existente (só Alteração/Exclusão realocam)');
  }
  const alt = normData(pedido.date_ref_alt || pedido.dateRefAlt || pedido.dt_referencia_ponto
    || pedido.dtReferenciaPonto || '');
  const d0 = normData(pedido.date_ref || pedido.dateRef || '');
  if (!alt || alt === d0) return nada('não há dia alternativo divergente');

  // ---- o `or` que trata 0 como falso (ver AMBIGUIDADE)
  const direto = hm2min(pedido.batida_atual !== undefined ? pedido.batida_atual : pedido.batidaAtual);
  let t = direto || null;
  if (!t) {
    const m = RE_HM_UM.exec(String(pedido.ajuste || ''));
    t = m ? hm2min(m[0]) : null;
  }
  if (t === null || t === undefined) return nada('pedido sem horário para casar');

  const perto = (bats, alvoT) => (bats || []).some(
    (b) => Math.abs(b - alvoT) <= TOL_REALOCA_DIA
      || Math.abs(b - alvoT - 1440) <= TOL_REALOCA_DIA
      || Math.abs(b - alvoT + 1440) <= TOL_REALOCA_DIA,
  );
  const b0 = batidasDoCartao(cartaoDoDia);
  const b1 = batidasDoCartao(cartaoDoDiaAlt);

  if (perto(b0, t)) {
    return {
      realocou: false, dateRef: d0, diaRealocado: '', batida: t, motivo: 'a batida está no dia que usamos',
    };
  }
  if (perto(b1, t)) {
    return {
      realocou: true, dateRef: alt, diaRealocado: d0, batida: t, motivo: 'a batida só existe no outro dia de referência',
    };
  }
  return {
    realocou: false, dateRef: d0, diaRealocado: '', batida: t, motivo: 'a batida não está em nenhum dos dois cartões',
  };
}

/* ═════════════════════════ CONSTANTES EXPORTADAS ═════════════════════════ */

export const CONSTANTES = {
  TOL_ENTRADA_MIN,          // 10  — main.py:117
  TOL_SAIDA_MIN,            //  8  — main.py:118
  TOL_AJUSTE_MIN,           // 10  — main.py:5517
  TOL_MENOS_MIN,            // 60  — main.py:6166
  TOL_CASA,                 //  5  — simulador.py:58
  TOL_FANTASMA,             //  6  — simulador.py:99
  TOL_REALOCA_DIA,          //  5  — main.py:6454
  MIN_ALMOCO,               // 27  — simulador.py:332
  MAX_ALMOCO_MIN,           // 120 — main.py:121
  DELTA_FONTE,              // 20  — main.py:7882
  MAX_BATIDAS,              //  4  — simulador.py:62
  JORNADA_EXIGE_ALMOCO,     // 360 — simulador.py:327
  SUG_JORNADA_MAX_MIN,      // 780 — main.py:2745 (13*60)
  FRACAO_CONSOLIDADO,       // 0.80 — simulador.py:166
  ALM_FAIXAS,               // [[360,30],[240,15]] — main.py:6007
  ALM_FAIXAS_SEM_OPERACAO,  // [[360,60],[240,15]] — main.py:7140
  LADO_MENOS,               // main.py:6168
  PONTAS: {
    ENTRADA: PONTA_ENTRADA,
    SAIDA: PONTA_SAIDA,
    ALM_SAIDA: PONTA_ALM_SAIDA,
    ALM_VOLTA: PONTA_ALM_VOLTA,
  },
};

export default {
  hm2min,
  min2hm,
  paraMinutos,
  temposDoAjuste,
  varHora,
  difRelogio,
  desenrola,
  batidasDoCartao,
  textoBatidas,
  ordenaPontas,
  removeFantasmas,
  almocoDaRefeicao,
  jornadaEntreMin,
  almocoMatriz,
  almocoMatrizPorCategoria,
  mioloEhRefeicao,
  jornadaDoCartao,
  faltaAlmoco,
  acha,
  encaixa,
  cartaoUtilizavel,
  resolveAmPm,
  simulaCartao,
  bloqueioSimulacao,
  refPonta,
  refDaPonta,
  julgaRef,
  slotDaPonta,
  julgaAcoes,
  resumoAcoes,
  normData,
  realocaDia,
  CONSTANTES,
};
