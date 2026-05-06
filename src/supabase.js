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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: "sb-inove-auth",
    persistSession: true,
    autoRefreshToken: !disableRefresh,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
    flowType: "pkce",
  },
});
