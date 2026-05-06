// src/supabaseBCNT.js
import { createClient } from "@supabase/supabase-js";

const PUBLIC_SUPABASE_URL = "https://wboelthngddvkgrvwkbu.supabase.co";
const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmciOiJIndib2VsdGhuZ2RkdmtncnZ3a2J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODQxMzcsImV4cCI6MjA3NjU2MDEzN30.A3ylU8Tkx20VOD3EjOr3K7ir0J_jZrCfBNlzAOtODXg";

const url = (import.meta.env.VITE_SUPA_BASE_BCNT_URL || "").trim();
const anon = (import.meta.env.VITE_SUPA_BASE_BCNT_ANON_KEY || "").trim();

export const isSupabaseBCNTConfigured = Boolean(url && anon);

if (!isSupabaseBCNTConfigured) {
  console.warn("Supabase BCNT não configurado no bundle. Usando cliente fallback para não derrubar o app.");
}

export const supabaseBCNT = createClient(
  isSupabaseBCNTConfigured ? url : PUBLIC_SUPABASE_URL,
  isSupabaseBCNTConfigured ? anon : PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);
