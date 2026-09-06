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
    const ROBOS: Record<string, { arquivo: string; inputs: Record<string, string[] | null> }> = {
      // null = texto livre (o CSV / o JSON dos casos); array = valores aceitos
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

    const nome = String(corpo.robo ?? "");
    const cfgRobo = ROBOS[nome];
    if (!cfgRobo) return json({ ok: false, error: "robô não permitido" }, 403);

    const token = Deno.env.get("DP360_GITHUB_TOKEN") || Deno.env.get("GITHUB_TOKEN") || "";
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

    const { error: erroTrilha } = await inoveAdmin.from("dp360_auditoria").insert(trilha);
    if (erroTrilha) {
      return json({ ok: false, error: "não foi possível registrar o disparo — nada foi executado" }, 500);
    }

    try {
      const r = await fetch(
        `https://api.github.com/repos/${dono}/${repo}/actions/workflows/${cfgRobo.arquivo}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
          },
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
      return json({
        ok: true,
        robo: nome,
        workflow: cfgRobo.arquivo,
        confirmar: inputs.confirmar === "true",
        linhas: linhasCsv,
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

  return json({ ok: false, error: "ação DP360 não permitida" }, 400);
});
