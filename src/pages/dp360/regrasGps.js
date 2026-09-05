/* =============================================================================
   regrasGps.js — régua de GPS do DP360.

   MÓDULO PURO: sem React, sem rede, sem estado. Recebe dados, devolve resultado.
   Quem lê da base e quem desenha a tela são as abas (Revisao.jsx, Motorista.jsx).

   Porte de Sistemas/PONTO — app/main.py:
     _regua_local ..... main.py:191-299   (o coração da régua)
     _escolhe ......... main.py:218-232   (âncora mais próxima no tempo)
     _local_conhecido . main.py:335-342
     _local_dentro .... main.py:361-362
     _raio_local ...... main.py:356-358
     _dist_m .......... main.py:149-154   (Haversine, raio 6371000, arredondado)
     _hm2min .......... main.py:157-165
     _difmin .......... main.py:168-171   (diferença circular de 24 h)
     _ordena_pontas ... main.py:174-188
     _resolve_terminal  main.py:323-332
     _ALIAS_TERMINAL .. main.py:311-319
     LOCAIS ........... main.py:122-133
     RAIO_* ........... main.py:92-96

   MEXEU AQUI, MEXE LÁ — e vice-versa.
   ========================================================================== */

/* ------------------------------------------------------------------ raios --
   main.py:92-96. A régua é única: garagem, terminais, estações e apoios
   aceitam somente até 100 m. O veículo (gps_carro) aceita até 500 m —
   em 14/08 caiu de 1000 para 500, a pedido do DP.                            */
export const RAIO_GARAGEM = 100; // metros
export const RAIO_TERMINAL = 100; // metros
export const RAIO_LOCAL = RAIO_GARAGEM; // compatibilidade (main.py:94)
export const RAIO_VEIC = 500; // metros — batida × posição operacional do VEÍCULO

/* ----------------------------------------------------------------- locais --
   Cópia literal de main.py:122-133 (mesma ordem, mesmas coordenadas).        */
export const LOCAIS = [
  { nome: "Garagem 046", lat: -23.4801, lon: -46.3032 },
  { nome: "Terminal Santa Tereza", lat: -23.505333, lon: -46.357778 },
  { nome: "Terminal GCM", lat: -23.487727, lon: -46.349599 },
  { nome: "Terminal Manoel Feio", lat: -23.479842, lon: -46.367979 },
  { nome: "Estação Lado de Baixo", lat: -23.485251, lon: -46.348544 },
  { nome: "Apoio Estação", lat: -23.485393, lon: -46.347392 },
  { nome: "MOOV", lat: -23.47468, lon: -46.349947 },
  // Extraída da SST (centroide dos pings parados) e MANTIDA: fica a 178 m do
  // Terminal GCM, ou seja, dentro do mesmo complexo que o DP já reconhece —
  // não amplia a régua.
  { nome: "Estação Itaqua lado de cima", lat: -23.489316, lon: -46.349816 },
];
// ---------------------------------------------------------------------------
// OS 4 "PIV" SAÍRAM DAQUI EM 18/08 e não devem voltar sem o DP mandar
// (main.py:134-145):
//   PIV Emancipação · PIV Santa Marcelina · PIV Jardim Odete · PIV Caiuby
// Foram promovidos a "local conhecido" a partir do centroide dos pings parados
// da SST. Não passaram pelo DP — a lista oficial é a de cima — e a própria SST
// os classifica como marco de ROTA (poi_name dentro de cerca="Corredor" ou
// cerca="Manoel Feio"), não como local de trabalho.
// Efeito medido (01–18/08): absorviam 36 batidas, das quais 35 estavam FORA de
// qualquer local oficial — incluindo batidas a 2,1 km (Jardim Odete) e 4,3 km
// (Caiuby) do ponto legítimo mais próximo. Ou seja, legitimavam em silêncio
// justamente a batida que o cerco existe pra mostrar.
// ---------------------------------------------------------------------------
export const GARAGEM = LOCAIS[0]; // main.py:146 `_GARAGEM`

/* --------------------------------------------------------------- geometria */

/** Haversine, raio 6371000 m, resultado inteiro — igual ao `_dist_m` (main.py:149). */
export function distanciaM(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const dla = (lat2 - lat1) * rad;
  const dlo = (lon2 - lon1) * rad;
  const a =
    Math.sin(dla / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dlo / 2) ** 2;
  // Python usa int(...) = trunca para zero; distância é sempre >= 0.
  return Math.trunc(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Tipo da referência autorizada — main.py:345 `_tipo_local`. */
function tipoLocal(nome) {
  const x = String(nome ?? "").toLowerCase();
  if (x.startsWith("garagem")) return "garagem";
  if (x.startsWith("terminal")) return "terminal";
  if (x.startsWith("esta") || x.startsWith("apoio")) return "estacao";
  return "poi";
}

/** Raio oficial de cada referência autorizada — main.py:356 `_raio_local`. */
export function raioLocal(nome) {
  return tipoLocal(nome) === "terminal" ? RAIO_TERMINAL : RAIO_GARAGEM;
}

/**
 * Local conhecido MAIS PRÓXIMO (nome + distância em metros).
 * Porte de `_local_conhecido` (main.py:335). Só encontra o mais perto — quem
 * decide se vale é `dentroDoLocal`.
 */
export function localConhecido(lat, lon) {
  let melhor = null;
  for (const loc of LOCAIS) {
    const d = distanciaM(lat, lon, loc.lat, loc.lon);
    if (melhor === null || d < melhor.distancia) melhor = { nome: loc.nome, distancia: d };
  }
  return melhor;
}

/** `_local_dentro` (main.py:361): dentro do raio oficial daquela referência. */
export function dentroDoLocal(nome, distancia) {
  return distancia != null && distancia <= raioLocal(nome);
}

/* ------------------------------------------------------------ nomes/alias  */

/** `_norm` (main.py:305): sem acento, minúsculo, aparado. */
function normalizar(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Nome do terminal (Citatti/SST) -> um LOCAL conhecido (com coordenada), por
// palavra-chave. Cópia de `_ALIAS_TERMINAL` (main.py:311).
// O Citatti só dá o NOME do terminal; a coordenada mora na lista LOCAIS.
const ALIAS_TERMINAL = [
  [["feio"], "Terminal Manoel Feio"],
  [["teres", "tereza", "teresa"], "Terminal Santa Tereza"],
  [["gcm", "uberaba"], "Terminal GCM"],
  [["quata", "garagem", "quatai"], "Garagem 046"],
  [["moov"], "MOOV"],
  // "Est Itaqua." é AMBÍGUO (lado de cima × lado de baixo, ~500 m) — NÃO é
  // resolvido de propósito: melhor mostrar o nome sem medir do que colocar o
  // ônibus no lugar errado. É esta ausência que gera o "não medido" abaixo.
];

const COORD_POR_NOME = new Map(LOCAIS.map((l) => [l.nome, l]));

/** `_resolve_terminal` (main.py:323): nome -> {nome, lat, lon} ou null. */
export function resolverTerminal(nome) {
  const nn = normalizar(nome);
  if (!nn) return null;
  for (const [chaves, alvo] of ALIAS_TERMINAL) {
    if (chaves.some((k) => nn.includes(k))) {
      const loc = COORD_POR_NOME.get(alvo);
      if (loc) return { nome: alvo, lat: loc.lat, lon: loc.lon };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ tempo  */

/**
 * "HH:MM…" -> minutos do dia. Porte de `_hm2min` (main.py:157), com a
 * tolerância extra do lake do INOVE, que às vezes devolve a hora compacta
 * ("0410"); o Python só vê o formato com ":".
 */
export function horaParaMinutos(valor) {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  if (s.includes(":")) {
    const [a, b] = s.slice(0, 5).split(":");
    const h = parseInt(a, 10);
    const m = parseInt(b, 10);
    return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
  }
  const d = s.replace(/\D/g, "");
  if (d.length === 3) return parseInt(d[0], 10) * 60 + parseInt(d.slice(1), 10);
  if (d.length === 4) return parseInt(d.slice(0, 2), 10) * 60 + parseInt(d.slice(2), 10);
  return null;
}

/** "HH:MM" normalizado para exibição (vazio quando não dá pra ler). */
function horaTexto(valor) {
  const m = horaParaMinutos(valor);
  if (m == null) return "";
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

/** `_difmin` (main.py:168): diferença circular de 24 h — casa batida × veículo
 *  mesmo cruzando a meia-noite. */
export function difMin(a, b) {
  const d = Math.abs(a - b);
  return Math.min(d, 1440 - d);
}

/**
 * `_ordena_pontas` (main.py:174): ordena pela SEQUÊNCIA DA JORNADA (não pela
 * hora do relógio). Turno que cruza a meia-noite tem a madrugada no FIM —
 * rotaciona pelo MAIOR intervalo (o descanso).
 */
export function ordenarPontas(itens) {
  const comM = (itens || []).filter((x) => x.m != null);
  const semM = (itens || []).filter((x) => x.m == null);
  if (comM.length <= 1) return [...comM, ...semM];
  comM.sort((a, b) => a.m - b.m);
  const n = comM.length;
  let maior = -1;
  let corte = 0;
  for (let k = 0; k < n; k += 1) {
    const atual = comM[k].m;
    const prox = k + 1 < n ? comM[k + 1].m : comM[0].m + 1440;
    if (prox - atual > maior) {
      maior = prox - atual;
      corte = (k + 1) % n;
    }
  }
  return [...comM.slice(corte), ...comM.slice(0, corte), ...semM];
}

/* ------------------------------------------------------------ helpers crus */

/** Número utilizável, ou null. Espelha o `str(v or "").strip()` do Python:
 *  campo vazio/nulo/ilegível = sem coordenada. */
function numeroOuNulo(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const TIPOS_ANCORA = ["entrada", "saida", "almoco"];

/**
 * `_escolhe` (main.py:218): a âncora mais próxima no TEMPO da referência da
 * fase — mas PREFERE uma âncora SST *com coordenada* se ela estiver até 30 min
 * além da melhor. (bug CARLOS: a SST parou 05:51 e a operação foi até 12:22.)
 */
function escolher(candidatos, ref) {
  const cs = candidatos.filter((c) => c.m != null);
  const lista = cs.length ? cs : candidatos;
  if (!lista.length) return null;
  if (ref == null) {
    const comCoord = lista.filter((c) => c.lat != null);
    return (comCoord.length ? comCoord : lista)[0];
  }
  // Array.prototype.sort é estável (igual ao sorted do Python).
  const ordenados = [...lista].sort(
    (a, b) => (a.m != null ? difMin(a.m, ref) : 9999) - (b.m != null ? difMin(b.m, ref) : 9999),
  );
  const melhor = ordenados[0];
  const bd = melhor.m != null ? difMin(melhor.m, ref) : 9999;
  for (const c of ordenados) {
    if (c.fonte === "SST" && c.lat != null && c.m != null && difMin(c.m, ref) <= bd + 30) return c;
  }
  return melhor;
}

/* ============================================================================
   reguaLocal — batida × POSIÇÃO OPERACIONAL do veículo (main.py:191).
   ========================================================================= */

/**
 * @param {object} p
 * @param {Array}  p.batidas         linhas de `ponto_gps` do dia/crachá
 *                                   ({ hora, latitude, longitude, origem }).
 * @param {Array}  p.ancorasVeiculo  linhas de `gps_carro` do dia/crachá
 *                                   ({ tipo, hora, latitude, longitude,
 *                                      veiculo, poi, cerca, fonte, linha }).
 * @param {boolean} p.ehReserva      dia de RESERVA (ponto_gordura.tem_reserva_inove).
 * @param {string} p.opIni           início da janela da operação ("HH:MM").
 * @param {string} p.opFim           fim da janela da operação ("HH:MM").
 *
 * @returns {Array<{
 *   hora: string, papel: string|null,
 *   fora: true|false|null,      // null = NÃO MEDIDO (ver abaixo)
 *   distancia: number|null, via: "veiculo"|"local"|null,
 *   fonte: string, nomeLocal: string,
 *   distanciaLocal: number|null, distanciaGaragem: number|null,
 *   veiculo: string, poi: string, linha: string,
 *   horaVeiculo: string, origem: string, lat: number, lon: number, maps: string
 * }>}
 *
 * TRÊS ESTADOS de `fora` — e o do meio é o que faltava no INOVE:
 *   false → junto (medido e dentro da régua)
 *   true  → fora  (medido e acima da régua)
 *   null  → NÃO MEDIDO. A âncora do veículo existe mas veio SEM coordenada
 *           (terminal do Citatti que o `resolverTerminal` não resolve — caso
 *           deliberado do "Est Itaqua", ambíguo). Dá pra mostrar o NOME da
 *           operação, mas não dá pra medir distância nenhuma. Isso NUNCA pode
 *           ser contado como "junto": vira falso 'junto' e contamina régua e
 *           sugestão (bug ALENCAR/Ciganos, comentado em main.py:274-276).
 *
 * DIVERGÊNCIA CONSCIENTE do Python (main.py:294-297): lá, a âncora sem
 * coordenada cai no local conhecido da própria batida e o `fora` da linha
 * termina booleano — o "não medido" fica preso dentro de `veic["fora"]` e some
 * da tabela. Aqui ele sobe para o resultado da batida, para a tela poder
 * mostrar o terceiro estado em vez de escolher entre um falso "junto" e um
 * falso "fora". O veredito das outras situações é idêntico ao do Python.
 */
export function reguaLocal({
  batidas = [],
  ancorasVeiculo = [],
  ehReserva = false,
  opIni = "",
  opFim = "",
} = {}) {
  /* ---- 1) candidatos a âncora, por fase (main.py:195-215) ---- */
  const cand = { entrada: [], saida: [], almoco: [] };
  for (const v of ancorasVeiculo || []) {
    const tp = String(v?.tipo ?? "").trim();
    if (!TIPOS_ANCORA.includes(tp)) continue;
    const fonte = (String(v?.fonte ?? "").trim() || "SST").toUpperCase();
    let poi = String(v?.poi ?? "").trim() || String(v?.cerca ?? "").trim();
    let lat = numeroOuNulo(v?.latitude);
    let lon = numeroOuNulo(v?.longitude);
    if (lat != null && lon != null) {
      if (!poi) {
        const p = localConhecido(lat, lon);
        poi = p && dentroDoLocal(p.nome, p.distancia) ? p.nome : "";
      }
    } else {
      // Sem coordenada: a linha do Citatti vem só com o NOME do terminal.
      lat = null;
      lon = null;
      const res = resolverTerminal(poi);
      if (res) {
        poi = res.nome;
        lat = res.lat;
        lon = res.lon;
      }
    }
    cand[tp].push({
      m: horaParaMinutos(v?.hora),
      hora: horaTexto(v?.hora),
      lat,
      lon,
      veiculo: String(v?.veiculo ?? ""),
      poi,
      fonte,
      linha: String(v?.linha ?? ""),
    });
  }

  /* ---- 2) referências de tempo de cada fase (main.py:216-245) ---- */
  const oi = horaParaMinutos(opIni);
  const ofim = horaParaMinutos(opFim);
  const todosM = TIPOS_ANCORA.flatMap((tp) => cand[tp].map((c) => c.m)).filter((m) => m != null);
  const tEnt = oi != null ? oi : todosM.length ? Math.min(...todosM) : null;
  const tSai = ofim != null ? ofim : todosM.length ? Math.max(...todosM) : null;

  const refEnt = escolher(cand.entrada, tEnt);
  const refAlm = escolher(cand.almoco, null);
  const refSai = escolher(cand.saida, tSai);
  const tAlm = refAlm
    ? refAlm.m
    : tEnt != null && tSai != null
      ? Math.floor((tEnt + tSai) / 2)
      : null;

  const fases = [];
  if (refEnt) fases.push({ papel: "Entrada", ref: tEnt, ancora: refEnt });
  if (refAlm) fases.push({ papel: "Almoço", ref: tAlm, ancora: refAlm });
  if (refSai) fases.push({ papel: "Saída", ref: tSai, ancora: refSai });

  // `_fase` (main.py:247): a fase cuja referência está mais perto da batida.
  const acharFase = (pm) => {
    const comRef = fases.filter((f) => f.ref != null);
    const usar = comRef.length ? comRef : fases;
    if (!usar.length) return { papel: null, ancora: null };
    if (pm == null) return usar[usar.length - 1];
    let melhor = usar[0];
    let melhorD = usar[0].ref != null ? difMin(usar[0].ref, pm) : 9999;
    for (let i = 1; i < usar.length; i += 1) {
      const d = usar[i].ref != null ? difMin(usar[i].ref, pm) : 9999;
      if (d < melhorD) {
        melhorD = d;
        melhor = usar[i];
      }
    }
    return melhor;
  };

  /* ---- 3) batidas na ordem da JORNADA (main.py:256-262) ---- */
  const base = [];
  for (const r of batidas || []) {
    const la = numeroOuNulo(r?.latitude);
    const lo = numeroOuNulo(r?.longitude);
    if (la == null || lo == null) continue;
    base.push({ m: horaParaMinutos(r?.hora), r, la, lo });
  }

  /* ---- 4) veredito de cada batida (main.py:263-298) ---- */
  const saida = [];
  for (const it of ordenarPontas(base)) {
    const { r, la, lo } = it;
    const fase = acharFase(it.m);
    const mv = fase.ancora;
    const perto = localConhecido(la, lo);
    const nome = perto ? perto.nome : "";
    const dLoc = perto ? perto.distancia : null;
    const noLocal = dentroDoLocal(nome, dLoc);

    const item = {
      hora: horaTexto(r?.hora),
      papel: fase.papel ?? null,
      fora: null,
      distancia: null,
      via: null,
      fonte: "",
      nomeLocal: noLocal ? nome : "",
      // Nome do local mais próximo mesmo quando FORA do raio — serve para o
      // texto "a 2,1 km do Terminal GCM" sem fingir que a batida vale.
      localMaisProximo: nome,
      distanciaLocal: dLoc,
      distanciaGaragem: distanciaM(GARAGEM.lat, GARAGEM.lon, la, lo),
      veiculo: mv ? mv.veiculo : "",
      poi: mv ? mv.poi : "",
      linha: mv ? mv.linha : "",
      horaVeiculo: mv ? mv.hora : "",
      origem: String(r?.origem ?? ""),
      lat: la,
      lon: lo,
      maps: `https://www.google.com/maps?q=${la},${lo}`,
    };

    if (ehReserva && noLocal) {
      // DIA DE RESERVA (main.py:281-288): enquanto está de reserva ele NÃO TEM
      // CARRO — aguarda na garagem/terminal até assumir uma tabela. Medir essa
      // batida contra a posição do veículo (que só passa a ser dele horas
      // depois) é sem sentido: ANTONIO bateu 03:10 na Garagem 046 e aparecia
      // "a 4,9 km do veículo (07:08)". Em dia de reserva, batida em LOCAL
      // CONHECIDO vale por si.
      item.fora = false;
      item.via = "local";
      item.fonte = "RESERVA";
      item.distancia = dLoc;
    } else if (mv && mv.lat != null) {
      // Régua do veículo: acima de RAIO_VEIC (500 m) é suspeita.
      const dv = distanciaM(la, lo, mv.lat, mv.lon);
      item.fora = dv > RAIO_VEIC;
      item.via = "veiculo";
      item.fonte = mv.fonte || "";
      item.distancia = dv;
    } else if (mv) {
      // Âncora SEM coordenada -> NÃO MEDIDO. Não é junto e não é fora.
      item.fora = null;
      item.via = null;
      item.fonte = mv.fonte || "";
      item.distancia = null;
    } else {
      // Sem âncora nenhuma: cai na régua simples do local conhecido (100 m).
      item.fora = !noLocal;
      item.via = "local";
      item.fonte = "";
      item.distancia = dLoc;
    }

    saida.push(item);
  }
  return saida;
}

/* ============================================================================
   resumoGps — agregação por dia/crachá (espelha `get_gps_flags`, main.py:6929).
   ========================================================================= */

/**
 * @returns {{ total:number, fora:number, naoMedido:number, junto:number,
 *             maiorDistancia:number|null, horaMaisLonge:string }}
 *
 * `junto` conta SÓ o que foi medido e passou. Batida não medida fica no seu
 * próprio balde — somar as duas é exatamente o falso "junto" que a régua
 * existe para não produzir.
 */
export function resumoGps(resultado = []) {
  const r = { total: 0, fora: 0, naoMedido: 0, junto: 0, maiorDistancia: null, horaMaisLonge: "" };
  for (const b of resultado || []) {
    r.total += 1;
    if (b.fora == null) {
      r.naoMedido += 1;
      continue;
    }
    if (!b.fora) {
      r.junto += 1;
      continue;
    }
    r.fora += 1;
    // Igual ao agregador do Python: distância do veículo quando medida, senão
    // a da garagem — o número que o DP usa para dimensionar o desvio.
    const d = b.distancia != null ? b.distancia : b.distanciaGaragem;
    if (d != null && (r.maiorDistancia == null || d > r.maiorDistancia)) {
      r.maiorDistancia = d;
      r.horaMaisLonge = b.hora || "";
    }
  }
  return r;
}
