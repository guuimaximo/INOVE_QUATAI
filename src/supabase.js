import { Capacitor } from "@capacitor/core";
import { createClient } from "@supabase/supabase-js";

const PUBLIC_SUPABASE_URL = "https://wboelthngddvkgrvwkbu.supabase.co";
const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indib2VsdGhuZ2RkdmtncnZ3a2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODQxMzcsImV4cCI6MjA3NjU2MDEzN30.A3ylU8Tkx20VOD3EjOr3K7ir0J_jZrCfBNlzAOtODXg";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL).trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || PUBLIC_SUPABASE_ANON_KEY).trim();

const disableRefresh = String(import.meta.env.VITE_SUPABASE_DISABLE_REFRESH || "false").toLowerCase() === "true";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Usando fallback publico do Supabase no bundle mobile.", {
    hasEnvUrl: Boolean(import.meta.env.VITE_SUPABASE_URL),
    hasEnvAnon: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ENV do Supabase ausente no front:", {
    hasUrl: Boolean(supabaseUrl),
    hasAnon: Boolean(supabaseAnonKey),
  });
  throw new Error("ENV do Supabase ausente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)");
}

// Retry automático em 401 por token vencido. Depois de um tempo idle, o access
// token pode expirar antes de renovar; a 1a consulta volta 401 e as tabelas
// "falham do nada". Aqui, se QUALQUER requisição volta 401, a gente renova a
// sessão e REFAZ a requisição UMA vez com o token novo — sem o usuário perceber
// e sem precisar deslogar/logar. No caminho normal (2xx) o comportamento é
// idêntico ao fetch padrão. Não age em chamadas /auth (elas cuidam do próprio
// token) e o retry usa o fetch nativo, então não há loop.
let clienteRef = null;
async function fetchComRetry(input, init) {
  const res = await fetch(input, init);
  if (res.status !== 401 || !clienteRef) return res;

  const url = typeof input === "string" ? input : (input && input.url) || "";
  if (url.includes("/auth/v1/")) return res;

  try {
    const { data, error } = await clienteRef.auth.refreshSession();
    const token = data && data.session && data.session.access_token;
    if (error || !token) return res;
    const headers = new Headers(init && init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return await fetch(input, { ...init, headers });
  } catch {
    return res;
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "sb-inove-auth",
    persistSession: true,
    autoRefreshToken: !disableRefresh,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    flowType: "pkce",
  },
  global: { fetch: fetchComRetry },
});

clienteRef = supabase;
