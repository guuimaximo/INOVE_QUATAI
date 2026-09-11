// DP360 · Banco de Horas — porte da tela `viewBancoHoras` da ferramenta original
// (Sistemas/PONTO/app/ui/app.js) sobre o gateway `dp360-api`.
//
// ⚠ DADO DE FOLHA. Esta e a unica tela do INOVE que le a tabela `banco_horas`:
// hora extra e VALOR EM R$ por colaborador. Consequencias, que valem para qualquer
// manutencao futura aqui:
//   1. SOMENTE LEITURA. A tabela entrou na allowlist do gateway sem `escrever`
//      (supabase/functions/dp360-api/index.ts) — nao ha, e nao deve haver, gravacao.
//   2. NENHUM `console.log`/`console.error` com linha, nome, valor ou cracha. Log de
//      navegador vaza em screenshot, sessao compartilhada e ferramenta de suporte.
//   3. EXPORTACAO CSV liberada em 2026-09-06, sob a condicao que estava escrita aqui:
//      "se um dia liberar, exigir registro de quem exportou". O registro nao e um
//      enfeite ao lado do download — e a CONDICAO dele: a linha em `dp360_auditoria`
//      (banco do INOVE) e gravada ANTES, e se a gravacao falhar o arquivo NAO desce.
//      Um CSV de folha que sai da tela vira anexo de e-mail, pendrive e WhatsApp; a
//      unica coisa que sobra depois e quem clicou, quando, e sobre qual recorte.
//   4. Acesso e exclusivo de Administrador em DOIS pontos: `canUserAccessPageKey`
//      barra qualquer chave `dp360_*` para nao-admin, e o gateway confere de novo no
//      servidor. O gate da tela nao substitui o do servidor.
//
// O QUE A TELA MOSTRA (e o porque de nao ser so um SELECT bonito):
// o saldo do banco de horas nao existe pronto no datalake — e o APURADO no ponto
// menos o PAGO na folha, acumulado mes a mes. A coluna `saldo_acumulado_h` ja traz
// esse acumulado corrido, entao a competencia MAIS RECENTE ja responde "quem deve e
// quem tem a receber" sem varrer a base inteira.
//
// COMPETENCIA EM ABERTO: o ponto fecha o mes antes de a folha pagar, entao o mes
// corrente aparece com apurado cheio e pago zero — passivo fantasma. A regra do
// original (`_bh_abertas` no main.py) e por PROPORCAO, sobre a unidade inteira:
// mes fechado paga ~95% do que apurou, mes aberto fica perto de zero; o corte em 20%
// separa os dois com folga.
//
// ONDE A CONTA DE "ABERTA" TEM DE RODAR (e por que ja esteve errada aqui):
// e propriedade do MES e da unidade, nao do recorte na tela. Enquanto ela saia so
// das linhas da competencia carregada, o resultado dependia do <select>: com a
// competencia mais nova (o padrao, e justo a que costuma estar aberta) o aviso
// aparecia; escolhendo um mes ja fechado, o conjunto vinha vazio e a linha
// "com a folha fechada" do extrato SUMIA — a placa que alguem usa para decidir
// desaparecia exatamente na conferencia individual. Agora `abertas` vem de uma
// leitura propria, independente do seletor (JANELA_ABERTAS, abaixo).
//
// POR QUE UMA JANELA E NAO A TABELA INTEIRA (medido em 06/09/2026):
// a `banco_horas` tem 11.717 linhas em 33 competencias (2024-01..2026-09), ~350 a
// 400 por mes, e o PostgREST da base de importacao trava a pagina em 1000 linhas
// (`limite: 5000` no gateway nao adianta: o servidor corta em 1000 do mesmo jeito,
// e `lerTudoDP360` pararia na primeira pagina achando que acabou). Varrer tudo sao
// 12 idas ao gateway (5,5 s medidos direto no PostgREST, sem a Edge Function no
// meio) — caro demais para o carregamento padrao. Agregado no servidor nao e
// opcao: a base responde PGRST123 "Use of aggregate functions is not allowed", e o
// gateway so aceita nome de coluna simples (`colunasValidas`).
// A janela das 12 competencias mais recentes (4.004 linhas, 5 paginas) devolve os
// MESMOS numeros da ferramenta para "ativos e afastados" e para "so ativos"
// (368 pessoas, −1.110,8 h contra −1.111,1 h da varredura completa; a diferenca e
// arredondamento). O tamanho esta explicado na constante JANELA_ABERTAS.
// Quem quiser a base inteira — inclusive desligados — abre o modo "Por mes", que ai
// sim varre tudo: de proposito, uma vez so, e guardado ate o Recarregar.
//
// MODO "POR MES": uma linha por competencia (pessoas, HE apurada, HE paga, debito,
// banco pago, R$ pago, movimento e o acumulado corrido) — o `meses` do
// `get_banco_horas`. E a curva do passivo: "a HE apurada subiu e o passivo esta
// crescendo?" sem abrir 33 competencias uma a uma no seletor.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Download, RefreshCw, Search, X } from "lucide-react";
import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPath } from "../../utils/access";
import { lerDP360, lerTudoDP360 } from "../../services/dp360Api";
import { supabase } from "../../supabase";
import { baixarCsv } from "./TabelaDP";
import "./dp360.css";

import { usePergunta } from "./Perguntar";
const TABELA = "banco_horas";

// Trilha, no projeto do INOVE (migration 202609061400_dp360_auditoria). Vai pelo
// cliente `supabase` do INOVE e NAO pelo gateway `dp360-api`: o gateway fala com o
// projeto de importacao, que nem tem esta tabela. APPEND-ONLY (so select+insert
// para `authenticated`; sem update e sem delete para ninguem).
const TABELA_AUDITORIA = "dp360_auditoria";

// Colunas EXATAS que existem na tabela. Pedir uma coluna inexistente devolve HTTP 400
// no gateway e derruba a tela inteira — nao acrescente nada sem conferir no banco.
// `celular` existe e NAO entra: dado pessoal que esta tela nao precisa.
const COLUNAS_LISTA = [
  "cracha", "colaborador", "funcao", "situacao", "competencia",
  "he_apurada_h", "he_paga_h", "debito_h", "banco_pago_h",
  "he_pago_rs", "banco_pago_rs", "movimento_h", "saldo_acumulado_h",
].join(",");

const COLUNAS_EXTRATO = [
  "cracha", "colaborador", "funcao", "situacao",
  "admissao", "desligamento", "afastado_desde", "afastado_ate", "competencia",
  "he_apurada_h", "he_paga_h", "debito_h", "banco_pago_h",
  "he_pago_rs", "banco_pago_rs", "movimento_h", "saldo_acumulado_h",
].join(",");

/* ── a janela que responde "o que ainda nao teve folha" ───────────────────────
   Quantas competencias, contadas da mais nova para tras, a tela varre para decidir
   `abertas` e para montar as duas placas do topo.

   Doze e um numero MEDIDO (06/09/2026), e nao o arredondamento de "um ano". Para a
   regra de `abertas` bastariam tres: a folha atrasa um mes. Quem manda no tamanho e
   a placa, que soma o saldo de cada pessoa pela linha mais nova dela — e ai a conta
   so fecha se a janela alcancar a ultima linha de TODO MUNDO que ainda conta como
   passivo. Os ativos estao todos na competencia mais recente, mas 30 dos 37
   AFASTADOS pararam de aparecer em fev/2026 (afastamento longo nao gera linha nova):
   com janela de 6, a placa perdia 31 dos 368 ativos+afastados e ~48 h de saldo.
   Doze cobre os 368 com dez meses de folga, e custa 4.004 linhas / 5 paginas contra
   as 12 da tabela inteira. Se a folha do ponto passar a segurar afastado por mais
   tempo, este numero sobe — a conferencia esta na tabela de `situacao` x ultima
   competencia, nao no chute.

   Quem saiu (`inativo`) NAO cabe em janela nenhuma: 470 desligados espalhados desde
   jan/2024. A tela nao inventa numero para eles — ver `placasIncompletas`.        */
const JANELA_ABERTAS = 12;
const MAX_PAGINAS_JANELA = 12; // teto de seguranca: ~2x a janela de hoje

// So o necessario para a proporcao apurado/pago (a regra de `abertas`) e para o
// saldo por pessoa. Nome, funcao e valores em R$ NAO entram: esta leitura existe
// para uma conta agregada, e dado de folha que nao vai a tela nao precisa descer.
const COLUNAS_JANELA = [
  "cracha", "situacao", "competencia",
  "he_apurada_h", "he_paga_h", "banco_pago_h", "saldo_acumulado_h",
].join(",");

// Modo "Por mes": varre as 33 competencias (12 paginas). `saldo_acumulado_h` nao
// entra de proposito — o acumulado da curva e recalculado somando o `movimento_h`
// do recorte de situacao escolhido, como faz o `get_banco_horas` do original.
const COLUNAS_MES = [
  "cracha", "situacao", "competencia",
  "he_apurada_h", "he_paga_h", "debito_h", "banco_pago_h",
  "he_pago_rs", "banco_pago_rs", "movimento_h",
].join(",");
const MAX_PAGINAS_MES = 40;

// Mesmas opcoes do original: o padrao e "ativos e afastados", que e o passivo em
// aberto — o saldo de quem saiu ja foi acertado na rescisao.
const SITUACOES = [
  { id: "abertos", label: "Ativos e afastados", valores: ["ativo", "afastado"] },
  { id: "ativo", label: "Só ativos", valores: ["ativo"] },
  { id: "afastado", label: "Só afastados", valores: ["afastado"] },
  { id: "inativo", label: "Só desligados", valores: ["inativo"] },
  { id: "todos", label: "Todas as situações", valores: null },
];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/* ── numeros ─────────────────────────────────────────────────────────────────
   O importador grava numero como texto e as vezes com virgula decimal — o
   `_bh_num` do original faz exatamente esta troca antes de somar. Sem isso,
   "12,5" vira NaN e o saldo da pessoa some da conta.                          */
function num(valor) {
  const n = Number(String(valor ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const umaCasa = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const emReais = (v) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 34.5 -> "34:30", com sinal. Conta em minutos inteiros de proposito: arredondar a
// fracao separadamente produz "34:60" quando o valor e 34,999.
function emHoras(v) {
  if (v == null) return "—";
  const total = Math.round(Math.abs(v) * 60);
  return `${v < 0 ? "−" : ""}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// "2026-08" (ou "2026-08-01") -> "ago/26"
function rotuloComp(c) {
  const partes = String(c || "").slice(0, 7).split("-");
  if (partes.length !== 2) return c || "—";
  return `${MESES[Number(partes[1]) - 1] || partes[1]}/${partes[0].slice(2)}`;
}

function dataBR(valor) {
  const iso = String(valor || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

const chaveComp = (c) => String(c || "").slice(0, 7);
const normalizar = (v) => String(v ?? "").trim().toLocaleLowerCase("pt-BR");

// Zero exato quase nao existe em hora apurada; o original trata |x| < 1h como
// "quitado" para nao pintar de vermelho quem deve 4 minutos.
function classeSinal(v) {
  if (v >= 1) return "ok";
  if (v <= -1) return "danger";
  return "mute";
}
function corSinal(v) {
  if (v >= 1) return "var(--dp-ok-ink)";
  if (v <= -1) return "var(--dp-danger-ink)";
  return "var(--dp-muted)";
}

function linhaNormalizada(l) {
  return {
    cracha: String(l.cracha ?? "").trim(),
    nome: l.colaborador || "",
    funcao: l.funcao || "",
    situacao: String(l.situacao ?? "").trim(),
    competencia: chaveComp(l.competencia),
    apurada: num(l.he_apurada_h),
    paga: num(l.he_paga_h),
    debito: num(l.debito_h),
    bancoH: num(l.banco_pago_h),
    reais: num(l.he_pago_rs) + num(l.banco_pago_rs),
    movimento: num(l.movimento_h),
    acumulado: num(l.saldo_acumulado_h),
  };
}

/* Competencias em que a folha ainda nao rodou. Propriedade do MES, nao da pessoa —
   por isso a conta corre sobre TODAS as linhas carregadas, antes de qualquer filtro
   de situacao: um aprendiz que nunca fez hora extra tem todo mes com pago zero, e
   nem por isso o mes esta aberto. */
function competenciasAbertas(linhas) {
  const apurado = new Map();
  const pago = new Map();
  linhas.forEach((l) => {
    if (!l.competencia) return;
    apurado.set(l.competencia, (apurado.get(l.competencia) || 0) + l.apurada);
    pago.set(l.competencia, (pago.get(l.competencia) || 0) + l.paga + l.bancoH);
  });
  const abertas = new Set();
  apurado.forEach((a, c) => {
    if (a > 0 && (pago.get(c) || 0) < 0.2 * a) abertas.add(c);
  });
  return abertas;
}

/* As duas placas do topo — o `total`/`total_fechado` do `get_banco_horas`.

   A conta e por PESSOA, pela linha mais nova dela, e nao "somando as linhas da
   ultima competencia". Parece a mesma coisa e nao e: cada um deixa de ter linha no
   mes em que sai, e o import do mes corrente pode chegar pela metade — em 06/09/2026
   a competencia mais nova da base tinha 15 linhas zeradas contra 332 ativos e
   afastados no mes anterior. Somar "a ultima competencia" mostraria o passivo de 15
   pessoas como se fosse o da unidade.

   `bruto` e o acumulado final de cada um (o `saldo` do original: a soma de todos os
   movimentos, que a coluna `saldo_acumulado_h` ja traz pronta). `fechado` e o mesmo
   parando na competencia fechada mais nova DELE — o original chega la somando o
   `movimento_h` das competencias fechadas, o que da o mesmo numero enquanto as
   abertas forem as mais recentes (e sao: a folha atrasa, nao volta no tempo), com a
   vantagem de nao precisar da serie inteira de cada pessoa. */
function saldosDaJanela(linhas, abertas) {
  const ultima = new Map();
  const fechada = new Map();
  linhas.forEach((l) => {
    if (!l.cracha || !l.competencia) return;
    const u = ultima.get(l.cracha);
    if (!u || l.competencia > u.competencia) ultima.set(l.cracha, l);
    if (abertas.has(l.competencia)) return;
    const f = fechada.get(l.cracha);
    if (!f || l.competencia > f.competencia) fechada.set(l.cracha, l);
  });
  const somar = (mapa) => [...mapa.values()].reduce((s, l) => s + l.acumulado, 0);
  return {
    pessoas: ultima.size,
    bruto: somar(ultima),
    // sem nenhuma competencia fechada nao existe numero para mostrar — melhor um
    // travessao do que um zero que parece "a empresa nao deve nada".
    fechado: fechada.size ? somar(fechada) : null,
    pessoasFechado: fechada.size,
  };
}

/* Uma linha por competencia (o `meses` do `get_banco_horas`): a curva do passivo.
   O `acumulado` NAO e o `saldo_acumulado_h` da tabela — e a soma corrida do
   `movimento_h` DEPOIS do filtro de situacao, senao trocar para "só ativos" mudaria
   as colunas do mes e deixaria a curva com o acumulado de todo mundo. */
function resumoPorMes(linhas) {
  const meses = new Map();
  linhas.forEach((l) => {
    if (!l.competencia) return;
    let m = meses.get(l.competencia);
    if (!m) {
      m = {
        competencia: l.competencia, crachas: new Set(),
        apurada: 0, paga: 0, debito: 0, bancoH: 0, reais: 0, movimento: 0,
      };
      meses.set(l.competencia, m);
    }
    if (l.cracha) m.crachas.add(l.cracha);
    m.apurada += l.apurada;
    m.paga += l.paga;
    m.debito += l.debito;
    m.bancoH += l.bancoH;
    m.reais += l.reais;
    m.movimento += l.movimento;
  });
  const lista = [...meses.values()].sort((a, b) => (a.competencia < b.competencia ? -1 : 1));
  let acumulado = 0;
  lista.forEach((m) => {
    acumulado += m.movimento;
    m.acumulado = acumulado;
    m.pessoas = m.crachas.size;
  });
  return lista;
}

// Lista de competencias do seletor a partir do primeiro e do ultimo mes da tabela.
// Duas leituras de 1 linha resolvem: o PostgREST nao faz DISTINCT, e varrer a base
// so para montar um <select> custaria ~16 idas ao gateway.
function faixaDeCompetencias(primeira, ultima) {
  const ini = chaveComp(primeira);
  const fim = chaveComp(ultima);
  if (!/^\d{4}-\d{2}$/.test(ini) || !/^\d{4}-\d{2}$/.test(fim)) {
    return [fim, ini].filter((c) => /^\d{4}-\d{2}$/.test(c));
  }
  const saida = [];
  let ano = Number(ini.slice(0, 4));
  let mes = Number(ini.slice(5, 7));
  const anoFim = Number(fim.slice(0, 4));
  const mesFim = Number(fim.slice(5, 7));
  // teto de seguranca: se a base vier com uma competencia maluca, nao trava a aba
  for (let i = 0; i < 600 && (ano < anoFim || (ano === anoFim && mes <= mesFim)); i += 1) {
    saida.push(`${ano}-${String(mes).padStart(2, "0")}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return saida.reverse();
}

// A competencia pode estar gravada como "2026-08" (texto) ou "2026-08-01" (data). O
// filtro por faixa funciona nos dois formatos; `eq.` so funcionaria no primeiro.
function filtroDaCompetencia(comp, formatoLongo) {
  if (!comp || comp === "todas") return undefined;
  if (formatoLongo) return { competencia: [`gte.${comp}-01`, `lte.${comp}-31`] };
  return { competencia: `eq.${comp}` };
}

/* ── trilha de quem exportou ──────────────────────────────────────────────────
   Mesma checagem de autor que o resto do INOVE faz (molde:
   EstruturaFisicaSolicitacao.jsx): o `user.id` pode ser o id LEGADO (inteiro da
   `usuarios_aprovadores`) de quem ainda nao tem conta no `auth.users`, e mandar
   isso num campo `uuid` derruba o insert inteiro com erro de tipo — o que, aqui,
   significaria bloquear a exportacao de quem tinha direito a ela.               */
function ehUUID(valor) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(valor ?? "").trim(),
  );
}

function uuidDoUsuario(user) {
  if (ehUUID(user?.auth_user_id)) return String(user.auth_user_id).trim();
  if (ehUUID(user?.id)) return String(user.id).trim();
  return null; // usuario legado: fica so o nome, que e melhor que nada
}

// `criado_em` fica com o `default now()` do banco de proposito: carimbo de instante
// e do servidor, nao do relogio (nem do fuso) do navegador.
async function registrarAuditoria({ acao, alvo, detalhe, user }) {
  const { error } = await supabase.from(TABELA_AUDITORIA).insert({
    acao,
    alvo: String(alvo ?? "").trim() || null,
    detalhe: detalhe || {},
    autor_id: uuidDoUsuario(user),
    autor_nome: String(user?.nome || user?.login || "").trim() || null,
  });
  // Erro REAL do servidor, sem maquiar: "new row violates row-level security" ou
  // "relation ... does not exist" (migration ainda nao aplicada) tem de aparecer na
  // tela — senao a exportacao "some" sem ninguem entender por que.
  if (error) throw new Error(error.message || "Não foi possível registrar a auditoria.");
}

/* Colunas do CSV, no formato que o `baixarCsv` da TabelaDP espera ({id, titulo,
   valor}). Sao as MESMAS colunas da tela, na mesma ordem — e nada alem delas: nem
   `celular`, nem admissao/desligamento, que nem sao lidos na listagem.

   Numeros saem CRUS (34.5), nao formatados ("34:30"): o `celulaCsv` troca o ponto
   pela virgula e o Excel pt-BR le como numero. "34:30" viraria texto e ninguem
   consegue somar uma coluna de texto.                                            */
function colunasDoCsv(comp, abertas) {
  const daLinha = (l) => (comp === "todas" ? l.ultima : l.competencia);
  return [
    { id: "colaborador", titulo: "Colaborador", valor: (l) => l.nome },
    { id: "cracha", titulo: "Crachá", valor: (l) => l.cracha },
    { id: "funcao", titulo: "Função", valor: (l) => l.funcao },
    { id: "situacao", titulo: "Situação", valor: (l) => l.situacao },
    { id: "competencia", titulo: "Competência", valor: daLinha },
    ...(comp === "todas"
      ? [{ id: "meses", titulo: "Meses somados", valor: (l) => l.meses || 1 }]
      : []),
    // Sem esta coluna, um mes sem folha paga sai do sistema com o saldo inflado e
    // nada no arquivo dizendo isso — na tela o aviso existe, na planilha sumiria.
    { id: "sem_folha", titulo: "Sem folha paga", valor: (l) => (abertas.has(daLinha(l)) ? "sim" : "não") },
    { id: "he_apurada_h", titulo: "HE apurada (h)", valor: (l) => l.apurada },
    { id: "he_paga_h", titulo: "HE paga (h)", valor: (l) => l.paga },
    { id: "debito_h", titulo: "Débito (h)", valor: (l) => l.debito },
    { id: "banco_pago_h", titulo: "Banco pago (h)", valor: (l) => l.bancoH },
    { id: "pago_rs", titulo: "Pago (R$)", valor: (l) => l.reais },
    { id: "movimento_h", titulo: "Movimento (h)", valor: (l) => l.movimento },
    { id: "saldo_acumulado_h", titulo: "Saldo acumulado (h)", valor: (l) => l.acumulado },
  ];
}

/* Colunas do CSV do modo "Por mes". Agregado por competencia: nao ha nome nem
   cracha aqui, mas a trilha continua valendo igual — e a mesma folha vista de cima,
   e quem exportou a curva do passivo tem de ficar registrado do mesmo jeito. */
function colunasDoCsvMes(abertas) {
  return [
    { id: "competencia", titulo: "Competência", valor: (m) => m.competencia },
    { id: "sem_folha", titulo: "Sem folha paga", valor: (m) => (abertas.has(m.competencia) ? "sim" : "não") },
    { id: "pessoas", titulo: "Pessoas", valor: (m) => m.pessoas },
    { id: "he_apurada_h", titulo: "HE apurada (h)", valor: (m) => m.apurada },
    { id: "he_paga_h", titulo: "HE paga (h)", valor: (m) => m.paga },
    { id: "debito_h", titulo: "Débito (h)", valor: (m) => m.debito },
    { id: "banco_pago_h", titulo: "Banco pago (h)", valor: (m) => m.bancoH },
    { id: "pago_rs", titulo: "Pago (R$)", valor: (m) => m.reais },
    { id: "movimento_h", titulo: "Movimento (h)", valor: (m) => m.movimento },
    { id: "acumulado_h", titulo: "Acumulado (h)", valor: (m) => m.acumulado },
  ];
}

// NUNCA `new Date().toISOString()` para uma data LOCAL (CLAUDE.md): ele devolve UTC
// e, das 21h BRT em diante, o arquivo sairia carimbado com o dia SEGUINTE.
function isoHojeLocal() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function DP360BancoHoras() {
  // A confirmação é a da ferramenta, não a do navegador (ver `Perguntar.jsx`): o
  // `window.confirm` escrevia "inovequatai.onrender.com diz" em cima da pergunta,
  // ignorava o tema e espremia tudo num bloco só.
  const [perguntar, caixaPergunta] = usePergunta();
  const { user } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const podeAcessar = canUserAccessPath(user, "/dp360-banco-horas", profileMap);

  const [competencias, setCompetencias] = useState([]);
  const [formatoLongo, setFormatoLongo] = useState(false);
  const [comp, setComp] = useState("");
  const [situacao, setSituacao] = useState("abertos");
  const [busca, setBusca] = useState("");
  const [modo, setModo] = useState("pessoa"); // "pessoa" | "mes"

  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [recarga, setRecarga] = useState(0);

  // Janela recente: de onde saem `abertas` e as duas placas. Nao depende do
  // <select> de competencia — esse e o conserto.
  const [janela, setJanela] = useState({ carregando: false, erro: "", linhas: [], de: "" });

  // Varredura das 33 competencias, so quando o modo "Por mes" e aberto. Fica em
  // cache no estado ate o Recarregar, porque sao 12 idas ao gateway.
  const [meses, setMeses] = useState({ carregando: false, carregado: false, erro: "", linhas: [] });

  const [pessoaSel, setPessoaSel] = useState(null);
  const [extrato, setExtrato] = useState({ carregando: false, erro: "", linhas: [], pessoa: null });

  const [exportando, setExportando] = useState(false);
  const [avisoExport, setAvisoExport] = useState(null); // { tom: "ok"|"danger", texto }

  /* ── passo 1: descobrir a faixa de competencias (2 leituras de 1 linha) ── */
  useEffect(() => {
    if (!podeAcessar) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro("");
    Promise.all([
      lerDP360(TABELA, { colunas: "competencia", ordem: "competencia.asc", limite: 1 }),
      lerDP360(TABELA, { colunas: "competencia", ordem: "competencia.desc", limite: 1 }),
    ])
      .then(([inicio, fim]) => {
        if (!ativo) return;
        const primeira = inicio?.[0]?.competencia || "";
        const ultima = fim?.[0]?.competencia || "";
        setFormatoLongo(String(ultima).length > 7);
        const lista = faixaDeCompetencias(primeira, ultima);
        setCompetencias(lista);
        setComp((atual) => atual || lista[0] || "");
        if (!lista.length) setCarregando(false);
      })
      .catch((falha) => {
        if (!ativo) return;
        setErro(falha?.message || "Não foi possível consultar a base DP360.");
        setCarregando(false);
      });
    return () => { ativo = false; };
  }, [podeAcessar, recarga]);

  /* ── passo 2: a janela recente (2 paginas) — `abertas` e as placas ──
     Roda uma vez por carga, independente do que estiver escolhido no seletor: o
     mes estar sem folha e fato da unidade, nao do recorte em tela.            */
  const inicioJanela = useMemo(() => {
    if (!competencias.length) return "";
    // `competencias` vem da mais nova para a mais antiga
    return competencias[Math.min(JANELA_ABERTAS, competencias.length) - 1] || "";
  }, [competencias]);

  useEffect(() => {
    if (!podeAcessar || !inicioJanela) return undefined;
    let ativo = true;
    setJanela((j) => ({ ...j, carregando: true, erro: "" }));
    lerTudoDP360(TABELA, {
      colunas: COLUNAS_JANELA,
      // texto "2026-04" ou data "2026-04-01": nos dois o `gte.` compara na ordem certa
      filtros: { competencia: formatoLongo ? `gte.${inicioJanela}-01` : `gte.${inicioJanela}` },
      ordem: "competencia.asc,cracha.asc",
    }, MAX_PAGINAS_JANELA)
      .then((dados) => {
        if (!ativo) return;
        setJanela({ carregando: false, erro: "", linhas: dados.map(linhaNormalizada), de: inicioJanela });
      })
      .catch((falha) => {
        if (!ativo) return;
        setJanela({
          carregando: false,
          erro: falha?.message || "Não foi possível apurar as competências sem folha.",
          linhas: [],
          de: inicioJanela,
        });
      });
    return () => { ativo = false; };
  }, [podeAcessar, inicioJanela, formatoLongo, recarga]);

  /* ── passo 3: a varredura completa, so no modo "Por mes" ──
     12 paginas. O controle de "ja pedi" e uma REF, e nao o proprio estado `meses`:
     com o estado nas dependencias, o `setMeses({carregando:true})` mudaria as
     dependencias, o efeito rodaria de novo, a limpeza do anterior marcaria a
     requisicao como abandonada e o resultado das 12 paginas seria jogado fora — a
     tela ficaria carregando para sempre. A ref guarda qual `recarga` ja foi
     atendida e nao provoca re-render.

     Nao ha retentativa automatica de proposito: se falhar, o erro fica na tela e o
     efeito para — quem quiser tentar de novo usa o Recarregar, que e um clique, e
     nao 12 idas ao gateway em loop.                                           */
  const varreduraPedida = useRef(-1);
  useEffect(() => {
    if (!podeAcessar || modo !== "mes") return undefined;
    if (varreduraPedida.current === recarga) return undefined;
    varreduraPedida.current = recarga;
    let ativo = true;
    let concluiu = false;
    setMeses({ carregando: true, carregado: false, erro: "", linhas: [] });
    lerTudoDP360(TABELA, { colunas: COLUNAS_MES, ordem: "competencia.asc,cracha.asc" }, MAX_PAGINAS_MES)
      .then((dados) => {
        concluiu = true;
        if (!ativo) return;
        setMeses({ carregando: false, carregado: true, erro: "", linhas: dados.map(linhaNormalizada) });
      })
      .catch((falha) => {
        concluiu = true;
        if (!ativo) return;
        setMeses({
          carregando: false,
          carregado: false,
          erro: falha?.message || "Não foi possível varrer as competências.",
          linhas: [],
        });
      });
    // Voltar para "por colaborador" no meio da varredura descarta o resultado; sem
    // soltar a ref, o modo por mes nunca mais tentaria de novo.
    return () => { ativo = false; if (!concluiu) varreduraPedida.current = -1; };
  }, [podeAcessar, modo, recarga]);

  /* ── passo 4: carregar as linhas da competencia escolhida ──
     Uma competencia = ~1 pagina (uma linha por colaborador). "Todas" varre a base
     inteira, por isso e uma escolha explicita e nunca o padrao. Nao depende do
     modo: e uma pagina so, e trocar de modo e voltar nao paga de novo por ela. */
  useEffect(() => {
    if (!podeAcessar || !comp) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro("");
    lerTudoDP360(TABELA, {
      colunas: COLUNAS_LISTA,
      filtros: filtroDaCompetencia(comp, formatoLongo),
      ordem: "competencia.asc,cracha.asc",
    })
      .then((dados) => { if (ativo) setLinhas(dados.map(linhaNormalizada)); })
      .catch((falha) => {
        if (!ativo) return;
        setLinhas([]);
        setErro(falha?.message || "Não foi possível consultar a base DP360.");
      })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [podeAcessar, comp, formatoLongo, recarga]);

  /* ── extrato da pessoa (o `get_banco_horas_pessoa` do original) ── */
  useEffect(() => {
    const cracha = pessoaSel?.cracha;
    if (!cracha) return undefined;
    // O gateway recusa valor de filtro com & ou # — cracha e numerico, mas se vier
    // sujo a tela avisa em vez de estourar um 400 sem explicacao.
    if (!/^[A-Za-z0-9._-]+$/.test(cracha)) {
      setExtrato({ carregando: false, erro: "Crachá em formato inesperado.", linhas: [], pessoa: null });
      return undefined;
    }
    let ativo = true;
    setExtrato({ carregando: true, erro: "", linhas: [], pessoa: null });
    lerDP360(TABELA, {
      colunas: COLUNAS_EXTRATO,
      filtros: { cracha: `eq.${cracha}` },
      ordem: "competencia.asc",
      limite: 500,
    })
      .then((dados) => {
        if (!ativo) return;
        const cru = dados[0] || null;
        setExtrato({
          carregando: false,
          erro: "",
          linhas: dados.map(linhaNormalizada),
          pessoa: cru && {
            nome: cru.colaborador || "",
            cracha: String(cru.cracha ?? "").trim(),
            funcao: cru.funcao || "",
            situacao: cru.situacao || "",
            admissao: dataBR(cru.admissao),
            desligamento: dataBR(cru.desligamento),
            afastadoDesde: dataBR(cru.afastado_desde),
            afastadoAte: dataBR(cru.afastado_ate),
          },
        });
      })
      .catch((falha) => {
        if (!ativo) return;
        setExtrato({
          carregando: false,
          erro: falha?.message || "Não foi possível carregar o extrato.",
          linhas: [],
          pessoa: null,
        });
      });
    return () => { ativo = false; };
  }, [pessoaSel]);

  const fecharExtrato = useCallback(() => {
    setPessoaSel(null);
    setExtrato({ carregando: false, erro: "", linhas: [], pessoa: null });
  }, []);

  useEffect(() => {
    if (!pessoaSel) return undefined;
    const aoTeclar = (e) => { if (e.key === "Escape") fecharExtrato(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [pessoaSel, fecharExtrato]);

  /* `abertas`: da varredura completa quando ela existe (exata, 33 competencias) e
     da janela recente no resto do tempo. NUNCA das linhas em tela — era dai que
     vinha o defeito: a resposta mudava conforme o mes escolhido no seletor. E
     sempre antes de qualquer filtro de situacao: um aprendiz que nunca fez hora
     extra tem todo mes com pago zero, e nem por isso o mes esta aberto.        */
  const abertas = useMemo(
    () => competenciasAbertas(meses.linhas.length ? meses.linhas : janela.linhas),
    [meses.linhas, janela.linhas],
  );

  const alvoSituacao = useMemo(
    () => SITUACOES.find((s) => s.id === situacao)?.valores || null,
    [situacao],
  );
  const naSituacao = useCallback(
    (l) => !alvoSituacao || alvoSituacao.includes(normalizar(l.situacao)),
    [alvoSituacao],
  );

  // As placas do topo. Saem da janela (ou da varredura, se ela ja estiver na mao),
  // e nao das linhas em tela: sao o passivo da unidade HOJE, nao o do mes aberto no
  // seletor. A busca tambem nao mexe nelas — filtrar por um nome nao muda quanto a
  // empresa deve.
  const placas = useMemo(() => {
    const base = (meses.linhas.length ? meses.linhas : janela.linhas).filter(naSituacao);
    return saldosDaJanela(base, abertas);
  }, [meses.linhas, janela.linhas, naSituacao, abertas]);

  /* Filtro que inclui desligado + janela = numero sabidamente incompleto (medido:
     531 dos 838, −2.154 h contra −3.150 h reais). Numero errado numa placa de
     decisao e pior do que placa sem numero, entao aqui ela diz o que falta e como
     conseguir — a varredura do modo "Por mes" alcanca a base toda. */
  const placasIncompletas = useMemo(
    () => (situacao === "inativo" || situacao === "todos") && !meses.linhas.length,
    [situacao, meses.linhas.length],
  );

  // Curva do passivo, uma linha por competencia (modo "Por mes").
  const linhasMes = useMemo(
    () => resumoPorMes(meses.linhas.filter(naSituacao)).reverse(), // mais nova primeiro
    [meses.linhas, naSituacao],
  );

  const filtradas = useMemo(() => linhas.filter(naSituacao), [linhas, naSituacao]);

  // Em "todas as competências" a tabela vira uma linha por pessoa: soma os meses e
  // leva o `saldo_acumulado_h` da ULTIMA competencia (que ja e o saldo corrido).
  const agregadas = useMemo(() => {
    if (comp !== "todas") return filtradas;
    const porPessoa = new Map();
    filtradas.forEach((l) => {
      const atual = porPessoa.get(l.cracha);
      if (!atual) {
        porPessoa.set(l.cracha, { ...l, meses: 1, ultima: l.competencia });
        return;
      }
      atual.meses += 1;
      atual.apurada += l.apurada;
      atual.paga += l.paga;
      atual.debito += l.debito;
      atual.bancoH += l.bancoH;
      atual.reais += l.reais;
      atual.movimento += l.movimento;
      if (l.competencia >= atual.ultima) {
        atual.ultima = l.competencia;
        atual.acumulado = l.acumulado;
        atual.situacao = l.situacao;
        atual.nome = l.nome || atual.nome;
        atual.funcao = l.funcao || atual.funcao;
      }
    });
    return [...porPessoa.values()];
  }, [filtradas, comp]);

  const visiveis = useMemo(() => {
    const q = normalizar(busca);
    const base = q
      ? agregadas.filter((l) => normalizar(l.nome).includes(q)
        || normalizar(l.cracha).includes(q)
        || normalizar(l.funcao).includes(q))
      : agregadas;
    return [...base].sort((a, b) => b.acumulado - a.acumulado);
  }, [agregadas, busca]);

  const resumo = useMemo(() => {
    const receber = visiveis.filter((l) => l.acumulado >= 1).length;
    const devendo = visiveis.filter((l) => l.acumulado <= -1).length;
    const somar = (campo) => visiveis.reduce((soma, l) => soma + l[campo], 0);
    return {
      pessoas: visiveis.length,
      receber,
      devendo,
      quitados: visiveis.length - receber - devendo,
      saldo: somar("acumulado"),
      reais: somar("reais"),
      apurada: somar("apurada"),
      paga: somar("paga"),
    };
  }, [visiveis]);

  const resumoMes = useMemo(() => {
    const somar = (campo) => linhasMes.reduce((soma, m) => soma + m[campo], 0);
    return {
      competencias: linhasMes.length,
      apurada: somar("apurada"),
      paga: somar("paga"),
      reais: somar("reais"),
      movimento: somar("movimento"),
    };
  }, [linhasMes]);

  // Linhas escondidas por situação fora do padrão (ativo/afastado/inativo): sem este
  // aviso, uma grafia nova no importador sumiria com gente da tela em silêncio.
  const foraDoPadrao = useMemo(() => {
    const conhecidas = new Set(["ativo", "afastado", "inativo"]);
    return linhas.filter((l) => !conhecidas.has(normalizar(l.situacao))).length;
  }, [linhas]);

  // Todas as competencias sem folha que a tela conhece (nao so a que esta em tela):
  // e o que a placa "bruto" esta contando a mais.
  const rotuloAbertas = useMemo(() => [...abertas].sort().map(rotuloComp).join(", "), [abertas]);

  // O aviso em cima da tabela continua falando do RECORTE em tela, que e onde o
  // numero inflado aparece: a competencia escolhida, ou todas em "por mês".
  const avisoAbertas = useMemo(() => {
    if (modo === "mes" || comp === "todas") return rotuloAbertas;
    return abertas.has(comp) ? rotuloComp(comp) : "";
  }, [abertas, comp, modo, rotuloAbertas]);

  /* ── exportar: a TRILHA PRIMEIRO, e ela manda ─────────────────────────────
     Ordem deliberada: grava `dp360_auditoria`, e so entao gera o arquivo. Se o
     insert falhar (RLS, sessao caida, migration nao aplicada), a funcao PARA e
     mostra o erro do servidor — nao existe download sem registro. O inverso
     (baixar e depois tentar registrar) deixaria o CSV de folha na rua com a
     trilha vazia, que e exatamente o que a condicao no topo do arquivo proibia. */
  const exportar = useCallback(async () => {
    // O modo manda no que sai: por colaborador e a folha nominal; por mes e a mesma
    // folha agregada. A trilha e a mesma nos dois — e agregado ainda e folha.
    const porMes = modo === "mes";
    const dados = porMes ? linhasMes : visiveis;
    if (exportando || !dados.length) return;

    const colunas = porMes ? colunasDoCsvMes(abertas) : colunasDoCsv(comp, abertas);
    const recorte = porMes ? "por-mes" : (comp || "sem-competencia");
    const nome = `banco_horas_${recorte}_${situacao}_${isoHojeLocal()}`;
    const termo = porMes ? "" : busca.trim();

    const ok = await perguntar(
      [
        `Exportar ${dados.length} linha(s) do banco de horas em CSV?`,
        "",
        porMes
          ? `Uma linha por competência (${dados.length}) · situação: ${
            SITUACOES.find((s) => s.id === situacao)?.label || situacao
          }`
          : `Competência: ${comp === "todas" ? "todas" : rotuloComp(comp)} · situação: ${
            SITUACOES.find((s) => s.id === situacao)?.label || situacao
          }${termo ? ` · busca: “${termo}”` : ""}`,
        "",
        porMes
          ? "O arquivo tem hora extra e valor em R$ da unidade, mês a mês. A exportação"
          : "O arquivo tem hora extra e valor em R$ por colaborador. A exportação",
        `fica registrada em ${TABELA_AUDITORIA} com o seu nome, o recorte e a data.`,
      ].join("\n"),
    );
    if (!ok) return;

    setExportando(true);
    setAvisoExport(null);
    try {
      await registrarAuditoria({
        acao: "banco_horas_export",
        alvo: recorte, // a competencia (ou "por-mes"): o "sobre o que" desta acao
        detalhe: {
          modo: porMes ? "mes" : "pessoa",
          linhas: dados.length,
          colunas: colunas.map((c) => c.id),
          filtro: {
            competencia: porMes ? "todas" : comp,
            situacao,
            busca: termo || null,
          },
          arquivo: `${nome}.csv`,
        },
        user,
      });
    } catch (falha) {
      setAvisoExport({
        tom: "danger",
        texto: `Exportação cancelada: a trilha de auditoria não pôde ser registrada — ${
          falha?.message || "erro desconhecido"
        }`,
      });
      setExportando(false);
      return; // sem trilha, sem arquivo.
    }

    // So aqui o arquivo desce. `baixarCsv` e o mesmo escritor das outras abas
    // (`;` + BOM UTF-8, para o Excel pt-BR abrir com acento e coluna certa).
    baixarCsv(nome, colunas, dados);
    setAvisoExport({
      tom: "ok",
      texto: `✓ ${dados.length} linha(s) exportadas · registrado em ${TABELA_AUDITORIA}`,
    });
    setExportando(false);
  }, [exportando, modo, linhasMes, visiveis, comp, abertas, situacao, busca, user]);

  if (!podeAcessar) {
    return (
      <div className="mx-auto max-w-3xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto text-amber-700" size={30} />
        <h1 className="mt-3 text-xl font-black text-slate-900">Sem acesso ao Banco de Horas</h1>
        <p className="mt-2 text-sm text-slate-700">
          A tela mostra hora extra e valores de folha por colaborador: o acesso é exclusivo
          de Administrador do INOVE.
        </p>
      </div>
    );
  }

  const totalColunas = 12;
  const porMes = modo === "mes";
  const exportaveis = porMes ? linhasMes.length : visiveis.length;
  const carregandoTabela = porMes ? meses.carregando : carregando;
  const erroTabela = porMes ? meses.erro : erro;

  return (
    <div className="dp360 -m-4 sm:-m-6">
      {caixaPergunta}
      <div className="dp-topbar">
        <div className="dp-brand">
          <div className="dp-brand-mark">DP</div>
          <div>
            <div className="dp-brand-title">Banco de Horas</div>
            <div className="dp-brand-sub">DP360 · apurado no ponto menos o pago na folha</div>
          </div>
        </div>
        <nav className="dp-tabs" aria-label="Voltar para a DP360">
          <Link to="/dp360" className="dp-tab">← DP360</Link>
        </nav>
      </div>

      {/* As duas placas do original: o passivo da unidade HOJE, com e sem os meses
          que a folha ainda não pagou. Não obedecem ao seletor de competência nem à
          busca de propósito — é o número de "quanto a empresa deve", e ele não pode
          mudar porque alguém foi olhar agosto ou digitou um nome. */}
      <div className="bh-placas">
        <div className={`bh-placa ${janela.erro || placasIncompletas ? "mute" : classeSinal(placas.fechado ?? 0)}`}>
          <div className="n">
            {janela.erro || placasIncompletas ? "—"
              : (janela.carregando && !placas.pessoas ? "…"
                : (placas.fechado == null ? "—" : emHoras(placas.fechado)))}
          </div>
          <div className="l">
            Saldo <b>com a folha fechada</b>
            <br />
            {janela.erro ? <span className="dp-pill danger">{janela.erro}</span>
              : placasIncompletas
                ? <>quem saiu não cabe na janela de {JANELA_ABERTAS} meses — abra <b>📅 Por mês</b> para varrer a base inteira</>
                : (placas.fechado == null
                  ? `nenhuma competência fechada nas ${JANELA_ABERTAS} mais recentes`
                  : <><b>{placas.pessoasFechado}</b> colaborador(es) · é este o número para decidir</>)}
          </div>
        </div>
        {/* Só fica em tom de aviso quando há de fato mês sem folha: pintar de âmbar
            um número idêntico ao de cima ensinaria a ignorar a cor. */}
        <div className={`bh-placa ${placasIncompletas || !rotuloAbertas ? "mute" : "aberto"}`}>
          <div className="n">
            {janela.erro || placasIncompletas ? "—"
              : (janela.carregando && !placas.pessoas ? "…" : emHoras(placas.bruto))}
          </div>
          <div className="l">
            Saldo bruto, incluindo
            <br />
            {placasIncompletas
              ? <span className="dp-faint">mesma janela, mesmo limite</span>
              : rotuloAbertas
                ? <><b>{rotuloAbertas}</b> sem folha paga</>
                : <span className="dp-faint">nenhum mês sem folha · {placas.pessoas} colaborador(es)</span>}
          </div>
        </div>
      </div>

      <div className="dp-viewbar">
        <span className="bh-modos" role="group" aria-label="Modo de exibição">
          <button
            type="button"
            className={`dp-chip-f ${porMes ? "" : "on"}`}
            aria-pressed={!porMes}
            onClick={() => setModo("pessoa")}
          >
            👤 Por colaborador
          </button>
          <button
            type="button"
            className={`dp-chip-f ${porMes ? "on" : ""}`}
            aria-pressed={porMes}
            onClick={() => setModo("mes")}
            title="Uma linha por competência: HE apurada, HE paga e a curva do passivo. Varre as competências todas (12 idas à base) na primeira vez."
          >
            📅 Por mês
          </button>
        </span>

        <label>
          <span className="dp-muted" style={{ marginRight: 6 }}>Competência</span>
          <select
            value={comp}
            onChange={(e) => setComp(e.target.value)}
            aria-label="Competência"
            disabled={porMes}
            title={porMes ? "No modo por mês aparecem todas as competências." : undefined}
          >
            {competencias.map((c) => (
              <option key={c} value={c}>{rotuloComp(c)}</option>
            ))}
            <option value="todas">Todas (varre a base)</option>
          </select>
        </label>

        <label>
          <span className="dp-muted" style={{ marginRight: 6 }}>Situação</span>
          <select
            value={situacao}
            onChange={(e) => setSituacao(e.target.value)}
            aria-label="Situação"
          >
            {SITUACOES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>

        <span className="dp-busca">
          <Search size={14} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, crachá ou função"
            aria-label="Buscar colaborador"
            disabled={porMes}
          />
        </span>

        <button
          type="button"
          className="dp-btn"
          onClick={() => {
            setMeses({ carregando: false, carregado: false, erro: "", linhas: [] });
            setRecarga((n) => n + 1);
          }}
          disabled={carregandoTabela || janela.carregando}
        >
          <RefreshCw size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          Recarregar
        </button>

        <button
          type="button"
          className="dp-btn"
          onClick={exportar}
          disabled={carregandoTabela || exportando || !exportaveis}
          title="Baixa as linhas em tela (hora extra e R$). Fica registrado quem exportou."
        >
          <Download size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
          {exportando ? "Registrando…" : "Exportar CSV"}
        </button>
      </div>

      {avisoExport && (
        <div className="dp-resumo">
          <span className={`dp-pill ${avisoExport.tom}`}>{avisoExport.texto}</span>
        </div>
      )}

      {erroTabela ? (
        <div className="dp-resumo"><span className="dp-pill danger">{erroTabela}</span></div>
      ) : porMes ? (
        <div className="dp-resumo">
          <b>{resumoMes.competencias}</b> competência(s) · HE apurada{" "}
          <b className="dp-num dp-mono">{umaCasa(resumoMes.apurada)}</b> · HE paga{" "}
          <b className="dp-num dp-mono">{umaCasa(resumoMes.paga)}</b> · pago{" "}
          <b className="dp-num dp-mono">R$ {emReais(resumoMes.reais)}</b> · movimento somado{" "}
          <b className="dp-num dp-mono" style={{ color: corSinal(resumoMes.movimento) }}>
            {emHoras(resumoMes.movimento)}
          </b>
          {". O acumulado é a curva do passivo mês a mês."}
        </div>
      ) : (
        <div className="dp-resumo">
          <b>{resumo.pessoas}</b> colaborador(es) ·{" "}
          <b style={{ color: "var(--dp-ok-ink)" }}>{resumo.receber}</b> a receber ·{" "}
          <b style={{ color: "var(--dp-danger-ink)" }}>{resumo.devendo}</b> devendo ·{" "}
          <b>{resumo.quitados}</b> quitado(s) · HE apurada{" "}
          <b className="dp-num dp-mono">{umaCasa(resumo.apurada)}</b> · HE paga{" "}
          <b className="dp-num dp-mono">{umaCasa(resumo.paga)}</b> · saldo somado{" "}
          <b className="dp-num dp-mono" style={{ color: corSinal(resumo.saldo) }}>{emHoras(resumo.saldo)}</b>
          {" · pago "}
          <b className="dp-num dp-mono">R$ {emReais(resumo.reais)}</b>
          {". Clique numa linha para o extrato mês a mês."}
        </div>
      )}

      {!erroTabela && avisoAbertas && (
        <div className="dp-resumo">
          <span className="dp-pill warn">⚠ {avisoAbertas} sem folha paga</span>{" "}
          <span className="dp-muted">
            a competência aparece com as horas apuradas e nada pago, o que infla o saldo.
            Para decisão, use um mês já fechado.
          </span>
        </div>
      )}

      {!erroTabela && !porMes && foraDoPadrao > 0 && situacao !== "todos" && (
        <div className="dp-resumo dp-faint">
          {foraDoPadrao} linha(s) com situação fora do padrão ficaram de fora — use
          “Todas as situações” para vê-las.
        </div>
      )}

      {/* De onde saem `abertas` e as placas — dito em voz alta, porque a resposta
          depende do alcance: a janela pega os meses que podem estar sem folha, a
          varredura do modo "por mês" cobre a base inteira. */}
      {!janela.erro && !janela.carregando && (
        <div className="dp-resumo dp-faint">
          {meses.linhas.length
            ? `“Sem folha paga” e as placas do topo conferidas nas ${competencias.length} competências da base.`
            : `“Sem folha paga” e as placas do topo conferidas nas ${JANELA_ABERTAS} competências mais recentes${
              janela.de ? ` (desde ${rotuloComp(janela.de)})` : ""
            } — alcança todo ativo e afastado. Para incluir quem saiu, abra “📅 Por mês”, que varre a base inteira.`}
        </div>
      )}

      {carregandoTabela ? (
        <div className="dp-tabela-wrap">
          <div className="dp-vazio">
            {porMes
              ? "Varrendo as competências (uma leitura só, e fica guardada até o Recarregar)…"
              : "Carregando o banco de horas…"}
          </div>
        </div>
      ) : porMes ? (
        /* Modo "Por mês": a curva do passivo. O acumulado é a soma corrida do
           movimento do recorte escolhido — é ele que responde "o passivo está
           crescendo?" sem abrir 33 competências uma a uma. */
        <div className="dp-tabela-wrap">
          <table className="dp-tabela">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Pessoas</th>
                <th>HE apurada</th>
                <th>HE paga</th>
                <th>Débito</th>
                <th>Banco pago</th>
                <th>Pago (R$)</th>
                <th>Movimento</th>
                <th>Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {linhasMes.map((m) => (
                <tr key={m.competencia} className={abertas.has(m.competencia) ? "bh-mes-aberto" : undefined}>
                  <td>
                    <b>{rotuloComp(m.competencia)}</b>
                    {abertas.has(m.competencia) && (
                      <span className="dp-pill warn" style={{ marginLeft: 6 }}>sem folha</span>
                    )}
                  </td>
                  <td className="dp-num">{m.pessoas}</td>
                  <td className="dp-num">{umaCasa(m.apurada)}</td>
                  <td className="dp-num">{umaCasa(m.paga)}</td>
                  <td className="dp-num">{m.debito ? umaCasa(m.debito) : "—"}</td>
                  <td className="dp-num">{m.bancoH ? umaCasa(m.bancoH) : "—"}</td>
                  <td className="dp-num dp-mono">{m.reais ? `R$ ${emReais(m.reais)}` : "—"}</td>
                  <td className="dp-num dp-mono">
                    <b style={{ color: corSinal(m.movimento) }}>{emHoras(m.movimento)}</b>
                  </td>
                  <td className="dp-num">
                    <span className={`dp-pill ${classeSinal(m.acumulado)} dp-mono`}>{emHoras(m.acumulado)}</span>
                  </td>
                </tr>
              ))}
              {!linhasMes.length && (
                <tr>
                  <td colSpan={9} className="dp-faint" style={{ textAlign: "center", padding: "22px" }}>
                    Sem movimento no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="dp-tabela-wrap">
          <table className="dp-tabela">
            <thead>
              <tr>
                <th>Colaborador</th>
                <th>Crachá</th>
                <th>Função</th>
                <th>Situação</th>
                <th>Competência</th>
                <th>HE apurada</th>
                <th>HE paga</th>
                <th>Débito</th>
                <th>Banco pago</th>
                <th>Pago (R$)</th>
                <th>Movimento</th>
                <th>Saldo acumulado</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr
                  key={`${l.cracha}|${l.competencia}`}
                  onClick={() => setPessoaSel({ cracha: l.cracha, nome: l.nome })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setPessoaSel({ cracha: l.cracha, nome: l.nome });
                    }
                  }}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                >
                  <td><b>{l.nome || "—"}</b></td>
                  <td className="dp-num dp-mono">{l.cracha || "—"}</td>
                  <td>{l.funcao || "—"}</td>
                  <td>
                    <span className={`dp-pill ${normalizar(l.situacao) === "ativo" ? "mute" : "accent"}`}>
                      {l.situacao || "—"}
                    </span>
                  </td>
                  <td className="dp-num">
                    {comp === "todas"
                      ? <span className="dp-muted">{l.meses} mês(es) · até {rotuloComp(l.ultima)}</span>
                      : (
                        <>
                          {rotuloComp(l.competencia)}
                          {abertas.has(l.competencia) && (
                            <span className="dp-pill warn" style={{ marginLeft: 6 }}>sem folha</span>
                          )}
                        </>
                      )}
                  </td>
                  <td className="dp-num">{umaCasa(l.apurada)}</td>
                  <td className="dp-num">{umaCasa(l.paga)}</td>
                  <td className="dp-num">{l.debito ? umaCasa(l.debito) : "—"}</td>
                  <td className="dp-num">{l.bancoH ? umaCasa(l.bancoH) : "—"}</td>
                  <td className="dp-num dp-mono">{l.reais ? `R$ ${emReais(l.reais)}` : "—"}</td>
                  <td className="dp-num dp-mono">
                    <b style={{ color: corSinal(l.movimento) }}>{emHoras(l.movimento)}</b>
                  </td>
                  <td className="dp-num">
                    <span className={`dp-pill ${classeSinal(l.acumulado)} dp-mono`}>{emHoras(l.acumulado)}</span>
                  </td>
                </tr>
              ))}
              {!visiveis.length && (
                <tr>
                  <td colSpan={totalColunas} className="dp-faint" style={{ textAlign: "center", padding: "22px" }}>
                    {linhas.length
                      ? "Nenhum colaborador com esses filtros."
                      : "Sem movimento nesta competência."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pessoaSel && (
        <div
          className="dp-overlay"
          role="presentation"
          onClick={(e) => { if (e.target === e.currentTarget) fecharExtrato(); }}
        >
          <div className="dp-modal" style={{ width: 940 }} role="dialog" aria-modal="true" aria-label="Extrato do banco de horas">
            <div className="dp-modal-head">
              <h3>Extrato do banco de horas</h3>
              <button type="button" className="dp-det-x" onClick={fecharExtrato} aria-label="Fechar">
                <X size={17} />
              </button>
            </div>
            <ExtratoPessoa estado={extrato} abertas={abertas} nomeFallback={pessoaSel.nome} />
          </div>
        </div>
      )}
    </div>
  );
}

/* Extrato mes a mes de uma pessoa. O `saldo_acumulado_h` da ULTIMA linha ja e o saldo
   corrido — nao ha soma a refazer para o saldo bruto.

   O saldo COM A FOLHA FECHADA e outra conta, e aqui ela e feita como no original
   (`bhExtrato` no app.js): soma o `movimento_h` das competencias que NAO estao
   abertas. Nao e o acumulado da ultima competencia fechada — parece igual e so e
   igual enquanto as abertas forem as mais recentes; somando o movimento, um mes sem
   folha no meio da serie tambem sai da conta, que e o que o original faz.
   O conjunto `abertas` chega de fora e vale para a base inteira: antes ele saia das
   linhas da competencia carregada e, num mes ja fechado, vinha vazio — a linha
   simplesmente sumia justo na conferencia individual. */
function ExtratoPessoa({ estado, abertas, nomeFallback }) {
  const { carregando, erro, linhas, pessoa } = estado;

  if (carregando) return <div className="dp-vazio" style={{ marginTop: 12 }}>Carregando o extrato…</div>;
  if (erro) {
    return (
      <div style={{ marginTop: 12 }}>
        <span className="dp-pill danger">{erro}</span>
      </div>
    );
  }
  if (!linhas.length) {
    return <div className="dp-vazio" style={{ marginTop: 12 }}>Sem movimento no período.</div>;
  }

  const ordenadas = [...linhas].sort((a, b) => (a.competencia < b.competencia ? 1 : -1));
  const atual = ordenadas[0];
  const semFolha = linhas.filter((l) => abertas.has(l.competencia));
  const saldoFechado = linhas.reduce(
    (soma, l) => (abertas.has(l.competencia) ? soma : soma + l.movimento),
    0,
  );

  return (
    <>
      <div className="dp-det-head" style={{ marginTop: 10 }}>
        <div>
          <b>{pessoa?.nome || nomeFallback || "—"}</b>
          <div className="sub">
            <span className="dp-mono">{pessoa?.cracha || "—"}</span>
            {pessoa?.funcao ? ` · ${pessoa.funcao}` : ""}
            {pessoa?.situacao ? ` · ${pessoa.situacao}` : ""}
            {pessoa?.admissao ? ` · admitido em ${pessoa.admissao}` : ""}
            {pessoa?.afastadoDesde ? ` · afastado desde ${pessoa.afastadoDesde}` : ""}
            {pessoa?.desligamento ? ` · desligado em ${pessoa.desligamento}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="dp-faint" style={{ fontSize: 11 }}>Saldo acumulado</div>
          <span className={`dp-pill ${classeSinal(atual.acumulado)} dp-mono`}>{emHoras(atual.acumulado)}</span>
          {/* Só aparece quando há mês sem folha na série DELE: sem isso os dois
              números são o mesmo e a segunda linha vira ruído. */}
          {semFolha.length > 0 && (
            <div className="dp-faint" style={{ fontSize: 11, marginTop: 4 }}>
              com a folha fechada:{" "}
              <b className="dp-mono" style={{ color: corSinal(saldoFechado) }}>{emHoras(saldoFechado)}</b>
              <br />
              (sem {semFolha.map((l) => rotuloComp(l.competencia)).join(", ")})
            </div>
          )}
        </div>
      </div>

      <div className="dp-tabela-wrap" style={{ margin: "12px 0 0", maxHeight: "56vh" }}>
        <table className="dp-tabela">
          <thead>
            <tr>
              <th>Competência</th>
              <th>HE apurada</th>
              <th>HE paga</th>
              <th>Débito</th>
              <th>Banco pago</th>
              <th>Pago (R$)</th>
              <th>Movimento</th>
              <th>Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((l) => (
              <tr key={l.competencia}>
                <td>
                  <b>{rotuloComp(l.competencia)}</b>
                  {abertas.has(l.competencia) && (
                    <span className="dp-pill warn" style={{ marginLeft: 6 }}>sem folha</span>
                  )}
                </td>
                <td className="dp-num">{umaCasa(l.apurada)}</td>
                <td className="dp-num">{umaCasa(l.paga)}</td>
                <td className="dp-num">{l.debito ? umaCasa(l.debito) : "—"}</td>
                <td className="dp-num">{l.bancoH ? umaCasa(l.bancoH) : "—"}</td>
                <td className="dp-num dp-mono">{l.reais ? `R$ ${emReais(l.reais)}` : "—"}</td>
                <td className="dp-num dp-mono">
                  <b style={{ color: corSinal(l.movimento) }}>{emHoras(l.movimento)}</b>
                </td>
                <td className="dp-num dp-mono" style={{ color: corSinal(l.acumulado) }}>{emHoras(l.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="dp-det-foot">
        Somente leitura: esta tela não grava nada na folha. Os valores vêm da tabela
        <span className="dp-mono"> banco_horas</span>, alimentada pelo importador do DP.
      </div>
    </>
  );
}
