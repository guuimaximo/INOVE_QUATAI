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

  const paginasLiberadas = Array.isArray(userData.paginas_liberadas) ? userData.paginas_liberadas : [];
  const paginasBloqueadas = Array.isArray(userData.paginas_bloqueadas) ? userData.paginas_bloqueadas : [];
  const appRecursos = Array.isArray(userData.app_recursos) ? userData.app_recursos : [];

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
    paginas_liberadas: paginasLiberadas,
    paginas_bloqueadas: paginasBloqueadas,
    app_recursos: appRecursos,
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
  const lastAccessSyncRef = useRef(0);
  // Espelho do usuario atual para comparar identidade sem recriar os handlers.
  const userRef = useRef(user);
  userRef.current = user;

  // Estado de gravação do Farol (iframe), COMPARTILHADO entre as guardas de
  // sessão. Enquanto grava, NUNCA deslogar — o logout desmonta o Layout/iframe
  // e mataria a gravação. O Farol manda postMessage { type:"farol:recording" }.
  const RECORDING_HEARTBEAT_MS = 3 * 60 * 60 * 1000; // 3h
  const recordingRef = useRef({ active: false, lastPing: 0 });
  const verificandoSessaoRef = useRef(false);
  // Última interação do usuário. A guarda de sessão NUNCA força relogin enquanto
  // o usuário está trabalhando (evita cair no meio de uma foto/ficha de troca ou
  // auditoria — a câmera dispara visibilitychange e não pode derrubar o trabalho).
  const ultimaAtividadeRef = useRef(Date.now());
  const IDLE_PARA_RELOGIN_MS = 90 * 1000; // 90s sem atividade
  const gravandoNoFarol = useCallback(() => {
    const r = recordingRef.current;
    if (!r.active) return false;
    if (Date.now() - r.lastPing > RECORDING_HEARTBEAT_MS) { r.active = false; return false; }
    return true;
  }, [RECORDING_HEARTBEAT_MS]);

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
        // Mantém o usuário logado enquanto estiver dentro da janela de idle (4h).
        // Uma piscada no token (refresh que falhou por um instante, app voltando
        // do segundo plano) NAO deve derrubar quem está ativo — só o idle de 4h
        // (ou o logout explícito) encerra a sessão. O autoRefresh recupera o
        // token em segundo plano quando a rede volta.
        if (storedUser && isSessionValid()) {
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

  // Guarda de sessão do Supabase: se o UI está "logado" mas a sessão do Supabase
  // MORREU (ex.: incidente/refresh falho), as consultas saem como anon e as
  // tabelas trancadas dão "permission denied for table ..." (ora numa, ora
  // noutra). Tenta restaurar; se não existe e não renova, força o relogin —
  // MAS nunca durante uma gravação no Farol (deslogar mataria o iframe/gravação).
  const garantirSessaoSupabase = useCallback(async () => {
    if (verificandoSessaoRef.current) return;
    const stored = getStoredUser();
    if (!stored || !isSessionValid()) return; // sem login / sessão de UI expirada (o timer trata)
    verificandoSessaoRef.current = true;
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session) return; // sessão Supabase ok
      const { data: renovado, error } = await supabase.auth.refreshSession();
      if (renovado?.session) return; // conseguiu restaurar
      if (error && !/session|token/i.test(String(error.message || ""))) return; // erro de rede: não desloga
      if (gravandoNoFarol()) return; // gravando: NUNCA deslogar (mataria a gravação)
      // NUNCA deslogar enquanto o usuário está trabalhando (ex.: tirando foto no
      // meio de uma troca/auditoria — a câmera dispara visibilitychange). Só força
      // o relogin quando ele estiver realmente ocioso, pra não perder a ficha.
      if (Date.now() - ultimaAtividadeRef.current < IDLE_PARA_RELOGIN_MS) return;
      await logout(); // sessão morta de verdade E usuário ocioso → relogin
    } catch {
      /* silencioso: não desloga por exceção ambígua (ex.: rede) */
    } finally {
      verificandoSessaoRef.current = false;
    }
  }, [logout, gravandoNoFarol]);

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

  const syncAccessSnapshot = useCallback(
    async ({ force = false } = {}) => {
      const usuarioId = user?.usuario_id ?? user?.id ?? null;
      if (!usuarioId || typeof usuarioId !== "number") return null;

      const now = Date.now();
      if (!force && now - lastAccessSyncRef.current < 60 * 1000) {
        return null;
      }

      lastAccessSyncRef.current = now;

      const { data, error } = await supabase
        .from("usuarios_aprovadores")
        .select(
          "id, auth_user_id, nome, login, email, nivel, setor, ativo, status_cadastro, estrutura_fisica_liberada, paginas_liberadas, paginas_bloqueadas, app_recursos, migrado_auth, avatar_url"
        )
        .eq("id", usuarioId)
        .maybeSingle();

      if (error) {
        lastAccessSyncRef.current = 0;
        console.error("Falha ao sincronizar snapshot de acesso:", error);
        return null;
      }

      if (!data) return null;

      return persistUser({
        ...user,
        ...data,
        usuario_id: data.id ?? user?.usuario_id ?? user?.id ?? null,
        id: data.id ?? user?.usuario_id ?? user?.id ?? null,
      });
    },
    [persistUser, user]
  );

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
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      // Link de recuperacao de senha: leva sempre para a tela de nova senha,
      // mesmo que o e-mail tenha caido na raiz (Site URL) em vez de /atualizar-senha.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/atualizar-senha") {
        window.location.assign("/atualizar-senha");
        return;
      }

      // NAO usar setLoading(true) aqui. Eventos rotineiros (TOKEN_REFRESHED)
      // disparam quando o app volta ao primeiro plano — ex.: voltando da camera.
      // Mostrar "Carregando sessao..." remonta a rota inteira e faz o formulario
      // (e a foto recem-tirada) sumir, parecendo que o app "reiniciou". O loading
      // inicial e controlado apenas pelo bootstrap acima; aqui sincronizamos em
      // segundo plano, sem desmontar a tela.
      syncFromSession(session?.user || null).catch((error) => {
        console.error("Falha ao sincronizar sessao do Auth:", error);
        const storedUser = getStoredUser();
        // Falha de hidratação (blip de rede/DB) com o token ainda válido NAO pode
        // derrubar quem está ativo. Mantém o usuário dentro da janela de idle (4h);
        // só cai por idle ou logout explícito. Retenta em segundo plano depois.
        if (storedUser && isSessionValid()) {
          setUser(storedUser);
          return;
        }

        clearStoredUser();
        setUser(null);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncFromSession]);

  // Sincroniza presenca/snapshot de acesso UMA vez por login (quando o id do
  // usuario muda de fato). Antes isso rodava a cada novo objeto de usuario; como
  // syncAccessSnapshot chama setUser (objeto novo), o efeito re-disparava em
  // loop -> tempestade de re-render e a tela "piscando".
  const bootstrappedUserIdRef = useRef(null);
  useEffect(() => {
    const uid = user?.usuario_id ?? user?.id ?? null;

    if (!uid) {
      bootstrappedUserIdRef.current = null;
      return;
    }

    if (bootstrappedUserIdRef.current === uid) return;
    bootstrappedUserIdRef.current = uid;

    void syncPresence({ force: true });
    void syncAccessSnapshot({ force: true });
  }, [user, syncAccessSnapshot, syncPresence]);

  useEffect(() => {
    function onStorage(event) {
      if (event.key !== "user") return;
      // So troca quando a IDENTIDADE muda (outra aba logou com outra conta),
      // evitando reescrever o usuario a toa e contribuir para o "piscar".
      const stored = getStoredUser();
      const currentId = userRef.current?.usuario_id ?? userRef.current?.id ?? null;
      const storedId = stored?.usuario_id ?? stored?.id ?? null;
      if (storedId !== currentId) setUser(stored);
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const activityEvents = ["mousemove", "keydown", "click", "scroll", "visibilitychange"];

    // Gravação ativa no Farol (iframe) suspende o logout por inatividade E a
    // guarda de sessão (ver gravandoNoFarol/recordingRef no topo do componente).
    // O Farol envia postMessage { type: "farol:recording", active: bool } ao
    // iniciar/parar; uma reunião gravada não pode derrubar a sessão no meio.
    const onMessage = (ev) => {
      const data = ev?.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "farol:recording") return;
      recordingRef.current = { active: data.active !== false, lastPing: Date.now() };
      if (recordingRef.current.active) touchActivity();
    };

    const onActivity = () => {
      ultimaAtividadeRef.current = Date.now();
      if (document.visibilityState === "visible") {
        touchActivity();
        // So troca o usuario se a IDENTIDADE mudou (ex.: outra aba logou com
        // outra conta). Sem isso, a cada evento de atividade reescreviamos o
        // objeto do usuario, causando re-render e contribuindo para o "piscar".
        const stored = getStoredUser();
        const currentId = userRef.current?.usuario_id ?? userRef.current?.id ?? null;
        const storedId = stored?.usuario_id ?? stored?.id ?? null;
        if (storedId !== currentId) setUser(stored);
        void syncPresence();
        void syncAccessSnapshot();
      }
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, onActivity));
    window.addEventListener("message", onMessage);

    const timer = window.setInterval(() => {
      if (gravandoNoFarol()) {
        touchActivity();
        void syncPresence();
        void syncAccessSnapshot();
        return;
      }

      if (window.location.pathname === "/sos-dashboard") {
        touchActivity();
        void syncPresence();
        void syncAccessSnapshot();
        return;
      }

      if (!isSessionValid()) {
        void logout();
        return;
      }

      if (document.visibilityState === "visible") {
        void garantirSessaoSupabase(); // pega sessão morta em até 30s (não só no foco)
        void syncPresence();
        void syncAccessSnapshot();
      }
    }, 30 * 1000);

    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, onActivity));
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [logout, syncAccessSnapshot, syncPresence, gravandoNoFarol, garantirSessaoSupabase]);

  // Ao voltar o foco/visibilidade: reativa o auto-refresh do token e verifica a
  // sessão (garantirSessaoSupabase renova ou força relogin se ela morreu — mas
  // nunca durante gravação no Farol). Complementa a checagem do intervalo de 30s.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        try { supabase.auth.startAutoRefresh?.(); } catch { /* noop */ }
        void garantirSessaoSupabase();
      } else {
        try { supabase.auth.stopAutoRefresh?.(); } catch { /* noop */ }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    onVis(); // ao montar
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [garantirSessaoSupabase]);

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
