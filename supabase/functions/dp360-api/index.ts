// Gateway privado entre o INOVE e a base operacional DP360.
//
// A chave da base de ponto existe somente como secret desta Edge Function.
// O navegador recebe apenas o resumo permitido para um Administrador do INOVE.

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

type Fonte = {
  nome: string;
  tabela: string;
  coluna: string;
};

const FONTES: Fonte[] = [
  { nome: "Ponto diário", tabela: "ponto_diario", coluna: "date_ref" },
  { nome: "Gordura", tabela: "ponto_gordura", coluna: "data_ref" },
  { nome: "Ocorrências", tabela: "ponto_ajustes_app", coluna: "capturado_em" },
  { nome: "Casos", tabela: "ponto_caso", coluna: "date_ref" },
];

async function consultarDp360(base: string, chave: string, tabela: string, consulta: string) {
  const resposta = await fetch(`${base}/rest/v1/${tabela}?${consulta}`, {
    headers: {
      apikey: chave,
      Authorization: `Bearer ${chave}`,
      Accept: "application/json",
    },
  });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return await resposta.json();
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

  let corpo: { action?: string } = {};
  try {
    corpo = await req.json();
  } catch {
    return json({ ok: false, error: "corpo JSON inválido" }, 400);
  }
  const action = corpo.action ?? "overview";
  if (action !== "overview" && action !== "refeicao") {
    return json({ ok: false, error: "ação DP360 não permitida" }, 400);
  }

  const base = dp360Url.replace(/\/$/, "");
  if (action === "refeicao") {
    try {
      const colunas = [
        "cracha", "data_ref", "status_almoco",
        "sugestao_inicio", "sugestao_fim", "sugestao_duracao_min",
        "sugestao_sst_inicio", "sugestao_sst_fim", "sugestao_sst_duracao_min",
        "transnet_almoco_inicio", "transnet_almoco_fim", "transnet_almoco_duracao_min",
        "programado_inicio", "programado_fim",
      ].join(",");
      const linhas = await consultarDp360(
        base,
        dp360Service,
        "ponto_intervalo",
        `select=${encodeURIComponent(colunas)}&order=data_ref.desc,cracha.asc&limit=200`,
      );
      return json({
        ok: true,
        coletado_em: new Date().toISOString(),
        linhas: linhas.map((linha: Record<string, unknown>) => ({
          cracha: String(linha.cracha ?? ""),
          data: linha.data_ref ?? null,
          situacao: linha.status_almoco ?? "SEM STATUS",
          citatti: { inicio: linha.sugestao_inicio ?? null, fim: linha.sugestao_fim ?? null, duracao_min: linha.sugestao_duracao_min ?? null },
          sst: { inicio: linha.sugestao_sst_inicio ?? null, fim: linha.sugestao_sst_fim ?? null, duracao_min: linha.sugestao_sst_duracao_min ?? null },
          ponto: { inicio: linha.transnet_almoco_inicio ?? null, fim: linha.transnet_almoco_fim ?? null, duracao_min: linha.transnet_almoco_duracao_min ?? null },
          programado: { inicio: linha.programado_inicio ?? null, fim: linha.programado_fim ?? null },
        })),
      });
    } catch (error) {
      return json({ ok: false, error: `não foi possível consultar a refeição: ${mensagemSegura(error)}` }, 502);
    }
  }

  const consultarFonte = async (fonte: Fonte) => {
    try {
      const linhas = await consultarDp360(
        base,
        dp360Service,
        fonte.tabela,
        `select=${encodeURIComponent(fonte.coluna)}&order=${fonte.coluna}.desc&limit=1`,
      );
      return { nome: fonte.nome, atualizado_em: linhas?.[0]?.[fonte.coluna] ?? null, ok: true };
    } catch (error) {
      return { nome: fonte.nome, atualizado_em: null, ok: false, erro: mensagemSegura(error) };
    }
  };

  const fontes = await Promise.all(FONTES.map(consultarFonte));
  return json({
    ok: true,
    coletado_em: new Date().toISOString(),
    fontes,
  });
});
