import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import logoInova from "../../assets/logoInovaQuatai.png";
import { useAuth } from "../../context/AuthContext";
import {
  buildPlaceholderEmail,
  ensureLegacyAuthLink,
  getAbsoluteUrl,
  getRpcSetupMessage,
  isPendingAccessLevel,
  isPlaceholderEmail,
  isValidEmail,
  resolveAuthAccount,
} from "../../utils/authBridge";
import {
  User,
  Lock,
  LogIn,
  Mail,
  Check,
  X,
  Loader2,
  ChevronDown,
  Briefcase,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";

const NIVEIS_PORTAL = new Set(["Gestor", "Administrador"]);
const SETORES = [
  "Manutencao",
  "Recursos humanos",
  "Departamento Pessoal",
  "SESMT",
  "Operacao",
  "Ouvidoria",
  "Financeiro",
];
const PASSWORD_STRENGTH_REGEX = {
  hasUpper: /[A-Z]/,
  hasNumber: /\d/,
  hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/,
};
const FAROL_ORIGIN = "https://faroldemetas.onrender.com";
const AUTH_PLACEHOLDER_PASSWORD = "__AUTH_MANAGED__";

function getFriendlyError(error) {
  const message = String(error?.message || "");
  return message || "Nao foi possivel concluir a operacao.";
}

function getSafeFarolRedirect(rawUrl) {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    return parsed.origin === FAROL_ORIGIN ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeAccessValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isPendingStatus(status) {
  return normalizeAccessValue(status) === "pendente";
}

function hasApprovalBlock(record) {
  return !record?.ativo || isPendingAccessLevel(record?.nivel) || isPendingStatus(record?.status_cadastro);
}

function getApprovalMessage(record) {
  if (!record?.ativo) return "Sua conta esta inativa no momento.";
  if (isPendingAccessLevel(record?.nivel) || isPendingStatus(record?.status_cadastro)) {
    return "Seu cadastro ainda esta em analise pelo administrador.";
  }
  return "Nao foi possivel liberar seu acesso.";
}

function getBootstrapEmail(legacyUser) {
  if (isValidEmail(legacyUser?.email)) {
    return String(legacyUser.email).trim().toLowerCase();
  }

  return buildPlaceholderEmail(legacyUser?.login || legacyUser?.nome || "usuario", legacyUser?.id || "");
}

function getSignInEmail(identifier, bridge) {
  if (bridge?.auth_email) return String(bridge.auth_email).trim().toLowerCase();
  if (isValidEmail(identifier)) return String(identifier).trim().toLowerCase();
  if (isValidEmail(bridge?.legacy_email)) return String(bridge.legacy_email).trim().toLowerCase();
  return null;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser, logout } = useAuth();

  const [isCadastro, setIsCadastro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [loginInput, setLoginInput] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");

  const [passwordMetrics, setPasswordMetrics] = useState({
    score: 0,
    hasUpper: false,
    hasNumber: false,
    hasSpecial: false,
    minChar: false,
  });

  const redirectParam = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("redirect");
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [location.search]);

  const nextPathState = location.state?.from?.pathname || null;

  function decideDefaultNext() {
    return "/inove";
  }

  function resetForm(clearFeedback = true) {
    setNome("");
    setLoginInput("");
    setSenha("");
    setEmail("");
    setSetor("");
    setPasswordMetrics({
      score: 0,
      hasUpper: false,
      hasNumber: false,
      hasSpecial: false,
      minChar: false,
    });
    if (clearFeedback) setFeedback(null);
  }

  function pushFeedback(type, text) {
    setFeedback({ type, text });
  }

  useEffect(() => {
    const storedLogin = localStorage.getItem("inove_login");
    if (storedLogin && !loginInput) setLoginInput(storedLogin);
  }, [loginInput]);

  useEffect(() => {
    if (!isCadastro) return;

    const value = senha;
    const metrics = {
      hasUpper: PASSWORD_STRENGTH_REGEX.hasUpper.test(value),
      hasNumber: PASSWORD_STRENGTH_REGEX.hasNumber.test(value),
      hasSpecial: PASSWORD_STRENGTH_REGEX.hasSpecial.test(value),
      minChar: value.length >= 8,
    };

    setPasswordMetrics({
      ...metrics,
      score: Object.values(metrics).filter(Boolean).length,
    });
  }, [senha, isCadastro]);

  function rememberUserHints(identifier, userData) {
    try {
      localStorage.setItem("inove_login", userData?.login || identifier || loginInput.trim());
      localStorage.setItem("inove_nivel", String(userData?.nivel || ""));
      localStorage.setItem("inove_nome", userData?.nome || "");
    } catch {
      // Mantem o login funcional mesmo se o navegador bloquear storage.
    }
  }

  async function fetchLegacyCredentialMatch(identifier, currentPassword) {
    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("*")
      .or(`login.eq.${identifier},email.eq.${identifier}`)
      .eq("senha", currentPassword)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function finalizeAuthenticatedLogin(identifier) {
    const loggedUser = await refreshUser();

    if (!loggedUser) {
      pushFeedback("error", "Nao foi possivel carregar seu perfil apos a autenticacao.");
      return false;
    }

    if (hasApprovalBlock(loggedUser)) {
      await logout();
      pushFeedback("error", getApprovalMessage(loggedUser));
      return false;
    }

    rememberUserHints(identifier, loggedUser);

    const safeFarolRedirect = getSafeFarolRedirect(redirectParam);
    if (safeFarolRedirect && NIVEIS_PORTAL.has(String(loggedUser?.nivel || "").trim())) {
      window.location.href = safeFarolRedirect;
      return true;
    }

    navigate(loggedUser.requires_profile_review ? "/atualizar-perfil" : nextPathState || decideDefaultNext(), {
      replace: true,
    });
    return true;
  }

  async function bootstrapLegacyAuth(legacyUser, currentPassword) {
    const bootstrapEmail = getBootstrapEmail(legacyUser);
    const redirectTo = getAbsoluteUrl("/login");
    let authSessionOpened = false;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: bootstrapEmail,
      password: currentPassword,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          login: legacyUser.login || "",
          nome: legacyUser.nome || "",
          setor: legacyUser.setor || "",
          usuario_id: String(legacyUser.id || ""),
          origem: "legacy-bridge",
        },
      },
    });

    if (
      signUpError &&
      !/already registered|already been registered|user already registered/i.test(String(signUpError.message || ""))
    ) {
      throw signUpError;
    }

    if (signUpData?.session?.user) {
      authSessionOpened = true;
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: bootstrapEmail,
        password: currentPassword,
      });

      if (!signInError) {
        authSessionOpened = true;
      } else if (/email not confirmed/i.test(String(signInError.message || ""))) {
        pushFeedback(
          "error",
          "Sua conta Auth foi criada, mas o e-mail ainda nao foi confirmado. Confirme o e-mail antes de continuar."
        );
        return false;
      }
    }

    if (!authSessionOpened) {
      if (!isValidEmail(legacyUser?.email) || isPlaceholderEmail(bootstrapEmail)) {
        pushFeedback(
          "error",
          "Seu primeiro acesso precisa de um e-mail valido para concluir a migracao. Vamos tratar isso na etapa de atualizacao cadastral."
        );
      } else {
        pushFeedback(
          "error",
          "A conta foi preparada no Auth, mas a sessao nao abriu automaticamente. Tente novamente em instantes."
        );
      }
      return false;
    }

    try {
      await ensureLegacyAuthLink(isValidEmail(legacyUser?.email) ? legacyUser.email : null);
    } catch (error) {
      console.warn("Falha ao vincular conta legada ao Auth:", error);
    }

    return true;
  }

  async function handleEntrar(event) {
    event.preventDefault();
    setFeedback(null);

    const identifier = loginInput.trim();
    const currentPassword = senha;

    if (!identifier || !currentPassword) {
      pushFeedback("error", "Informe seu apelido/e-mail e senha.");
      return;
    }

    setLoading(true);

    try {
      let bridge = null;

      try {
        bridge = await resolveAuthAccount(identifier);
      } catch (error) {
        console.error("Falha ao resolver conta no bridge:", error);
        pushFeedback("error", getRpcSetupMessage());
        return;
      }

      if (bridge && hasApprovalBlock(bridge)) {
        pushFeedback("error", getApprovalMessage(bridge));
        return;
      }

      let authSignInError = null;
      const signInEmail = getSignInEmail(identifier, bridge);

      if (signInEmail) {
        const { error } = await supabase.auth.signInWithPassword({
          email: signInEmail,
          password: currentPassword,
        });

        if (!error) {
          try {
            await ensureLegacyAuthLink(bridge?.legacy_email || signInEmail);
          } catch (linkError) {
            console.warn("Falha ao sincronizar vinculo auth/legado:", linkError);
          }

          await finalizeAuthenticatedLogin(identifier);
          return;
        }

        authSignInError = error;
      }

      const legacyUser = await fetchLegacyCredentialMatch(identifier, currentPassword);

      if (!legacyUser) {
        if (authSignInError && /email not confirmed/i.test(String(authSignInError.message || ""))) {
          pushFeedback("error", "Seu e-mail do Auth ainda nao foi confirmado. Verifique sua caixa de entrada.");
          return;
        }

        pushFeedback("error", "Credenciais incorretas ou conta nao localizada.");
        return;
      }

      if (hasApprovalBlock(legacyUser)) {
        pushFeedback("error", getApprovalMessage(legacyUser));
        return;
      }

      const bootstrapped = await bootstrapLegacyAuth(legacyUser, currentPassword);
      if (!bootstrapped) return;

      await finalizeAuthenticatedLogin(identifier);
    } catch (error) {
      console.error("Falha no login:", error);
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSolicitarReset(event) {
    event.preventDefault();
    setFeedback(null);

    const identifier = loginInput.trim();

    if (!identifier) {
      pushFeedback("error", "Informe primeiro seu apelido ou e-mail para recuperar a senha.");
      return;
    }

    setLoading(true);

    try {
      let targetEmail = isValidEmail(identifier) ? identifier.trim().toLowerCase() : "";

      if (!targetEmail) {
        const bridge = await resolveAuthAccount(identifier);
        targetEmail = bridge?.auth_email || bridge?.legacy_email || "";
      }

      if (!isValidEmail(targetEmail) || isPlaceholderEmail(targetEmail)) {
        pushFeedback(
          "error",
          "Ainda nao existe um e-mail valido vinculado a esse usuario. Primeiro vamos corrigir o cadastro."
        );
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: getAbsoluteUrl("/atualizar-senha"),
      });

      if (error) {
        pushFeedback("error", error.message || "Nao foi possivel enviar o e-mail de redefinicao.");
        return;
      }

      pushFeedback("success", "Enviamos o link de redefinicao para o seu e-mail.");
      setShowReset(false);
    } catch (error) {
      console.error("Falha ao solicitar reset:", error);
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastro(event) {
    event.preventDefault();
    setFeedback(null);

    const nomeTrim = nome.trim();
    const loginTrim = loginInput.trim();
    const senhaCadastro = senha;
    const emailTrim = email.trim().toLowerCase();

    if (!nomeTrim || !loginTrim || !senhaCadastro || !setor || !emailTrim) {
      pushFeedback("error", "Preencha todos os campos obrigatorios.");
      return;
    }

    if (!isValidEmail(emailTrim)) {
      pushFeedback("error", "Insira um e-mail valido.");
      return;
    }

    if (passwordMetrics.score < 3) {
      pushFeedback("error", "Senha muito fraca.");
      return;
    }

    setLoading(true);

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from("usuarios_aprovadores")
        .select("id")
        .or(`login.eq.${loginTrim},email.eq.${emailTrim}`)
        .maybeSingle();

      if (checkError) {
        pushFeedback("error", "Erro ao verificar dados de cadastro.");
        return;
      }

      if (existingUser) {
        pushFeedback("error", "Este usuario ou e-mail ja estao cadastrados.");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailTrim,
        password: senhaCadastro,
        options: {
          emailRedirectTo: getAbsoluteUrl("/login"),
          data: {
            login: loginTrim,
            nome: nomeTrim,
            setor,
            origem: "self-signup",
          },
        },
      });

      if (authError) {
        pushFeedback("error", authError.message || "Nao foi possivel criar sua conta no Auth.");
        return;
      }

      const authUserId = authData?.user?.id || null;

      const { error: insertError } = await supabase.from("usuarios_aprovadores").insert([
        {
          nome: nomeTrim,
          login: loginTrim,
          email: emailTrim,
          senha: AUTH_PLACEHOLDER_PASSWORD,
          setor,
          ativo: false,
          nivel: "Pendente",
          status_cadastro: "Pendente",
          criado_em: new Date().toISOString(),
          auth_user_id: authUserId,
          migrado_auth: !!authUserId,
        },
      ]);

      if (insertError) {
        pushFeedback(
          "error",
          insertError.message || "A conta Auth foi criada, mas falhou o espelho na base legada. Verifique o banco."
        );
        return;
      }

      if (authData?.session?.user) {
        try {
          await ensureLegacyAuthLink(emailTrim);
        } catch (error) {
          console.warn("Falha ao vincular novo cadastro ao legado:", error);
        }

        await supabase.auth.signOut();
      }

      pushFeedback(
        "success",
        "Cadastro recebido com sucesso. Sua conta foi criada no Auth e agora aguarda aprovacao do administrador."
      );
      setIsCadastro(false);
      resetForm(false);
    } catch (error) {
      console.error("Falha no cadastro:", error);
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  const PasswordCheck = ({ label, met }) => (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600 font-medium" : "text-slate-400"}`}>
      {met ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      <div className="hidden lg:flex lg:w-5/12 bg-blue-900 relative overflow-hidden flex-col items-center justify-center text-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 to-blue-950 opacity-90 z-0" />
        <div className="relative z-10 flex flex-col items-center">
          <img src={logoInova} alt="Logo Portal Inove" className="w-48 mb-8 drop-shadow-xl" />
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">PORTAL INOVE</h2>
          <p className="text-blue-100 max-w-sm text-lg leading-relaxed text-justify">
            O papel da lideranca no Grupo CSC e motivar e capacitar pessoas, entendendo a individualidade de cada um,
            com disciplina e comprometimento, gerando resiliencia e coragem para influenciar, quebrar barreiras,
            melhorar processos e entregar resultados com foco na seguranca, na satisfacao do cliente e na otimizacao de
            custos.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden text-center">
            <img src={logoInova} alt="Logo InovaQuatai" className="mx-auto mb-4 w-32 h-auto" />
          </div>

          <div className="text-center lg:text-left">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {isCadastro ? "Criar nova conta" : "Acesse sua conta"}
            </h1>
            {redirectParam && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium">
                Conectando ao Farol Tatico... (faca login para continuar)
              </div>
            )}
            <p className="mt-2 text-slate-500">
              {isCadastro
                ? "Novos usuarios ja entram pelo Supabase Auth. O acesso continua sujeito a aprovacao."
                : "Entre com seu apelido ou e-mail para continuar."}
            </p>
          </div>

          {feedback && (
            <div
              className={`rounded-xl px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-red-50 border border-red-200 text-red-700"
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={isCadastro ? handleCadastro : handleEntrar} className="space-y-5">
            {!isCadastro && (
              <>
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Apelido ou e-mail"
                    value={loginInput}
                    onChange={(event) => setLoginInput(event.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="Senha"
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-blue-600 transition p-1"
                  >
                    {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </>
            )}

            {isCadastro && (
              <div className="space-y-4">
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Nome completo *"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    className="w-full pl-10 py-3 bg-white border rounded-xl"
                  />
                </div>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="email"
                    placeholder="E-mail corporativo *"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full pl-10 py-3 bg-white border rounded-xl"
                  />
                </div>
                <div className="relative group">
                  <Briefcase className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <select
                    value={setor}
                    onChange={(event) => setSetor(event.target.value)}
                    className="w-full pl-10 py-3 bg-white border rounded-xl appearance-none"
                  >
                    <option value="">Selecione seu setor *</option>
                    {SETORES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 pointer-events-none text-slate-400" size={20} />
                </div>
                <div className="relative group">
                  <LogIn className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Apelido (login) *"
                    value={loginInput}
                    onChange={(event) => setLoginInput(event.target.value)}
                    className="w-full pl-10 py-3 bg-white border rounded-xl"
                  />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="password"
                    placeholder="Senha *"
                    value={senha}
                    onChange={(event) => setSenha(event.target.value)}
                    className="w-full pl-10 py-3 bg-white border rounded-xl"
                  />
                </div>

                {senha.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex gap-1 h-1.5 mb-2">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`flex-1 rounded-full ${
                            passwordMetrics.score >= step ? "bg-green-500" : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PasswordCheck label="8+ caracteres" met={passwordMetrics.minChar} />
                      <PasswordCheck label="Maiuscula" met={passwordMetrics.hasUpper} />
                      <PasswordCheck label="Numero" met={passwordMetrics.hasNumber} />
                      <PasswordCheck label="Simbolo" met={passwordMetrics.hasSpecial} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={22} />
              ) : isCadastro ? (
                "Solicitar cadastro"
              ) : (
                "Entrar no sistema"
              )}
            </button>
          </form>

          {!isCadastro && (
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setShowReset((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                <KeyRound size={16} /> Esqueci minha senha
              </button>
            </div>
          )}

          {showReset && !isCadastro && (
            <form onSubmit={handleSolicitarReset} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Recuperar senha</h2>
              <p className="text-sm text-slate-500">
                Informe seu apelido ou e-mail no campo acima para enviarmos o link de redefinicao pelo Supabase Auth.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 disabled:opacity-70"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Enviar link de redefinicao"}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <p className="text-slate-600">
              {isCadastro ? "Ja possui cadastro?" : "Nao tem uma conta?"}{" "}
              <button
                onClick={() => {
                  setIsCadastro(!isCadastro);
                  setShowReset(false);
                  resetForm();
                }}
                className="text-blue-600 font-bold hover:underline"
              >
                {isCadastro ? "Fazer login" : "Cadastre-se aqui"}
              </button>
            </p>
          </div>

          <div className="text-center mt-6">
            <p className="text-xs text-slate-400">(c) {new Date().getFullYear()} PORTAL INOVE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
