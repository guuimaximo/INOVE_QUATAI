import { evidenciasDoRun, upsertDP360 } from "../../services/dp360Api";

/**
 * O RESULTADO DO ROBÔ DE FOLGAS, LIDO DE VOLTA — porte de `_ingest_ocorr`
 * (app/main.py:4521).
 *
 * No desktop o ciclo fecha sozinho: o bot roda na máquina do DP, escreve um relatório por
 * pessoa ao lado da fila (`fila_ocorr_resultado.csv`, com `status` linha a linha) e, assim
 * que o processo termina, a ferramenta lê esse arquivo e grava o status de verdade em
 * `ponto_ocorrencias`. É de lá que sai o 🤖 ✓ / 🤖 ✗.
 *
 * Pelo INOVE o robô roda no GitHub, e esse passo não existia: o relatório ficava no run e
 * ninguém lia. O dono topou com isso — lançou uma DSR, o robô lançou, e a tela continuou
 * dizendo que não tinha nada.
 *
 * O QUE MUDOU E TORNOU ISTO POSSÍVEL: desde 14/09/2026 o próprio bot sobe o relatório para
 * o bucket (`bot_ocorrencia.py`, "o relatório É a prova"). Então é o MESMO arquivo do
 * desktop, no mesmo formato, lido do mesmo jeito — só que pela URL assinada em vez do
 * disco.
 *
 * POR CONTEÚDO, NÃO POR RELÓGIO. O elo entre a linha pendente e o run podia ser a hora,
 * mas `concurrency: bots-transnet` faz um run esperar o outro: o disparo das 9h05 pode
 * virar run das 9h40, e qualquer janela que eu escolhesse estaria errada em algum dia. O
 * relatório, esse, diz exatamente quem ele lançou — crachá, dia e tipo. Então o casamento é
 * pelo conteúdo, e o relógio serve só para não varrer run antigo à toa.
 */
const RE_RESULTADO = /_resultado\.csv$/i;
const RE_ERRO = /ERRO|FALH/i;
const MAX_RUNS = 10;
const MARGEM_MS = 10 * 60000;

/** O status que a tela escreve no disparo, enquanto o desfecho não chega. */
export const STATUS_DISPARADO = "DISPARADO PELO INOVE";

/* O deslocamento de São Paulo NAQUELE instante, perguntado ao próprio Intl. Cravar −03:00
   funcionaria hoje, mas o horário de verão já existiu neste fuso e pode voltar por decreto:
   o dia em que voltasse, o casamento erraria uma hora e ninguém ligaria uma coisa à outra. */
function deslocamentoSP(t) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value]),
  );
  const hora = p.hour === "24" ? "00" : p.hour;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +hora, +p.minute, +p.second) - t;
}

/* `lancado_em` é naive ("2026-09-14T15:26:01"), do mesmo jeito que o desktop grava
   (`datetime.now().isoformat()`). Naive não é UTC: ler com `Date.parse` daria o fuso do
   NAVEGADOR, e o DP pode abrir a tela de qualquer lugar. Aqui ele é lido como São Paulo,
   que é onde os dois relógios que escrevem nessa coluna estão. */
export function epocaSaoPaulo(naive) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(naive ?? ""));
  if (!m) return NaN;
  const comoUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  return comoUtc - deslocamentoSP(comoUtc);
}

/* O relatório do bot: `cracha,data,tipo,status`, dd/mm/aaaa, escrito em utf-8-SIG — o BOM
   gruda no primeiro cabeçalho e faria a coluna `cracha` sumir sem erro nenhum. */
export function lerRelatorio(texto) {
  const linhas = String(texto ?? "").replace(/^﻿/, "").trim().split(/\r?\n/);
  if (linhas.length < 2) return [];
  const cab = linhas[0].split(",").map((c) => c.trim().toLowerCase());
  const col = (nome) => cab.indexOf(nome);
  const iCra = col("cracha");
  const iData = col("data");
  const iTipo = col("tipo");
  const iSt = col("status");
  if (iCra < 0 || iData < 0 || iSt < 0) return [];
  const out = [];
  for (const linha of linhas.slice(1)) {
    if (!linha.trim()) continue;
    const c = linha.split(",");
    const d = String(c[iData] ?? "").trim();
    out.push({
      cracha: String(c[iCra] ?? "").trim(),
      date_ref: d.length === 10 ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : d,
      tipo: String(c[iTipo] ?? "").trim(),
      status: String(c[iSt] ?? "").trim(),
    });
  }
  return out;
}

/** O relatório daquele run, ou `null` quando ele não subiu prova nenhuma. */
async function relatorioDoRun(run) {
  const t = Date.parse(String(run.comecou_em || ""));
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  const arquivos = await evidenciasDoRun(run.id, d.getUTCFullYear(), d.getUTCMonth() + 1);
  const alvo = (arquivos || []).find(
    (a) => a.robo === "ocorrencias" && RE_RESULTADO.test(String(a.arquivo || "")) && a.url,
  );
  if (!alvo) return null;
  const r = await fetch(alvo.url);
  if (!r.ok) return null;
  return lerRelatorio(await r.text());
}

/**
 * Fecha o ciclo das linhas pendentes. Devolve `{ aplicados, lidos }`.
 *
 * `pendentes` são as linhas de `ponto_ocorrencias` ainda em `DISPARADO PELO INOVE`;
 * `runs` é a lista do vigia. Nada aqui levanta exceção: é uma conveniência que roda em
 * segundo plano, e o pior desfecho aceitável é a linha continuar ⏳ até a próxima volta.
 *
 * ENSAIO NÃO FECHA NADA. Se o relatório casado disser `DRY-RUN`, o run lido foi um ensaio
 * — e ensaio não lançou coisa alguma. Escrever esse status em cima de um disparo de
 * verdade apagaria o registro do que foi mandado, então a linha fica como está.
 */
export async function ingerirResultados(pendentes, runs) {
  if (!pendentes?.length) return { aplicados: 0, lidos: 0 };

  const chave = (c, d) => `${String(c ?? "").replace(/\D/g, "").padStart(8, "0")}|${String(d ?? "").slice(0, 10)}`;
  const esperando = new Map(pendentes.map((p) => [chave(p.cracha, p.date_ref), p]));
  const maisAntigo = Math.min(...pendentes.map((p) => epocaSaoPaulo(p.lancado_em)).filter(Number.isFinite));
  if (!Number.isFinite(maisAntigo)) return { aplicados: 0, lidos: 0 };

  // Do mais ANTIGO para o mais novo: se o mesmo dia foi mandado duas vezes, o último
  // relatório é que vale, e ele é o que sobrescreve por último.
  const candidatos = (runs || [])
    .filter((r) => String(r.status || "") === "completed")
    .map((r) => ({ r, t: Date.parse(String(r.comecou_em || "")) }))
    .filter((x) => Number.isFinite(x.t) && x.t >= maisAntigo - MARGEM_MS)
    .sort((a, b) => a.t - b.t)
    .slice(0, MAX_RUNS)
    .map((x) => x.r);

  const aplicar = new Map();
  let lidos = 0;
  for (const run of candidatos) {
    let relatorio = null;
    try {
      relatorio = await relatorioDoRun(run);
    } catch {
      relatorio = null; // run sem prova, ou prova ilegível: o próximo pode ter
    }
    if (!relatorio?.length) continue;
    lidos += 1;
    for (const linha of relatorio) {
      const k = chave(linha.cracha, linha.date_ref);
      const pendente = esperando.get(k);
      if (!pendente) continue;
      if (/^DRY-RUN/i.test(linha.status)) continue;
      aplicar.set(k, {
        cracha: pendente.cracha,
        date_ref: String(pendente.date_ref).slice(0, 10),
        tipo: linha.tipo || pendente.tipo,
        status: linha.status,
        lancado_em: pendente.lancado_em,
        usuario: pendente.usuario ?? "",
      });
    }
  }

  if (!aplicar.size) return { aplicados: 0, lidos };
  try {
    await upsertDP360("ponto_ocorrencias", [...aplicar.values()]);
  } catch {
    return { aplicados: 0, lidos };
  }
  return { aplicados: aplicar.size, lidos };
}

/**
 * O DIA JÁ FOI MANDADO AO ROBÔ? Então ele não volta a ser oferecido.
 *
 *   OK…            lançou                              → fora da fila
 *   DISPARADO…     mandou, desfecho ainda não chegou   → fora da fila
 *   DRY-RUN        ensaio: não lançou nada             → CONTINUA na fila
 *   ERRO…          falhou                              → CONTINUA na fila
 *
 * O pendente sair da fila é o ponto: era ele que deixava o mesmo dia a um clique de ser
 * lançado duas vezes enquanto o robô ainda rodava. E o que FALHOU voltar é o outro lado da
 * mesma moeda — barrar pelo registro do disparo prenderia a correção sem explicação.
 *
 * O desktop não faz este corte (`folgasP`, app.js:3606, só olha o `te_descricao_dia`):
 * lá a marca 🤖 e a fila são informações separadas e conviver com o risco era o normal.
 * Divergência pedida pelo dono, 14/09/2026.
 */
export function ocorrenciaTrancaODia(registro) {
  const s = String(registro?.status ?? "").trim().toUpperCase();
  if (!s) return false;
  if (RE_ERRO.test(s)) return false;
  if (s.startsWith("DRY-RUN")) return false;
  return true;
}
