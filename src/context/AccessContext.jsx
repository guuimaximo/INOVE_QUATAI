import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import { buildAccessProfileMap, getDefaultLevelProfiles } from "../utils/access";

const AccessContext = createContext(null);

export function AccessProvider({ children }) {
  const [profiles, setProfiles] = useState(getDefaultLevelProfiles());
  const [loading, setLoading] = useState(true);

  const refreshProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_niveis_acesso")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      setProfiles(data?.length ? data : getDefaultLevelProfiles());
    } catch (error) {
      console.error("Falha ao carregar governanca de acessos:", error);
      setProfiles(getDefaultLevelProfiles());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const value = useMemo(() => {
    const profileMap = buildAccessProfileMap(profiles);
    return {
      profiles,
      profileMap,
      loading,
      refreshProfiles,
    };
  }, [profiles, loading, refreshProfiles]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccessGovernance() {
  const context = useContext(AccessContext);
  if (!context) {
    throw new Error("useAccessGovernance deve ser usado dentro de AccessProvider.");
  }
  return context;
}
