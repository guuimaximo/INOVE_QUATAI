// Integração com Google Calendar via Google Identity Services.
// Reusa o mesmo Client ID configurado para o Farol Tático.

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "85423703623-eera05msl4ggnkdngccoqq4f7qablu5s.apps.googleusercontent.com";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const TOKEN_STORAGE_KEY = "google_calendar_token";

let gisLoadPromise = null;

function loadGisScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar GIS")));
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Falha ao carregar Google Identity Services"));
    document.head.appendChild(s);
  });
  return gisLoadPromise;
}

function readStoredToken() {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.access_token || !parsed?.expires_at) return null;
    if (Date.now() >= parsed.expires_at - 30_000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch {}
}

export function clearGoogleToken() {
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
}

export function getStoredGoogleEmail() {
  return readStoredToken()?.email || null;
}

export function isGoogleConnected() {
  return !!readStoredToken();
}

export async function ensureGoogleToken({ forcePrompt = false } = {}) {
  const cached = readStoredToken();
  if (cached && !forcePrompt) return cached;
  await loadGisScript();
  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPE,
        prompt: forcePrompt ? "consent" : "",
        callback: async (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          const expiresIn = Number(resp.expires_in || 3600);
          let email = null;
          try {
            const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${resp.access_token}` },
            });
            if (r.ok) email = (await r.json()).email || null;
          } catch {}
          const token = {
            access_token: resp.access_token,
            expires_at: Date.now() + expiresIn * 1000,
            email,
          };
          storeToken(token);
          resolve(token);
        },
      });
      tokenClient.requestAccessToken({ prompt: forcePrompt ? "consent" : "" });
    } catch (e) {
      reject(e);
    }
  });
}

// ── Criação / atualização do evento de Especial ────────────────────────
async function findExistingEvent(accessToken, especialId) {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
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

function buildEspecialEvent(especial, emailsList) {
  const dia = especial.data;
  const horaIda = (especial.ida_hora_saida || "07:00").substring(0, 5);
  const horaVolta = (especial.volta_hora_saida || "15:00").substring(0, 5);

  // Estima fim: 1h depois da hora de retorno
  const [hv, mv] = horaVolta.split(":").map(Number);
  const fimMinutos = hv * 60 + mv + 60;
  const fimH = Math.floor(fimMinutos / 60) % 24;
  const fimM = fimMinutos % 60;
  const horaFim = `${String(fimH).padStart(2, "0")}:${String(fimM).padStart(2, "0")}`;

  const linhasIda = [
    `🚌 IDA — ${horaIda}`,
    especial.ida_local_saida ? `Saída: ${especial.ida_local_saida}` : null,
    especial.ida_end_saida ? `   ${especial.ida_end_saida}` : null,
    ...(especial.ida_paradas || []).flatMap((p, i) => [
      `Parada ${i + 1}: ${p.local || ""}`,
      p.endereco ? `   ${p.endereco}` : null,
    ]),
    especial.ida_destino_local ? `Destino: ${especial.ida_destino_local}` : null,
    especial.ida_end_destino ? `   ${especial.ida_end_destino}` : null,
  ].filter(Boolean);

  const linhasVolta = [
    "",
    `🚌 VOLTA — ${horaVolta}`,
    especial.volta_local_saida ? `Saída: ${especial.volta_local_saida}` : null,
    especial.volta_end_saida ? `   ${especial.volta_end_saida}` : null,
    ...(especial.volta_paradas || []).flatMap((p, i) => [
      `Parada ${i + 1}: ${p.local || ""}`,
      p.endereco ? `   ${p.endereco}` : null,
    ]),
    especial.volta_destino_local ? `Destino: ${especial.volta_destino_local}` : null,
    especial.volta_end_destino ? `   ${especial.volta_end_destino}` : null,
  ].filter(Boolean);

  const descricao = [
    `Quantidade de ônibus: ${especial.qtd_onibus || 1}`,
    "",
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
    colorId: "3", // Roxo (Grape)
    attendees: (emailsList || []).filter(Boolean).map((email) => ({ email })),
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 24 * 60 },     // 1 dia antes (popup)
        { method: "email", minutes: 24 * 60 },     // 1 dia antes (email)
      ],
    },
    extendedProperties: {
      private: { inove_especial_id: String(especial.id || "") },
    },
  };
}

export async function syncEspecialToGoogle(especial, emailsList) {
  const token = await ensureGoogleToken();
  const existingId = especial.google_event_id
    ? especial.google_event_id
    : await findExistingEvent(token.access_token, especial.id);

  const body = buildEspecialEvent(especial, emailsList);

  // sendUpdates=all → manda convite/notificação pros attendees
  const baseUrl = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  const url = existingId
    ? `${baseUrl}/${encodeURIComponent(existingId)}?sendUpdates=all`
    : `${baseUrl}?sendUpdates=all`;
  const method = existingId ? "PATCH" : "POST";

  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Google: HTTP ${r.status} - ${text}`);
  }
  const created = await r.json();
  return { eventId: created.id, action: existingId ? "updated" : "created" };
}

export async function deleteEspecialFromGoogle(especialId, googleEventId) {
  if (!isGoogleConnected()) return { ok: true, deleted: false };
  const token = await ensureGoogleToken();
  const id =
    googleEventId || (await findExistingEvent(token.access_token, especialId));
  if (!id) return { ok: true, deleted: false };
  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token.access_token}` } }
  );
  if (r.ok || r.status === 410) return { ok: true, deleted: true };
  return { ok: false, deleted: false };
}
