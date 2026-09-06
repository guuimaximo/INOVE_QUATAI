import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight, RefreshCw, Search, X } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { lerDP360, lerTudoDP360 } from "../../services/dp360Api";
// As QUATRO CAMADAS da gordura (main.py `_gord`) e a trava do aviso (`_ponta_conta`).
// Mesma régua que a aba Gordura roda — é o que faz o número desta tela ser o mesmo.
import {
  NIVEIS_P,
  PORTA_GORDURA,
  TETO_GORDURA_DIA,
  aplicarCamadasGordura,
  chaveDe,
  pontaConta,
} from "./regrasGordura";
// A reserva LANÇADA pelo gestor mora na base do PRÓPRIO INOVE (`reservas_motoristas`),
// não na base de importação do DP360 — por isso sai pelo cliente Supabase normal e não
// pelo gateway `dp360-api` (mesma leitura da aba Gordura, só que por período).
import { supabase } from "../../supabase";
import "./dp360.css";

/* =============================================================================
   RESUMO (DP360) — fusão de DUAS telas da ferramenta original (Sistemas/PONTO):

   1) GERENCIAL  — app/ui/app.js `viewGerencial` + app/main.py `get_gerencial`.
      Quem ainda está com o cartão incorreto na COMPETÊNCIA (mês 20→19), pelas
      regras do P1 (sem almoço curto/longo, que têm tela própria).

   2) DASHBOARD  — app/ui/app.js `viewDash` + app/main.py `get_dashboard_horas`
      / `get_dashboard_detalhe` (esteira de captura, ciclo do aviso, gordura
      corrigida, valor gerencial) E o "Resumo do ponto" de `viewHome`
      (app/main.py `get_dashboard` / `get_dashboard_itens`: mês × categoria em
      corretos / incorretos / ponto sem operação / justificado / sem ponto).

   FASE ATUAL: SOMENTE LEITURA. Nada nesta tela grava.

   A REGRA DE NEGÓCIO NÃO MORA AQUI. `status_ponto`, `motivo`, `classificacao`,
   `teve_operacao`, `jornada_liquida_min` já vêm calculados pela view do Athena e
   chegam prontos na `ponto_diario`; o ciclo do aviso já vem gravado na
   `ponto_caso`. Esta tela só reagrupa e conta, com as MESMAS regras do main.py.

   ---------------------------------------------------------------------------
   DECISÕES DA FUSÃO (o que foi descartado por duplicidade)
   ---------------------------------------------------------------------------
   • RECORTE ÚNICO = COMPETÊNCIA (20→19). O Gerencial já é por competência; o
     "Resumo do ponto" do original era por MÊS DE CALENDÁRIO (`dref[:7]` em
     `get_dashboard`). Duas telas fundidas não podem ter dois seletores de
     período dizendo coisas diferentes — os baldes passam a ser contados na
     mesma janela da competência. É a MESMA métrica (`_bucket`), outra janela.
   • KPIs de dias/pessoas: ficaram os do Gerencial (`kpis`), que são exatamente
     os mesmos dias que os baldes "incorreto"/"ponto sem operação" contam por
     outro corte. Não foi duplicado.
   • Competência padrão: a ÚLTIMA JÁ FECHADA (regra do `get_gerencial`), não a
     corrente. As duas telas originais divergiam nisso — o Dashboard abria na
     corrente. Ficou a do Gerencial porque a corrente está SEMPRE em andamento e
     faria "dias errados" parecer menor do que é. O seletor tem todas.
   • Lista por trás do número: o original tinha duas (`get_dashboard_itens`, do
     ponto; `get_dashboard_detalhe`, do caso). As duas ficaram — são listas
     diferentes — mas num único painel/modal.

   ---------------------------------------------------------------------------
   OPORTUNIDADE — o que nasce de `self._gord()` (JÁ PORTADO)
   ---------------------------------------------------------------------------
   O bloco de oportunidade do `get_dashboard_horas` está aqui: horas abertas,
   oportunidade por nível P (P1..P4), "P1 oficial" e pessoas com P1, gordura por
   ponta (entrada × saída), top ofensores, a caixa "Ainda não avisados"
   (`faltam`), a série diária e o "potencial aberto" em R$.

   Deu pra portar porque as QUATRO CAMADAS que transformam a `ponto_gordura`
   CRUA no número que o DP usa — prioridade Citatti/linha 99, reserva lançada no
   INOVE, reserva por GPS e alvo publicado pela Revisão — saíram de dentro da aba
   Gordura e viraram `regrasGordura.js`. As duas telas rodam a MESMA régua, então
   o número daqui é o mesmo número de lá (e o mesmo da ferramenta): reimplementar
   por cima da tabela crua daria outro, e número que não bate ninguém usa.

   ---------------------------------------------------------------------------
   CONTINUA FORA — uma coisa só, e o motivo
   ---------------------------------------------------------------------------
   • SÉRIE POR COMPETÊNCIA (o gráfico "Ano por competência · P1" do painel
     original). No Python ela é calculada sobre a gordura INTEIRA, todas as
     competências de uma vez — `serie_comp` é montada ANTES do filtro do seletor
     ("a série anual não depende do seletor aberto na tela"). Aqui isso seria
     baixar a `ponto_gordura` inteira no navegador: ~10 mil linhas POR
     competência, 12 competências no gráfico. A metade barata dá pra fazer (o
     congelado dos casos P1 vem da `ponto_caso`, que é pequena), mas a outra
     metade — a oportunidade P1 ainda ABERTA das competências passadas — só
     existe na gordura; sem ela cada barra antiga sairia MENOR que a da
     ferramenta, e barra que não bate ninguém usa. Entra no dia em que o gateway
     `dp360-api` ganhar uma ação de agregação (soma por competência feita no
     servidor); nada mais nesta tela precisa mudar para isso.
   ========================================================================== */

/* ---------------- constantes (espelham app/main.py; mexeu aqui, mexe lá) --- */

// main.py `Api._GER_LUNCH` — almoço tem tela e fluxo próprios, não entra no P1.
const GER_LUNCH = new Set([
  "ALMOCO_CURTO", "ALMOCO_LONGO", "ALMOCO_MUITO_LONGO", "ALMOCO_INDEVIDO",
  "FALTA_ALMOCO", "ALMOCO_AUTOMATICO",
]);
// main.py `Api._GER_FECHA_NAO` — cartão que não fecha: não dá pra saber quantas
// horas a pessoa trabalhou.
const GER_FECHA_NAO = new Set([
  "BATIDA_UNICA", "FALTA_SAIDA", "FALTA_ENTRADA", "VOLTA_ALMOCO_ESQUECIDA",
  "BATIDAS_FALTANDO", "FALTA_ENTRADA_E_SAIDA",
]);
const GER_RECORRENTE_MIN = 3; // main.py `Api._GER_RECORRENTE_MIN`
const JORNADA_GRAVE_MIN = 13 * 60; // main.py `grave()`: jornada > 13h
const PRAZO_HORAS = 48; // main.py `Api.PRAZO_HORAS` — 48h pra responder o aviso

// app.js `GER_MOTIVO` / `GER_TAG` — linguagem de tela, não regra.
const GER_MOTIVO = {
  JORNADA_INCOMPLETA: "Jornada incompleta (validador)",
  PONTO_SEM_OPERACAO: "Bateu o ponto mas não operou",
  BATIDAS_DUPLICADAS: "Batidas duplicadas",
  FALTA_SAIDA: "Faltou registrar a saída",
  VOLTA_ALMOCO_ESQUECIDA: "Faltou registrar a volta do almoço",
  JORNADA_SUSPEITA: "Jornada suspeita",
  BATIDA_UNICA: "Só uma batida no dia",
  BATIDAS_EXTRAS: "Batidas extras",
  FALTA_ENTRADA: "Faltou registrar a entrada",
  JORNADA_INVALIDA: "Jornada inválida (fonte > 16h)",
  BATIDAS_FALTANDO: "Batidas faltando",
  FALTA_ENTRADA_E_SAIDA: "Nenhuma ponta registrada",
};
const GER_TAG = {
  bateu_nao_operou: "bateu e não operou",
  cartao_nao_fecha: "cartão não fecha",
  jornada_suspeita: "jornada suspeita",
  jornada_13h: "jornada > 13h",
};

// main.py `Api._DASH_CATS` e `Api._bucket`.
const DASH_CATS = [
  ["MOTORISTA", "Motorista"],
  ["INTERNO", "Interno"],
  ["APRENDIZ", "Aprendiz"],
];
const METRICAS = [
  ["ok", "Corretos", "var(--dp-ok-ink)"],
  ["incorreto", "Incorretos", "var(--dp-warn-ink)"],
  ["sem_operacao", "Ponto s/ operação", "var(--dp-danger-ink)"],
  ["justificado", "Justificado", "var(--dp-accent)"],
  ["sem_ponto", "Sem ponto", "var(--dp-faint)"],
];

/* A CAIXA QUE NÃO NASCE DO CASO. `faltam` é a única das `_DASH_CAIXAS` que sai da
   GORDURA, não da `ponto_caso`: por definição são os dias que ninguém tocou, então
   não existe caso pra eles. Fica separada de `CAIXAS` porque `apurarCaptura` só
   sabe ler caso — quem a preenche é `apurarOportunidade`. */
const CAIXA_FALTAM = {
  id: "faltam",
  rot: "Ainda não avisados",
  tom: "res",
  ajuda: "Dias com gordura acima da régua do aviso que nunca viraram aviso. É a oportunidade aberta.",
};

/* AS PLACAS DA ESTEIRA que saem da `ponto_caso`. `id` é a caixa do backend
   (main.py `_DASH_CAIXAS`); o rótulo e a ajuda vêm de app.js `DASH_CAIXAS` —
   linguagem de tela. */
const CAIXAS = [
  { id: "aguardando", rot: "Avisados, no prazo", tom: "accent",
    ajuda: "O aviso saiu e as 48h ainda não venceram. A bola está com o colaborador." },
  { id: "vencido", rot: "Venceram sem resposta", tom: "warn",
    ajuda: "Passou das 48h e ninguém mexeu. Daqui sai advertência + correção." },
  { id: "advertido", rot: "Advertidos, sem correção", tom: "warn",
    ajuda: "A carta saiu e o ponto continua errado. É o trabalho que sobra." },
  { id: "capturado", rot: "Capturados", tom: "ok",
    ajuda: "Correção lançada e confirmada no Transnet, com tempo recuperado." },
  { id: "devolvido", rot: "Devolvidos", tom: "danger",
    ajuda: "A correção AUMENTOU a jornada — o cartão estava a menos do que a pessoa trabalhou." },
  { id: "registrado", rot: "Só registrados", tom: "mute",
    ajuda: "O cartão não fechava e foi completado. Não capturou nem devolveu tempo." },
  { id: "fechado", rot: "Ponto fechado", tom: "mute",
    ajuda: "A competência encerrou: o Transnet não aceita mais alterar. Não há o que fazer." },
];

// Colunas da `ponto_diario` que esta tela lê. Lista explícita (e não `select=*`)
// porque a competência inteira tem ~13 mil linhas e a tabela é MUITO larga.
// Todas conferidas em importador_supabase/sql_catalogo/3_vw_ponto_revisao_motorista.sql:
// pedir coluna que não existe devolve HTTP 400 e derruba a página.
const COLUNAS_PONTO = [
  "cracha", "nm_funcionario", "nm_funcao", "categoria", "date_ref",
  "status_ponto", "motivo", "jornada_liquida_min", "jornada_transnet",
  "teve_operacao", "te_descricao_dia", "classificacao", "todas_batidas",
  // As quatro do ALVO alimentam a camada 4 da gordura (`camadaAlvo`): é o alvo
  // publicado pela Revisão que manda sobre a conta local. Conferidas no mesmo
  // arquivo (`3_vw_ponto_revisao_motorista.sql`, colunas alvo_entrada/alvo_saida
  // e alvo_entrada_ref/alvo_saida_ref).
  "alvo_entrada", "alvo_saida", "alvo_entrada_ref", "alvo_saida_ref",
].join(",");

// Colunas da `ponto_gordura` que as quatro camadas + o painel precisam. Lista
// explícita (a competência inteira tem ~10 mil linhas) e conferida contra o DDL da
// tabela em Sistemas/PONTO `supabase_gordura.sql` — pedir coluna que não existe
// devolve HTTP 400 e derruba a leitura. NÃO existem ali `alvo_entrada`/`alvo_saida`
// (quem as cria é a camada 4) nem `esc_entrada` (só `esc_inicio`).
const COLUNAS_GORDURA = [
  "cracha", "nm_funcionario", "data_ref",
  "esc_inicio", "tn_entrada", "tn_saida", "val_inicio", "op_inicio", "op_fim",
  "real_inicio", "real_fim",
  "gordura_entrada", "nivel_entrada", "gordura_saida", "nivel_saida",
].join(",");

// `ponto_linha99` é a tabela mínima do lake: uma linha = crachá × dia com prioridade
// Citatti (DDL em importador_supabase/criar_tabela_ponto_linha99.sql).
const COLUNAS_LINHA99 = "cracha,data_ref";

const LIMITE_LISTA = 400; // main.py `get_dashboard_detalhe`: `itens[:400]`

// app.js `viewDash`: os níveis aparecem com P3⁻ no lugar de P3_SEM_CONFIRMACAO.
const NIVEL_ROT = (cod) => cod.replace("_SEM_CONFIRMACAO", "⁻");

// As MESMAS cores de nível da aba Gordura (`dp-gmark.g-p1..g-p4` em dp360.css), pra
// P1 ser vermelho nas duas telas. P3 e P3⁻ dividem a cor, como lá.
const COR_NIVEL = {
  P1: "var(--dp-danger-ink)",
  P2: "var(--dp-warn-ink)",
  P3: "var(--dp-accent)",
  P3_SEM_CONFIRMACAO: "var(--dp-accent)",
  P4: "var(--dp-muted)",
};

/* ------------------------------- utilitários ------------------------------ */

const txt = (v) => String(v ?? "").trim();
const dia10 = (v) => txt(v).slice(0, 10);

// ATENÇÃO: a `ponto_diario` devolve boolean como STRING ("true"/"false").
const ehFalso = (v) => txt(v).toLowerCase() === "false";

// main.py `_cracha8` — o lake mistura 7 e 8 dígitos na mesma pessoa.
function cra8(valor) {
  const c = txt(valor);
  return /^\d{1,7}$/.test(c) ? c.padStart(8, "0") : c;
}

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
// main.py `numj`: devolve null quando não dá pra ler (não zero — zero é jornada).
const numOuNulo = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// main.py `chave(m)`: "JORNADA_INVALIDA (fonte 17h)" -> "JORNADA_INVALIDA".
const chaveMotivo = (m) => txt(m).split("(")[0].trim().toUpperCase();

// main.py `Api._competencia`: dia >= 20 conta pra competência do mês SEGUINTE.
function competenciaDe(dataIso) {
  const p = dia10(dataIso).split("-");
  if (p.length < 3) return "";
  let ano = Number(p[0]);
  let mes = Number(p[1]);
  const dia = Number(p[2]);
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return "";
  if (dia >= 20) {
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
}

// A competência "aaaa-mm" vai de 20/(mm-1) a 19/mm — mesmo intervalo do main.py.
function periodoDaCompetencia(comp) {
  const [a, m] = txt(comp).split("-").map(Number);
  if (!a || !m) return ["", ""];
  const mIni = m > 1 ? m - 1 : 12;
  const aIni = m > 1 ? a : a - 1;
  return [
    `${String(aIni).padStart(4, "0")}-${String(mIni).padStart(2, "0")}-20`,
    `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-19`,
  ];
}

const MESES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function nomeCompetencia(comp) {
  const [a, m] = txt(comp).split("-").map(Number);
  if (!a || !m) return comp || "—";
  const [ini, fim] = periodoDaCompetencia(comp);
  return `Competência ${MESES[m]}/${a} (${ini.slice(8, 10)}/${ini.slice(5, 7)} a ${fim.slice(8, 10)}/${fim.slice(5, 7)})`;
}

// Lista de competências entre a data mais antiga e a mais nova da base, sem
// varrer a tabela. (`lerDatasDP360` não serve aqui: o gateway varre no máximo
// 25 mil linhas pra deduplicar, o que na `ponto_diario` é ~1 mês de dias.)
function competenciasEntre(dataMin, dataMax) {
  const cIni = competenciaDe(dataMin);
  const cFim = competenciaDe(dataMax);
  if (!cIni || !cFim) return [];
  const out = [];
  let [ano, mes] = cFim.split("-").map(Number);
  for (let i = 0; i < 60; i += 1) {
    const c = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}`;
    out.push(c);
    if (c <= cIni) break;
    mes -= 1;
    if (mes < 1) { mes = 12; ano -= 1; }
  }
  return out;
}

const fmtDia = (iso) => (dia10(iso).length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

// "745" -> "12h25". Aceita minutos fracionados (a base guarda tudo como texto).
function hhmm(minutos) {
  const m = Math.round(Math.abs(num(minutos)));
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
}
const fmtJornada = (min) => (min == null ? "—" : hhmm(min));
const brl = (v) => (num(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (parte, total) => (total ? Math.round((parte / total) * 100) : 0);

/* A CADEIA DE ARREDONDAMENTO DO PAINEL DE HORAS, preservada de propósito:
   `get_dashboard_horas` devolve as horas de oportunidade com UMA casa
   (`round(min/60, 1)`) e o app.js desenha ESSE número (`dh`). 743 min viram 12,4 h
   e a placa mostra "12h24" — não "12h23". Pular o passo do meio daria um número
   diferente do que o DP já conhece, então aqui a conta é a mesma, em duas etapas.
   AMBIGUIDADE: o `round()` do Python é bancário (metade vai pro par) e o
   Math.round sobe sempre; só divergem quando min/60 cai exatamente em .x5, e o
   efeito é de 0,1 h no rótulo — nunca na decisão, que usa os minutos crus. */
const horas1 = (min) => Math.round((num(min) / 60) * 10) / 10;
// app.js `dh`: 12.4 -> "12h24". A fração vem sempre de `horas1` (no máximo .9),
// então `Math.round(.9 * 60)` = 54 e nunca estoura para "h60".
const hmDeHoras = (h) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

/* --------------------------- GERENCIAL (ponto_diario) --------------------- */

// main.py `get_gerencial` -> `grave(r)`.
function sinalGrave(linha) {
  const m = chaveMotivo(linha.motivo);
  if (m === "PONTO_SEM_OPERACAO") return "bateu_nao_operou";
  if (GER_FECHA_NAO.has(m)) return "cartao_nao_fecha";
  if (m === "JORNADA_INVALIDA" || m === "JORNADA_SUSPEITA") return "jornada_suspeita";
  const j = numOuNulo(linha.jornada_liquida_min);
  if (j != null && j > JORNADA_GRAVE_MIN) return "jornada_13h";
  return null;
}

function apurarGerencial(linhas) {
  const erros = linhas.filter(
    (r) => txt(r.status_ponto) === "REVISAR" && !GER_LUNCH.has(chaveMotivo(r.motivo)),
  );

  const porPessoa = new Map();
  erros.forEach((r) => {
    const cracha = cra8(r.cracha);
    const chave = [cracha, txt(r.nm_funcionario), txt(r.categoria).toUpperCase(), txt(r.nm_funcao)].join("|");
    if (!porPessoa.has(chave)) {
      porPessoa.set(chave, {
        cracha,
        nome: txt(r.nm_funcionario),
        categoria: txt(r.categoria).toUpperCase(),
        funcao: txt(r.nm_funcao),
        dias: [],
      });
    }
    porPessoa.get(chave).dias.push({
      data: dia10(r.date_ref),
      motivo: chaveMotivo(r.motivo),
      grave: sinalGrave(r),
      jornada: numOuNulo(r.jornada_liquida_min),
      batidas: txt(r.todas_batidas),
    });
  });

  const pessoas = [...porPessoa.values()].map((p) => {
    const dias = [...p.dias].sort((a, b) => a.data.localeCompare(b.data));
    const tags = [...new Set(dias.map((d) => d.grave).filter(Boolean))].sort();
    const recorrente = dias.length >= GER_RECORRENTE_MIN;
    return {
      ...p,
      dias,
      nDias: dias.length,
      tags,
      recorrente,
      muitoGrave: tags.length > 0 || recorrente,
    };
  });

  // main.py: muito grave primeiro, depois mais sinais, depois mais dias, depois nome.
  pessoas.sort(
    (a, b) =>
      Number(b.muitoGrave) - Number(a.muitoGrave)
      || b.tags.length - a.tags.length
      || b.nDias - a.nDias
      || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return {
    pessoas,
    kpis: {
      diasPeriodo: linhas.length,
      diasErrados: erros.length,
      pessoasErro: pessoas.length,
      pessoasGrave: pessoas.filter((p) => p.muitoGrave).length,
    },
  };
}

/* ------------------------ BALDES DO PONTO (ponto_diario) ------------------ */

// main.py `Api._bucket`: sem_ponto = SEM ponto E SEM nada lançado; justificado =
// SEM ponto MAS com lançamento no Transnet (atestado/férias/DSR/falta…).
function baldeDaLinha(r) {
  const cat = txt(r.categoria).toUpperCase();
  if (!DASH_CATS.some(([id]) => id === cat)) return null;
  const status = txt(r.status_ponto);
  if (status === "OK") return "ok";
  if (status === "SEM_PONTO") {
    const te = txt(r.te_descricao_dia);
    const classif = txt(r.classificacao).toUpperCase();
    return te || classif === "AFASTADO" ? "justificado" : "sem_ponto";
  }
  if (status === "REVISAR") {
    if (cat === "MOTORISTA" && txt(r.jornada_transnet) && ehFalso(r.teve_operacao)) return "sem_operacao";
    return "incorreto";
  }
  return null;
}

function apurarBaldes(linhas) {
  const zero = () => ({ ok: 0, incorreto: 0, sem_operacao: 0, justificado: 0, sem_ponto: 0 });
  const agg = {};
  DASH_CATS.forEach(([id]) => { agg[id] = zero(); });
  linhas.forEach((r) => {
    const b = baldeDaLinha(r);
    if (b) agg[txt(r.categoria).toUpperCase()][b] += 1;
  });
  return agg;
}

// main.py `get_dashboard_itens` — a lista de um balde (pessoa + dia).
function itensDoBalde(linhas, categoria, metrica) {
  return linhas
    .filter((r) => txt(r.categoria).toUpperCase() === categoria && baldeDaLinha(r) === metrica)
    .map((r) => ({
      cracha: txt(r.cracha),
      nome: txt(r.nm_funcionario),
      dia: dia10(r.date_ref),
      detalhe: txt(r.te_descricao_dia) || txt(r.motivo) || txt(r.classificacao),
      batidas: txt(r.todas_batidas),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.dia.localeCompare(b.dia));
}

/* ------------------------- ESTEIRA DE CAPTURA (ponto_caso) ---------------- */

// main.py `_caso_dashboard_gordura`: o Radar mede exclusivamente a gordura
// tratada pelo DP. Correção de revisão/refeição também fecha cartão, mas não é
// recuperação de gordura — sem a prova da origem, fica fora do indicador.
const casoEhGordura = (c) => txt(c.origem).toLowerCase() === "gordura";

// main.py `_captura_confirmada_dashboard`: (minutos, fonte). Só correção FINAL
// confirmada entra. Os lançamentos novos têm `captura_min`; os antigos usam a
// `gordura_min` congelada no instante do aviso.
function capturaConfirmada(c) {
  if (!txt(c.correcao_final_em)) return [0, ""];
  const medido = num(c.captura_min);
  const tipo = txt(c.captura_tipo).toLowerCase();
  if (tipo) return [medido, tipo];
  return [Math.max(0, num(c.gordura_min)), "legado_congelado"];
}

// main.py `get_dashboard_detalhe`: em que caixa(s) este caso cai. Devolve lista
// porque no original cada caixa é contada por uma passagem independente — um
// caso corrigido numa competência já fechada aparece em "capturado" E em "ponto
// fechado". Reproduzir isso é o que faz o total daqui bater com o da ferramenta.
function caixasDoCaso(c, agoraMs) {
  if (!casoEhGordura(c)) return [];
  const fim = txt(c.correcao_final_em);
  const st = txt(c.correcao_status);
  const adv = txt(c.aviso_enviado_em);
  const carta = txt(c.advertencia_enviada_em);
  const [cap, tp] = capturaConfirmada(c);
  const alvo = `${txt(c.alvo_entrada) || "—"} – ${txt(c.alvo_saida) || "—"}`;
  const base = {
    cracha: txt(c.cracha),
    dia: dia10(c.date_ref),
    nome: txt(c.nm_funcionario),
  };
  const out = [];

  if (fim && cap > 0) {
    out.push({ ...base, caixa: "capturado", min: Math.round(cap), quando: fim.slice(0, 10), detalhe: txt(c.ponto_final) || tp });
  }
  if (fim && cap < 0) {
    out.push({ ...base, caixa: "devolvido", min: Math.round(-cap), quando: fim.slice(0, 10), detalhe: txt(c.ponto_final) });
  }
  if (fim && tp === "dia_registrado") {
    out.push({ ...base, caixa: "registrado", min: 0, quando: fim.slice(0, 10), detalhe: txt(c.ponto_final) });
  }
  if (st === "ponto_fechado") {
    out.push({
      ...base, caixa: "fechado", min: Math.round(num(c.gordura_min)),
      quando: txt(c.atualizado_em).slice(0, 10), detalhe: txt(c.usuario).slice(0, 160),
    });
  }
  if (carta && !fim && st !== "ponto_fechado") {
    out.push({ ...base, caixa: "advertido", min: Math.round(num(c.gordura_min)), quando: carta.slice(0, 10), detalhe: alvo });
  }
  if (adv && !carta && !fim) {
    // Aviso sem data legível não vira "vencido" por acidente — no main.py a
    // conta estoura e `h` fica 0, o que mantém o caso em "aguardando".
    const t = Date.parse(adv);
    const horas = Number.isFinite(t) ? (agoraMs - t) / 3600000 : 0;
    const caixa = horas > PRAZO_HORAS ? "vencido" : "aguardando";
    out.push({
      ...base, caixa, min: Math.round(num(c.gordura_min)), quando: adv.slice(0, 10),
      detalhe: `${alvo} · há ${Math.round(horas)}h`,
    });
  }
  return out;
}

function apurarCaptura(casos) {
  const agoraMs = Date.now();
  const porCaixa = {};
  CAIXAS.forEach((c) => { porCaixa[c.id] = []; });

  casos.forEach((c) => {
    caixasDoCaso(c, agoraMs).forEach((item) => {
      if (porCaixa[item.caixa]) porCaixa[item.caixa].push(item);
    });
  });

  const caixas = {};
  Object.entries(porCaixa).forEach(([id, itens]) => {
    itens.sort((a, b) => (b.min || 0) - (a.min || 0) || a.nome.localeCompare(b.nome, "pt-BR"));
    caixas[id] = {
      itens,
      qtd: itens.length,
      min: itens.reduce((s, i) => s + (i.min || 0), 0),
      pessoas: new Set(itens.map((i) => i.cracha)).size,
    };
  });

  // main.py `get_dashboard_horas`: ciclo, economizado e devolvido — só gordura.
  const ciclo = { avisados: 0, respondidos: 0, executados: 0, advertidos: 0, corrigidos: 0 };
  let econMin = 0;
  let econCasos = 0;
  let devolvidoMin = 0;

  casos.filter(casoEhGordura).forEach((c) => {
    if (txt(c.aviso_enviado_em)) {
      ciclo.avisados += 1;
      if (["aceito", "rejeitado"].includes(txt(c.aceite))) ciclo.respondidos += 1;
      if (txt(c.conferido_em)) ciclo.executados += 1;
    }
    if (txt(c.advertencia_enviada_em)) ciclo.advertidos += 1;
    if (txt(c.correcao_final_em)) ciclo.corrigidos += 1;

    // RECUPERAÇÃO SÓ EXISTE APÓS CORREÇÃO FINAL: aceite, recusa ou conferência
    // isolada são etapas do fluxo, não horas recuperadas.
    const [dif, tp] = capturaConfirmada(c);
    if (!tp) return;
    if (dif < 0) { devolvidoMin += -dif; return; }
    if (dif <= 0) return; // registro/neutro: correção concluída, captura nenhuma
    econMin += dif;
    econCasos += 1;
  });

  return {
    caixas,
    ciclo,
    economizado: {
      min: Math.round(econMin),
      casos: econCasos,
      devolvidoMin: Math.round(devolvidoMin),
      liquidoMin: Math.round(econMin - devolvidoMin),
    },
  };
}

/* --------------------- OPORTUNIDADE (gordura já normalizada) -------------- */

/**
 * main.py `get_dashboard_horas` — a metade que nasce de `self._gord()`, mais a
 * caixa `faltam` de `get_dashboard_detalhe`.
 *
 * ENTRA A GORDURA **DEPOIS DAS QUATRO CAMADAS** (`aplicarCamadasGordura`), nunca a
 * `ponto_gordura` crua: é a camada do alvo que decide quem cai em
 * TOLERANCIA_OPERACIONAL e qual é o minuto de cada ponta.
 *
 * `gorduras` e `casos` já chegam recortados pela competência — a leitura filtra
 * `data_ref`/`date_ref` na janela 20→19, que é a própria definição de competência
 * (o Python faz o mesmo recorte com `self._competencia(...) != competencia`).
 *
 * DUAS PORTAS DIFERENTES, de propósito, iguais às do original:
 *  · os totais por nível P, o "P1 oficial" e a divisão entrada×saída usam
 *    `PORTA_GORDURA` (10 min nas DUAS pontas) — é o indicador histórico, main.py:7643;
 *  · a caixa `faltam` usa `pontaConta` (10 na entrada, 8 na saída), que é A MESMA
 *    TRAVA DO AVISO: essa caixa vira trabalho pra alguém, então tem de listar
 *    exatamente o que o sistema aceitaria avisar.
 */
function apurarOportunidade(gorduras, casos) {
  const casosGordura = (casos || []).filter(casoEhGordura);
  const ehP1 = (c) => txt(c.nivel).toUpperCase() === "P1";
  const casosP1 = casosGordura.filter(ehP1);
  const chavesCasoP1 = new Set(casosP1.map((c) => chaveDe(c.cracha, c.date_ref)));
  // `vistos` = todo dia de gordura que JÁ virou caso (em qualquer estágio). O que
  // sobra é a caixa `faltam` (main.py:3752-3762).
  const vistos = new Set(casosGordura.map((c) => chaveDe(c.cracha, c.date_ref)));

  const op = {};
  NIVEIS_P.forEach((n) => { op[n] = { min: 0, pontas: 0 }; });
  const serie = new Map();
  const porPessoa = new Map();
  const dias = new Set();
  const faltamItens = [];
  let entradaMin = 0;
  let saidaMin = 0;
  let ruidoMin = 0;

  const noDia = (dia) => {
    if (!serie.has(dia)) serie.set(dia, { dia, oportunidadeMin: 0, capturadoMin: 0 });
    return serie.get(dia);
  };

  (gorduras || []).forEach((g) => {
    const dia = dia10(g.data_ref);
    const chave = chaveDe(g.cracha, g.data_ref);
    // main.py `dias`: o par é o CRU (a gordura tem PK cracha+data_ref), só pra
    // dizer sobre quantos dias-pessoa a oportunidade foi medida.
    dias.add(`${txt(g.cracha)}|${txt(g.data_ref)}`);
    const sd = noDia(dia);

    [[g.nivel_entrada, g.gordura_entrada], [g.nivel_saida, g.gordura_saida]].forEach(([niv, gor]) => {
      const n = txt(niv).toUpperCase();
      const v = num(gor);
      if (op[n] && v > PORTA_GORDURA) {
        op[n].min += v;
        op[n].pontas += 1;
      }
      // Dia SEM caso: a linha está aberta e a gordura de hoje é a oportunidade.
      // Dia COM caso P1: entra logo abaixo pelo valor CONGELADO do aviso — senão a
      // barra amarela encolheria justamente quando a correção deu certo.
      if (n === "P1" && v > PORTA_GORDURA && !chavesCasoP1.has(chave)) sd.oportunidadeMin += v;
    });

    // Onde está o desvio P1 (entrada × saída) e a concentração por pessoa
    // (main.py:3950-3970). A ponta que não passa a porta é zerada, não descartada:
    // a pessoa entra na lista pela ponta que passou.
    let ge = txt(g.nivel_entrada).toUpperCase() === "P1" ? num(g.gordura_entrada) : 0;
    let gs = txt(g.nivel_saida).toUpperCase() === "P1" ? num(g.gordura_saida) : 0;
    if (ge > PORTA_GORDURA) entradaMin += ge; else ge = 0;
    if (gs > PORTA_GORDURA) saidaMin += gs; else gs = 0;
    if (ge || gs) {
      const cra = txt(g.cracha);
      if (!porPessoa.has(cra)) {
        porPessoa.set(cra, { cracha: cra, nome: txt(g.nm_funcionario), min: 0, dias: 0 });
      }
      const p = porPessoa.get(cra);
      p.min += ge + gs;
      p.dias += 1;
    }

    /* CAIXA `faltam` — ATENÇÃO, AQUI O NÚMERO NÃO BATE COM A FERRAMENTA, E É DE
       PROPÓSITO. Em app/main.py:3777 e 3780 a chamada é
       `self._ponta_conta(niv, gor, ponta)` com `ponta` NUNCA DEFINIDO naquele
       escopo (o `for` itera só `niv, gor`). Isso levanta NameError, o
       `except Exception` de `get_dashboard_detalhe` devolve `ok: False`, o
       dashboard grava `caixas["faltam"] = None` e a tela pinta 0 / "não deu pra
       contar". Ou seja: hoje a ferramenta NÃO mostra esta caixa — não existe um
       número dela pra divergir.
       Portamos a intenção escrita no próprio comentário do Python ("`_ponta_conta`
       é a mesma trava do aviso"), com a ponta correta em cada lado: 10 min na
       entrada, 8 na saída. Se um dia o Python for consertado, os dois passam a
       bater; se for consertado de outro jeito, é aqui que se ajusta. */
    if (vistos.has(chave)) return;
    let m = 0;
    const niveis = [];
    [["entrada", g.nivel_entrada, g.gordura_entrada],
      ["saida", g.nivel_saida, g.gordura_saida]].forEach(([ponta, niv, gor]) => {
      const n = txt(niv).toUpperCase();
      const v = num(gor);
      // DIA DE RESERVA NÃO PRODUZ GORDURA COBRÁVEL: em standby não há operação, o
      // "real" não existe e a diferença bateu×operou vira artefato (DOUGLAS 19/05
      // aparecia com 717 min num dia em que não rodou). Fica fora da oportunidade e
      // é contado à parte, pra ninguém achar que sumiu.
      if (n === "RESERVA") {
        if (pontaConta(niv, gor, ponta) && v > 0) ruidoMin += v;
        return;
      }
      if (pontaConta(niv, gor, ponta) && v > 0) {
        m += v;
        niveis.push(n);
      }
    });
    // UM DIA NÃO TEM 12 HORAS DE GORDURA (main.py:3785). Acima disso é defeito de
    // cálculo — virada de meia-noite mal desenrolada —, não oportunidade; e painel
    // que soma defeito não é confiável.
    if (m > 0 && m <= TETO_GORDURA_DIA) {
      faltamItens.push({
        cracha: txt(g.cracha),
        nome: txt(g.nm_funcionario),
        dia,
        min: Math.round(m),
        detalhe: [...new Set(niveis)].join(" · "),
      });
    }
  });

  // A FOTOGRAFIA DO AVISO (main.py:3897-3906): o P1 que já entrou no fluxo continua
  // sendo a oportunidade identificada naquele dia, pelo valor congelado no aviso.
  casosP1.forEach((c) => {
    const v = Math.max(0, num(c.gordura_min));
    if (!v) return;
    noDia(dia10(c.date_ref)).oportunidadeMin += v;
  });

  // O VERDE É P1 CONTRA P1 e só depois da correção FINAL confirmada — aceite,
  // recusa ou conferência isolada são etapas do fluxo, não hora recuperada. O dia
  // do gráfico é o do PONTO, não o da execução.
  casosGordura.forEach((c) => {
    const [dif, tp] = capturaConfirmada(c);
    if (!tp || dif <= 0 || !ehP1(c)) return;
    noDia(dia10(c.date_ref)).capturadoMin += dif;
  });

  const totalMin = NIVEIS_P.reduce((s, n) => s + op[n].min, 0);
  faltamItens.sort(
    (a, b) => (b.min || 0) - (a.min || 0) || a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return {
    porP: NIVEIS_P.map((n) => ({
      cod: n,
      rot: NIVEL_ROT(n),
      min: Math.round(op[n].min),
      horas: horas1(op[n].min),
      pontas: op[n].pontas,
    })),
    pontasTotal: NIVEIS_P.reduce((s, n) => s + op[n].pontas, 0),
    totalMin: Math.round(totalMin),
    oficialMin: Math.round(op.P1.min), // "P1 oficial" — o único número cobrável
    porPonta: { entradaMin, saidaMin },
    // main.py devolve top 8; app.js desenha 6. Fica o que o DP vê.
    top: [...porPessoa.values()]
      .sort((a, b) => b.min - a.min)
      .slice(0, 8)
      .map((p) => ({ nome: p.nome, horas: horas1(p.min), dias: p.dias })),
    pessoasP1: porPessoa.size,
    diasBase: dias.size,
    faltam: {
      itens: faltamItens,
      qtd: faltamItens.length,
      min: faltamItens.reduce((s, i) => s + (i.min || 0), 0),
      pessoas: new Set(faltamItens.map((i) => i.cracha)).size,
      ruidoMin: Math.round(ruidoMin),
    },
    // main.py corta em 21 dias; app.js desenha os últimos 14 (feito na tela).
    serieDiaria: [...serie.values()]
      .sort((a, b) => a.dia.localeCompare(b.dia))
      .slice(-21)
      .map((x) => ({
        dia: x.dia,
        oportunidadeMin: Math.round(x.oportunidadeMin),
        capturadoMin: Math.round(x.capturadoMin),
      })),
  };
}

/* ------------------------------ leitura paginada -------------------------- */

// `lerTudoDP360` pagina de 1.000 em 1.000 (teto do próprio helper). Uma
// competência da `ponto_diario` tem ~13 mil linhas — seriam 13 idas ao gateway.
// A Edge Function aceita até 5.000 por página (LIMITE_MAX), então aqui a
// paginação é própria. `ordem` é obrigatória: sem ordenação estável o
// offset devolve linha repetida e some com outra.
async function lerPaginado(tabela, opcoes, maxPaginas = 12, passo = 5000) {
  const todas = [];
  for (let pagina = 0; pagina < maxPaginas; pagina += 1) {
    // eslint-disable-next-line no-await-in-loop
    const bloco = await lerDP360(tabela, { ...opcoes, limite: passo, offset: pagina * passo });
    todas.push(...bloco);
    if (bloco.length < passo) break;
  }
  return todas;
}

/**
 * Reservas LANÇADAS no INOVE no período, indexadas por crachá|dia — a entrada da
 * camada 2 (`camadaReservaInove`). Mesma leitura da aba Gordura
 * (abas/Gordura.jsx `lerReservasInove`), só que por PERÍODO em vez de por dia, e
 * paginada: o PostgREST corta em 1.000 linhas por resposta e uma competência tem
 * dezenas de reservas por dia.
 *
 * Ordem crescente de `atualizado_em` + "o último vence" deixa no mapa a reserva
 * MAIS RECENTE de cada dia — mesmo critério do pop-up do app antigo.
 *
 * DEGRADAÇÃO: se a tabela não existir, a RLS negar ou a rede cair, devolve vazio e
 * a tela segue SEM a camada, igual ao try/except do original (main.py:4851-4856).
 */
async function lerReservasDoPeriodo(ini, fim) {
  const mapa = new Map();
  const passo = 1000;
  try {
    for (let pagina = 0; pagina < 20; pagina += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await supabase
        .from("reservas_motoristas")
        .select("funcionario_cracha,data_referencia,hora_entrada,hora_saida,cobertura,atualizado_em")
        .gte("data_referencia", ini)
        .lte("data_referencia", fim)
        .order("atualizado_em", { ascending: true, nullsFirst: true })
        .range(pagina * passo, (pagina + 1) * passo - 1);
      if (error) throw error;
      (data || []).forEach((r) => {
        if (!txt(r.funcionario_cracha)) return; // sem crachá não há como casar
        mapa.set(chaveDe(r.funcionario_cracha, r.data_referencia), r);
      });
      if (!data || data.length < passo) break;
    }
    return mapa;
  } catch {
    return new Map();
  }
}

/* ================================ componente ============================== */

export default function DP360Resumo() {
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360-resumo", profileMap);

  const [competencias, setCompetencias] = useState([]);
  const [competencia, setCompetencia] = useState("");
  const [valorHora, setValorHora] = useState(0);
  const [linhas, setLinhas] = useState([]);
  const [casos, setCasos] = useState([]);
  const [carregandoBase, setCarregandoBase] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoCasos, setAvisoCasos] = useState("");
  const [recarga, setRecarga] = useState(0);

  // Oportunidade (gordura): estado PRÓPRIO e leitura própria. É a parte mais cara
  // da tela (~10 mil linhas de `ponto_gordura` na competência, mais linha 99 e as
  // reservas do INOVE) e a única que depende de outra base — se ela demorar ou
  // falhar, o resto do Resumo continua de pé. `null` = ainda não veio / não deu:
  // LEITURA QUE FALHA NÃO É ZERO (main.py:3995-4001) — a caixa some ou avisa, nunca
  // finge fila vazia.
  const [gorduraBruta, setGorduraBruta] = useState(null);
  const [com99, setCom99] = useState(() => new Set());
  const [reservas, setReservas] = useState(() => new Map());
  const [carregandoGordura, setCarregandoGordura] = useState(false);
  const [avisoGordura, setAvisoGordura] = useState("");

  // filtros do Gerencial (app.js: gerFiltro / gerCat / gerTermo)
  const [filtro, setFiltro] = useState("grave");
  const [categoria, setCategoria] = useState("");
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState("");
  const [painel, setPainel] = useState(null);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  // Base: primeira e última data da `ponto_diario` (duas leituras de 1 linha) e
  // o valor da hora do motorista. A lista de competências sai daí.
  useEffect(() => {
    if (!podeAcessar) return undefined;
    let vivo = true;
    setCarregandoBase(true);
    setErro("");
    (async () => {
      try {
        const [maisNovo, maisAntigo] = await Promise.all([
          lerDP360("ponto_diario", { colunas: "date_ref", ordem: "date_ref.desc", limite: 1 }),
          lerDP360("ponto_diario", { colunas: "date_ref", ordem: "date_ref.asc", limite: 1 }),
        ]);
        if (!vivo) return;
        const lista = competenciasEntre(maisAntigo?.[0]?.date_ref, maisNovo?.[0]?.date_ref);
        setCompetencias(lista);
        // main.py `get_gerencial`: a mais recente costuma estar EM ANDAMENTO —
        // o padrão é a última já fechada.
        setCompetencia((atual) => (atual && lista.includes(atual) ? atual : lista[1] || lista[0] || ""));

        // Valor da hora (main.py `set_valor_hora` grava em app_config). Só serve
        // pra converter captura em dinheiro; se falhar, a tela segue sem o card.
        try {
          const cfg = await lerDP360("app_config", {
            colunas: "chave,valor",
            filtros: { chave: "eq.valor_hora_motorista" },
            limite: 1,
          });
          if (vivo) setValorHora(num(cfg?.[0]?.valor));
        } catch {
          if (vivo) setValorHora(0);
        }
      } catch (falha) {
        if (vivo) setErro(falha?.message || "Falha ao consultar a base DP360.");
      } finally {
        if (vivo) setCarregandoBase(false);
      }
    })();
    return () => { vivo = false; };
  }, [podeAcessar, recarga]);

  // Competência escolhida: ponto (Gerencial + baldes) e casos (esteira).
  useEffect(() => {
    if (!competencia) return undefined;
    const [ini, fim] = periodoDaCompetencia(competencia);
    if (!ini || !fim) return undefined;
    let vivo = true;
    setCarregando(true);
    setAberto("");
    setPainel(null);
    (async () => {
      try {
        const ponto = await lerPaginado("ponto_diario", {
          colunas: COLUNAS_PONTO,
          filtros: { date_ref: [`gte.${ini}`, `lte.${fim}`] },
          ordem: "date_ref,cracha",
        });
        if (!vivo) return;
        setLinhas(ponto);
        setErro("");

        // `ponto_caso` é pequena e muda a cada decisão do DP: sem colunas fixas
        // (`select=*`), porque `captura_min`/`captura_tipo` são colunas novas e
        // pedir uma que ainda não existe devolveria HTTP 400.
        try {
          const lidos = await lerTudoDP360(
            "ponto_caso",
            { filtros: { date_ref: [`gte.${ini}`, `lte.${fim}`] }, ordem: "date_ref" },
            10,
          );
          if (!vivo) return;
          setCasos(lidos);
          setAvisoCasos("");
        } catch (falhaCaso) {
          if (!vivo) return;
          setCasos([]);
          setAvisoCasos(falhaCaso?.message || "Não deu pra ler o ciclo dos avisos (ponto_caso).");
        }
      } catch (falha) {
        if (vivo) { setLinhas([]); setErro(falha?.message || "Falha ao consultar a base DP360."); }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [competencia, recarga]);

  // Competência escolhida, parte da OPORTUNIDADE: a gordura crua, a marcação da
  // linha 99 e as reservas lançadas no INOVE. Efeito separado de propósito (ver o
  // comentário do estado): esta leitura é a cara e a que depende de outra base.
  useEffect(() => {
    if (!competencia) return undefined;
    const [ini, fim] = periodoDaCompetencia(competencia);
    if (!ini || !fim) return undefined;
    let vivo = true;
    setCarregandoGordura(true);
    setGorduraBruta(null);
    setAvisoGordura("");
    (async () => {
      try {
        const [gordura, linha99, res] = await Promise.all([
          lerPaginado("ponto_gordura", {
            colunas: COLUNAS_GORDURA,
            filtros: { data_ref: [`gte.${ini}`, `lte.${fim}`] },
            ordem: "data_ref,cracha",
          }),
          // A linha 99 é um enriquecimento: sem ela a camada 1 não roda, mas a
          // oportunidade continua de pé (é o mesmo try/except de main.py:4726).
          lerPaginado("ponto_linha99", {
            colunas: COLUNAS_LINHA99,
            filtros: { data_ref: [`gte.${ini}`, `lte.${fim}`] },
            ordem: "data_ref,cracha",
          }).catch(() => []),
          lerReservasDoPeriodo(ini, fim), // já degrada sozinha
        ]);
        if (!vivo) return;
        setCom99(new Set(linha99.map((x) => chaveDe(x.cracha, x.data_ref))));
        setReservas(res);
        setGorduraBruta(gordura);
      } catch (falha) {
        if (!vivo) return;
        setGorduraBruta(null);
        setAvisoGordura(
          falha?.message || "Não deu pra ler a gordura da competência (ponto_gordura).",
        );
      } finally {
        if (vivo) setCarregandoGordura(false);
      }
    })();
    return () => { vivo = false; };
  }, [competencia, recarga]);

  const gerencial = useMemo(() => apurarGerencial(linhas), [linhas]);
  const baldes = useMemo(() => apurarBaldes(linhas), [linhas]);
  const captura = useMemo(() => apurarCaptura(casos), [casos]);

  // O alvo publicado pela Revisão (camada 4) vem da `ponto_diario`, que é do OUTRO
  // efeito — por isso as camadas são aplicadas aqui, e não na leitura: assim não
  // importa qual das duas respostas chega primeiro.
  const pontoPorChave = useMemo(() => {
    const m = new Map();
    linhas.forEach((r) => m.set(chaveDe(r.cracha, r.date_ref), r));
    return m;
  }, [linhas]);

  const gorduras = useMemo(() => {
    // Sem o ponto do dia a camada 4 cairia na conta local e mostraria outro alvo:
    // espera as duas leituras antes de calcular (nada é desenhado nesse meio-tempo).
    if (!gorduraBruta || !linhas.length) return null;
    return gorduraBruta.map((bruta) => aplicarCamadasGordura(bruta, {
      com99,
      reservas,
      pontoDiario: pontoPorChave.get(chaveDe(bruta.cracha, bruta.data_ref)),
    }));
  }, [gorduraBruta, linhas.length, com99, reservas, pontoPorChave]);

  const oportunidade = useMemo(
    () => (gorduras ? apurarOportunidade(gorduras, casos) : null),
    [gorduras, casos],
  );

  const pessoasVisiveis = useMemo(() => {
    let ls = gerencial.pessoas;
    if (categoria) ls = ls.filter((p) => p.categoria === categoria);
    if (termo) {
      const q = termo.toLowerCase();
      ls = ls.filter((p) => p.nome.toLowerCase().includes(q) || p.cracha.includes(q));
    }
    if (filtro === "grave") ls = ls.filter((p) => p.muitoGrave);
    else if (filtro === "recorrente") ls = ls.filter((p) => p.recorrente);
    return ls;
  }, [gerencial.pessoas, categoria, termo, filtro]);

  const { ciclo, economizado } = captura;
  const urgente = ["vencido", "advertido"].reduce(
    (s, id) => s + (captura.caixas[id]?.min || 0), 0,
  );
  const urgenteDias = ["vencido", "advertido"].reduce(
    (s, id) => s + (captura.caixas[id]?.qtd || 0), 0,
  );
  const taxaResposta = pct(ciclo.respondidos, ciclo.avisados);
  const taxaCorrecao = pct(ciclo.corrigidos, ciclo.avisados);

  // app.js `viewDash`: HORAS ABERTAS = o que ainda não foi encerrado — o que nunca
  // virou aviso + o avisado no prazo + o vencido + o advertido. É o número do topo
  // do Radar e a base do "potencial aberto" em R$. Sem a gordura lida, `faltam`
  // não entra e o card não é desenhado (em vez de mostrar um total menor).
  const faltam = oportunidade?.faltam || null;
  const abertoMin = faltam
    ? faltam.min + ["aguardando", "vencido", "advertido"].reduce(
      (s, id) => s + (captura.caixas[id]?.min || 0), 0,
    )
    : 0;

  const abrirCaixa = (caixa) => {
    const def = CAIXAS.find((c) => c.id === caixa);
    const dados = captura.caixas[caixa];
    if (!def || !dados?.qtd) return;
    setPainel({
      tipo: "caso",
      titulo: def.rot,
      ajuda: def.ajuda,
      resumo: `${dados.qtd} dia(s) · ${dados.pessoas} pessoa(s) · ${hhmm(dados.min)}`,
      itens: dados.itens,
    });
  };

  const abrirFaltam = () => {
    if (!faltam?.qtd) return;
    setPainel({
      tipo: "caso",
      titulo: CAIXA_FALTAM.rot,
      ajuda: CAIXA_FALTAM.ajuda,
      resumo: `${faltam.qtd} dia(s) · ${faltam.pessoas} pessoa(s) · ${hhmm(faltam.min)}`
        + (faltam.ruidoMin ? ` · ${hhmm(faltam.ruidoMin)} de dia de reserva ficaram de fora` : ""),
      itens: faltam.itens,
    });
  };

  // A esteira desenha `faltam` NA FRENTE das caixas do caso — a mesma ordem do
  // painel original, que vai do "ainda não entrou no fluxo" até o "ponto fechado".
  const placas = [
    {
      ...CAIXA_FALTAM,
      qtd: faltam?.qtd || 0,
      min: faltam?.min || 0,
      indisponivel: !faltam,
      abrir: abrirFaltam,
    },
    ...CAIXAS.map((c) => ({
      ...c,
      qtd: captura.caixas[c.id]?.qtd || 0,
      min: captura.caixas[c.id]?.min || 0,
      indisponivel: false,
      abrir: () => abrirCaixa(c.id),
    })),
  ];

  const abrirBalde = (catId, catLabel, metrica, metricaLabel) => {
    const itens = itensDoBalde(linhas, catId, metrica);
    if (!itens.length) return;
    setPainel({
      tipo: "ponto",
      titulo: `${metricaLabel} · ${catLabel}`,
      ajuda: `Dias de ${catLabel.toLowerCase()} classificados como "${metricaLabel.toLowerCase()}" na ${nomeCompetencia(competencia).toLowerCase()}.`,
      resumo: `${itens.length} dia(s) · ${new Set(itens.map((i) => i.cracha)).size} pessoa(s)`,
      itens,
    });
  };

  if (!podeAcessar) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto text-amber-700" size={30} />
        <h1 className="mt-3 text-xl font-black text-slate-900">Sem acesso à DP360</h1>
        <p className="mt-2 text-sm text-slate-700">
          Peça ao administrador para liberar o cluster DP360 no seu perfil do INOVE.
        </p>
      </div>
    );
  }

  const ocupado = carregandoBase || carregando;
  const semDados = !ocupado && !erro && !linhas.length;

  return (
    <div className="dp360 -m-4 sm:-m-6">
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">DP</div>
          <div>
            <div className="dp-brand-title">Resumo</div>
            <div className="dp-brand-sub">
              Gerencial de ponto + painel de captura, na mesma competência
            </div>
          </div>
        </div>
      </div>

      <div className="dp-viewbar">
        <select
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          disabled={!competencias.length}
          aria-label="Competência"
        >
          {competencias.length
            ? competencias.map((c) => (
              <option key={c} value={c}>{nomeCompetencia(c)}</option>
            ))
            : <option value="">Sem competências</option>}
        </select>
        <button type="button" className="dp-btn" onClick={recarregar} disabled={ocupado}>
          <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          Recarregar
        </button>
        <span className="dp-faint" style={{ marginLeft: "auto", fontSize: 12 }}>
          somente leitura · a competência vai do dia 20 ao 19
        </span>
      </div>

      {erro && (
        <div className="dp-resumo"><span className="dp-pill danger">{erro}</span></div>
      )}
      {!erro && avisoCasos && (
        <div className="dp-resumo"><span className="dp-pill warn">{avisoCasos}</span></div>
      )}
      {!erro && avisoGordura && (
        <div className="dp-resumo">
          <span className="dp-pill warn">
            {avisoGordura} — a oportunidade e a caixa &quot;ainda não avisados&quot; ficam de fora
            até a próxima leitura.
          </span>
        </div>
      )}

      {ocupado && <div className="dp-resumo">Carregando dados da base DP360…</div>}

      {semDados && (
        <div style={{ padding: "0 20px 20px" }}>
          <div className="dp-vazio">Sem dias de ponto nesta competência.</div>
        </div>
      )}

      {!ocupado && !erro && !!linhas.length && (
        <>
          {/* ---------------- cartões de indicador (topo) ------------------ */}
          <div style={{ padding: "14px 20px 4px", display: "grid", gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <Cartao rotulo="Dias com cartão" valor={gerencial.kpis.diasPeriodo}
              nota="linhas de ponto na competência" />
            <Cartao rotulo="Dias errados (P1)" valor={gerencial.kpis.diasErrados}
              nota="sem almoço curto/longo" tom="warn" />
            <Cartao rotulo="Pessoas com erro" valor={gerencial.kpis.pessoasErro}
              nota="com pelo menos um dia errado" />
            <Cartao rotulo="Pessoas muito graves" valor={gerencial.kpis.pessoasGrave}
              nota="sinal grave ou 3+ dias errados" tom="danger" />
            <Cartao rotulo="Ação agora" valor={urgenteDias}
              nota={`${hhmm(urgente)} vencidas ou advertidas`} tom="warn" />
            <Cartao rotulo="Gordura corrigida" valor={hhmm(economizado.liquidoMin)}
              nota={`${economizado.casos} cartão(ões) com correção confirmada`} tom="ok" />
            <Cartao rotulo="Resposta aos avisos" valor={`${taxaResposta}%`}
              nota={`${ciclo.respondidos} de ${ciclo.avisados} avisados deram retorno`} />
            <Cartao rotulo="Correções no Transnet" valor={ciclo.corrigidos}
              nota={`${taxaCorrecao}% dos avisos de gordura`} tom="ok" />
            {valorHora > 0 && (
              <Cartao
                rotulo="Valor gerencial"
                valor={brl((economizado.liquidoMin / 60) * valorHora)}
                nota={`hora a ${brl(valorHora)} · só o saldo líquido confirmado`}
                tom="ok"
              />
            )}
            {/* Os quatro do Radar de captura (app.js `viewDash`). Só aparecem com a
                gordura em mãos: o total de horas abertas conta a caixa `faltam`, e
                mostrar a soma sem ela seria um número menor sem avisar. */}
            {oportunidade && (
              <>
                <Cartao rotulo="Horas abertas" valor={hhmm(abertoMin)}
                  nota="potencial ainda não encerrado (sem aviso + em fluxo)" tom="warn" />
                <Cartao rotulo="P1 oficial" valor={hmDeHoras(horas1(oportunidade.oficialMin))}
                  nota={`${oportunidade.pessoasP1} pessoa(s) com P1 · o único número cobrável`} />
                <Cartao rotulo="Ainda sem aviso" valor={faltam.qtd}
                  nota={`${hhmm(faltam.min)} · oportunidade que não entrou no fluxo`} />
                {valorHora > 0 && (
                  <Cartao
                    rotulo="Potencial aberto"
                    valor={brl((abertoMin / 60) * valorHora)}
                    nota={`horas abertas × ${brl(valorHora)} · a captura usa só o líquido confirmado`}
                    tom="warn"
                  />
                )}
              </>
            )}
          </div>

          {/* ---------------- esteira de captura (gordura + ponto_caso) ---- */}
          <Secao
            titulo="Esteira de captura"
            tag="clique na placa para abrir a lista"
            rodape={
              "A esteira separa o que ainda é potencial (nunca avisado), o que exige ação "
              + "agora e o que já foi comprovado no Transnet. Só entra caso com origem "
              + "`gordura`: correção de revisão ou refeição fecha cartão, mas não é hora de "
              + "gordura recuperada."
            }
          >
            <div style={{ display: "grid", gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(215px, 1fr))" }}>
              {placas.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="dp-card"
                  onClick={c.abrir}
                  disabled={!c.qtd}
                  title={c.indisponivel ? `${c.ajuda} — não deu pra contar agora.` : c.ajuda}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left",
                    font: "inherit", cursor: c.qtd ? "pointer" : "default",
                    opacity: c.qtd ? 1 : 0.55,
                  }}
                >
                  <span className="dp-num" style={{ fontSize: 24, fontWeight: 700, minWidth: 44 }}>
                    {/* LEITURA QUE FALHA NÃO É ZERO: a caixa que não deu pra contar
                        mostra "—" e não uma fila vazia (main.py:3995-4001). */}
                    {c.indisponivel ? "—" : c.qtd}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ display: "block", fontSize: 12.5 }}>{c.rot}</b>
                    <span className="dp-faint" style={{ fontSize: 11 }}>
                      {c.min ? hhmm(c.min) : "—"}
                    </span>
                  </span>
                  <span className={`dp-pill ${c.tom}`}>{c.id}</span>
                </button>
              ))}
            </div>

            <div style={{ marginTop: 12 }}>
              <BarraProporcao
                partes={placas.map((c) => ({
                  id: c.id,
                  rotulo: c.rot,
                  valor: c.qtd,
                  cor: {
                    ok: "var(--dp-ok-ink)", warn: "var(--dp-warn-ink)",
                    danger: "var(--dp-danger-ink)", accent: "var(--dp-accent)",
                    mute: "var(--dp-faint)", res: "var(--dp-res-ink)",
                  }[c.tom],
                }))}
              />
            </div>

            <div className="dp-det-foot">
              Ciclo do aviso na competência: <b>{ciclo.avisados}</b> avisados ·{" "}
              <b>{ciclo.respondidos}</b> responderam · <b>{ciclo.executados}</b> conferidos no
              Transnet · <b>{ciclo.advertidos}</b> advertidos · <b>{ciclo.corrigidos}</b> corrigidos.
              {economizado.devolvidoMin > 0 && (
                <> Devolvido (cartão estava a menos): <b>{hhmm(economizado.devolvidoMin)}</b>.</>
              )}
              {faltam?.ruidoMin > 0 && (
                <>
                  {" "}
                  Fora de &quot;ainda não avisados&quot;: <b>{hhmm(faltam.ruidoMin)}</b> de dias
                  marcados como reserva — standby não produz gordura cobrável, e o número fica
                  aqui para ninguém achar que sumiu.
                </>
              )}
            </div>
          </Secao>

          {/* ------- oportunidade de gordura (ponto_gordura + 4 camadas) --- */}
          <Secao
            titulo="Oportunidade de gordura"
            tag={oportunidade
              ? `${oportunidade.diasBase} dia(s)-pessoa medidos · só motorista`
              : "gordura de ponto"}
            rodape={
              "Gordura = tempo que o motorista bateu ponto a mais do que operou, medido só "
              + "nas PONTAS. O número sai da `ponto_gordura` DEPOIS das quatro camadas do DP "
              + "(linha 99 · reserva lançada · reserva por GPS · alvo da Revisão), a mesma "
              + "régua da aba Gordura — por isso bate com ela. Só P1 é cobrável; P2/P3/P4 "
              + "ficam no radar, rotulados."
            }
          >
            {!oportunidade ? (
              <div className="dp-vazio">
                {carregandoGordura
                  ? "Carregando a gordura da competência…"
                  : (avisoGordura || "Sem gordura calculada nesta competência.")}
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                  {/* qualidade: quanto de cada nível P */}
                  <div className="dp-card">
                    <div className="dp-muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
                      Qualidade da oportunidade · P1 é prioridade
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gap: 7 }}>
                      {oportunidade.porP.map((p) => (
                        <BarraNivel
                          key={p.cod}
                          rotulo={p.rot}
                          nota={`${p.pontas} ponta(s) · ${pct(p.pontas, oportunidade.pontasTotal)}%`}
                          valor={hmDeHoras(p.horas)}
                          fracao={p.horas / Math.max(...oportunidade.porP.map((x) => x.horas), 1)}
                          cor={COR_NIVEL[p.cod]}
                        />
                      ))}
                    </div>
                    <div className="dp-faint" style={{ fontSize: 11.5, marginTop: 8 }}>
                      Total nos cinco níveis: <b>{hmDeHoras(horas1(oportunidade.totalMin))}</b> ·
                      conta a ponta acima de {PORTA_GORDURA} min.
                    </div>
                  </div>

                  {/* onde está o desvio P1: entrada × saída */}
                  <div className="dp-card">
                    <div className="dp-muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
                      Onde está o desvio P1
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <BarraProporcao
                        partes={[
                          { id: "entrada", rotulo: "Entrada",
                            valor: Math.round(oportunidade.porPonta.entradaMin),
                            cor: "var(--dp-accent)" },
                          { id: "saida", rotulo: "Saída",
                            valor: Math.round(oportunidade.porPonta.saidaMin),
                            cor: "var(--dp-warn-ink)" },
                        ]}
                      />
                    </div>
                    <div style={{ marginTop: 10, display: "flex", gap: 18 }}>
                      <div>
                        <div className="dp-muted" style={{ fontSize: 11.5 }}>Entrada</div>
                        <div className="dp-num" style={{ fontSize: 20, fontWeight: 700 }}>
                          {hmDeHoras(horas1(oportunidade.porPonta.entradaMin))}
                        </div>
                      </div>
                      <div>
                        <div className="dp-muted" style={{ fontSize: 11.5 }}>Saída</div>
                        <div className="dp-num" style={{ fontSize: 20, fontWeight: 700 }}>
                          {hmDeHoras(horas1(oportunidade.porPonta.saidaMin))}
                        </div>
                      </div>
                    </div>
                    <div className="dp-faint" style={{ fontSize: 11.5, marginTop: 8 }}>
                      As pontas são independentes: uma saída P1 conta mesmo com a entrada dentro
                      da tolerância. É a ponta que concentra o desvio que diz onde ler
                      comportamento.
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
                  {/* concentração por pessoa (top ofensores) */}
                  <div className="dp-card">
                    <div className="dp-muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
                      Concentração por pessoa · top {Math.min(6, oportunidade.top.length)}
                    </div>
                    <div style={{ marginTop: 8, display: "grid", gap: 7 }}>
                      {oportunidade.top.slice(0, 6).map((t, i) => (
                        <BarraNivel
                          key={`${t.nome}-${i}`}
                          rotulo={`${i + 1}. ${t.nome || "—"}`}
                          nota={`${t.dias} dia(s) · média ${hmDeHoras(t.horas / Math.max(1, t.dias))}/dia`}
                          valor={hmDeHoras(t.horas)}
                          fracao={t.horas / Math.max(...oportunidade.top.map((x) => x.horas), 1)}
                          cor="var(--dp-danger-ink)"
                        />
                      ))}
                      {!oportunidade.top.length && (
                        <span className="dp-faint">Sem gordura P1 nesta competência.</span>
                      )}
                    </div>
                  </div>

                  {/* série diária: oportunidade P1 × gordura corrigida */}
                  <div className="dp-card">
                    <div className="dp-muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
                      Gordura P1 corrigida × oportunidade identificada
                    </div>
                    <SerieDiaria dias={oportunidade.serieDiaria.slice(-14)} />
                  </div>
                </div>
              </>
            )}
          </Secao>

          {/* ---------------- baldes por categoria (ponto_diario) ---------- */}
          <Secao
            titulo="Resumo do ponto por categoria"
            tag="clique no número para ver as ocorrências"
            rodape={
              "Mesmos baldes do painel original (corretos / incorretos / ponto sem operação / "
              + "justificado / sem ponto), contados na janela da competência em vez do mês "
              + "de calendário — a página inteira usa um recorte só."
            }
          >
            <div className="dp-tabela-wrap">
              <table className="dp-tabela">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    {METRICAS.map(([id, rot]) => (
                      <th key={id} style={{ textAlign: "right" }}>{rot}</th>
                    ))}
                    <th style={{ textAlign: "right" }}>Total</th>
                    <th style={{ width: 190 }}>Distribuição</th>
                  </tr>
                </thead>
                <tbody>
                  {DASH_CATS.map(([catId, catLabel]) => {
                    const v = baldes[catId] || {};
                    const total = METRICAS.reduce((s, [id]) => s + (v[id] || 0), 0);
                    return (
                      <tr key={catId}>
                        <td><b>{catLabel}</b></td>
                        {METRICAS.map(([id, rot]) => (
                          <td key={id} style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="dp-num"
                              onClick={() => abrirBalde(catId, catLabel, id, rot)}
                              disabled={!v[id]}
                              title={v[id] ? "ver ocorrências" : "nada neste grupo"}
                              style={{
                                border: 0, background: "transparent", font: "inherit", padding: 0,
                                cursor: v[id] ? "pointer" : "default",
                                color: v[id] ? "var(--dp-accent)" : "var(--dp-faint)",
                              }}
                            >
                              {v[id] || 0}
                            </button>
                          </td>
                        ))}
                        <td className="dp-num" style={{ textAlign: "right" }}><b>{total}</b></td>
                        <td>
                          <BarraProporcao
                            compacta
                            partes={METRICAS.map(([id, rot, cor]) => ({
                              id, rotulo: rot, valor: v[id] || 0, cor,
                            }))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Secao>

          {/* ---------------- gerencial: quem está incorreto --------------- */}
          <Secao
            titulo="Gerencial de ponto"
            tag={`${pessoasVisiveis.length} ${pessoasVisiveis.length === 1 ? "pessoa" : "pessoas"}`}
            rodape={
              "Muito grave: bateu e não operou · cartão não fecha · jornada suspeita/inválida/>13h · "
              + "ou 3+ dias errados no período pra mesma pessoa. Folga, férias, atestado e "
              + "afastamento não entram."
            }
          >
            <div className="dp-viewbar" style={{ padding: "0 0 12px", background: "transparent", border: 0 }}>
              <label className="dp-busca">
                <Search size={14} />
                <input
                  type="text"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value.trim())}
                  placeholder="Buscar por nome ou chapa…"
                  autoComplete="off"
                />
              </label>
              <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Função">
                <option value="">Toda função</option>
                {DASH_CATS.map(([id, rot]) => (
                  <option key={id} value={id}>{rot}</option>
                ))}
              </select>
              {[["grave", "Muito grave"], ["todos", "Todos"], ["recorrente", "Recorrente"]].map(([id, rot]) => (
                <button
                  key={id}
                  type="button"
                  className={`dp-chip-f${filtro === id ? " on" : ""}`}
                  onClick={() => setFiltro(id)}
                >
                  {rot}
                </button>
              ))}
            </div>

            {pessoasVisiveis.length ? (
              <div className="dp-tabela-wrap">
                <table className="dp-tabela">
                  <thead>
                    <tr>
                      <th style={{ width: 26 }} aria-label="abrir" />
                      <th>Colaborador</th>
                      <th>Função</th>
                      <th>Sinais</th>
                      <th style={{ textAlign: "right", width: 92 }}>Dias errados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoasVisiveis.map((p) => {
                      const chave = `${p.cracha}|${p.nome}`;
                      const expandido = aberto === chave;
                      return [
                        <tr
                          key={chave}
                          className={p.muitoGrave ? "row-p1" : undefined}
                          onClick={() => setAberto(expandido ? "" : chave)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <ChevronRight
                              size={14}
                              style={{
                                transform: expandido ? "rotate(90deg)" : "none",
                                transition: "transform .15s",
                                color: "var(--dp-muted)",
                              }}
                            />
                          </td>
                          <td>
                            <b>{p.nome || "—"}</b>
                            <div className="dp-faint dp-mono" style={{ fontSize: 11 }}>{p.cracha}</div>
                          </td>
                          <td className="dp-muted">{p.funcao || p.categoria || "—"}</td>
                          <td>
                            {p.tags.map((t) => (
                              <span key={t} className="dp-pill danger" style={{ marginRight: 4 }}>
                                {GER_TAG[t] || t}
                              </span>
                            ))}
                            {p.recorrente && (
                              <span className="dp-pill warn">recorrente · {p.nDias} dias</span>
                            )}
                            {!p.tags.length && !p.recorrente && <span className="dp-faint">—</span>}
                          </td>
                          <td className="dp-num" style={{ textAlign: "right" }}><b>{p.nDias}</b></td>
                        </tr>,
                        expandido ? (
                          <tr key={`${chave}-dias`}>
                            <td colSpan={5} style={{ background: "var(--dp-surface-2)" }}>
                              <table className="dp-tabela" style={{ background: "transparent" }}>
                                <thead>
                                  <tr>
                                    <th style={{ width: 60 }}>Dia</th>
                                    <th>Motivo</th>
                                    <th style={{ width: 90 }}>Jornada</th>
                                    <th>Cartão</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.dias.map((d, i) => (
                                    <tr key={`${d.data}-${d.motivo}-${i}`}>
                                      <td className="dp-num">{fmtDia(d.data)}</td>
                                      <td>
                                        {d.grave && (
                                          <span
                                            aria-hidden
                                            style={{
                                              display: "inline-block", width: 6, height: 6,
                                              borderRadius: "50%", marginRight: 6,
                                              background: "var(--dp-danger-ink)",
                                            }}
                                          />
                                        )}
                                        {GER_MOTIVO[d.motivo] || d.motivo || "—"}
                                      </td>
                                      <td className="dp-num">{fmtJornada(d.jornada)}</td>
                                      <td className="dp-mono">
                                        {d.batidas.replace(/\s*\|\s*/g, " · ").replace(/^[ES]/, "") || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null,
                      ];
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dp-vazio">Nenhum caso bate com esse filtro.</div>
            )}
          </Secao>
        </>
      )}

      {painel && <PainelDetalhe painel={painel} onFechar={() => setPainel(null)} />}
    </div>
  );
}

/* ------------------------------- peças da tela ---------------------------- */

function Cartao({ rotulo, valor, nota, tom }) {
  const cor = {
    ok: "var(--dp-ok-ink)",
    warn: "var(--dp-warn-ink)",
    danger: "var(--dp-danger-ink)",
  }[tom] || "var(--dp-ink)";
  return (
    <div className="dp-card">
      <div className="dp-muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: ".02em" }}>
        {rotulo}
      </div>
      <div className="dp-num" style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.25, color: cor }}>
        {valor}
      </div>
      {nota && <div className="dp-faint" style={{ fontSize: 11.5 }}>{nota}</div>}
    </div>
  );
}

function Secao({ titulo, tag, rodape, children }) {
  return (
    <section style={{ padding: "14px 20px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>{titulo}</h2>
        {tag && <span className="dp-faint" style={{ fontSize: 11.5 }}>{tag}</span>}
      </div>
      {children}
      {rodape && <div className="dp-det-foot" style={{ marginBottom: 4 }}>{rodape}</div>}
    </section>
  );
}

// Barra de proporção feita com div e largura percentual (sem biblioteca de gráfico).
function BarraProporcao({ partes, compacta }) {
  const total = partes.reduce((s, p) => s + (p.valor || 0), 0);
  if (!total) return <span className="dp-faint" style={{ fontSize: 11.5 }}>—</span>;
  return (
    <div>
      <div
        style={{
          display: "flex", height: compacta ? 8 : 12, borderRadius: 6,
          overflow: "hidden", background: "var(--dp-surface-2)",
        }}
      >
        {partes.filter((p) => p.valor > 0).map((p) => (
          <div
            key={p.id}
            title={`${p.rotulo}: ${p.valor} (${pct(p.valor, total)}%)`}
            style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }}
          />
        ))}
      </div>
      {!compacta && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 7 }}>
          {partes.filter((p) => p.valor > 0).map((p) => (
            <span key={p.id} className="dp-muted" style={{ fontSize: 11.5 }}>
              <i
                style={{
                  display: "inline-block", width: 8, height: 8, borderRadius: 2,
                  background: p.cor, marginRight: 5,
                }}
              />
              {p.rotulo} <b className="dp-num">{p.valor}</b> · {pct(p.valor, total)}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Uma linha de barra horizontal (app.js `.dbar-row`): rótulo + trilho + valor.
   Serve tanto para o nível P quanto para o top de ofensores. */
function BarraNivel({ rotulo, nota, valor, fracao, cor }) {
  const largura = Math.max(1.5, Math.min(100, (Number.isFinite(fracao) ? fracao : 0) * 100));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 168, minWidth: 168 }}>
        <b style={{ fontSize: 12.5 }}>{rotulo}</b>
        <span className="dp-faint" style={{ display: "block", fontSize: 11 }}>{nota}</span>
      </span>
      <span style={{ flex: 1, minWidth: 40, height: 9, borderRadius: 6,
        background: "var(--dp-surface-2)", overflow: "hidden" }}
      >
        <span style={{ display: "block", width: `${largura}%`, height: "100%", background: cor }} />
      </span>
      <span className="dp-num" style={{ width: 62, textAlign: "right", fontWeight: 700 }}>
        {valor}
      </span>
    </div>
  );
}

/* A SÉRIE DIÁRIA (app.js `.dtrend`): por dia, duas colunas — amarelo = oportunidade
   P1 identificada (a viva do dia, ou a congelada no aviso quando o dia já virou
   caso); verde = gordura P1 cuja correção foi CONFIRMADA no Transnet. O dia é o do
   PONTO, não o da execução, pra cada par comparar a mesma coisa. */
function SerieDiaria({ dias }) {
  const teto = Math.max(
    ...dias.map((d) => Math.max(d.oportunidadeMin || 0, d.capturadoMin || 0)), 1,
  );
  const somaOp = dias.reduce((s, d) => s + (d.oportunidadeMin || 0), 0);
  const somaCap = dias.reduce((s, d) => s + (d.capturadoMin || 0), 0);
  if (!dias.length) {
    return <div className="dp-vazio">Sem dias com oportunidade P1 nesta competência.</div>;
  }
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, margin: "8px 0 10px" }}>
        <span className="dp-muted" style={{ fontSize: 11.5 }}>
          <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2,
            background: "var(--dp-warn-ink)", marginRight: 5 }}
          />
          Oportunidade identificada <b className="dp-num">{hhmm(somaOp)}</b>
        </span>
        <span className="dp-muted" style={{ fontSize: 11.5 }}>
          <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2,
            background: "var(--dp-ok-ink)", marginRight: 5 }}
          />
          Gordura corrigida <b className="dp-num">{hhmm(somaCap)}</b>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 108 }}>
        {dias.map((d) => (
          <div
            key={d.dia}
            title={`${fmtDia(d.dia)} — oportunidade ${hhmm(d.oportunidadeMin)} · corrigida ${hhmm(d.capturadoMin)}`}
            style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
              alignItems: "center", gap: 4 }}
          >
            <span style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 2, width: "100%" }}>
              <i style={{ flex: 1, height: `${Math.max(0, ((d.oportunidadeMin || 0) / teto) * 100)}%`,
                background: "var(--dp-warn-ink)", borderRadius: "3px 3px 0 0" }}
              />
              <i style={{ flex: 1, height: `${Math.max(0, ((d.capturadoMin || 0) / teto) * 100)}%`,
                background: "var(--dp-ok-ink)", borderRadius: "3px 3px 0 0" }}
              />
            </span>
            <span className="dp-faint" style={{ fontSize: 10 }}>{fmtDia(d.dia)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* A LISTA ATRÁS DO NÚMERO (app.js `dashDetalhe`). Sem isto o painel só afirma:
   "3,6 h capturadas" não diz de quem, nem de que dia, nem se está certo — e
   número que não dá pra conferir ninguém usa pra decidir. */
function PainelDetalhe({ painel, onFechar }) {
  const visiveis = painel.itens.slice(0, LIMITE_LISTA);
  return (
    <div
      className="dp-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onFechar(); }}
    >
      <div className="dp-modal" style={{ width: 860, maxWidth: "96vw" }}>
        <div className="dp-modal-head">
          <h3>{painel.titulo}</h3>
          <button type="button" className="dp-det-x" onClick={onFechar} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <p className="dp-muted" style={{ margin: "8px 0 4px", fontSize: 12 }}>{painel.ajuda}</p>
        <div className="dp-resumo" style={{ padding: "0 0 10px" }}>{painel.resumo}</div>

        <div className="dp-tabela-wrap" style={{ maxHeight: "52vh" }}>
          <table className="dp-tabela">
            <thead>
              {painel.tipo === "caso" ? (
                <tr>
                  <th>Colaborador</th><th>Chapa</th><th>Dia</th>
                  <th style={{ textAlign: "right" }}>Minutos</th><th>Detalhe</th>
                </tr>
              ) : (
                <tr>
                  <th>Colaborador</th><th>Chapa</th><th>Dia</th>
                  <th>Motivo / lançamento</th><th>Batidas</th>
                </tr>
              )}
            </thead>
            <tbody>
              {visiveis.map((i, idx) => (
                <tr key={`${i.cracha}-${i.dia}-${idx}`}>
                  <td>{i.nome || "—"}</td>
                  <td className="dp-mono">{i.cracha || "—"}</td>
                  <td className="dp-num">{fmtDia(i.dia)}</td>
                  {painel.tipo === "caso" ? (
                    <>
                      <td className="dp-num" style={{ textAlign: "right" }}>{i.min || "—"}</td>
                      <td className="dp-muted">{i.detalhe || "—"}</td>
                    </>
                  ) : (
                    <>
                      <td className="dp-muted">{i.detalhe || "—"}</td>
                      <td className="dp-mono">{i.batidas || "—"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {painel.itens.length > visiveis.length && (
          <p className="dp-faint" style={{ marginTop: 8, fontSize: 11.5 }}>
            mostrando {visiveis.length} de {painel.itens.length} — refine pela competência
            ou pela função para ver o resto
          </p>
        )}
      </div>
    </div>
  );
}
