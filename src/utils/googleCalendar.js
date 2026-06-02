// Integração com Google Calendar via Edge Function centralizada do Supabase.
// Toda a comunicação com o Google passa pela Edge Function "google-calendar"
// usando o refresh_token do admin (Guilherme) armazenado nas secrets.
// Por isso, qualquer usuário consegue criar eventos na agenda dele sem precisar
// autenticar individualmente no Google.

import { supabase } from "../supabase";

async function callFunction(payload) {
  const { data, error } = await supabase.functions.invoke("google-calendar", {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function syncEspecialToGoogle(especial, emailsList) {
  const data = await callFunction({
    action: "upsert",
    especial,
    emails: emailsList || [],
  });
  return { eventId: data.eventId, action: data.action };
}

export async function deleteEspecialFromGoogle(especialId, googleEventId) {
  try {
    const data = await callFunction({
      action: "delete",
      especialId,
      googleEventId,
    });
    return { ok: true, deleted: !!data?.deleted };
  } catch (e) {
    return { ok: false, deleted: false, error: e.message || String(e) };
  }
}

// Compat com o código antigo que checava OAuth client-side.
// Como agora é centralizado, "conectado" significa "Edge Function configurada".
// Assumimos que sim (admin configurou).
export function isGoogleConnected() {
  return true;
}
export function getStoredGoogleEmail() {
  return null;
}
export async function ensureGoogleToken() {
  return { access_token: "centralized" };
}
export function clearGoogleToken() {
  /* no-op */
}
