import { supabase } from "../supabase";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER_DOMAIN = "@inove.local";

export function isValidEmail(value = "") {
  return EMAIL_REGEX.test(String(value).trim().toLowerCase());
}

export function isPlaceholderEmail(value = "") {
  return String(value).trim().toLowerCase().endsWith(PLACEHOLDER_DOMAIN);
}

export function getAbsoluteUrl(path = "/") {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return new URL(safePath, window.location.origin).toString();
}

export async function resolveAuthAccount(identifier) {
  const cleanIdentifier = String(identifier || "").trim();
  if (!cleanIdentifier) return null;

  const { data, error } = await supabase.rpc("resolve_auth_account", {
    p_identifier: cleanIdentifier,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return row || null;
}

export function getRpcSetupMessage() {
  return "Execute a migration `supabase/migrations/20260427_auth_login_bridge.sql` no Supabase antes de usar o novo login.";
}
