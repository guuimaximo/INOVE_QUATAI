// Cliente Supabase do projeto IMPORTACAO_DADOS (ubpp) — onde vive a tabela
// ultimo_plano (snapshot de planos vindo do Athena/Transnet).
// Somente leitura via anon key (RLS libera SELECT). Nao gravar por aqui.
import { createClient } from "@supabase/supabase-js";

const PUBLIC_URL = "https://ubppprgquekozluvsloo.supabase.co";
const PUBLIC_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicHBwcmdxdWVrb3psdXZzbG9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1Mjg4NzgsImV4cCI6MjA5OTEwNDg3OH0.I3ALupQbwEPWwcqcpX07tM8X_LXosqvbwPjI-5rVyBY";

const url = (import.meta.env.VITE_SUPABASE_DADOS_URL || PUBLIC_URL).trim();
const anon = (import.meta.env.VITE_SUPABASE_DADOS_ANON_KEY || PUBLIC_ANON).trim();

export const supabaseDados = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Puxa todas as linhas ativas de ultimo_plano (paginado).
export async function puxarUltimoPlano() {
  const cols =
    "nr_ordem,id_plano,ds_plano,qt_km_intervalo,qt_dia_intervalo,km_rodado," +
    "km_para_proxima,dias_vencido,nr_hodometro,dt_fechamento_os,dt_abertura_os,data_abastecimento";
  const step = 1000;
  let off = 0;
  const todas = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabaseDados
      .from("ultimo_plano")
      .select(cols)
      .eq("cs_ativo", "S")
      .range(off, off + step - 1);
    if (error) throw error;
    todas.push(...(data || []));
    if (!data || data.length < step) break;
    off += step;
  }
  return todas;
}
