import { useContext, useEffect, useState } from "react";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";

// Quem deve ver os alertas de Acidentes "Aguardando imagens":
// 1) Qualquer usuario com nivel "Ouvidoria"
// 2) A gestora Flavia (id=47, login=30061127)
// 3) Guilherme (id=5, login=Guilherme)
function isEligibleUser(user) {
  if (!user) return false;
  const nivel = String(user.nivel || "").trim().toLowerCase();
  if (nivel === "ouvidoria") return true;
  const id = Number(user.usuario_id || user.id || 0);
  if (id === 47) return true; // Flavia
  if (id === 5) return true; // Guilherme
  const login = String(user.login || "").trim().toLowerCase();
  if (login === "30061127") return true;
  if (login === "guilherme") return true;
  return false;
}

export function useAcidentesPendentes({ pollMs = 60000 } = {}) {
  const { user } = useContext(AuthContext) || {};
  const elegivel = isEligibleUser(user);
  const [pendentes, setPendentes] = useState({ count: 0, rows: [] });
  const [loading, setLoading] = useState(false);

  async function carregar() {
    if (!elegivel) return;
    try {
      setLoading(true);
      const { data, error, count } = await supabase
        .from("acidentes_ocorrencias")
        .select("id, numero_ocorrencia, prefixo, linha, data_ocorrencia, hora_ocorrencia, motorista_nome, status", { count: "exact" })
        .eq("status", "Aguardando imagens")
        .order("data_ocorrencia", { ascending: false })
        .limit(50);
      if (error) throw error;
      setPendentes({ count: count ?? (data || []).length, rows: data || [] });
    } catch (err) {
      console.warn("Falha ao carregar acidentes pendentes:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!elegivel) {
      setPendentes({ count: 0, rows: [] });
      return undefined;
    }
    carregar();
    const interval = setInterval(carregar, pollMs);

    // Realtime: qualquer mudanca em acidentes_ocorrencias dispara recarga.
    // Nome unico por mount evita o erro "cannot add postgres_changes
    // callbacks after subscribe()" quando o componente remonta (StrictMode/
    // HMR) e o canal anterior ainda estava registrado.
    const channelName = `acidentes-pendentes-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "acidentes_ocorrencias" },
        () => carregar()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignora */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegivel]);

  return { elegivel, loading, ...pendentes, refresh: carregar };
}

export default useAcidentesPendentes;
