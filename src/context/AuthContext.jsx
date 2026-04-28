import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  clearStoredUser,
  getStoredUser,
  isSessionValid,
  setStoredUser,
  touchActivity,
} from "../utils/auth";
import { hydrateAuthenticatedUser } from "../utils/authBridge";

export const AuthContext = createContext(null);

function normalizeStoredAppUser(userData) {
  if (!userData) return null;

  return {
    ...userData,
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
    requires_profile_review: !!userData.requires_profile_review,
    profile_review_reasons: Array.isArray(userData.profile_review_reasons) ? userData.profile_review_reasons : [],
  };
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
      clearStoredUser();
      setUser(null);
      return null;
    }

    return syncFromSession(session.user);
  }, [syncFromSession]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
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
      }
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, onActivity));

    const timer = window.setInterval(() => {
      if (window.location.pathname === "/sos-dashboard") {
        touchActivity();
        return;
      }

      if (!isSessionValid()) {
        void logout();
      }
    }, 30 * 1000);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.clearInterval(timer);
    };
  }, [logout]);

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
