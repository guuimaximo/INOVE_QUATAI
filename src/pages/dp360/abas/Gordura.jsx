import { useCallback, useEffect, useMemo, useState } from "react";
import { Bus, CalendarClock, Info, PauseCircle, X } from "lucide-react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import {
  dispararRoboDP360,
  lerDP360,
  lerDatasDP360,
  lerTudoDP360,
  upsertDP360,
} from "../../../services/dp360Api";
// O CARTÃO DO DIA É O MESMO DA REVISÃO (pedido do dono, 06/09: "na verdade é o mesmo
// pop-up de análise do da Revisão"). Com ele a Gordura ganhou o que não tinha: o bloco
// "3 · Real" e o "4 · Real manual do DP" — a linha barrada por "revisar alvo e
// refeição" só destrava cravando o Real, e até agora isso obrigava a sair da Gordura e
// reachar pessoa+dia na Revisão.
//
// A leitura da RESERVA lançada no INOVE também vem de lá, uma vez só: a tabela
// `reservas_motoristas` mora na base do PRÓPRIO INOVE (quem grava é
// src/pages/pessoas/ControleReservas.jsx:91-99 e 460-489), NÃO na base de importação
// do DP360. Por isso ela não está (nem deve estar) na allowlist do gateway
// `dp360-api`: lê-se com o cliente Supabase normal do INOVE, exatamente como o app
// antigo faz em ferramenta/supabase_client.py:695-715.
import CartaoDoDia, { aplicarRealManual, lerReservasInove } from "../CartaoDoDia";
// AS QUATRO CAMADAS DA GORDURA (o `_gord()` do app antigo) e as conversões que elas
// exigem moram em `regrasGordura.js` — módulo puro, sem React e sem rede. Estavam
// escritas aqui dentro e por isso o Resumo não conseguia mostrar oportunidade sem
// reimplementá-las (e devolver outro número). A régua é a MESMA nas duas telas.
import {
  PRECEDENCIA,
  aplicarCamadasGordura,
  chaveDe,
  cracha8,
  dia10,
  ehVerdade,
  fmtHora,
  hm2m,
  maiorPonta,
  nivKey,
  num,
  passaRegua,
  pontaConta,
  txt,
} from "../regrasGordura";
// O COMUNICADO NÃO É DESTA TELA: o formato do CSV do Transnet, a trava dos barrados,
// o payload de `ponto_caso` (com o alvo congelado) e os reavisos moram em
// `../comunicadoTransnet` — porte de main.py `_escrever_comunicados` (~2340). A
// Revisão manda o MESMO arquivo pelo MESMO robô; aqui só se escolhe QUEM entra,
// QUAL alvo cobrar e COMO o texto é escrito.
import {
  MOTIVO_AVISO,
  TIPO,
  batidasParaTexto,
  ddmmaaaa,
  escolherTemplate,
  horaMensagem,
  marcarReavisos,
  prepararComunicado,
  preencherTemplate,
  variaveisPendentes,
} from "../comunicadoTransnet";

// ---------------------------------------------------------------------------
// PASSO 4 — GORDURA DE PONTO (só MOTORISTA).
//
// Gordura = tempo que a pessoa BATEU PONTO A MAIS do que operou, medido só nas
// PONTAS (entrada e saída), nunca na jornada inteira. Interno/aprendiz não têm
// operação (GPS/SST/bilhetagem), então não há gordura a calcular — o tratamento
// deles é o aviso da Revisão (Passo 2).
//
// Porte de `viewP4Motorista` (Sistemas/PONTO — app/ui/app.js) + das camadas que
// o app antigo aplica na LEITURA (app/main.py `_gord`).
//
// O QUE ESTA ABA GRAVA: nada do cálculo — a gordura continua sendo LIDA. O único
// caminho de escrita é o `📣 Enviar Ocorrência` (o `g4auto` do app antigo): ele
// dispara o robô do Transnet com o CSV do comunicado e, quando o envio é o de
// verdade, abre/atualiza `ponto_caso` com o alvo CONGELADO. As regras desse envio
// são de `../comunicadoTransnet`, não daqui.
// ---------------------------------------------------------------------------

// A RÉGUA FIXA DO DP (10 min na entrada, 8 na saída), as tolerâncias da reserva e a
// assinatura da reserva por GPS ficam em `regrasGordura.js` — são regra, não tela.

const PISOS = [
  { valor: 0, rotulo: "tudo" },
  { valor: 15, rotulo: "15 min" },
  { valor: 30, rotulo: "30 min" },
  { valor: 60, rotulo: "1 hora" },
  { valor: 120, rotulo: "2 horas" },
];

/* ---------------------------- formatação da tela --------------------------- */
// As conversões que a REGRA usa (txt, num, hm2m, fmtHora, cracha8, chaveDe…) vêm de
// `regrasGordura.js`. Aqui ficam só as que existem para desenhar a célula.
function durHM(ini, fim, almoco = 0) {
  const a = hm2m(ini);
  const b = hm2m(fim);
  if (a == null || b == null) return "—";
  let d = b - a;
  if (d < 0) d += 1440;
  d -= almoco;
  if (d < 0) d = 0;
  return `${Math.floor(d / 60)}h${String(d % 60).padStart(2, "0")}`;
}
const fmtData = (d) => {
  const iso = dia10(d);
  if (iso.length !== 10) return iso || "—";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};
const H = (v) => fmtHora(v) || "—";
const semAcento = (s) =>
  txt(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/* --------------------------------- níveis ---------------------------------- */
const NIVEL_LBL = {
  P1: "P1",
  P2: "P2",
  P3: "P3",
  P3_SEM_CONFIRMACAO: "P3⁻",
  P4: "P4",
  RESERVA: "Reserva",
  OPERACAO_FORA_PONTO: "fora do ponto",
  NAO_CALCULAR: "n/calc",
  ANOMALIA_TEMPORAL: "anomalia",
};
// Variantes de `.dp-gmark` (dp360.css) — as MESMAS cores de nível da ferramenta
// (app/ui/styles.css `.gmark.g-p1..g-neu`), não a paleta do INOVE.
const NIVEL_GCLS = {
  P1: "g-p1",
  P2: "g-p2",
  P3: "g-p3",
  P3_SEM_CONFIRMACAO: "g-p3",
  P4: "g-p4",
  RESERVA: "g-res",
  OPERACAO_FORA_PONTO: "g-fora",
  NAO_CALCULAR: "g-neu",
  ANOMALIA_TEMPORAL: "g-neu",
};
// Tolerância / sem dado / ponto incompleto não são gordura: a célula fica "—".
const NIVEIS_MUDOS = new Set(["", "TOLERANCIA_OPERACIONAL", "SEM_DADO", "PONTO_INCOMPLETO"]);
// `nivKey` (P3⁻ conta como P3) e `PRECEDENCIA` (a linha é pintada pelo PIOR nível)
// vêm de `regrasGordura.js` — são regra, e o Resumo conta pelo mesmo critério.
// A LINHA INTEIRA pintada (não uma borda lateral): é assim que a ferramenta mostra o
// nível — `.dp-tabela tbody tr.row-p1 td` e irmãs, porte de app/ui/styles.css.
const LINHA_CLS = {
  P1: "row-p1",
  P2: "row-p2",
  P3: "row-p3",
  P4: "row-p4",
  RESERVA: "row-res",
  OPERACAO_FORA_PONTO: "row-fora",
};
function classeLinha(r) {
  const ks = [nivKey(r.nivel_entrada), nivKey(r.nivel_saida)];
  const pior = PRECEDENCIA.find((n) => ks.includes(n));
  return pior ? LINHA_CLS[pior] : "";
}
const CHIPS = [
  ["TODOS", "Todas"],
  ["P1", "P1"],
  ["P2", "P2"],
  ["P3", "P3"],
  ["P4", "P4"],
  ["RESERVA", "Reserva"],
  ["OPERACAO_FORA_PONTO", "Fora"],
];

/* --------------------------- cartão de ponto e alvo ------------------------ */
function cartaoValido(horas) {
  const h = (horas || []).map((v) => fmtHora(v) || "");
  if (!h[0] || !h[3] || !!h[1] !== !!h[2]) return false;
  // Dia sem intervalo é um cartão válido de duas batidas. Com almoço, os quatro
  // horários precisam estar em ordem, inclusive em turno que cruza a meia-noite.
  const usados = h[1] && h[2] ? h : [h[0], h[3]];
  let anterior = hm2m(usados[0]);
  if (anterior == null) return false;
  const inicio = anterior;
  for (let i = 1; i < usados.length; i += 1) {
    let atual = hm2m(usados[i]);
    if (atual == null) return false;
    while (atual < anterior) atual += 1440;
    anterior = atual;
  }
  return anterior - inicio <= 1440;
}

// Motorista normalmente não bate almoço. Quando o DP já lançou a refeição no cartão,
// o Transnet desenha S almoço → E almoço → S artificial (poucos minutos depois). Esse
// último S não é a saída real.
function refeicaoLancadaNoCartao(bruto, entrada) {
  const marcas = [...txt(bruto).matchAll(/([ES])?\s*(\d{1,2}:\d{2})/gi)].map((m) => ({
    tipo: (m[1] || "").toUpperCase(),
    hora: fmtHora(m[2]),
  }));
  const mins = marcas.map((m) => hm2m(m.hora));
  for (let i = 1; i < mins.length; i += 1) {
    while (mins[i] != null && mins[i - 1] != null && mins[i] < mins[i - 1]) mins[i] += 1440;
  }
  for (let i = 0; i + 2 < marcas.length; i += 1) {
    if (marcas[i].tipo !== "S" || marcas[i + 1].tipo !== "E" || marcas[i + 2].tipo !== "S") continue;
    const [ini, fim, fecha] = [mins[i], mins[i + 1], mins[i + 2]];
    if (ini == null || fim == null || fecha == null) continue;
    let ent = hm2m(entrada);
    while (ent != null && ent > ini) ent -= 1440;
    if (ini >= (ent == null ? -Infinity : ent) && fim - ini >= 5 && fim - ini <= 240 && fecha - fim <= 10) {
      return [marcas[i].hora, marcas[i + 1].hora];
    }
  }
  return null;
}

/**
 * A CASCATA DE UMA PONTA — o `fontes()` de dentro do `_contrato_alvo`
 * (main.py:5947). Horas candidatas EM ORDEM DE CONFIANÇA, sem repetir.
 *
 * Existe porque uma ponta sozinha pode estar errada sem que o resto do cartão
 * esteja: um caso antigo pode ter UMA ponta congelada que já não fecha com a
 * refeição de hoje. Não dá para descartar o cartão inteiro por isso (era o que
 * acontecia: o dia sumia da fila) nem aceitar a ponta só porque estava gravada.
 * A lista preserva cada valor já escolhido e, quando ELE é o que torna o cartão
 * impossível, a próxima fonte DAQUELA ponta assume — a outra ponta não é punida.
 */
function fontesDaPonta(...valores) {
  const out = [];
  for (const valor of valores) {
    const hora = fmtHora(valor);
    if (hora && hora !== "--" && hm2m(hora) != null && !out.includes(hora)) out.push(hora);
  }
  return out;
}

// Cartões da Gordura: a régua só altera as PONTAS, mas o alvo é sempre o cartão
// inteiro (entrada · saída almoço · volta almoço · saída).
function cartoesGordura(g, pd, rm, caso) {
  const bruto = txt(pd.todas_batidas);
  const marcacoes = [...bruto.matchAll(/([ES])?\s*(\d{1,2}:\d{2})/gi)].map((m) => ({
    tipo: (m[1] || "").toUpperCase(),
    hora: fmtHora(m[2]),
  }));
  const campos = [pd.entrada, pd.saida_almoco, pd.volta_almoco, pd.saida].map(fmtHora);

  // Com duas marcações E/S, elas são entrada e saída — nunca saída/volta do almoço.
  // Com quatro, a sequência do cartão é a fonte mais fiel dos quatro slots.
  let atual;
  if (marcacoes.length === 2 && marcacoes[0].tipo === "E" && marcacoes[1].tipo === "S") {
    atual = [marcacoes[0].hora, "", "", marcacoes[1].hora];
  } else if (marcacoes.length >= 4) {
    atual = marcacoes.slice(0, 4).map((m) => m.hora);
  } else if (campos.some(Boolean)) {
    atual = campos;
  } else {
    // Fallback: conserva as pontas da gordura, sem inventar almoço.
    atual = [fmtHora(g.tn_entrada), "", "", fmtHora(g.tn_saida)];
  }

  const base = atual.map(fmtHora);
  const par = (a, b) => {
    const x = fmtHora(a);
    const y = fmtHora(b);
    return x && y ? [x, y] : null;
  };
  // A CASCATA POR PONTA (main.py:5960). A ordem é deliberada e vale para o dia novo
  // e para o legado: **real manual > alvo congelado no caso > régua > sugestão >
  // cartão**. Antes existia UMA combinação (`alvo_*_ref || g.alvo_* || rm.* || sug`)
  // e três coisas quebravam com isso:
  //   · o Real manual cravado pelo DP não vencia a carta — o DP crava justamente
  //     para destravar o dia, e o aviso cobrava outro horário;
  //   · num REAVISO a carta podia pedir hora diferente do `alvo_*` que o caso
  //     congelou — e é o do caso que a correção lança depois (`marcarReavisos`
  //     preserva o congelado, então os dois tinham de nascer iguais);
  //   · a ponta que não fechava derrubava a LINHA INTEIRA (o dia sumia da fila).
  //
  // O QUE NÃO MUDOU: dentro da fatia da RÉGUA, `alvo_*_ref` continua na frente do
  // `g.alvo_*` — "o alvo é da Revisão; régua é uma só" (PORTE.md §5). Real manual e
  // alvo congelado não são régua: são fato cravado à mão e prova já cobrada, e no
  // original (`_contrato_alvo`) eles vêm antes da régua também.
  const entFontes = fontesDaPonta(
    rm.entrada,
    caso.alvo_entrada,
    pd.alvo_entrada_ref,
    g.alvo_entrada,
    pd.entrada_sug,
    base[0],
  );
  const saiFontes = fontesDaPonta(
    rm.saida,
    caso.alvo_saida,
    pd.alvo_saida_ref,
    g.alvo_saida,
    pd.saida_sug,
    base[3],
  );

  // O MIOLO já tinha candidatos e continua com os MESMOS, na mesma ordem. Só depende
  // da entrada escolhida (`refeicaoLancadaNoCartao` ancora nela), por isso é
  // memorizado por ponta de entrada em vez de recalculado nas 36 combinações.
  const meioPorEntrada = new Map();
  const candidatosDoMeio = (ent) => {
    if (!meioPorEntrada.has(ent)) {
      meioPorEntrada.set(
        ent,
        [
          par(caso.alvo_alm_saida, caso.alvo_alm_volta), // almoço congelado no aviso
          par(rm.alm_saida, rm.alm_volta), // real manual do DP
          refeicaoLancadaNoCartao(bruto, ent),
          par(pd.almoco_saida_sug, pd.almoco_volta_sug),
          [base[1], base[2]],
        ].filter(Boolean),
      );
    }
    return meioPorEntrada.get(ent);
  };
  // Não mistura uma refeição anterior com a entrada-alvo: usa o primeiro par que
  // forma um cartão cronológico inteiro.
  const cartaoDe = (ent, sai) => {
    const candidatos = candidatosDoMeio(ent);
    const meio =
      candidatos.find((p) => cartaoValido([ent, p[0], p[1], sai])) || candidatos[0] || ["", ""];
    return [ent, meio[0] || "", meio[1] || "", sai];
  };

  // ITERA O PRODUTO entrada × saída até fechar um cartão cronológico, na ordem de
  // confiança das duas listas: preserva cada fonte válida e substitui SOMENTE a
  // ponta que torna o cartão impossível (main.py:5975).
  let alvo = null;
  for (const ent of entFontes) {
    for (const sai of saiFontes) {
      const tentativa = cartaoDe(ent, sai);
      if (cartaoValido(tentativa)) {
        alvo = tentativa;
        break;
      }
    }
    if (alvo) break;
  }
  // Nenhuma combinação fecha: o dia continua na fila, com o alvo mais confiável de
  // cada ponta e `alvoValido: false` — a grade escreve "revisar alvo e refeição" e
  // `contratoDaGordura` barra o aviso com a MESMA frase. Não se cobra o que não fecha.
  if (!alvo) alvo = cartaoDe(entFontes[0] || base[0] || "", saiFontes[0] || base[3] || "");

  return {
    atual: base,
    alvo,
    alvoValido: cartaoValido(alvo),
    mudou: alvo.map((v, i) => !!v && v !== base[i]),
  };
}

/* ------------------- o texto e o alvo que o aviso cobra -------------------- */

/** Carimbo UTC do INSTANTE do envio (`aviso_enviado_em`/`atualizado_em`). É
 *  timestamp, não data local — aqui o `toISOString()` é o certo. O `date_ref` do
 *  caso, esse sim data local, NUNCA sai de `new Date()`: vem da linha do banco. */
const agoraUtc = () => new Date().toISOString();

/** Quantos nomes o `confirm` lista antes de resumir. A pessoa precisa reconhecer
 *  QUEM vai receber; 80 linhas num window.confirm ninguém lê. */
const NOMES_NA_CONFIRMACAO = 8;

/**
 * A chave do modelo da GORDURA no `app_config` — `comunicado_modelo`, a mesma de
 * app.js `comunicadoModal` (~5700). NÃO é `template_ocorrencia_motorista`: aquele
 * é da Revisão e a frase dele é "NÃO houve marcação de {DIVERGENCIA}", que só faz
 * sentido para quem NÃO bateu. Aqui o colaborador bateu — bateu a mais —, e o
 * {DIVERGENCIA} é uma oração inteira ("a entrada foi apontada às 04:10, porém…").
 * Trocar as duas chaves faria a carta dizer "não houve marcação de a entrada foi
 * apontada às 04:10". São dois modelos porque são dois pedidos diferentes.
 */
const CHAVE_MODELO = "comunicado_modelo";

/** app.js `COMUNICADO_MODELO` (~5459) — o texto oficial da gordura, usado quando a
 *  chave está vazia no `app_config`. Fica aqui e não em `TEMPLATES_PADRAO` porque
 *  aquele mapa é da família `template_*` (a aba Config), e esta chave não é dessa
 *  família. CÓPIA: mexeu no app.js, atualize aqui. */
const MODELO_PADRAO =
  "Prezado(a) {NOME}, seu registro de ponto do dia {DATA} apresenta divergências: {DIVERGENCIA}. " +
  "Conforme o Art. 74 da CLT, solicito que {PEDIDO} no aplicativo de registro de ponto. " +
  "Dúvidas? Fale com seu supervisor ou o RH. Quataí Transporte de Passageiros.";

/** app.js:5705 — modelo salvo com os placeholders da versão ANTIGA ({PONTOS},
 *  {ESC_INICIO}, {ESC_FIM}) é descartado em favor do padrão novo: ninguém preenche
 *  mais essas variáveis, e `normalizaMensagem` as apagaria, deixando a frase manca. */
const PLACEHOLDERS_APOSENTADOS = /\{PONTOS\}|\{ESC_INICIO\}|\{ESC_FIM\}/i;

function modeloDoBanco(valor) {
  // `escolherTemplate` aceita o jsonb como vier; sem entrada em TEMPLATES_PADRAO
  // para esta chave ele devolve "" quando está vazia — daí o padrão daqui.
  const salvo = escolherTemplate(valor, CHAVE_MODELO);
  if (!salvo.trim()) return MODELO_PADRAO;
  return PLACEHOLDERS_APOSENTADOS.test(salvo) ? MODELO_PADRAO : salvo;
}

/**
 * O ALVO CONGELADO do aviso da gordura (o `_contrato_alvo(..., "gordura")` do
 * original). Não recalcula nada: LÊ o cartão que a própria aba já montou em
 * `cartoesGordura` — o mesmo que a coluna "Alvo (c/ tolerância)" mostra e que o
 * DP conferiu antes de marcar a linha. Cobrar na carta um horário diferente do
 * que está na tela seria pior do que não avisar.
 *
 * A CASCATA POR PONTA (real manual > alvo congelado > régua > sugestão > cartão) e
 * a iteração entrada × saída moram lá em cima, dentro de `cartoesGordura`, porque
 * o alvo da carta e o alvo da tela têm de ser o MESMO objeto — se a cascata
 * vivesse aqui, a coluna e o comunicado voltariam a poder divergir.
 *
 * `cartaoValido` já é a checagem de cartão cronológico do contrato (quatro slots
 * em ordem, virada de meia-noite desenrolada, ≤ 24 h); quando ela falha a tela já
 * escreve "revisar alvo e refeição", e é essa mesma frase que vira o motivo do
 * barrado — o DP lê a mesma coisa nos dois lugares.
 */
function contratoDaGordura(r) {
  const cartao = r?.__cartao;
  if (!cartao?.alvoValido) {
    return { contrato: null, erro: "revisar alvo e refeição antes de cobrar" };
  }
  const [entrada, almSaida, almVolta, saida] = cartao.alvo;
  return {
    contrato: {
      alvo_entrada: entrada,
      alvo_alm_saida: almSaida || "",
      alvo_alm_volta: almVolta || "",
      alvo_saida: saida,
    },
    erro: "",
  };
}

/**
 * Porte de app.js `fillTpl` — o texto da gordura, por linha. A carta contrapõe o
 * que foi APONTADO (tn_*) ao que a operação mostra (real_*), e o PEDIDO usa o
 * ALVO (real com a tolerância de entrada −10 / saída +8): é ele que o caso congela
 * e que o robô lança depois, então pedir o real cru criaria uma cobrança que a
 * correção não cumpriria.
 *
 * QUAL PONTA ENTRA NA FRASE é `pontaConta` — A MESMA função que o módulo usa para
 * decidir o `ponta` do caso e para barrar o aviso sem ponta. Escrever aqui uma
 * segunda lista de níveis (o original tinha uma, mais estreita, no front) faria o
 * texto genérico "o registro de ponto diverge da operação" sair justamente para
 * quem o caso registra como ponta cobrada — o pedido que não pede nada que a
 * trava existe para impedir.
 */
function mensagemGordura(template, r) {
  const temEntrada = pontaConta(r.nivel_entrada, r.gordura_entrada, "entrada");
  const temSaida = pontaConta(r.nivel_saida, r.gordura_saida, "saida");

  // `horaMensagem`: a carta vai para o COLABORADOR, e ele não lê "25:43" — vira
  // "01:43 (do dia seguinte)". `fmtHora` antes porque a gordura guarda "0410"; o
  // "--" no fim é o do `fmtHora` do app antigo, para a frase nunca sair com um
  // buraco ("apontada às , porém…") se um campo vier vazio.
  const hora = (v) => horaMensagem(fmtHora(v)) || "--";
  const apontadaEntrada = hora(r.tn_entrada);
  const apontadaSaida = hora(r.tn_saida);
  const operouDe = hora(r.real_inicio);
  const operouAte = hora(r.real_fim);

  const { contrato } = contratoDaGordura(r);
  const alvoEntrada = horaMensagem(contrato?.alvo_entrada) || operouDe;
  const alvoSaida = horaMensagem(contrato?.alvo_saida) || operouAte;

  // Gordura só cobra ENTRADA e SAÍDA — almoço nunca entra.
  let divergencia;
  let pedido;
  if (temEntrada && temSaida) {
    divergencia =
      `a entrada foi apontada às ${apontadaEntrada} e a saída às ${apontadaSaida}, porém nossos ` +
      `sistemas identificam início de operação às ${operouDe} e encerramento às ${operouAte}`;
    pedido = `corrija sua entrada para ${alvoEntrada} e sua saída para ${alvoSaida}`;
  } else if (temEntrada) {
    divergencia =
      `a entrada foi apontada às ${apontadaEntrada}, porém nossos sistemas identificam início ` +
      `de operação às ${operouDe}`;
    pedido = `corrija sua entrada para ${alvoEntrada}`;
  } else if (temSaida) {
    divergencia =
      `a saída foi apontada às ${apontadaSaida}, porém nossos sistemas identificam encerramento ` +
      `da operação às ${operouAte}`;
    pedido = `corrija sua saída para ${alvoSaida}`;
  } else {
    // Rede de segurança: sem ponta a linha é BARRADA antes de virar CSV
    // (`prepararComunicado`, barreira 1), então este texto não chega a ninguém.
    divergencia = "o registro de ponto diverge da operação identificada";
    pedido = "corrija o ponto conforme a operação";
  }

  return preencherTemplate(template, {
    NOME: txt(r.nm_funcionario) || "Colaborador(a)",
    CRACHA: txt(r.cracha),
    DATA: ddmmaaaa(r.data_ref || r.date_ref),
    DIVERGENCIA: divergencia,
    PEDIDO: pedido,
    // Não estão no texto padrão, mas o editor aceita as duas (Config `VARS`):
    // sem preencher, `normalizaMensagem` as apagaria e a frase ficaria manca.
    ESCALA: `${fmtHora(r.esc_inicio) || "--"} – ${fmtHora(r.esc_fim) || "--"}`,
    BATIDAS: batidasParaTexto(r),
  });
}

/* --------------- leitura da camada que mora fora do DP360 ------------------ */
// As QUATRO CAMADAS (linha 99 · reserva do INOVE · reserva por GPS · alvo) estão em
// `regrasGordura.js`. A LEITURA da reserva vem de outra base e por isso não cabe num
// módulo puro — ela é o `lerReservasInove` do `../CartaoDoDia`, o MESMO que a Revisão
// e o cartão do dia usam: um Map `crachá|dia -> registro` com a reserva mais recente
// do dia (ordem crescente de `atualizado_em`, o último vence — critério do pop-up do
// app antigo, supabase_client.py:732). A chave bate com a `chaveDe` daqui.
// A camada `camadaReservaInove` só lê `hora_entrada`, `hora_saida` e `cobertura` do
// registro; as colunas a mais (observação, quem lançou) são para o cartão mostrar e
// NÃO entram em conta nenhuma.

/* --------------------------------- pedaços --------------------------------- */
// Overlay/detalhe não têm classe própria no dp360.css (e o arquivo de estilo não é
// desta mudança). Os poucos retoques ficam aqui, sempre lendo as VARIÁVEIS do tema
// DP — nada de paleta do INOVE nem de Tailwind visual.
const ESTILO = {
  fundo: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    overflowY: "auto",
    background: "rgba(20, 30, 55, 0.42)",
    padding: 20,
  },
  painel: { width: "100%", margin: "0 auto", padding: "16px 18px" },
  titulo: { fontSize: 15, fontWeight: 650 },
  rotulo: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--dp-muted)",
  },
  blocoSuave: { background: "var(--dp-surface-2)", borderRadius: 10, padding: "10px 12px" },
  blocoAviso: {
    background: "var(--dp-warn-bg)",
    color: "var(--dp-warn-ink)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  blocoAlvo: {
    background: "var(--dp-warn-bg)",
    border: "1px solid var(--dp-border)",
    borderRadius: 10,
    padding: "8px 12px",
  },
  blocoLinha: { border: "1px solid var(--dp-border)", borderRadius: 10, padding: "8px 12px" },
  blocoReserva: {
    background: "var(--dp-res-bg)",
    color: "var(--dp-res-ink)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  campo: {
    width: "100%",
    font: "inherit",
    fontSize: 13,
    lineHeight: 1.55,
    padding: "6px 8px",
    minHeight: 120,
    resize: "vertical",
    border: "1px solid var(--dp-border-strong)",
    borderRadius: 8,
    background: "var(--dp-surface)",
    color: "var(--dp-ink)",
  },
  rodapeEnvio: {
    padding: "12px 18px",
    borderTop: "1px solid var(--dp-border)",
    background: "var(--dp-surface-2)",
    borderRadius: "0 0 var(--dp-radius) var(--dp-radius)",
  },
  linhaNivel: { padding: "9px 0", borderBottom: "1px solid var(--dp-border)" },
  marcaNivel: { flex: "none", marginTop: 2, minWidth: 88, textAlign: "center", height: "fit-content" },
  textoLargo: { fontSize: 13, lineHeight: 1.65 },
  ponto: { width: 9, height: 9, borderRadius: 999, display: "inline-block", flex: "none" },
};
// Cor dos marcadores — mesmas famílias do tema DP, nunca a paleta do INOVE.
const COR = {
  linha99: "var(--dp-accent)",
  reservaInove: "var(--dp-res-ink)",
  reserva: "var(--dp-muted)",
  escala: "var(--dp-faint)",
  operacao: "var(--dp-ok-ink)",
  bilhetagem: "var(--dp-accent)",
  real: "var(--dp-ink)",
};

function ChipNivel({ minutos, nivel }) {
  const n = txt(nivel).toUpperCase();
  if (NIVEIS_MUDOS.has(n)) return <span className="dp-faint">—</span>;
  const v = num(minutos);
  return (
    <span className={`dp-gmark ${NIVEL_GCLS[n] || "g-neu"}`}>
      {v == null ? "" : `${Math.round(v)}min · `}
      {NIVEL_LBL[n] || n.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

// Os quatro slots do cartão: entrada · saída almoço · volta almoço · saída.
// Cada batida é um `.dp-chip` com a marca E/S, como no `batReais` da ferramenta; o
// slot que o alvo mudou usa a variante `.new` (a mesma cor do `.ptseg.alterar`).
const SLOT_ES = ["E", "S", "E", "S"];
function LinhaCartao({ horas, mudou }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {horas.map((h, i) =>
        h ? (
          <span key={`slot-${i}`} className={`dp-chip${mudou && mudou[i] ? " new" : ""}`}>
            <span className="es">{SLOT_ES[i]}</span>
            {h}
          </span>
        ) : (
          <span key={`slot-${i}`} className="dp-chip none">
            —
          </span>
        ),
      )}
    </span>
  );
}

function ModalNiveis({ aoFechar }) {
  const nivel = (chave, nome, texto) => (
    <div key={chave} className="flex gap-3" style={ESTILO.linhaNivel}>
      <span className={`dp-gmark ${NIVEL_GCLS[chave]}`} style={ESTILO.marcaNivel}>
        {NIVEL_LBL[chave]}
      </span>
      <span style={ESTILO.textoLargo}>{texto}</span>
    </div>
  );
  return (
    <Overlay aoFechar={aoFechar} titulo="Gordura de ponto — os níveis" largura={660}>
      <p style={{ ...ESTILO.blocoSuave, ...ESTILO.textoLargo }}>
        <b>Gordura</b> = tempo que o motorista <b>bateu ponto a mais do que operou</b>, só nas pontas
        (entrada e saída), nunca a jornada inteira. A régua da operação real é a{" "}
        <b>média SST + Validador</b> por ponta; o Citatti confirma.
      </p>
      <div className="mt-3">
        {nivel("P1", "P1", <><b>Tripla confirmação</b> — SST + Validador + Citatti concordam. Máxima confiança: <b>gordura oficial, corrige primeiro</b>.</>)}
        {nivel("P2", "P2", <><b>Dupla forte</b> — SST e Validador batem entre si, Citatti diverge ou está ausente. Alta confiança: <b>capturável, valide antes de corrigir</b>.</>)}
        {nivel("P3", "P3", <><b>Fonte forte única</b> (só SST ou só Validador) com apoio do Citatti. Confiança média: <b>radar, fora do oficial</b> (P3⁻ = sem apoio do Citatti).</>)}
        {nivel("P4", "P4", <><b>Só Citatti</b>, nenhuma fonte forte. Potencial baixo: <b>conferência manual</b>.</>)}
        {nivel("RESERVA", "Reserva", <>Gordura acima de <b>120 min</b> — provável <b>standby de reserva/prontidão</b>. Tempo legítimo: <b>não corrige, só valida</b>.</>)}
        {nivel("OPERACAO_FORA_PONTO", "fora do ponto", <>Gordura <b>negativa</b> — operou <b>sem cobrir com o ponto</b> (bateu menos do que operou). <b>Risco trabalhista</b>; reportado à parte, não é gordura financeira.</>)}
        {nivel("NAO_CALCULAR", "n/calc", <>SST e Validador <b>divergem mais de 20 min</b> — sem régua confiável, a ponta não entra. Tolerância e sem dado aparecem como “—”.</>)}
      </div>
      <p className="mt-3" style={{ ...ESTILO.blocoAviso, ...ESTILO.textoLargo }}>
        <b>Só P1 é o número oficial.</b> P2 é captura validável; P3/P4/Reserva/fora do ponto ficam no
        radar, rotulados. As pontas são <b>independentes</b>: uma saída P1 conta mesmo se a entrada
        estiver na tolerância — uma ponta nunca anula a outra.
      </p>
      <p className="dp-muted mt-2" style={{ fontSize: 12, lineHeight: 1.6 }}>
        Nesta fase a aba é somente leitura. As <b>duas reservas</b> já entram na conta: a{" "}
        <b>lançada pelo gestor no INOVE</b> (ícone de agenda) — a operação real vira a união{" "}
        <b>reserva ∪ operação</b>, porque ele estava à disposição desde a hora lançada — e a{" "}
        <b>detectada pelo GPS</b> (ícone de pausa), para o dia em que ninguém lançou.
      </p>
    </Overlay>
  );
}

function Overlay({ titulo, largura = 860, aoFechar, children }) {
  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === "Escape") aoFechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);
  return (
    <div
      style={ESTILO.fundo}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="dp-card"
        style={{ ...ESTILO.painel, maxWidth: largura }}
      >
        <div className="flex items-start justify-between gap-4">
          <h3 style={ESTILO.titulo}>{titulo}</h3>
          <button type="button" onClick={aoFechar} className="dp-btn" aria-label="Fechar">
            <X size={14} />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/* ═════════ O DETALHE DO DIA — O MESMO POP-UP DA REVISÃO ═════════
   Pedido do dono (06/09): "na verdade é o mesmo pop-up de análise do da Revisão…
   quero deixar organizado os pontos, ficar no mesmo padrão todos". O painel próprio
   desta aba acabou: fontes, sugestão, Real, Real manual, almoço, GPS, mapa, linha do
   tempo do caso e as viagens do Citatti são do `../CartaoDoDia`, o MESMO componente.

   O QUE A GORDURA GANHOU com isso: o bloco "3 · Real" (o que ele bateu) e o
   "4 · Real manual do DP". A linha barrada por "revisar alvo e refeição" só destrava
   cravando o Real, e até agora isso obrigava a sair da Gordura e reachar pessoa+dia
   na Revisão. Mesma gravação, mesmas travas, mesma releitura depois de gravar.

   O QUE CONTINUA SENDO SÓ DAQUI vira `blocoLateral`: os NÍVEIS P por ponta, o alvo
   que a gordura cobra (com a refeição resolvida por `cartoesGordura`) e o efeito da
   reserva lançada. Nada disso muda de número — a régua continua em `regrasGordura`.

   O QUE SAIU e não faz falta: a tabela "Horários e jornada por fonte" (é o bloco
   "1 · Fontes" do cartão, com a mesma marca "fora da curva" na bilhetagem, só que
   pelo `difRelogio` do motor em vez de uma conta de relógio escrita à mão) e o
   quadro somente-leitura do Real manual (virou o bloco 4, que agora GRAVA).        */

// Uma ponta da conta da gordura: o que ele bateu × o que a operação mostra, os
// minutos e o nível. Era um componente interno do painel antigo; continua idêntico.
function Conta({ lado, bateu, real, minutos, nivel }) {
  const n = num(minutos);
  const nv = txt(nivel).toUpperCase();
  const conta = !NIVEIS_MUDOS.has(nv) && n != null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2" style={ESTILO.blocoSuave}>
      <span style={{ fontWeight: 700 }}>{lado}</span>
      <span className="dp-muted">
        bateu <b className="dp-mono dp-num">{H(bateu)}</b> · real <b className="dp-mono dp-num">{H(real)}</b>
      </span>
      <span className="flex items-center gap-2">
        {conta ? (
          <b className="dp-num" style={{ color: n > 0 ? "var(--dp-danger-ink)" : "var(--dp-ok-ink)" }}>
            {n > 0 ? "+" : ""}
            {Math.round(n)} min
          </b>
        ) : (
          <span className="dp-faint">— ({nv ? nv.toLowerCase().replace(/_/g, " ") : "sem dado"})</span>
        )}
        <ChipNivel nivel={nivel} />
      </span>
    </div>
  );
}

/** Os blocos que só a Gordura tem, na coluna 2 do cartão compartilhado. */
function BlocosGordura({ r }) {
  // O que a reserva LANÇADA alargou. Só entra a ponta que de fato mudou: o original
  // grava `*_sem_reserva` apenas quando altera (main.py:4869-4871 e 4877-4879), então a
  // ausência do campo já significa "a operação sozinha já cobria o período lançado".
  const semReserva = [
    {
      lado: "Entrada",
      antes: r.real_inicio_sem_reserva,
      agora: r.real_inicio,
      minutos: num(r.gordura_entrada_sem_reserva),
      nivel: txt(r.nivel_entrada_sem_reserva),
    },
    {
      lado: "Saída",
      antes: r.real_fim_sem_reserva,
      agora: r.real_fim,
      minutos: num(r.gordura_saida_sem_reserva),
      nivel: txt(r.nivel_saida_sem_reserva),
    },
  ].filter((s) => fmtHora(s.antes));

  return (
    <>
      <section>
        <div style={ESTILO.rotulo}>Cálculo da gordura</div>
        <div className="mt-2 grid gap-2">
          <Conta
            lado="Entrada"
            bateu={r.tn_entrada}
            real={r.real_inicio}
            minutos={r.gordura_entrada}
            nivel={r.nivel_entrada}
          />
          <Conta
            lado="Saída"
            bateu={r.tn_saida}
            real={r.real_fim}
            minutos={r.gordura_saida}
            nivel={r.nivel_saida}
          />
        </div>
        {/* O operador precisa ver O QUE MUDOU quando a reserva entrou na conta: senão o
            número da tela não bate com o cru da `ponto_gordura` e ninguém confia. */}
        {r.__reservaInove && (
          <div className="mt-2" style={ESTILO.blocoReserva}>
            <div className="flex items-center gap-1.5" style={{ ...ESTILO.rotulo, color: "inherit" }}>
              <CalendarClock size={13} /> O que a reserva mudou na conta
            </div>
            {semReserva.length ? (
              <ul className="mt-1.5 grid gap-1" style={{ fontSize: 12, lineHeight: 1.6, fontWeight: 600 }}>
                {semReserva.map((s) => (
                  <li key={s.lado}>
                    <b>{s.lado}</b> — sem a reserva o real era{" "}
                    <span className="dp-mono dp-num">{H(s.antes)}</span>
                    {s.minutos == null
                      ? ""
                      : ` (${s.minutos > 0 ? "+" : ""}${Math.round(s.minutos)} min${
                          s.nivel ? `, ${s.nivel.toLowerCase().replace(/_/g, " ")}` : ""
                        })`}
                    ; com a reserva passou a <span className="dp-mono dp-num">{H(s.agora)}</span>.
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5" style={{ fontSize: 12, lineHeight: 1.6, fontWeight: 600 }}>
                Nenhuma ponta mudou: a operação já cobria todo o período lançado.
              </p>
            )}
          </div>
        )}
        {txt(r.justificativa) && (
          <p className="dp-muted mt-2" style={{ ...ESTILO.blocoSuave, ...ESTILO.textoLargo }}>
            {txt(r.justificativa)}
          </p>
        )}
      </section>

      <section>
        <div style={ESTILO.rotulo}>Alvo da gordura</div>
        <div className="mt-2 grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2" style={ESTILO.blocoAlvo}>
            <span style={{ ...ESTILO.rotulo, color: "var(--dp-warn-ink)" }}>Alvo (real com tolerância)</span>
            {r.__cartao.alvoValido ? (
              <LinhaCartao horas={r.__cartao.alvo} mudou={r.__cartao.mudou} />
            ) : (
              <span style={{ fontWeight: 700, color: "var(--dp-danger-ink)" }}>
                revisar alvo e refeição antes de corrigir
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2" style={ESTILO.blocoLinha}>
            <span style={ESTILO.rotulo}>Ponto (bateu)</span>
            <LinhaCartao horas={r.__cartao.atual} />
          </div>
        </div>
        {txt(r.fonte_alvo_gordura) && (
          <p className="dp-muted mt-2" style={{ fontSize: 12 }}>
            Fonte do alvo:{" "}
            <b>{r.fonte_alvo_gordura === "revisao" ? "alvo publicado pela Revisão" : "calculado na Gordura"}</b>
            {txt(r.fonte_operacao) ? ` · operação: ${txt(r.fonte_operacao)}` : ""}
          </p>
        )}
        {!r.__cartao.alvoValido && (
          <p className="dp-muted mt-1" style={{ fontSize: 12, lineHeight: 1.5 }}>
            Sem alvo válido não dá para cobrar. Crave o horário no bloco{" "}
            <b>4 · Real manual do DP</b>, ali ao lado — é ele que destrava o dia, e não
            precisa mais ir até a Revisão para isso.
          </p>
        )}
      </section>
    </>
  );
}

/**
 * O detalhe do dia: o cartão compartilhado + os blocos desta aba.
 *
 * `gorduraDaTela={r}` é o ponto delicado: o cartão, sozinho, leria a `ponto_gordura`
 * CRUA, e a Gordura exibe a linha com as QUATRO CAMADAS aplicadas
 * (`aplicarCamadasGordura`). Sem o repasse, a "Operação real" do pop-up sairia
 * diferente da que está na grade atrás dele — número que não bate, ninguém usa.
 */
function PainelDetalhe({ linha, aoFechar, aoAvisar, aoRecarregar, impedimentoAviso, previaAviso }) {
  const r = linha;
  return (
    <CartaoDoDia
      linha={r.__linhaPonto}
      caso={r.__caso}
      gorduraDaTela={r}
      // A Gordura não carrega GPS por dia (a Revisão carrega, e passa pronto). Aqui o
      // cartão lê ponto_gps/gps_carro deste crachá×dia e roda a MESMA régua
      // (`regrasGps`), com a reserva do INOVE ligando a tolerância de dia sem carro.
      gpsAuto
      aoFechar={aoFechar}
      aoRecarregar={aoRecarregar}
      // O comunicado da Gordura é por linha da GORDURA (é ela que tem `__cartao` e os
      // níveis), não pela linha do ponto — por isso o argumento do cartão é ignorado.
      aoAvisar={() => aoAvisar(r)}
      impedimentoAviso={impedimentoAviso}
      previaAviso={previaAviso}
      selos={
        <>
          {r.__linha99 && (
            <span className="dp-pill accent" title="Linha 99 — Citatti é a fonte das pontas">
              <span className="flex items-center gap-1">
                <Bus size={12} /> Linha 99
              </span>
            </span>
          )}
          {/* A reserva LANÇADA já ganha pílula própria no cartão (ele lê o registro).
              Aqui só a DEDUZIDA, que é outra coisa e o operador precisa distinguir. */}
          {r.__reserva && !r.__reservaInove && (
            <span className="dp-pill res">
              <span className="flex items-center gap-1">
                <PauseCircle size={12} /> {r.reserva_por_gps ? "Reserva pelo GPS" : "Reserva"}
              </span>
            </span>
          )}
          {txt(r.__casoStatus) && <span className="dp-pill accent">{r.__casoStatus}</span>}
        </>
      }
      blocoLateral={<BlocosGordura r={r} />}
      rodapeInfo={
        <>
          O <b>Real manual</b> fica na base do DP e pode ser desfeito — é ele que destrava o alvo
          desta linha. <b>Enviar ocorrência</b> fala com o trabalhador: abre o comunicado deste dia,
          com Ensaio e envio de verdade.
        </>
      }
    />
  );
}

/* ═══════════════════════ O COMUNICADO AO TRABALHADOR ═══════════════════════
   Porte de app.js `comunicadoModal` (~5694) + do `g4auto` da barra do Passo 4.

   As regras (formato do CSV, quem é barrado, que caso abre, o que congela num
   reaviso) NÃO moram aqui: são de `../comunicadoTransnet`, as MESMAS que a Revisão
   usa — é o mesmo arquivo, pelo mesmo robô. Este componente é a TELA: mostra a
   prévia, quem recebe, QUEM FICOU DE FORA e por quê, e oferece os dois botões.

   O AVISO SAI DAQUI, MAS QUEM DIRIGE O TRANSNET É O ROBÔ. O navegador não fala com
   o Transnet: o Selenium (`bot_comunicado.py`) roda no GitHub Actions do repo DP360,
   onde a credencial já é secret.

   DOIS BOTÕES, NUNCA UM CHECKBOX "confirmar". Marcado por engano ele vira comunicado
   real na ficha de alguém e, 48 h depois, advertência. Ensaio: o robô anexa o arquivo
   no Envio via CSV e NÃO confirma — e ENSAIO NÃO ABRE CASO (main.py:2440: enquanto
   abria, o prazo passava a correr por causa de um teste, sem nenhuma mensagem ter
   saído).                                                                          */

function ListaPessoas({ itens, limite = 12 }) {
  const mostrados = itens.slice(0, limite);
  return (
    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12 }}>
      {mostrados.map((i) => (
        <li key={`${i.cracha}|${i.data}`} className="dp-muted">
          · <b style={{ color: "var(--dp-ink)" }}>{i.nome || "—"}</b>{" "}
          <span className="dp-num">{i.cracha}</span>
          {i.motivo ? ` — ${i.motivo}` : ""}
        </li>
      ))}
      {itens.length > mostrados.length && (
        <li className="dp-faint">+ {itens.length - mostrados.length} outro(s)</li>
      )}
    </ul>
  );
}

function ModalComunicado({ linhas, casoDe, comPontoAntes, aoFechar, aoConcluir }) {
  const [template, setTemplate] = useState(null);
  const [erro, setErro] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // O modelo vive no `app_config` — a MESMA chave que a ferramenta antiga lê na hora
  // do envio. Vazio (ou com placeholder aposentado) cai no texto oficial.
  useEffect(() => {
    let ativo = true;
    lerDP360("app_config", { filtros: { chave: `eq.${CHAVE_MODELO}` } })
      .then((cfg) => {
        if (ativo) setTemplate(modeloDoBanco((cfg || [])[0]?.valor));
      })
      .catch((falha) => {
        if (!ativo) return;
        // Sem o app_config o envio não trava: cai no texto oficial e a tela avisa.
        setTemplate(MODELO_PADRAO);
        setErro(
          `Não foi possível ler o modelo salvo (${falha?.message || falha}). Usando o texto padrão.`,
        );
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    const aoTeclar = (e) => {
      if (e.key === "Escape" && !disparando) aoFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aoFechar, disparando]);

  // O carimbo do caso é o INSTANTE do envio, então o preparo é refeito no clique.
  // Este aqui é só o da tela (prévia, contagem, barrados, o que a pessoa vê).
  const montar = useCallback(
    (agora) =>
      prepararComunicado({
        tipo: TIPO.GORDURA, // é ele que liga a barreira da ponta e a origem do caso
        linhas,
        mensagemDe: (l) => mensagemGordura(template, l),
        alvoDe: contratoDaGordura,
        comPontoAntes,
        agora,
      }),
    [linhas, template, comPontoAntes],
  );

  const preparo = useMemo(() => (template == null ? null : montar(undefined)), [template, montar]);

  // app.js `varsPendentes`: variável sem preencher BLOQUEIA o envio. Depois do
  // `normalizaMensagem` só sobra o que foi digitado errado no modelo ({data} em vez
  // de {DATA}) — e isso não pode chegar ao colaborador dentro de uma carta.
  const pendentes = useMemo(
    () => [...new Set((preparo?.itens || []).flatMap((i) => variaveisPendentes(i.mensagem)))],
    [preparo],
  );

  const disparar = async (confirmar) => {
    const p = montar(agoraUtc());
    if (!p.itens.length) {
      setRecado({ tipo: "erro", texto: "Nenhum comunicado a enviar — veja os barrados abaixo." });
      return;
    }
    // main.py `enviar_comunicados` (~2519): a tela do Transnet recebe UMA Data
    // Referência por envio. Duas datas no mesmo arquivo carimbariam o dia errado.
    if (p.datas.length > 1) {
      setRecado({
        tipo: "erro",
        texto: `A tela envia uma data por vez, e há ${p.datas.length} datas: ${p.datas.join(", ")}.`,
      });
      return;
    }
    if (pendentes.length) {
      setRecado({
        tipo: "erro",
        texto: `Envio bloqueado: variável sem preencher (${pendentes.join(", ")}).`,
      });
      return;
    }

    const nomes = p.itens
      .slice(0, NOMES_NA_CONFIRMACAO)
      .map((i) => `· ${i.nome || i.cracha} (${i.cracha})`)
      .join("\n");
    const resto =
      p.itens.length > NOMES_NA_CONFIRMACAO
        ? `\n· … e mais ${p.itens.length - NOMES_NA_CONFIRMACAO}`
        : "";
    const cabeca = confirmar
      ? `ENVIAR DE VERDADE ${p.itens.length} comunicado(s) no Transnet, do dia ${p.datas[0]}:`
      : `ENSAIO (o robô anexa o arquivo e NÃO confirma o envio) — ${p.itens.length} comunicado(s) do dia ${p.datas[0]}:`;
    // O que ACONTECE, dito sem eufemismo. O caso é o que faz o ciclo (48 h →
    // advertência) existir; onde ele não nasce, a tela diz isso em vez de deixar
    // subentendido.
    const efeito = confirmar
      ? "Cada um recebe a mensagem no Transnet e o caso do dia é aberto/atualizado em ponto_caso " +
        "(origem gordura, tipo cerco), com o prazo correndo a partir de agora — o alvo já " +
        "congelado não é reescrito."
      : "Nada é enviado e NENHUM caso é aberto.";
    if (
      !window.confirm(
        `${cabeca}\n\n${nomes}${resto}\n\n${efeito}\n\n` +
          "Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.",
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      // ORDEM DELIBERADA: dispara PRIMEIRO, grava o caso DEPOIS. O caso é o que faz o
      // prazo de 48 h correr e a advertência nascer; gravá-lo antes de saber se o robô
      // saiu deixaria alguém "avisado" por um disparo que o GitHub recusou. O contrário
      // (mensagem enviada e caso não gravado) é barulho recuperável — e a tela grita.
      const r = await dispararRoboDP360("comunicado", {
        csv: p.csv,
        data: p.datas[0],
        motivo: MOTIVO_AVISO, // aviso. Advertência (103) não sai desta tela.
        confirmar: confirmar ? "true" : "false",
      });

      // O MODELO EDITADO VIRA O PADRÃO, como no original (app.js:5741 `saveTpl` é
      // chamado no preparo que serve tanto ao "só gerar CSV" quanto ao envio). Quem
      // ajusta a carta espera encontrá-la ajustada da próxima vez; sem isso o DP
      // reescreveria a mesma correção todo dia. A chave é a mesma da ferramenta, então
      // as duas telas continuam vendo o mesmo texto.
      //
      // Vai DEPOIS do disparo e o erro é engolido de propósito: falhar em guardar
      // preferência não pode virar erro de uma mensagem que já saiu.
      try {
        await upsertDP360("app_config", { chave: CHAVE_MODELO, valor: template });
      } catch {
        /* preferência não gravada — o envio, que é o que importa, já aconteceu */
      }

      let alerta = "";
      let reavisados = [];
      if (confirmar && p.casos.length) {
        const { casos, reavisos } = marcarReavisos(p.casos, casoDe);
        reavisados = reavisos;
        try {
          await upsertDP360("ponto_caso", casos);
        } catch (falha) {
          alerta =
            ` ATENÇÃO: o comunicado SAIU, mas o registro em ponto_caso falhou (${falha?.message || falha}).` +
            " O prazo de 48 h não está correndo para este lote — avise quem cuida do ciclo.";
        }
      }
      setRecado({
        tipo: alerta ? "erro" : "ok",
        texto:
          `${confirmar ? "Envio" : "Ensaio"} disparado — ${p.itens.length} comunicado(s) do dia ${p.datas[0]}.` +
          (reavisados.length
            ? ` ${reavisados.length} já tinham sido avisados antes (o alvo original ficou).`
            : "") +
          alerta,
        painel: r?.painel || "",
      });
      if (confirmar && aoConcluir) await aoConcluir();
    } catch (falha) {
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  const primeira = preparo?.itens?.[0];

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto"
      style={{ background: "rgba(15,20,32,.5)", padding: 16, zIndex: 60 }}
    >
      <div className="dp-card w-full max-w-3xl" style={{ padding: 0 }}>
        <header
          className="flex items-start justify-between gap-3"
          style={{ padding: "14px 18px", borderBottom: "1px solid var(--dp-border)" }}
        >
          <div style={{ minWidth: 0 }}>
            <b style={{ fontSize: 14 }}>📣 Enviar Ocorrência — {linhas.length} colaborador(es)</b>
            <div className="dp-muted" style={{ fontSize: 11.5, marginTop: 2 }}>
              Campos por linha: <b>{"{NOME}"}</b> · <b>{"{DATA}"}</b> · <b>{"{DIVERGENCIA}"}</b>{" "}
              (apontado × operação, só nas pontas com gordura) · <b>{"{PEDIDO}"}</b> (corrigir para
              o alvo). Almoço nunca entra — a gordura só cobra entrada e saída. O CSV sai idêntico
              ao Transnet: <b>uma linha por colaborador, campos entre aspas</b> (Empresa · Crachá ·
              Comunicado).
            </div>
          </div>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div style={{ padding: "14px 18px", display: "grid", gap: 12 }}>
          {erro && <div className="dp-pill warn">{erro}</div>}
          {template == null && <div className="dp-muted">Carregando o modelo…</div>}

          {template != null && (
            <div>
              <label
                className="dp-muted"
                style={{ fontSize: 11.5, display: "block", marginBottom: 4 }}
              >
                Texto que vai para o colaborador — o que você editar aqui{" "}
                <b>vira o modelo salvo</b> ao enviar, como na ferramenta.
              </label>
              <textarea
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={7}
                style={ESTILO.campo}
              />
            </div>
          )}

          {primeira && (
            <div className="dp-card" style={{ fontSize: 12 }}>
              <b>Prévia ({primeira.nome || primeira.cracha}) — como vai no CSV:</b>
              <div style={{ marginTop: 4 }}>&quot;{primeira.mensagem}&quot;</div>
            </div>
          )}

          {!!pendentes.length && (
            <div className="dp-pill danger">
              Não enviar: variável sem preencher ({pendentes.join(", ")}).
            </div>
          )}

          {!!preparo?.itens?.length && (
            <div>
              <b style={{ fontSize: 12.5 }}>{preparo.itens.length} vão receber</b>
              <ListaPessoas itens={preparo.itens} />
            </div>
          )}

          {/* OS BARRADOS APARECEM. A pessoa não some da lista em silêncio: quem não
              recebe e POR QUE fica escrito, senão o DP marca 40 e vê 31 enviados sem
              nunca saber o que houve com os outros nove. O motivo mais comum aqui é a
              trava da gordura: nenhuma ponta acima da porta (10 min na entrada, 8 na
              saída) — sem ponta o texto viraria um pedido que não pede nada. */}
          {!!preparo?.barrados?.length && (
            <div className="dp-card" style={{ borderColor: "var(--dp-danger-ink)" }}>
              <span className="dp-pill danger">⚠ {preparo.barrados.length} não recebem</span>{" "}
              <span className="dp-muted" style={{ fontSize: 11.5 }}>
                O aviso não sai para estes — o motivo está ao lado do nome. Nada é enviado e nenhum
                caso é aberto para eles.
              </span>
              <ListaPessoas itens={preparo.barrados} />
            </div>
          )}
        </div>

        <footer
          className="flex flex-wrap items-center justify-between gap-3"
          style={ESTILO.rodapeEnvio}
        >
          <div className="dp-det-bot-linha" style={{ minWidth: 0 }}>
            {disparando && <span className="dp-pill accent">disparando…</span>}
            {recado && (
              <>
                <span className={`dp-pill ${recado.tipo === "ok" ? "ok" : "danger"}`}>
                  {recado.texto}
                </span>
                {recado.painel && (
                  <>
                    {" "}
                    <a className="dp-btn" href={recado.painel} target="_blank" rel="noreferrer">
                      ver o robô rodando
                    </a>
                  </>
                )}
              </>
            )}
          </div>
          <div className="dp-det-bot-acoes">
            <button
              type="button"
              className="dp-btn"
              disabled={disparando || !preparo?.itens?.length}
              onClick={() => disparar(false)}
              title="O robô anexa o arquivo no Envio via CSV e NÃO confirma — serve para conferir o lote. Nenhum caso é aberto."
            >
              🤖 Ensaio
            </button>
            <button
              type="button"
              className="dp-btn"
              style={{ color: "var(--dp-danger-ink)" }}
              disabled={disparando || !preparo?.itens?.length}
              onClick={() => disparar(true)}
              title="Publica o comunicado na ficha de cada colaborador, no Transnet."
            >
              ⚠ Enviar de verdade
            </button>
            <button type="button" className="dp-btn" onClick={aoFechar} disabled={disparando}>
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════ O STATUS ATUAL DO CICLO (a coluna que faltava) ═══════════════
   Porte de app.js:4322 (`casoCell`, chave `c_status`), a terceira coluna do
   `COLS_P4` da ferramenta (app.js:5409). Ela sumiu no porte e o efeito é prático:
   o DP monta o lote de comunicados às cegas — sem ver quem JÁ foi avisado (e
   REAVISO REINICIA as 48 h, `marcarReavisos`) nem quem já venceu. Hoje a lista de
   "já tinham sido avisados" só aparece DEPOIS do disparo, quando não adianta mais.

   NADA AQUI DECIDE NADA: só lê a `ponto_caso` que a linha já carrega em `__caso`.
   Nenhum número da gordura passa por esta função.                              */

// PORTE.md §4 / main.py `PRAZO_HORAS` — o mesmo 48 da aba Ocorrências.
const PRAZO_AVISO_H = 48;

/**
 * Horas decorridas desde um carimbo do banco.
 *
 * `aviso_enviado_em` é INSTANTE (esta aba grava `new Date().toISOString()`), então
 * o fuso do texto é RESPEITADO: jogar o fuso fora e ler como hora local erra 3 h no
 * BRT — e 3 h decidem quem está "no prazo" na fronteira das 48. Carimbo sem fuso
 * nenhum é lido como UTC, que é como esta tela e o robô gravam.
 *
 * O `+00` do Postgres (duas casas, sem `:00`) vira `+00:00` antes do parse: no
 * formato ISO com `T` ele é `NaN`, e um carimbo ilegível viraria "sem status".
 */
function horasDesde(carimbo) {
  let s = txt(carimbo);
  if (!s) return null;
  s = s.replace(/([+-]\d{2})$/, "$1:00");
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) s = `${s.replace(" ", "T")}Z`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : Math.max(0, Date.now() - t) / 3600000;
}

function horasTexto(h) {
  if (h == null) return "";
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
}

/**
 * O estado do ciclo deste dia, na ORDEM DE TESTES DO ORIGINAL — que não é
 * intercambiável. Em especial "enviado" vem ANTES da conta das 48 h: enquanto
 * ninguém conferiu o aviso (`aviso_conferido_em`) o caso está no correio, e chamar
 * isso de vencido mandaria o DP advertir quem talvez nem tenha sido lido ainda.
 * Vale o CÓDIGO da ferramenta, não a leitura intuitiva da ordem.
 *
 * @returns null quando não há caso (a célula fica "—") ou `{rotulo, cor, titulo}`.
 */
function statusDoCiclo(caso) {
  if (!caso) return null;
  const correcao = txt(caso.correcao_status).toLowerCase();
  const enviadoEm = txt(caso.aviso_enviado_em);
  const horas = horasDesde(enviadoEm);
  const desde = horas == null ? "" : ` · avisado há ${horasTexto(horas)}`;

  if (
    correcao === "corrigido" ||
    (txt(caso.correcao_final_em) && correcao === "ok") ||
    txt(caso.ajuste) === "certo"
  )
    return { rotulo: "corrigido", cor: "ok", titulo: "O cartão deste dia já está certo." };
  if (correcao === "pendente" || ["aceito", "rejeitado"].includes(txt(caso.aceite)))
    return {
      rotulo: "aguardando correção",
      cor: "warn",
      titulo: `O pedido já foi decidido; falta a correção entrar no cartão${desde}.`,
    };
  if (enviadoEm && !txt(caso.aviso_conferido_em))
    return {
      rotulo: "enviado",
      cor: "warn",
      titulo: `Comunicado no Transnet, ainda sem conferência${desde}. Reavisar REINICIA as ${PRAZO_AVISO_H} h.`,
    };
  if (horas != null && horas > PRAZO_AVISO_H)
    return {
      rotulo: "vencido",
      cor: "danger",
      titulo: `Passou das ${PRAZO_AVISO_H} h do aviso sem correção${desde} — é o caso que vira advertência.`,
    };
  if (enviadoEm)
    return {
      rotulo: "no prazo",
      cor: "warn",
      titulo: `Dentro das ${PRAZO_AVISO_H} h do aviso${desde}. Reavisar REINICIA o prazo.`,
    };
  return null;
}

function CelulaStatusCiclo({ caso }) {
  const s = statusDoCiclo(caso);
  if (!s) return <span className="dp-faint">—</span>;
  // A COR É O VEREDITO — as mesmas famílias do `.vbadge` da ferramenta
  // (certo→ok, pend→warn, errado→danger), pela pílula do tema DP.
  return (
    <span className={`dp-pill ${s.cor}`} title={s.titulo}>
      {s.rotulo}
    </span>
  );
}

/* ---------------------------- colunas da grade ------------------------------ */
// MESMAS colunas, MESMA ordem e MESMO conteúdo de célula da tabela que estava escrita
// à mão nesta aba. A divisão de trabalho é a da TabelaDP:
//   · `valor` ORDENA e vai para o CSV — e por isso é sempre o dado CRU (minutos, hora,
//     texto). É exatamente o papel do `COLS_P4_CSV` do app antigo, que existia para
//     exportar `gordura_entrada` em MINUTOS no lugar do chip colorido da tela; aqui a
//     mesma lista de colunas serve às duas coisas, sem uma segunda lista para manter.
//   · `render` é só a pinta (chips do cartão, `dp-gmark` do nível, ícones da linha).
// A grade só ordena: dia, piso, busca e chips de nível seguem na barra da aba.
const COLUNAS_P4 = [
  {
    id: "nm_funcionario",
    titulo: "Colaborador",
    largura: 300,
    valor: (r) => txt(r.nm_funcionario),
    render: (r) => (
      <span className="flex items-center gap-1.5" style={{ fontWeight: 600 }}>
        {txt(r.nm_funcionario) || "—"}
        {r.__linha99 && (
          <span
            title="Linha 99 — Citatti é a fonte das pontas"
            style={{ color: COR.linha99, flex: "none" }}
          >
            <Bus size={13} aria-label="linha 99" />
          </span>
        )}
        {/* Lançada pelo gestor x deduzida do dado são coisas distintas
            e o operador precisa distinguir de relance. */}
        {r.__reservaInove && (
          <span
            title={`Reserva lançada pelo gestor no INOVE${
              fmtHora(r.reserva_inove_entrada) || fmtHora(r.reserva_inove_saida)
                ? ` — ${H(r.reserva_inove_entrada)} às ${H(r.reserva_inove_saida)}`
                : ""
            } — real = união reserva ∪ operação`}
            style={{ color: COR.reservaInove, flex: "none" }}
          >
            <CalendarClock size={13} aria-label="reserva lançada pelo gestor" />
          </span>
        )}
        {r.__reserva && !r.__reservaInove && (
          <span
            title={
              r.reserva_por_gps
                ? "Reserva detectada pelo GPS (ninguém lançou) — não corrige, só valida"
                : "Reserva / prontidão — não corrige, só valida"
            }
            style={{ color: COR.reserva, flex: "none" }}
          >
            <PauseCircle size={13} aria-label="reserva" />
          </span>
        )}
      </span>
    ),
  },
  {
    id: "cracha",
    titulo: "Crachá",
    classe: "dp-mono dp-num dp-muted",
    largura: 110,
    valor: (r) => txt(r.cracha),
    render: (r) => txt(r.cracha) || "—",
  },
  {
    // TERCEIRA COLUNA, como no `COLS_P4` da ferramenta (app.js:5409) — antes da
    // data, porque é ela que o DP lê ao escolher quem entra no lote de hoje.
    // `valor` é o rótulo (ordena e vai para o CSV, como o `colSituacao` das
    // Ocorrências); `render` é a pílula com a cor do veredito.
    id: "c_status",
    titulo: "Status atual",
    largura: 160,
    valor: (r) => statusDoCiclo(r.__caso)?.rotulo || "",
    render: (r) => <CelulaStatusCiclo caso={r.__caso} />,
  },
  {
    id: "data_ref",
    titulo: "Data",
    classe: "dp-num dp-muted",
    largura: 110,
    valor: (r) => fmtData(r.data_ref),
  },
  {
    id: "ponto",
    titulo: "Ponto (bateu)",
    largura: 300,
    // Horas CRUAS dos slots preenchidos: ordena pela entrada e o CSV sai com o cartão.
    valor: (r) => r.__cartao.atual.filter(Boolean).join(" "),
    render: (r) => <LinhaCartao horas={r.__cartao.atual} />,
  },
  {
    id: "alvo",
    titulo: "Alvo (c/ tolerância)",
    largura: 300,
    valor: (r) =>
      r.__cartao.alvoValido ? r.__cartao.alvo.filter(Boolean).join(" ") : "revisar alvo e refeição",
    render: (r) =>
      r.__cartao.alvoValido ? (
        <LinhaCartao horas={r.__cartao.alvo} mudou={r.__cartao.mudou} />
      ) : (
        <span style={{ fontWeight: 700, color: "var(--dp-danger-ink)" }}>
          revisar alvo e refeição
        </span>
      ),
  },
  {
    id: "jornada",
    titulo: "Jornada",
    classe: "dp-mono dp-num dp-muted",
    largura: 110,
    // "10h09" a grade ordena; o "—" de jornada indefinida seria TEXTO e subiria na
    // frente do 00h05, então vira vazio no `valor` e continua "—" na tela.
    valor: (r) => {
      const d = durHM(r.real_inicio, r.real_fim);
      return d === "—" ? "" : d;
    },
    render: (r) => durHM(r.real_inicio, r.real_fim),
  },
  {
    id: "gordura_entrada",
    titulo: "Gordura entrada",
    largura: 160,
    // MINUTOS crus (número). O chip é "42min · P1": como texto ordenaria 9 depois de
    // 42, e o CSV sairia com o rótulo do nível em vez do número que o DP soma.
    valor: (r) => num(r.gordura_entrada),
    render: (r) => <ChipNivel minutos={r.gordura_entrada} nivel={r.nivel_entrada} />,
  },
  {
    id: "gordura_saida",
    titulo: "Gordura saída",
    largura: 160,
    valor: (r) => num(r.gordura_saida),
    render: (r) => <ChipNivel minutos={r.gordura_saida} nivel={r.nivel_saida} />,
  },
  {
    id: "esc_inicio",
    titulo: "Esc. início",
    classe: "dp-mono dp-num dp-faint",
    largura: 110,
    valor: (r) => fmtHora(r.esc_inicio), // hora crua; sem escala vai para o fim
    render: (r) => H(r.esc_inicio),
  },
  {
    id: "esc_fim",
    titulo: "Esc. fim",
    classe: "dp-mono dp-num dp-faint",
    largura: 110,
    valor: (r) => fmtHora(r.esc_fim),
    render: (r) => H(r.esc_fim),
  },
  {
    id: "justificativa",
    titulo: "Justificativa",
    classe: "dp-muted",
    largura: 240,
    estilo: { maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" },
    valor: (r) => txt(r.justificativa),
    render: (r) => <span title={txt(r.justificativa)}>{txt(r.justificativa) || "—"}</span>,
  },
];

/* --------------------------------- a aba ----------------------------------- */
export default function Gordura() {
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDia, setCarregandoDia] = useState(false);
  const [erro, setErro] = useState("");
  const [termo, setTermo] = useState("");
  const [piso, setPiso] = useState(0);
  const [filtro, setFiltro] = useState("TODOS");
  const [verNiveis, setVerNiveis] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  // Quem o DP marcou (✔) na grade — o `visiveis.filter(r => r.__sel)` do app antigo.
  // Guarda IDS, não linhas: assim uma recarga do dia (ou o chip de nível mudando)
  // não deixa para trás um objeto velho, e id de outro dia simplesmente não casa.
  const [marcados, setMarcados] = useState([]);
  // O lote é CONGELADO no clique: o que a prévia mostra é o que vai sair, mesmo que
  // a lista atrás recarregue enquanto o modal está aberto.
  const [envio, setEnvio] = useState(null);
  const [refresco, setRefresco] = useState(0);

  // Lista de dias com gordura calculada — `data_ref` distintas, mais recente primeiro.
  // A deduplicação acontece NO SERVIDOR, na ação `datas` do gateway
  // (supabase/functions/dp360-api/index.ts:191-228, atalho em
  // src/services/dp360Api.js:53-62). Antes a aba paginava até 40 mil linhas de
  // `data_ref` só para montar este <select>; agora volta uma lista curta e cacheada.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const ordenadas = await lerDatasDP360("ponto_gordura", "data_ref");
        if (!ativo) return;
        // O gateway já corta em 10 e devolve desc; o `dia10` é só cinto de segurança
        // para o dia que a coluna vier como timestamp.
        const limpas = ordenadas.map(dia10).filter(Boolean);
        setDatas(limpas);
        setData(limpas[0] || "");
      } catch (falha) {
        if (ativo) setErro(falha?.message || "Falha ao listar os dias com gordura calculada.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const carregarDia = useCallback(async (dia) => {
    // Gordura é a base; as demais tabelas só enriquecem. Se uma delas falhar, a
    // lista continua de pé (sem cartão/alvo) em vez de a aba inteira cair.
    const vazio = () => [];
    const [gordura, diario, linha99, realManual, casos, reservas] = await Promise.all([
      lerTudoDP360("ponto_gordura", { filtros: { data_ref: `eq.${dia}` }, ordem: "cracha.asc" }),
      lerTudoDP360("ponto_diario", { filtros: { date_ref: `eq.${dia}` } }).catch(vazio),
      lerTudoDP360("ponto_linha99", { filtros: { data_ref: `eq.${dia}` } }).catch(vazio),
      lerTudoDP360("ponto_real_manual", { filtros: { date_ref: `eq.${dia}` } }).catch(vazio),
      lerTudoDP360("ponto_caso", { filtros: { date_ref: `eq.${dia}` } }).catch(vazio),
      // Outra base (o Supabase do próprio INOVE) e outro cliente — já degrada sozinha.
      lerReservasInove(dia),
    ]);

    const indexar = (arr, colDia) => {
      const mapa = new Map();
      arr.forEach((x) => mapa.set(chaveDe(x.cracha, x[colDia]), x));
      return mapa;
    };
    const pdMapa = indexar(diario, "date_ref");
    const rmMapa = indexar(realManual, "date_ref");
    const casoMapa = indexar(casos, "date_ref");
    const com99 = new Set(linha99.map((x) => chaveDe(x.cracha, x.data_ref)));

    return gordura.map((bruta) => {
      const chave = chaveDe(bruta.cracha, bruta.data_ref);
      const pd = pdMapa.get(chave) || {};
      const rm = rmMapa.get(chave) || {};
      const caso = casoMapa.get(chave) || {};

      // Mesma ordem do app antigo (main.py:4699-4704, `_gord`):
      // linha 99 -> reserva do INOVE -> reserva por GPS -> alvo.
      // A ordem importa e por isso vive dentro de `aplicarCamadasGordura`: a reserva
      // por GPS só age quando NÃO há lançamento do gestor (`tem_reserva_inove`), e o
      // alvo é sempre a última palavra sobre a gordura.
      const g = aplicarCamadasGordura(bruta, { com99, reservas, pontoDiario: pd });

      const cartao = cartoesGordura(g, pd, rm, caso);
      const nivies = [txt(g.nivel_entrada).toUpperCase(), txt(g.nivel_saida).toUpperCase()];

      // A LINHA DO PONTO que o cartão do dia compartilhado consome (fontes, sugestão,
      // Real, Real manual, almoço). O `pd` continua CRU para as camadas da gordura e
      // para `cartoesGordura` — que leem `alvo_*_ref`, `entrada_sug` e o `rm` separados
      // —; o overlay do Real manual é aplicado numa CÓPIA, exatamente como a Revisão
      // faz na grade dela. Nenhum número da gordura passa por aqui.
      // Sem linha na `ponto_diario` (dia que não chegou) o cartão ainda precisa saber
      // de quem e de que dia é: crachá, data e nome caem para os da gordura.
      const linhaPonto = aplicarRealManual(
        {
          ...pd,
          cracha: txt(pd.cracha) || txt(g.cracha),
          date_ref: dia10(pd.date_ref) || dia10(g.data_ref),
          nm_funcionario: txt(pd.nm_funcionario) || txt(g.nm_funcionario),
          categoria: txt(pd.categoria) || "MOTORISTA",
        },
        rmMapa.has(chave) ? rm : null,
      );

      return {
        ...g,
        __chave: chave,
        __cartao: cartao,
        __linhaPonto: linhaPonto,
        __linha99: !!g.prioridade_citatti_linha99 || com99.has(chave),
        // Duas coisas diferentes: o gestor LANÇOU a reserva no INOVE (documento, manda
        // em tudo) x a reserva foi DEDUZIDA do dado (GPS) ou o nível saiu RESERVA.
        __reservaInove: ehVerdade(g.tem_reserva_inove),
        __reserva:
          !!g.reserva_por_gps || ehVerdade(g.tem_reserva_inove) || nivies.includes("RESERVA"),
        __casoStatus: txt(caso.correcao_status) || txt(caso.aceite) || "",
        // O caso INTEIRO fica na linha: é dele que o envio lê `aviso_enviado_em`
        // (para saber que isto é um REaviso e não reescrever o alvo congelado) e a
        // presença da coluna `ponto_antes`, que não existe em toda instalação.
        __caso: casoMapa.has(chave) ? caso : null,
        __busca: semAcento(`${txt(g.nm_funcionario)} ${txt(g.cracha)} ${cracha8(g.cracha)}`),
        // O RETRATO DO CARTÃO ANTES DO AVISO. `ponto_gordura` não guarda batida; quem
        // tem é a `ponto_diario`. Sem estes dois campos o caso nasceria com `usuario`
        // vazio e ninguém saberia depois como o cartão estava quando se cobrou.
        todas_batidas: txt(g.todas_batidas) || txt(pd.todas_batidas),
        batidas_limpas: txt(g.batidas_limpas) || txt(pd.batidas_limpas),
        rm_entrada: txt(rm.entrada),
        rm_alm_saida: txt(rm.alm_saida),
        rm_alm_volta: txt(rm.alm_volta),
        rm_saida: txt(rm.saida),
        rm_por: txt(rm.definido_por),
        rm_em: txt(rm.definido_em),
      };
    });
  }, []);

  useEffect(() => {
    if (!data) return undefined;
    let ativo = true;
    setCarregandoDia(true);
    setErro("");
    // `refresco` entra na dependência de propósito: depois de um envio de verdade a
    // lista é relida para as marcas do caso (avisado, status) refletirem o que saiu.
    carregarDia(data)
      .then((prontas) => {
        if (!ativo) return;
        setLinhas(prontas);
        // O pop-up aberto recebe a linha NOVA (mesma `__chave`): sem isto ele
        // continuaria mostrando o Real e o alvo antigos enquanto a grade atrás dele
        // já mostra os novos. É o mesmo cuidado que a Revisão tem com o `setAberta`.
        setDetalhe((d) => (d ? prontas.find((p) => p.__chave === d.__chave) || d : d));
      })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha?.message || "Falha ao consultar a gordura deste dia.");
      })
      .finally(() => {
        if (ativo) setCarregandoDia(false);
      });
    return () => {
      ativo = false;
    };
  }, [data, carregarDia, refresco]);

  /* ---- releitura depois de gravar o Real manual no cartão ----
     A tela nunca pinta o estado otimista: o dia inteiro é RELIDO e passa outra vez
     pelas quatro camadas (`aplicarCamadasGordura`) e por `cartoesGordura`. É de
     propósito que seja o dia todo: cravar o Real muda o alvo — é exatamente para isso
     que o DP crava —, e uma releitura só da linha deixaria a grade, os chips de nível
     e a soma P1 discordando do pop-up. A regra não muda em lugar nenhum: é a MESMA
     função de carga da abertura da aba. */
  const recarregarDia = useCallback(async () => {
    if (!data) return;
    const prontas = await carregarDia(data);
    setLinhas(prontas);
    setDetalhe((d) => (d ? prontas.find((p) => p.__chave === d.__chave) || d : d));
  }, [carregarDia, data]);

  // Trocar de dia zera a marcação: os ✔ do dia anterior não podem virar lote de hoje.
  useEffect(() => {
    setMarcados([]);
  }, [data]);

  // Recorte base: quem passou da régua fixa (e do piso de exibição). Os chips de
  // nível e o resumo contam SOBRE esse recorte.
  const base = useMemo(
    () => linhas.filter((o) => passaRegua(o) && (!piso || maiorPonta(o) >= piso)),
    [linhas, piso],
  );

  const contagem = useMemo(() => {
    const c = { TODOS: base.length, P1: 0, P2: 0, P3: 0, P4: 0, RESERVA: 0, OPERACAO_FORA_PONTO: 0 };
    base.forEach((o) => {
      const ks = [nivKey(o.nivel_entrada), nivKey(o.nivel_saida)];
      PRECEDENCIA.forEach((k) => {
        if (ks.includes(k)) c[k] += 1;
      });
    });
    return c;
  }, [base]);

  const visiveis = useMemo(() => {
    const q = semAcento(termo);
    const termos = q.split(/\s+/).filter(Boolean);
    return base
      .filter((o) => !termos.length || termos.every((t) => o.__busca.includes(t)))
      .filter((o) =>
        filtro === "TODOS" ? true : nivKey(o.nivel_entrada) === filtro || nivKey(o.nivel_saida) === filtro,
      );
  }, [base, termo, filtro]);

  // A soma oficial conta APENAS pontas cujo nível é exatamente P1.
  const somaP1 = useMemo(
    () =>
      base.reduce(
        (a, o) =>
          a +
          (txt(o.nivel_entrada).toUpperCase() === "P1" ? num(o.gordura_entrada) || 0 : 0) +
          (txt(o.nivel_saida).toUpperCase() === "P1" ? num(o.gordura_saida) || 0 : 0),
        0,
      ),
    [base],
  );

  // Barra de filtros da ferramenta: dia, piso, busca, chips de nível e a RÉGUA FIXA
  // sempre à vista (no original ela mora na segunda `gbar`, como `hbsub`).
  const filtros = (
    <>
      <label className="dp-muted flex items-center gap-2">
        Dia
        <select value={data} onChange={(e) => setData(e.target.value)}>
          {datas.map((d) => (
            <option key={d} value={d}>
              {fmtData(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="dp-muted flex items-center gap-2">
        Mostrar acima de
        <select value={piso} onChange={(e) => setPiso(Number(e.target.value) || 0)}>
          {PISOS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      <input
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder="Buscar nome ou crachá"
        style={{ width: 200 }}
      />
      <span className="flex flex-wrap items-center gap-1.5">
        {CHIPS.map(([chave, rotulo]) => (
          <button
            key={chave}
            type="button"
            onClick={() => setFiltro(chave)}
            className={`dp-chip-f${filtro === chave ? " on" : ""}`}
          >
            {rotulo} <span className="n">{contagem[chave] ?? 0}</span>
          </button>
        ))}
      </span>
      <span className="flex items-center gap-3" style={{ marginLeft: "auto" }}>
        <span className="dp-faint">
          Régua fixa: entrada &gt; 10 min antes · saída &gt; 8 min depois
        </span>
        <button type="button" className="dp-btn" onClick={() => setVerNiveis(true)}>
          <span className="flex items-center gap-1.5">
            <Info size={13} /> Níveis
          </span>
        </button>
      </span>
    </>
  );

  // Linha de resumo (o `dtot` da ferramenta) + a legenda dos marcadores da lista.
  const resumo = (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>
        <b className="dp-num">{base.length}</b> fora da régua
        {piso ? ` e acima de ${piso} min` : ""} · Gordura P1 do dia:{" "}
        <b className="dp-num">{Math.round(somaP1)} min</b> ({(somaP1 / 60).toFixed(1)}h)
      </span>
      <span className="flex items-center gap-1.5" style={{ color: COR.linha99 }}>
        <Bus size={13} /> linha 99 (Citatti é a fonte das pontas)
      </span>
      <span className="flex items-center gap-1.5" style={{ color: COR.reservaInove }}>
        <CalendarClock size={13} /> reserva lançada pelo gestor (real = reserva ∪ operação)
      </span>
      <span className="flex items-center gap-1.5" style={{ color: COR.reserva }}>
        <PauseCircle size={13} /> reserva por GPS / prontidão (não corrige, valida)
      </span>
      <span className="dp-faint">Clique na linha para ver as fontes do dia.</span>
    </span>
  );

  /* ═══════════ AVISO AO TRABALHADOR (o robô do Transnet) — o `g4auto` ═══════════
     Rota `tipo="gordura"` de `_escrever_comunicados`: o caso nasce com
     origem='gordura', tipo='cerco', a ponta cobrada, os minutos, o nível e o alvo
     CONGELADO. Quem monta tudo isso é `prepararComunicado`; aqui só se escolhe o
     escopo (o lote marcado ou uma linha) e se lê o caso que já existe.            */

  // O caso já gravado de (crachá, dia) — o `marcarReavisos` lê dele o
  // `aviso_enviado_em` para não reescrever o alvo congelado de um primeiro aviso.
  const casoPorChave = useMemo(() => {
    const mapa = new Map();
    linhas.forEach((l) => {
      if (l.__caso) mapa.set(l.__chave, l.__caso);
    });
    return mapa;
  }, [linhas]);
  const casoDe = useCallback(
    (cracha, dia) => casoPorChave.get(chaveDe(cracha, dia)) || null,
    [casoPorChave],
  );

  // main.py `sc.tem_coluna("ponto_caso", "ponto_antes")`: a coluna existe em algumas
  // instalações e não em outras. Mandar coluna inexistente no upsert derruba o lote
  // inteiro, então só entra quando ela foi VISTA numa linha já lida.
  const comPontoAntes = useMemo(
    () =>
      [...casoPorChave.values()].some(
        (c) => c && Object.prototype.hasOwnProperty.call(c, "ponto_antes"),
      ),
    [casoPorChave],
  );

  // O lote: os marcados que continuam VISÍVEIS (mesma semântica do original, onde o
  // botão mandava `visiveis.filter(r => r.__sel)` — mudar o chip de nível muda o lote).
  const alvoLote = useMemo(
    () => visiveis.filter((r) => marcados.includes(r.__chave)),
    [visiveis, marcados],
  );

  /* ---- POR QUE o 📣 do cartão está apagado ----
     As MESMAS duas barreiras do envio (`prepararComunicado`), ditas antes do clique:
     sem ponta acima da régua fixa o texto viraria um pedido que não pede nada; sem
     alvo cronológico não há horário a cobrar. Nada é recalculado aqui — `pontaConta`
     e `contratoDaGordura` são as funções do próprio envio. */
  const impedimentoAviso = useMemo(() => {
    if (!detalhe) return "";
    const temPonta =
      pontaConta(detalhe.nivel_entrada, detalhe.gordura_entrada, "entrada") ||
      pontaConta(detalhe.nivel_saida, detalhe.gordura_saida, "saida");
    if (!temPonta)
      return "Nenhuma ponta acima da régua fixa (entrada 10 min · saída 8 min) — não há gordura a cobrar neste dia.";
    return contratoDaGordura(detalhe).erro;
  }, [detalhe]);

  /* ---- a MENSAGEM que o balão da linha do tempo mostra ----
     Mesmo modelo e MESMA função do envio de verdade (`mensagemGordura`), para a prévia
     não poder divergir do que o colaborador recebe. A chave do modelo é a da GORDURA
     (`comunicado_modelo`), que não é da família `template_*` da Revisão — por isso ela
     e o `modeloDoBanco` viajam junto com a prévia. */
  const previaAviso = useMemo(() => {
    if (!detalhe) return null;
    return {
      chave: CHAVE_MODELO,
      configChave: CHAVE_MODELO,
      resolver: modeloDoBanco,
      rotulo: "cobrar a gordura",
      montar: (tpl) => mensagemGordura(tpl, detalhe),
    };
  }, [detalhe]);

  const semDatas = !carregando && !datas.length;
  // Antes de o primeiro dia chegar, a barra ficaria com um <select> vazio — não desenha.
  const mostraBarra = !semDatas && !carregando;

  let corpo;
  if (semDatas) {
    corpo = (
      <div className="dp-resumo">
        Ainda não há gordura calculada. Rode o pipeline da gordura (Athena → agente → base DP360)
        para popular <span className="dp-mono">ponto_gordura</span>.
      </div>
    );
  } else {
    corpo = (
      <TabelaDP
        chave="p4"
        colunas={COLUNAS_P4}
        linhas={visiveis}
        idLinha={(r) => r.__chave}
        // A linha inteira é pintada pelo PIOR nível — é a cor da linha que o
        // operador lê primeiro, como na ferramenta.
        classeLinha={classeLinha}
        aoClicarLinha={(r) => setDetalhe(r)}
        // ✔ por linha: quem recebe o comunicado é escolhido A MÃO, nunca "todos da
        // tela por padrão" — é ficha de colaborador, não relatório.
        selecionavel
        aoSelecionar={(ids) => setMarcados(ids)}
        acoes={
          <button
            type="button"
            className="dp-btn primary"
            disabled={!alvoLote.length}
            onClick={() => setEnvio(alvoLote)}
            title={
              alvoLote.length
                ? "Abre o comunicado do lote: prévia, quem recebe, quem fica de fora e os dois botões (Ensaio · Enviar de verdade)."
                : "Marque (✔) os colaboradores que vão receber o comunicado."
            }
          >
            📣 Enviar Ocorrência{alvoLote.length ? ` (${alvoLote.length})` : ""}
          </button>
        }
        nomeCsv={`gordura_${data}`}
        carregando={carregandoDia}
        mensagemCarregando="Carregando a gordura do dia…"
        vazio={
          base.length
            ? "Nada nesse nível ou nessa busca."
            : "Nenhuma ponta fora da régua fixa de aviso neste dia."
        }
      />
    );
  }

  return (
    <AbaShell
      filtros={mostraBarra ? filtros : null}
      resumo={mostraBarra ? resumo : null}
      carregando={carregando}
      erro={erro}
    >
      {corpo}

      {verNiveis && <ModalNiveis aoFechar={() => setVerNiveis(false)} />}
      {detalhe && (
        <PainelDetalhe
          linha={detalhe}
          aoFechar={() => setDetalhe(null)}
          aoAvisar={(r) => setEnvio([r])}
        />
      )}

      {/* O comunicado fica POR CIMA do detalhe (z-index maior) em vez de fechá-lo:
          quem clicou em "Enviar ocorrência" continua vendo o dia que está cobrando. */}
      {envio && (
        <ModalComunicado
          linhas={envio}
          casoDe={casoDe}
          comPontoAntes={comPontoAntes}
          aoFechar={() => setEnvio(null)}
          aoConcluir={() => setRefresco((n) => n + 1)}
        />
      )}
    </AbaShell>
  );
}
