import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import logoInova from "../../assets/logoInovaQuatai.png";
import { useAuth } from "../../context/AuthContext";
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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

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

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: doLogin } = useAuth();

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

  async function handleEntrar(event) {
    event.preventDefault();
    setFeedback(null);

    const identifier = loginInput.trim();
    const currentPassword = senha;

    if (!identifier || !currentPassword) {
      pushFeedback("error", "Informe seu usuario/e-mail e senha.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("usuarios_aprovadores")
        .select("*")
        .or(`login.eq.${identifier},email.eq.${identifier}`)
        .eq("senha", currentPassword)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        pushFeedback("error", error.message || "Erro ao consultar usuarios_aprovadores.");
        return;
      }

      if (!data) {
        pushFeedback("error", "Credenciais incorretas ou conta inativa.");
        return;
      }

      const nivel = String(data.nivel || "").trim();
      const statusCadastro = String(data.status_cadastro || "").trim();

      if (nivel === "Pendente" || statusCadastro === "Pendente") {
        pushFeedback("error", "Seu cadastro ainda esta em analise pelo administrador.");
        return;
      }

      const loggedUser = doLogin(data);
      rememberUserHints(identifier, loggedUser);

      const safeFarolRedirect = getSafeFarolRedirect(redirectParam);
      if (safeFarolRedirect && NIVEIS_PORTAL.has(nivel)) {
        window.location.href = safeFarolRedirect;
        return;
      }

      navigate(nextPathState || decideDefaultNext(nivel), { replace: true });
    } catch (error) {
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
  }

  function handleSolicitarReset(event) {
    event.preventDefault();
    pushFeedback(
      "error",
      "A recuperacao automatica pelo Supabase Auth esta temporariamente indisponivel. Para trocar a senha agora, fale com o administrador do sistema."
    );
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

      const { error: insertError } = await supabase.from("usuarios_aprovadores").insert([
        {
          nome: nomeTrim,
          login: loginTrim,
          email: emailTrim,
          senha: senhaCadastro,
          setor,
          ativo: false,
          nivel: "Pendente",
          status_cadastro: "Pendente",
          criado_em: new Date().toISOString(),
        },
      ]);

      if (insertError) {
        pushFeedback("error", insertError.message || "Erro ao registrar sua solicitacao de acesso.");
        return;
      }

      pushFeedback("success", "Cadastro solicitado com sucesso. Aguarde a aprovacao do administrador.");
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
                    placeholder="Usuario ou e-mail"
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
                    placeholder="Usuario (login) *"
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
            </div>
          )}

          {showReset && !isCadastro && (
            <form onSubmit={handleSolicitarReset} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Recuperar senha</h2>
              <p className="text-sm text-slate-500">
                No modo legado, a troca de senha precisa ser feita pelo administrador em usuarios_aprovadores.
              </p>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-white font-semibold hover:bg-slate-800"
              >
                Entendi, solicitar ao administrador
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
