// supabase/functions/controle-dados/index.ts
//
// Edge Function que consolida uso/custo dos servicos que pagamos.
// Roteia por ?source=:
//   supabase-inove  -> RPC controle_dados_metricas no projeto Inove
//   supabase-farol  -> RPC controle_dados_metricas no projeto Farol
//   gcp             -> custo (BigQuery billing export) ultimos 30 dias
//   all (padrao)    -> os tres em paralelo
//
// Secrets esperados em Project Settings -> Edge Functions -> Secrets:
//   FAROL_PROJECT_URL          (https://<ref>.supabase.co)
//   FAROL_SERVICE_ROLE_KEY     (service_role do projeto Farol)
//   GCP_SA_EMAIL               (client_email do JSON da service account)
//   GCP_SA_PRIVATE_KEY         (private_key do JSON, com \n literais)
//   GCP_BILLING_TABLE          (projeto.dataset.tabela do billing export)
//
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ja vem do projeto Inove.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function supabaseMetricas(url: string, key: string) {
  if (!url || !key) {
    return { ok: false, error: "credenciais ausentes" };
  }
  const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/controle_dados_metricas`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!r.ok) {
    return { ok: false, error: `HTTP ${r.status}: ${await r.text().catch(() => "")}` };
  }
  return { ok: true, data: await r.json() };
}

/* ----- GCP: JWT + BigQuery billing export ----- */

function b64urlFromBytes(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlFromString(str: string): string {
  return b64urlFromBytes(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function gcpAccessToken(email: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: email,
    scope: "https://www.googleapis.com/auth/bigquery.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );
  const jwt = `${unsigned}.${b64urlFromBytes(sig)}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error(`token Google: HTTP ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return data.access_token as string;
}

async function gcpCustos() {
  const email = Deno.env.get("GCP_SA_EMAIL") ?? "";
  const pk = Deno.env.get("GCP_SA_PRIVATE_KEY") ?? "";
  const table = Deno.env.get("GCP_BILLING_TABLE") ?? "";
  if (!email || !pk || !table) {
    return { ok: false, error: "credenciais GCP ausentes (GCP_SA_EMAIL, GCP_SA_PRIVATE_KEY, GCP_BILLING_TABLE)" };
  }

  const projectId = email.split("@")[1]?.split(".")[0] ?? "";
  if (!projectId) return { ok: false, error: "nao consegui extrair projectId do email" };

  let token: string;
  try {
    token = await gcpAccessToken(email, pk);
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }

  const query = `
    SELECT
      COALESCE(service.description, 'desconhecido') AS servico,
      SUM(cost)                                     AS custo,
      currency                                      AS moeda
    FROM \`${table}\`
    WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
    GROUP BY servico, moeda
    ORDER BY custo DESC
    LIMIT 20
  `;

  const r = await fetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, useLegacySql: false, timeoutMs: 20000 }),
  });
  if (!r.ok) {
    return { ok: false, error: `BigQuery HTTP ${r.status}: ${await r.text().catch(() => "")}` };
  }
  const data = await r.json();

  const rows = (data.rows ?? []).map((row: any) => ({
    servico: row.f?.[0]?.v ?? "",
    custo: Number(row.f?.[1]?.v ?? 0),
    moeda: row.f?.[2]?.v ?? "USD",
  }));
  const total = rows.reduce((s: number, x: any) => s + (x.custo || 0), 0);
  const moeda = rows[0]?.moeda ?? "USD";

  return {
    ok: true,
    data: {
      total_30d: total,
      moeda,
      por_servico: rows,
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const source = (url.searchParams.get("source") ?? "all").toLowerCase();

  const inoveUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const inoveKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const farolUrl = Deno.env.get("FAROL_PROJECT_URL") ?? "";
  const farolKey = Deno.env.get("FAROL_SERVICE_ROLE_KEY") ?? "";

  if (source === "supabase-inove") return json(await supabaseMetricas(inoveUrl, inoveKey));
  if (source === "supabase-farol") return json(await supabaseMetricas(farolUrl, farolKey));
  if (source === "gcp") return json(await gcpCustos());

  if (source === "all") {
    const [inove, farol, gcp] = await Promise.all([
      supabaseMetricas(inoveUrl, inoveKey),
      supabaseMetricas(farolUrl, farolKey),
      gcpCustos(),
    ]);
    return json({
      ok: true,
      coletado_em: new Date().toISOString(),
      supabase_inove: inove,
      supabase_farol: farol,
      gcp,
    });
  }

  return json({ ok: false, error: `source desconhecido: ${source}` }, 400);
});
