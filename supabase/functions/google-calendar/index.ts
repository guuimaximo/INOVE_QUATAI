// supabase/functions/google-calendar/index.ts
//
// Edge Function centralizada para criar/atualizar/excluir eventos no
// Google Agenda da conta admin (transmissão), usando um refresh_token
// armazenado como secret do Supabase.
//
// Body JSON:
//   { action: "upsert", especial: { ... }, emails: ["a@b.com", ...] }
//   { action: "delete", especialId: 123, googleEventId?: "..." }
//
// Secrets necessárias:
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   GOOGLE_REFRESH_TOKEN     ← do dono da agenda (Guilherme)
//   GOOGLE_CALENDAR_ID       ← "primary" ou ID específico

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REFRESH_TOKEN = Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "";
const CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "primary";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function getAccessToken(): Promise<string> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString(),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Google token error: ${r.status} ${text}`);
  }
  const data = await r.json();
  return data.access_token as string;
}

function buildEvent(especial: any, emails: string[]) {
  const dia = especial.data;
  const horaIda = String(especial.ida_hora_saida || "07:00").substring(0, 5);
  const horaVolta = String(especial.volta_hora_saida || "15:00").substring(0, 5);
  const [hv, mv] = horaVolta.split(":").map(Number);
  const fimMin = hv * 60 + mv + 60;
  const fimH = Math.floor(fimMin / 60) % 24;
  const fimM = fimMin % 60;
  const horaFim = `${String(fimH).padStart(2, "0")}:${String(fimM).padStart(2, "0")}`;

  const linhasIda = [
    `🚌 IDA — ${horaIda}`,
    especial.ida_local_saida ? `Saída: ${especial.ida_local_saida}` : null,
    especial.ida_end_saida ? `   ${especial.ida_end_saida}` : null,
    ...(especial.ida_paradas || []).flatMap((p: any, i: number) => [
      `Parada ${i + 1}: ${p?.local || ""}`,
      p?.endereco ? `   ${p.endereco}` : null,
    ]),
    especial.ida_destino_local ? `Destino: ${especial.ida_destino_local}` : null,
    especial.ida_end_destino ? `   ${especial.ida_end_destino}` : null,
  ].filter(Boolean);

  const linhasVolta = [
    "",
    `🚌 VOLTA — ${horaVolta}`,
    especial.volta_local_saida ? `Saída: ${especial.volta_local_saida}` : null,
    especial.volta_end_saida ? `   ${especial.volta_end_saida}` : null,
    ...(especial.volta_paradas || []).flatMap((p: any, i: number) => [
      `Parada ${i + 1}: ${p?.local || ""}`,
      p?.endereco ? `   ${p.endereco}` : null,
    ]),
    especial.volta_destino_local ? `Destino: ${especial.volta_destino_local}` : null,
    especial.volta_end_destino ? `   ${especial.volta_end_destino}` : null,
  ].filter(Boolean);

  const motoristas = (especial.motoristas || []).filter((m: any) => m?.chapa || m?.nome);
  const linhasMot = motoristas.length
    ? [
        "👨‍✈️ Motoristas",
        ...motoristas.map(
          (m: any, i: number) =>
            `Ônibus ${i + 1}: ${[m?.chapa, m?.nome].filter(Boolean).join(" - ") || "—"}` +
            (m?.prefixo ? `  (Prefixo ${m.prefixo})` : ""),
        ),
        "",
      ]
    : [];

  const descricao = [
    `Quantidade de ônibus: ${especial.qtd_onibus || 1}`,
    "",
    ...linhasMot,
    ...linhasIda,
    ...linhasVolta,
    "",
    especial.observacoes ? `Observações: ${especial.observacoes}` : null,
    "",
    `Lançado no INOVE (ID: ${especial.id || "—"})`,
  ].filter((l) => l !== null).join("\n");

  return {
    summary: `Especial — ${especial.ida_destino_local || "Transporte Especial"}`,
    description: descricao,
    location: especial.ida_end_destino || "",
    start: { dateTime: `${dia}T${horaIda}:00`, timeZone: "America/Sao_Paulo" },
    end: { dateTime: `${dia}T${horaFim}:00`, timeZone: "America/Sao_Paulo" },
    colorId: "3", // Grape (roxo)
    attendees: (emails || []).filter(Boolean).map((email: string) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 24 * 60 },
        { method: "email", minutes: 24 * 60 },
      ],
    },
    extendedProperties: {
      private: { inove_especial_id: String(especial.id || "") },
    },
  };
}

async function findExisting(accessToken: string, especialId: string | number) {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
  );
  url.searchParams.set("privateExtendedProperty", `inove_especial_id=${especialId}`);
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("showDeleted", "false");
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.items?.[0]?.id || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Use POST", { status: 405, headers: CORS });
  }
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Google secrets não configurados no Supabase." }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const accessToken = await getAccessToken();

    if (body.action === "upsert") {
      const especial = body.especial;
      const emails = body.emails || [];
      const existingId = especial.google_event_id
        ? especial.google_event_id
        : await findExisting(accessToken, especial.id);
      const ev = buildEvent(especial, emails);

      const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
      const url = existingId
        ? `${base}/${encodeURIComponent(existingId)}?sendUpdates=all`
        : `${base}?sendUpdates=all`;
      const method = existingId ? "PATCH" : "POST";

      const r = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ev),
      });
      if (!r.ok) {
        const text = await r.text();
        return new Response(JSON.stringify({ error: text }), {
          status: r.status,
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const created = await r.json();
      return new Response(
        JSON.stringify({
          ok: true,
          eventId: created.id,
          action: existingId ? "updated" : "created",
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    if (body.action === "delete") {
      const id =
        body.googleEventId ||
        (await findExisting(accessToken, body.especialId));
      if (!id) {
        return new Response(JSON.stringify({ ok: true, deleted: false }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const r = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(id)}?sendUpdates=all`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (r.ok || r.status === 410) {
        return new Response(JSON.stringify({ ok: true, deleted: true }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      const text = await r.text();
      return new Response(JSON.stringify({ ok: false, error: text }), {
        status: r.status,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action inválida" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
