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
import { ChevronLeft, ChevronRight, Palette, RefreshCw, Search, X } from "lucide-react";
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

// Estados de célula que existem como `.dp-cell.<estado>` no dp360.css (porte
// direto das classes `.cell.*` de app/ui/styles.css). Qualquer coisa fora daqui
// cai em "sem" — a cor da célula é a informação, então nunca fica sem classe.
const ESTADOS_CELULA = new Set([
  "ok", "rev", "folga", "curso", "falta", "res", "verif",
  "atest", "ferias", "afast", "feriado", "just", "sem", "vazio",
]);

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
  const cls = ESTADOS_CELULA.has(estado.cls) ? estado.cls : "sem";
  return (
    <div className={`dp-cell ${cls}`} title={estado.full || undefined}>
      <span>{estado.txt}</span>
    </div>
  );
}

function MarcaBot({ situacao }) {
  if (!situacao) return <span className="dp-faint">—</span>;
  if (situacao === "erro") {
    return (
      <span className="dp-botmark e" title="O bot lançou, mas alguma ocorrência falhou">
        🤖 ✗
      </span>
    );
  }
  return (
    <span className="dp-botmark o" title="Ocorrência lançada pelo bot com sucesso">
      🤖 ✓
    </span>
  );
}

function ModalLegenda({ aoFechar }) {
  return (
    <div
      className="dp-overlay"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="dp-modal">
        <div className="dp-modal-head">
          <h3>🎨 Legenda das cores</h3>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar legenda">
            <X size={17} />
          </button>
        </div>
        <div className="dp-lg-list">
          {LEGENDA.map(([cls, exemplo, titulo, descricao]) => (
            <div key={cls} className="dp-lg-row">
              <span className={`dp-cell lg-sw ${cls}`}>
                <span>{exemplo}</span>
              </span>
              <div className="dp-lg-txt">
                <b>{titulo}</b>
                <span>{descricao}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="dp-lg-foot">
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
    <aside className="dp-detail">
      <div className="dp-det-head">
        <div style={{ minWidth: 0 }}>
          <b>{pessoa.nome}</b>
          <div className="sub">
            crachá {pessoa.cracha}
            {pessoa.regime ? ` · ${pessoa.regime}` : ""}
            {pessoa.funcao ? ` · ${pessoa.funcao}` : ""}
          </div>
          {pessoa.situacao && (
            <div className="sub">
              {situacaoRuim ? (
                <span className="dp-pill warn">⚠ {pessoa.situacao}</span>
              ) : (
                pessoa.situacao
              )}
            </div>
          )}
          {pessoa.desligadoEm && (
            <div className="sub">
              <span className="dp-pill danger">⛔ DESLIGADO EM {ddmm(pessoa.desligadoEm)}</span>
            </div>
          )}
        </div>
        <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar detalhe">
          <X size={16} />
        </button>
      </div>

      <div>
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
            <div key={d} className="dp-dblock">
              <div className="dp-drow">
                <div className="dp-dday">
                  {DIAS_SEMANA[d - 1]}
                  <span className="sub">{ddmm(dataRef)}</span>
                </div>
                <div className="dp-dcell">
                  <Celula estado={estado} />
                </div>
              </div>

              {!linha && <div className="dp-dnote mute">Sem registro deste dia na base.</div>}

              {jornada && <div className="dp-dnote bat">{batidas || "sem batidas"}</div>}

              {lancado && (
                <div className="dp-dnote ok" title={lancado}>
                  ✅ {teCurto(lancado)} — já lançado no Transnet
                </div>
              )}

              {semOperacao(linha) && (
                <div
                  className={`dp-dnote ${ctx.reservas.has(chaveDia(pessoa.cracha, dataRef)) ? "ok" : "danger"}`}
                >
                  {ctx.reservas.has(chaveDia(pessoa.cracha, dataRef))
                    ? "✅ RES. — marcado como reserva (sem operação confirmada)"
                    : "⚠ bateu ponto mas NÃO operou (sem Citatti/bilhetagem) — confirmar se foi reserva"}
                </div>
              )}

              {!lancado && tipo && (
                <div className="dp-dnote sug">
                  Sugestão: {tipo}-{ROTULO_TIPO[tipo] || tipo} — a lançar pelo robô
                </div>
              )}

              {motivo && texto(linha?.status_ponto) !== "OK" && !semOperacao(linha) && (
                <div className="dp-dnote warn">⚠ {motivo}</div>
              )}

              {bot && (
                <div className="dp-dnote mute">
                  🤖 {texto(bot.tipo)} · {texto(bot.status) || "sem status"}
                  {bot.lancado_em ? ` · ${ddmm(bot.lancado_em)}` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="dp-det-foot">
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
      carregando={carregandoBase}
      erro={erro}
      filtros={
        <>
          <select value={categoria} onChange={(evento) => setCategoria(evento.target.value)}>
            {CATEGORIAS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <div className="dp-weeknav">
            <button
              type="button"
              title="Semana anterior"
              disabled={indiceSemana < 0 || indiceSemana >= semanas.length - 1}
              onClick={() => setSemana(semanas[indiceSemana + 1])}
            >
              <ChevronLeft size={15} />
            </button>
            <select value={semana} onChange={(evento) => setSemana(evento.target.value)}>
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
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="dp-busca">
            <Search size={14} />
            <input
              type="search"
              value={termo}
              onChange={(evento) => setTermo(evento.target.value)}
              placeholder="buscar por nome ou crachá…"
            />
          </div>

          <button type="button" className="dp-btn" onClick={() => setLegendaAberta(true)}>
            <Palette size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Legenda
          </button>
          <button type="button" className="dp-btn" onClick={recarregar}>
            <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Atualizar
          </button>
        </>
      }
      resumo={
        <>
          Calendário semanal do Passo 3: quem está de folga, quem faltou e o que o robô já lançou no
          Transnet. <b>{visiveis.length}</b> colaborador(es) ·{" "}
          <b>{totalFolgas}</b> folga(s) a lançar ·{" "}
          <span className="dp-faint">somente leitura — esta tela não grava nada.</span>
        </>
      }
    >
      <div className="dp-calsplit">
        <div className="dp-calscroll">
          {carregandoGrade ? (
            <div className="dp-vazio">Carregando o calendário da semana…</div>
          ) : linhasGrade.length === 0 ? (
            <div className="dp-vazio">
              {pessoas.length === 0
                ? "Ninguém nessa categoria/semana."
                : "Nenhum colaborador bate com a busca."}
            </div>
          ) : (
            <div className="dp-cal">
              <div className="dp-cal-row dp-cal-head">
                <div className="dp-calmark" />
                <div>Colaborador</div>
                {cabecalhoDias.map((dia) => (
                  <div key={dia.rotulo}>
                    {dia.rotulo} <span className="dp-cal-dt">{dia.data}</span>
                  </div>
                ))}
                <div>🤖 Bot</div>
              </div>

              <div className="dp-cal-body">
                {linhasGrade.map(({ pessoa, celulas, bot }) => {
                  const situacaoRuim = pessoa.situacao && !/^OK/i.test(pessoa.situacao);
                  const ativo = pessoa.cracha === selecionado;
                  return (
                    <div
                      key={pessoa.cracha}
                      className={`dp-cal-row${ativo ? " sel" : ""}`}
                      onClick={() => setSelecionado(ativo ? "" : pessoa.cracha)}
                    >
                      <div className="dp-calmark">
                        <i />
                      </div>
                      <div className="dp-cal-nome">
                        <b
                          title={[pessoa.nome || pessoa.cracha, pessoa.funcao, pessoa.situacao]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          {pessoa.nome || pessoa.cracha}
                        </b>
                        {pessoa.regime && (
                          <span className="reg" title={rotuloRegime(pessoa.regime, pessoa.categoria)}>
                            {pessoa.regime}
                          </span>
                        )}
                        <span className="cra">{pessoa.cracha}</span>
                        {pessoa.situacao && situacaoRuim && (
                          <span className="sit" title={pessoa.situacao}>
                            ⚠ {pessoa.situacao}
                          </span>
                        )}
                        {pessoa.desligadoEm && (
                          <span className="desl">⛔ DESLIGADO {ddmm(pessoa.desligadoEm)}</span>
                        )}
                      </div>
                      {celulas.map((celula) => (
                        <Celula key={celula.dia} estado={celula.estado} />
                      ))}
                      <div className="dp-calbot">
                        <MarcaBot situacao={bot} />
                      </div>
                    </div>
                  );
                })}
              </div>
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
