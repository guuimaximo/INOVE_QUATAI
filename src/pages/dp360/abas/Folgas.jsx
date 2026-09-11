// Folgas (Passo 3 do DP360) — calendário SEMANAL: uma linha por colaborador,
// sete colunas (Seg→Dom) com o estado de cada dia.
//
// PORTE FIEL de `Sistemas/PONTO/app/ui/app.js` (`viewP3`, `calHtml`, `cellFor`,
// `folgasP`, `isDiaCurso`, `isSemOperacao`, `LEGENDA`, `abrePickerMotivo`,
// `filaTotal`/`lancarMassa`, `abreDetalhe`) + do pivô de
// `ferramenta/processar_ponto.py`. A REGRA NÃO É DAQUI: `status_ponto`,
// `classificacao`, `dsr_auto` e `acao_passo3` já vêm calculados pelas views do
// Athena e caem prontos na `ponto_diario` (ver docs/dp360/PORTE.md §1). Esta tela
// só desenha o que a view decidiu — mudar régua é no SQL, não aqui.
//
// O QUE ESTA TELA GRAVA (o resto é leitura):
//   · `app_config.folga_motivos` — o motivo que o DP define à mão num dia
//     S/PONTO (ou troca numa folga automática). É a MESMA chave da ferramenta
//     desktop (main.py `set_folga_motivo`/`limpar_folga_motivos`), então o que
//     for marcado aqui aparece lá e vice-versa. Por isso toda gravação RELÊ a
//     chave inteira imediatamente antes de escrever: gravar o mapa que a tela
//     leu na abertura apagaria, calado, o que a outra ponta marcou.
//   · `ponto_reservas` — marcar/desmarcar o dia do motorista como RESERVA
//     (main.py `set_reserva`). Sem isso quem estava de reserva fica com a célula
//     vermelha `S/OPER.` para sempre, com a mesma cor da falta.
//
// O navegador não dirige o Transnet: isso é o Selenium `bot_ocorrencia.py`, que
// roda no GitHub Actions do repo DP360, onde a credencial do Transnet vive como
// secret. Esta tela monta o lote e DISPARA; quem executa é o robô.
//
// O CSV é o mesmo que a ferramenta escreve (main.py `lancar_ocorrencias`, ~4451):
// colunas `cracha,data,tipo`, crachá com 8 dígitos (zeros à esquerda, senão o bot
// quebra), data dd/mm/aaaa, tipo = código do Transnet. O tipo automático vem do
// `folgasALancar` (duas seguidas → 1ª Compensação e 2ª DSR; isolada → DSR; dia de
// curso → 29) e o motivo definido à mão VENCE o automático no mesmo dia.
//
// O QUE ESTA TELA NÃO FAZ: ler o resultado do robô de volta. O workflow guarda a
// evidência como artefato e não escreve no Supabase — quem preenche
// `ponto_ocorrencias` hoje é o pós-processo da ferramenta desktop
// (`_ingest_ocorr`). Então, depois de disparar daqui, a coluna 🤖 só muda quando
// alguém ingerir o resultado. Está dito na tela, para ninguém achar que sumiu.
//
// DUAS COISAS A MAIS, PORTADAS DEPOIS (PORTE.md §11, itens 5 e 9):
//   · LANÇAR O PONTO SUGERIDO do dia, do próprio detalhe da pessoa (app.js:6168
//     `editorSug` → :6236 → main.py `lancar_bot_p2` ~2820). É o MESMO robô
//     (`ponto.yml`), o MESMO CSV de seis colunas e as MESMAS travas do "Lançar
//     ajuste" da Revisão — nada muda no repo do bot. Ver `montarAjusteDoDia`.
//   · HISTÓRICO DAS OCORRÊNCIAS já lançadas (app.js:3759 → :6145 `abreHistBot`,
//     lendo `get_ocorrencias`, main.py:2888). Sem consulta nova: é a MESMA
//     `ponto_ocorrencias` que a aba já carrega para a pílula 🤖 do dia.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, History, Palette, RefreshCw, Search, X } from "lucide-react";
import AbaShell from "./AbaShell";
import {
  apagarDP360,
  dispararRoboDP360,
  inserirDP360,
  lerDP360,
  lerTudoDP360,
  upsertDP360,
} from "../../../services/dp360Api";
// O `aplicarRealManual` é o overlay do Real cravado pelo DP, e é ele que faz o
// dia já decidido na Revisão aparecer aqui com o horário que o DP mandou.
import { aplicarRealManual, fmtHora } from "../CartaoDoDia";
import { usePergunta } from "../Perguntar";
// AS TRAVAS DO LANÇAMENTO NÃO SÃO DESTA TELA — nem da Revisão. Elas moram em
// `../regrasAjustePonto`, o mesmo módulo que o lote da Revisão usa: uma régua só
// para o mesmo robô (`sugBloqueio`, ponto invertido, cartão já mexido, as duas
// pontas, o miolo inteiro, a virada de meia-noite) e um CSV só.
import {
  almocoTravado,
  csvDoAjustePonto,
  ddmmaaaa,
  montarAjusteDoDia,
} from "../regrasAjustePonto";

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

// Espelho de LEGENDA (app.js ~3656). O item "definido por você" é desenhado à
// parte, no fim da lista, como no `legendaModal` do original.
const LEGENDA = [
  ["ok", "✓", "OK", "Bateu ponto e o dia fechou certo"],
  ["rev", "!", "Revisar", "Ponto com pendência (tratado na aba Revisão)"],
  ["folga", "DSR", "Folga a lançar", "DSR quando isolada; COMP na 1ª de duas folgas seguidas"],
  ["curso", "Curso", "Curso", "Dia de curso do aprendiz (código 29)"],
  ["falta", "Falta", "Falta · S/OPER.", "Faltou, ou motorista bateu ponto sem operar (sem Citatti/bilhetagem)"],
  ["res", "RES.", "Reserva", "Motorista de reserva (standby) — marque no detalhe do dia"],
  ["verif", "S/PONTO", "S/PONTO", "Sem ponto e sem nada lançado — clique na célula e diga o motivo"],
  ["atest", "Atest", "Atestado", "Atestado já lançado no Transnet"],
  ["ferias", "Férias", "Férias", "Férias já lançadas no Transnet"],
  ["afast", "Afast", "Afastado", "Afastamento (INSS, licença, suspensão…)"],
  ["feriado", "Feriado", "Feriado", "Feriado"],
  ["just", "Just", "Justificado", "Outro lançamento justificando o dia"],
  ["sem", "—", "Sem info", "Sem escala, regime indefinido (?) ou batidas ainda não processadas (s/ batida)"],
];

// Códigos de ocorrência do Transnet usados pelo Passo 3 (app.js MOTIVO_OPTS ~9).
const ROTULO_TIPO = { "05": "DSR", 40: "Compensação", 29: "Aprendizagem (curso)" };

/* ───────────── motivo do dia (o picker do S/PONTO) — app.js:9-15 ───────────
   Os 14 códigos que o DP pode escolher. O código é o que o bot DIGITA na tela
   do Transnet: não é rótulo bonito, é o campo do sistema. Mexer nesta lista é
   mexer no que o robô vai lançar. */
const MOTIVO_OPTS = [
  ["05", "DSR"], ["40", "Compensação"], ["12", "Folga compensada"], ["02", "Folga extra"],
  ["01", "Falta"], ["04", "Atestado médico"], ["29", "Aprendizagem (aprendiz)"],
  ["03", "Licença matrimonial"], ["08", "Licença paternidade"], ["16", "Suspensão"],
  ["13", "Abono"], ["10", "Luto"], ["17", "Doação de sangue"], ["26", "Exame periódico"],
];
// MOTIVO_MANUAL (app.js:15): o Atestado (04) fica na lista para o DP REGISTRAR o
// que foi o dia, mas NÃO entra na fila do robô — esse é lançado à mão. Se
// entrasse, o robô tentaria e o dia voltaria como erro.
const MOTIVO_MANUAL = new Set(["04"]);
const MOTIVO_LBL = Object.fromEntries(MOTIVO_OPTS);
// A MESMA chave do `app_config` que a ferramenta desktop usa (main.py:7008).
const CHAVE_MOTIVOS = "folga_motivos";

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

// Todas as grafias do mesmo crachá. A ferramenta desktop grava em
// `ponto_reservas` o crachá CRU (7 ou 8 dígitos, como veio do lake) e esta tela
// grava com 8; sem varrer as duas formas, desmarcar uma reserva deixaria para
// trás a linha escrita pelo desktop e a marcação "voltaria" na próxima leitura.
function variantesCracha(valor) {
  const c = texto(valor);
  return [...new Set([c, cra8(c), c.replace(/^0+/, "")].filter(Boolean))];
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

// Carimbo de INSTANTE (não é data local calculada): "06/09 14:32", o mesmo
// formato de `datetime.now().strftime("%d/%m %H:%M")` do desktop, para as duas
// ferramentas escreverem `ponto_reservas.marcado_em` igual. Fuso fixado em
// São Paulo — o relógio do navegador pode estar em qualquer lugar.
function carimboLocal() {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

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

// motivoCell (app.js ~20): cor + rótulo curto do motivo que o DP escolheu. A
// classe vem da PALAVRA da descrição, não do número — é o que faz "Suspensão"
// pintar de afastado e "Folga extra" pintar de folga.
function motivoCelula(codigo) {
  const rotulo = texto(MOTIVO_LBL[codigo] || codigo);
  const alto = rotulo.toUpperCase();
  const curto = rotulo.split(" ")[0].slice(0, 7);
  if (/DSR/.test(alto)) return { cls: "folga", txt: "DSR" };
  if (/COMPENSA/.test(alto)) return { cls: "folga", txt: "COMP" };
  if (/FOLGA|TIRA/.test(alto)) return { cls: "folga", txt: "Folga" };
  if (/FALTA/.test(alto)) return { cls: "falta", txt: "Falta" };
  if (/CURSO|APRENDIZ/.test(alto)) return { cls: "curso", txt: "Curso" };
  if (/ATESTADO/.test(alto)) return { cls: "atest", txt: "Atest" };
  if (/FERIAS/.test(alto)) return { cls: "ferias", txt: "Férias" };
  if (/FERIADO/.test(alto)) return { cls: "feriado", txt: "Feriado" };
  if (/LICEN|INSS|SUSPENS|SENTENCA|CARCERE|MILITAR/.test(alto)) return { cls: "afast", txt: curto };
  return { cls: "just", txt: curto };
}

const nomeDoMotivo = (codigo) => `${codigo}-${MOTIVO_LBL[codigo] || codigo}`;

// O CSV que o bot lê (csv.DictReader com fieldnames cracha,data,tipo). Sem aspas
// e sem ponto-e-vírgula: nenhum dos três campos tem vírgula — crachá é dígito,
// data é dd/mm/aaaa e tipo é código de dois dígitos.
function csvDoLote(linhas) {
  return ["cracha,data,tipo", ...linhas.map((l) => `${l.cracha},${l.data},${l.tipo}`)].join("\n");
}

// ÚNICO caminho de disparo desta aba (pessoa a pessoa e lote usam este). O CSV é
// montado num lugar só: dois montadores divergem em silêncio e o robô lança
// errado sem ninguém perceber.
function dispararLote(fila, confirmar) {
  const lote = fila.map((item) => ({
    cracha: cra8(item.cracha),
    data: ddmmaaaa(item.data),
    tipo: item.tipo,
  }));
  return dispararRoboDP360("ocorrencias", {
    csv: csvDoLote(lote),
    confirmar: confirmar ? "true" : "false",
  });
}

/* ═══════ LANÇAR O PONTO SUGERIDO DO DIA (PORTE.md §11, item 5) ═══════════════
   Porte de app.js:6168 (`editorSug`) → :6236 (o handler `.dlancsug`) → main.py
   `lancar_bot_p2` (~2820) → `_fila_correcoes` (~2786).

   POR QUE ELE MORA AQUI. Quem está vendo a SEMANA da pessoa é quem encontra o dia
   incompleto. Sem este bloco, o caminho era sair da tela, abrir a Revisão e
   reencontrar data + categoria + pessoa para lançar UM dia — e o dono já tinha
   apontado essa mesma volta no item 1 da §11.

   O ROBÔ, O ARQUIVO, O FORMATO E AS TRAVAS SÃO OS MESMOS DA REVISÃO — e agora
   são LITERALMENTE os mesmos: `montarAjusteDoDia` e o CSV vêm de
   `../regrasAjustePonto`, que a Revisão também usa. Era a dívida registrada
   aqui ("mexer numa trava exige mexer nas duas"), e ela foi paga.

   A ÚNICA COISA QUE MUDA entre as duas telas está dentro do módulo, na origem
   `"digitado"`: aqui o DP DIGITA as duas pontas, então há um passo a mais
   ("isto é hora?") e o `sugBloqueio` é lido sobre o que foi digitado — é sobre o
   horário que vai ser GRAVADO que o teto de 13 h vale. NADA muda no repo do bot:
   é disparo que já existe, com o input que ele já aceita.                     */

// Colunas da `ponto_diario` que a sugestão precisa. NÃO entram no COLUNAS_GRADE:
// a grade carrega a semana inteira da categoria (~1.700 linhas) e estas colunas
// só interessam à pessoa aberta no detalhe — são lidas sob demanda, 7 linhas.
const COLUNAS_AJUSTE = [
  "cracha", "date_ref", "nm_funcionario", "categoria", "status_ponto", "motivo",
  "acao_sugerida", "sugestao_fonte", "jornada_transnet",
  "entrada", "saida_almoco", "volta_almoco", "saida",
  "entrada_sug", "almoco_saida_sug", "almoco_volta_sug", "saida_sug",
  // O contrato da view, que é o que o `sugBloqueio` lê para decidir.
  "requer_alvo_manual", "fonte_alvo", "alvo_confiavel", "almoco_confiavel", "almoco_travado",
].join(",");

// O dia tem sugestão de alguma ponta? (`temSug` do app.js:6188.)
const temSugestao = (cartao) =>
  [cartao?.entrada_sug, cartao?.almoco_saida_sug, cartao?.almoco_volta_sug, cartao?.saida_sug]
    .some((v) => !!fmtHora(v));

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
    return { cracha: pessoa.cracha, dia: item.d, data: item.data, tipo };
  });
}

// filaTotal (app.js:3743): folgas automáticas de QUEM ESTÁ MARCADO + TODOS os
// motivos que o DP definiu à mão, deduplicados por dia — e o motivo definido
// VENCE o tipo automático, para o mesmo dia nunca sair duas vezes no CSV.
// O atestado (04) sai da fila do robô e volta em `manuais`, para a tela dizer
// quantos dias ainda precisam de lançamento à mão.
function montarFila(pessoas, motivos, diasCurso) {
  const porDia = new Map();
  pessoas.forEach((pessoa) => {
    folgasALancar(pessoa, diasCurso).forEach((f) => {
      porDia.set(chaveDia(pessoa.cracha, f.data), {
        chave: chaveDia(pessoa.cracha, f.data),
        cracha: pessoa.cracha,
        data: f.data,
        tipo: f.tipo,
        definido: false,
      });
    });
  });
  motivos.forEach((tipo, chave) => {
    const [cracha, data] = chave.split("|");
    porDia.set(chave, { chave, cracha, data, tipo, definido: true });
  });
  const todos = [...porDia.values()];
  return {
    fila: todos.filter((x) => !MOTIVO_MANUAL.has(x.tipo)),
    manuais: todos.filter((x) => MOTIVO_MANUAL.has(x.tipo)),
  };
}

/* ────────────────── gravação: motivos (app_config) e reservas ───────────── */

// `app_config.valor` é jsonb, mas guarda uma STRING JSON: o desktop faz
// `json.dumps` para gravar e `json.loads` para ler (main.py:7016). Gravar um
// objeto de verdade aqui faria o `json.loads` de lá estourar, o `except`
// devolveria {} e a ferramenta pararia de enxergar motivo nenhum.
function motivosDeConfig(valor) {
  const mapa = new Map();
  let bruto = valor;
  if (typeof bruto === "string") {
    const cru = bruto.trim();
    if (!cru) return mapa;
    try {
      bruto = JSON.parse(cru);
    } catch {
      return mapa; // config corrompida não pode derrubar a tela
    }
  }
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return mapa;
  Object.entries(bruto).forEach(([chave, tipo]) => {
    const k = texto(chave);
    const v = texto(tipo);
    if (k.includes("|") && v) mapa.set(k, v);
  });
  return mapa;
}

async function lerMotivos() {
  const linhas = await lerDP360("app_config", {
    colunas: "chave,valor",
    filtros: { chave: `eq.${CHAVE_MOTIVOS}` },
    limite: 1,
  });
  return motivosDeConfig(linhas?.[0]?.valor);
}

// RELÊ antes de gravar e RELÊ depois. Antes: a chave é compartilhada com a
// ferramenta desktop e com outra aba aberta — escrever o mapa lido na abertura
// apagaria em silêncio o que o outro marcou (o upsert responde 200 do mesmo
// jeito). Depois: o que a tela mostra passa a ser o que está no banco, não o
// que ela achou que gravou.
async function gravarMotivos(mudar) {
  const atual = await lerMotivos();
  mudar(atual);
  await upsertDP360("app_config", {
    chave: CHAVE_MOTIVOS,
    valor: JSON.stringify(Object.fromEntries(atual)),
  });
  return lerMotivos();
}

// set_reserva (main.py:4443 → supabase_client.set_reserva): ligado = upsert
// {cracha, date_ref, marcado_em}; desligado = DELETE da linha. Volta o que o
// banco respondeu na releitura, não o que a tela pediu.
async function gravarReserva(cracha, dia, ligado) {
  const filtroDia = {
    cracha: `in.(${variantesCracha(cracha).join(",")})`,
    date_ref: `eq.${dia}`,
  };
  if (ligado) {
    await upsertDP360("ponto_reservas", {
      cracha: cra8(cracha),
      date_ref: dia,
      marcado_em: carimboLocal(),
    });
  } else {
    await apagarDP360("ponto_reservas", filtroDia);
  }
  const conferido = await lerDP360("ponto_reservas", {
    colunas: "cracha,date_ref",
    filtros: filtroDia,
    limite: 5,
  });
  return (conferido || []).length > 0;
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

function Celula({ estado, aoClicar, definido, gravando }) {
  const cls = ESTADOS_CELULA.has(estado.cls) ? estado.cls : "sem";
  const classes = ["dp-cell", cls];
  if (definido) classes.push("fg-set");
  if (gravando) classes.push("fg-gravando");
  if (!aoClicar) {
    return (
      <div className={classes.join(" ")} title={estado.full || undefined}>
        <span>{estado.txt}</span>
      </div>
    );
  }
  classes.push("fg-mv");
  return (
    <button
      type="button"
      className={classes.join(" ")}
      title={estado.full || "Clique para definir o motivo do dia"}
      disabled={gravando}
      onClick={aoClicar}
    >
      <span>{gravando ? "…" : estado.txt}</span>
    </button>
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

// abrePickerMotivo (app.js:3682): a lista inteira dos códigos do Transnet, com
// busca e "Limpar". Fica em `position: fixed` porque a grade rola dentro de um
// contêiner com overflow — um pop-up dentro da célula seria cortado.
function PickerMotivo({ ancora, atual, aoEscolher, aoFechar }) {
  const caixa = useRef(null);
  const [busca, setBusca] = useState("");
  const [posicao, setPosicao] = useState({ left: ancora.left, top: ancora.bottom + 4 });

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const largura = el.offsetWidth;
    const altura = el.offsetHeight;
    const left = Math.max(8, Math.min(ancora.left, window.innerWidth - largura - 8));
    const abaixo = ancora.bottom + 4;
    const top = abaixo + altura > window.innerHeight ? Math.max(8, ancora.top - altura - 4) : abaixo;
    setPosicao({ left, top });
  }, [ancora]);

  useEffect(() => {
    const foraDaCaixa = (evento) => {
      if (caixa.current && !caixa.current.contains(evento.target)) aoFechar();
    };
    const tecla = (evento) => {
      if (evento.key === "Escape") aoFechar();
    };
    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", tecla);
    };
  }, [aoFechar]);

  const q = busca.trim().toLowerCase();
  const opcoes = MOTIVO_OPTS.filter(
    ([codigo, rotulo]) => !q || `${codigo} ${rotulo}`.toLowerCase().includes(q),
  );

  return (
    <div className="fg-pop" ref={caixa} style={{ left: posicao.left, top: posicao.top }}>
      <div className="fg-pop-h">O que foi esse dia?</div>
      <input
        className="fg-pop-busca"
        value={busca}
        autoComplete="off"
        autoFocus
        placeholder="buscar motivo…"
        onChange={(evento) => setBusca(evento.target.value)}
      />
      <div className="fg-pop-scroll">
        {opcoes.length === 0 && <div className="fg-pop-vazio">nenhum motivo com esse texto</div>}
        {opcoes.map(([codigo, rotulo]) => (
          <button
            key={codigo}
            type="button"
            className={`fg-opt${codigo === atual ? " on" : ""}`}
            onClick={() => aoEscolher(codigo)}
          >
            <span className="fg-cd">{codigo}</span>
            {rotulo}
            {MOTIVO_MANUAL.has(codigo) && <span className="fg-man">manual</span>}
          </button>
        ))}
      </div>
      <button type="button" className="fg-opt limpar" onClick={() => aoEscolher("")}>
        ✕ Limpar
      </button>
    </div>
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
          <div className="dp-lg-row">
            <span className="dp-cell lg-sw verif fg-set">
              <span>Falta</span>
            </span>
            <div className="dp-lg-txt">
              <b>Definido por você</b>
              <span>
                Motivo que você marcou na célula — o contorno tracejado diz que foi manual, e o dia
                está esperando o robô lançar.
              </span>
            </div>
          </div>
        </div>
        <p className="dp-lg-foot">
          O lançamento das ocorrências no Transnet é feito pelo robô (fora do navegador). Esta tela
          mostra o que está pendente e o que o robô já lançou. Exceção: <b>Atestado (04)</b> fica
          registrado aqui mas é lançado <b>à mão</b> no Transnet — o robô não lança atestado.
        </p>
      </div>
    </div>
  );
}

/* ═══════ HISTÓRICO DAS OCORRÊNCIAS LANÇADAS (PORTE.md §11, item 9) ═══════════
   Porte de app.js:3759 (o botão da barra) → :6145 (`abreHistBot`), que lê
   `get_ocorrencias` (main.py:2888).

   NÃO CUSTA CONSULTA NENHUMA: é a MESMA `ponto_ocorrencias` que a aba já carrega
   na abertura para a pílula 🤖 do dia e para a marca da linha. O que faltava era
   a visão agregada — sem ela, para saber se um lançamento passou era preciso
   caçar a pessoa e o dia na grade, uma célula por vez.

   O QUE FICA DE FORA: os `aviso_*`. É o mesmo recorte do `get_ocorrencias`
   ("migraram pro ponto_caso e aparecem no Meus avisos — aqui ficam de fora pra
   não poluir"). Este pop-up é o do bot de FOLGAS: DSR, Compensação e Curso. A
   contagem do que foi cortado aparece no rodapé, para ninguém achar que sumiu.

   O ORIGINAL AINDA MOSTRAVA O LOG DO BOT AO VIVO (`get_job`, polling do processo
   local). Aqui não existe: o robô roda no GitHub Actions e a evidência é o run —
   o link "ver o robô rodando" sai no disparo, não neste histórico.            */

// Carimbo do banco, ecoado como veio ("2026-09-06T14:32:…" → "06/09 14:32").
// Recorte de string: virar `Date` aqui só criaria chance de o fuso mover a hora.
function instanteCurto(valor) {
  const v = texto(valor);
  if (v.length < 16) return v || "—";
  return `${v.slice(8, 10)}/${v.slice(5, 7)} ${v.slice(11, 16)}`;
}

const RE_BOT_OK = /^OK/i;
const RE_AVISO = /^aviso_/i;

// Três baldes, os mesmos que a marca 🤖 da grade usa: deu certo, falhou, ou o bot
// devolveu outra coisa (pendente, ignorado, em branco).
function baldeStatus(status) {
  const s = texto(status);
  if (RE_BOT_ERRO.test(s)) return "erro";
  if (RE_BOT_OK.test(s)) return "ok";
  return "outro";
}

function ModalHistoricoBot({ linhas, nomes, aoFechar }) {
  const [busca, setBusca] = useState("");
  const [balde, setBalde] = useState("");
  const [tipo, setTipo] = useState("");

  const { historico, avisos } = useMemo(() => {
    const soFolgas = [];
    let cortados = 0;
    linhas.forEach((linha) => {
      if (RE_AVISO.test(texto(linha.tipo))) {
        cortados += 1;
        return;
      }
      const cracha = cra8(linha.cracha);
      soFolgas.push({
        chave: `${cracha}|${texto(linha.date_ref).slice(0, 10)}|${texto(linha.tipo)}`,
        cracha,
        nome: nomes.get(cracha) || "",
        data: texto(linha.date_ref).slice(0, 10),
        tipo: texto(linha.tipo),
        status: texto(linha.status),
        balde: baldeStatus(linha.status),
        quando: texto(linha.lancado_em),
      });
    });
    // Mais recente primeiro: pelo carimbo do lançamento e, sem ele, pelo dia.
    soFolgas.sort((a, b) => (b.quando || "").localeCompare(a.quando || "") || b.data.localeCompare(a.data));
    return { historico: soFolgas, avisos: cortados };
  }, [linhas, nomes]);

  const tipos = useMemo(
    () => [...new Set(historico.map((h) => h.tipo).filter(Boolean))].sort(),
    [historico],
  );

  const contagem = useMemo(() => {
    const c = { ok: 0, erro: 0, outro: 0 };
    historico.forEach((h) => { c[h.balde] += 1; });
    return c;
  }, [historico]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return historico.filter(
      (h) =>
        (!balde || h.balde === balde) &&
        (!tipo || h.tipo === tipo) &&
        (!q || h.cracha.includes(q) || h.nome.toLowerCase().includes(q)),
    );
  }, [historico, busca, balde, tipo]);

  return (
    <div
      className="dp-overlay"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="dp-modal fg-hist">
        <div className="dp-modal-head">
          <h3>🤖 Ocorrências lançadas — DSR / Compensação / Curso</h3>
          <button type="button" className="dp-det-x" onClick={aoFechar} aria-label="Fechar histórico">
            <X size={17} />
          </button>
        </div>

        <div className="fg-hist-resumo">
          <span className="dp-pill ok">{contagem.ok} OK</span>
          <span className={`dp-pill ${contagem.erro ? "danger" : "mute"}`}>{contagem.erro} com erro</span>
          <span className="dp-pill mute">{contagem.outro} sem status conclusivo</span>
          <span className="dp-faint">· {historico.length} lançamento(s) no total</span>
        </div>

        <div className="fg-hist-filtros">
          <div className="dp-busca">
            <Search size={14} />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="crachá ou nome…"
            />
          </div>
          <select value={balde} onChange={(evento) => setBalde(evento.target.value)}>
            <option value="">Todos os status</option>
            <option value="ok">Só OK</option>
            <option value="erro">Só com erro</option>
            <option value="outro">Sem status conclusivo</option>
          </select>
          <select value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
            <option value="">Todos os tipos</option>
            {tipos.map((item) => (
              <option key={item} value={item}>
                {item}-{ROTULO_TIPO[item] || item}
              </option>
            ))}
          </select>
        </div>

        {visiveis.length === 0 ? (
          <div className="dp-vazio">
            {historico.length === 0
              ? "Nenhuma ocorrência lançada ainda — ou o resultado do robô ainda não foi ingerido."
              : "Nenhum lançamento bate com o filtro."}
          </div>
        ) : (
          <div className="fg-hist-wrap">
            <table className="dp-tabela">
              <thead>
                <tr>
                  <th>Crachá</th>
                  <th>Colaborador</th>
                  <th>Dia</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Lançado em</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((h) => (
                  <tr key={h.chave} className={h.balde === "erro" ? "row-sem" : undefined}>
                    <td className="dp-mono dp-num">{h.cracha}</td>
                    <td>{h.nome || <span className="dp-faint">—</span>}</td>
                    <td className="dp-num">{ddmm(h.data)}</td>
                    <td>
                      {h.tipo ? `${h.tipo}-${ROTULO_TIPO[h.tipo] || h.tipo}` : "—"}
                    </td>
                    <td>
                      <span className={`dp-pill ${h.balde === "ok" ? "ok" : h.balde === "erro" ? "danger" : "mute"}`}>
                        {h.status || "sem status"}
                      </span>
                    </td>
                    <td className="dp-num dp-muted">{instanteCurto(h.quando)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="dp-lg-foot">
          Quem preenche esta tabela é a <b>ingestão do resultado do robô</b>, não o disparo: um
          lançamento feito agora só aparece aqui depois que alguém ingerir a evidência do run. O
          nome só aparece para quem está na semana/categoria abertas na grade.
          {avisos > 0 && (
            <>
              {" "}
              {avisos} registro(s) de <code>aviso_*</code> ficam de fora — são do comunicado ao
              trabalhador, não do bot de folgas.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

/* ---------- o editor do ponto sugerido de UM dia (app.js `editorSug`) ----------
   DOIS BOTÕES, NUNCA UM CHECKBOX — a mesma regra do lote de folgas, e aqui com
   estrago maior: um clique reescreve o cartão de ponto de um dia inteiro de
   alguém. A confirmação NOMEIA a pessoa, diz o dia e mostra as quatro batidas que
   vão ser gravadas no lugar do que está lá hoje.

   O original tinha UM botão só ("🤖 Lançar", já valendo, `lancar_bot_p2(..., true)`).
   Aqui vira ensaio + valendo, que é a regra desta casa para tudo que dirige o
   Transnet. */
function EditorPontoSugerido({ pessoa, cartao, caso, aoLancar }) {
  // A confirmação é a da ferramenta, não a do navegador (ver `Perguntar.jsx`): o
  // `window.confirm` escrevia "inovequatai.onrender.com diz" em cima da pergunta,
  // ignorava o tema e espremia tudo num bloco só.
  const [perguntar, caixaPergunta] = usePergunta();
  const travado = almocoTravado(cartao);
  const semeia = useCallback(
    () => ({
      entrada: fmtHora(cartao.entrada_sug),
      alm_saida: fmtHora(cartao.almoco_saida_sug),
      alm_volta: fmtHora(cartao.almoco_volta_sug),
      saida: fmtHora(cartao.saida_sug),
    }),
    [cartao.entrada_sug, cartao.almoco_saida_sug, cartao.almoco_volta_sug, cartao.saida_sug],
  );
  const [campos, setCampos] = useState(semeia);
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // Re-semeia quando o VALOR da sugestão muda (releitura depois do disparo, ou o
  // Real manual chegando da Revisão) — não a cada re-render, senão atropela quem
  // está digitando.
  useEffect(() => {
    setCampos(semeia());
    setRecado(null);
  }, [semeia]);

  const ajuste = useMemo(() => montarAjusteDoDia(cartao, campos, caso), [cartao, campos, caso]);
  const podeLancar = !!ajuste.csv && !disparando;
  const mexeu = useMemo(() => {
    const base = semeia();
    return ["entrada", "alm_saida", "alm_volta", "saida"].some((c) => texto(campos[c]) !== base[c]);
  }, [campos, semeia]);

  const lancar = async (confirmar) => {
    if (!ajuste.csv) return;
    const quem = pessoa.nome || pessoa.cracha;
    const grava = [ajuste.alvo[0], ajuste.alvo[1] || "—", ajuste.alvo[2] || "—", ajuste.alvo[3]].join(" · ");
    const hoje = ajuste.cartaoHoje.map((h) => h || "—").join(" · ");
    const cabeca = confirmar
      ? `LANÇAR DE VERDADE no Transnet o cartão de ponto de ${quem} (crachá ${ajuste.csv.cracha}) em ${ajuste.csv.data}:`
      : `ENSAIO (o robô preenche a tela e NÃO clica em Inserir) — cartão de ${quem} (crachá ${ajuste.csv.cracha}) em ${ajuste.csv.data}:`;
    if (
      !await perguntar(
        `${cabeca}\n\n` +
          `cartão hoje:  ${hoje}\n` +
          `vai ficar:    ${grava}\n\n` +
          `(entrada · saída almoço · volta almoço · saída)\n\n` +
          `O robô escreve os QUATRO campos ou nada — não existe corrigir só uma ponta.\n\n` +
          (travado ? "O almoço deste dia está travado pela regra da Revisão: o miolo é o dela.\n\n" : "") +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.\n\n` +
          `O resultado NÃO volta sozinho para esta tela: a evidência fica no run do GitHub.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      const resposta = await aoLancar(ajuste, confirmar);
      setRecado({
        tipo: "ok",
        texto: `${confirmar ? "Lançamento" : "Ensaio"} disparado — ${ajuste.csv.data} · ${grava}.${
          resposta?.aviso || ""
        }`,
        painel: resposta?.painel || "",
      });
    } catch (falha) {
      // O erro mostrado é o do SERVIDOR, sem tradução: é ele que diz se o workflow
      // não existe, se a permissão faltou ou se o input foi recusado.
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  const campo = (id, rotulo, bloqueado) => (
    <label className={`fg-sug-c${bloqueado ? " travado" : ""}`}>
      <span>{rotulo}</span>
      <input
        className="dp-mono dp-num"
        type="text"
        inputMode="numeric"
        placeholder="--:--"
        value={campos[id]}
        readOnly={bloqueado}
        disabled={disparando}
        aria-label={`${rotulo} do dia ${ddmm(cartao.date_ref)}`}
        title={
          bloqueado
            ? "Almoço travado pela regra da Revisão — este campo não é editável e o que vai para o robô é o miolo dela."
            : "Edite se precisar. Aceita HH:MM e também 1420. A edição vale só para este disparo — ela não é gravada em lugar nenhum."
        }
        onChange={(evento) => setCampos((atual) => ({ ...atual, [id]: evento.target.value }))}
        onClick={(evento) => evento.stopPropagation()}
        onKeyDown={(evento) => {
          evento.stopPropagation();
          if (evento.key === "Escape") setCampos(semeia());
        }}
      />
    </label>
  );

  return (
    <div className="fg-sug">
      {caixaPergunta}
      <div className="fg-sug-t">
        ↳ ponto sugerido (edite se precisar) · cartão hoje:{" "}
        <span className="dp-mono">{ajuste.cartaoHoje.map((h) => h || "—").join(" · ")}</span>
      </div>
      <div className="fg-sug-campos">
        {campo("entrada", "entrada", false)}
        {campo("alm_saida", "s. almoço", travado)}
        {campo("alm_volta", "v. almoço", travado)}
        {campo("saida", "saída", false)}
        <button
          type="button"
          className="dp-btn"
          disabled={!podeLancar}
          onClick={() => lancar(false)}
          title="O robô preenche a tela do Cartão de Ponto e NÃO clica em Inserir — serve para conferir. Nada é gravado."
        >
          🤖 Ensaio
        </button>
        <button
          type="button"
          className="dp-btn"
          style={{ color: "var(--dp-danger-ink)" }}
          disabled={!podeLancar}
          onClick={() => lancar(true)}
          title="Reescreve o cartão de ponto deste dia no Transnet — os quatro campos."
        >
          ⚠ Lançar de verdade
        </button>
        {disparando && <span className="dp-pill accent">disparando…</span>}
      </div>

      {travado && (
        <div className="fg-sug-nota mute">
          🔒 almoço travado pela regra da Revisão — o miolo não é editável e o que vai para o robô é
          o dela.
        </div>
      )}

      {/* NUNCA SUMIR COM O DIA: quando não dá para lançar, o motivo fica na tela.
          Sem isto, a diferença entre "tem sugestão" e "o robô aceita" é invisível. */}
      {ajuste.fora ? (
        <div className="fg-sug-nota danger">
          ⚠ não dá para lançar este dia: {ajuste.fora}. Se for decisão de alvo, crave o{" "}
          <b>Real manual do DP</b> na Revisão — lá fica registrado com o seu nome, e volta para cá.
        </div>
      ) : (
        <div className="fg-sug-nota ok">
          vai gravar: <span className="dp-mono">{ajuste.alvo.map((h) => h || "—").join(" · ")}</span>
          {mexeu ? " · com a sua edição" : ""}
        </div>
      )}

      {recado && (
        <div className="fg-sug-nota">
          <span className={`dp-pill ${recado.tipo === "ok" ? "ok" : "danger"}`}>{recado.texto}</span>
          {recado.painel && (
            <>
              {" "}
              <a className="dp-btn" href={recado.painel} target="_blank" rel="noreferrer">
                ver o robô rodando
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PainelDetalhe({
  pessoa,
  semana,
  ctx,
  aoFechar,
  aoAbrirPicker,
  motivoGravando,
  aoMarcarReserva,
  reservaGravando,
  aoDisparar,
}) {
  // A confirmação é a da ferramenta, não a do navegador (ver `Perguntar.jsx`): o
  // `window.confirm` escrevia "inovequatai.onrender.com diz" em cima da pergunta,
  // ignorava o tema e espremia tudo num bloco só.
  const [perguntar, caixaPergunta] = usePergunta();
  const folgas = folgasALancar(pessoa, ctx.diasCurso);
  const tipoPorData = new Map(folgas.map((f) => [f.data, f.tipo]));
  const situacaoRuim = pessoa.situacao && !/^OK/i.test(pessoa.situacao);
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // Motivos que o DP definiu para ESTA pessoa (qualquer dia, inclusive de outra
  // semana) — a fila do original também é por pessoa, não por tela (app.js:6253).
  const prefixo = `${cra8(pessoa.cracha)}|`;
  const motivosDaPessoa = useMemo(() => {
    const so = new Map();
    ctx.motivos.forEach((tipo, chave) => {
      if (chave.startsWith(prefixo)) so.set(chave, tipo);
    });
    return so;
  }, [ctx.motivos, prefixo]);

  const { fila, manuais } = useMemo(
    () => montarFila([pessoa], motivosDaPessoa, ctx.diasCurso),
    [pessoa, motivosDaPessoa, ctx.diasCurso],
  );

  /* ── o cartão da semana, para lançar o ponto sugerido (PORTE.md §11, item 5) ──
     Carga SOB DEMANDA, só da pessoa aberta e só da semana na tela: são 7 linhas,
     contra as ~1.700 que a grade já carrega da categoria inteira. Por isso as
     colunas da sugestão ficam fora do `COLUNAS_GRADE`.

     `ponto_real_manual` entra porque o Real cravado na Revisão MANDA: sem ele
     esta tela mostraria a sugestão crua e lançaria coisa diferente do que a
     Revisão mandaria, sem ninguém ver. `ponto_caso` é a trava do "cartão já mexido
     no Transnet". O crachá vai nas três grafias (o desktop grava o cru, o INOVE
     grava com 8) — a mesma varredura da reserva. */
  const cracha = pessoa.cracha;
  const [sug, setSug] = useState(() => ({
    carregando: true,
    erro: "",
    cartoes: new Map(),
    casos: new Map(),
  }));
  const [recargaSug, setRecargaSug] = useState(0);

  useEffect(() => {
    if (!semana) return undefined;
    let vivo = true;
    setSug((atual) => ({ ...atual, carregando: true, erro: "" }));
    (async () => {
      const filtros = {
        cracha: `in.(${variantesCracha(cracha).join(",")})`,
        date_ref: [`gte.${semana}`, `lte.${somaDias(semana, 6)}`],
      };
      try {
        const [diario, reaisManuais, casosDaSemana] = await Promise.all([
          lerDP360("ponto_diario", { colunas: COLUNAS_AJUSTE, filtros, ordem: "date_ref.asc", limite: 40 }),
          lerDP360("ponto_real_manual", { filtros, limite: 40 }),
          lerDP360("ponto_caso", { filtros, limite: 40 }),
        ]);
        if (!vivo) return;
        const reais = new Map(reaisManuais.map((r) => [chaveDia(r.cracha, r.date_ref), r]));
        setSug({
          carregando: false,
          erro: "",
          cartoes: new Map(
            diario.map((l) => {
              const k = chaveDia(l.cracha, l.date_ref);
              return [k, aplicarRealManual(l, reais.get(k))];
            }),
          ),
          casos: new Map(casosDaSemana.map((c) => [chaveDia(c.cracha, c.date_ref), c])),
        });
      } catch (falha) {
        if (!vivo) return;
        setSug({
          carregando: false,
          erro: falha?.message || "Falha ao ler a sugestão de ponto desta semana.",
          cartoes: new Map(),
          casos: new Map(),
        });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [cracha, semana, recargaSug]);

  /* Disparo do robô do PONTO (`ponto.yml`), UM dia por vez — o mesmo robô, o mesmo
     arquivo e o mesmo formato do "Lançar ajuste" da Revisão e da Refeição.
     Depois do lançamento DE VERDADE: histórico por pessoa em `ponto_importacoes`
     (passo 2, exatamente o que a Revisão escreve — a aba Importações já rotula
     esse passo), e RELEITURA da semana, porque `ponto_caso` e o Real manual mudam
     por baixo. `status: "disparado"` porque o robô foi disparado e ninguém ainda
     leu a evidência dele — que é o estado da coisa. A trilha do disparo (quem
     clicou, ensaio ou não) é do gateway, em `dp360_auditoria`. */
  const lancarAjuste = useCallback(
    async (ajuste, confirmar) => {
      const resposta = await dispararRoboDP360("ponto", {
        csv: csvDoAjustePonto([ajuste.csv]),
        data: ajuste.csv.data,
        confirmar: confirmar ? "true" : "false",
      });
      let aviso = "";
      if (confirmar) {
        try {
          await inserirDP360("ponto_importacoes", [
            {
              cracha: ajuste.csv.cracha,
              nome: pessoa.nome,
              date_ref: ajuste.dia,
              passo: 2,
              entrada: ajuste.csv.entrada,
              saida_almoco: ajuste.csv.alm_saida,
              volta_almoco: ajuste.csv.alm_volta,
              saida: ajuste.csv.saida,
              fonte: ajuste.fonte,
              arquivo: "robô ponto.yml",
              status: "disparado",
            },
          ]);
        } catch {
          aviso = " (não foi possível registrar o histórico em ponto_importacoes)";
        }
        setRecargaSug((n) => n + 1);
      }
      return { ...resposta, aviso };
    },
    [pessoa.nome],
  );

  // ENSAIO x VALENDO são dois botões, não um checkbox. Checkbox marcado por
  // engano lança de verdade na ficha de alguém; dois botões obrigam a escolher,
  // e a confirmação de cada um diz qual dos dois é.
  const lancar = async (confirmar) => {
    if (!fila.length) return;
    const resumo = fila
      .map((l) => `· ${ddmm(l.data)} — ${nomeDoMotivo(l.tipo)}${l.definido ? " (você definiu)" : ""}`)
      .join("\n");
    const cabecalho = confirmar
      ? `LANÇAR DE VERDADE no Transnet, na ficha de ${pessoa.nome || pessoa.cracha}:`
      : `ENSAIO (o robô navega e NÃO confirma) para ${pessoa.nome || pessoa.cracha}:`;
    if (
      !await perguntar(
        `${cabecalho}\n\n1 pessoa · ${fila.length} dia(s)\n\n${resumo}\n\n` +
          (manuais.length
            ? `${manuais.length} dia(s) marcados como Atestado (04) NÃO entram: esses são lançados à mão.\n\n`
            : "") +
          (confirmar
            ? "Ao disparar valendo, os motivos que você definiu saem da fila.\n\n"
            : "") +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado ` +
          `com o seu nome.\n\n` +
          `O resultado por dia NÃO volta sozinho para esta tela: a evidência ` +
          `fica no run do GitHub.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      const r = await aoDisparar(fila, confirmar);
      setRecado({
        tipo: "ok",
        texto: `${confirmar ? "Lançamento" : "Ensaio"} disparado — ${fila.length} dia(s).`,
        painel: r?.painel || "",
      });
    } catch (falha) {
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  return (
    <aside className="dp-detail">
      {caixaPergunta}
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

      {(fila.length > 0 || manuais.length > 0) && (
        <div className="dp-det-bot">
          <div className="dp-det-bot-linha">
            <b>{fila.length} dia(s) na fila do robô</b>
            {fila.length > 0 && (
              <span className="dp-faint">
                {" "}
                · {fila.map((f) => `${ddmm(f.data)} ${f.tipo}`).join(" · ")}
              </span>
            )}
          </div>
          {manuais.length > 0 && (
            <div className="dp-det-bot-linha">
              <span className="dp-pill warn">
                ✋ {manuais.length} dia(s) de Atestado (04) — lançar à mão no Transnet
              </span>
            </div>
          )}
          {fila.length > 0 && (
            <div className="dp-det-bot-acoes">
              <button
                type="button"
                className="dp-btn"
                disabled={disparando}
                onClick={() => lancar(false)}
                title="O robô navega até o botão e NÃO clica — serve para conferir o lote"
              >
                🤖 Ensaio
              </button>
              <button
                type="button"
                className="dp-btn"
                style={{ color: "var(--dp-danger-ink)" }}
                disabled={disparando}
                onClick={() => lancar(true)}
                title="Lança de verdade na ficha do colaborador, no Transnet"
              >
                ⚠ Lançar de verdade
              </button>
            </div>
          )}
          {disparando && <span className="dp-pill accent">disparando…</span>}
          {recado && (
            <div className="dp-det-bot-linha">
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
            </div>
          )}
        </div>
      )}

      {/* A carga da sugestão é separada da grade; quando ela falha, o que some é
          só o lançamento do ponto — o resto do detalhe continua de pé. */}
      {(sug.carregando || sug.erro) && (
        <div className="fg-sug-aviso">
          {sug.erro ? (
            <span className="dp-pill danger">
              ⚠ {sug.erro} — sem o ponto sugerido nesta abertura.
            </span>
          ) : (
            <span className="dp-pill mute">lendo o ponto sugerido da semana…</span>
          )}
        </div>
      )}

      <div>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const linha = pessoa.linha[d];
          const dataRef = texto(linha?.date_ref).slice(0, 10) || somaDias(semana, d - 1);
          const estado = { ...celulaDoDia(linha, pessoa.cracha, ctx) };
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
          const chave = chaveDia(pessoa.cracha, dataRef);
          const bot = ctx.ocorrencias.get(chave);
          const definido = ctx.motivos.get(chave) || "";
          const ehReserva = ctx.reservas.has(chave);
          const gravandoReserva = reservaGravando === chave;

          // Clicável no MESMO lugar do original (app.js:6209/6218): o dia
          // S/PONTO e a folga/curso ainda a lançar. Dia já lançado no Transnet
          // não é opinião do DP — é fato, e não abre picker.
          const podeMotivo =
            !!linha && !lancado && !texto(linha.te_descricao_dia) &&
            (estado.cls === "verif" || estado.cls === "folga" || estado.cls === "curso");

          /* O EDITOR DO PONTO SUGERIDO fica no MESMO lugar do original
             (app.js:6195, o `else if` depois do `isSemOperacao`): dia em que a
             pessoa TRABALHOU, o cartão não fechou certo, nada foi lançado no
             Transnet e a view tem sugestão. Dia sem ponto é assunto do picker de
             motivo, e dia sem operação é assunto da reserva — cada um com o seu.

             O original ainda exigia MOTORISTA (`isMotorista`); aqui não, porque
             o lote de ajuste da Revisão — de onde vêm as travas — atende as três
             categorias, e quem decide se há alvo é a view, não a categoria. */
          const cartaoSug = sug.cartoes.get(chave);
          const podeAjuste =
            !!linha &&
            !!cartaoSug &&
            !lancado &&
            !texto(linha.te_descricao_dia) &&
            texto(linha.status_ponto).toUpperCase() !== "OK" &&
            !!texto(linha.jornada_transnet) &&
            !semOperacao(linha) &&
            temSugestao(cartaoSug);

          if (podeMotivo && definido) {
            const pintura = motivoCelula(definido);
            estado.cls = pintura.cls;
            estado.txt = pintura.txt;
            estado.full = `${nomeDoMotivo(definido)} — definido por você`;
          }

          return (
            <div key={d} className="dp-dblock">
              <div className="dp-drow">
                <div className="dp-dday">
                  {DIAS_SEMANA[d - 1]}
                  <span className="sub">{ddmm(dataRef)}</span>
                </div>
                <div className="dp-dcell">
                  <Celula
                    estado={estado}
                    definido={podeMotivo && !!definido}
                    gravando={motivoGravando === chave}
                    aoClicar={
                      podeMotivo
                        ? (evento) => aoAbrirPicker(evento, chave, definido)
                        : undefined
                    }
                  />
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
                <>
                  <div className={`dp-dnote ${ehReserva ? "ok" : "danger"}`}>
                    {ehReserva
                      ? "✅ RES. — marcado como reserva (sem operação confirmada)"
                      : "⚠ bateu ponto mas NÃO operou (sem Citatti/bilhetagem) — confirmar se foi reserva"}
                  </div>
                  <label className="fg-res">
                    <input
                      type="checkbox"
                      checked={ehReserva}
                      disabled={gravandoReserva}
                      onChange={(evento) =>
                        aoMarcarReserva(pessoa.cracha, dataRef, evento.target.checked)
                      }
                    />
                    marcar como reserva
                    {gravandoReserva && <span className="dp-pill accent">gravando…</span>}
                  </label>
                </>
              )}

              {podeAjuste && (
                /* `key` no crachá|dia: trocar de pessoa no painel REUSA este
                   componente, e sem a chave o que estava digitado no dia da
                   pessoa anterior continuaria na caixa da próxima. */
                <EditorPontoSugerido
                  key={chave}
                  pessoa={pessoa}
                  cartao={cartaoSug}
                  caso={sug.casos.get(chave)}
                  aoLancar={lancarAjuste}
                />
              )}

              {podeMotivo && definido && (
                <div className="dp-dnote sug">
                  ✎ {nomeDoMotivo(definido)} — definido por você
                  {MOTIVO_MANUAL.has(definido) ? " · lançar MANUAL no Transnet" : " (a lançar pelo robô)"}
                </div>
              )}

              {podeMotivo && !definido && tipo && (
                <div className="dp-dnote sug">
                  Sugestão: {tipo}-{ROTULO_TIPO[tipo] || tipo} — a lançar pelo robô · clique na
                  célula para trocar
                </div>
              )}

              {/* S/PONTO é o único dia que não fecha sozinho: sem ponto e sem
                  nada lançado, só o DP sabe o que foi (app.js:6221). */}
              {podeMotivo && !definido && !tipo && estado.cls === "verif" && (
                <div className="dp-dnote warn">
                  ⚠ sem ponto e sem nada lançado — <b>clique na célula para definir o motivo</b>
                </div>
              )}

              {podeMotivo && !definido && !tipo && estado.cls !== "verif" && (
                <div className="dp-dnote mute">clique na célula para trocar o tipo do dia</div>
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
        O motivo do dia e a marcação de reserva são gravados na base do DP (a mesma da ferramenta).
        O lançamento das ocorrências no Transnet continua sendo do robô. O <b>ponto sugerido</b> que
        você edita aqui não é gravado em lugar nenhum: ele vale para o disparo daquele clique — o
        que fica registrado é o cartão que o robô escreveu (<code>ponto_importacoes</code>, passo 2).
      </p>
    </aside>
  );
}

/* ──────────────────────────────── a aba ────────────────────────────────── */

export default function Folgas() {
  // A confirmação é a da ferramenta, não a do navegador (ver `Perguntar.jsx`): o
  // `window.confirm` escrevia "inovequatai.onrender.com diz" em cima da pergunta,
  // ignorava o tema e espremia tudo num bloco só.
  const [perguntar, caixaPergunta] = usePergunta();
  const [categoria, setCategoria] = useState("MOTORISTA");
  const [semanas, setSemanas] = useState([]);
  const [semana, setSemana] = useState("");
  const [termo, setTermo] = useState("");

  const [reservas, setReservas] = useState(() => new Set());
  const [ocorrencias, setOcorrencias] = useState(() => new Map());
  // A MESMA leitura da linha acima, guardada CRUA para o histórico agregado. O Map
  // é indexado por crachá|dia (é o que a célula do dia pergunta) e por isso perde a
  // lista; o pop-up do item 9 precisa dela inteira — e não de outra consulta.
  const [listaOcorrencias, setListaOcorrencias] = useState([]);
  const [diasCurso, setDiasCurso] = useState(() => new Map());
  const [motivos, setMotivos] = useState(() => new Map());

  const [pessoas, setPessoas] = useState([]);
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [carregandoGrade, setCarregandoGrade] = useState(false);
  const [erro, setErro] = useState("");
  const [selecionado, setSelecionado] = useState("");
  const [legendaAberta, setLegendaAberta] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [recarga, setRecarga] = useState(0);

  const [selecao, setSelecao] = useState(() => new Set());
  const [picker, setPicker] = useState(null);          // { chave, atual, ancora }
  const [motivoGravando, setMotivoGravando] = useState("");
  const [reservaGravando, setReservaGravando] = useState("");
  const [aviso, setAviso] = useState(null);            // { tipo, texto }
  const [disparandoLote, setDisparandoLote] = useState(false);
  const [recadoLote, setRecadoLote] = useState(null);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  // Base fixa: semanas disponíveis, reservas, ocorrências do bot, dias de curso
  // e os motivos que o DP já definiu (a fila compartilhada com a ferramenta).
  useEffect(() => {
    let vivo = true;
    setCarregandoBase(true);
    setErro("");
    (async () => {
      try {
        const [
          maisNovo,
          maisAntigo,
          linhasReservas,
          linhasOcorrencias,
          linhasAprendiz,
          mapaMotivos,
        ] = await Promise.all([
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
          lerMotivos(),
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
        setListaOcorrencias(linhasOcorrencias);
        setOcorrencias(
          new Map(
            linhasOcorrencias.map((o) => [
              chaveDia(o.cracha, o.date_ref),
              { tipo: texto(o.tipo), status: texto(o.status), lancado_em: texto(o.lancado_em) },
            ]),
          ),
        );
        setDiasCurso(apurarDiasCurso(linhasAprendiz));
        setMotivos(mapaMotivos);
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
    // Selecionar é POR PESSOA VISÍVEL. Trocar de semana/categoria troca quem
    // está na tela; manter as marcações antigas faria o lote sair com gente que
    // ninguém está vendo.
    setSelecao(new Set());
    setRecadoLote(null);
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

  const ctx = useMemo(
    () => ({ reservas, ocorrencias, diasCurso, motivos }),
    [reservas, ocorrencias, diasCurso, motivos],
  );

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

          // Picker de motivo: S/PONTO ou folga ainda NÃO lançada (app.js:3632).
          // Dia já lançado no Transnet não abre — lá o fato já existe.
          const chave = linha && dataRef ? chaveDia(pessoa.cracha, dataRef) : "";
          const podeMotivo =
            !!linha && !!chave && !texto(linha.te_descricao_dia) &&
            (estado.cls === "verif" || estado.cls === "folga");
          const definido = podeMotivo ? texto(ctx.motivos.get(chave)) : "";
          if (definido) {
            const pintura = motivoCelula(definido);
            estado.cls = pintura.cls;
            estado.txt = pintura.txt;
            estado.full = `${nomeDoMotivo(definido)} — definido por você${
              MOTIVO_MANUAL.has(definido) ? " · lançar MANUAL no Transnet" : " (a lançar pelo robô)"
            }`;
          }
          return { dia: d, estado, chave, podeMotivo, definido };
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

  /* ── seleção múltipla + fila do lote (app.js:3617/3640/3740) ────────────── */

  const marcados = useMemo(
    () => linhasGrade.filter((item) => selecao.has(item.pessoa.cracha)),
    [linhasGrade, selecao],
  );
  const todosMarcados = linhasGrade.length > 0 && marcados.length === linhasGrade.length;

  const alternarPessoa = useCallback((cracha) => {
    setSelecao((atual) => {
      const novo = new Set(atual);
      if (novo.has(cracha)) novo.delete(cracha);
      else novo.add(cracha);
      return novo;
    });
    setRecadoLote(null);
  }, []);

  const alternarTodos = useCallback(() => {
    setSelecao((atual) => {
      const visiveisAgora = linhasGrade.map((item) => item.pessoa.cracha);
      const jaTodos = visiveisAgora.length > 0 && visiveisAgora.every((c) => atual.has(c));
      return jaTodos ? new Set() : new Set(visiveisAgora);
    });
    setRecadoLote(null);
  }, [linhasGrade]);

  const { fila, manuais } = useMemo(
    () => montarFila(marcados.map((item) => item.pessoa), motivos, diasCurso),
    [marcados, motivos, diasCurso],
  );

  const pessoasNaFila = useMemo(
    () => new Set(fila.map((item) => cra8(item.cracha))).size,
    [fila],
  );
  const daFilaDefinidos = useMemo(() => fila.filter((item) => item.definido).length, [fila]);

  // Dias que estão na fila mas NÃO aparecem nesta tela (motivo definido em outra
  // semana/categoria e ainda não lançado). O original também lança tudo junto —
  // aqui a tela pelo menos DIZ quantos são, antes de a pessoa confirmar.
  const chavesVisiveis = useMemo(() => {
    const chaves = new Set();
    linhasGrade.forEach((item) =>
      item.celulas.forEach((c) => {
        if (c.chave) chaves.add(c.chave);
      }),
    );
    return chaves;
  }, [linhasGrade]);
  const foraDaTela = useMemo(
    () => fila.filter((item) => !chavesVisiveis.has(item.chave)).length,
    [fila, chavesVisiveis],
  );

  /* ── gravações ──────────────────────────────────────────────────────────── */

  const abrirPicker = useCallback((evento, chave, atual) => {
    evento.stopPropagation();
    const r = evento.currentTarget.getBoundingClientRect();
    setPicker({
      chave,
      atual: atual || "",
      ancora: { left: r.left, top: r.top, bottom: r.bottom },
    });
  }, []);

  const fecharPicker = useCallback(() => setPicker(null), []);

  const escolherMotivo = useCallback(
    async (chave, tipo) => {
      setPicker(null);
      setMotivoGravando(chave);
      setAviso(null);
      try {
        const atualizados = await gravarMotivos((mapa) => {
          if (tipo) mapa.set(chave, tipo);
          else mapa.delete(chave);
        });
        setMotivos(atualizados);
        setAviso({
          tipo: "ok",
          texto: tipo
            ? `Motivo ${nomeDoMotivo(tipo)} salvo em app_config.${CHAVE_MOTIVOS}${
                MOTIVO_MANUAL.has(tipo) ? " — atestado é lançado à mão, fora do robô." : "."
              }`
            : `Motivo removido de app_config.${CHAVE_MOTIVOS}.`,
        });
      } catch (falha) {
        setAviso({ tipo: "danger", texto: falha?.message || "Não foi possível salvar o motivo." });
      } finally {
        setMotivoGravando("");
      }
    },
    [],
  );

  const marcarReserva = useCallback(async (cracha, dia, ligado) => {
    const chave = chaveDia(cracha, dia);
    setReservaGravando(chave);
    setAviso(null);
    try {
      const existe = await gravarReserva(cracha, dia, ligado);
      setReservas((atual) => {
        const novo = new Set(atual);
        if (existe) novo.add(chave);
        else novo.delete(chave);
        return novo;
      });
      setAviso({
        tipo: existe ? "ok" : "mute",
        texto: existe
          ? `Dia ${ddmm(dia)} marcado como RESERVA em ponto_reservas — a célula deixa de acusar S/OPER.`
          : `Marcação de reserva do dia ${ddmm(dia)} removida de ponto_reservas.`,
      });
    } catch (falha) {
      setAviso({ tipo: "danger", texto: falha?.message || "Não foi possível gravar a reserva." });
    } finally {
      setReservaGravando("");
    }
  }, []);

  // Disparo compartilhado (lote e pessoa a pessoa). Depois de um lançamento DE
  // VERDADE, os motivos definidos saem da fila — é o `limpar_folga_motivos` do
  // original (app.js:3755). Ensaio não limpa nada.
  const disparar = useCallback(async (filaDoLote, confirmar) => {
    const resposta = await dispararLote(filaDoLote, confirmar);
    if (confirmar) {
      const chaves = filaDoLote.filter((item) => item.definido).map((item) => item.chave);
      if (chaves.length) {
        const atualizados = await gravarMotivos((mapa) => {
          chaves.forEach((k) => mapa.delete(k));
        });
        setMotivos(atualizados);
      }
    }
    return resposta;
  }, []);

  const lancarLote = async (confirmar) => {
    if (!fila.length) return;
    const cabecalho = confirmar
      ? "LANÇAR DE VERDADE no Transnet:"
      : "ENSAIO (o robô navega e NÃO confirma):";
    const linhas = [
      `${cabecalho}`,
      "",
      `${pessoasNaFila} pessoa(s) · ${fila.length} dia(s)`,
      daFilaDefinidos
        ? `${fila.length - daFilaDefinidos} de folga automática e ${daFilaDefinidos} de motivo que você definiu`
        : `${fila.length} de folga automática (DSR / Compensação / Curso)`,
      foraDaTela
        ? `${foraDaTela} dia(s) vêm de motivos definidos FORA desta semana/categoria — é a mesma fila da ferramenta do DP.`
        : "",
      manuais.length
        ? `${manuais.length} dia(s) de Atestado (04) NÃO entram: esses são lançados à mão.`
        : "",
      "",
      confirmar ? "Ao disparar valendo, os motivos que você definiu saem da fila." : "",
      "Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.",
      "O resultado por dia NÃO volta sozinho para esta tela: a evidência fica no run do GitHub.",
    ].filter((l) => l !== "");
    if (!await perguntar(linhas.join("\n"))) return;

    setDisparandoLote(true);
    setRecadoLote(null);
    try {
      const r = await disparar(fila, confirmar);
      setRecadoLote({
        tipo: "ok",
        texto: `${confirmar ? "Lançamento" : "Ensaio"} disparado — ${pessoasNaFila} pessoa(s) · ${fila.length} dia(s).`,
        painel: r?.painel || "",
      });
    } catch (falha) {
      setRecadoLote({ tipo: "danger", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparandoLote(false);
    }
  };

  const indiceSemana = semanas.indexOf(semana);
  const pessoaSelecionada = visiveis.find((p) => p.cracha === selecionado) || null;

  // Nome para o histórico do bot: `ponto_ocorrencias` guarda só o crachá. Sai do
  // que já está na tela — quem não estiver na semana/categoria abertas aparece
  // pelo crachá, e o rodapé do pop-up diz isso.
  const nomesNaTela = useMemo(
    () => new Map(pessoas.filter((p) => p.nome).map((p) => [cra8(p.cracha), p.nome])),
    [pessoas],
  );

  // O número no botão tem de ser o mesmo que o pop-up mostra — os `aviso_*` já
  // saem aqui, senão o botão prometeria linhas que a lista corta.
  const totalHistorico = useMemo(
    () => listaOcorrencias.filter((o) => !RE_AVISO.test(texto(o.tipo))).length,
    [listaOcorrencias],
  );

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
          {caixaPergunta}
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
          <button
            type="button"
            className="dp-btn"
            onClick={() => setHistoricoAberto(true)}
            title="O que o robô já lançou no Transnet (DSR / Compensação / Curso), com o status de cada lançamento"
          >
            <History size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Histórico
            {totalHistorico > 0 && <span className="dp-faint"> · {totalHistorico}</span>}
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
          Transnet. <b>{visiveis.length}</b> colaborador(es) · <b>{totalFolgas}</b> folga(s) a
          lançar ·{" "}
          <span className="dp-faint">
            clique na célula S/PONTO (ou na folga) para dizer o que foi o dia.
          </span>
        </>
      }
    >
      {/* barra do lote — o equivalente ao `gbar tools` do original (app.js:3712) */}
      <div className="fg-lote">
        <div className="fg-lote-txt">
          <b>{marcados.length}</b> selecionado(s) · <b>{fila.length}</b> dia(s) na fila do robô
          {daFilaDefinidos > 0 && (
            <span className="dp-faint"> · {daFilaDefinidos} com motivo definido por você</span>
          )}
          {foraDaTela > 0 && (
            <span className="dp-faint"> · {foraDaTela} fora desta semana/categoria</span>
          )}
          {manuais.length > 0 && (
            <>
              {" "}
              <span className="dp-pill warn" title="O robô não lança atestado — esse vai à mão">
                ✋ {manuais.length} atestado(s) à mão
              </span>
            </>
          )}
        </div>
        <div className="fg-lote-acoes">
          <button
            type="button"
            className="dp-btn"
            disabled={!fila.length || disparandoLote}
            onClick={() => lancarLote(false)}
            title="O robô navega até o botão e NÃO clica — serve para conferir o lote inteiro"
          >
            🤖 Ensaio do lote
          </button>
          <button
            type="button"
            className="dp-btn"
            style={{ color: "var(--dp-danger-ink)" }}
            disabled={!fila.length || disparandoLote}
            onClick={() => lancarLote(true)}
            title="Lança de verdade, na ficha de cada um, no Transnet"
          >
            ⚠ Lançar o lote de verdade
          </button>
          {disparandoLote && <span className="dp-pill accent">disparando…</span>}
        </div>
      </div>

      {(recadoLote || aviso) && (
        <div className="fg-avisos">
          {recadoLote && (
            <span className={`dp-pill ${recadoLote.tipo === "ok" ? "ok" : "danger"}`}>
              {recadoLote.texto}
            </span>
          )}
          {recadoLote?.painel && (
            <a className="dp-btn" href={recadoLote.painel} target="_blank" rel="noreferrer">
              ver o robô rodando
            </a>
          )}
          {aviso && <span className={`dp-pill ${aviso.tipo}`}>{aviso.texto}</span>}
        </div>
      )}

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
                <div className="dp-calmark fg-chk">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    title="Marcar / desmarcar todos os que estão na tela"
                    aria-label="Marcar todos"
                  />
                </div>
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
                      <div
                        className="dp-calmark fg-chk"
                        onClick={(evento) => evento.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selecao.has(pessoa.cracha)}
                          onChange={() => alternarPessoa(pessoa.cracha)}
                          aria-label={`Marcar ${pessoa.nome || pessoa.cracha} para o lote`}
                        />
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
                        <Celula
                          key={celula.dia}
                          estado={celula.estado}
                          definido={!!celula.definido}
                          gravando={motivoGravando === celula.chave}
                          aoClicar={
                            celula.podeMotivo
                              ? (evento) => abrirPicker(evento, celula.chave, celula.definido)
                              : undefined
                          }
                        />
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
            aoAbrirPicker={abrirPicker}
            motivoGravando={motivoGravando}
            aoMarcarReserva={marcarReserva}
            reservaGravando={reservaGravando}
            aoDisparar={disparar}
          />
        )}
      </div>

      {picker && (
        <PickerMotivo
          ancora={picker.ancora}
          atual={picker.atual}
          aoFechar={fecharPicker}
          aoEscolher={(tipo) => escolherMotivo(picker.chave, tipo)}
        />
      )}

      {legendaAberta && <ModalLegenda aoFechar={() => setLegendaAberta(false)} />}

      {historicoAberto && (
        <ModalHistoricoBot
          linhas={listaOcorrencias}
          nomes={nomesNaTela}
          aoFechar={() => setHistoricoAberto(false)}
        />
      )}
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
