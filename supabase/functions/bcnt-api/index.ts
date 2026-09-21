// Gateway privado entre o INOVE e a base BCNT (checklists, meritocracia, veículos).
//
// POR QUE EXISTE (21/09/2026). O INOVE lia a BCNT direto do navegador, com a chave pública
// dentro do site. A BCNT fechou o acesso dessa chave — "permission denied for table
// checklists" — e as telas de Checklist, Resumo e Lançamento do Diesel e o painel da Home
// ficaram sem dado; a listagem de arquivos do Agente passou a voltar vazia. O dono não quis
// repor a chave no site ("não queria deixar como VITE"): qualquer `VITE_` é compilada dentro
// do JavaScript e fica visível para quem abrir a página.
//
// Aqui a chave da BCNT vive SÓ como secret desta função. O navegador manda a sessão do
// INOVE; a função confere quem é, olha a página liberada no usuário e devolve apenas o que
// aquela tela precisa.
//
// SEGURANÇA (não afrouxar):
//   1. Exige sessão do INOVE (JWT) e usuário ativo/aprovado.
//   2. SOMENTE LEITURA. Não existe caminho de escrita nesta função — a BCNT é de outro dono.
//   3. ALLOWLIST de tabelas e de buckets, com a página que cada um exige. Nada além disso
//      passa, nem mesmo para Administrador.
//   4. Os arquivos saem por URL assinada de 5 minutos, nunca com a chave.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* ── O QUE PODE SER LIDO, E POR QUEM ──────────────────────────────────────────
   A página é a mesma do menu do INOVE (`accessCatalog.js`). Quem não tem a página
   liberada no usuário não lê a tabela, mesmo com sessão válida.                */
const TABELAS: Record<string, string[]> = {
  // checklists preenchidos no app — Central de Checklists
  checklists: ["checklists_central", "checklists_painel_sr", "checklists_fichas_sr_manutencao"],
  // meritocracia por motorista/dia — Resumo e Lançamento do Diesel e o painel da Home
  premiacao_diaria_atualizada: ["diesel_resumo", "diesel_lancamento", "diesel_agente", "home"],
  // meritocracia consolidada do mês
  premiacao_atualizada: ["diesel_resumo", "diesel_agente"],
  // veículo e cluster
  veiculos_ativos: ["diesel_resumo", "diesel_lancamento", "diesel_agente"],
};
const BUCKETS: Record<string, string[]> = {
  parcial_meritocracia: ["diesel_agente", "diesel_resumo"],
  relatorios: ["diesel_agente", "diesel_resumo"],
};

const LIMITE_MAX = 5000;
const SEGUNDOS_URL = 300;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FILTRO_VALOR = /^[A-Za-z_.]+\.[^&#]*$/;
const CAMINHO = /^[A-Za-z0-9_\-./ ]*$/;

function colunasValidas(bruto: unknown): string | null {
  if (bruto == null) return "*";
  const texto = String(bruto);
  if (texto.trim() === "*") return "*";
  const partes = texto.split(",").map((c) => c.trim()).filter(Boolean);
  if (!partes.length || partes.length > 60) return null;
  return partes.every((c) => IDENT.test(c)) ? partes.join(",") : null;
}

function montarFiltros(filtros: unknown): string | null {
  if (filtros == null) return "";
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
  return partes.join("&");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "use POST" }, 405);

  const inoveUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const inoveAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const inoveService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bcntUrl = (Deno.env.get("BCNT_URL") ?? "").replace(/\/$/, "");
  const bcntKey = Deno.env.get("BCNT_KEY") ?? "";
  if (!inoveUrl || !inoveAnon || !inoveService || !bcntUrl || !bcntKey) {
    return json({ ok: false, error: "função sem configuração (faltam os segredos BCNT_URL/BCNT_KEY)" }, 503);
  }

  // 1. quem está chamando — a sessão é do INOVE, não da BCNT
  const autorizacao = req.headers.get("Authorization") ?? "";
  const token = autorizacao.startsWith("Bearer ") ? autorizacao.slice(7) : "";
  if (!token) return json({ ok: false, error: "sem sessão" }, 401);
  const inove = createClient(inoveUrl, inoveAnon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: auth, error: erroAuth } = await inove.auth.getUser();
  if (erroAuth || !auth?.user) return json({ ok: false, error: "sessão inválida" }, 401);

  const admin = createClient(inoveUrl, inoveService, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: perfil } = await admin
    .from("usuarios_aprovadores")
    .select("id, nome, nivel, ativo, status_cadastro, paginas_liberadas, paginas_bloqueadas")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  const normal = (v: unknown) => String(v ?? "").trim().toLowerCase();
  const ativo = perfil?.ativo !== false;
  const aprovado = !perfil?.status_cadastro || normal(perfil.status_cadastro) === "aprovado";
  const ehAdmin = ["administrador", "admin"].includes(normal(perfil?.nivel));
  if (!perfil || !ativo || !aprovado) return json({ ok: false, error: "usuário sem acesso" }, 403);

  const chaves = (v: unknown) => new Set((Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()));
  const liberadas = chaves(perfil?.paginas_liberadas);
  const bloqueadas = chaves(perfil?.paginas_bloqueadas);
  // "home" todo mundo tem; o resto é liberação individual (ou Administrador)
  const pode = (pagina: string) =>
    pagina === "home" || ehAdmin || (liberadas.has(pagina) && !bloqueadas.has(pagina));

  let corpo: Record<string, unknown> = {};
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, error: "corpo JSON inválido" }, 400);
  }
  const acao = String(corpo.action ?? "read");
  const cab = { apikey: bcntKey, Authorization: `Bearer ${bcntKey}`, Accept: "application/json" };

  /* ── read: uma das tabelas da allowlist ──────────────────────────────────── */
  if (acao === "read") {
    const tabela = String(corpo.tabela ?? "");
    const paginas = TABELAS[tabela];
    if (!paginas) return json({ ok: false, error: "tabela não liberada" }, 403);
    if (!paginas.some(pode)) return json({ ok: false, error: `seu usuário não tem a página desta tela (${tabela})` }, 403);

    const select = colunasValidas(corpo.colunas);
    if (select === null) return json({ ok: false, error: "colunas inválidas" }, 400);
    const filtros = montarFiltros(corpo.filtros);
    if (filtros === null) return json({ ok: false, error: "filtros inválidos" }, 400);
    const limite = Math.min(Math.max(Number(corpo.limite ?? 1000) || 1000, 1), LIMITE_MAX);
    const offset = Math.max(Number(corpo.offset ?? 0) || 0, 0);

    let qs = `select=${encodeURIComponent(select)}&limit=${limite}&offset=${offset}`;
    if (filtros) qs += `&${filtros}`;
    if (corpo.ordem != null) {
      const ordem = String(corpo.ordem);
      const ok = ordem.split(",").every((o) => {
        const [c, dir] = o.trim().split(".");
        return IDENT.test(c || "") && (!dir || dir === "asc" || dir === "desc");
      });
      if (!ok) return json({ ok: false, error: "ordem inválida" }, 400);
      qs += `&order=${encodeURIComponent(ordem)}`;
    }
    try {
      const r = await fetch(`${bcntUrl}/rest/v1/${tabela}?${qs}`, { headers: cab });
      if (!r.ok) return json({ ok: false, error: `a BCNT respondeu HTTP ${r.status}` }, 502);
      const linhas = await r.json();
      return json({ ok: true, tabela, linhas, total: Array.isArray(linhas) ? linhas.length : 0 });
    } catch (e) {
      return json({ ok: false, error: `falha ao ler a BCNT: ${(e as Error)?.name ?? "erro"}` }, 502);
    }
  }

  /* ── arquivos: lista um bucket, sem devolver chave nenhuma ───────────────── */
  if (acao === "arquivos") {
    const bucket = String(corpo.bucket ?? "");
    const paginas = BUCKETS[bucket];
    if (!paginas) return json({ ok: false, error: "bucket não liberado" }, 403);
    if (!paginas.some(pode)) return json({ ok: false, error: "seu usuário não tem a página desta tela" }, 403);
    const prefixo = String(corpo.prefixo ?? "");
    if (!CAMINHO.test(prefixo)) return json({ ok: false, error: "caminho inválido" }, 400);
    const limite = Math.min(Math.max(Number(corpo.limite ?? 100) || 100, 1), 1000);
    try {
      const r = await fetch(`${bcntUrl}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: { ...cab, "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: prefixo,
          limit: limite,
          offset: 0,
          sortBy: { column: String(corpo.ordenarPor ?? "name"), order: corpo.ordem === "desc" ? "desc" : "asc" },
        }),
      });
      if (!r.ok) return json({ ok: false, error: `a BCNT respondeu HTTP ${r.status}` }, 502);
      return json({ ok: true, bucket, arquivos: await r.json() });
    } catch (e) {
      return json({ ok: false, error: `falha ao listar na BCNT: ${(e as Error)?.name ?? "erro"}` }, 502);
    }
  }

  /* ── arquivo_url: link temporário de 5 min para UM arquivo ───────────────── */
  if (acao === "arquivo_url") {
    const bucket = String(corpo.bucket ?? "");
    const paginas = BUCKETS[bucket];
    if (!paginas) return json({ ok: false, error: "bucket não liberado" }, 403);
    if (!paginas.some(pode)) return json({ ok: false, error: "seu usuário não tem a página desta tela" }, 403);
    const caminho = String(corpo.caminho ?? "").replace(/^\/+/, "");
    if (!caminho || !CAMINHO.test(caminho)) return json({ ok: false, error: "caminho inválido" }, 400);
    try {
      const r = await fetch(`${bcntUrl}/storage/v1/object/sign/${bucket}/${caminho}`, {
        method: "POST",
        headers: { ...cab, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: SEGUNDOS_URL }),
      });
      if (!r.ok) return json({ ok: false, error: `a BCNT respondeu HTTP ${r.status}` }, 502);
      const { signedURL, signedUrl } = await r.json();
      const assinada = signedUrl ?? signedURL ?? "";
      return json({ ok: true, url: assinada ? `${bcntUrl}/storage/v1${assinada}` : "" });
    } catch (e) {
      return json({ ok: false, error: `falha ao assinar na BCNT: ${(e as Error)?.name ?? "erro"}` }, 502);
    }
  }

  return json({ ok: false, error: "ação desconhecida" }, 400);
});
