// comunicadoTransnet.js — O COMUNICADO QUE SAI DO INOVE E VAI PARA O TRANSNET.
//
// Porte de `Sistemas/PONTO/app/main.py`:
//   `_escrever_comunicados` (~2340)  — escreve o CSV e abre/atualiza os casos do ciclo
//   `gerar_comunicados`     (~2493)  — só o CSV (envio manual); SEMPRE registra o caso
//   `enviar_comunicados`    (~2507)  — CSV + bot; registra o caso SÓ quando confirmado
//   `enviar_aviso_interno`  (~2646)  — os três modelos de interno/aprendiz num envio só
//   `_rota_aviso` (~2593) / `_jornada_normal` (~2562) / `previa_aviso_interno` (~2624)
// e de `app/ui/app.js`: `comunicadoModal`, `msgLinha`, `varsPendentes`, `hmMsg`,
// `normalizaMensagem`, `fillTplRev`, `fillTplFora`.
//
// SEM React, SEM rede, SEM Supabase — no espírito de `regrasPonto.js`/`regrasGps.js`.
// Entra objeto/array, sai objeto/array. Quem chama decide o que grava e o que dispara.
//
// ─────────────────────────── ENCODING: A DIFERENÇA DA NUVEM ───────────────────────────
// A ferramenta desktop grava o CSV em disco com `encoding="cp1252"` porque o Transnet lê
// o arquivo como Windows-1252 (legado BR) e, em UTF-8, "divergências" chega como
// "divergÃªncias". NO CAMINHO DA NUVEM ISSO NÃO EXISTE: aqui o CSV não é arquivo, é
// INPUT de um workflow_dispatch do GitHub — viaja como JSON (UTF-8 por definição) e quem
// materializa o arquivo no runner é um `printf`, também UTF-8. Não há onde encaixar um
// cp1252 no meio, e não se deve tentar emular um: transcodificar aqui só produziria
// mojibake do outro lado. Essa diferença JÁ É ASSIM HOJE — é o mesmo caminho que a
// própria ferramenta usa quando despacha para o GitHub em vez de rodar o bot local.
// Se algum dia o Transnet reclamar de acento, o conserto é no runner (iconv antes do
// upload), não aqui.
//
// ───────────────────────────── O QUE NÃO PODE SER PERDIDO ─────────────────────────────
//  1. O CSV é o modelo do Transnet: cabeçalho Empresa · Crachá · Comunicado, TODOS os
//     campos entre aspas (QUOTE_ALL), UMA linha por pessoa.
//  2. Os BARRADOS. Aviso de gordura sem ponta a cobrar NÃO SAI (o texto sairia com o
//     genérico "o ponto" — um pedido que não pede nada — e 48 h depois viraria
//     advertência). Isso vale SÓ no caminho da gordura: em revmot/geral/fora o `ponta`
//     vazio é normal, e barrar por ele mataria justamente os avisos legítimos de quem
//     não bateu ponto. Quem é barrado tem de APARECER na tela, com o motivo — nunca
//     sumir da lista em silêncio.
//  3. `tipo="fora"` (bateu ponto fora) é JUSTIFICATIVA, não ajuste — mas ABRE
//     `ponto_caso`, com `origem="fora"`. Ver o bloco na montagem dos casos: o
//     docstring do Python diz o contrário do que o Python faz, e é o código que vale.
//     Abrir poria a pessoa em "Meus avisos" como ajuste e ainda sobrescreveria o caso de
//     gordura do MESMO DIA (a tabela tem UMA linha por crachá×dia).
//  4. Os casos do ciclo dos outros tipos, com o ALVO CONGELADO, e os REAVISOS: o que já
//     foi congelado FICA; o segundo aviso só recarimba a data (reiniciar o prazo é o
//     efeito pretendido) e vira uma linha de "já tinha sido avisado" para a tela.
//  5. `tipo="pedir_exclusao"` é o ÚNICO que manda APAGAR registro, e por isso é o único
//     com barreira de FORMATO do dia: sem a assinatura do coletor (1 a 3 marcações num
//     intervalo <= 2 min) o pedido não sai. Ele nasce SEM alvo e SEM ponta de propósito —
//     não há cartão a cobrar, e um alvo aqui viraria lançamento na correção.
import { pontaConta } from "./regrasGordura";
import {
  batidasDoCartao,
  hm2min,
  jornadaDoCartao,
  min2hm,
  removeFantasmas,
  CONSTANTES,
} from "./regrasPonto";

/* ═════════════════════════════ formato do Transnet ═════════════════════════════ */

/** main.py:2425 — a empresa é fixa no modelo oficial do Transnet. */
export const EMPRESA_TRANSNET = "046";

/** main.py:2361 — o cabeçalho, com acento, exatamente como o Transnet espera. */
export const CABECALHO_CSV = ["Empresa", "Crachá", "Comunicado"];

/** Valores aceitos pelo gateway (`supabase/functions/dp360-api`, robô `comunicado`).
 *  Texto livre aqui é 400 no servidor — a allowlist é dele, estas constantes só evitam
 *  a viagem perdida. ADVERTÊNCIA não é assunto desta tela: aviso primeiro, sempre. */
export const MOTIVO_AVISO = "102 (aviso)";
export const MOTIVO_ADVERTENCIA = "103 (ADVERTENCIA)";

/** Os caminhos de aviso do original. `interno` é o `enviar_aviso_interno` (três modelos
 *  num envio só); os outros quatro são os `tipo` de `_escrever_comunicados`. */
export const TIPO = {
  GORDURA: "gordura", // aviso da aba Gordura (ponta fora da régua)
  REVMOT: "revmot", // aviso da Revisão de motorista (falta marcação)
  GERAL: "geral", // aviso genérico de registro incompleto
  FORA: "fora", // bateu ponto fora de local conhecido (GPS) — justificativa
  INTERNO: "interno", // interno/aprendiz: almoço curto · incompleto · jornada curta
  // O ÚNICO PEDIDO QUE MANDA APAGAR. Dia de batida repetida do coletor: pedir que ele
  // "registre o ponto" é o pedido errado — não há o que registrar, há o que excluir.
  // No original o modelo existe (`_TPL.pedir_exclusao`, main.py:8036) e é editável no
  // Config, mas nenhuma rota o envia; a batida fantasma morria como diagnóstico de tela.
  PEDIR_EXCLUSAO: "pedir_exclusao",
};

/* ═════════════════════════════ helpers de texto ═════════════════════════════ */

const txt = (v) => String(v ?? "").trim();

/** main.py `_cracha8`: menos de 8 dígitos vira 8 com zeros à esquerda — senão o bot
 *  do Transnet quebra na busca do colaborador. */
export function cracha8(c) {
  const s = txt(c);
  return /^\d{1,7}$/.test(s) ? s.padStart(8, "0") : s;
}

/** main.py `_ddmm`: '2026-07-14' -> '14/07/2026'. Nada de `new Date()` — é recorte de
 *  string. Data que já venha em dd/mm/aaaa passa direto (é o que o Python faz). */
export function ddmmaaaa(d) {
  const s = txt(d).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [ano, mes, dia] = s.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return s;
}

/** app.js `hmMsg` — a mensagem vai para o COLABORADOR, e ele não entende "25:43".
 *  Hora >= 24:00 (turno que vira o dia) volta ao relógio e ganha o aviso. */
export function horaMensagem(v) {
  const s = txt(v);
  if (!s) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  if (h < 24) return `${String(h).padStart(2, "0")}:${m[2]}`;
  return `${String(h - 24).padStart(2, "0")}:${m[2]} (do dia seguinte)`;
}

/**
 * app.js `normalizaMensagem`. Duas coisas, nessa ordem:
 *   1. variável MAIÚSCULA que sobrou vira vazio — melhor um espaço a mais do que a
 *      pessoa receber "{PEDIDO}" cru na carta;
 *   2. espaço em excesso some, mas a QUEBRA DE LINHA fica (o modelo oficial do aviso
 *      ao motorista é escrito em parágrafos, e a prévia da tela mostra assim).
 * O achatamento para UMA linha é o passo seguinte (`umaLinha`), feito só no CSV.
 */
export function normalizaMensagem(texto) {
  return String(texto ?? "")
    .replace(/\{[A-Z_]+\}/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** main.py:2419 `" ".join(msg.split())` / app.js `msgLinha` — UMA linha por colaborador.
 *  O CSV do Transnet tem um campo Comunicado por pessoa; quebra de linha ali parte a
 *  linha do arquivo em duas e o import morre. */
export const umaLinha = (texto) => String(texto ?? "").replace(/\s+/g, " ").trim();

/**
 * app.js `varsPendentes`. Repare no CASE: `normalizaMensagem` já apagou as variáveis
 * MAIÚSCULAS que ninguém preencheu, então o que sobra aqui é `{data}`, `{Pedido}` —
 * erro de digitação no editor de template. É a trava que impede o envio.
 */
export function variaveisPendentes(texto) {
  return [...new Set(String(texto ?? "").match(/\{[A-Za-z_]+\}/g) || [])];
}

/**
 * Troca `{VAR}` pelo valor, sem diferenciar maiúscula/minúscula (é o `.replace(/\{X\}/gi)`
 * repetido de `fillTpl*`). Valor ausente vira string vazia e cai na limpeza do
 * `normalizaMensagem`. Não interpreta nada: quem monta o contexto é a tela.
 */
export function preencherTemplate(tpl, contexto) {
  let saida = String(tpl ?? "");
  for (const [chave, valor] of Object.entries(contexto || {})) {
    saida = saida.replace(new RegExp(`\\{${chave}\\}`, "gi"), String(valor ?? ""));
  }
  return normalizaMensagem(saida);
}

/** As batidas do cartão como o colaborador as lê: "04:10 · 11:27 · 16:52" (app.js
 *  `fillTplRev`, decisão do DP de 04/09/2026 — mostrar o que CONSTA ao lado do que falta). */
export function batidasParaTexto(linha, vazio = "nenhuma") {
  const bruto = txt(linha?.todas_batidas) || txt(linha?.batidas_limpas);
  const partes = bruto
    .split("|")
    .map((x) => x.trim().replace(/^[ES]+/, "").trim())
    .filter(Boolean);
  return partes.length ? partes.join(" · ") : vazio;
}

/** O nome do dia por extenso, do jeito que a carta fala ({DIA_SEMANA} — app.js `DIAX`).
 *  ARITMÉTICA DE CALENDÁRIO EM UTC, de propósito: `new Date("2026-08-09")` é lido como
 *  meia-noite UTC e, no BRT (UTC−3), `getDay()` devolveria o dia ANTERIOR — a carta diria
 *  "sábado" para um domingo. `Date.UTC(...)` + `getUTCDay()` não passa por fuso nenhum. */
const DIAS_EXTENSO = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];
export function diaSemanaExtenso(iso) {
  const s = txt(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [ano, mes, dia] = s.split("-").map(Number);
  return DIAS_EXTENSO[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()] || "";
}

/* ═════════════════ a batida indevida (a assinatura do coletor) ═════════════════ */

/**
 * app.js:4885-4888 (`acaoDia`) — DE 1 A 3 MARCAÇÕES NUM INTERVALO DE ATÉ 2 MIN NÃO É
 * JORNADA: é a mesma leitura do coletor repetida. Assinatura medida na base: 88 dias de
 * batida colada, 87 deles com EXATAMENTE 1 minuto entre a primeira e a última marcação.
 *
 * O SINAL É O SPAN, NÃO A SEMANA (app.js:4930). Exigir "semana cheia" deixava passar
 * MARCO AURELIO 15/08 (01:17/01:18) só porque a semana dele tinha 4 dias completos e não
 * 5. A semana entra como REFORÇO no texto da tela, nunca como condição.
 *
 * Quem colapsa a batida fantasma é o MOTOR (`removeFantasmas`, tolerância de 6 min):
 * aqui não existe uma segunda detecção, só a leitura do que ele devolveu.
 *
 * @returns { colada, marcacoes, span, reais, fantasmas } — `span` é null com menos de
 *          duas marcações (um toque solto também é "colada": não há jornada nenhuma ali).
 */
export const SPAN_COLADA_MAX = 2;
export const MARCACOES_COLADA_MAX = 3;

export function assinaturaExclusao(linha) {
  const mins = batidasDoCartao(txt(linha?.todas_batidas) || txt(linha?.batidas_limpas) || "");
  const span = mins.length >= 2 ? Math.max(...mins) - Math.min(...mins) : null;
  const { limpas, fora } = removeFantasmas(mins);
  return {
    colada:
      mins.length >= 1 && mins.length <= MARCACOES_COLADA_MAX && (span == null || span <= SPAN_COLADA_MAX),
    marcacoes: mins.length,
    span,
    reais: limpas.length,
    fantasmas: fora.map(min2hm),
  };
}

/* ═════════════════════════════ o CSV ═════════════════════════════ */

/** QUOTE_ALL do `csv.writer` do Python: TODOS os campos entre aspas, aspas internas
 *  duplicadas. O modelo do Transnet é assim e o import é posicional — campo sem aspas
 *  com vírgula no meio desloca a coluna Comunicado. */
const campoCsv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/**
 * O arquivo inteiro: cabeçalho + uma linha por pessoa.
 * `itens` = [{ cracha, mensagem }] — já barrados e já achatados para uma linha.
 * Sai com \n (o runner escreve com printf; o bot lê as duas convenções).
 */
export function csvComunicado(itens) {
  const linhas = [CABECALHO_CSV.map(campoCsv).join(",")];
  for (const item of itens || []) {
    linhas.push(
      [EMPRESA_TRANSNET, cracha8(item.cracha), umaLinha(item.mensagem)].map(campoCsv).join(","),
    );
  }
  return linhas.join("\n");
}

/* ═════════════════════════ o alvo congelado (contrato) ═════════════════════════ */

/**
 * main.py `_contrato_alvo` (~5932) — o alvo dos quatro slots que vai ao mesmo tempo
 * para o texto do aviso, para o `ponto_caso` (a régua do veredito) e, depois, para a
 * correção. Sem alvo completo e coerente NÃO EXISTE aviso automático: cobrar uma coisa
 * e lançar outra depois é pior do que deixar o DP revisar o caso na mão.
 *
 * O QUE MUDA NO INOVE. Lá o contrato é REDERIVADO (real manual > alvo congelado > régua
 * atual > cartão, e o almoço reancorado nas janelas livres do `viagens_qh`). Aqui não
 * há o que rederivar: a view do Athena já entrega `alvo_*`/`*_sug` decididos, o overlay
 * do Real manual já foi aplicado na linha (`aplicarRealManual`) e o motivo pelo qual o
 * dia NÃO pode ser usado já tem nome na tela — é o `sugBloqueio`, porte de `_sug_bloqueio`,
 * cujo próprio aviso diz "não dá para avisar nem lançar". Então o contrato daqui LÊ, e
 * as barreiras são as mesmas em espírito: bloqueio da sugestão, ponta faltando, cartão
 * fora de ordem. O texto dos motivos é o do Python, para o DP ler a mesma frase nas
 * duas ferramentas.
 *
 * @param linha    linha da Revisão (já com o overlay do Real manual)
 * @param bloqueio motivo devolvido por `sugBloqueio(linha)` ("" = liberado)
 * @returns { contrato: {alvo_entrada, alvo_alm_saida, alvo_alm_volta, alvo_saida} | null,
 *            erro: string }
 */
export function contratoDaRevisao(linha, bloqueio = "") {
  if (bloqueio) return { contrato: null, erro: bloqueio };

  const hora = (...fontes) => {
    for (const f of fontes) {
      const s = txt(f);
      if (s && s !== "--" && hm2min(s) != null) return s;
    }
    return "";
  };
  // Ordem de confiança do Python: real manual > alvo da view > sugestão > cartão.
  const entrada = hora(linha?.rm_entrada, linha?.alvo_entrada, linha?.entrada_sug, linha?.entrada);
  const saida = hora(linha?.rm_saida, linha?.alvo_saida, linha?.saida_sug, linha?.saida);
  if (!entrada || !saida) return { contrato: null, erro: "falta apurar entrada ou saída" };

  // `ponto_diario` chama o miolo de alvo_saida_almoco/alvo_volta_almoco; `ponto_caso`
  // chama de alvo_alm_saida/alvo_alm_volta. É o mesmo par — só o nome da coluna muda.
  const almSaida = hora(linha?.rm_alm_saida, linha?.alvo_saida_almoco, linha?.almoco_saida_sug);
  const almVolta = hora(linha?.rm_alm_volta, linha?.alvo_volta_almoco, linha?.almoco_volta_sug);
  const temAlmoco = !!(almSaida && almVolta);

  // Cartão cronológico, com a virada de meia-noite desenrolada (main.py
  // `_desenrola_cartao` + a checagem `mins[i] >= mins[i+1]`). Alvo fora de ordem não
  // pode virar cobrança: o bot lançaria um cartão impossível.
  const bruto = temAlmoco ? [entrada, almSaida, almVolta, saida] : [entrada, saida];
  const mins = [];
  let anterior = null;
  for (const h of bruto) {
    let m = hm2min(h);
    if (m == null) return { contrato: null, erro: "alvo não forma cartão cronológico" };
    if (anterior != null) while (m < anterior) m += 1440;
    if (anterior != null && m <= anterior) return { contrato: null, erro: "alvo não forma cartão cronológico" };
    anterior = m;
    mins.push(m);
  }
  if (mins[mins.length - 1] - mins[0] > 24 * 60) {
    return { contrato: null, erro: "alvo ultrapassa 24 horas" };
  }

  return {
    contrato: {
      alvo_entrada: entrada,
      alvo_alm_saida: temAlmoco ? almSaida : "",
      alvo_alm_volta: temAlmoco ? almVolta : "",
      alvo_saida: saida,
    },
    erro: "",
  };
}

/** main.py:2418 — a frase que fecha o aviso quando existe alvo: o colaborador precisa
 *  ler QUAL cartão está sendo pedido, não só "corrija o ponto". */
export function frasePedidoDoAlvo(contrato) {
  const alvo = [contrato?.alvo_entrada, contrato?.alvo_alm_saida, contrato?.alvo_alm_volta, contrato?.alvo_saida]
    .map((v) => horaMensagem(v))
    .filter(Boolean)
    .join(" · ");
  return alvo ? `O cartão solicitado deve ficar: ${alvo}.` : "";
}

/* ═════════════════════ o preparo: quem sai, quem é barrado ═════════════════════ */

/** main.py:2400 — o texto do barrado cita a porta histórica (10 min). A régua que de
 *  fato decide é direcional (`pontaConta`: 10 na entrada, 8 na saída, main.py:117-118);
 *  a frase ficou com o número redondo porque é a que o DP já lê há meses. */
const PORTA_TEXTO = CONSTANTES.TOL_ENTRADA_MIN;

/**
 * Monta o envio inteiro a partir das linhas marcadas na tela.
 *
 * @param {object}   opcoes
 * @param {string}   opcoes.tipo         um de `TIPO`
 * @param {Array}    opcoes.linhas       as linhas da tela (cru, como vieram do banco)
 * @param {Function} opcoes.mensagemDe   (linha) => texto já renderizado do template
 * @param {Function} [opcoes.alvoDe]     (linha) => { contrato, erro } — gordura e revmot
 * @param {Function} [opcoes.casoTipoDe] (linha) => "almoco"|"incompleto"|"curta" (interno)
 * @param {string}   [opcoes.agora]      carimbo ISO UTC do envio (instante, não data local)
 * @param {boolean}  [opcoes.comPontoAntes] gravar também a coluna `ponto_antes` do caso
 *
 * @returns {{ itens, barrados, casos, csv, datas }}
 *   itens    = [{ cracha, nome, data, mensagem, contrato, ponta }] — o que vai no CSV
 *   barrados = [{ cracha, nome, data, motivo }] — APARECEM na tela, não somem
 *   casos    = payloads de `ponto_caso` (um por pessoa, em TODOS os tipos)
 *   csv      = o arquivo pronto para o input do workflow
 *   datas    = as datas distintas do lote (o Transnet recebe UMA por envio)
 */
export function prepararComunicado({
  tipo,
  linhas,
  mensagemDe,
  alvoDe,
  casoTipoDe,
  agora,
  comPontoAntes = false,
}) {
  const carimbo = agora || new Date().toISOString(); // instante, não data local
  const itens = [];
  const barrados = [];
  const casos = [];
  const datas = new Set();

  // `gerar_comunicados`/`enviar_comunicados` (main.py:2496 e 2510) descartam quem não
  // tem crachá ANTES de qualquer coisa — sem crachá o bot não acha ninguém.
  for (const linha of (linhas || []).filter((x) => txt(x?.cracha))) {
    const dia = txt(linha.date_ref || linha.data_ref).slice(0, 10);
    const data = ddmmaaaa(dia);

    // main.py:2373 — QUAL ponta tem gordura a cobrar, pela régua direcional. Vale para
    // todos os tipos porque o `ponta` é gravado no caso; só a BARREIRA abaixo é
    // exclusiva da gordura.
    const temEntrada = pontaConta(linha.nivel_entrada, linha.gordura_entrada, "entrada");
    const temSaida = pontaConta(linha.nivel_saida, linha.gordura_saida, "saida");
    const ponta = temEntrada && temSaida ? "ambos" : temEntrada ? "entrada" : temSaida ? "saida" : "";

    const barra = (motivo) => {
      barrados.push({ cracha: txt(linha.cracha), nome: txt(linha.nm_funcionario), data, motivo });
    };

    // BARREIRA 1 (main.py:2394) — AVISO DE GORDURA SEM PONTA A COBRAR NÃO SAI. Sem ponta
    // o texto sai com o genérico "o ponto" no lugar de "a ENTRADA"/"a SAÍDA": um pedido
    // que não pede nada. Passadas 48 h sem resposta — e por que responderia? — vinha a
    // advertência. SÓ NO CAMINHO DA GORDURA: em revmot/geral/fora/interno o pedido não é
    // sobre ponta ("complete o cartão"), e barrar aqui mataria os avisos mais legítimos
    // que existem, os de quem não bateu ponto.
    if (tipo === TIPO.GORDURA && !ponta) {
      barra(`nenhuma ponta acima da porta de ${PORTA_TEXTO} min`);
      continue;
    }

    // BARREIRA 1b — A EXCLUSÃO SÓ SAI PARA DIA COM A ASSINATURA DO COLETOR. Este é o
    // único aviso que manda APAGAR registro, e ele é convincente: mandado num dia de
    // jornada real, convence a pessoa a excluir ponto que ela cumpriu — e isso não se
    // desfaz. Por isso a assinatura é conferida AQUI de novo, e não só na tela que
    // ofereceu o botão: quem monta o envio não pode depender de quem clicou.
    // Sem marcação nenhuma o texto sairia com "consta em seu cartão o registro nenhuma".
    if (tipo === TIPO.PEDIR_EXCLUSAO) {
      const assinatura = assinaturaExclusao(linha);
      if (!assinatura.marcacoes) {
        barra("cartão sem marcação — não há batida a excluir");
        continue;
      }
      if (!assinatura.colada) {
        barra(
          `sem assinatura de batida repetida (${assinatura.marcacoes} marcação(ões)` +
            `${assinatura.span == null ? "" : ` em ${assinatura.span} min`})` +
            ` — pedir exclusão aqui apagaria jornada real`,
        );
        continue;
      }
    }

    // BARREIRA 2 (main.py:2406) — sem contrato não existe aviso automático.
    let contrato = null;
    if (tipo === TIPO.GORDURA || tipo === TIPO.REVMOT) {
      const r = (alvoDe ? alvoDe(linha) : null) || {};
      if (!r.contrato) {
        barra(r.erro || "sem alvo único para o cartão");
        continue;
      }
      contrato = r.contrato;
    }

    let mensagem = umaLinha(mensagemDe ? mensagemDe(linha) : "");
    if (!mensagem) {
      barra("mensagem vazia para esta linha");
      continue;
    }
    const frase = contrato ? frasePedidoDoAlvo(contrato) : "";
    if (frase && !mensagem.includes(frase)) mensagem = `${mensagem} ${frase}`;

    datas.add(data);
    itens.push({
      cracha: txt(linha.cracha),
      nome: txt(linha.nm_funcionario),
      data,
      mensagem,
      contrato,
      ponta,
    });

    // ── ESPINHA ÚNICA (main.py:2428-2437): TODO aviso abre/atualiza o caso de
    // (crachá, dia) — inclusive o `fora`. Sem exceção.
    //
    // O docstring de `_escrever_comunicados` diz que `fora` não cria caso; o código,
    // 90 linhas abaixo, cria: `casos.append(dict(base, origem="fora", tipo="fora"))`.
    // Quem vale é o código, e o comentário que está em cima dele explica por quê: a
    // ORIGEM é que resolve o problema que o docstring temia — com `origem="fora"` o
    // aviso não é lido como ajuste e não colide com o cerco. O docstring ficou de
    // quando a distinção ainda não existia.
    //
    // E a diferença é funcional, não cosmética: é o `aviso_enviado_em` deste caso que
    // faz o dia contar como avisado. Sem ele, a recusa desse dia nas Ocorrências nunca
    // poderia virar advertência (`temAviso` lê justamente `ponto_caso.aviso_enviado_em`)
    // e o reaviso não seria detectado.

    const antes = txt(linha.batidas_limpas) || txt(linha.todas_batidas) || "";
    const base = {
      cracha: txt(linha.cracha),
      nm_funcionario: txt(linha.nm_funcionario),
      date_ref: dia,
      aviso_enviado_em: carimbo,
      // `usuario` é terra de ninguém: a conciliação e o bot escrevem recado de status
      // por cima e apagam o retrato. Por isso ele também vai em coluna própria.
      usuario: antes,
      atualizado_em: carimbo,
    };
    if (comPontoAntes) base.ponto_antes = antes;

    if (tipo === TIPO.FORA) {
      // Justificativa, não ajuste — a origem é o que mantém essa distinção.
      casos.push({ ...base, origem: "fora", tipo: "fora" });
    } else if (tipo === TIPO.PEDIR_EXCLUSAO) {
      // O RETRATO DO CARTÃO AQUI É O CRU, não o limpo. Nos outros cinco tipos `antes`
      // prefere `batidas_limpas`, e isso está certo lá; aqui não: o que se manda apagar
      // é justamente a marcação que o limpo DESCARTA. MANOEL 09/08 tem 01:15 e 01:16 no
      // cartão e `batidas_limpas = "01:16"` — guardar só o limpo apagaria do registro a
      // batida que a exclusão vai remover, e depois ninguém saberia o que existia ali.
      const cru = txt(linha.todas_batidas) || antes;
      base.usuario = cru;
      if (comPontoAntes) base.ponto_antes = cru;
      // PEDIDO DE APAGAR, NÃO DE AJUSTAR: nasce sem `ponta` e sem `alvo_*` de propósito.
      // Não há cartão a cobrar, e um alvo aqui viraria lançamento na correção — o bot
      // gravaria uma jornada num dia que não teve jornada, que é o erro oposto ao que
      // este aviso conserta.
      //
      // MAS ABRE O CASO, como todo aviso (a espinha única da main.py:2428): é o
      // `aviso_enviado_em` que faz o dia contar como avisado, permite o reaviso ser
      // detectado e deixa rastro de que a exclusão foi pedida. O `usuario`/`ponto_antes`
      // do `base` guarda o retrato do cartão ANTES — depois da exclusão o dia fica
      // vazio, e sem esse retrato ninguém sabe o que foi apagado.
      casos.push({ ...base, origem: "revisao", tipo: "exclusao" });
    } else if (tipo === TIPO.REVMOT) {
      casos.push({ ...base, origem: "revisao", tipo: "cerco", ponta, ...(contrato || {}) });
    } else if (tipo === TIPO.GERAL) {
      casos.push({ ...base, origem: "revisao", tipo: "incompleto" });
    } else if (tipo === TIPO.INTERNO) {
      // Interno/aprendiz é jornada-total: aviso genérico, SEM alvo (main.py:2679).
      casos.push({ ...base, origem: "revisao", tipo: casoTipoDe ? casoTipoDe(linha) : "incompleto" });
    } else {
      const gord =
        (temEntrada ? Math.abs(Number(linha.gordura_entrada) || 0) : 0) +
        (temSaida ? Math.abs(Number(linha.gordura_saida) || 0) : 0);
      casos.push({
        ...base,
        origem: "gordura",
        tipo: "cerco",
        ponta,
        gordura_min: gord ? String(Math.round(gord)) : "",
        nivel: temEntrada ? txt(linha.nivel_entrada) : temSaida ? txt(linha.nivel_saida) : "",
        ...(contrato || {}),
      });
    }
  }

  return { itens, barrados, casos, csv: csvComunicado(itens), datas: [...datas] };
}

/* ═════════════════════════════ reavisos ═════════════════════════════ */

/** main.py:2461 `_CONG` — o que é congelado no primeiro aviso e nunca reescrito. */
const CONGELADOS = [
  "origem",
  "tipo",
  "ponta",
  "nivel",
  "gordura_min",
  "alvo_entrada",
  "alvo_saida",
  "alvo_alm_saida",
  "alvo_alm_volta",
];

/**
 * main.py:2444 — O MESMO DIA AVISADO PELAS DUAS TELAS SOBRESCREVIA. `ponto_caso` tem UMA
 * linha por (crachá, dia): avisado pela Gordura grava origem='gordura' com o alvo da
 * ponta cobrada; avisado pela Revisão grava origem='revisao' com a sugestão do cartão
 * inteiro. Quem clicasse por último apagava o registro do primeiro — origem, alvo e o que
 * foi pedido — e o caso passava a contar outra história, sem rastro.
 *
 * Agora o que já foi congelado FICA. O segundo aviso só recarimba a data (o prazo
 * reinicia, que é o efeito pretendido de reavisar) e vira uma linha de `reavisos` para a
 * tela poder dizer que aquilo já tinha sido pedido antes, e por qual caminho.
 *
 * `congelar=false` reproduz o `enviar_aviso_interno`, que NÃO congela: lá o tipo do caso
 * (almoco/incompleto/curta) decide se o ciclo de 48 h roda, então travá-lo no primeiro
 * aviso deixaria um "incompleto" registrado como "almoço curto" e sem prazo correndo.
 *
 * @param casos   payloads devolvidos por `prepararComunicado`
 * @param casoDe  (cracha, date_ref) => caso já gravado (ou null)
 * @returns { casos: paraGravar, reavisos: [{cracha, nome, date_ref, origem_anterior, avisado_em}] }
 */
export function marcarReavisos(casos, casoDe, { congelar = true } = {}) {
  const paraGravar = [];
  const reavisos = [];
  for (const caso of casos || []) {
    const anterior = (casoDe ? casoDe(caso.cracha, caso.date_ref) : null) || {};
    const jaAvisado = txt(anterior.aviso_enviado_em);
    if (!jaAvisado) {
      paraGravar.push(caso);
      continue;
    }
    reavisos.push({
      cracha: caso.cracha,
      nome: caso.nm_funcionario || txt(anterior.nm_funcionario),
      date_ref: caso.date_ref,
      origem_anterior: txt(anterior.origem),
      avisado_em: jaAvisado.slice(0, 10),
    });
    if (!congelar) {
      paraGravar.push(caso);
      continue;
    }
    const copia = { ...caso };
    for (const chave of CONGELADOS) delete copia[chave];
    paraGravar.push(copia);
  }
  return { casos: paraGravar, reavisos };
}

/* ═══════════════ interno/aprendiz: qual dos três modelos (main.py `_rota_aviso`) ═══════════════ */

/** main.py:2551 — jornada curta é < 60 % da mediana da PRÓPRIA pessoa, com >= 10 dias de
 *  base. A escala do interno no cadastro é lixo (00:00-06:20 para quem trabalha 8 h), então
 *  o "normal" dele sai do próprio histórico de batidas. 50 % deixava passar meio dia de
 *  trabalho (4h26 numa mediana de 8h27 = 52 %). */
export const CURTA_FRACAO = 0.6;
export const CURTA_MIN_DIAS = 10;

/** main.py:2543 `_AV_ALMOCO` / `_AV_INCOMPLETO` — o roteamento por motivo da Revisão.
 *  BATIDAS a mais NÃO entra aqui: é decidido pelo nº de batidas depois de tirar o
 *  fantasma (se limpa para <= 4, vira sugestão e não avisa; se fica > 4, avisa). */
const MOTIVOS_ALMOCO = new Set(["ALMOCO_CURTO", "FALTA_ALMOCO"]);
const MOTIVOS_INCOMPLETO = {
  BATIDA_UNICA: "só há uma batida no dia",
  FALTA_SAIDA: "faltou registrar a saída",
  FALTA_ENTRADA: "faltou registrar a entrada",
  VOLTA_ALMOCO_ESQUECIDA: "faltou registrar a volta do almoço",
};

/** main.py `_motivo_chave`: 'FALTA_ALMOCO (jornada >= 6h)' -> 'FALTA_ALMOCO'. */
const motivoChave = (m) => txt(m).split("(")[0].trim().toUpperCase();

/** main.py `_jornada_liq` — jornada líquida (min) do cartão, com o fantasma do coletor
 *  já removido. `null` com menos de 2 batidas. */
export function jornadaLiquidaDoDia(linha) {
  const { limpas } = removeFantasmas(batidasDoCartao(linha?.todas_batidas || linha?.batidas_limpas || ""));
  return jornadaDoCartao(limpas).liquida;
}

/** main.py `_batidas_limpas_n` — nº de batidas REAIS depois de tirar o fantasma. */
export function batidasLimpasN(linha) {
  return removeFantasmas(batidasDoCartao(linha?.todas_batidas || linha?.batidas_limpas || "")).limpas.length;
}

/**
 * main.py `_jornada_normal` — a mediana da jornada de cada interno/aprendiz, tirada do
 * PRÓPRIO histórico. Só entra quem tem >= 10 dias com jornada apurada.
 * @param historico linhas de ponto_diario (cracha, todas_batidas, categoria)
 * @returns Map(cracha8 -> mediana em minutos)
 */
export function medianasJornada(historico) {
  const porCracha = new Map();
  for (const r of historico || []) {
    const cat = txt(r.categoria).toUpperCase();
    if (cat !== "INTERNO" && cat !== "APRENDIZ") continue;
    const liq = jornadaLiquidaDoDia(r);
    if (liq == null || liq <= 0) continue;
    const chave = cracha8(r.cracha);
    if (!porCracha.has(chave)) porCracha.set(chave, []);
    porCracha.get(chave).push(liq);
  }
  const medianas = new Map();
  for (const [chave, valores] of porCracha) {
    if (valores.length < CURTA_MIN_DIAS) continue;
    valores.sort((a, b) => a - b);
    const meio = Math.floor(valores.length / 2);
    // statistics.median do Python: par -> média dos dois centrais.
    medianas.set(chave, valores.length % 2 ? valores[meio] : (valores[meio - 1] + valores[meio]) / 2);
  }
  return medianas;
}

/**
 * main.py `_rota_aviso` — roteia UM dia de interno/aprendiz.
 * Ordem deliberada: jornada curta > batidas a mais (registro confuso) > almoço > falta batida.
 * @returns { modelo: "curta"|"incompleto"|"almoco"|null, divergencia: string }
 */
export function rotaAvisoInterno(linha, medianas) {
  const liq = jornadaLiquidaDoDia(linha);
  const mediana = medianas ? medianas.get(cracha8(linha?.cracha)) : null;

  // 1) fez menos da metade do que normalmente faz
  if (liq != null && mediana && liq < mediana * CURTA_FRACAO) {
    return { modelo: "curta", divergencia: `${Math.floor(liq / 60)}h${String(liq % 60).padStart(2, "0")}` };
  }
  // 2) registro confuso: MAIS de 4 batidas mesmo depois de tirar o fantasma. A máquina
  //    não limpa -> a pessoa precisa arrumar. (Se limpasse para <= 4 viraria sugestão.)
  if (batidasLimpasN(linha) > 4) {
    return { modelo: "incompleto", divergencia: "há batidas a mais no registro" };
  }
  // 3) o resto só vale para quem a revisão marcou como pendente
  if (txt(linha?.status_ponto).toUpperCase() !== "REVISAR") return { modelo: null, divergencia: "" };

  const chave = motivoChave(linha?.motivo);
  if (MOTIVOS_ALMOCO.has(chave)) {
    // Só é caso de almoço se a jornada realmente passa de 6 h — o rótulo do motivo não
    // é confiável sozinho.
    if (liq == null || liq < CONSTANTES.JORNADA_EXIGE_ALMOCO) return { modelo: null, divergencia: "" };
    return { modelo: "almoco", divergencia: "" };
  }
  if (MOTIVOS_INCOMPLETO[chave]) return { modelo: "incompleto", divergencia: MOTIVOS_INCOMPLETO[chave] };
  return { modelo: null, divergencia: "" };
}

/* ═════════════════════════════ templates ═════════════════════════════ */

/** As chaves do `app_config` (main.py `get_templates` / aba Config do INOVE). */
export const chaveTemplate = (tipo) => `template_${tipo}`;

/**
 * Texto oficial (Quataí + Art. 74 da CLT) — cópia de `Api._TPL_DEFAULT` (main.py:8059).
 * É o que sai quando a chave está VAZIA no `app_config`. Só os modelos que ESTA rota de
 * comunicado usa; a aba Config tem a lista completa e é onde eles se editam.
 * CÓPIA: mexeu no main.py, atualize aqui e lá.
 */
export const TEMPLATES_PADRAO = {
  ocorrencia_motorista:
    "Prezado(a) {NOME},\n\nCrachá {CRACHA},\n\nIdentificamos que, no dia {DATA}, NÃO houve marcação de {DIVERGENCIA} no seu registro de ponto.\n\nNos termos do art. 74 da CLT, o registro de ponto deve refletir a jornada efetivamente realizada. Solicitamos que {PEDIDO}, por meio do aplicativo de registro de ponto, no prazo de 48 horas.\n\nEm caso de dúvidas, procure seu supervisor imediato ou o Departamento Pessoal.\n\nAtenciosamente,\n\nDP — Quataí Transporte de Passageiros.",
  // BATIDA INDEVIDA (main.py:8085): o oposto do `registro_incompleto`. Aqui o dia NÃO foi
  // trabalhado — são marcações coladas, sobra de um toque no relógio. Pedir que ele
  // "registre as batidas" seria o pedido errado, e é o que a tela mandava até agora.
  pedir_exclusao:
    "Prezado(a) {NOME}, crachá {CRACHA}. No dia {DATA} ({DIA_SEMANA}) consta em seu cartão o registro {BATIDAS}, sem jornada correspondente. Pelo que apuramos, não houve trabalho nesse dia — trata-se de marcação indevida. Solicitamos que peça a EXCLUSÃO desse registro pelo aplicativo de ponto no prazo de 48 horas, para que seu cartão reflita a jornada efetivamente cumprida (Art. 74 da CLT). Em caso de dúvida, procure seu supervisor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  aviso_fora:
    "Prezado(a) {NOME}, crachá {CRACHA}. Identificamos que seu registro de ponto do dia {DATA} foi realizado FORA de local autorizado (garagem ou terminal): a batida das {HORA} ficou a {DISTANCIA} da garagem. O ponto deve ser registrado no seu local de trabalho. Solicitamos que justifique essa ocorrência com seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  interno_almoco:
    "Prezado(a) {NOME}, crachá {CRACHA}. No seu ponto do dia {DATA}, o intervalo de almoço ficou abaixo de 1 hora. Lembramos que o descanso mínimo de 1 hora é um direito do colaborador — por favor, respeite essa regra. Em caso de dúvida, procure seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  interno_incompleto:
    "Prezado(a) {NOME}, crachá {CRACHA}. Seu registro de ponto do dia {DATA} está incompleto: {DIVERGENCIA}. Por favor, ajuste pelo aplicativo de ponto em até 24 horas. Em caso de dúvida, procure seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
  interno_curta:
    "Prezado(a) {NOME}, crachá {CRACHA}. Seu registro de ponto do dia {DATA} apresenta jornada abaixo do normal ({JORNADA}). Por favor, verifique se todas as batidas foram registradas e, se faltar alguma, ajuste pelo aplicativo de ponto em até 24 horas. Em caso de dúvida, procure seu gestor ou o Departamento Pessoal. Atenciosamente, DP — Quataí Transporte de Passageiros.",
};

/** `app_config.valor` é jsonb e a ferramenta grava STRING. Texto salvo tem prioridade;
 *  vazio cai no modelo oficial (main.py `get_templates`). */
export function escolherTemplate(valorDoBanco, tipo) {
  const salvo = typeof valorDoBanco === "string" ? valorDoBanco : valorDoBanco == null ? "" : String(valorDoBanco);
  return salvo.trim() ? salvo : TEMPLATES_PADRAO[tipo] || "";
}

/* ═══════════ os textos por linha (o `__msg` que o front já renderizava) ═══════════ */

/**
 * app.js `fillTplRev` — o aviso da REVISÃO de motorista. Usa a SUGESTÃO/Real manual
 * (não o nível/real da gordura). Com alvo, pede o horário; sem alvo, pede apenas o
 * registro da marcação identificada.
 * @param divergencia o que FALTA ("ENTRADA" | "SAÍDA" | "ENTRADA E SAÍDA"), já decidido
 *                    pela tela (`marcacaoAusente`, porte de `marcacaoMotoristaAusente`)
 */
export function mensagemRevisaoMotorista(template, linha, divergencia) {
  // Real manual do DP manda: se ele cravou, a mensagem pede o horário DELE.
  const entrada = horaMensagem(txt(linha.rm_entrada) || txt(linha.entrada_sug));
  const saida = horaMensagem(txt(linha.rm_saida) || txt(linha.saida_sug));
  const precisaEntrada = divergencia === "ENTRADA" || divergencia === "ENTRADA E SAÍDA";
  const precisaSaida = divergencia === "SAÍDA" || divergencia === "ENTRADA E SAÍDA";
  const temAlvo = (!precisaEntrada || !!entrada) && (!precisaSaida || !!saida);
  const pedido = !temAlvo
    ? `realize o registro de ${divergencia}`
    : divergencia === "ENTRADA"
      ? `realize o ajuste do horário de ENTRADA para ${entrada}`
      : divergencia === "SAÍDA"
        ? `realize o ajuste do horário de SAÍDA para ${saida}`
        : `realize o ajuste dos horários de ENTRADA E SAÍDA para ${entrada} e ${saida}`;
  return preencherTemplate(template, {
    NOME: txt(linha.nm_funcionario) || "Colaborador(a)",
    CRACHA: txt(linha.cracha),
    DATA: ddmmaaaa(linha.date_ref || linha.data_ref),
    // {BATIDAS}: o que CONSTA no cartão, ao lado do que falta (decisão do DP de
    // 04/09/2026). "NÃO houve marcação de ENTRADA E SAÍDA" é verdadeiro e soa como
    // "você não bateu o ponto"; mostrar o cartão junto deixa claro que a ferramenta viu
    // o que ele fez, e torna o pedido difícil de contestar.
    BATIDAS: batidasParaTexto(linha),
    ESCALA: `${txt(linha.esc_entrada) || "--"} – ${txt(linha.esc_saida) || "--"}`,
    DIVERGENCIA: divergencia,
    PEDIDO: pedido,
  });
}

/**
 * app.js `fillTplFora` — bateu ponto fora de local conhecido (GPS). Os números saem do
 * resumo do GPS da própria tela (`resumoGps`): a batida MAIS DISTANTE e quantas ficaram
 * fora. Não pede ajuste de horário: pede JUSTIFICATIVA.
 */
export function mensagemBateuFora(template, linha, gps) {
  const d = gps?.maiorDistancia;
  const distancia = d == null ? "—" : d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d)} m`;
  return preencherTemplate(template, {
    NOME: txt(linha.nm_funcionario) || "Colaborador(a)",
    CRACHA: txt(linha.cracha),
    DATA: ddmmaaaa(linha.date_ref || linha.data_ref),
    HORA: horaMensagem(gps?.horaMaisLonge),
    DISTANCIA: distancia,
    QTD: gps?.fora || "",
  });
}

/**
 * app.js `fillTplDia(..., "pedir_exclusao")` — o pedido de EXCLUSÃO de batida indevida.
 * Não pede horário nenhum, e não pode pedir: o dia não teve jornada. As variáveis são as
 * cinco declaradas em `_TPL_VARS` (main.py:8046) — {BATIDAS} é o que consta no cartão
 * (é o registro que se pede para apagar, então tem de estar escrito na carta) e
 * {DIA_SEMANA} é o nome do dia, que é justamente o que faz a pessoa reconhecer a folga.
 */
export function mensagemPedirExclusao(template, linha) {
  return preencherTemplate(template, {
    NOME: txt(linha.nm_funcionario) || "Colaborador(a)",
    CRACHA: txt(linha.cracha),
    DATA: ddmmaaaa(linha.date_ref || linha.data_ref),
    DIA_SEMANA: diaSemanaExtenso(linha.date_ref || linha.data_ref),
    BATIDAS: batidasParaTexto(linha),
  });
}

/** main.py `enviar_aviso_interno` (~2670) — os três modelos do interno/aprendiz.
 *  {JORNADA} e {DIVERGENCIA} recebem o MESMO valor no Python (o `divergencia` da rota):
 *  no modelo "curta" ele é a jornada apurada; nos outros, a frase do que falta. */
export function mensagemInterno(template, linha, divergencia) {
  return preencherTemplate(template, {
    NOME: txt(linha.nm_funcionario) || "Colaborador(a)",
    CRACHA: cracha8(linha.cracha),
    DATA: ddmmaaaa(linha.date_ref || linha.data_ref),
    DIVERGENCIA: divergencia,
    JORNADA: divergencia,
  });
}

export default {
  EMPRESA_TRANSNET,
  CABECALHO_CSV,
  MOTIVO_AVISO,
  MOTIVO_ADVERTENCIA,
  TIPO,
  cracha8,
  ddmmaaaa,
  horaMensagem,
  diaSemanaExtenso,
  normalizaMensagem,
  umaLinha,
  variaveisPendentes,
  preencherTemplate,
  batidasParaTexto,
  SPAN_COLADA_MAX,
  MARCACOES_COLADA_MAX,
  assinaturaExclusao,
  csvComunicado,
  contratoDaRevisao,
  frasePedidoDoAlvo,
  prepararComunicado,
  marcarReavisos,
  jornadaLiquidaDoDia,
  batidasLimpasN,
  medianasJornada,
  rotaAvisoInterno,
  chaveTemplate,
  TEMPLATES_PADRAO,
  escolherTemplate,
  mensagemRevisaoMotorista,
  mensagemBateuFora,
  mensagemPedirExclusao,
  mensagemInterno,
};
