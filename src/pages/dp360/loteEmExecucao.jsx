import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { evidenciasDoRun, lerDP360, logRoboDP360, statusRoboDP360 } from "../../services/dp360Api";

/**
 * O LOTE EM EXECUÇÃO — acima das abas, porque o robô não é de uma tela só.
 *
 * O dono, depois de disparar: "tem que ficar nessa tela rodando até acabar". Ficava mesmo,
 * e só ali: a espera, o painel e o estado eram locais do componente das Ocorrências, então
 * trocar de aba desmontava tudo e matava a leitura do log no meio. Quem mandou oito casos
 * e foi olhar a Revisão enquanto esperava perdia o acompanhamento — e não tinha como
 * reencontrá-lo, porque nada disso estava gravado em lugar nenhum.
 *
 * Agora o acompanhamento mora AQUI, num módulo com assinantes, e o pop-up é montado pelo
 * `DP360Cluster`. A tela que dispara só avisa que começou; o resto (esperar o run, ler o
 * log, conferir o desfecho no banco) roda fora dela e sobrevive à navegação.
 *
 * NÃO SOBREVIVE AO F5, e isso é deliberado: o que existe de duradouro é o run no GitHub e
 * o `conferido_em` no banco. Guardar o acompanhamento em `localStorage` criaria uma
 * terceira memória do mesmo fato, que envelhece sozinha e passa a mentir. Depois de
 * recarregar, quem responde "o robô está rodando?" é o aviso do topo, que lê o GitHub.
 */
/* O QUE DÁ PARA SABER DURANTE O RUN — e o que não dá (medido em 15/09/2026).
   O LOG NÃO: o GitHub só entrega o log de um run DEPOIS que ele termina. O próprio `gh`
   responde "is still in progress; logs will be available when it is complete". Eu tinha
   montado o "tempo real" em cima do log, e por isso o pop-up só mexia no fim.
   AS FOTOS SIM: no Executar, o robô fotografa o cartão de cada caso e sobe a foto NA HORA
   (`conferido_<crachá>_<dia>.png`, bot_ajustes_app.executar_decisoes). Cada foto que chega
   no bucket é um caso por onde ele já passou — é daí que sai o "1 por 1".
   O Recusar não tira foto por caso e recusa tudo num clique só no Transnet: ali não existe
   "um por um" para mostrar, e o quadro não finge. */
const RITMO_FOTOS_MS = 6000;
const RITMO_RUN_MS = 5000;
const RE_FOTO_CASO = /^conferido_(\d{8})_(\d{4}-\d{2}-\d{2})\.png$/i;
const LIMITE_MIN = 14;
const RE_ERRO = /ERRO|FALH/i;
const RE_RESULTADO = /_resultado\.csv$/i;

const VAZIO = new Map();
const txt = (v) => String(v ?? "").trim();
const cra8 = (c) => txt(c).replace(/\D/g, "").padStart(8, "0");
const ROTULO_CARD = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

let estado = null;
const assinantes = new Set();

function avisar() {
  for (const f of assinantes) f(estado);
}

function mexer(patch) {
  if (!estado) return;
  estado = { ...estado, ...patch };
  avisar();
}

/** O painel some da tela. O acompanhamento por baixo continua — ele não é do pop-up. */
export function fecharPainelDoLote() {
  estado = null;
  avisar();
}

/* A ESPERA DO RUN, igual à que já existia na tela — só que aqui ela não morre quando o DP
   troca de aba. Dois caminhos de casamento pelo mesmo motivo de antes: o gateway casa o
   disparo logo depois do dispatch e o run pode não ter nascido ainda, e aí o plano B é o
   que uma pessoa faria — olhar o run daquele robô que começou depois do meu clique. */
async function esperarORun({ runId, robo, desde }) {
  const limite = Date.now() + LIMITE_MIN * 60000;
  let primeira = true;
  while (Date.now() < limite) {
    // a primeira leitura é IMEDIATA: esperar 15 s para dizer "na fila" era o pop-up parado
    if (!primeira) await new Promise((r) => setTimeout(r, RITMO_RUN_MS));
    primeira = false;
    if (!estado) return "abandonado"; // ninguém mais acompanhando
    let runs = [];
    try {
      runs = await statusRoboDP360(2);
    } catch {
      continue; // falha de leitura não é falha do run
    }
    const meu = runId
      ? (runs || []).find((x) => String(x.id) === String(runId))
      : (runs || [])
          .filter(
            (x) =>
              txt(x.nome).toLowerCase().includes(txt(robo).toLowerCase()) &&
              Date.parse(txt(x.comecou_em)) >= desde - 60000,
          )
          .sort((a, b) => Date.parse(txt(b.comecou_em)) - Date.parse(txt(a.comecou_em)))[0];
    if (!meu) continue;
    mexer({ runId: estado.runId || meu.id });
    if (txt(meu.status) !== "completed") {
      mexer({ onde: txt(meu.status) === "queued" ? "na fila do GitHub" : "rodando no Transnet" });
      continue;
    }
    return txt(meu.conclusao) || "sem_conclusao";
  }
  return "tempo_esgotado";
}

/**
 * COMEÇA O ACOMPANHAMENTO. A tela chama e larga: daqui para a frente o módulo espera o
 * run, lê o log e confere o desfecho, mesmo que ela seja desmontada.
 *
 * `casos` vem pronto: `{ chave, cracha, date_ref, nome, dataBR }` por linha do lote.
 * `aoTerminar` é a única coisa que volta para quem disparou — a tela das Ocorrências usa
 * para reler a grade, e só faz sentido se ela ainda estiver montada.
 */
export async function acompanharLote({
  casos,
  runId,
  painel,
  robo = "ajustes",
  tipo = "executar",
  aba = "",
  titulo = "",
  ensaio = false,
  aoTerminar,
  aoParcial,
}) {
  const desde = Date.now();
  // o tipo do MEU lote: `estado` pode virar outro lote (ou nada) enquanto este espera
  const tipoDoLote = TIPOS[tipo] ? tipo : "generico";
  estado = {
    casos,
    runId: runId || null,
    painel: painel || "",
    desde,
    onde: "mandando o robô",
    tipo: TIPOS[tipo] ? tipo : "generico",
    aba,
    titulo,
    ensaio,
  };
  avisar();

  const meuInicio = desde;
  const aindaEMeu = () => estado && estado.desde === meuInicio;

  /* AS FOTOS, EM PARALELO COM A ESPERA: uma diz ONDE o run está (fila, rodando), a outra
     POR QUAL CASO o robô já passou. Só no Executar e fora do ensaio — é o único modo que
     sobe foto por caso. */
  const querChaves = new Set(casos.map((c) => c.chave));
  if (estado.tipo === "executar" && !ensaio) {
    (async () => {
      while (aindaEMeu() && !estado.fim) {
        await new Promise((r) => setTimeout(r, RITMO_FOTOS_MS));
        if (!aindaEMeu() || estado.fim || !estado.runId) continue;
        try {
          const d = new Date(estado.desde);
          const arquivos = await evidenciasDoRun(estado.runId, d.getUTCFullYear(), d.getUTCMonth() + 1);
          const vistos = new Set();
          for (const a of arquivos || []) {
            const m = RE_FOTO_CASO.exec(String(a?.arquivo || ""));
            const k = m ? `${m[1]}|${m[2]}` : "";
            if (k && querChaves.has(k)) vistos.add(k);
          }
          if (aindaEMeu() && vistos.size !== (estado.vistos?.size || 0)) mexer({ vistos });
        } catch {
          // sem a prova (bucket fora, gateway sem os secrets): o robô segue, a tela só não narra
        }
      }
    })();
  }

  /* O BANCO, DURANTE O RUN (15/09/2026). O robô passou a gravar cada caso quando termina
     (DP360 5fb981a) — então a tela pode mostrar o desfecho de cada um assim que ele sai, e
     tirar da lista quem já foi fechado, em vez de esperar o robô inteiro ("só recarrega a
     página quando finaliza tudo").
     A FOTO DE PARTIDA é tirada no disparo, antes de o robô chegar ao Transnet: um caso só
     conta como terminado quando a assinatura dele MUDOU desde ali e o estado é final.
     Sem isso, um caso que já estava "divergente" de uma rodada anterior apareceria como
     resolvido no primeiro segundo. */
  const terminais = TERMINAL[estado.tipo];
  if (terminais && !ensaio) {
    (async () => {
      const partida = await conferidosDepoisDoRobo(casos, estado.tipo).catch(() => null);
      if (!partida || !aindaEMeu()) return;
      let ultimaRecarga = 0;
      while (aindaEMeu() && !estado.fim) {
        await new Promise((r) => setTimeout(r, RITMO_BANCO_MS));
        if (!aindaEMeu() || estado.fim) break;
        const agoraBanco = await conferidosDepoisDoRobo(casos, estado.tipo).catch(() => null);
        if (!agoraBanco || !aindaEMeu()) continue;
        const parcial = casosQueTerminaram(partida, agoraBanco, terminais);
        if (parcial.size !== (estado.parcial?.size || 0)) {
          mexer({ parcial });
          // a lista da aba recarrega aos poucos — mas a releitura é pesada, então no máximo
          // uma a cada 15 s; o fim do run recarrega de novo de qualquer jeito
          if (aoParcial && Date.now() - ultimaRecarga >= RECARGA_MIN_MS) {
            ultimaRecarga = Date.now();
            try {
              aoParcial();
            } catch {
              // a aba pode ter sido fechada; isso não é problema daqui
            }
          }
        }
      }
    })();
  }

  const fim = await esperarORun({ runId, robo, desde });
  const runDoLote = (aindaEMeu() && estado.runId) || runId;

  /* A CORREÇÃO NÃO DEPENDE DO QUADRO (15/09/2026). No `corrigir` quem grava o desfecho no
     nosso banco é a TELA, com o que o log diz — o robô `ponto` não escreve caso nenhum. Se
     o DP disparou outro lote enquanto este rodava, o quadro já é do outro, mas o resultado
     deste ainda tem de chegar ao banco: senão o dia corrigido de verdade continuaria na
     lista esperando correção. */
  if (tipoDoLote === "corrigir" && !ensaio) {
    const log = await lerLogComPaciencia(runDoLote);
    const conta = desfechosDaCorrecao(casos, log, fim);
    if (aindaEMeu()) {
      mexer({ fim, terminouEm: Date.now(), onde: "", aoVivo: log || VAZIO_LOG });
      mexer({ porCaso: conta.porCaso, feitos: conta.feitos, faltaram: conta.faltaram });
    }
    try {
      await aoTerminar?.(fim, conta);
    } catch {
      // a tela que disparou pode já ter sido desmontada; isso não é problema daqui
    }
    return fim;
  }

  if (!aindaEMeu()) return fim;
  mexer({ fim, terminouEm: Date.now(), onde: "" });

  // COM O RUN FECHADO o log passa a existir: uma leitura só, para o motivo de quem ficou
  // pendente ("o Transnet recusou: ..."). Sem ele, o quadro fica com o que o banco sabe.
  if (estado.runId && !ensaio) {
    try {
      const texto = await logRoboDP360(estado.runId);
      if (aindaEMeu() && texto) mexer({ aoVivo: lerLogDoBot(texto) });
    } catch {
      // log ainda não publicado ou função sem a ação: segue sem o motivo
    }
  }

  /* ENSAIO e robô sem marca por caso no nosso banco não têm o que conferir: o único dado
     verdadeiro é o desfecho do run. Dizer "conferido" ali seria inventar. */
  let conta;
  if (ensaio || tipoDoLote === "generico" || tipoDoLote === "corrigir") {
    const estadoDe = ensaio ? "ensaio" : fim === "success" ? "enviado" : "runFalhou";
    const porCaso = new Map(casos.map((c) => [c.chave, { estado: estadoDe }]));
    const feitos = FEITO.has(estadoDe) ? casos : [];
    conta = { porCaso, feitos, faltaram: casos.filter((c) => !feitos.includes(c)) };
  } else {
    conta = await conferidosDepoisDoRobo(casos, tipoDoLote);
  }
  if (!aindaEMeu()) return fim;
  if (!conta) {
    mexer({ erro: "o robô terminou, mas não consegui reler os casos — recarregue a tela" });
  } else {
    mexer({ porCaso: conta.porCaso, feitos: conta.feitos, faltaram: conta.faltaram });
  }
  try {
    aoTerminar?.(fim, conta);
  } catch {
    // a tela que disparou pode já ter sido desmontada; isso não é problema daqui
  }
  return fim;
}

/* O LOG DE UM RUN QUE ACABOU DE FECHAR pode demorar alguns segundos para ser servido. Na
   correção ele é a ÚNICA prova por dia, então vale insistir um pouco antes de desistir. */
const VAZIO_LOG = new Map();
async function lerLogComPaciencia(runId) {
  if (!runId) return null;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    if (tentativa) await new Promise((r) => setTimeout(r, 6000));
    try {
      const texto = await logRoboDP360(runId);
      if (texto) return lerLogDoBot(texto);
    } catch {
      // função sem a ação ou log ainda não publicado: tenta de novo
    }
  }
  return null;
}

/**
 * O QUE O ROBÔ `ponto` FEZ EM CADA DIA — e só o log sabe.
 *
 * O run dele sai VERDE mesmo quando um dia não grava: ele anota o resultado por linha e
 * segue (bot_ponto.py `roda_lote`). Então verde não é "corrigido". O que é: a linha
 * `CONFERIDO <crachá> <dia>`, que ele só escreve depois de INSERIR, reabrir o cartão e ver
 * as quatro pontas iguais ao que mandou (`lancar_registro`, "Só é confirmado depois de abrir
 * o cartão de novo"). As outras palavras dele viram o motivo de quem não passou:
 *   FECHADO     → a competência fechou; o Transnet não grava mais esse dia
 *   DIVERGENTE  → inseriu, mas o cartão relido não ficou igual
 *   RECUSADO    → o Transnet recusou, com a frase do alerta
 *   VERIFICAR   → não deu para confirmar (sem releitura não há prova)
 * Sem log nenhum (a função `robo_log` não respondeu) NINGUÉM vira corrigido: o dia continua
 * na lista, e o quadro diz que é para conferir.
 */
export function desfechosDaCorrecao(casos, log, fim) {
  const porCaso = new Map();
  const feitos = [];
  for (const c of casos || []) {
    const fala = log?.get(c.chave);
    const passo = txt(fala?.passo).toUpperCase();
    // `motivo` é a frase que fica gravada no caso (`transnet_resposta`) para a linha dizer
    // por que não subiu depois que este quadro fechar
    let item;
    if (passo === "CONFERIDO") item = { estado: "corrigido" };
    else if (passo === "FECHADO") item = { estado: "ponto_fechado", motivo: fala.frase };
    else if (passo === "DIVERGENTE")
      item = {
        estado: "divergente",
        texto: "gravou, mas o cartão relido não ficou igual",
        motivo: `gravou, mas o cartão relido não ficou igual (${fala.frase})`,
      };
    else if (fala) item = { estado: "pendente", texto: `não corrigiu — ${fala.frase}`, motivo: fala.frase };
    else if (!log)
      item =
        fim === "success"
          ? { estado: "semLog" }
          : { estado: "runFalhou", motivo: `o robô terminou em "${fim}" antes de corrigir — veja o log do run` };
    else
      item = {
        estado: "pendente",
        texto: "não corrigiu — o robô não chegou neste dia",
        motivo: "o robô não chegou neste dia (a fila dele parou antes)",
      };
    porCaso.set(c.chave, item);
    if (item.estado === "corrigido") feitos.push(c);
  }
  return { porCaso, feitos, faltaram: (casos || []).filter((c) => !feitos.includes(c)) };
}

/** O disparo falhou antes de virar run: o painel diz isso em vez de esperar para sempre. */
export function lotePifou(motivo) {
  mexer({ fim: "erro", terminouEm: Date.now(), erro: motivo, onde: "" });
}

export function useLoteEmExecucao() {
  const [x, setX] = useState(estado);
  useEffect(() => {
    assinantes.add(setX);
    setX(estado);
    return () => assinantes.delete(setX);
  }, []);
  return x;
}

/* O QUE O BOT ESCREVE, POR CASO — e como isso vira uma frase. Tudo sai de
   `executar_decisoes`, no fim dele:

     conferido_em         confirmou no Transnet e tirou o caso da fila
     correcao_status      "ponto_fechado" = o Transnet recusa gravar aquele dia
     conf_veredito        "divergente" = aceitou e o cartão não ficou como o DP fechou
                          "sem_base"   = a leitura ao vivo veio vazia, não reescreve no escuro
     (nada)               falha técnica: o caso continua pendente, SEM marca — de propósito
                          ("quem falhou assim continua pendente, que é exatamente o que ele é") */
const DESFECHO_CASO = {
  conferido: { icone: "✅", tom: "ok", texto: "conferido — fora da fila" },
  ponto_fechado: { icone: "🔒", tom: "warn", texto: "ponto fechado — o Transnet não grava mais esse dia" },
  divergente: { icone: "⚠", tom: "warn", texto: "o cartão não ficou como o DP fechou" },
  sem_base: { icone: "⚠", tom: "warn", texto: "leitura ao vivo veio vazia — não reescreveu no escuro" },
  pendente: { icone: "⏳", tom: "mute", texto: "continua pendente — o robô não conseguiu mexer" },
  esperando: { icone: "⏳", tom: "mute", texto: "esperando o robô" },
  // recusar pedido (modo `cancelar pedidos`): o bot marca aceite=cancelado só no dia cuja
  // recusa inteira confirmou — o resto fica em A decidir, de propósito
  cancelado: { icone: "✅", tom: "ok", texto: "recusado no Transnet · foi para Cancelados" },
  mantido: { icone: "⏳", tom: "warn", texto: "continua em A decidir — nem tudo foi recusado" },
  // robôs que não deixam marca por caso no nosso banco: só o desfecho do run é verdade
  enviado: { icone: "✅", tom: "ok", texto: "o robô terminou" },
  runFalhou: { icone: "⚠", tom: "warn", texto: "o robô terminou com falha — veja o log" },
  ensaio: { icone: "👁", tom: "mute", texto: "ensaio — nada foi gravado" },
  // correção pelo robô `ponto` (o desfecho sai do log, ver `desfechosDaCorrecao`)
  corrigido: { icone: "✅", tom: "ok", texto: "corrigido — o robô releu o cartão e bate" },
  semLog: { icone: "⚠", tom: "warn", texto: "o robô terminou, mas não li o resultado deste dia — confira antes de dar por corrigido" },
};

/* O QUE CADA TIPO DE DISPARO DIZ. É o mesmo quadro para todos (dono, 15/09/2026: "tudo que
   for rodar precisa seguir o mesmo padrão, ficar rodando na página"); o que muda é o verbo
   enquanto roda e o que conta como feito no fim. */
const TIPOS = {
  executar: { rodando: "⚙ Lançando no Transnet", feito: "conferido(s) e fora da fila" },
  conferir: { rodando: "👁 Conferindo no Transnet", feito: "conferido(s) e fechado(s)" },
  cancelar: { rodando: "⚙ Recusando no Transnet", feito: "recusado(s) e fechado(s)" },
  generico: { rodando: "⚙ Robô rodando", feito: "enviado(s)" },
  // robô `ponto` corrigindo dia recusado: só conta o dia que ele releu e bateu
  corrigir: { rodando: "🔧 Corrigindo o ponto no Transnet", feito: "corrigido(s) e conferido(s)" },
};
const FEITO = new Set(["conferido", "cancelado", "enviado", "corrigido"]);

function desfechoDoCaso(caso, tipo = "executar") {
  if (tipo === "cancelar") {
    return txt(caso?.aceite).toLowerCase() === "cancelado" || txt(caso?.cancelado_em) ? "cancelado" : "mantido";
  }
  if (!caso) return "pendente";
  if (txt(caso.conferido_em)) return "conferido";
  if (txt(caso.correcao_status) === "ponto_fechado") return "ponto_fechado";
  const v = txt(caso.conf_veredito);
  if (v === "divergente" || v === "sem_base") return v;
  return "pendente";
}

/* `casos` chega PRONTO da tela — `{chave, cracha, date_ref, nome, dataBR}`. Normalizar
   aqui obrigaria este módulo a conhecer a forma do registro das Ocorrências, e ele não é
   de lá: quem dispara é que sabe traduzir a própria linha. */
/* A ASSINATURA DE UM CASO: tudo que o robô escreve quando termina. As linhas de
   "divergente" e "ponto fechado" que ele grava não trazem hora (`atualizado_em`), então não
   dá para perguntar "gravou depois do disparo?". Dá para perguntar "MUDOU desde o disparo?"
   — e é isso que a assinatura responde. */
function assinaturaDoCaso(c) {
  if (!c) return "";
  return [c.aceite, c.conferido_em, c.cancelado_em, c.correcao_status, c.conf_veredito, c.atualizado_em]
    .map(txt)
    .join("|");
}

/* O que conta como "o robô terminou este caso" durante o run. `pendente` e `mantido` NÃO
   entram: no meio do run eles querem dizer "ainda não chegou", e só no fim viram desfecho. */
const TERMINAL = {
  executar: new Set(["conferido", "ponto_fechado", "divergente", "sem_base"]),
  conferir: new Set(["conferido", "ponto_fechado", "divergente", "sem_base"]),
  cancelar: new Set(["cancelado"]),
};
/** Os casos que o robô já gravou: estado final E assinatura diferente da foto de partida. */
function casosQueTerminaram(partida, atual, terminais) {
  const parcial = new Map();
  for (const [k, v] of atual?.porCaso || []) {
    const antes = partida?.porCaso?.get(k);
    if (terminais.has(v.estado) && v.assinatura !== antes?.assinatura) parcial.set(k, v);
  }
  return parcial;
}

const RITMO_BANCO_MS = 8000;
const RECARGA_MIN_MS = 15000;

async function conferidosDepoisDoRobo(casos_do_lote, tipo = "executar") {
  const alvo = new Map();
  for (const c of casos_do_lote || []) {
    if (c?.chave) alvo.set(c.chave, c);
  }
  if (!alvo.size) return { porCaso: new Map(), feitos: [], faltaram: [] };

  const crachas = [...new Set((casos_do_lote || []).map((c) => txt(c.cracha)).filter(Boolean))];
  const dias = [...new Set([...alvo.keys()].map((k) => k.split("|")[1]))];
  let casos = [];
  try {
    // Dois `in.` e o cruzamento aqui: PostgREST não filtra por PARES, e pedir caso a caso
    // seria uma consulta por linha do lote.
    casos = await lerDP360("ponto_caso", {
      colunas:
        "cracha,date_ref,conferido_em,usuario,correcao_status,conf_veredito,aceite,cancelado_em,atualizado_em",
      filtros: { cracha: `in.(${crachas.join(",")})`, date_ref: `in.(${dias.join(",")})` },
      limite: 2000,
    });
  } catch {
    return null; // sem leitura não invento desfecho: quem chama diz "não consegui conferir"
  }

  const porChave = new Map();
  for (const c of casos || []) {
    const k = `${cra8(c.cracha)}|${txt(c.date_ref).slice(0, 10)}`;
    if (alvo.has(k)) porChave.set(k, c);
  }
  const porCaso = new Map();
  const feitos = [];
  const faltaram = [];
  for (const [k, reg] of alvo) {
    const linha = porChave.get(k);
    const estado = desfechoDoCaso(linha, tipo);
    porCaso.set(k, { estado, usuario: txt(linha?.usuario), assinatura: assinaturaDoCaso(linha) });
    (FEITO.has(estado) ? feitos : faltaram).push(reg);
  }
  return { porCaso, feitos, faltaram };
}

/* ── O QUE O ROBÔ ESTÁ DIZENDO, CASO A CASO, AGORA ────────────────────────────
   O bot imprime uma linha por caso enquanto trabalha:

     [bot_ponto]     VERIFICAR  30060250 2026-09-05: subiu | esperado [...] ao vivo [...]
     [bot_ponto]      CORRIGIR  30060284 2026-08-19: dia ja marcado como PONTO FECHADO
     [bot_ponto]            OK  30060951 2026-09-06: resultado confirmado -> dia encerrado.

   É daí que sai o tempo real. A tela NÃO reescreve essas frases: ela mostra a do robô,
   que é a única que sabe o que está acontecendo naquele segundo. O rótulo à esquerda dá
   o tom (OK verde, CORRIGIR e PENDENTE âmbar, VERIFICAR neutro) e nada mais.

   Ler o log em vez de mexer no bot foi deliberado: o bot roda na máquina do DP também, e
   o que está de pé lá não pode quebrar por causa de uma tela. */
const RE_LOG_CASO =
  /\[bot_[a-z_]+\]\s+([A-Za-zÇÃÕ-]+)\s{2,}(\d{6,8})\s+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s*:\s*(.+)/;

const TOM_DO_PASSO = { OK: "ok", CORRIGIR: "warn", PENDENTE: "warn", VERIFICAR: "mute" };

/* O RECADO DO TRANSNET, quando existe, VALE MAIS QUE O NOME DA EXCEÇÃO.
   Quando o Transnet recusa um lançamento ele abre um alerta, e o Selenium devolve isso
   como `UnexpectedAlertPresentException: Alert Text: Intervalo entre jornada Maior que
   19:00 horas`. Mostrar o nome da classe faz o DP achar que é defeito da ferramenta; o
   que aconteceu foi o Transnet RECUSAR o alvo que ele mesmo fechou, e a frase do alerta é
   a única coisa na tela que explica isso. Visto no run 34898154006. */
const RE_ALERTA = /Alert Text:\s*(.+)/i;

export function lerLogDoBot(texto) {
  const mapa = new Map();
  for (const bruto of String(texto || "").split(/\r?\n/)) {
    const m = RE_LOG_CASO.exec(bruto);
    if (!m) continue;
    const [, passo, cracha, data, frase] = m;
    const dia = data.includes("/")
      ? `${data.slice(6, 10)}-${data.slice(3, 5)}-${data.slice(0, 2)}`
      : data;
    const chave = `${cra8(cracha)}|${dia}`;
    const alerta = RE_ALERTA.exec(frase);
    const novo = {
      passo,
      tom: TOM_DO_PASSO[passo.toUpperCase()] || "mute",
      // a frase do robô inteira não cabe na coluna; o começo dela é o que diz o estado
      frase: alerta ? `o Transnet recusou: ${alerta[1].trim()}` : frase.split(" | ")[0].trim(),
      motivo: Boolean(alerta),
    };
    /* A ÚLTIMA palavra do robô vence — ELE FALA VÁRIAS VEZES do mesmo dia (verifica,
       corrige, reconfere) e o que vale é onde parou. Com UMA exceção: o `PENDENTE` que
       fecha o caso repete só o nome da exceção ("falha tecnica
       (UnexpectedAlertPresentException)"), e deixá-lo passar por cima apagaria a frase do
       Transnet que a linha anterior trouxe — que é a única que diz POR QUE falhou. */
    if (mapa.get(chave)?.motivo && !novo.motivo) {
      mapa.set(chave, { ...mapa.get(chave), tom: novo.tom, passo: novo.passo });
      continue;
    }
    mapa.set(chave, novo);
  }
  return mapa;
}


/**
 * O PAINEL DO LOTE — "enquanto ele tiver rodando eu quero um pop-up na tela mostrando
 * cada um" (dono, 14/09/2026).
 *
 * Ele existe porque o lote é a única ação da tela que mexe em N fichas de uma vez e demora
 * minutos. Um recado de uma linha no topo não dá conta: quem mandou oito casos quer ver os
 * oito, e quer saber qual dos oito não passou.
 *
 * AS LINHAS ACENDEM UMA A UMA, e a fonte disso não é o banco — é o LOG. O
 * `executar_decisoes` junta tudo e grava uma vez só no fim (`sc.gravar_caso(rows)`), então
 * pelo banco não dá mesmo para saber que o terceiro caso já passou. Mas o bot IMPRIME cada
 * passo enquanto anda, e o GitHub serve o log de um job em andamento: a tela lê de lá.
 *
 * SÃO DUAS FONTES, NESTA ORDEM. Enquanto o robô roda vale o log, que é o que está
 * acontecendo agora e pode mudar no minuto seguinte. Quando ele termina vale o BANCO, que
 * é o que ficou — e o banco sobrescreve o log, porque "estou corrigindo" não é desfecho.
 *
 * Log indisponível não quebra nada: as linhas ficam em "esperando o robô" e o resultado
 * chega inteiro no fim, que era o comportamento antes desta leitura existir.
 *
 * FECHAR NÃO CANCELA NADA. O robô está no GitHub e não ouve esta tela; o painel é janela,
 * não controle. Por isso ele não trava a tela atrás dele enquanto roda — o DP pode fechar,
 * olhar outro caso e voltar pelo aviso do topo.
 */
/**
 * O QUADRO DO ROBÔ, DENTRO DA FILA DE LANÇAMENTO (dono, 15/09/2026: "essa parte do robô tem
 * que ficar só nessa tela de fila de lançamento, para mostrar que está lançando e quando
 * acabar aparece que encerrou").
 *
 * Foi pop-up por um dia e não servia: cobria a tela inteira, em QUALQUER aba, com o
 * assunto de uma só. Agora é um quadro no alto da própria fila — a lista continua visível
 * embaixo, e é nela que os casos somem quando o robô os carimba.
 *
 * DOIS ESTADOS E NENHUM MEIO-TERMO NA CARA: âmbar enquanto lança, verde (ou âmbar, se
 * sobrou caso) quando encerra. O botão de fechar só existe DEPOIS de encerrar: antes disso
 * não há o que dispensar, e fechar interromperia o acompanhamento — o módulo para de ler o
 * log e de conferir o banco quando o estado some.
 *
 * O acompanhamento continua valendo fora daqui: se o DP trocar de aba, o módulo segue
 * esperando o robô, e ao voltar para a fila o quadro está onde parou.
 */
export default function PainelExecucao({ aba = "" }) {
  const execucao = useLoteEmExecucao();
  const [agora, setAgora] = useState(() => Date.now());
  // o que o robô falou até agora vem do módulo, que lê o log mesmo com a tela fechada
  const aoVivo = execucao?.aoVivo ?? VAZIO;
  useEffect(() => {
    if (!execucao || execucao.fim) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [execucao, execucao?.fim]);

  if (!execucao) return null;
  // O QUADRO MORA NA ABA QUE DISPAROU: recusar pedido aparece em A decidir, lançar na Fila.
  if (aba && execucao.aba && execucao.aba !== aba) return null;
  const { casos, onde, fim, painel, desde, porCaso, erro, ensaio } = execucao;
  const vistos = execucao.vistos || VAZIO;
  const parcial = execucao.parcial || VAZIO;
  const tipo = TIPOS[execucao.tipo] || TIPOS.generico;
  const seg = Math.max(0, Math.round(((fim ? execucao.terminouEm : agora) - desde) / 1000));
  const relogio = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  const feitos = casos.filter((c) => FEITO.has(porCaso?.get(c.chave)?.estado)).length;
  // encerrou de verdade só quando o banco respondeu (ou quando não deu para conferir)
  const encerrou = Boolean(fim) && (Boolean(porCaso) || Boolean(erro));
  const tudoCerto = encerrou && !erro && (ensaio || feitos === casos.length);
  const tom = !encerrou ? "rodando" : tudoCerto ? "ok" : "pendente";

  /* POP-UP NO MEIO DA ABA (dono, 15/09/2026: "a aba vai ficar com um pop-up no meio dela
     carregando os lançamentos até finalizar, e passa 1 por 1"). O véu cobre a área da aba —
     a lista fica atrás, esmaecida — e o cartão fica preso no meio da parte visível da tela
     (`position: sticky`), então continua no meio mesmo numa lista de 158 linhas. A barra da
     DP360 fica de fora do véu: trocar de aba continua possível, e o acompanhamento segue. */
  return (
    <div className="oc-exec-veu" role="dialog" aria-modal="false" aria-label="Robô rodando nesta aba">
    <section className={`dp-card oc-exec oc-exec-${tom}`} aria-live="polite">
      <header className="oc-exec-topo">
        <div style={{ minWidth: 0 }}>
          <div className="oc-exec-rotulo">
            {!encerrou
              ? `${ensaio ? "Ensaio · " : ""}${execucao.titulo || tipo.rodando}`
              : ensaio
                ? "✅ Ensaio encerrou"
                : tudoCerto
                  ? "✅ Encerrou"
                  : "⚠ Encerrou com pendência"}
          </div>
          <div className="oc-exec-titulo">
            {!encerrou ? (
              <>
                {casos.length} crachá+dia <span className="dp-num">· {relogio}</span>
              </>
            ) : erro ? (
              "não consegui conferir o resultado"
            ) : ensaio ? (
              "nada foi gravado — nem no Transnet, nem aqui"
            ) : (
              <>
                {feitos} de {casos.length} {tipo.feito}
              </>
            )}
          </div>
          <div className="dp-muted" style={{ fontSize: 12 }}>
            {erro
              ? erro
              : encerrou
                ? `o robô terminou${fim === "success" ? "" : ` (${fim})`} em ${relogio}`
                : fim
                  ? "o robô terminou — conferindo cada caso no banco…"
                  : `${onde || "mandando o robô"}${
                      parcial.size
                        ? ` · ${parcial.size} de ${casos.length} gravado(s)`
                        : vistos.size
                          ? ` · já passou por ${vistos.size} de ${casos.length}`
                          : "…"
                    }`}
          </div>
        </div>
        {encerrou ? (
          <button type="button" className="dp-btn" onClick={fecharPainelDoLote} title="Tirar este quadro da tela">
            <X size={14} /> fechar
          </button>
        ) : null}
      </header>

      <div className="oc-exec-lista">
        {casos.map((c) => {
          /* O BANCO MANDA quando existe; até lá, a palavra do robô; e antes de ele falar
             deste caso, a espera. PENDENTE é o único desfecho sem motivo no banco (a falha
             técnica não deixa marca, de propósito) — só nele a última palavra do robô no log
             responde POR QUÊ. */
          const fechado = porCaso?.get(c.chave);
          const vivo = aoVivo.get(c.chave);
          const d = fechado
            ? fechado.texto
              ? { ...(DESFECHO_CASO[fechado.estado] || DESFECHO_CASO.pendente), texto: fechado.texto }
              : fechado.estado === "pendente" && vivo
                ? { ...DESFECHO_CASO.pendente, texto: `continua pendente — ${vivo.frase}` }
                : DESFECHO_CASO[fechado.estado]
            : parcial.has(c.chave)
              ? DESFECHO_CASO[parcial.get(c.chave).estado]
              : vistos.has(c.chave)
                ? { icone: "👁", tom: "ok", texto: "cartão lido ao vivo — gravando…" }
                : DESFECHO_CASO.esperando;
          return (
            <div key={c.chave} className="oc-exec-linha">
              <span className={`oc-exec-ic ${d.tom}`}>{d.icone}</span>
              <span className="oc-exec-nome" title={c.nome}>
                {c.nome} <span className="dp-muted dp-num">· {c.dataBR}</span>
              </span>
              <span className={`oc-exec-est ${d.tom}`} title={d.texto}>{d.texto}</span>
            </div>
          );
        })}
      </div>

      {painel ? (
        <footer className="oc-exec-pe">
          <a href={painel} target="_blank" rel="noreferrer">ver o log do run ↗</a>
          {!encerrou ? <span className="dp-faint"> · pode sair desta tela, o robô continua</span> : null}
        </footer>
      ) : null}
    </section>
    </div>
  );
}
