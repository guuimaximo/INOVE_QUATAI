// Gateway privado entre o INOVE e a base operacional DP360.
//
// A chave da base de ponto existe somente como secret desta Edge Function.
// O navegador recebe apenas o que um Administrador do INOVE pode ver.
//
// SEGURANCA (nao afrouxar):
//   1. Exige sessao do INOVE (JWT) E nivel Administrador — conferido no servidor.
//   2. ALLOWLIST de tabelas: a base DP360 tambem guarda folha (banco_horas),
//      ferias, cartao de credito e GPS de outros modulos. So as tabelas de PONTO
//      listadas em TABELAS passam por aqui — nada mais, nem leitura.
//   3. DELETE exige filtro. Sem isso um bug/abuso zeraria a tabela.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function normalizar(valor: unknown) {
  return String(valor ?? "").trim().toLocaleLowerCase("pt-BR");
}

function mensagemSegura(error: unknown) {
  const texto = String((error as Error)?.message ?? error ?? "erro desconhecido");
  return texto.replace(/https?:\/\/[^\s]+/g, "origem protegida").slice(0, 180);
}

type Fonte = { nome: string; tabela: string; coluna: string };

const FONTES: Fonte[] = [
  { nome: "Ponto diário", tabela: "ponto_diario", coluna: "date_ref" },
  { nome: "Gordura", tabela: "ponto_gordura", coluna: "data_ref" },
  { nome: "Ocorrências", tabela: "ponto_ajustes_app", coluna: "capturado_em" },
  { nome: "Casos", tabela: "ponto_caso", coluna: "date_ref" },
];

/* ── ALLOWLIST ──────────────────────────────────────────────────────────────
   `ler`      : pode ser consultada.
   `escrever` : operacoes permitidas ("upsert" | "insert" | "delete" | "update").
   `conflito` : chave do on_conflict do upsert (espelha o supabase_client do DP).
   `colunasUpdate` : QUAIS colunas o `update` pode tocar. Sem esta lista o update
                     e recusado. Existe porque o gateway fala com a base usando a
                     service key, que ignora grant por coluna — a trava por coluna
                     do banco (grant update (a,b,c)) precisa existir tambem AQUI,
                     senao a tela poderia reescrever a propria prova da deteccao.
   Espelha exatamente o contrato do DP360 (ferramenta/supabase_client.py).      */
type Acesso = {
  ler: boolean;
  escrever?: Array<"upsert" | "insert" | "delete" | "update">;
  colunasUpdate?: string[];
  conflito?: string;
};

const TABELAS: Record<string, Acesso> = {
  // — snapshots do lake (somente leitura; quem preenche e o importador) —
  ponto_diario: { ler: true },
  ponto_intervalo: { ler: true },
  ponto_gordura: { ler: true },
  ponto_linha99: { ler: true },
  ponto_gps: { ler: true },
  gps_carro: { ler: true },
  viagens_qh: { ler: true },

  // — estado operacional do DP (le e grava) —
  ponto_caso: { ler: true, escrever: ["upsert"], conflito: "cracha,date_ref" },
  ponto_conferido: { ler: true, escrever: ["upsert", "delete"], conflito: "cracha,date_ref" },
  ponto_ajustes: { ler: true, escrever: ["upsert"], conflito: "cracha,date_ref,campo" },
  ponto_ajustes_app: { ler: true, escrever: ["upsert"], conflito: "id_ocorrencia" },
  ponto_ajustes_app_hist: { ler: true, escrever: ["insert"] },
  ponto_ocorrencias: { ler: true, escrever: ["upsert"], conflito: "cracha,date_ref" },
  ponto_real_manual: { ler: true, escrever: ["upsert", "delete"], conflito: "cracha,date_ref" },
  ponto_reservas: { ler: true, escrever: ["upsert", "delete"], conflito: "cracha,date_ref" },
  ponto_importacoes: { ler: true, escrever: ["insert"] },
  ponto_leitura: { ler: true, escrever: ["insert"] },
  app_config: { ler: true, escrever: ["upsert"], conflito: "chave" },

  // — FOLHA: liberada a pedido do dono (2026-09-06) para a tela Banco de Horas —
  // ATENCAO: esta tabela tem HORA EXTRA E VALOR EM R$ por colaborador. Foi
  // deliberadamente mantida fora da allowlist ate aqui. Entra SOMENTE LEITURA:
  // nenhuma tela do DP360 escreve folha, e o que alimenta a tabela e o importador.
  // Continua alcancavel so por Administrador do INOVE (o gate no topo desta funcao)
  // e a pagina /dp360-banco-horas tambem e admin-only pelo access.js.
  banco_horas: { ler: true },

  // — FRAUDE DE CARTAO (INOVE Guard): liberadas a pedido do dono (2026-09-06) —
  // SOMENTE LEITURA. A regra e calculada na origem (SQL diario): bloco = debitos
  // consecutivos do mesmo cartao no mesmo endereco, gatilho 3+ em 60 min, so
  // giro_efetuado=1, dedup por r95_id. A tela apenas apresenta e filtra.
  // ATENCAO: `fraude_cartao_bloqueado` tem `numero_cartao`. A tela NAO deve exibir o
  // numero inteiro — mascare. Manter a coluna acessivel e necessario para casar os
  // registros, mas mostrar cartao completo numa tela e vazamento gratuito.
  fraude_cartao_bloqueado: { ler: true },
  fraude_cartao_giros: { ler: true },
  // TRIAGEM da fraude: o mesmo contrato do painel que ja existe
  // (PROGRAMA_FRAUDES/sql/03_supabase_triagem_rls.sql, que concede a anon
  // `update (status, analisado_em, analisado_por, observacao)` e mais nada).
  // Quem analisa muda o STATUS da ocorrencia; ninguem mexe em cartao, local,
  // valor ou horario — isso e prova da deteccao e so entra pelo bot.
  fraude_cartao_sequencial: {
    ler: true,
    escrever: ["update"],
    colunasUpdate: ["status", "analisado_em", "analisado_por", "observacao"],
  },
};

const LIMITE_MAX = 5000;

// Cache das listas de datas. Descobrir os dias distintos custa varrer milhares de
// linhas (o PostgREST nao faz DISTINCT) — medido ~8 s na ponto_gordura.
// ATENCAO: isto acerta pouco. Cada invocacao pode cair num isolate novo, e no
// teste duas chamadas seguidas erraram o cache. O cache que REALMENTE segura e o
// do navegador, em src/services/dp360Api.js. Este aqui e so um bonus quando a
// mesma instancia atende de novo.
const CACHE_DATAS = new Map<string, { em: number; datas: string[] }>();
const CACHE_DATAS_MS = 5 * 60 * 1000;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
// PostgREST: "eq.123", "in.(a,b)", "gte.2026-01-01", "not.is.null"...
const FILTRO_VALOR = /^[A-Za-z_.]+\.[^&#]*$/;

function colunasValidas(select: unknown): string | null {
  if (select == null || select === "*") return "*";
  const bruto = String(select);
  const partes = bruto.split(",").map((c) => c.trim()).filter(Boolean);
  if (!partes.length || partes.some((c) => !IDENT.test(c))) return null;
  return partes.join(",");
}

// Aceita { coluna: "eq.valor" } e tambem { coluna: ["gte.x", "lte.y"] } — sem o
// array nao da para pedir um INTERVALO de datas (a mesma coluna com dois
// operadores), e a tela teria de filtrar o resto em memoria.
function montarFiltros(filtros: unknown): { qs: string; qtd: number } | null {
  if (filtros == null) return { qs: "", qtd: 0 };
  if (typeof filtros !== "object" || Array.isArray(filtros)) return null;
  const partes: string[] = [];
  for (const [col, val] of Object.entries(filtros as Record<string, unknown>)) {
    if (!IDENT.test(col)) return null;
    const valores = Array.isArray(val) ? val : [val];
    if (!valores.length || valores.length > 4) return null;
    for (const item of valores) {
      const v = String(item ?? "");
      if (!FILTRO_VALOR.test(v)) return null;
      partes.push(`${col}=${encodeURIComponent(v)}`);
    }
  }
  return { qs: partes.join("&"), qtd: partes.length };
}

/* ══════════════════════════════════════════════════════════════════════════
   A PROVA DO ROBÔ — do disparo ao print guardado para sempre
   ══════════════════════════════════════════════════════════════════════════
   Os bots fotografam a tela do Transnet antes e depois de cada lançamento. Essa
   foto é a peça trabalhista: é o que se anexa quando alguém contesta. Ela nasce
   como artefato do run do GitHub Actions, com `retention-days: 30` — some em um
   mês, e só quem tem acesso ao repositório alcança.

   Este bloco fecha os dois buracos, sem tocar em NADA do repo dos bots:
     1. casa o disparo com o RUN que ele provocou (o `dispatches` não devolve id);
     2. baixa o artefato, descompacta e grava cópia PERMANENTE num bucket
        PRIVADO do Storage do INOVE.
   Quem lê é a tela, por URL assinada de vida curta — e só Administrador, porque
   a checagem no topo desta função já barra todo o resto.                       */

const BUCKET_EVIDENCIAS = "dp360_evidencias";
const TAB_EXECUCAO = "dp360_robo_execucao";
const TAB_EVIDENCIA = "dp360_robo_evidencia";

/* ALLOWLIST DE WORKFLOW E DE INPUT (vive aqui fora porque o casamento do run e
   o arquivamento também precisam saber quais arquivos existem).
   null = texto livre (o CSV / o JSON dos casos); array = valores aceitos. */
const ROBOS: Record<string, { arquivo: string; inputs: Record<string, string[] | null> }> = {
  ocorrencias: { arquivo: "ocorrencias.yml", inputs: { csv: null, confirmar: ["true", "false"] } },
  ponto: { arquivo: "ponto.yml", inputs: { csv: null, data: null, confirmar: ["true", "false"] } },
  comunicado: {
    arquivo: "comunicado.yml",
    inputs: {
      csv: null,
      data: null,
      motivo: ["102 (aviso)", "103 (ADVERTENCIA)"],
      confirmar: ["true", "false"],
    },
  },
  ajustes: {
    arquivo: "ajustes.yml",
    inputs: {
      modo: ["conferir (so leitura)", "capturar a grade", "executar decisoes"],
      casos: null,
      confirmar: ["true", "false"],
    },
  },
};

function tokenGitHub() {
  return Deno.env.get("DP360_GITHUB_TOKEN") || Deno.env.get("GITHUB_TOKEN") || "";
}

function cabecalhoGitHub(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson(url: string, token: string) {
  const r = await fetch(url, { headers: cabecalhoGitHub(token) });
  if (!r.ok) {
    // o caminho ajuda a entender o erro sem vazar host/token
    const onde = (() => { try { return new URL(url).pathname; } catch { return "api"; } })();
    throw new Error(`o GitHub respondeu HTTP ${r.status} em ${onde}`);
  }
  return await r.json();
}

const esperar = (ms: number) => new Promise((pronto) => setTimeout(pronto, ms));

/* Quem é o dono do token. Serve para descartar do casamento um run que outra
   pessoa disparou à mão (ou um agendamento) e caiu na mesma janela de tempo.
   Uma chamada só, guardada no isolate. Se o token não permitir `/user` (token
   de GitHub App, por exemplo), o casamento segue SEM esse filtro — e a nota
   gravada diz isso, em vez de fingir que o filtro rodou. */
let atorDoToken: { em: number; login: string | null } | null = null;
async function loginDoToken(token: string): Promise<string | null> {
  if (atorDoToken && Date.now() - atorDoToken.em < 30 * 60 * 1000) return atorDoToken.login;
  let login: string | null = null;
  try {
    const eu = await githubJson("https://api.github.com/user", token);
    login = typeof eu?.login === "string" ? eu.login : null;
  } catch {
    login = null;
  }
  atorDoToken = { em: Date.now(), login };
  return login;
}

/* Folga do relógio. O `created_at` do run vem com resolução de SEGUNDO e o
   relógio da Edge Function não é o do GitHub; sem folga, um run criado no mesmo
   segundo do disparo cairia fora da janela por 300 ms de diferença. */
const TOLERANCIA_MS = 90 * 1000;
// O run não aparece na listagem no mesmo instante do dispatch. Três tentativas,
// ~7,7 s no pior caso — e para na primeira que achar candidato.
const ESPERAS_MS = [1200, 2500, 4000];
const RUNS_POR_PAGINA = 30;

type ResumoRun = {
  id: number;
  numero: number | null;
  url: string | null;
  criado_em: string | null;
  status: string | null;
  conclusao: string | null;
  ator: string | null;
};

type Casamento = {
  casamento: "exato" | "ambiguo" | "nao_encontrado" | "erro";
  casamento_nota: string;
  candidatos: ResumoRun[];
  run: ResumoRun | null;
};

function resumirRun(r: Record<string, unknown>): ResumoRun {
  const ator = (r?.triggering_actor as Record<string, unknown> | undefined)?.login
    ?? (r?.actor as Record<string, unknown> | undefined)?.login;
  return {
    id: Number(r?.id),
    numero: Number.isFinite(Number(r?.run_number)) ? Number(r?.run_number) : null,
    url: typeof r?.html_url === "string" ? r.html_url : null,
    criado_em: typeof r?.created_at === "string" ? r.created_at : null,
    status: typeof r?.status === "string" ? r.status : null,
    conclusao: typeof r?.conclusion === "string" ? r.conclusion : null,
    ator: typeof ator === "string" ? ator : null,
  };
}

/* CASAR O DISPARO COM O RUN.
   O `POST .../dispatches` responde 204 sem corpo: não existe id de run na
   resposta. A única saída é listar os runs do workflow logo depois e casar pelo
   instante e pelo ator. Isso é um PALPITE, e aqui ele é tratado como palpite:

     · a janela é [t0 - 90 s, ∞) sobre `created_at`, no mesmo branch, e só
       `event = workflow_dispatch`;
     · se o dono do token for conhecido, run de outro ator sai;
     · run que JÁ pertence a outro disparo sai — a unique parcial em
       `dp360_robo_execucao.run_id` garante isso no banco, e aqui ela vira poder
       de dedução: dois disparos seguidos (o `concurrency: bots-transnet`
       enfileira os bots, então isso acontece) veem os mesmos candidatos, mas o
       primeiro já reivindicou o dele;
     · sobrando UM, é `exato`. Sobrando VÁRIOS, é `ambiguo` e grava-se a LISTA —
       nunca "o mais provável". Run errado significa mostrar a foto do
       lançamento de OUTRA pessoa como prova deste, o que é pior do que não ter
       foto nenhuma. Quem escolhe, nesse caso, é uma pessoa, na tela, e a nota
       registra que foi escolha à mão.                                          */
// O cliente da service key entra sem tipo de propósito: a assinatura genérica
// do supabase-js muda entre versões, e amarrar esta função a ela faria o deploy
// quebrar por uma diferença de tipo, não por um defeito de comportamento.
// deno-lint-ignore no-explicit-any
type ClienteServico = any;

async function casarRun(
  inoveAdmin: ClienteServico,
  token: string,
  dono: string,
  repo: string,
  arquivo: string,
  ref: string,
  t0ms: number,
): Promise<Casamento> {
  const login = await loginDoToken(token);
  const notas: string[] = [
    login
      ? `ator do token: ${login}`
      : "ator do token desconhecido (o GitHub não respondeu /user) — filtro por ator NÃO aplicado",
  ];

  const filtrar = (runs: Record<string, unknown>[]) =>
    runs.filter((r) => {
      if (String(r?.event ?? "") !== "workflow_dispatch") return false;
      if (ref && String(r?.head_branch ?? "") !== ref) return false;
      const criado = Date.parse(String(r?.created_at ?? ""));
      if (!Number.isFinite(criado)) return false;
      if (criado < t0ms - TOLERANCIA_MS) return false;
      if (login) {
        const ator = String(
          (r?.triggering_actor as Record<string, unknown> | undefined)?.login
            ?? (r?.actor as Record<string, unknown> | undefined)?.login
            ?? "",
        );
        if (ator && ator !== login) return false;
      }
      return true;
    });

  let brutos: Record<string, unknown>[] = [];
  let naJanela: Record<string, unknown>[] = [];
  let erro = "";
  for (const espera of ESPERAS_MS) {
    await esperar(espera);
    try {
      const j = await githubJson(
        `https://api.github.com/repos/${dono}/${repo}/actions/workflows/${arquivo}/runs`
          + `?event=workflow_dispatch&per_page=${RUNS_POR_PAGINA}`,
        token,
      );
      brutos = Array.isArray(j?.workflow_runs) ? j.workflow_runs : [];
      erro = "";
    } catch (falha) {
      erro = mensagemSegura(falha);
      continue;
    }
    naJanela = filtrar(brutos);
    if (naJanela.length) break;
  }

  if (erro && !brutos.length) {
    return { casamento: "erro", casamento_nota: `${notas.join(" · ")} · ${erro}`, candidatos: [], run: null };
  }

  // A listagem volta do mais novo para o mais velho. Se nem o mais VELHO da
  // página alcança o instante do disparo, o run pode simplesmente ter saído da
  // primeira página — dizer isso é diferente de dizer "não existe".
  const maisVelho = brutos.length
    ? Math.min(...brutos.map((r) => Date.parse(String(r?.created_at ?? "")) || Infinity))
    : Infinity;
  if (Number.isFinite(maisVelho) && maisVelho > t0ms + TOLERANCIA_MS) {
    notas.push(
      `a janela do disparo já saiu das últimas ${RUNS_POR_PAGINA} execuções deste workflow`,
    );
  }

  const resumos = naJanela.map(resumirRun).filter((r) => Number.isFinite(r.id));
  if (!resumos.length) {
    return {
      casamento: "nao_encontrado",
      casamento_nota: `${notas.join(" · ")} · nenhum run apareceu na janela`,
      candidatos: [],
      run: null,
    };
  }

  // Tira os runs que outro disparo já reivindicou.
  let livres = resumos;
  try {
    const { data: usados } = await inoveAdmin
      .from(TAB_EXECUCAO)
      .select("run_id")
      .in("run_id", resumos.map((r) => r.id));
    const tomados = new Set((usados ?? []).map((x: Record<string, unknown>) => Number(x.run_id)));
    const antes = livres.length;
    livres = resumos.filter((r) => !tomados.has(r.id));
    if (livres.length !== antes) {
      notas.push(`${antes - livres.length} run(s) da janela já pertencem a outro disparo`);
    }
  } catch {
    notas.push("não foi possível conferir runs já reivindicados — a lista pode conter run de outro disparo");
  }

  if (livres.length === 1) {
    return { casamento: "exato", casamento_nota: notas.join(" · "), candidatos: livres, run: livres[0] };
  }
  if (livres.length === 0) {
    return {
      casamento: "nao_encontrado",
      casamento_nota: `${notas.join(" · ")} · todos os runs da janela já são de outros disparos`,
      candidatos: resumos,
      run: null,
    };
  }
  return {
    casamento: "ambiguo",
    casamento_nota: `${notas.join(" · ")} · ${livres.length} candidatos na janela — escolha à mão`,
    candidatos: livres,
    run: null,
  };
}

/* ── LEITOR DE ZIP (o artefato do Actions vem zipado) ──────────────────────
   Escrito à mão, de propósito: uma dependência de terceiros a mais nesta função
   é uma dependência que passa a ver a prova. O formato é fechado e pequeno —
   End of Central Directory → central directory → local header → dados. O
   DEFLATE quem faz é o `DecompressionStream("deflate-raw")` do próprio runtime.

   Tamanhos e offsets saem da CENTRAL DIRECTORY, nunca do local header: com a
   flag de data descriptor (bit 3) o local header traz zero nos três campos.   */

const ASSINATURA_EOCD = 0x06054b50;
const ASSINATURA_CENTRAL = 0x02014b50;
const ASSINATURA_LOCAL = 0x04034b50;

type EntradaZip = { nome: string; metodo: number; comprimido: number; original: number; offset: number };

function lerZip(buf: Uint8Array): EntradaZip[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => dv.getUint16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);

  if (buf.length < 22) throw new Error("arquivo zip vazio ou truncado");

  // O EOCD tem 22 bytes fixos + um comentário de até 65535. Procura de trás.
  let eocd = -1;
  const piso = Math.max(0, buf.length - 22 - 65535);
  for (let i = buf.length - 22; i >= piso; i -= 1) {
    if (u32(i) === ASSINATURA_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("zip inválido: End of Central Directory não encontrado");

  const total = u16(eocd + 10);
  const inicio = u32(eocd + 16);
  // ZIP64 marca os campos estourados com 0xffff/0xffffffff. Não vai acontecer
  // com um punhado de prints, mas errar em silêncio seria pior do que recusar.
  if (total === 0xffff || inicio === 0xffffffff) {
    throw new Error("zip no formato ZIP64 — não suportado por este leitor");
  }

  const entradas: EntradaZip[] = [];
  let p = inicio;
  for (let i = 0; i < total; i += 1) {
    if (p + 46 > buf.length || u32(p) !== ASSINATURA_CENTRAL) {
      throw new Error(`zip inválido: entrada ${i + 1} fora do lugar`);
    }
    const metodo = u16(p + 10);
    const comprimido = u32(p + 20);
    const original = u32(p + 24);
    const nLen = u16(p + 28);
    const eLen = u16(p + 30);
    const cLen = u16(p + 32);
    const offset = u32(p + 42);
    const nome = new TextDecoder("utf-8").decode(buf.subarray(p + 46, p + 46 + nLen));
    entradas.push({ nome, metodo, comprimido, original, offset });
    p += 46 + nLen + eLen + cLen;
  }
  return entradas;
}

async function extrairDoZip(buf: Uint8Array, e: EntradaZip): Promise<Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (e.offset + 30 > buf.length || dv.getUint32(e.offset, true) !== ASSINATURA_LOCAL) {
    throw new Error(`zip inválido: cabeçalho local de ${e.nome} fora do lugar`);
  }
  const nLen = dv.getUint16(e.offset + 26, true);
  const eLen = dv.getUint16(e.offset + 28, true);
  const ini = e.offset + 30 + nLen + eLen;
  // `.slice()` copia: `subarray` devolve uma VISTA do buffer inteiro, e passar
  // vista para o Response arrastaria o zip todo junto.
  const dados = buf.slice(ini, ini + e.comprimido);
  if (e.metodo === 0) return dados;              // armazenado, sem compressão
  if (e.metodo !== 8) throw new Error(`método de compressão ${e.metodo} não suportado em ${e.nome}`);
  const fluxo = new Response(dados).body;
  if (!fluxo) throw new Error(`não foi possível ler ${e.nome} do zip`);
  const saida = fluxo.pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(saida).arrayBuffer());
}

/* ── O NOME DO ARQUIVO É METADADO ─────────────────────────────────────────
   O bot carimba crachá e dia no nome do print. Ler isso é o que permite a busca
   "por caso" (crachá + dia) — que é como o DP procura a prova quando alguém
   contesta. Padrões, na origem:
     bot_ponto.py:60   evidencia()  → <aaaammdd>_<hhmmss>_<rotulo>.png
     bot_ponto.py:457/466/496       → preenchido_ / apos_inserir_ / relido_
     bot_ajustes_app.py:1371        → conferido_<cracha8>_<aaaa-mm-dd>.png
     bot_comunicado.py:133/148      → envio_csv_* (é o LOTE, não uma pessoa)
     bot_ponto.py:641               → resultado_lote_<ts>.csv
   O carimbo do nome é UTC: os bots rodam no runner do GitHub Actions, onde
   `datetime.now()` é UTC. Guardar como instante UTC deixa a tela exibir em
   America/Sao_Paulo sem chutar fuso.                                          */

type NomeLido = {
  cracha: string | null;
  date_ref: string | null;
  momento: string | null;
  rotulo: string;
  capturado_em: string | null;
};

const SUFIXOS: Array<{ re: RegExp; momento: string; rotulo: string }> = [
  { re: /^preenchido_(\d+)_(\d{2}-\d{2}-\d{4})$/, momento: "antes", rotulo: "correção · antes de salvar" },
  { re: /^apos_inserir_(\d+)_(\d{2}-\d{2}-\d{4})$/, momento: "depois", rotulo: "correção · depois de salvar" },
  { re: /^relido_(\d+)_(\d{2}-\d{2}-\d{4})$/, momento: "leitura", rotulo: "cartão relido depois do lançamento" },
  { re: /^antes_atualizar_(\d+)_(\d{2}-\d{2}-\d{4})$/, momento: "antes", rotulo: "antes de atualizar" },
  { re: /^depois_atualizar_(\d+)_(\d{2}-\d{2}-\d{4})$/, momento: "depois", rotulo: "depois de atualizar" },
  { re: /^erro_ocorr_(\d+)$/, momento: "erro", rotulo: "erro ao lançar a ocorrência" },
  { re: /^erro_(\d+)$/, momento: "erro", rotulo: "erro no lançamento" },
];

function brParaIso(br: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(br);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// O zip do Actions vem de um runner Linux e separa com "/". Aceitar "\" também
// não é preciosismo: um zip gerado no Windows (Compress-Archive faz isso) grava
// a barra invertida, e aí o nome inteiro viraria "o arquivo" — a leitura de
// crachá e dia falharia em silêncio e a busca por caso não acharia a prova.
const partesDoCaminho = (bruto: string) => bruto.split(/[\\/]/);

function interpretarNome(caminhoNoZip: string): NomeLido {
  const nome = partesDoCaminho(caminhoNoZip).pop() || caminhoNoZip;
  const semExt = nome.replace(/\.[A-Za-z0-9]+$/, "");
  const vazio: NomeLido = { cracha: null, date_ref: null, momento: null, rotulo: "", capturado_em: null };

  // conferido_<cracha>_<aaaa-mm-dd>.png — sem carimbo de hora no nome
  const conf = /^conferido_(\d+)_(\d{4}-\d{2}-\d{2})$/.exec(semExt);
  if (conf) {
    // LEGENDA HONESTA (a mesma do main.py:839): a foto é tirada ANTES de a
    // verificação decidir. Escrever "conferido" afirmaria algo que muitas vezes
    // não aconteceu.
    return { cracha: conf[1], date_ref: conf[2], momento: "leitura", rotulo: "cartão lido no Transnet pelo bot", capturado_em: null };
  }

  const ts = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(.+)$/.exec(semExt);
  if (!ts) {
    if (/^resultado_lote_/.test(semExt)) return { ...vazio, momento: "lote", rotulo: "resultado do lote (csv)" };
    return { ...vazio, rotulo: semExt };
  }

  const capturado_em = new Date(Date.UTC(
    Number(ts[1]), Number(ts[2]) - 1, Number(ts[3]),
    Number(ts[4]), Number(ts[5]), Number(ts[6]),
  )).toISOString();
  const resto = ts[7];

  for (const s of SUFIXOS) {
    const m = s.re.exec(resto);
    if (!m) continue;
    return {
      cracha: m[1] ?? null,
      date_ref: m[2] ? brParaIso(m[2]) : null,
      momento: s.momento,
      rotulo: s.rotulo,
      capturado_em,
    };
  }
  if (/^envio_csv_/.test(resto)) {
    return { cracha: null, date_ref: null, momento: "lote", rotulo: `comunicado · ${resto.replace(/^envio_csv_/, "").replace(/_/g, " ")}`, capturado_em };
  }
  // `erro_final` cai aqui: não tem crachá, e cravar "final" na coluna crachá
  // encheria a busca por caso de lixo.
  return { cracha: null, date_ref: null, momento: /^erro/.test(resto) ? "erro" : null, rotulo: resto.replace(/_/g, " "), capturado_em };
}

const TIPOS_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  csv: "text/csv",
  txt: "text/plain",
  json: "application/json",
};

// Tetos do arquivamento. O zip inteiro cabe na memória do isolate, então o teto
// não é higiene: sem ele um artefato gigante derruba a função no meio e a prova
// fica pela metade, sem ninguém saber quais arquivos faltaram.
const MAX_ZIP_BYTES = 80 * 1024 * 1024;
const MAX_ARQUIVO_BYTES = 25 * 1024 * 1024;   // igual ao limite do bucket
const MAX_ARQUIVOS = 400;
const SEGUNDOS_URL_ASSINADA = 300;            // 5 min: o tempo de abrir a lupa e ler

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "use POST" }, 405);

  const inoveUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const inoveAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const inoveService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const dp360Url = Deno.env.get("DP360_SUPABASE_URL") ?? "";
  const dp360Service = Deno.env.get("DP360_SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!inoveUrl || !inoveAnon || !inoveService || !dp360Url || !dp360Service) {
    return json({ ok: false, error: "integração DP360 não configurada" }, 503);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ ok: false, error: "sessão do INOVE ausente" }, 401);
  }

  const caller = createClient(inoveUrl, inoveAnon, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return json({ ok: false, error: "sessão do INOVE inválida" }, 401);

  const inoveAdmin = createClient(inoveUrl, inoveService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: perfil, error: perfilError } = await inoveAdmin
    .from("usuarios_aprovadores")
    .select("id, nome, nivel, ativo, status_cadastro")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();

  const nivel = normalizar(perfil?.nivel);
  const ativo = perfil?.ativo !== false;
  const aprovado = !perfil?.status_cadastro || normalizar(perfil.status_cadastro) === "aprovado";
  if (perfilError || !perfil || !ativo || !aprovado || (nivel !== "administrador" && nivel !== "admin")) {
    return json({ ok: false, error: "acesso DP360 exclusivo para Administrador" }, 403);
  }

  let corpo: Record<string, unknown> = {};
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, error: "corpo JSON inválido" }, 400);
  }

  const base = dp360Url.replace(/\/$/, "");
  const hDp = {
    apikey: dp360Service,
    Authorization: `Bearer ${dp360Service}`,
    Accept: "application/json",
  };
  const acao = String(corpo.action ?? "overview");

  /* ── overview: ultima atualizacao por fonte ─────────────────────────────── */
  if (acao === "overview") {
    const consultarFonte = async (fonte: Fonte) => {
      try {
        const resposta = await fetch(
          `${base}/rest/v1/${fonte.tabela}?select=${encodeURIComponent(fonte.coluna)}&order=${fonte.coluna}.desc&limit=1`,
          { headers: hDp },
        );
        if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
        const linhas = await resposta.json();
        return { nome: fonte.nome, atualizado_em: linhas?.[0]?.[fonte.coluna] ?? null, ok: true };
      } catch (error) {
        return { nome: fonte.nome, atualizado_em: null, ok: false, erro: mensagemSegura(error) };
      }
    };
    const fontes = await Promise.all(FONTES.map(consultarFonte));
    return json({ ok: true, coletado_em: new Date().toISOString(), fontes });
  }

  /* ── datas: valores distintos de uma coluna (o PostgREST nao faz DISTINCT) ─
     Sem isto cada aba paginava milhares de linhas so para montar o seletor de
     data. Aqui a deduplicacao acontece no servidor e volta uma lista pequena. */
  if (acao === "datas") {
    const tabela = String(corpo.tabela ?? "");
    const cfg = TABELAS[tabela];
    if (!cfg?.ler) return json({ ok: false, error: "tabela não liberada para a DP360" }, 403);

    const coluna = String(corpo.coluna ?? "");
    if (!IDENT.test(coluna)) return json({ ok: false, error: "coluna inválida" }, 400);

    const filtros = montarFiltros(corpo.filtros);
    if (filtros === null) return json({ ok: false, error: "filtros inválidos" }, 400);

    const chaveCache = `${tabela}|${coluna}|${filtros.qs}`;
    const guardado = CACHE_DATAS.get(chaveCache);
    if (guardado && Date.now() - guardado.em < CACHE_DATAS_MS) {
      return json({ ok: true, tabela, coluna, datas: guardado.datas, total: guardado.datas.length, cache: true });
    }

    const vistos = new Set<string>();
    const PAG = 1000;
    const MAX_PAGINAS = 25; // teto de seguranca (~25 mil linhas varridas)
    try {
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina += 1) {
        let qs = `select=${encodeURIComponent(coluna)}&order=${encodeURIComponent(coluna)}.desc`;
        qs += `&limit=${PAG}&offset=${pagina * PAG}`;
        if (filtros.qs) qs += `&${filtros.qs}`;
        const r = await fetch(`${base}/rest/v1/${tabela}?${qs}`, { headers: hDp });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const linhas = await r.json();
        for (const l of linhas ?? []) {
          const v = l?.[coluna];
          if (v != null && v !== "") vistos.add(String(v).slice(0, 10));
        }
        if (!Array.isArray(linhas) || linhas.length < PAG) break;
      }
    } catch (error) {
      return json({ ok: false, error: mensagemSegura(error) }, 502);
    }

    const datas = [...vistos].sort().reverse();
    CACHE_DATAS.set(chaveCache, { em: Date.now(), datas });
    return json({ ok: true, tabela, coluna, datas, total: datas.length, cache: false });
  }

  /* ── read: consulta uma tabela da allowlist ─────────────────────────────── */
  if (acao === "read") {
    const tabela = String(corpo.tabela ?? "");
    const cfg = TABELAS[tabela];
    if (!cfg?.ler) return json({ ok: false, error: "tabela não liberada para a DP360" }, 403);

    const select = colunasValidas(corpo.colunas);
    if (select === null) return json({ ok: false, error: "colunas inválidas" }, 400);

    const filtros = montarFiltros(corpo.filtros);
    if (filtros === null) return json({ ok: false, error: "filtros inválidos" }, 400);

    const limite = Math.min(Math.max(Number(corpo.limite ?? 1000) || 1000, 1), LIMITE_MAX);
    const offset = Math.max(Number(corpo.offset ?? 0) || 0, 0);

    let qs = `select=${encodeURIComponent(select)}&limit=${limite}&offset=${offset}`;
    if (filtros.qs) qs += `&${filtros.qs}`;
    if (corpo.ordem != null) {
      const ordem = String(corpo.ordem);
      // aceita "coluna.desc", "coluna.asc" ou "coluna"
      const okOrdem = ordem.split(",").every((o) => {
        const [c, dir] = o.trim().split(".");
        return IDENT.test(c || "") && (!dir || dir === "asc" || dir === "desc");
      });
      if (!okOrdem) return json({ ok: false, error: "ordem inválida" }, 400);
      qs += `&order=${encodeURIComponent(ordem)}`;
    }

    try {
      const r = await fetch(`${base}/rest/v1/${tabela}?${qs}`, { headers: hDp });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const linhas = await r.json();
      return json({ ok: true, tabela, linhas, total: Array.isArray(linhas) ? linhas.length : 0 });
    } catch (error) {
      return json({ ok: false, error: mensagemSegura(error) }, 502);
    }
  }

  /* ── write: upsert / insert / delete nas tabelas de estado ──────────────── */
  if (acao === "write") {
    const tabela = String(corpo.tabela ?? "");
    const op = String(corpo.op ?? "");
    const cfg = TABELAS[tabela];
    if (!cfg?.escrever?.includes(op as "upsert" | "insert" | "delete" | "update")) {
      return json({ ok: false, error: "operação não liberada para esta tabela" }, 403);
    }

    // UPDATE (PATCH): muda colunas de linhas que JA EXISTEM. Diferente do upsert
    // de proposito — um upsert com a chave errada CRIA linha, e nesta tabela
    // linha nova e ocorrencia detectada, que so o bot pode inserir.
    if (op === "update") {
      const permitidas = new Set(cfg.colunasUpdate ?? []);
      if (!permitidas.size) return json({ ok: false, error: "update sem colunas liberadas" }, 403);

      const filtros = montarFiltros(corpo.filtros);
      if (filtros === null) return json({ ok: false, error: "filtros inválidos" }, 400);
      // TRAVA (a mesma do delete): update sem filtro reescreveria a tabela inteira.
      if (!filtros.qtd) return json({ ok: false, error: "update exige filtro" }, 400);

      const campos = corpo.campos;
      if (typeof campos !== "object" || campos === null || Array.isArray(campos)) {
        return json({ ok: false, error: "campos ausentes" }, 400);
      }
      const chaves = Object.keys(campos as Record<string, unknown>);
      if (!chaves.length) return json({ ok: false, error: "campos ausentes" }, 400);
      const proibida = chaves.find((c) => !permitidas.has(c));
      if (proibida) return json({ ok: false, error: `coluna não liberada: ${proibida}` }, 403);

      try {
        const r = await fetch(`${base}/rest/v1/${tabela}?${filtros.qs}`, {
          method: "PATCH",
          headers: { ...hDp, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(campos),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return json({ ok: true, tabela, op, campos: chaves });
      } catch (error) {
        return json({ ok: false, error: mensagemSegura(error) }, 502);
      }
    }

    if (op === "delete") {
      const filtros = montarFiltros(corpo.filtros);
      if (filtros === null) return json({ ok: false, error: "filtros inválidos" }, 400);
      // TRAVA: delete sem filtro apagaria a tabela inteira.
      if (!filtros.qtd) return json({ ok: false, error: "delete exige filtro" }, 400);
      try {
        const r = await fetch(`${base}/rest/v1/${tabela}?${filtros.qs}`, {
          method: "DELETE",
          headers: hDp,
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return json({ ok: true, tabela, op });
      } catch (error) {
        return json({ ok: false, error: mensagemSegura(error) }, 502);
      }
    }

    const linhas = Array.isArray(corpo.linhas) ? corpo.linhas : null;
    if (!linhas || !linhas.length) return json({ ok: false, error: "linhas ausentes" }, 400);
    if (linhas.length > 1000) return json({ ok: false, error: "no máximo 1000 linhas por chamada" }, 400);
    if (linhas.some((l) => typeof l !== "object" || l === null || Array.isArray(l))) {
      return json({ ok: false, error: "linhas devem ser objetos" }, 400);
    }

    const merge = op === "upsert";
    const url = merge && cfg.conflito
      ? `${base}/rest/v1/${tabela}?on_conflict=${encodeURIComponent(cfg.conflito)}`
      : `${base}/rest/v1/${tabela}`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          ...hDp,
          "Content-Type": "application/json",
          Prefer: merge ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
        },
        body: JSON.stringify(linhas),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return json({ ok: true, tabela, op, gravadas: linhas.length });
    } catch (error) {
      return json({ ok: false, error: mensagemSegura(error) }, 502);
    }
  }

  /* ── robo: dispara o workflow que dirige o Transnet ──────────────────────
     O navegador NAO dirige o Transnet: isso e Selenium, e roda no GitHub
     Actions do repo do DP360 (guuimaximo/DP360), onde as credenciais do
     Transnet ja vivem como secret. O INOVE DECIDE; o robo EXECUTA.

     Tres travas, e nenhuma e burocracia:

     1. ALLOWLIST DE WORKFLOW E DE INPUT. O que chega da tela nao vira nome de
        arquivo nem input solto: so os quatro workflows abaixo existem, e cada
        um so aceita as chaves que declara. Um `inputs` livre daria a quem
        chamasse esta funcao o direito de rodar qualquer workflow do repo.

     2. `confirmar` NASCE FALSO. Nos quatro bots, sem --confirmar e ENSAIO: o
        robo navega, acha o botao e NAO clica. Quem quer valendo manda "true"
        explicito, e a trilha guarda qual dos dois foi. Default invertido aqui
        seria a diferenca entre um teste e uma advertencia de verdade na ficha
        de alguem.

     3. TRILHA ANTES DO DISPARO. A linha em dp360_auditoria e gravada ANTES de
        chamar o GitHub, e se ela falhar o disparo NAO acontece. Disparo sem
        registro e o unico resultado que nao pode existir: alcanca pessoa de
        verdade e ninguem sabe quem mandou. O contrario (linha de um disparo
        que falhou depois) e barulho, e o proprio erro entra como segunda linha.

     O token e um secret desta funcao, nunca do bundle. `DP360_GITHUB_TOKEN`
     e o certo; na falta dele cai no `GITHUB_TOKEN` que ja existe aqui (mesmo
     dono dos dois repos) — sem token, 503 dizendo o que configurar. */
  if (acao === "robo") {
    const nome = String(corpo.robo ?? "");
    const cfgRobo = ROBOS[nome];
    if (!cfgRobo) return json({ ok: false, error: "robô não permitido" }, 403);

    const token = tokenGitHub();
    if (!token) {
      return json(
        { ok: false, error: "robô não configurado: falta o secret DP360_GITHUB_TOKEN nesta função" },
        503,
      );
    }
    const dono = Deno.env.get("DP360_GITHUB_OWNER") ?? "guuimaximo";
    const repo = Deno.env.get("DP360_GITHUB_REPO") ?? "DP360";
    const ref = Deno.env.get("DP360_GITHUB_REF") ?? "main";

    const recebidos = corpo.inputs;
    if (typeof recebidos !== "object" || recebidos === null || Array.isArray(recebidos)) {
      return json({ ok: false, error: "inputs ausentes" }, 400);
    }

    const inputs: Record<string, string> = {};
    let tamanho = 0;
    for (const [chave, valor] of Object.entries(recebidos as Record<string, unknown>)) {
      if (!(chave in cfgRobo.inputs)) return json({ ok: false, error: `input não permitido: ${chave}` }, 403);
      const v = String(valor ?? "");
      const aceitos = cfgRobo.inputs[chave];
      if (aceitos && !aceitos.includes(v)) {
        return json({ ok: false, error: `valor não permitido em ${chave}` }, 400);
      }
      tamanho += v.length;
      inputs[chave] = v;
    }
    // O `workflow_dispatch` do GitHub recusa payload grande (limite de 64 KB no
    // conjunto dos inputs). Cortar aqui devolve um erro que se entende, em vez
    // do 422 cru do GitHub depois de a pessoa ja ter confirmado.
    if (tamanho > 60000) {
      return json({ ok: false, error: "lote grande demais para uma execução — divida em partes" }, 400);
    }
    // ENSAIO por omissao.
    inputs.confirmar = inputs.confirmar === "true" ? "true" : "false";

    const linhasCsv = inputs.csv ? inputs.csv.trim().split(/\r?\n/).length - 1 : null;
    const trilha = {
      acao: "robo_disparo",
      alvo: nome,
      detalhe: {
        workflow: cfgRobo.arquivo,
        repo: `${dono}/${repo}`,
        ref,
        confirmar: inputs.confirmar === "true",
        // o CSV tem cracha e nome: guardamos o TAMANHO, nunca o conteudo
        linhas: linhasCsv,
        bytes: tamanho,
        modo: inputs.modo ?? null,
        motivo: inputs.motivo ?? null,
        data: inputs.data ?? null,
      },
      autor_id: authData.user.id,
      autor_nome: perfil?.nome ?? null,
    };

    // `.select("id")` porque o id desta linha é o elo com a execução: sem ele o
    // run que o disparo provocar não teria em que se pendurar.
    const { data: linhaTrilha, error: erroTrilha } = await inoveAdmin
      .from("dp360_auditoria")
      .insert(trilha)
      .select("id")
      .single();
    if (erroTrilha || !linhaTrilha?.id) {
      return json({ ok: false, error: "não foi possível registrar o disparo — nada foi executado" }, 500);
    }

    try {
      // Marcado ANTES do POST: o run nasce depois do dispatch, nunca antes.
      const t0ms = Date.now();
      const r = await fetch(
        `https://api.github.com/repos/${dono}/${repo}/actions/workflows/${cfgRobo.arquivo}/dispatches`,
        {
          method: "POST",
          headers: { ...cabecalhoGitHub(token), "Content-Type": "application/json" },
          body: JSON.stringify({ ref, inputs }),
        },
      );
      if (!r.ok) {
        const texto = (await r.text()).slice(0, 300);
        await inoveAdmin.from("dp360_auditoria").insert({
          ...trilha,
          acao: "robo_disparo_falhou",
          detalhe: { ...trilha.detalhe, http: r.status, resposta: texto },
        });
        return json({ ok: false, error: `o GitHub recusou o disparo (HTTP ${r.status})` }, 502);
      }

      /* O DISPARO JÁ ACONTECEU. Daqui para baixo NADA pode transformar esta
         chamada em erro: o robô está a caminho do Transnet, e devolver "falhou"
         faria a pessoa clicar de novo e lançar duas vezes na ficha de alguém.
         Falha de casamento vira `aviso`, e a tela oferece "procurar o run". */
      let execucao: Record<string, unknown> | null = null;
      let aviso = "";
      try {
        const casado = await casarRun(inoveAdmin, token, dono, repo, cfgRobo.arquivo, ref, t0ms);
        const { data: gravada, error: erroExec } = await inoveAdmin
          .from(TAB_EXECUCAO)
          .insert({
            auditoria_id: linhaTrilha.id,
            robo: nome,
            workflow: cfgRobo.arquivo,
            repo: `${dono}/${repo}`,
            git_ref: ref,
            confirmar: inputs.confirmar === "true",
            autor_id: authData.user.id,
            autor_nome: perfil?.nome ?? null,
            casamento: casado.casamento,
            casamento_nota: casado.casamento_nota,
            candidatos: casado.candidatos,
            casado_em: new Date().toISOString(),
            run_id: casado.run?.id ?? null,
            run_numero: casado.run?.numero ?? null,
            run_url: casado.run?.url ?? null,
            run_criado_em: casado.run?.criado_em ?? null,
            run_status: casado.run?.status ?? null,
            run_conclusao: casado.run?.conclusao ?? null,
          })
          .select("id, casamento, casamento_nota, run_id, run_url, candidatos")
          .single();
        if (erroExec) throw new Error(erroExec.message);
        execucao = gravada;
        if (casado.casamento !== "exato") {
          aviso = casado.casamento === "ambiguo"
            ? `o disparo saiu, mas ${casado.candidatos.length} execuções caíram na mesma janela — escolha a certa na tela de Evidências`
            : `o disparo saiu, mas a execução no GitHub ainda não foi localizada (${casado.casamento_nota})`;
        }
      } catch (falha) {
        aviso = `o disparo saiu, mas o vínculo com a execução do GitHub não foi gravado: ${mensagemSegura(falha)}`;
      }

      return json({
        ok: true,
        robo: nome,
        workflow: cfgRobo.arquivo,
        confirmar: inputs.confirmar === "true",
        linhas: linhasCsv,
        auditoria_id: linhaTrilha.id,
        execucao,
        aviso: aviso || null,
        painel: `https://github.com/${dono}/${repo}/actions/workflows/${cfgRobo.arquivo}`,
      });
    } catch (error) {
      await inoveAdmin.from("dp360_auditoria").insert({
        ...trilha,
        acao: "robo_disparo_falhou",
        detalhe: { ...trilha.detalhe, erro: mensagemSegura(error) },
      });
      return json({ ok: false, error: mensagemSegura(error) }, 502);
    }
  }

  /* ── daqui para baixo: A PROVA ────────────────────────────────────────────
     Todas as quatro ações abaixo trabalham sobre uma linha de
     `dp360_robo_execucao`, nunca sobre um id solto vindo da tela. Isso não é
     formalidade: sem essa amarra, o gateway viraria um proxy genérico do
     GitHub — daria para listar e baixar artefato de QUALQUER run do repositório
     mandando o número na mão. Aqui só se alcança o que a própria trilha do
     INOVE registrou.                                                          */

  const acoesDaProva = new Set(["robo_casar", "robo_artefatos", "robo_arquivar", "evidencia_url"]);
  if (acoesDaProva.has(acao)) {
    const token = tokenGitHub();
    const dono = Deno.env.get("DP360_GITHUB_OWNER") ?? "guuimaximo";
    const repo = Deno.env.get("DP360_GITHUB_REPO") ?? "DP360";

    /* ── evidencia_url: URL assinada de vida curta para ver o print ──────────
       O caminho NUNCA vem da tela: a tela manda o id da linha e o caminho sai
       do banco. Caminho vindo do cliente seria caminho escolhido pelo cliente,
       e o bucket guarda foto de tela com nome e crachá de gente. */
    if (acao === "evidencia_url") {
      const brutos = Array.isArray(corpo.ids) ? corpo.ids : [];
      const ids = brutos.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 60);
      if (!ids.length) return json({ ok: false, error: "nenhuma evidência pedida" }, 400);

      const { data: linhas, error: erroLinhas } = await inoveAdmin
        .from(TAB_EVIDENCIA)
        .select("id, caminho")
        .in("id", ids);
      if (erroLinhas) return json({ ok: false, error: erroLinhas.message }, 502);
      if (!linhas?.length) return json({ ok: false, error: "evidência não encontrada" }, 404);

      const caminhos = linhas.map((l: Record<string, unknown>) => String(l.caminho));
      const { data: assinadas, error: erroUrl } = await inoveAdmin.storage
        .from(BUCKET_EVIDENCIAS)
        .createSignedUrls(caminhos, SEGUNDOS_URL_ASSINADA);
      if (erroUrl) return json({ ok: false, error: erroUrl.message }, 502);

      const porCaminho = new Map<string, Record<string, unknown>>();
      for (const a of (assinadas ?? []) as Record<string, unknown>[]) {
        porCaminho.set(String(a.path), a);
      }
      return json({
        ok: true,
        expira_em_s: SEGUNDOS_URL_ASSINADA,
        urls: linhas.map((l: Record<string, unknown>) => {
          const a = porCaminho.get(String(l.caminho)) as Record<string, unknown> | undefined;
          return {
            id: Number(l.id),
            url: (a?.signedUrl as string) ?? null,
            erro: a?.error ? String(a.error) : (a?.signedUrl ? null : "URL não emitida"),
          };
        }),
      });
    }

    if (!token) {
      return json(
        { ok: false, error: "robô não configurado: falta o secret DP360_GITHUB_TOKEN nesta função" },
        503,
      );
    }

    const execucaoId = Number(corpo.execucao_id);
    if (!Number.isInteger(execucaoId) || execucaoId <= 0) {
      return json({ ok: false, error: "execução inválida" }, 400);
    }
    const { data: exec, error: erroExec } = await inoveAdmin
      .from(TAB_EXECUCAO)
      .select("id, robo, workflow, repo, git_ref, disparado_em, casamento, candidatos, run_id")
      .eq("id", execucaoId)
      .maybeSingle();
    if (erroExec) return json({ ok: false, error: erroExec.message }, 502);
    if (!exec) return json({ ok: false, error: "execução não encontrada na trilha" }, 404);

    /* ── robo_casar: procurar (ou escolher) o run deste disparo ──────────────
       Dois caminhos, e a diferença entre eles fica registrada:
         · sem `run_id`  → procura de novo, com a mesma régua do disparo;
         · com `run_id`  → uma PESSOA escolheu, entre os candidatos que a tela
                           mostrou. Vira `exato`, mas a nota diz que foi à mão,
                           com o nome de quem escolheu. Certeza de gente é
                           certeza; fingir que a máquina deduziu, não. */
    if (acao === "robo_casar") {
      const escolhido = corpo.run_id == null ? null : Number(corpo.run_id);

      if (escolhido != null) {
        if (!Number.isInteger(escolhido) || escolhido <= 0) {
          return json({ ok: false, error: "run inválido" }, 400);
        }
        const candidatos = Array.isArray(exec.candidatos) ? exec.candidatos : [];
        const permitido = candidatos.some(
          (c: Record<string, unknown>) => Number(c?.id) === escolhido,
        );
        if (!permitido) {
          return json(
            { ok: false, error: "este run não está entre os candidatos que o casamento encontrou" },
            403,
          );
        }
        const alvo = candidatos.find((c: Record<string, unknown>) => Number(c?.id) === escolhido) as Record<string, unknown>;
        const { error: erroUp } = await inoveAdmin
          .from(TAB_EXECUCAO)
          .update({
            casamento: "exato",
            casamento_nota: `escolhido à mão por ${perfil?.nome ?? "administrador"} entre ${candidatos.length} candidato(s)`,
            casado_em: new Date().toISOString(),
            run_id: escolhido,
            run_numero: alvo?.numero ?? null,
            run_url: alvo?.url ?? null,
            run_criado_em: alvo?.criado_em ?? null,
            run_status: alvo?.status ?? null,
            run_conclusao: alvo?.conclusao ?? null,
          })
          .eq("id", execucaoId);
        // A unique parcial em run_id é quem barra escolher um run que já é de
        // outro disparo — e o erro dela tem de aparecer, não virar "deu ruim".
        if (erroUp) return json({ ok: false, error: erroUp.message }, 409);
        return json({ ok: true, execucao_id: execucaoId, casamento: "exato", run_id: escolhido });
      }

      // Reprocurar uma execução JÁ casada gravaria `run_id = null` se a nova
      // busca não achasse nada — apagando um vínculo certo por causa de uma
      // consulta que falhou. Quem quer trocar o run manda o run_id.
      if (exec.run_id) {
        return json(
          { ok: false, error: "esta execução já tem run casado — para trocar, escolha o run à mão" },
          409,
        );
      }

      const t0ms = Date.parse(String(exec.disparado_em ?? "")) || Date.now();
      let casado: Casamento;
      try {
        casado = await casarRun(
          inoveAdmin, token, dono, repo,
          String(exec.workflow), String(exec.git_ref || "main"), t0ms,
        );
      } catch (error) {
        return json({ ok: false, error: mensagemSegura(error) }, 502);
      }
      const { error: erroUp } = await inoveAdmin
        .from(TAB_EXECUCAO)
        .update({
          casamento: casado.casamento,
          casamento_nota: casado.casamento_nota,
          candidatos: casado.candidatos,
          casado_em: new Date().toISOString(),
          run_id: casado.run?.id ?? null,
          run_numero: casado.run?.numero ?? null,
          run_url: casado.run?.url ?? null,
          run_criado_em: casado.run?.criado_em ?? null,
          run_status: casado.run?.status ?? null,
          run_conclusao: casado.run?.conclusao ?? null,
        })
        .eq("id", execucaoId);
      if (erroUp) return json({ ok: false, error: erroUp.message }, 502);
      return json({ ok: true, execucao_id: execucaoId, ...casado });
    }

    // As duas ações que sobram exigem um run já casado.
    const runId = Number(exec.run_id);
    if (!Number.isInteger(runId) || runId <= 0) {
      return json(
        { ok: false, error: "esta execução ainda não tem run casado — procure o run antes" },
        409,
      );
    }

    /* ── robo_artefatos: em que pé está o run e o que ele guardou ─────────── */
    if (acao === "robo_artefatos") {
      try {
        const run = await githubJson(
          `https://api.github.com/repos/${dono}/${repo}/actions/runs/${runId}`,
          token,
        );
        const arte = await githubJson(
          `https://api.github.com/repos/${dono}/${repo}/actions/runs/${runId}/artifacts?per_page=100`,
          token,
        );
        const artefatos = (Array.isArray(arte?.artifacts) ? arte.artifacts : []).map(
          (a: Record<string, unknown>) => ({
            id: Number(a?.id),
            nome: String(a?.name ?? ""),
            bytes: Number(a?.size_in_bytes ?? 0),
            expirado: a?.expired === true,
            criado_em: a?.created_at ?? null,
            expira_em: a?.expires_at ?? null,
          }),
        );
        // O estado do run muda depois do disparo (queued → in_progress →
        // completed). Guardar aqui evita ter de bater no GitHub só para saber
        // se deu certo quando a tela abrir de novo.
        await inoveAdmin
          .from(TAB_EXECUCAO)
          .update({ run_status: run?.status ?? null, run_conclusao: run?.conclusion ?? null })
          .eq("id", execucaoId);
        return json({
          ok: true,
          execucao_id: execucaoId,
          run: {
            id: runId,
            status: run?.status ?? null,
            conclusao: run?.conclusion ?? null,
            url: run?.html_url ?? null,
            iniciado_em: run?.run_started_at ?? run?.created_at ?? null,
          },
          artefatos,
        });
      } catch (error) {
        return json({ ok: false, error: mensagemSegura(error) }, 502);
      }
    }

    /* ── robo_arquivar: a cópia PERMANENTE ───────────────────────────────────
       Baixa o zip do artefato, descompacta e grava arquivo por arquivo no
       bucket PRIVADO. É o ponto inteiro do trabalho: depois disto a prova não
       depende mais dos 30 dias de retenção do GitHub nem de ter acesso ao repo.

       Idempotente: o caminho no bucket é determinístico e a tabela tem unique
       em `caminho`, então rearquivar o mesmo run não duplica nada. */
    if (acao === "robo_arquivar") {
      const pedido = corpo.artefato_id == null ? null : Number(corpo.artefato_id);
      try {
        const arte = await githubJson(
          `https://api.github.com/repos/${dono}/${repo}/actions/runs/${runId}/artifacts?per_page=100`,
          token,
        );
        let lista = (Array.isArray(arte?.artifacts) ? arte.artifacts : []) as Record<string, unknown>[];
        if (pedido != null) lista = lista.filter((a) => Number(a?.id) === pedido);
        if (!lista.length) return json({ ok: false, error: "este run não tem artefato para arquivar" }, 404);

        const expirados = lista.filter((a) => a?.expired === true);
        lista = lista.filter((a) => a?.expired !== true);
        if (!lista.length) {
          const recado = "o artefato EXPIROU no GitHub (retenção de 30 dias) — a prova só existiria aqui se tivesse sido arquivada antes";
          await inoveAdmin.from(TAB_EXECUCAO).update({ arquivamento_erro: recado }).eq("id", execucaoId);
          return json({ ok: false, error: recado }, 410);
        }

        const gravadas: Record<string, unknown>[] = [];
        const pulados: string[] = [];

        for (const a of lista) {
          const artefatoId = Number(a?.id);
          const artefatoNome = String(a?.name ?? "");   // "evidencias-<run_id>"

          // O endpoint /zip responde 302 para uma URL ASSINADA em outro host.
          // `redirect: "manual"` é de propósito: seguir automático arrastaria o
          // header Authorization (o token do GitHub) para o host do storage.
          const resposta = await fetch(
            `https://api.github.com/repos/${dono}/${repo}/actions/artifacts/${artefatoId}/zip`,
            { headers: cabecalhoGitHub(token), redirect: "manual" },
          );
          let zip: Uint8Array;
          if (resposta.status >= 300 && resposta.status < 400) {
            const destino = resposta.headers.get("location");
            await resposta.body?.cancel();
            if (!destino) throw new Error("o GitHub redirecionou o download sem endereço");
            const baixado = await fetch(destino); // sem Authorization: a URL já é assinada
            if (!baixado.ok) throw new Error(`falha ao baixar o artefato (HTTP ${baixado.status})`);
            zip = new Uint8Array(await baixado.arrayBuffer());
          } else if (resposta.ok) {
            zip = new Uint8Array(await resposta.arrayBuffer());
          } else {
            await resposta.body?.cancel();
            throw new Error(`o GitHub recusou o download do artefato (HTTP ${resposta.status})`);
          }
          if (zip.length > MAX_ZIP_BYTES) {
            throw new Error(`o artefato tem ${Math.round(zip.length / 1048576)} MB — acima do teto desta função`);
          }

          const entradas = lerZip(zip).filter((e) => !e.nome.endsWith("/") && e.original > 0);
          if (entradas.length > MAX_ARQUIVOS) {
            throw new Error(`o artefato tem ${entradas.length} arquivos — acima do teto de ${MAX_ARQUIVOS}`);
          }

          for (const entrada of entradas) {
            if (entrada.original > MAX_ARQUIVO_BYTES) {
              pulados.push(`${entrada.nome} (${Math.round(entrada.original / 1048576)} MB)`);
              continue;
            }
            // Cada segmento é higienizado e "." / ".." somem: o nome vem de
            // dentro de um zip, e zip com ".." no nome é o jeito clássico de
            // escrever fora da pasta pretendida.
            const relativo = partesDoCaminho(entrada.nome)
              .filter((p) => p && p !== "." && p !== "..")
              .map((p) => p.replace(/[^A-Za-z0-9._-]/g, "_"))
              .join("/");
            if (!relativo) { pulados.push(entrada.nome); continue; }

            // O bucket só aceita os tipos declarados na migration. Um arquivo
            // de tipo inesperado seria RECUSADO pelo Storage e derrubaria o
            // arquivamento inteiro — perdendo os prints por causa de um arquivo
            // que nem é prova. Pula, e o aviso diz quantos ficaram de fora.
            const ext = (relativo.split(".").pop() || "").toLowerCase();
            const mime = TIPOS_MIME[ext];
            if (!mime) { pulados.push(`${relativo} (tipo não aceito)`); continue; }

            const conteudo = await extrairDoZip(zip, entrada);
            const caminho = `${runId}/${artefatoId}/${relativo}`;
            const { error: erroUpload } = await inoveAdmin.storage
              .from(BUCKET_EVIDENCIAS)
              .upload(caminho, conteudo, { contentType: mime, upsert: true });
            if (erroUpload) throw new Error(erroUpload.message);

            const lido = interpretarNome(relativo);
            gravadas.push({
              execucao_id: execucaoId,
              run_id: runId,
              artefato_id: artefatoId,
              artefato_nome: artefatoNome,
              arquivo: relativo,
              caminho,
              bytes: conteudo.length,
              tipo: ext || null,
              cracha: lido.cracha,
              date_ref: lido.date_ref,
              momento: lido.momento,
              rotulo: lido.rotulo,
              capturado_em: lido.capturado_em,
            });
          }
        }

        if (gravadas.length) {
          const { error: erroLinhas } = await inoveAdmin
            .from(TAB_EVIDENCIA)
            .upsert(gravadas, { onConflict: "caminho" });
          if (erroLinhas) throw new Error(erroLinhas.message);
        }

        // Recontagem a partir do banco (não do lote): rearquivar não pode somar
        // duas vezes o que já estava lá.
        const { data: todas } = await inoveAdmin
          .from(TAB_EVIDENCIA)
          .select("bytes")
          .eq("execucao_id", execucaoId);
        const total = todas?.length ?? gravadas.length;
        const bytes = (todas ?? []).reduce(
          (soma: number, l: Record<string, unknown>) => soma + (Number(l.bytes) || 0),
          0,
        );

        const nota = [
          expirados.length ? `${expirados.length} artefato(s) já expirado(s) no GitHub` : "",
          pulados.length ? `${pulados.length} arquivo(s) acima do teto` : "",
        ].filter(Boolean).join(" · ");

        await inoveAdmin
          .from(TAB_EXECUCAO)
          .update({
            arquivado_em: new Date().toISOString(),
            arquivos_total: total,
            arquivo_bytes: bytes,
            arquivamento_erro: nota || null,
          })
          .eq("id", execucaoId);

        return json({
          ok: true,
          execucao_id: execucaoId,
          run_id: runId,
          arquivados_agora: gravadas.length,
          arquivos_total: total,
          bytes,
          aviso: nota || null,
        });
      } catch (error) {
        const recado = mensagemSegura(error);
        await inoveAdmin.from(TAB_EXECUCAO).update({ arquivamento_erro: recado }).eq("id", execucaoId);
        return json({ ok: false, error: recado }, 502);
      }
    }
  }

  return json({ ok: false, error: "ação DP360 não permitida" }, 400);
});
