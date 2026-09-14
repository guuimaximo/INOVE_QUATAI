import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { lerDP360, logRoboDP360, statusRoboDP360 } from "../../services/dp360Api";

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
const RITMO_LOG_MS = 8000;
const RITMO_RUN_MS = 15000;
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
  while (Date.now() < limite) {
    await new Promise((r) => setTimeout(r, RITMO_RUN_MS));
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
export async function acompanharLote({ casos, runId, painel, robo = "ajustes", aoTerminar }) {
  const desde = Date.now();
  estado = { casos, runId: runId || null, painel: painel || "", desde, onde: "mandando o robô" };
  avisar();

  const meuInicio = desde;
  const aindaEMeu = () => estado && estado.desde === meuInicio;

  // a leitura do log corre em paralelo com a espera: uma diz ONDE ele está, a outra O QUE
  // ele está fazendo, e nenhuma das duas sabe responder pela outra.
  (async () => {
    while (aindaEMeu() && !estado.fim) {
      await new Promise((r) => setTimeout(r, RITMO_LOG_MS));
      if (!aindaEMeu() || estado.fim || !estado.runId) continue;
      try {
        const texto = await logRoboDP360(estado.runId);
        if (aindaEMeu() && texto) mexer({ aoVivo: lerLogDoBot(texto) });
      } catch {
        // log indisponível não é falha da execução: o robô segue, a tela só não narra
      }
    }
  })();

  const fim = await esperarORun({ runId, robo, desde });
  if (!aindaEMeu()) return fim;
  mexer({ fim, terminouEm: Date.now(), onde: "" });

  const conta = await conferidosDepoisDoRobo(casos);
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
};

function desfechoDoCaso(caso) {
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
async function conferidosDepoisDoRobo(casos_do_lote) {
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
      colunas: "cracha,date_ref,conferido_em,usuario,correcao_status,conf_veredito",
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
    const estado = desfechoDoCaso(porChave.get(k));
    porCaso.set(k, { estado, usuario: txt(porChave.get(k)?.usuario) });
    (estado === "conferido" ? feitos : faltaram).push(reg);
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
export default function PainelExecucao() {
  const execucao = useLoteEmExecucao();
  const aoFechar = fecharPainelDoLote;
  const [agora, setAgora] = useState(() => Date.now());
  // o que o robô falou até agora vem do módulo, que lê o log mesmo com o painel fechado
  const aoVivo = execucao?.aoVivo ?? VAZIO;
  useEffect(() => {
    if (execucao?.fim) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [execucao?.fim]);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aoFechar]);


  if (!execucao) return null;
  const { casos, onde, fim, painel, desde, porCaso, erro } = execucao;
  const seg = Math.max(0, Math.round(((fim ? execucao.terminouEm : agora) - desde) / 1000));
  const relogio = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  const feitos = casos.filter((c) => porCaso?.get(c.chave)?.estado === "conferido").length;

  return (
    <div
      className="rv-overlay rv-overlay-alto"
      role="dialog"
      aria-modal="true"
      aria-label="Execução no Transnet"
      onMouseDown={(e) => { if (e.target === e.currentTarget) aoFechar(); }}
    >
      <div className="dp-card rv-box oc-exec" style={{ maxWidth: 720 }}>
        <header className="rv-head rv-fixo">
          <div>
            <div style={{ ...ROTULO_CARD, color: "var(--dp-accent)" }}>Robô · executar decisões</div>
            <h3 style={{ margin: "4px 0 2px", fontSize: 16, fontWeight: 700 }}>
              {fim ? (
                <>
                  {feitos} de {casos.length} conferido(s)
                </>
              ) : (
                <>
                  {casos.length} crachá+dia no Transnet <span className="dp-num">· {relogio}</span>
                </>
              )}
            </h3>
            <div className="dp-muted" style={{ fontSize: 12 }}>
              {erro
                ? erro
                : fim
                  ? `o robô terminou${fim === "success" ? "" : ` (${fim})`} em ${relogio}`
                  : `${onde || "mandando o robô"}${
                      aoVivo.size ? ` · já passou por ${aoVivo.size} de ${casos.length}` : "…"
                    }`}
            </div>
          </div>
          <button type="button" className="dp-btn" onClick={aoFechar} aria-label="Fechar">
            <X size={14} />
          </button>
        </header>

        <div className="rv-corpo" style={{ padding: "4px 0" }}>
          {casos.map((c) => {
            /* O BANCO MANDA quando existe; até lá, a palavra do robô; e antes de ele
               falar deste caso, a espera. */
            const fechado = porCaso?.get(c.chave);
            const vivo = aoVivo.get(c.chave);
            /* PENDENTE É O ÚNICO DESFECHO SEM MOTIVO NO BANCO: a falha técnica não deixa
               marca nenhuma, de propósito ("o caso continua pendente, que é exatamente o
               que ele é"). Então, só nele, a última palavra do robô no log é o que
               responde POR QUÊ — e sem ela a linha diria "não conseguiu mexer" e pararia,
               escondendo que o Transnet recusou por uma regra dele. */
            const d = fechado
              ? fechado.estado === "pendente" && vivo
                ? { ...DESFECHO_CASO.pendente, texto: `continua pendente — ${vivo.frase}` }
                : DESFECHO_CASO[fechado.estado]
              : vivo
                ? { icone: vivo.tom === "ok" ? "✅" : vivo.tom === "warn" ? "⚙" : "👁", tom: vivo.tom, texto: vivo.frase }
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
          <footer className="rv-fixo" style={{ padding: "8px 2px 0", fontSize: 12 }}>
            <a href={painel} target="_blank" rel="noreferrer">ver o log do run ↗</a>
            <span className="dp-faint"> · fechar esta janela não para o robô</span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

