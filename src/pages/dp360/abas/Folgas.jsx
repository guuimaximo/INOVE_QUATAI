// Folgas (Passo 3 do DP360) — calendário SEMANAL: uma linha por colaborador,
// sete colunas (Seg→Dom) com o estado de cada dia.
//
// PORTE FIEL de `Sistemas/PONTO/app/ui/app.js` (`viewP3`, `calHtml`, `cellFor`,
// `folgasP`, `isDiaCurso`, `isSemOperacao`, `LEGENDA`) + do pivô de
// `ferramenta/processar_ponto.py`. A REGRA NÃO É DAQUI: `status_ponto`,
// `classificacao`, `dsr_auto` e `acao_passo3` já vêm calculados pelas views do
// Athena e caem prontos na `ponto_diario` (ver docs/dp360/PORTE.md §1). Esta tela
// só desenha o que a view decidiu — mudar régua é no SQL, não aqui.
//
// FASE ATUAL: SOMENTE LEITURA. Não grava nada.
// TODO(bot): "Lançar ocorrência" (DSR/Compensação/Curso no Transnet) depende do
// robô Selenium `bot_ocorrencia.py`, que roda no GitHub Actions — o navegador não
// consegue dirigir o Transnet. Quando a fase 5 do porte chegar, a tela grava a
// decisão e dispara o workflow; o robô lê a fila e devolve o resultado em
// `ponto_ocorrencias`. Até lá, esta aba apenas evidencia o que já foi lançado.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Palette, RefreshCw, Search, X } from "lucide-react";
import AbaShell from "./AbaShell";
import { lerDP360, lerTudoDP360 } from "../../../services/dp360Api";

/* ───────────────────────── constantes do domínio ───────────────────────── */

const CATEGORIAS = ["MOTORISTA", "INTERNO", "APRENDIZ"];
// Índice 0..6 ↔ `dia_semana_num` 1..7 (Seg=1 … Dom=7).
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Espelho de CELL_MAP (app.js ~3520): classificacao → [estilo, rótulo curto].
const MAPA_CLASSIFICACAO = {
  FOLGA_DSR: ["folga", "DSR"],
  FOLGA_COMP: ["folga", "COMP"],
  FERIADO: ["feriado", "Feriado"],
  ATESTADO: ["atest", "Atest"],
  FERIAS: ["ferias", "Férias"],
  AFASTADO: ["afast", "Afast"],
  JUSTIFICADO: ["just", "Just"],
  FALTA: ["falta", "Falta"],
  VERIFICAR: ["verif", "S/PONTO"],
  REGIME_INDEFINIDO: ["sem", "?"],
};

// Cores (equivalentes Tailwind das classes .cell.* de app/ui/styles.css).
const ESTILO_CELULA = {
  ok: "bg-emerald-100 text-emerald-800",
  rev: "bg-amber-100 text-amber-800",
  folga: "bg-sky-100 text-sky-800",
  curso: "bg-violet-100 text-violet-800",
  falta: "bg-rose-100 text-rose-700",
  res: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-300",
  verif: "bg-fuchsia-50 text-fuchsia-700",
  atest: "bg-purple-100 text-purple-800",
  ferias: "bg-cyan-100 text-cyan-800",
  afast: "bg-stone-200 text-stone-700",
  feriado: "bg-slate-200 text-slate-600",
  just: "bg-slate-100 text-slate-600",
  sem: "bg-slate-100 text-slate-400",
  vazio: "bg-transparent text-slate-300",
};

// Espelho de LEGENDA (app.js ~3656), sem os itens que dependem de escrita.
const LEGENDA = [
  ["ok", "✓", "OK", "Bateu ponto e o dia fechou certo"],
  ["rev", "!", "Revisar", "Ponto com pendência (tratado na aba Revisão)"],
  ["folga", "DSR", "Folga a lançar", "DSR quando isolada; COMP na 1ª de duas folgas seguidas"],
  ["curso", "Curso", "Curso", "Dia de curso do aprendiz (código 29)"],
  ["falta", "Falta", "Falta · S/OPER.", "Faltou, ou motorista bateu ponto sem operar (sem Citatti/bilhetagem)"],
  ["res", "RES.", "Reserva", "Motorista de reserva (standby) — marcado em ponto_reservas"],
  ["verif", "S/PONTO", "S/PONTO", "Sem ponto e sem nada lançado — o DP precisa definir o motivo"],
  ["atest", "Atest", "Atestado", "Atestado já lançado no Transnet"],
  ["ferias", "Férias", "Férias", "Férias já lançadas no Transnet"],
  ["afast", "Afast", "Afastado", "Afastamento (INSS, licença, suspensão…)"],
  ["feriado", "Feriado", "Feriado", "Feriado"],
  ["just", "Just", "Justificado", "Outro lançamento justificando o dia"],
  ["sem", "—", "Sem info", "Sem escala, regime indefinido (?) ou batidas ainda não processadas (s/ batida)"],
];

// Códigos de ocorrência do Transnet usados pelo Passo 3 (app.js MOTIVO_OPTS ~9).
const ROTULO_TIPO = { "05": "DSR", 40: "Compensação", 29: "Aprendizagem (curso)" };

const RE_CURSO = /CURSO|APRENDIZ|TREINAMENT/i;
const RE_FOLGA_LANCADA = /DSR|DESCANSO SEMANAL|COMPENS|FOLGA|CURSO|APRENDIZAGEM|TREINAMENT/i;
const RE_SEM_OPERACAO = /SEM_OPERACAO|sem opera/i;
const RE_BOT_ERRO = /ERRO|FALH/i;

// Colunas realmente usadas na grade — pedir `*` traria o cartão inteiro por dia.
const COLUNAS_GRADE = [
  "cracha", "nm_funcionario", "nm_funcao", "categoria", "regime", "semana",
  "dia_semana_num", "date_ref", "status_ponto", "classificacao", "motivo",
  "acao_passo3", "te_descricao_dia", "jornada_transnet", "todas_batidas",
  "entrada", "saida_almoco", "volta_almoco", "saida", "dsr_auto",
  "teve_operacao", "tem_ponto", "eh_feriado", "situacao_semana", "desligado_em",
].join(",");

/* ────────────────────────────── utilitários ────────────────────────────── */

// ATENÇÃO: a `ponto_diario` devolve boolean como STRING ("true"/"false") em boa
// parte das colunas (dsr_auto, eh_feriado, teve_operacao, tem_ponto). Comparar
// direto com `=== true` derruba a regra sem erro nenhum.
const ehVerdadeiro = (valor) => String(valor ?? "").trim().toLowerCase() === "true";
const ehFalso = (valor) => String(valor ?? "").trim().toLowerCase() === "false";
const texto = (valor) => String(valor ?? "").trim();

// Crachá com menos de 8 dígitos completa com zero à esquerda (regra da empresa —
// o lake mistura 7 e 8 dígitos na mesma pessoa).
function cra8(valor) {
  const c = texto(valor);
  return /^\d{1,7}$/.test(c) ? c.padStart(8, "0") : c;
}

const chaveDia = (cracha, dataRef) => `${cra8(cracha)}|${texto(dataRef).slice(0, 10)}`;

// Datas em ISO puro, montadas em UTC e formatadas à mão: nada de `toISOString()`
// sobre `new Date()` local (depois das 21h BRT viraria o dia seguinte).
function isoDeUtc(data) {
  return [
    data.getUTCFullYear(),
    String(data.getUTCMonth() + 1).padStart(2, "0"),
    String(data.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function paraUtc(iso) {
  const [ano, mes, dia] = texto(iso).slice(0, 10).split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somaDias(iso, dias) {
  const data = paraUtc(iso);
  if (!data) return "";
  data.setUTCDate(data.getUTCDate() + dias);
  return isoDeUtc(data);
}

// Segunda-feira da semana de uma data (a coluna `semana` já é a segunda).
function segundaDaSemana(iso) {
  const data = paraUtc(iso);
  if (!data) return "";
  const diaSemana = data.getUTCDay(); // 0 = domingo
  data.setUTCDate(data.getUTCDate() + (diaSemana === 0 ? -6 : 1 - diaSemana));
  return isoDeUtc(data);
}

const ddmm = (iso) => {
  const v = texto(iso);
  return v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : v;
};

// Código curto do evento lançado no Transnet: "07-FERIAS", "04-ATESTADO", DSR → "05-DSR".
function teCurto(descricao) {
  const te = texto(descricao);
  if (!te) return "";
  if (/DESCANSO SEMANAL/i.test(te)) return "05-DSR";
  const casou = te.match(/^(\d+)\s*-\s*(.+)$/);
  return casou ? `${casou[1]}-${casou[2].trim()}` : te;
}

const ehMotorista = (linha) => texto(linha?.categoria).toUpperCase() === "MOTORISTA";
const ehAprendiz = (linha) => texto(linha?.categoria).toUpperCase() === "APRENDIZ";

// Ponto batido mas SEM operação (Citatti/bilhetagem). Vale SÓ para MOTORISTA —
// interno e aprendiz não têm operação para cruzar.
function semOperacao(linha) {
  if (!linha || !ehMotorista(linha)) return false;
  if (texto(linha.status_ponto) === "OK") return false;
  const jornada = texto(linha.jornada_transnet);
  return !!jornada && (ehFalso(linha.teve_operacao) || RE_SEM_OPERACAO.test(texto(linha.motivo)));
}

// A folga do dia já foi lançada no Transnet? Devolve a descrição (ou "").
function folgaJaLancada(linha) {
  const te = texto(linha?.te_descricao_dia);
  return RE_FOLGA_LANCADA.test(te) ? te : "";
}

// Dia de curso do aprendiz pelo histórico: dia útil sem ponto e sem lançamento
// que bate com o dia recorrente daquele crachá (get_dias_curso, main.py ~7430).
function ehDiaDeCurso(linha, cracha, diasCurso) {
  if (!linha || !ehAprendiz(linha) || folgaJaLancada(linha)) return false;
  const num = texto(linha.dia_semana_num);
  const classificacao = texto(linha.classificacao).toUpperCase();
  const jornada = texto(linha.jornada_transnet);
  return (
    !jornada &&
    ["1", "2", "3", "4", "5"].includes(num) &&
    (classificacao === "VERIFICAR" || classificacao === "REGIME_INDEFINIDO" || classificacao === "") &&
    diasCurso.get(cra8(cracha)) === num
  );
}

/* ───────────────────────── decisão de cada célula ──────────────────────── */

// Ordem idêntica à de `cellFor` (app.js ~3560). Não reordenar sem olhar lá: o
// "S/OPER." precisa vencer o "REVISAR", senão o motorista que bateu ponto sem
// operar aparece como simples pendência de ponto e ninguém vai atrás.
function celulaDoDia(linha, cracha, ctx) {
  if (!linha) return { cls: "vazio", txt: "" };
  const status = texto(linha.status_ponto);
  const classificacao = texto(linha.classificacao).toUpperCase();
  const acao = texto(linha.acao_passo3).toUpperCase();
  const te = texto(linha.te_descricao_dia);

  if (te) {
    // Já lançado no Transnet → mostra o CÓDIGO real, com ✓ quando é folga/curso.
    const curso = RE_CURSO.test(te);
    const folga = classificacao === "FOLGA_DSR" || classificacao === "FOLGA_COMP";
    const cls = curso
      ? "curso"
      : MAPA_CLASSIFICACAO[classificacao]
        ? MAPA_CLASSIFICACAO[classificacao][0]
        : folga
          ? "folga"
          : "sem";
    return { cls, txt: teCurto(te) + (curso || folga ? " ✓" : ""), full: te };
  }
  if (status === "OK") return { cls: "ok", txt: "✓", full: "Bateu ponto e o dia fechou certo" };
  if (semOperacao(linha)) {
    return ctx.reservas.has(chaveDia(cracha, linha.date_ref))
      ? { cls: "res", txt: "RES.", full: "Reserva (standby) — sem operação, mas o dia está justificado" }
      : { cls: "falta", txt: "S/OPER.", full: "Bateu ponto mas NÃO operou (sem Citatti/bilhetagem)" };
  }
  if (ehDiaDeCurso(linha, cracha, ctx.diasCurso)) {
    return { cls: "curso", txt: "Curso", full: "Dia de curso do aprendiz (pelo histórico)" };
  }
  if (status === "REVISAR") return { cls: "rev", txt: "!", full: texto(linha.motivo) || "Ponto com pendência" };
  // Toda folga DSR entra na fila de lançamento — a DSR automática da escala do
  // Transnet não é confiável, então mesmo o dia que a escala marcaria vira "DSR".
  if (acao === "LANCAR_DSR" || classificacao === "FOLGA_DSR" || ehVerdadeiro(linha.dsr_auto)) {
    return { cls: "folga", txt: "DSR" };
  }
  const mapeado = MAPA_CLASSIFICACAO[classificacao];
  return mapeado
    ? { cls: mapeado[0], txt: mapeado[1], full: texto(linha.motivo) }
    : { cls: "sem", txt: "—", full: "Sem escala / sem informação para o dia" };
}

// Folgas ainda NÃO lançadas, com o tipo automático (folgasP, app.js ~3582):
// duas seguidas → 1ª Compensação (40) e 2ª DSR (05); isolada → DSR (05); curso → 29.
function folgasALancar(pessoa, diasCurso) {
  const dias = [];
  for (let d = 1; d <= 7; d += 1) {
    const linha = pessoa.linha[d];
    if (!linha || folgaJaLancada(linha)) continue;
    const folga =
      texto(linha.acao_passo3).toUpperCase() === "LANCAR_DSR" ||
      texto(linha.classificacao).toUpperCase() === "FOLGA_DSR" ||
      ehVerdadeiro(linha.dsr_auto);
    const curso = ehDiaDeCurso(linha, pessoa.cracha, diasCurso);
    if (folga || curso) dias.push({ d, data: texto(linha.date_ref).slice(0, 10), curso });
  }
  return dias.map((item, i) => {
    const seguidaDepois = i < dias.length - 1 && dias[i + 1].d === item.d + 1;
    const tipo = item.curso ? "29" : seguidaDepois ? "40" : "05";
    return { dia: item.d, data: item.data, tipo };
  });
}

/* ──────────────────────────── carga dos dados ──────────────────────────── */

function pivotarSemana(linhas) {
  const porCracha = new Map();
  linhas.forEach((linha) => {
    const cracha = texto(linha.cracha);
    if (!cracha) return;
    let pessoa = porCracha.get(cracha);
    if (!pessoa) {
      pessoa = {
        cracha,
        nome: texto(linha.nm_funcionario),
        regime: texto(linha.regime),
        funcao: texto(linha.nm_funcao),
        categoria: texto(linha.categoria),
        situacao: texto(linha.situacao_semana),
        desligadoEm: "",
        linha: {},
      };
      porCracha.set(cracha, pessoa);
    }
    const num = Number.parseInt(texto(linha.dia_semana_num), 10);
    if (num >= 1 && num <= 7) pessoa.linha[num] = linha;
    if (!pessoa.nome) pessoa.nome = texto(linha.nm_funcionario);
    if (!pessoa.regime) pessoa.regime = texto(linha.regime);
    if (!pessoa.funcao) pessoa.funcao = texto(linha.nm_funcao);
    if (!pessoa.situacao) pessoa.situacao = texto(linha.situacao_semana);
    if (!pessoa.desligadoEm) pessoa.desligadoEm = texto(linha.desligado_em);
  });
  return [...porCracha.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// Dia recorrente de curso de cada aprendiz: dia útil (seg-sex) em que ele vive
// sem ponto e sem lançamento, pelo menos 2x na janela. Espelha get_dias_curso.
function apurarDiasCurso(linhas) {
  const contagem = new Map();
  linhas.forEach((linha) => {
    const num = texto(linha.dia_semana_num);
    if (!["1", "2", "3", "4", "5"].includes(num)) return;
    const temPonto = !!texto(linha.jornada_transnet) || !!texto(linha.todas_batidas);
    const lancado = !!texto(linha.te_descricao_dia);
    if (temPonto || lancado) return;
    const cracha = cra8(linha.cracha);
    if (!cracha) return;
    if (!contagem.has(cracha)) contagem.set(cracha, new Map());
    const porDia = contagem.get(cracha);
    porDia.set(num, (porDia.get(num) || 0) + 1);
  });
  const saida = new Map();
  contagem.forEach((porDia, cracha) => {
    let melhorDia = "";
    let melhorQtd = 0;
    porDia.forEach((qtd, dia) => {
      if (qtd > melhorQtd) {
        melhorQtd = qtd;
        melhorDia = dia;
      }
    });
    if (melhorQtd >= 2) saida.set(cracha, melhorDia);
  });
  return saida;
}

/* ─────────────────────────── peças de interface ────────────────────────── */

function Celula({ estado }) {
  const cls = ESTILO_CELULA[estado.cls] || ESTILO_CELULA.sem;
  return (
    <div
      title={estado.full || undefined}
      className={`flex h-9 items-center justify-center rounded-lg px-1 text-[11px] font-bold leading-tight ${cls}`}
    >
      <span className="truncate">{estado.txt}</span>
    </div>
  );
}

function MarcaBot({ situacao }) {
  if (!situacao) return <span className="text-xs text-slate-300">—</span>;
  if (situacao === "erro") {
    return (
      <span title="O bot lançou, mas alguma ocorrência falhou" className="text-xs font-bold text-rose-600">
        🤖 ✗
      </span>
    );
  }
  return (
    <span title="Ocorrência lançada pelo bot com sucesso" className="text-xs font-bold text-emerald-600">
      🤖 ✓
    </span>
  );
}

function ModalLegenda({ aoFechar }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">🎨 Legenda das cores</h3>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar legenda"
          >
            <X size={17} />
          </button>
        </div>
        <ul className="mt-4 space-y-2">
          {LEGENDA.map(([cls, exemplo, titulo, descricao]) => (
            <li key={cls} className="flex items-start gap-3">
              <span
                className={`flex h-8 w-16 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${ESTILO_CELULA[cls]}`}
              >
                {exemplo}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800">{titulo}</div>
                <div className="text-xs leading-5 text-slate-600">{descricao}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          O lançamento das ocorrências no Transnet é feito pelo robô (fora do navegador). Esta tela
          mostra o que está pendente e o que o robô já lançou.
        </p>
      </div>
    </div>
  );
}

function PainelDetalhe({ pessoa, semana, ctx, aoFechar }) {
  const folgas = folgasALancar(pessoa, ctx.diasCurso);
  const tipoPorData = new Map(folgas.map((f) => [f.data, f.tipo]));
  const situacaoRuim = pessoa.situacao && !/^OK/i.test(pessoa.situacao);

  return (
    <aside className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:w-[350px]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-900">{pessoa.nome}</div>
          <div className="mt-0.5 text-xs font-semibold text-slate-500">
            crachá {pessoa.cracha}
            {pessoa.regime ? ` · ${pessoa.regime}` : ""}
            {pessoa.funcao ? ` · ${pessoa.funcao}` : ""}
          </div>
          {pessoa.situacao && (
            <div
              className={`mt-1 text-xs font-bold ${situacaoRuim ? "text-amber-700" : "text-slate-500"}`}
            >
              {situacaoRuim ? "⚠ " : ""}
              {pessoa.situacao}
            </div>
          )}
          {pessoa.desligadoEm && (
            <div className="mt-1 text-xs font-black text-rose-600">
              ⛔ DESLIGADO EM {ddmm(pessoa.desligadoEm)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-200"
          aria-label="Fechar detalhe"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const linha = pessoa.linha[d];
          const dataRef = texto(linha?.date_ref).slice(0, 10) || somaDias(semana, d - 1);
          const estado = celulaDoDia(linha, pessoa.cracha, ctx);
          const jornada = texto(linha?.jornada_transnet);
          const batidas =
            texto(linha?.todas_batidas).replace(/\s*\|\s*/g, " · ") ||
            [linha?.entrada, linha?.saida_almoco, linha?.volta_almoco, linha?.saida]
              .map(texto)
              .filter(Boolean)
              .join(" · ");
          const lancado = folgaJaLancada(linha);
          const tipo = tipoPorData.get(dataRef);
          const motivo = texto(linha?.motivo);
          const bot = ctx.ocorrencias.get(chaveDia(pessoa.cracha, dataRef));

          return (
            <div key={d} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0">
                  <div className="text-xs font-black text-slate-700">{DIAS_SEMANA[d - 1]}</div>
                  <div className="text-[11px] font-semibold text-slate-400">{ddmm(dataRef)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="w-24">
                    <Celula estado={estado} />
                  </div>
                </div>
              </div>

              {!linha && (
                <div className="mt-2 text-xs text-slate-400">Sem registro deste dia na base.</div>
              )}

              {jornada && (
                <div className="mt-2 font-mono text-[11px] font-semibold text-slate-700">
                  {batidas || "sem batidas"}
                </div>
              )}

              {lancado && (
                <div className="mt-1 text-[11px] font-semibold text-emerald-700" title={lancado}>
                  ✅ {teCurto(lancado)} — já lançado no Transnet
                </div>
              )}

              {semOperacao(linha) && (
                <div className="mt-1 text-[11px] font-semibold text-rose-700">
                  {ctx.reservas.has(chaveDia(pessoa.cracha, dataRef))
                    ? "✅ RES. — marcado como reserva (sem operação confirmada)"
                    : "⚠ bateu ponto mas NÃO operou (sem Citatti/bilhetagem) — confirmar se foi reserva"}
                </div>
              )}

              {!lancado && tipo && (
                <div className="mt-1 text-[11px] font-semibold text-sky-700">
                  Sugestão: {tipo}-{ROTULO_TIPO[tipo] || tipo} — a lançar pelo robô
                </div>
              )}

              {motivo && texto(linha?.status_ponto) !== "OK" && !semOperacao(linha) && (
                <div className="mt-1 text-[11px] text-amber-700">⚠ {motivo}</div>
              )}

              {bot && (
                <div className="mt-1 text-[11px] font-semibold text-slate-500">
                  🤖 {texto(bot.tipo)} · {texto(bot.status) || "sem status"}
                  {bot.lancado_em ? ` · ${ddmm(bot.lancado_em)}` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-5 text-slate-500">
        Somente leitura. O lançamento das ocorrências no Transnet continua no robô.
      </p>
    </aside>
  );
}

/* ──────────────────────────────── a aba ────────────────────────────────── */

export default function Folgas() {
  const [categoria, setCategoria] = useState("MOTORISTA");
  const [semanas, setSemanas] = useState([]);
  const [semana, setSemana] = useState("");
  const [termo, setTermo] = useState("");

  const [reservas, setReservas] = useState(() => new Set());
  const [ocorrencias, setOcorrencias] = useState(() => new Map());
  const [diasCurso, setDiasCurso] = useState(() => new Map());

  const [pessoas, setPessoas] = useState([]);
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [carregandoGrade, setCarregandoGrade] = useState(false);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState("");
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  // Base fixa: semanas disponíveis, reservas, ocorrências do bot e dias de curso.
  useEffect(() => {
    let vivo = true;
    setCarregandoBase(true);
    setErro("");
    (async () => {
      try {
        const [maisNovo, maisAntigo, linhasReservas, linhasOcorrencias, linhasAprendiz] =
          await Promise.all([
            lerDP360("ponto_diario", { colunas: "semana,date_ref", ordem: "date_ref.desc", limite: 1 }),
            lerDP360("ponto_diario", { colunas: "semana,date_ref", ordem: "date_ref.asc", limite: 1 }),
            lerTudoDP360("ponto_reservas", { colunas: "cracha,date_ref", ordem: "cracha" }, 10),
            lerTudoDP360(
              "ponto_ocorrencias",
              { colunas: "cracha,date_ref,tipo,status,lancado_em", ordem: "cracha" },
              10,
            ),
            lerTudoDP360(
              "ponto_diario",
              {
                colunas: "cracha,dia_semana_num,jornada_transnet,todas_batidas,te_descricao_dia",
                filtros: { categoria: "eq.APRENDIZ" },
                ordem: "cracha",
              },
              10,
            ),
          ]);
        if (!vivo) return;

        const topo = maisNovo[0] || {};
        const base = maisAntigo[0] || {};
        const fim = segundaDaSemana(texto(topo.semana) || texto(topo.date_ref));
        const inicio = segundaDaSemana(texto(base.semana) || texto(base.date_ref));
        const lista = [];
        let atual = fim;
        while (atual && inicio && atual >= inicio && lista.length < 60) {
          lista.push(atual);
          atual = somaDias(atual, -7);
        }

        setSemanas(lista);
        setSemana((anterior) => (anterior && lista.includes(anterior) ? anterior : lista[0] || ""));
        setReservas(new Set(linhasReservas.map((r) => chaveDia(r.cracha, r.date_ref))));
        setOcorrencias(
          new Map(
            linhasOcorrencias.map((o) => [
              chaveDia(o.cracha, o.date_ref),
              { tipo: texto(o.tipo), status: texto(o.status), lancado_em: texto(o.lancado_em) },
            ]),
          ),
        );
        setDiasCurso(apurarDiasCurso(linhasAprendiz));
      } catch (falha) {
        if (vivo) setErro(falha?.message || "Falha ao consultar a base DP360.");
      } finally {
        if (vivo) setCarregandoBase(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [recarga]);

  // Grade da semana/categoria escolhida.
  useEffect(() => {
    if (!semana) return undefined;
    let vivo = true;
    setCarregandoGrade(true);
    setSelecionado("");
    (async () => {
      try {
        // Filtra pelo INTERVALO de date_ref (formato garantido "YYYY-MM-DD") e não
        // pela coluna `semana`, cujo formato pode variar entre importações.
        const domingo = somaDias(semana, 6);
        const linhas = await lerTudoDP360(
          "ponto_diario",
          {
            colunas: COLUNAS_GRADE,
            filtros: {
              categoria: `eq.${categoria}`,
              date_ref: [`gte.${semana}`, `lte.${domingo}`],
            },
            ordem: "cracha",
          },
          12,
        );
        if (!vivo) return;
        setPessoas(pivotarSemana(linhas));
        setErro("");
      } catch (falha) {
        if (vivo) {
          setPessoas([]);
          setErro(falha?.message || "Falha ao carregar o calendário da semana.");
        }
      } finally {
        if (vivo) setCarregandoGrade(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [categoria, semana, recarga]);

  const ctx = useMemo(() => ({ reservas, ocorrencias, diasCurso }), [reservas, ocorrencias, diasCurso]);

  const visiveis = useMemo(() => {
    const q = termo.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.cracha.includes(q) || cra8(p.cracha).includes(q),
    );
  }, [pessoas, termo]);

  // Dia "não pronto": tem gente no dia mas NINGUÉM com ponto OK → as batidas ainda
  // não foram processadas na silver. Aí "Falta" é falso: mostra "s/ batida".
  const diasNaoProntos = useMemo(() => {
    const total = new Map();
    const oks = new Map();
    visiveis.forEach((p) => {
      for (let d = 1; d <= 7; d += 1) {
        const linha = p.linha[d];
        const dataRef = texto(linha?.date_ref).slice(0, 10);
        if (!dataRef) continue;
        total.set(dataRef, (total.get(dataRef) || 0) + 1);
        if (texto(linha.status_ponto) === "OK") oks.set(dataRef, (oks.get(dataRef) || 0) + 1);
      }
    });
    const naoProntos = new Set();
    total.forEach((qtd, dataRef) => {
      if (qtd >= 3 && !(oks.get(dataRef) > 0)) naoProntos.add(dataRef);
    });
    return naoProntos;
  }, [visiveis]);

  const linhasGrade = useMemo(
    () =>
      visiveis.map((pessoa) => {
        const folgas = folgasALancar(pessoa, diasCurso);
        const tipoPorData = new Map(folgas.map((f) => [f.data, f.tipo]));
        const celulas = [1, 2, 3, 4, 5, 6, 7].map((d) => {
          const linha = pessoa.linha[d];
          const estado = { ...celulaDoDia(linha, pessoa.cracha, ctx) };
          const dataRef = texto(linha?.date_ref).slice(0, 10);

          // Batidas ainda não processadas: "Falta" seria acusação injusta.
          if (linha && estado.cls === "falta" && diasNaoProntos.has(dataRef)) {
            estado.cls = "sem";
            estado.txt = "s/ batida";
            estado.full =
              "Batidas desse dia ainda não processadas na base (atraso da silver) — não é falta";
          }
          // Folga ainda a lançar: mostra o TIPO real (1ª de duas seguidas = COMP).
          if (estado.cls === "folga" && !estado.full && linha) {
            const tipo = tipoPorData.get(dataRef);
            if (tipo === "40") {
              estado.txt = "COMP";
              estado.full = "Compensação (40) — 1ª de duas folgas seguidas, a lançar";
            } else if (tipo === "29") {
              estado.txt = "Curso";
              estado.cls = "curso";
              estado.full = "Aprendizagem (29) — dia de curso, a lançar";
            } else if (tipo === "05") {
              estado.full = "DSR (05) — folga a lançar";
            }
          }
          return { dia: d, estado };
        });

        let bot = "";
        for (let d = 1; d <= 7; d += 1) {
          const linha = pessoa.linha[d];
          if (!linha) continue;
          const registro = ctx.ocorrencias.get(chaveDia(pessoa.cracha, linha.date_ref));
          if (!registro) continue;
          if (RE_BOT_ERRO.test(registro.status)) bot = "erro";
          else if (bot !== "erro") bot = "ok";
        }

        return { pessoa, celulas, bot, folgas };
      }),
    [visiveis, ctx, diasCurso, diasNaoProntos],
  );

  const totalFolgas = useMemo(
    () => linhasGrade.reduce((soma, item) => soma + item.folgas.length, 0),
    [linhasGrade],
  );

  const indiceSemana = semanas.indexOf(semana);
  const pessoaSelecionada = visiveis.find((p) => p.cracha === selecionado) || null;

  const cabecalhoDias = useMemo(
    () =>
      DIAS_SEMANA.map((rotulo, i) => ({
        rotulo,
        data: semana ? ddmm(somaDias(semana, i)) : "",
      })),
    [semana],
  );

  return (
    <AbaShell
      icone={CalendarDays}
      titulo="Folgas"
      resumo="Calendário semanal do Passo 3: quem está de folga, quem faltou e o que o robô já lançou no Transnet. Somente leitura."
      carregando={carregandoBase}
      erro={erro}
      acoes={
        <>
          <button
            type="button"
            onClick={() => setLegendaAberta(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Palette size={15} /> Legenda
          </button>
          <button
            type="button"
            onClick={recarregar}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={15} /> Atualizar
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={categoria}
          onChange={(evento) => setCategoria(evento.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
        >
          {CATEGORIAS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-1">
          <button
            type="button"
            title="Semana anterior"
            disabled={indiceSemana < 0 || indiceSemana >= semanas.length - 1}
            onClick={() => setSemana(semanas[indiceSemana + 1])}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          <select
            value={semana}
            onChange={(evento) => setSemana(evento.target.value)}
            className="bg-transparent px-1 py-1 text-sm font-bold text-slate-700"
          >
            {semanas.length === 0 && <option value="">Sem semanas</option>}
            {semanas.map((item) => (
              <option key={item} value={item}>
                Semana de {ddmm(item)}
              </option>
            ))}
          </select>
          <button
            type="button"
            title="Semana seguinte"
            disabled={indiceSemana <= 0}
            onClick={() => setSemana(semanas[indiceSemana - 1])}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            placeholder="Buscar por nome ou crachá…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
        <span>{visiveis.length} colaborador(es)</span>
        <span className="text-sky-700">{totalFolgas} folga(s) a lançar</span>
        <span className="text-slate-400">
          Lançamento no Transnet é feito pelo robô — esta tela não grava nada.
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4 xl:flex-row">
        <div className="min-w-0 flex-1">
          {carregandoGrade ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">
              Carregando o calendário da semana…
            </p>
          ) : linhasGrade.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-500">
              {pessoas.length === 0
                ? "Ninguém nessa categoria/semana."
                : "Nenhum colaborador bate com a busca."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-500">
                      Colaborador
                    </th>
                    {cabecalhoDias.map((dia) => (
                      <th
                        key={dia.rotulo}
                        className="px-1 py-2 text-center text-xs font-black uppercase text-slate-500"
                      >
                        {dia.rotulo}
                        <div className="text-[10px] font-bold normal-case text-slate-400">{dia.data}</div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-xs font-black uppercase text-slate-500">
                      🤖 Bot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasGrade.map(({ pessoa, celulas, bot }) => {
                    const situacaoRuim = pessoa.situacao && !/^OK/i.test(pessoa.situacao);
                    const ativo = pessoa.cracha === selecionado;
                    return (
                      <tr
                        key={pessoa.cracha}
                        onClick={() => setSelecionado(ativo ? "" : pessoa.cracha)}
                        className={`cursor-pointer border-t border-slate-100 ${ativo ? "bg-blue-50" : "hover:bg-slate-50"}`}
                      >
                        <td
                          className={`sticky left-0 z-10 px-3 py-1.5 ${ativo ? "bg-blue-50" : "bg-white"}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="max-w-[200px] truncate text-xs font-bold text-slate-800">
                              {pessoa.nome || pessoa.cracha}
                            </span>
                            {pessoa.regime && (
                              <span
                                title={rotuloRegime(pessoa.regime, pessoa.categoria)}
                                className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                              >
                                {pessoa.regime}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] font-semibold text-slate-400">
                            <span>{pessoa.cracha}</span>
                            {pessoa.situacao && (
                              <span className={situacaoRuim ? "text-amber-700" : "text-slate-400"}>
                                {situacaoRuim ? "⚠ " : ""}
                                {pessoa.situacao}
                              </span>
                            )}
                            {pessoa.desligadoEm && (
                              <span className="font-black text-rose-600">
                                ⛔ DESLIGADO EM {ddmm(pessoa.desligadoEm)}
                              </span>
                            )}
                          </div>
                        </td>
                        {celulas.map((celula) => (
                          <td key={celula.dia} className="px-1 py-1.5 align-middle">
                            <Celula estado={celula.estado} />
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center">
                          <MarcaBot situacao={bot} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pessoaSelecionada && (
          <PainelDetalhe
            pessoa={pessoaSelecionada}
            semana={semana}
            ctx={ctx}
            aoFechar={() => setSelecionado("")}
          />
        )}
      </div>

      {legendaAberta && <ModalLegenda aoFechar={() => setLegendaAberta(false)} />}
    </AbaShell>
  );
}

// Contexto do badge de regime: 6x1 = 1 folga/semana; 5x2 e 4x2 = 2 folgas.
// MOTORISTA é sempre 6x1.
function rotuloRegime(regime, categoria) {
  const chave = texto(regime).toUpperCase().replace(/\s+/g, "");
  if (texto(categoria).toUpperCase() === "MOTORISTA" || /6X1/.test(chave)) {
    return `${regime} — 1 folga por semana`;
  }
  if (/5X2|4X2/.test(chave)) return `${regime} — 2 folgas por semana`;
  return `Regime ${regime}`;
}
