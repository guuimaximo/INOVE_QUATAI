// ============================================================================
// INOVE GUARD · A REGRA DE BLOQUEIO, calculada no navegador
//
// Porte de PROGRAMA_FRAUDES/fraudes/regra.py (`cartoes_para_bloqueio`). O robô grava a
// fila com a regra PADRÃO; a aba Bloqueio recalcula a lista com os números que a pessoa
// digitar (dono, 16/09/2026: "deixa móvel em campos / data de dias + 15 e aí eu escrevo /
// quantos dias com rajada / quantidade rajada / tempo total rajadas").
//
//     rajada = N ou mais passagens EFETIVAS dentro de X minutos (janela deslizante)
//     fraude = rajada em D dias ou mais (seguidos ou não) nos últimos J dias da base
//
// Com os números do padrão, o resultado é o mesmo do robô. Mudar a regra aqui NÃO muda o
// robô: ele continua pondo e tirando cartões da fila pelo padrão.
// ============================================================================

export const REGRA_PADRAO = Object.freeze({ dias: 15, diasComRajada: 3, passagens: 5, minutos: 30 });

// Os limites dos campos. A origem só grava bloco com 3+ débitos, então menos de 3 passagens
// não existe na base; 90 dias são ~40 mil passagens, o teto razoável para ler de uma vez.
export const LIMITES = Object.freeze({
  dias: [1, 90],
  diasComRajada: [1, 90],
  passagens: [3, 50],
  minutos: [1, 240],
});

// id_tipo_cartao → descrição. Cópia de PROGRAMA_FRAUDES/dados/tipos_cartao.json, o mapa
// congelado que o robô usa (a view da bilhetagem tem o tip_id repetido em duas famílias).
export const TIPOS_CARTAO = Object.freeze({
  1: "AVULSO",
  2: "ESTUDANTE PAPEL",
  3: "VT PAPEL",
  4: "DSA DEFICIENTE SEM ACOMPANHANT",
  5: "DEFICIENTE COM ACOMPANHANTE",
  6: "VALE TRANSPORTE",
  7: "ESCOLAR MUNICIPAL",
  8: "EMTU PAPEL",
  9: "FUNCIONARIO",
  10: "ESTUDANTE TESTE",
  11: "ESCOLAR INTERMUNICIPAL",
  12: "IDOSO",
  13: "AVULSO GUARAREMA",
  14: "MUN GUARAREMA - ESCOLAR",
  15: "PREF GUARAREMA - ESCOLAR",
  16: "VT ASSISTENCIAL",
  17: "VT GUARAREMA",
  18: "VT - FRENTE TRABALHO",
  19: "DEFICIENTE SEM ACOMP GUARAREMA",
  20: "DEFICIENTE COM ACOMP GUARAREMA",
  21: "IDOSO GUARAREMA",
  22: "ESC ESPECIAL GUARAREMA",
  23: "DCE DEFICIENTE COM ACOMP ES",
  24: "Enem",
  25: "TICKET",
  26: "MAE ITAQUA",
  27: "PAGANTE EM HORARIO DIFERENCIADO",
  28: "SuperAção Mobilidade",
  29: "BOTOEIRA GRATUIDADE ESPECIAL",
  30: "EDMONSON",
  31: "FUNCIONARIO",
  32: "RESERVADO - NAO USAR",
  33: "Operador Full Stack - Prov",
  34: "AUTORIZADOR ITAQUA",
  35: "AGENCIADOR S/ CONTATO",
  36: "MANUTENÇÃO PDV AUTORIZADOR",
});

const txt = (v) => String(v ?? "").trim();
const num = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const centavos = (v) => Math.round(v * 100) / 100;

/** Texto do campo → número dentro do limite; vazio ou inválido volta ao padrão. */
export function regraDosCampos(campos) {
  const r = {};
  for (const k of Object.keys(REGRA_PADRAO)) {
    const [min, max] = LIMITES[k];
    const n = Math.floor(Number(String(campos?.[k] ?? "").trim()));
    r[k] = Number.isFinite(n) && String(campos?.[k] ?? "").trim() !== "" ? Math.min(max, Math.max(min, n)) : REGRA_PADRAO[k];
  }
  // pedir mais dias com rajada do que a janela tem não pega ninguém
  r.diasComRajada = Math.min(r.diasComRajada, r.dias);
  return r;
}

export const ehPadrao = (r) => Object.keys(REGRA_PADRAO).every((k) => Number(r?.[k]) === REGRA_PADRAO[k]);

/** "5+ passagens em 30 min · 3+ dias com rajada nos últimos 15 dias" */
export function descreverRegra(r) {
  return `${r.passagens}+ passagens em ${r.minutos} min · ${r.diasComRajada}+ dia(s) com rajada nos últimos ${r.dias} dias`;
}

/* ─────────────────────────────── datas ─────────────────────────────── */

// 'AAAA-MM-DD' ↔ dia inteiro, em UTC: conta de dias sem fuso nem horário de verão
const diaNum = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000);
const isoDoNum = (n) => new Date(n * 86400000).toISOString().slice(0, 10);

/** Primeiro dia da janela que termina em `ate` (ISO), com `dias` dias. */
export function inicioDaJanela(ate, dias) {
  return ate ? isoDoNum(diaNum(ate) - (dias - 1)) : "";
}

/** Os dias da janela, do mais antigo a `ate` (ISO). */
export function diasDaJanela(ate, dias) {
  if (!ate) return [];
  const fim = diaNum(ate);
  return Array.from({ length: dias }, (_, i) => isoDoNum(fim - (dias - 1 - i)));
}

/** Dias com rajada → corridas de dias seguidos (listas de ISO). */
function corridasDeDias(dias) {
  const ds = [...new Set(dias)].sort();
  const corridas = [];
  let atual = [ds[0]];
  for (let i = 1; i < ds.length; i += 1) {
    if (diaNum(ds[i]) - diaNum(ds[i - 1]) === 1) atual.push(ds[i]);
    else {
      corridas.push(atual);
      atual = [ds[i]];
    }
  }
  corridas.push(atual);
  return corridas;
}

/* ─────────────────────────────── rajadas ─────────────────────────────── */

// passagem efetiva = girou a catraca (a origem manda 1/"1"/true)
export const girou = (g) => g?.giro_efetuado === true || String(g?.giro_efetuado) === "1";
// "2026-09-01 07:12:33" → segundos (só para diferença entre passagens)
const segundos = (ts) => Date.parse(txt(ts).replace(" ", "T")) / 1000;

/**
 * AS RAJADAS, bloco a bloco. O bloco (mesmo cartão, mesmo endereço) já vem da origem;
 * aqui se mede a pior janela de `minutos` dentro dele, com dois ponteiros sobre as
 * passagens efetivas em ordem. Vira rajada se essa janela tiver `passagens` ou mais.
 * Serve para a base inteira (a lista) e para um cartão só (o pop-up, com `detalhe`).
 */
export function rajadas(giros, regra = REGRA_PADRAO, { detalhe = false } = {}) {
  const janelaSeg = regra.minutos * 60;
  const porBloco = new Map();
  for (const g of giros || []) {
    const k = txt(g.id_evento_final);
    if (!porBloco.has(k)) porBloco.set(k, []);
    porBloco.get(k).push(g);
  }
  const blocos = [];
  for (const [id, linhas] of porBloco) {
    const passagens = linhas.filter(girou).sort((a, b) => txt(a.giro_dthora).localeCompare(txt(b.giro_dthora)));
    if (passagens.length < regra.passagens) continue;
    const t = passagens.map((g) => segundos(g.giro_dthora));
    let melhor = 0;
    let ini = 0;
    let faixa = [0, 0];
    for (let f = 0; f < t.length; f += 1) {
      while (t[f] - t[ini] >= janelaSeg) ini += 1;
      if (f - ini + 1 > melhor) {
        melhor = f - ini + 1;
        faixa = [ini, f];
      }
    }
    if (melhor < regra.passagens) continue;
    const bloco = {
      id,
      cru: txt(passagens[0].cru_id),
      dia: txt(passagens[0].data_ref).slice(0, 10),
      ultima: txt(passagens[passagens.length - 1].giro_dthora),
      local: txt(passagens[0].local_fraude),
      pico: melhor,
      dur: Math.round(t[faixa[1]] - t[faixa[0]]),
      qtd: passagens.length,
      valor: passagens.reduce((soma, g) => soma + num(g.valor), 0),
    };
    if (detalhe) {
      bloco.passagens = passagens.map((g, i) => ({
        ...g,
        _n: i + 1,
        _gap: i ? Math.round(t[i] - t[i - 1]) : null,
        _janela: i >= faixa[0] && i <= faixa[1],
        _id: `${id}#${i + 1}`,
      }));
    }
    blocos.push(bloco);
  }
  return blocos.sort((a, b) => b.dia.localeCompare(a.dia) || b.pico - a.pico);
}

/**
 * A REGRA INTEIRA: uma linha por cartão, com as mesmas colunas de `fraude_bloqueio_cartao`
 * (é o que a aba desenha e o que se grava quando alguém bloqueia um cartão que o robô não
 * pôs na fila). `giros` são as passagens da janela; `ocorrencias` é id_evento_final → a
 * linha de `fraude_cartao_sequencial` (código, tipo, valor, saldo, local).
 */
export function cartoesDaRegra(giros, ocorrencias, regra, ate) {
  if (!ate) return [];
  const desde = inicioDaJanela(ate, regra.dias);
  const naJanela = (giros || []).filter((g) => {
    const d = txt(g.data_ref).slice(0, 10);
    return d >= desde && d <= ate;
  });
  const porCartao = new Map();
  for (const b of rajadas(naJanela, regra)) {
    if (!porCartao.has(b.cru)) porCartao.set(b.cru, []);
    porCartao.get(b.cru).push(b);
  }
  const oc = (id) => ocorrencias.get(id) || {};

  const linhas = [];
  for (const [cru, blocos] of porCartao) {
    const dias = [...new Set(blocos.map((b) => b.dia))].sort();
    if (dias.length < regra.diasComRajada) continue;
    const corridas = corridasDeDias(dias);
    // o bloco mais recente dá código, saldo e endereço (empate no dia: a última passagem)
    const recente = blocos.reduce((a, b) => (b.dia > a.dia || (b.dia === a.dia && b.ultima > a.ultima) ? b : a));
    const o = oc(recente.id);
    linhas.push({
      cru_id: cru,
      id_usuario: txt(o.id_usuario),
      tipo_cartao: TIPOS_CARTAO[txt(o.id_tipo_cartao)] || "",
      id_empresa: txt(o.id_empresa),
      dias_seguidos: Math.max(...corridas.map((c) => c.length)),
      sequencia_de: dias[0],
      sequencia_ate: dias[dias.length - 1],
      qtd_sequencias: corridas.length,
      dias_com_rajada: dias.length,
      rajadas: blocos.length,
      maior_pico: Math.max(...blocos.map((b) => b.pico)),
      menor_janela_seg: Math.min(...blocos.map((b) => b.dur)),
      passagens: blocos.reduce((s, b) => s + b.qtd, 0),
      valor_debitado: centavos(blocos.reduce((s, b) => s + num(oc(b.id).valor_total_debitado), 0)),
      saldo: centavos(num(o.saldo)),
      ultima_rajada: recente.dia,
      local_fraude: txt(o.local_fraude),
      latitude: txt(o.latitude),
      longitude: txt(o.longitude),
      link_maps: txt(o.link_maps),
      base_ate: ate,
    });
  }
  return linhas.sort(
    (a, b) => b.dias_com_rajada - a.dias_com_rajada || b.rajadas - a.rajadas || b.valor_debitado - a.valor_debitado,
  );
}
