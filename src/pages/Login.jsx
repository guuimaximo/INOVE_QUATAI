// src/pages/Login.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import logoInova from "../assets/logoInovaQuatai.png";
import { useAuth } from "../context/AuthContext";
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
  RefreshCcw,
} from "lucide-react";
import {
  getAbsoluteUrl,
  getRpcSetupMessage,
  isPlaceholderEmail,
  isValidEmail,
  resolveAuthAccount,
} from "../utils/authBridge";

const NIVEIS_PORTAL = new Set(["Gestor", "Administrador"]);
const SETORES = [
  "ManutenÃ§Ã£o",
  "Recursos humanos",
  "Departamento Pessoal",
  "SESMT",
  "OperaÃ§Ã£o",
  "Ouvidoria",
  "Financeiro",
];
const PASSWORD_STRENGTH_REGEX = {
  hasUpper: /[A-Z]/,
  hasNumber: /\d/,
  hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/,
};
const FAROL_ORIGIN = "https://faroldemetas.onrender.com";

function getFriendlyError(error) {
  const message = String(error?.message || "");

  if (
    message.includes("resolve_auth_account") ||
    message.includes("Could not find the function public.resolve_auth_account")
  ) {
    return getRpcSetupMessage();
  }

  return message || "NÃ£o foi possÃ­vel concluir a operaÃ§Ã£o.";
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

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const [isCadastro, setIsCadastro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showEmailFix, setShowEmailFix] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [loginInput, setLoginInput] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [correcaoEmail, setCorrecaoEmail] = useState("");
  const [correcaoSenha, setCorrecaoSenha] = useState("");

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
    return raw ? decodeURIComponent(raw) : null;
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
    setResetIdentifier("");
    setCorrecaoEmail("");
    setCorrecaoSenha("");
    setPasswordMetrics({ score: 0, hasUpper: false, hasNumber: false, hasSpecial: false, minChar: false });
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

  async function lookupAccount(identifier) {
    const account = await resolveAuthAccount(identifier);
    return account;
  }

  function rememberUserHints(account) {
    try {
      localStorage.setItem("inove_login", account.login || loginInput.trim());
      localStorage.setItem("inove_nivel", String(account.nivel || ""));
      localStorage.setItem("inove_nome", account.nome || "");
    } catch {
      // noop
    }
  }

  async function handleEntrar(event) {
    event.preventDefault();
    setFeedback(null);

    const identifier = loginInput.trim();
    const currentPassword = senha.trim();

    if (!identifier || !currentPassword) {
      pushFeedback("error", "Informe seu usuÃ¡rio/e-mail e senha.");
      return;
    }

    setLoading(true);

    try {
      const account = await lookupAccount(identifier);

      if (!account) {
        pushFeedback("error", "Nenhum cadastro ativo foi encontrado para esse login/e-mail.");
        return;
      }

      if (!account.ativo) {
        pushFeedback("error", "Sua conta estÃ¡ inativa. Fale com o administrador.");
        return;
      }

      const nivel = String(account.nivel || "").trim();
      const statusCadastro = String(account.status_cadastro || "").trim();

      if (nivel === "Pendente" || statusCadastro === "Pendente") {
        pushFeedback("error", "Seu cadastro ainda estÃ¡ em anÃ¡lise pelo administrador.");
        return;
      }

      if (!account.auth_email) {
        setShowEmailFix(true);
        setCorrecaoEmail(account.legacy_email || "");
        pushFeedback(
          "error",
          "Seu cadastro foi localizado, mas o usuÃ¡rio Auth ainda nÃ£o estÃ¡ vinculado corretamente. Regularize o e-mail de acesso ou finalize a migraÃ§Ã£o no Supabase."
        );
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: account.auth_email,
        password: currentPassword,
      });

      if (signInError) {
        pushFeedback("error", signInError.message || "Credenciais incorretas.");
        return;
      }

      const hydratedUser = await refreshUser(signInData.session || null);
      rememberUserHints(account);

      if (account.email_precisa_correcao) {
        alert(
          "Seu acesso entrou usando um e-mail provisÃ³rio no Supabase. Use a opÃ§Ã£o 'Corrigir e-mail de acesso' para trocar pelo e-mail correto antes de depender de recuperaÃ§Ã£o de senha."
        );
      }

      const safeFarolRedirect = getSafeFarolRedirect(redirectParam);
      if (safeFarolRedirect && NIVEIS_PORTAL.has(nivel)) {
        window.location.href = safeFarolRedirect;
        return;
      }

      if (hydratedUser?.requires_profile_review) {
        navigate("/atualizar-perfil", { replace: true });
        return;
      }

      navigate(nextPathState || decideDefaultNext(hydratedUser?.nivel || nivel), { replace: true });
    } catch (error) {
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleSolicitarReset(event) {
    event.preventDefault();
    setFeedback(null);

    const identifier = (resetIdentifier || loginInput).trim();
    if (!identifier) {
      pushFeedback("error", "Informe o login ou e-mail para localizar a conta.");
      return;
    }

    setLoading(true);

    try {
      const account = await lookupAccount(identifier);

      if (!account || !account.ativo) {
        pushFeedback("error", "Conta nÃ£o encontrada ou inativa.");
        return;
      }

      if (!account.auth_email) {
        setShowEmailFix(true);
        pushFeedback(
          "error",
          "Seu usuÃ¡rio ainda nÃ£o tem um e-mail de acesso vÃ¡lido no Supabase. Corrija o e-mail antes de usar recuperaÃ§Ã£o de senha."
        );
        return;
      }

      if (!isValidEmail(account.auth_email) || isPlaceholderEmail(account.auth_email)) {
        setShowEmailFix(true);
        setCorrecaoEmail(account.legacy_email || "");
        pushFeedback(
          "error",
          "Sua conta ainda usa um e-mail provisÃ³rio. Corrija o e-mail de acesso primeiro e depois refaÃ§a a recuperaÃ§Ã£o de senha."
        );
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(account.auth_email, {
        redirectTo: getAbsoluteUrl("/atualizar-senha"),
      });

      if (error) {
        pushFeedback("error", error.message || "NÃ£o foi possÃ­vel enviar o reset de senha.");
        return;
      }

      pushFeedback(
        "success",
        `Enviamos a redefiniÃ§Ã£o de senha para ${account.auth_email}. Abra o link do e-mail para cadastrar a nova senha.`
      );
    } catch (error) {
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCorrigirEmail(event) {
    event.preventDefault();
    setFeedback(null);

    const identifier = loginInput.trim();
    const currentPassword = correcaoSenha.trim();
    const newEmail = correcaoEmail.trim().toLowerCase();

    if (!identifier || !currentPassword || !newEmail) {
      pushFeedback("error", "Informe login/e-mail, senha atual e novo e-mail de acesso.");
      return;
    }

    if (!isValidEmail(newEmail) || isPlaceholderEmail(newEmail)) {
      pushFeedback("error", "Informe um e-mail corporativo vÃ¡lido para o novo acesso.");
      return;
    }

    setLoading(true);

    try {
      const account = await lookupAccount(identifier);

      if (!account) {
        pushFeedback("error", "Conta nÃ£o encontrada para esse login/e-mail.");
        return;
      }

      if (!account.auth_email) {
        pushFeedback(
          "error",
          "Este cadastro ainda nÃ£o possui um usuÃ¡rio Auth vinculado. O administrador precisa concluir a migraÃ§Ã£o desse usuÃ¡rio no Supabase."
        );
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: account.auth_email,
        password: currentPassword,
      });

      if (signInError) {
        pushFeedback("error", "NÃ£o foi possÃ­vel validar sua senha atual para corrigir o e-mail de acesso.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: getAbsoluteUrl("/login") }
      );

      if (updateError) {
        pushFeedback("error", updateError.message || "Falha ao atualizar o e-mail de acesso.");
        return;
      }

      try {
        await supabase.rpc("link_auth_account", {
          p_usuario_id: account.usuario_id,
          p_auth_user_id: signInData.user?.id || signInData.session?.user?.id,
          p_email: newEmail,
        });
      } catch (rpcError) {
        console.warn("Falha ao sincronizar usuarios_aprovadores:", rpcError);
      }

      await supabase.auth.signOut();
      pushFeedback(
        "success",
        "SolicitaÃ§Ã£o de troca de e-mail enviada. Se o projeto estiver com 'Secure email change' ativo no Supabase, desative essa opÃ§Ã£o ou conclua a confirmaÃ§Ã£o tambÃ©m no e-mail antigo."
      );
    } catch (error) {
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
    const senhaTrim = senha.trim();
    const emailTrim = email.trim().toLowerCase();

    if (!nomeTrim || !loginTrim || !senhaTrim || !setor || !emailTrim) {
      pushFeedback("error", "Preencha todos os campos obrigatÃ³rios.");
      return;
    }

    if (!isValidEmail(emailTrim)) {
      pushFeedback("error", "Insira um e-mail vÃ¡lido.");
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
        pushFeedback("error", "Este usuÃ¡rio ou e-mail jÃ¡ estÃ£o cadastrados.");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailTrim,
        password: senhaTrim,
        options: {
          emailRedirectTo: getAbsoluteUrl("/login"),
          data: {
            nome: nomeTrim,
            nivel: "Pendente",
            login: loginTrim,
          },
        },
      });

      if (authError) {
        pushFeedback("error", authError.message || "NÃ£o foi possÃ­vel criar o acesso no Supabase Auth.");
        return;
      }

      const authUserId = authData.user?.id || null;

      const { error: insertError } = await supabase.from("usuarios_aprovadores").insert([
        {
          nome: nomeTrim,
          login: loginTrim,
          email: emailTrim,
          senha: null,
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
        pushFeedback("error", insertError.message || "Erro ao registrar sua solicitaÃ§Ã£o de acesso.");
        return;
      }

      await supabase.auth.signOut();
      pushFeedback(
        "success",
        "Cadastro solicitado com sucesso. Se o Supabase exigir confirmaÃ§Ã£o de e-mail, valide a mensagem recebida antes do primeiro login."
      );
      setIsCadastro(false);
      resetForm(false);
    } catch (error) {
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
            O papel da lideranca no Grupo CSC e motivar e capacitar pessoas, entendendo a individualidade de cada um, com disciplina e comprometimento, gerando resiliencia e coragem para influenciar, quebrar barreiras, melhorar processos e entregar resultados com foco na seguranca, na satisfacao do cliente e na otimizacao de custos.
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
                ? "Preencha todos os dados abaixo para solicitar acesso."
                : "Entre com suas credenciais para continuar."}
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
                    placeholder="UsuÃ¡rio ou e-mail"
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
                    placeholder="UsuÃ¡rio (login) *"
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
                          className={`flex-1 rounded-full ${passwordMetrics.score >= step ? "bg-green-500" : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PasswordCheck label="8+ caracteres" met={passwordMetrics.minChar} />
                      <PasswordCheck label="MaiÃºscula" met={passwordMetrics.hasUpper} />
                      <PasswordCheck label="NÃºmero" met={passwordMetrics.hasNumber} />
                      <PasswordCheck label="SÃ­mbolo" met={passwordMetrics.hasSpecial} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
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

              <button
                type="button"
                onClick={() => setShowEmailFix((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
              >
                <RefreshCcw size={16} /> Corrigir e-mail de acesso
              </button>
            </div>
          )}

          {showReset && !isCadastro && (
            <form onSubmit={handleSolicitarReset} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Recuperar senha</h2>
              <p className="text-sm text-slate-500">
                O reset segue o fluxo correto do Supabase e envia um link para redefinir a senha.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="UsuÃ¡rio ou e-mail"
                  value={resetIdentifier}
                  onChange={(event) => setResetIdentifier(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800 disabled:opacity-70"
              >
                Enviar redefiniÃ§Ã£o
              </button>
            </form>
          )}

          {showEmailFix && !isCadastro && (
            <form onSubmit={handleCorrigirEmail} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Corrigir e-mail de acesso</h2>
              <p className="text-sm text-slate-500">
                Use sua senha atual para trocar o e-mail provisÃ³rio do Supabase pelo e-mail correto de trabalho.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input
                  type="email"
                  placeholder="Novo e-mail de acesso"
                  value={correcaoEmail}
                  onChange={(event) => setCorrecaoEmail(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
                <input
                  type="password"
                  placeholder="Senha atual"
                  value={correcaoSenha}
                  onChange={(event) => setCorrecaoSenha(event.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-white font-semibold hover:bg-emerald-700 disabled:opacity-70"
              >
                Atualizar e-mail de acesso
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <p className="text-slate-600">
              {isCadastro ? "JÃ¡ possui cadastro?" : "NÃ£o tem uma conta?"}{" "}
              <button
                onClick={() => {
                  setIsCadastro(!isCadastro);
                  setShowReset(false);
                  setShowEmailFix(false);
                  resetForm();
                }}
                className="text-blue-600 font-bold hover:underline"
              >
                {isCadastro ? "Fazer login" : "Cadastre-se aqui"}
              </button>
            </p>
          </div>

          <div className="text-center mt-6">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} PORTAL INOVE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
