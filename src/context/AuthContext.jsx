import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredUser,
  getStoredUser,
  isSessionValid,
  setStoredUser,
  touchActivity,
} from "../utils/auth";

export const AuthContext = createContext(null);

function normalizeLegacyUser(userData) {
  if (!userData) return null;

  return {
    ...userData,
    id: userData.id ?? userData.usuario_id ?? null,
    usuario_id: userData.usuario_id ?? userData.id ?? null,
    nome: userData.nome || "Usuario",
    login: userData.login || userData.email || "",
    email: userData.email || "",
    nivel: userData.nivel || "Pendente",
    setor: userData.setor || "",
    ativo: userData.ativo !== false,
    status_cadastro: userData.status_cadastro || (userData.nivel === "Pendente" ? "Pendente" : "Aprovado"),
    requires_profile_review: false,
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
  const [loading] = useState(false);

  const login = useCallback((userData) => {
    const normalized = normalizeLegacyUser(userData);
    const stored = setStoredUser(normalized);
    setUser(stored);
    return stored;
  }, []);

  const logout = useCallback(() => {
    clearStoredUser();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const stored = getStoredUser();
    setUser(stored);
    return stored;
  }, []);

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

      if (!isSessionValid()) logout();
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
