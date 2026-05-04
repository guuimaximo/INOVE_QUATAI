// src/supabaseBCNT.js
import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPA_BASE_BCNT_URL || "").trim();
const anon = (import.meta.env.VITE_SUPA_BASE_BCNT_ANON_KEY || "").trim();

export const isSupabaseBCNTConfigured = Boolean(url && anon);

function makeUnconfiguredClient() {
  const message =
    "Supabase BCNT nao esta configurado. Defina VITE_SUPA_BASE_BCNT_URL e VITE_SUPA_BASE_BCNT_ANON_KEY no ambiente.";
  const handler = {
    get() {
      return new Proxy(function noop() {}, handler);
    },
    apply() {
      throw new Error(message);
    },
  };
  return new Proxy(function noop() {}, handler);
}

export const supabaseBCNT = isSupabaseBCNTConfigured
  ? createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : makeUnconfiguredClient();
