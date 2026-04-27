import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase";
import {
  clearStoredUser,
  getStoredUser,
  isSessionValid,
  setStoredUser,
  touchActivity,
} from "../utils/auth";

export const AuthContext = createContext();

function normalizeText(value) {
  return String(value || "").trim();
}

function sameText(a, b) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function getProfileReviewStatus(profile, legacyUser) {
  if (!legacyUser) {
    return {
      requiresProfileReview: !profile?.nome || !profile?.login || !profile?.setor,
      profileReviewReasons: [],
    };
  }

  const reasons = [];

  if (!normalizeText(profile?.nome)) reasons.push("nome");
  if (!normalizeText(profile?.login)) reasons.push("login");
  if (!normalizeText(profile?.setor)) reasons.push("setor");

  if (normalizeText(legacyUser.nome) && !sameText(profile?.nome, legacyUser.nome)) reasons.push("nome_desatualizado");
  if (normalizeText(legacyUser.login) && !sameText(profile?.login, legacyUser.login)) reasons.push("login_desatualizado");
  if (normalizeText(legacyUser.setor) && !sameText(profile?.setor, legacyUser.setor)) reasons.push("setor_desatualizado");

  return {
    requiresProfileReview: reasons.length > 0,
    profileReviewReasons: reasons,
  };
}

async function loadProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, usuario_id, nome, nivel, setor, ativo, login, criado_em")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("Falha ao carregar profiles:", error.message);
    return null;
  }

  return data || null;
}

async function loadLegacyUser(authUserId, email) {
  if (authUserId) {
    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("id, nome, login, email, nivel, setor, ativo, status_cadastro, auth_user_id, migrado_auth")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (!error && data) return data;
  }

  if (email) {
    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("id, nome, login, email, nivel, setor, ativo, status_cadastro, auth_user_id, migrado_auth")
      .eq("email", email)
      .maybeSingle();

    if (!error && data) return data;
  }

  return null;
}

function buildNormalizedUser(session, profile, legacyUser) {
  const authUser = session?.user;
  const meta = authUser?.user_metadata || {};

  const usuarioId = profile?.usuario_id ?? legacyUser?.id ?? meta.usuario_id ?? null;
  const nivel = profile?.nivel ?? meta.nivel ?? legacyUser?.nivel ?? "Pendente";
  const nome = profile?.nome ?? meta.nome ?? legacyUser?.nome ?? authUser?.email ?? "Usuario";
  const login = profile?.login ?? meta.login ?? legacyUser?.login ?? authUser?.email ?? null;
  const profileReview = getProfileReviewStatus(profile, legacyUser);

  return {
    id: usuarioId ?? authUser?.id ?? null,
    usuario_id: usuarioId,
    auth_user_id: authUser?.id ?? legacyUser?.auth_user_id ?? null,
    nome,
    login,
    email: authUser?.email ?? legacyUser?.email ?? null,
    nivel,
    setor: profile?.setor ?? legacyUser?.setor ?? "",
    ativo: profile?.ativo ?? legacyUser?.ativo ?? true,
    status_cadastro:
      legacyUser?.status_cadastro ?? (nivel === "Pendente" ? "Pendente" : "Aprovado"),
    migrado_auth: legacyUser?.migrado_auth ?? true,
    created_at: authUser?.created_at ?? null,
    requires_profile_review: profileReview.requiresProfileReview,
    profile_review_reasons: profileReview.profileReviewReasons,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback((userData) => {
    const stored = setStoredUser(userData);
    setUser(stored);
    return stored;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    clearStoredUser();
    setSession(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (nextSession = null) => {
    const activeSession =
      nextSession ??
      (await supabase.auth.getSession()).data.session ??
      null;

    setSession(activeSession);

    if (!activeSession?.user) {
      clearStoredUser();
      setUser(null);
      return null;
    }

    const [profile, legacyUser] = await Promise.all([
      loadProfile(activeSession.user.id),
      loadLegacyUser(activeSession.user.id, activeSession.user.email),
    ]);

    const normalized = buildNormalizedUser(activeSession, profile, legacyUser);
    const stored = setStoredUser(normalized);
    setUser(stored);
    return stored;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setLoading(true);
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        await refreshUser(initialSession || null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(async () => {
        if (!mounted) return;
        await refreshUser(nextSession || null);
        setLoading(false);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshUser]);

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
      session,
      loading,
      login,
      logout,
      refreshUser,
      isAuthenticated: !!session?.user,
    }),
    [user, session, loading, login, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
