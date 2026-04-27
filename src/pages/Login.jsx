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

function getFriendlyError(error) {
  const message = String(error?.message || "");

  if (
    message.includes("resolve_auth_account") ||
    message.includes("Could not find the function public.resolve_auth_account")
  ) {
    return getRpcSetupMessage();
  }

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
      pushFeedback("error", "Informe seu usuario/e-mail e senha.");
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
        pushFeedback("error", "Sua conta esta inativa. Fale com o administrador.");
        return;
      }

      const nivel = String(account.nivel || "").trim();
      const statusCadastro = String(account.status_cadastro || "").trim();
