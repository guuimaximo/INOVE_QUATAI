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
  const workflow =
    tipo === "semanal" ? "bot-estoque-semanal.yml" : "bot-estoque-diaria.yml";

  const inputs: Record<string, string> = {};
  if (payload?.data_alvo) inputs["data_alvo"] = String(payload.data_alvo);

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
