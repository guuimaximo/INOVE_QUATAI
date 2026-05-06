import { Capacitor } from "@capacitor/core";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const disableRefresh = String(import.meta.env.VITE_SUPABASE_DISABLE_REFRESH || "false").toLowerCase() === "true";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Configuracao Supabase ausente. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente antes do build."
  );
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
