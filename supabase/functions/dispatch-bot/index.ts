// supabase/functions/dispatch-bot/index.ts
//
// Edge Function que dispara um workflow do GitHub Actions sob demanda.
// Chamada pelo app logo apos inserir um job em suprimentos_bot_jobs,
// pra nao esperar o cron de 5 min.

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

async function jobAtivoExistente(
  tipo: string,
  data_alvo: string,
  lote_id?: string,
): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const url = new URL(`${SUPABASE_URL}/rest/v1/suprimentos_bot_jobs`);
  url.searchParams.set("select", "id,status,iniciado_em,created_at,lote_id");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "1");

  if (lote_id) {
    url.searchParams.set("lote_id", `eq.${lote_id}`);
  } else {
    url.searchParams.set("data_alvo", `eq.${data_alvo}`);
    url.searchParams.set("tipo_contagem", `eq.${tipo}`);
    url.searchParams.set("status", "in.(pendente,processando)");
  }

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
  const lote_id = payload?.lote_id ? String(payload.lote_id) : undefined;
  const force = Boolean(payload?.force);

  const WORKFLOWS: Record<string, string> = {
    diaria: "bot-estoque-diaria.yml",
    semanal: "bot-estoque-semanal.yml",
    sr_aberta: "bot-sr-aberta.yml",
    pneus: "bot-pneus.yml",
  };
  const workflow = WORKFLOWS[tipo] ?? WORKFLOWS.diaria;

  if (tipo === "sr_aberta" || tipo === "pneus") {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflow}/dispatches`;
    const ghResp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: REF }),
    });
    if (!ghResp.ok) {
      const text = await ghResp.text();
      return json({ ok: false, status: ghResp.status, workflow, ref: REF, error: text }, 502);
    }
    return json({ ok: true, workflow, ref: REF });
  }

  if (!force && (lote_id || data_alvo)) {
    const existente = await jobAtivoExistente(tipo, data_alvo, lote_id);
    if (existente) {
      return json({
        ok: true,
        skipped: true,
        reason: lote_id ? "lote_ja_processado" : "ja_existe_job_ativo",
        job: existente,
        workflow,
      });
    }
  }

  if (SUPABASE_URL && SUPABASE_SERVICE_KEY && data_alvo) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/suprimentos_bot_jobs`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          tipo: "conferencia_dia",
          tipo_contagem: tipo,
          data_alvo,
          status: "pendente",
          lote_id: lote_id ?? null,
          criado_por_nome: "App (dispatch-bot)",
        }),
      });
    } catch (_) {
      // ignora -- workflow ainda vai rodar
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
    return json({ ok: false, status: ghResp.status, workflow, ref: REF, error: text }, 502);
  }
  return json({ ok: true, workflow, ref: REF, inputs });
});
