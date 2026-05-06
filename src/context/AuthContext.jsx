import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabase";
import {
  clearStoredUser,
  getStoredUser,
  isSessionValid,
  setStoredUser,
  touchActivity,
} from "../utils/auth";
import { hydrateAuthenticatedUser } from "../utils/authBridge";
import { PRESENCE_SYNC_INTERVAL_MS } from "../utils/presence";

export const AuthContext = createContext(null);

function normalizeStoredAppUser(userData) {
  if (!userData) return null;

  return {
    ...userData,
    auth_source: userData.auth_source || (userData.auth_user_id ? "supabase" : "legacy"),
    id: userData.id ?? userData.usuario_id ?? userData.auth_user_id ?? null,
    usuario_id: userData.usuario_id ?? userData.id ?? null,
    auth_user_id: userData.auth_user_id ?? null,
    nome: userData.nome || "Usuario",
    login: userData.login || userData.email || "",
    email: userData.email || "",
    nivel: userData.nivel || "Pendente",
    setor: userData.setor || "",
    ativo: userData.ativo !== false,
    status_cadastro: userData.status_cadastro || (userData.nivel === "Pendente" ? "Pendente" : "Aprovado"),
    estrutura_fisica_liberada: userData.estrutura_fisica_liberada === true,
    requires_profile_review: !!userData.requires_profile_review,
    profile_review_reasons: Array.isArray(userData.profile_review_reasons) ? userData.profile_review_reasons : [],
  };
}

function shouldKeepLegacySession(userData) {
  return !!userData && userData.auth_source === "legacy" && isSessionValid();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (!isSessionValid()) {
      clearStoredUser();
      return null;
    }

    return getStoredUser();
  });
  const [loading, setLoading] = useState(true);
  const lastPresenceSyncRef = useRef(0);

  const persistUser = useCallback((userData) => {
    const normalized = normalizeStoredAppUser(userData);

    if (!normalized) {
      clearStoredUser();
      setUser(null);
      return null;
    }

    const stored = setStoredUser(normalized);
    setUser(stored);
    return stored;
  }, []);

  const syncFromSession = useCallback(
    async (sessionUser) => {
      if (!sessionUser) {
        const storedUser = getStoredUser();
        if (shouldKeepLegacySession(storedUser)) {
          setUser(storedUser);
          return storedUser;
        }

        clearStoredUser();
        setUser(null);
        return null;
      }

      const hydrated = await hydrateAuthenticatedUser(sessionUser);
      return persistUser(hydrated);
    },
    [persistUser]
  );

  const login = useCallback(
    (userData) => {
      return persistUser(userData);
    },
    [persistUser]
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearStoredUser();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      const storedUser = getStoredUser();
      if (shouldKeepLegacySession(storedUser)) {
        setUser(storedUser);
        return storedUser;
      }

      clearStoredUser();
      setUser(null);
      return null;
    }

    return syncFromSession(session.user);
  }, [syncFromSession]);

  const syncPresence = useCallback(
    async ({ force = false } = {}) => {
      const usuarioId = user?.usuario_id ?? user?.id ?? null;

      if (!usuarioId || typeof usuarioId !== "number") return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;

      const now = Date.now();
      if (!force && now - lastPresenceSyncRef.current < PRESENCE_SYNC_INTERVAL_MS) {
        return;
      }

      lastPresenceSyncRef.current = now;

      const { error } = await supabase
        .from("usuarios_aprovadores")
        .update({ ultimo_ping_em: new Date(now).toISOString() })
        .eq("id", usuarioId);

      if (error) {
        lastPresenceSyncRef.current = 0;
        console.error("Falha ao atualizar presenca do usuario:", error);
      }
    },
    [user?.id, user?.usuario_id]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        if (!session?.user) {
          const storedUser = getStoredUser();
          if (shouldKeepLegacySession(storedUser)) {
            setUser(storedUser);
            return;
          }
        }

        await syncFromSession(session?.user || null);
      } catch (error) {
        console.error("Falha ao preparar sessao do Auth:", error);
        if (mounted) {
          clearStoredUser();
          setUser(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      setLoading(true);
      syncFromSession(session?.user || null)
        .catch((error) => {
          console.error("Falha ao sincronizar sessao do Auth:", error);
          const storedUser = getStoredUser();
          if (shouldKeepLegacySession(storedUser)) {
            setUser(storedUser);
            return;
          }

          clearStoredUser();
          setUser(null);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncFromSession]);

  useEffect(() => {
    if (!user) return;

    void syncPresence({ force: true });
  }, [user, syncPresence]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key === "user") setUser(getStoredUser());
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "visibilitychange"];

    const onActivity = () => {
      if (document.visibilityState === "visible") {
        touchActivity();
        setUser(getStoredUser());
        void syncPresence();
      }
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, onActivity));

    const timer = window.setInterval(() => {
      if (window.location.pathname === "/sos-dashboard") {
        touchActivity();
        void syncPresence();
        return;
      }

      if (!isSessionValid()) {
        void logout();
        return;
      }

      if (document.visibilityState === "visible") {
        void syncPresence();
      }
    }, 30 * 1000);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.clearInterval(timer);
    };
  }, [logout, syncPresence]);

  const value = useMemo(
    () => ({
      user,
      session: user ? { user } : null,
      loading,
      login,
      logout,
      refreshUser,
      isAuthenticated: !!user,
    }),
    [user, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
