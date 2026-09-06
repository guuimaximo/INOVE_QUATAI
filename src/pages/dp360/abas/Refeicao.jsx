import { useCallback, useEffect, useMemo, useState } from "react";
import AbaShell from "./AbaShell";
import TabelaDP from "../TabelaDP";
import {
  dispararRoboDP360,
  inserirDP360,
  lerDP360,
  lerTudoDP360,
} from "../../../services/dp360Api";
import { hm2min, min2hm } from "../regrasPonto";

/* ═══════════════════════════════════════════════════════════════════════════
   Refeição (Passo 1 do DP360)

   Fonte única da GRADE: a tabela `ponto_intervalo` — snapshot da view
   `vw_ponto_intervalo_motorista_diario` (Athena). A REGRA de negócio é da view;
   a tela só a exibe.

   A grade continua SÓ LEITURA. O que sai daqui é o disparo do robô do ponto
   ("Gerar importação"), que é a única escrita desta aba e passa por confirmação
   explícita — ver o bloco "importação da refeição" mais abaixo.

   Aparência: a da FERRAMENTA (Sistemas/PONTO/app/ui, `viewP1`) — barra de
   filtros enxuta, tabela densa de 13px com cabeçalho grudado e a LINHA pintada
   pelo status. Quem usa passa o dia lendo linha: a cor da linha é informação.

   Régua (constantes espelhadas da view e de ferramenta/simulador.py — mexeu
   aqui, confira lá):
     · 27 min  → piso do que conta como refeição
     · 360 min → jornada (medida pelo Citatti) que dispensa intervalo
     · 10 min  → tolerância entre o cartão e a sugestão, comparando SÓ o início
     · 30 min  → janela fixa que a importação grava
   ═══════════════════════════════════════════════════════════════════════════ */

const MIN_ALMOCO = 27;
const JORNADA_EXIGE_ALMOCO = 360;
const TOLERANCIA_TRANSNET_MIN = 10;
const IMPORTACAO_JANELA_MIN = 30;

// Teto de linhas por chamada aceito pelo gateway (supabase/functions/dp360-api).
const PASSO_DATAS = 5000;

/* ─────────────────────────── formatação ─────────────────────────── */

const num = (valor) => {
  const n = parseFloat(valor);
  return Number.isNaN(n) ? null : n;
};

// A view entrega `data_ref` em ISO. No app antigo isso vazava cru para a tela.
function fmtData(valor) {
  const iso = String(valor ?? "").slice(0, 10);
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return valor ? String(valor) : "—";
  return `${partes[3]}/${partes[2]}/${partes[1]}`;
}

// Minutos → "7h32" (jornada é sempre lida em horas pelo DP).
function fmtMin(valor) {
  const n = num(valor);
  if (n == null || n <= 0) return "—";
  const total = Math.round(n);
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, "0")}`;
}

const fmtDur = (valor) => {
  const n = num(valor);
  return n == null ? "—" : `${Math.round(n)} min`;
};

const fmtHora = (valor) => {
  const texto = String(valor ?? "").trim();
  return texto || "—";
};

const semAcento = (texto) =>
  String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/* ─────────────────────── regra dos 27 minutos ───────────────────────
   Mesma de ferramenta/simulador.py::almoco_da_refeicao e de app.js::almocoRef.
   O CITATTI é a fonte principal. Abaixo de 27 min ele não pegou a refeição,
   pegou uma parada curta — aí vale o SST, que costuma trazer a janela certa
   (às vezes horas depois). Se nenhuma das duas alcança o piso, mostra o Citatti
   mesmo curto: vale o que a pessoa fez. */
function almocoRef(linha) {
  const citatti = num(linha.sugestao_duracao_min);
  const sst = num(linha.sugestao_sst_duracao_min);

  if (citatti != null && citatti >= MIN_ALMOCO) {
    return {
      ini: linha.sugestao_inicio,
      fim: linha.sugestao_fim,
      min: citatti,
      origem: "Citatti",
    };
  }
  if (sst != null && sst >= MIN_ALMOCO) {
    return {
      ini: linha.sugestao_sst_inicio,
      fim: linha.sugestao_sst_fim,
      min: sst,
      origem: "SST",
      detalhe:
        citatti == null
          ? "Sem Citatti nesse dia — usando SST"
          : `Citatti deu ${Math.round(citatti)} min (< ${MIN_ALMOCO}) — usando SST`,
    };
  }
  if (citatti != null) {
    return {
      ini: linha.sugestao_inicio,
      fim: linha.sugestao_fim,
      min: citatti,
      origem: "Citatti",
      detalhe: `Abaixo de ${MIN_ALMOCO} min e o SST também não alcança — vale o que ele fez`,
    };
  }
  return { ini: "", fim: "", min: null, origem: "" };
}

/* ─────────────────────────── status ───────────────────────────
   `status_almoco` vem da view. "DIVERGENTE" chega como
   "DIVERGENTE (transnet x sugestao)" — o casamento é por SUBSTRING. */
function chaveStatus(status) {
  const texto = String(status ?? "");
  if (texto.includes("DIVERGENTE")) return "DIV";
  return { SUGESTAO: "SUG", ABAIXO_27MIN: "AB", OK: "OK" }[texto] || "OUT";
}

// [rótulo curto, variante da pílula, classe da LINHA]
const ESTILO_STATUS = {
  OK: ["OK", "ok", "row-ok"],
  SUG: ["Sugestão", "warn", "row-sug"],
  DIV: ["Divergente", "warn", "row-sug"],
  AB: ["Abaixo 27min", "danger", "row-sem"],
  OUT: ["", "mute", ""],
};

function PilulaStatus({ status }) {
  const [rotulo, variante] = ESTILO_STATUS[chaveStatus(status)];
  return (
    <span className={`dp-pill ${variante}`} title={String(status ?? "") || "sem status"}>
      {rotulo || String(status ?? "") || "—"}
    </span>
  );
}

const classeLinha = (linha) => ESTILO_STATUS[chaveStatus(linha.status_almoco)][2];

/* ─────────────────────────── jornada ───────────────────────────
   A jornada do Passo 1 é a do CITATTI (operação), não a do ponto: o ponto é
   justamente o que está sendo auditado. O total do ponto entra só quando não
   há Citatti no dia — e aí aparece em cinza, para não ser lido como régua. */
function CelulaJornada({ linha }) {
  const citatti = num(linha.jornada_citatti_min);
  if (citatti != null) return <span className="dp-num">{fmtMin(citatti)}</span>;
  const ponto = num(linha.jornada_total_min);
  if (ponto == null) return <span className="dp-faint">—</span>;
  return (
    <span className="dp-faint dp-num" title="Sem Citatti nesse dia — jornada pelo ponto">
      {fmtMin(ponto)}
    </span>
  );
}

/* ─────────────────────────── colunas ───────────────────────────
   Formato do TabelaDP: `valor` é o que ORDENA e o que sai no CSV; `render` só
   desenha. Coluna calculada (realizado, importação, programado) SEM `valor`
   ordenaria pelo JSX — por isso todas trazem o par. Onde o `id` já é o campo da
   linha (`fonte`, `sugestao_origem`…) o `valor` fica de fora de propósito: a
   grade cai em `linha[id]`, que é exatamente o valor certo.

   Duas escolhas de `valor` que fogem do que aparece na tela:
     · HORA vai como texto cru ("12:34") — o `chaveOrd` da grade já entende hora,
       e é o mesmo que a pessoa lê; só o "—" do vazio é coisa do `render`.
     · DURAÇÃO vai como NÚMERO. "45 min" não casa com nenhum formato do
       `chaveOrd`, cairia no localeCompare e poria "100 min" antes de "45 min". */

const valorHora = (valor) => String(valor ?? "").trim();

const valorMin = (valor) => {
  const n = num(valor);
  return n == null ? "" : Math.round(n);
};

// Mesma régua da CelulaJornada: o Citatti manda, o ponto entra só na falta dele.
function valorJornada(linha) {
  const n = num(linha.jornada_citatti_min) ?? num(linha.jornada_total_min);
  return n == null || n <= 0 ? "" : fmtMin(n);
}

// Ordena/exporta o rótulo curto da pílula — é o que está na tela. O status cru
// ("DIVERGENTE (transnet x sugestao)") continua no title da pílula.
const valorStatus = (linha) => {
  const bruto = String(linha.status_almoco ?? "");
  return ESTILO_STATUS[chaveStatus(bruto)][0] || bruto;
};

const COL_CRACHA = {
  id: "cracha",
  rotulo: "Crachá",
  classe: "dp-mono dp-num",
  largura: 92,
  render: (r) => r.cracha || "—",
};
const COL_NOME = {
  id: "nm_funcionario",
  rotulo: "Nome",
  largura: 230,
  estilo: { fontWeight: 600 },
  render: (r) => r.nm_funcionario || "—",
};
const COL_DATA = {
  id: "data_ref",
  rotulo: "Data",
  classe: "dp-mono dp-num",
  largura: 104,
  valor: (r) => fmtData(r.data_ref),
};
const COL_JORNADA = {
  id: "jornada",
  rotulo: "Jornada",
  largura: 96,
  valor: valorJornada,
  render: (r) => <CelulaJornada linha={r} />,
};
const COL_STATUS = {
  id: "status_almoco",
  rotulo: "Status",
  largura: 132,
  valor: valorStatus,
  render: (r) => <PilulaStatus status={r.status_almoco} />,
};

// TODOS · Sugestão · Divergente — o "Realizado" aqui já é o da regra dos 27 min.
const COLUNAS_PADRAO = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { id: "fonte", rotulo: "Fonte", largura: 120, render: (r) => r.fonte || "—" },
  {
    id: "rea_ini",
    rotulo: "Realizado início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(almocoRef(r).ini),
    render: (r) => fmtHora(almocoRef(r).ini),
  },
  {
    id: "rea_fim",
    rotulo: "Realizado fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(almocoRef(r).fim),
    render: (r) => fmtHora(almocoRef(r).fim),
  },
  {
    id: "rea_dur",
    rotulo: "Duração intervalo",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(almocoRef(r).min),
    render: (r) => fmtDur(almocoRef(r).min),
  },
  {
    id: "imp_ini",
    rotulo: "Importação início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.importacao_inicio),
    render: (r) => fmtHora(r.importacao_inicio),
  },
  {
    id: "imp_fim",
    rotulo: "Importação fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.importacao_fim),
    render: (r) => fmtHora(r.importacao_fim),
  },
  {
    id: "imp_dur",
    rotulo: "Duração importação",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(r.importacao_duracao_min),
    render: (r) => fmtDur(r.importacao_duracao_min),
  },
  {
    id: "prog_ini",
    rotulo: "Programado início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.programado_inicio),
    render: (r) => fmtHora(r.programado_inicio),
  },
  {
    id: "prog_fim",
    rotulo: "Programado fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.programado_fim),
    render: (r) => fmtHora(r.programado_fim),
  },
  {
    id: "prog_dur",
    rotulo: "Duração programado",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(r.programado_duracao_min),
    render: (r) => fmtDur(r.programado_duracao_min),
  },
  COL_STATUS,
];

// Abaixo 27min — aqui o "Realizado" é o valor CRU do Citatti (`sugestao_*`),
// sem a troca pelo SST: é exatamente esse número curto que está em discussão.
const COLUNAS_ABAIXO = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  {
    id: "sug_ini",
    rotulo: "Realizado início",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.sugestao_inicio),
    render: (r) => fmtHora(r.sugestao_inicio),
  },
  {
    id: "sug_fim",
    rotulo: "Realizado fim",
    classe: "dp-mono dp-num",
    largura: 132,
    valor: (r) => valorHora(r.sugestao_fim),
    render: (r) => fmtHora(r.sugestao_fim),
  },
  {
    id: "sug_dur",
    rotulo: "Duração intervalo",
    classe: "dp-mono dp-num",
    largura: 144,
    valor: (r) => valorMin(r.sugestao_duracao_min),
    render: (r) => fmtDur(r.sugestao_duracao_min),
  },
  { id: "sugestao_origem", rotulo: "Origem", largura: 120, render: (r) => r.sugestao_origem || "—" },
  COL_STATUS,
];

// OK — não há o que conferir: grade reduzida, só para confirmar o motivo.
const COLUNAS_OK = [
  COL_CRACHA,
  COL_NOME,
  COL_DATA,
  COL_JORNADA,
  { id: "jornada_origem", rotulo: "Origem jornada", largura: 160, render: (r) => r.jornada_origem || "—" },
  COL_STATUS,
];

const colunasDoFiltro = (filtro) =>
  filtro === "AB" ? COLUNAS_ABAIXO : filtro === "OK" ? COLUNAS_OK : COLUNAS_PADRAO;

/* Uma chave de preferência POR CONJUNTO de colunas (`tbl_p1_sug`, `tbl_p1_ab`,
   `tbl_p1_red`, como na ferramenta original). Chave única para os três faria a
   coluna escondida no "Abaixo 27min" sumir também no padrão — e o `sortKey` de
   uma grade apontaria para uma coluna que não existe na outra. */
const chaveTabelaDoFiltro = (filtro) =>
  filtro === "AB" ? "p1_ab" : filtro === "OK" ? "p1_red" : "p1_sug";

const FILTROS = [
  ["TODOS", "Todos"],
  ["SUG", "Sugestão"],
  ["AB", "Abaixo 27min"],
  ["DIV", "Divergente"],
  ["OK", "OK"],
];

/* ─────────────────────────── leitura ───────────────────────────
   As datas mudam pouco e custam uma varredura da coluna inteira; ficam em
   cache de módulo (o app antigo fazia igual com IVDATAS). O botão Recarregar
   limpa o cache. */
let cacheDatas = null;

async function buscarDatas() {
  if (cacheDatas) return cacheDatas;
  const vistas = new Set();
  for (let pagina = 0; pagina < 12; pagina += 1) {
    const bloco = await lerDP360("ponto_intervalo", {
      colunas: "data_ref",
      ordem: "data_ref.desc",
      limite: PASSO_DATAS,
      offset: pagina * PASSO_DATAS,
    });
    bloco.forEach((linha) => {
      const dia = String(linha.data_ref ?? "").slice(0, 10);
      if (dia) vistas.add(dia);
    });
    if (bloco.length < PASSO_DATAS) break;
  }
  cacheDatas = Array.from(vistas).sort().reverse();
  return cacheDatas;
}

const buscarLinhas = (data) =>
  lerTudoDP360("ponto_intervalo", {
    filtros: { data_ref: `eq.${data}` },
    ordem: "cracha.asc",
  });

/* ═════════════════ importação da refeição (o lote do robô) ═════════════════

   O QUE MUDA EM RELAÇÃO À FERRAMENTA. Lá (main.py `gerar_import_p1` →
   ferramenta/processar_intervalo.py `gerar_arquivo_importacao`) o Passo 1 escreve
   um .txt de batidas cruas (`ponto2_sugerido`/`ponto3_sugerido`, 34 chars com o
   PIS) que ALGUÉM sobe à mão no Transnet — duas marcações NOVAS, sem tocar no
   resto do cartão. No INOVE quem executa é o robô `bot_ponto.py`, e ele preenche
   os QUATRO campos do Cartão de Ponto de uma vez. Não existe meio-termo: ou o
   robô escreve o cartão inteiro, ou não escreve nada.

   Daí a única decisão de projeto desta tela: a ENTRADA e a SAÍDA voltam
   EXATAMENTE como estão hoje no cartão (`ponto_diario`), e só o miolo vira a
   janela de 30 min da importação. O efeito no Transnet é o mesmo do .txt — o
   almoço entra, as pontas ficam onde estavam — e nenhuma ponta é inventada aqui.
   Consequência inevitável: quem não tem cartão com as duas pontas fica de fora,
   e a tela DIZ isso em vez de sumir com a pessoa (o bot devolveria `SEM_REAL`,
   "não lanço cartão com ponta em branco", e a linha voltaria sem explicação).

   QUEM ENTRA (porte fiel de `processar_intervalo.linhas_a_importar`):
     · balde OK ou SUGESTAO — ABAIXO_27MIN e DIVERGENTE não são candidatos;
     · `ponto2_sugerido` preenchido, que é a própria view dizendo "falta importar"
       (ela zera essa coluna quando a jornada < 6h ou quando o Transnet já tem
       almoço >= 27 min);
     · a checagem `gab_almoco_saida` do original virou comentário de propósito:
       essa coluna não existe na `ponto_intervalo` (ver PONTO/supabase_schema.sql).
       A guarda equivalente é a de cima — assim que o almoço entra no Transnet, a
       view zera `importacao_inicio`/`ponto2_sugerido` e a pessoa some do lote.

   A REGRA DOS 27 MIN NÃO É REFEITA AQUI. `importacao_inicio`/`importacao_fim`
   são a MESMA cascata que `regrasPonto.almocoDaRefeicao` (Citatti >= 27 → SST),
   decidida uma vez só na view — é a origem do `ponto2_sugerido` que a ferramenta
   usa e é o que a coluna "Importação" já mostra na grade. Se a tela e o arquivo
   pudessem divergir na fronteira dos 27 min, quem manda é a view.

   O ALMOÇO TRAVADO DA REVISÃO MANDA. `ponto_diario.almoco_travado` significa que
   a Revisão já cravou o alvo do miolo daquele dia (matriz de meio de jornada) —
   main.py recusa até edição manual nesses dias ("O almoço deste motorista foi
   travado pela regra da Revisão"). Lançar a janela daqui por cima seria as duas
   telas brigando pelo mesmo cartão, então o dia fica FORA, com o motivo escrito.
   ═══════════════════════════════════════════════════════════════════════════ */

const cru = (valor) => String(valor ?? "").trim();

// main.py `_cracha8` / bot_ponto.py `cracha8` — crachá numérico com menos de 8
// dígitos completa com zero à esquerda. O `ponto_intervalo` vem SEM os zeros
// (a view faz `regexp_replace(nr_cracha, '^0+', '')`) e o `ponto_diario` mistura
// as duas formas; normalizar nos dois lados é o que faz o casamento fechar — e
// sem os 8 dígitos o robô não acha ninguém na tela do Transnet.
function cra8(valor) {
  const c = cru(valor);
  return /^\d{1,7}$/.test(c) ? c.padStart(8, "0") : c;
}

// main.py `_ddmm` — a tela do Transnet (e o input `data` do workflow) é dd/mm/aaaa.
// Recorte de string, nunca `new Date()`: a data já vem em ISO e virar objeto Date
// só criaria chance de o fuso empurrar o dia.
const ddmmaaaa = (iso) => {
  const v = cru(iso);
  return v.length >= 10 ? `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : v;
};

// Booleano do lake chega como STRING. Mesmo conjunto que main.py aceita
// (`in ("true", "t", "1", "sim")`): aqui o erro caro é o falso NEGATIVO — deixar
// passar um almoço travado seria reescrever o que a Revisão já decidiu.
const ehVerdadeiro = (valor) =>
  ["true", "t", "1", "sim"].includes(cru(valor).toLowerCase());

// Só o que o lote precisa do cartão. Lista explícita porque a `ponto_diario` é
// larga e aqui se lê o dia inteiro.
const COLUNAS_CARTAO = [
  "cracha",
  "date_ref",
  "nm_funcionario",
  "entrada",
  "saida_almoco",
  "volta_almoco",
  "saida",
  "almoco_travado",
].join(",");

const buscarCartoes = (data) =>
  lerTudoDP360("ponto_diario", {
    colunas: COLUNAS_CARTAO,
    filtros: { date_ref: `eq.${data}` },
    ordem: "cracha.asc",
  });

// O CSV que o `bot_ponto.py --lote` lê (csv.DictReader). A coluna `data` por
// linha é opcional para ele (`data_reg = r.get("data") or data`), mas é o formato
// que main.py escreve em TODAS as filas do bot — e deixa o arquivo dizer sozinho
// de que dia ele é. Sem aspas: crachá é dígito, data é dd/mm/aaaa e hora é HH:MM.
const CAMPOS_CSV = ["cracha", "data", "entrada", "alm_saida", "alm_volta", "saida"];

const csvDoLote = (linhas) =>
  [CAMPOS_CSV.join(","), ...linhas.map((l) => CAMPOS_CSV.map((c) => l[c]).join(","))].join("\n");

// Pede importação: é a conta que o chip "N para importar" já faz, escrita como
// `linhas_a_importar`. Fica fora do `montarLote` para o botão saber se há o que
// abrir ANTES de ir buscar os cartões do dia.
function pedeImportacao(linha) {
  const chave = chaveStatus(linha.status_almoco);
  if (chave !== "OK" && chave !== "SUG") return false;
  return Boolean(cru(linha.ponto2_sugerido));
}

/**
 * Divide os candidatos do dia entre o que vai para o robô e o que fica de fora.
 * `cartoes` é um Map por crachá de 8 dígitos, vindo da `ponto_diario`.
 * Devolve { dentro, fora } — a tela mostra os DOIS, sempre.
 */
function montarLote(linhas, cartoes, data) {
  const dentro = [];
  const fora = [];

  for (const linha of linhas) {
    if (!pedeImportacao(linha)) continue;

    const cracha = cra8(linha.cracha);
    const base = {
      cracha,
      nome: linha.nm_funcionario || "",
      fonte: linha.fonte || "",
      origem: almocoRef(linha).origem,
      janelaIni: cru(linha.importacao_inicio),
      janelaFim: cru(linha.importacao_fim),
    };
    const deixaFora = (motivo) => fora.push({ ...base, motivo });

    if (!base.janelaIni || !base.janelaFim) {
      deixaFora("sem janela de importação na view — nada a lançar");
      continue;
    }

    const cartao = cartoes.get(cracha);
    if (!cartao) {
      deixaFora("sem cartão em ponto_diario nesse dia — o robô reescreve o cartão inteiro e precisa das duas pontas");
      continue;
    }
    if (ehVerdadeiro(cartao.almoco_travado)) {
      deixaFora("almoço travado pela Revisão — o alvo do miolo já foi decidido lá");
      continue;
    }

    const entrada = cru(cartao.entrada);
    const saida = cru(cartao.saida);
    if (!entrada || !saida) {
      const falta = [!entrada && "entrada", !saida && "saída"].filter(Boolean).join(" e ");
      deixaFora(`cartão sem ${falta} — o Transnet recusa ponta em branco (o bot devolve SEM_REAL)`);
      continue;
    }

    // Desenrola a virada de meia-noite e escreve em notação 24+, como
    // main.py `_desenrola_cartao` faz antes de mandar qualquer fila ao bot: um
    // cartão que termina 00:08 do dia seguinte vai como 24:08, senão a saída
    // fica ANTES da entrada e a jornada sai negativa. (O bot reduz mod 24 na
    // hora de digitar — `bot_ponto._mod24`.)
    const mEntrada = hm2min(entrada);
    let mSaida = hm2min(saida);
    let mAlmIni = hm2min(base.janelaIni);
    let mAlmFim = hm2min(base.janelaFim);
    if (mEntrada == null || mSaida == null || mAlmIni == null || mAlmFim == null) {
      deixaFora("horário ilegível no cartão ou na janela — não dá para montar as quatro batidas");
      continue;
    }
    while (mSaida < mEntrada) mSaida += 1440;
    while (mAlmIni < mEntrada) mAlmIni += 1440;
    while (mAlmFim < mAlmIni) mAlmFim += 1440;

    // A JANELA TEM DE CABER DENTRO DO CARTÃO. É a única checagem de plausibilidade
    // aqui, e não é burocracia: as pontas vêm do cartão e o miolo vem da operação,
    // então dá para montar um cartão impossível sem que nenhuma das partes esteja
    // "errada" (o mesmo defeito que main.py descreve em `corrigir_pontos`,
    // 30060835 15/08). Sem ela o robô escreveria volta de almoço DEPOIS da saída.
    if (mAlmFim > mSaida) {
      deixaFora(
        `a janela ${base.janelaIni}–${base.janelaFim} não cabe entre a entrada ${entrada} e a saída ${saida} do cartão`,
      );
      continue;
    }

    dentro.push({
      ...base,
      cartaoHoje: [cartao.entrada, cartao.saida_almoco, cartao.volta_almoco, cartao.saida].map((h) => cru(h)),
      csv: {
        cracha,
        data: ddmmaaaa(data),
        entrada: min2hm(mEntrada),
        alm_saida: min2hm(mAlmIni),
        alm_volta: min2hm(mAlmFim),
        saida: min2hm(mSaida),
      },
    });
  }

  return { dentro, fora };
}

/* ─────────────────────── painel da importação ─────────────────────── */

function LinhaLote({ item }) {
  return (
    <tr>
      <td className="dp-mono dp-num">{item.cracha}</td>
      <td style={{ fontWeight: 600 }}>{item.nome || "—"}</td>
      <td className="dp-mono dp-num dp-faint">
        {item.cartaoHoje.map((h) => h || "—").join(" · ")}
      </td>
      <td className="dp-mono dp-num">
        {[item.csv.entrada, item.csv.alm_saida, item.csv.alm_volta, item.csv.saida].join(" · ")}
      </td>
      <td className="dp-muted">{item.origem || item.fonte || "—"}</td>
    </tr>
  );
}

function PainelImportacao({ data, linhas, aoFechar }) {
  const [cartoes, setCartoes] = useState(null);
  const [erro, setErro] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [recado, setRecado] = useState(null);

  // O cartão do dia só é lido quando o painel abre: a grade da Refeição não
  // precisa dele e são mais mil linhas de `ponto_diario` por dia.
  useEffect(() => {
    let ativo = true;
    setCartoes(null);
    setErro("");
    buscarCartoes(data)
      .then((lista) => {
        if (!ativo) return;
        const mapa = new Map();
        for (const c of lista) mapa.set(cra8(c.cracha), c);
        setCartoes(mapa);
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao ler o cartão de ponto do dia.");
      });
    return () => {
      ativo = false;
    };
  }, [data]);

  const lote = useMemo(
    () => (cartoes ? montarLote(linhas, cartoes, data) : null),
    [linhas, cartoes, data],
  );

  // ENSAIO x VALENDO são dois BOTÕES, não um checkbox: checkbox marcado por
  // engano reescreve o cartão de dezenas de pessoas. A confirmação de cada um
  // diz qual dos dois é e o que vai acontecer.
  const lancar = async (confirmar) => {
    const fila = (lote?.dentro || []).map((item) => item.csv);
    if (!fila.length) return;
    const abertura = confirmar
      ? `LANÇAR DE VERDADE no Transnet o almoço de ${fila.length} motorista(s) em ${fmtData(data)}.`
      : `ENSAIO para ${fila.length} motorista(s) em ${fmtData(data)}: o robô preenche a tela e NÃO clica em Inserir.`;
    if (
      !window.confirm(
        `${abertura}\n\n` +
          `O robô reescreve o CARTÃO INTEIRO de cada um: a entrada e a saída voltam ` +
          `exatamente como estão hoje e só o miolo vira a janela de ` +
          `${IMPORTACAO_JANELA_MIN} min da importação.\n\n` +
          (lote?.fora?.length
            ? `${lote.fora.length} candidato(s) ficaram de fora — a lista com o motivo está na tela.\n\n`
            : "") +
          `Quem executa é o robô, no GitHub Actions. O disparo fica registrado com o seu nome.\n\n` +
          `O resultado por pessoa NÃO volta sozinho para esta tela: a evidência fica no run do GitHub.`,
      )
    )
      return;

    setDisparando(true);
    setRecado(null);
    try {
      const resposta = await dispararRoboDP360("ponto", {
        csv: csvDoLote(fila),
        data: ddmmaaaa(data),
        confirmar: confirmar ? "true" : "false",
      });
      // Histórico por pessoa (`ponto_importacoes`, passo 1 = Refeição), como a
      // ferramenta gravava ao gerar o .txt. Só no lançamento de verdade: ensaio
      // não escreve nada no Transnet e viraria histórico de algo que não houve.
      // A trilha do DISPARO (quem clicou, ensaio ou não) é do gateway, em
      // `dp360_auditoria` — esta aqui é o "o que subiu para o Fulano em tal dia".
      let aviso = "";
      if (confirmar) {
        try {
          await inserirDP360(
            "ponto_importacoes",
            lote.dentro.map((item) => ({
              cracha: item.csv.cracha,
              nome: item.nome,
              date_ref: data,
              passo: 1,
              entrada: item.csv.entrada,
              saida_almoco: item.csv.alm_saida,
              volta_almoco: item.csv.alm_volta,
              saida: item.csv.saida,
              fonte: item.fonte,
              arquivo: "robô ponto.yml",
              // Nem 'gerado' nem 'lancado': o robô foi disparado e ninguém
              // ainda leu a evidência dele. A aba Importações pinta como alerta,
              // que é exatamente o estado da coisa.
              status: "disparado",
            })),
          );
        } catch {
          aviso = " (não foi possível registrar o histórico em ponto_importacoes)";
        }
      }
      setRecado({
        tipo: "ok",
        texto: `${confirmar ? "Lançamento" : "Ensaio"} disparado — ${fila.length} motorista(s).${aviso}`,
        painel: resposta?.painel || "",
      });
    } catch (falha) {
      setRecado({ tipo: "erro", texto: falha?.message || "Não foi possível disparar o robô." });
    } finally {
      setDisparando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        background: "rgba(15, 20, 32, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: 20,
      }}
      onClick={aoFechar}
      role="presentation"
    >
      <div
        className="dp-card"
        style={{ width: 1000, maxWidth: "96vw", padding: 20 }}
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Importação da refeição"
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 650 }}>
              Importação da refeição · {fmtData(data)}
            </div>
            <div className="dp-muted" style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.6 }}>
              O robô <code>bot_ponto.py</code> preenche os quatro campos do Cartão de Ponto no
              Transnet. A <b>entrada</b> e a <b>saída</b> voltam exatamente como estão hoje no
              cartão; só o miolo vira a janela de {IMPORTACAO_JANELA_MIN} min da importação.
            </div>
          </div>
          <button type="button" className="dp-btn" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>

        {erro && (
          <div style={{ marginTop: 14 }}>
            <span className="dp-pill danger">{erro}</span>
          </div>
        )}

        {!erro && !lote && (
          <div className="dp-muted" style={{ marginTop: 14, fontSize: 12.5 }}>
            Lendo o cartão de ponto de {fmtData(data)}…
          </div>
        )}

        {lote && (
          <>
            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="dp-pill accent">{lote.dentro.length} no lote</span>
              {lote.fora.length ? (
                <span className="dp-pill warn">{lote.fora.length} fora do lote</span>
              ) : null}
            </div>

            {lote.dentro.length ? (
              <div style={{ marginTop: 12, maxHeight: "38vh", overflow: "auto" }}>
                <table className="dp-tabela" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Crachá</th>
                      <th>Nome</th>
                      <th>Cartão hoje (E · SA · VA · S)</th>
                      <th>Cartão que o robô vai gravar</th>
                      <th>Origem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lote.dentro.map((item) => (
                      <LinhaLote key={item.cracha} item={item} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="dp-muted" style={{ marginTop: 12, fontSize: 12.5 }}>
                Nenhum candidato deste dia pode ir para o robô. Os motivos estão abaixo.
              </div>
            )}

            {/* NUNCA SUMIR COM A PESSOA. Quem pedia importação e não entrou no lote
                aparece aqui com o motivo — sem esta lista, a diferença entre o chip
                "N para importar" e o que o robô recebeu seria invisível. */}
            {lote.fora.length > 0 && (
              <div className="dp-det-bot" style={{ marginTop: 12 }}>
                <div className="dp-det-bot-linha">
                  <b>Fora do lote ({lote.fora.length})</b>{" "}
                  <span className="dp-faint">
                    · pediam importação, mas o robô não pode escrever o cartão desses dias
                  </span>
                </div>
                <div style={{ maxHeight: "22vh", overflow: "auto" }}>
                  {lote.fora.map((item) => (
                    <div
                      key={`${item.cracha}-${item.motivo}`}
                      className="dp-det-bot-linha"
                      style={{ display: "flex", gap: 8, alignItems: "baseline" }}
                    >
                      <span className="dp-mono dp-num">{item.cracha}</span>
                      <span style={{ fontWeight: 600 }}>{item.nome || "—"}</span>
                      <span className="dp-muted">{item.motivo}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="dp-det-bot">
              <div className="dp-det-bot-linha">
                <b>{lote.dentro.length} cartão(ões) para o robô</b>
                <span className="dp-faint">
                  {" "}
                  · o disparo fica registrado com o seu nome; a evidência por pessoa fica no run
                  do GitHub e não volta sozinha para esta tela
                </span>
              </div>
              <div className="dp-det-bot-acoes">
                <button
                  type="button"
                  className="dp-btn"
                  disabled={disparando || !lote.dentro.length}
                  onClick={() => lancar(false)}
                  title="O robô preenche a tela do Transnet e NÃO clica em Inserir — serve para conferir o lote"
                >
                  🤖 Ensaio
                </button>
                <button
                  type="button"
                  className="dp-btn"
                  style={{ color: "var(--dp-danger-ink)" }}
                  disabled={disparando || !lote.dentro.length}
                  onClick={() => lancar(true)}
                  title="Reescreve o cartão de ponto dessas pessoas no Transnet"
                >
                  ⚠ Lançar de verdade
                </button>
                {disparando && <span className="dp-pill accent">disparando…</span>}
              </div>
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
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── painel de detalhe ─────────────────────── */

const ESTILO_ROTULO = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

function BlocoIntervalo({ titulo, inicio, fim, duracao, nota, destaque }) {
  const temJanela = String(inicio ?? "").trim() || String(fim ?? "").trim();
  return (
    <div
      className="dp-card"
      style={
        destaque
          ? { borderColor: "var(--dp-accent)", background: "var(--dp-accent-soft)" }
          : { background: "var(--dp-surface-2)" }
      }
    >
      <div className="dp-muted" style={ESTILO_ROTULO}>
        {titulo}
      </div>
      <div className="dp-mono dp-num" style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>
        {temJanela ? `${fmtHora(inicio)} – ${fmtHora(fim)}` : "—"}
      </div>
      <div className="dp-muted dp-num" style={{ marginTop: 2, fontSize: 12 }}>
        {fmtDur(duracao)}
      </div>
      {nota && (
        <div className="dp-faint" style={{ marginTop: 8, fontSize: 11.5, lineHeight: 1.5 }}>
          {nota}
        </div>
      )}
    </div>
  );
}

function PainelDetalhe({ linha, aoFechar }) {
  const aplicado = almocoRef(linha);
  const diferenca = num(linha.diferenca_transnet_min);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15, 20, 32, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        padding: 20,
      }}
      onClick={aoFechar}
      role="presentation"
    >
      <div
        className="dp-card"
        style={{ width: 880, maxWidth: "95vw", padding: 20 }}
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe da refeição"
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 650 }}>{linha.nm_funcionario || "—"}</div>
            <div className="dp-muted" style={{ marginTop: 3, fontSize: 12.5 }}>
              Crachá {linha.cracha || "—"} · {fmtData(linha.data_ref)} · Jornada{" "}
              <CelulaJornada linha={linha} />
            </div>
            <div style={{ marginTop: 8 }}>
              <PilulaStatus status={linha.status_almoco} />
            </div>
          </div>
          <button type="button" className="dp-btn" onClick={aoFechar} aria-label="Fechar detalhe">
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          {/* O batido no ponto é o que gera o "Divergente" — e no app antigo ele
              não aparecia em tela nenhuma. Mostrar aqui é melhoria proposital. */}
          <BlocoIntervalo
            titulo="Batido no ponto (Transnet)"
            inicio={linha.transnet_almoco_inicio}
            fim={linha.transnet_almoco_fim}
            duracao={linha.transnet_almoco_duracao_min}
            nota="Da 2ª e 3ª batida do cartão. É contra ele que a sugestão é comparada."
          />
          <BlocoIntervalo
            titulo="Sugestão Citatti"
            inicio={linha.sugestao_inicio}
            fim={linha.sugestao_fim}
            duracao={linha.sugestao_duracao_min}
            nota={linha.sugestao_origem ? `Origem: ${linha.sugestao_origem}` : null}
          />
          <BlocoIntervalo
            titulo="Sugestão SST"
            inicio={linha.sugestao_sst_inicio}
            fim={linha.sugestao_sst_fim}
            duracao={linha.sugestao_sst_duracao_min}
            nota={`Entra no lugar do Citatti quando ele fica abaixo de ${MIN_ALMOCO} min.`}
          />
          <BlocoIntervalo
            titulo="Programado (escala)"
            inicio={linha.programado_inicio}
            fim={linha.programado_fim}
            duracao={linha.programado_duracao_min}
          />
          <BlocoIntervalo
            titulo="Importação"
            inicio={linha.importacao_inicio}
            fim={linha.importacao_fim}
            duracao={linha.importacao_duracao_min}
            nota={`Janela fixa de ${IMPORTACAO_JANELA_MIN} min a partir do início da sugestão.`}
          />
          <BlocoIntervalo
            destaque
            titulo={`Realizado (regra dos ${MIN_ALMOCO} min)`}
            inicio={aplicado.ini}
            fim={aplicado.fim}
            duracao={aplicado.min}
            nota={
              aplicado.origem
                ? `Origem aplicada: ${aplicado.origem}${aplicado.detalhe ? ` · ${aplicado.detalhe}` : ""}`
                : "Sem intervalo utilizável nas duas fontes."
            }
          />
        </div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          }}
        >
          <div className="dp-card">
            <div className="dp-muted" style={ESTILO_ROTULO}>
              Diferença cartão × sugestão
            </div>
            <div className="dp-mono dp-num" style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>
              {diferenca == null ? "—" : `${Math.round(diferenca)} min`}
            </div>
            <div className="dp-faint" style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5 }}>
              Compara só o INÍCIO. Acima de {TOLERANCIA_TRANSNET_MIN} min vira Divergente.
            </div>
          </div>
          <div className="dp-card">
            <div className="dp-muted" style={ESTILO_ROTULO}>
              Fonte
            </div>
            <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600 }}>{linha.fonte || "—"}</div>
            <div className="dp-faint" style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5 }}>
              Quem decidiu o veredito do dia, conforme a view do ponto.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── legenda ─────────────────────────── */

function Legenda() {
  const item = (titulo, texto) => (
    <li key={titulo} style={{ lineHeight: 1.6 }}>
      <span style={{ fontWeight: 650 }}>{titulo}</span> <span className="dp-muted">{texto}</span>
    </li>
  );
  return (
    <div className="dp-card" style={{ margin: "0 20px 20px", background: "var(--dp-surface-2)" }}>
      <div className="dp-muted" style={ESTILO_ROTULO}>
        Como a régua funciona
      </div>
      <ul
        style={{
          margin: "10px 0 0",
          padding: 0,
          listStyle: "none",
          display: "grid",
          gap: 6,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          fontSize: 12.5,
        }}
      >
        {item(
          `Refeição mínima: ${MIN_ALMOCO} min.`,
          "Abaixo disso o Citatti pegou uma parada, não o almoço — cai para o SST; se o SST também não alcança, vale o que a pessoa fez.",
        )}
        {item(
          `Dispensa de intervalo: ${JORNADA_EXIGE_ALMOCO} min (6h).`,
          "Jornada menor que isso, medida pelo Citatti, já entra como OK — não precisa de refeição.",
        )}
        {item(
          `Tolerância cartão × sugestão: ${TOLERANCIA_TRANSNET_MIN} min.`,
          "Compara SÓ o início do intervalo. Passou disso, o dia vira Divergente.",
        )}
        {item(
          `Importação: janela fixa de ${IMPORTACAO_JANELA_MIN} min.`,
          "O arquivo grava sempre 30 min a partir do início sugerido, não a duração realizada.",
        )}
      </ul>
      <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
        <PilulaStatus status="OK" />
        <PilulaStatus status="SUGESTAO" />
        <PilulaStatus status="DIVERGENTE (transnet x sugestao)" />
        <PilulaStatus status="ABAIXO_27MIN" />
      </div>
    </div>
  );
}

/* ─────────────────────────── tela ─────────────────────────── */

export default function Refeicao() {
  const [datas, setDatas] = useState([]);
  const [data, setData] = useState("");
  const [linhas, setLinhas] = useState([]);
  const [carregandoDatas, setCarregandoDatas] = useState(true);
  const [carregandoLinhas, setCarregandoLinhas] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [importando, setImportando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  // 1) datas disponíveis (default = mais recente)
  useEffect(() => {
    let ativo = true;
    setCarregandoDatas(true);
    setErro("");
    buscarDatas()
      .then((lista) => {
        if (!ativo) return;
        setDatas(lista);
        setData((atual) => (atual && lista.includes(atual) ? atual : lista[0] || ""));
      })
      .catch((falha) => {
        if (ativo) setErro(falha.message || "Falha ao consultar as datas do intervalo.");
      })
      .finally(() => {
        if (ativo) setCarregandoDatas(false);
      });
    return () => {
      ativo = false;
    };
  }, [recarga]);

  // 2) linhas do dia escolhido
  useEffect(() => {
    if (!data) {
      setLinhas([]);
      return undefined;
    }
    let ativo = true;
    setCarregandoLinhas(true);
    setErro("");
    buscarLinhas(data)
      .then((lista) => {
        if (ativo) setLinhas(lista);
      })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha.message || "Falha ao consultar o intervalo desse dia.");
      })
      .finally(() => {
        if (ativo) setCarregandoLinhas(false);
      });
    return () => {
      ativo = false;
    };
  }, [data, recarga]);

  // Esc fecha o detalhe.
  useEffect(() => {
    if (!detalhe) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") setDetalhe(null);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [detalhe]);

  // Esc fecha o painel da importação. Separado do detalhe de propósito: os dois
  // são modais e um Esc só pode fechar o que está na frente.
  useEffect(() => {
    if (!importando) return undefined;
    const aoTeclar = (evento) => {
      if (evento.key === "Escape") setImportando(false);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [importando]);

  // Trocar o dia fecha o painel: o lote é sempre de UM dia, e deixar aberto o
  // painel de ontem com a grade de hoje seria a receita para disparar o dia errado.
  useEffect(() => {
    setImportando(false);
  }, [data, recarga]);

  const recarregar = useCallback(() => {
    cacheDatas = null;
    setDetalhe(null);
    setRecarga((n) => n + 1);
  }, []);

  // Contagens dos chips: sempre sobre o dia inteiro, não sobre a busca — é assim
  // que o DP lê "quantos ficaram para importar hoje".
  const contagens = useMemo(() => {
    const conta = { TODOS: linhas.length, SUG: 0, AB: 0, DIV: 0, OK: 0 };
    linhas.forEach((linha) => {
      const chave = chaveStatus(linha.status_almoco);
      if (conta[chave] !== undefined) conta[chave] += 1;
    });
    return conta;
  }, [linhas]);

  const visiveis = useMemo(() => {
    const termos = semAcento(busca).split(/\s+/).filter(Boolean);
    return linhas.filter((linha) => {
      if (filtro !== "TODOS" && chaveStatus(linha.status_almoco) !== filtro) return false;
      if (!termos.length) return true;
      const alvo = semAcento(`${linha.nm_funcionario ?? ""} ${linha.cracha ?? ""}`);
      return termos.every((termo) => alvo.includes(termo));
    });
  }, [linhas, filtro, busca]);

  // Quantos do dia PEDEM importação (`linhas_a_importar`). É só para o botão
  // saber se há painel a abrir — quem realmente entra no lote depende do cartão
  // de ponto, que o painel busca na hora.
  const candidatos = useMemo(() => linhas.filter(pedeImportacao).length, [linhas]);

  const colunas = colunasDoFiltro(filtro);

  return (
    <AbaShell
      resumo="Confere o intervalo de cada motorista contra a operação e prepara o que precisa ser importado. A grade é só leitura; a única escrita é o “Gerar importação”, que monta o lote do robô e pede confirmação antes de tocar no Transnet."
      carregando={carregandoDatas}
      erro={erro}
      filtros={
        !datas.length ? null : (
        <>
          <select
            value={data}
            onChange={(evento) => {
              setData(evento.target.value);
              setDetalhe(null);
            }}
            aria-label="Data do intervalo"
          >
            {datas.map((dia) => (
              <option key={dia} value={dia}>
                {fmtData(dia)}
              </option>
            ))}
          </select>

          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome ou crachá"
            style={{ width: 250 }}
          />

          <button type="button" className="dp-btn" onClick={recarregar}>
            ↻ Recarregar
          </button>

          <span className="dp-muted dp-num" style={{ marginLeft: "auto", fontSize: 12 }}>
            {visiveis.length} de {linhas.length} linha{linhas.length === 1 ? "" : "s"} do dia
          </span>
        </>
        )
      }
    >
      {!datas.length ? (
        <div className="dp-resumo">
          Nenhuma data disponível em <code>ponto_intervalo</code>.
        </div>
      ) : (
        <>
          {/* chips de filtro + o que sobrou para importar */}
          <div className="dp-viewbar" style={{ paddingTop: 4 }}>
            {FILTROS.map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                className={`dp-chip-f${filtro === chave ? " on" : ""}`}
                onClick={() => setFiltro(chave)}
              >
                {rotulo} <span className="n">{contagens[chave] ?? 0}</span>
              </button>
            ))}

            {/* "Gerar importação" NÃO dispara nada sozinho: abre o painel, que
                mostra o lote pessoa a pessoa, quem ficou de fora e por quê, e só
                então oferece os dois botões (ensaio / valendo). Escrever no cartão
                de alguém não pode caber num clique de barra de ferramentas. */}
            <button
              type="button"
              className="dp-btn primary"
              disabled={!candidatos || carregandoLinhas}
              onClick={() => setImportando(true)}
              title={
                candidatos
                  ? "Monta o lote do robô do ponto (ensaio ou lançamento) para o dia escolhido"
                  : "Nada pede importação nesse dia"
              }
              style={{ marginLeft: "auto" }}
            >
              ⬇ Gerar importação
            </button>

            {contagens.SUG ? (
              <span className="dp-pill warn">{contagens.SUG} para importar</span>
            ) : (
              <span className="dp-faint" style={{ fontSize: 12 }}>
                Nada para importar nesse dia
              </span>
            )}
          </div>

          {/* grade — ordenar/⚙/fixar/CSV vêm da grade compartilhada. A chave muda
              com o conjunto de colunas, senão a preferência de um filtro estraga
              a do outro. */}
          <TabelaDP
            chave={chaveTabelaDoFiltro(filtro)}
            colunas={colunas}
            linhas={visiveis}
            classeLinha={classeLinha}
            aoClicarLinha={(linha) => setDetalhe(linha)}
            idLinha={(linha) => `${linha.cracha}|${linha.data_ref}`}
            nomeCsv={`refeicao_${data}`}
            vazio="Nada nesse dia com esse filtro."
            carregando={carregandoLinhas}
            mensagemCarregando={`Carregando o intervalo de ${fmtData(data)}…`}
          />

          <Legenda />
        </>
      )}

      {detalhe && <PainelDetalhe linha={detalhe} aoFechar={() => setDetalhe(null)} />}

      {importando && (
        <PainelImportacao data={data} linhas={linhas} aoFechar={() => setImportando(false)} />
      )}
    </AbaShell>
  );
}
