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
   `escrever` : operacoes permitidas ("upsert" | "insert" | "delete").
   `conflito` : chave do on_conflict do upsert (espelha o supabase_client do DP).
   Espelha exatamente o contrato do DP360 (ferramenta/supabase_client.py).      */
type Acesso = {
  ler: boolean;
  escrever?: Array<"upsert" | "insert" | "delete">;
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
};

const LIMITE_MAX = 5000;
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
    .select("id, nivel, ativo, status_cadastro")
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
    if (!cfg?.escrever?.includes(op as "upsert" | "insert" | "delete")) {
      return json({ ok: false, error: "operação não liberada para esta tabela" }, 403);
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

  return json({ ok: false, error: "ação DP360 não permitida" }, 400);
});
