// supabase/functions/dispatch-bot/index.ts
//
// Edge Function que dispara um workflow do GitHub Actions sob demanda.
// Chamada pelo app logo apos inserir um job em suprimentos_bot_jobs,
// pra nao esperar o cron de 5 min.
//
// Espera body JSON:
//   { tipo: "diaria" | "semanal", data_alvo?: "YYYY-MM-DD" }
//
// Env vars que precisam estar configuradas no projeto Supabase
// (Project Settings -> Edge Functions -> Secrets):
//   GITHUB_TOKEN        -> Personal Access Token com scope actions:write
//   GITHUB_REPO_OWNER   -> ex.: guuimaximo
//   GITHUB_REPO_NAME    -> ex.: INOVE_QUATAI
//   GITHUB_REF          -> branch/ref (ex.: main ou codex/diesel-organograma-highlights)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN") ?? "";
const REPO_OWNER = Deno.env.get("GITHUB_REPO_OWNER") ?? "guuimaximo";
const REPO_NAME = Deno.env.get("GITHUB_REPO_NAME") ?? "INOVE_QUATAI";
const REF = Deno.env.get("GITHUB_REF") ?? "main";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Verifica se já existe um job ativo (pendente OU processando) para a mesma data_alvo
// e tipo_contagem. Se sim, NÃO dispara — o workflow já está rodando.
async function jobAtivoExistente(tipo: string, data_alvo: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const url = new URL(`${SUPABASE_URL}/rest/v1/suprimentos_bot_jobs`);
  url.searchParams.set("select", "id,status,iniciado_em,created_at");
  url.searchParams.set("data_alvo", `eq.${data_alvo}`);
  url.searchParams.set("tipo_contagem", `eq.${tipo}`);
  url.searchParams.set("status", "in.(pendente,processando)");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "1");

  const r = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows?.[0] ?? null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!GITHUB_TOKEN) {
    return json({ ok: false, error: "GITHUB_TOKEN nao configurado" }, 500);
  }

  let payload: any = {};
  try {
    payload = await req.json();
  } catch (_) {
    payload = {};
  }

  const tipo = String(payload?.tipo ?? "diaria").toLowerCase();
  const data_alvo = String(payload?.data_alvo ?? "");
  const force = Boolean(payload?.force);
  const workflow =
    tipo === "semanal" ? "bot-estoque-semanal.yml" : "bot-estoque-diaria.yml";

  // Debounce: se já existe job pendente/processando, não dispara de novo.
  if (data_alvo && !force) {
    const existente = await jobAtivoExistente(tipo, data_alvo);
    if (existente) {
      return json({
        ok: true,
        skipped: true,
        reason: "ja_existe_job_ativo",
        job: existente,
        workflow,
      });
    }
  }

  const inputs: Record<string, string> = {};
  if (data_alvo) inputs["data_alvo"] = data_alvo;

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflow}/dispatches`;
  const ghResp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: REF, inputs }),
  });

  if (!ghResp.ok) {
    const text = await ghResp.text();
    return json(
      { ok: false, status: ghResp.status, workflow, ref: REF, error: text },
      502
    );
  }
  return json({ ok: true, workflow, ref: REF, inputs });
});
