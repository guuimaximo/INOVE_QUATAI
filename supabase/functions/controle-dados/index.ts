// supabase/functions/controle-dados/index.ts
//
// Edge Function que consolida uso dos Supabases que pagamos (Inove + Farol)
// para a tela Configuracoes -> Controle de Dados.
//
// Roteia por ?source=:
//   supabase-inove  -> RPC controle_dados_metricas no projeto Inove
//   supabase-farol  -> RPC controle_dados_metricas no projeto Farol
//   all (padrao)    -> ambos
//
// Secrets esperados em Project Settings -> Edge Functions -> Secrets:
//   FAROL_PROJECT_URL          (https://<ref>.supabase.co)
//   FAROL_SERVICE_ROLE_KEY     (service_role do projeto Farol)
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

  if (source === "all") {
    const [inove, farol] = await Promise.all([
      supabaseMetricas(inoveUrl, inoveKey),
      supabaseMetricas(farolUrl, farolKey),
    ]);
    return json({
      ok: true,
      coletado_em: new Date().toISOString(),
      supabase_inove: inove,
      supabase_farol: farol,
    });
  }

  return json({ ok: false, error: `source desconhecido: ${source}` }, 400);
});
