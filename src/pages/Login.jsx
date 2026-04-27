// src/pages/Login.jsx (PROJETO INOVE)
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import logoInova from "../assets/logoInovaQuatai.png";
import { useAuth } from "../context/AuthContext";
import {
  User, Lock, LogIn, Mail, Check, X,
  Loader2, Eye, EyeOff, KeyRound, RefreshCcw,
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

function PasswordCheck({ senha }) {
  const checks = [
    { label: "Mínimo 8 caracteres", ok: senha.length >= 8 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(senha) },
    { label: "Número", ok: /\d/.test(senha) },
    { label: "Caractere especial", ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(senha) },
  ];
  return (
    <ul className="mt-1 space-y-1">
      {checks.map((c) => (
        <li key={c.label} className={`flex items-center gap-1 text-xs ${c.ok ? "text-green-400" : "text-slate-400"}`}>
          {c.ok ? <Check size={12} /> : <X size={12} />} {c.label}
        </li>
      ))}
    </ul>
  );
}

export default function Login() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { login: ctxLogin } = useAuth();

  const [isCadastro, setIsCadastro]       = useState(false);
  const [showReset, setShowReset]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [mostrarSenha, setMostrarSenha]   = useState(false);
  const [feedback, setFeedback]           = useState(null); // { type: "error"|"success", text }

  // Campos login
  const [loginInput, setLoginInput] = useState("");
  const [senha, setSenha]           = useState("");
  const [resetEmail, setResetEmail] = useState("");

  // Campos cadastro
  const [nome, setNome]   = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");

  const nextPath = location.state?.from?.pathname || "/inove";

  function resetForm() {
    setNome(""); setLoginInput(""); setSenha("");
    setEmail(""); setSetor(""); setResetEmail("");
    setFeedback(null);
  }

  // ── ENTRAR ────────────────────────────────────────────────
  async function handleEntrar(e) {
    e.preventDefault();
    setFeedback(null);
    if (!loginInput.trim() || !senha) {
      return setFeedback({ type: "error", text: "Preencha o login e a senha." });
    }
    setLoading(true);
    try {
      // 1. Buscar perfil pelo login
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, nome, nivel, setor, ativo, login")
        .ilike("login", loginInput.trim())
        .single();

      if (pErr || !profile) {
        setFeedback({ type: "error", text: "Login não encontrado." });
        setLoading(false);
        return;
      }
      if (!profile.ativo) {
        setFeedback({ type: "error", text: "Conta inativa. Fale com o administrador." });
        setLoading(false);
        return;
      }

      // 2. Buscar email vinculado
      const { data: authRow } = await supabase
        .from("auth_emails_view")
        .select("email")
        .eq("id", profile.id)
        .single();

      const emailAuth = authRow?.email;
      if (!emailAuth || emailAuth.endsWith("@inove.local")) {
        // Sem email real — redirecionar para cadastrar email
        setFeedback({
          type: "error",
          text: "Seu acesso ainda não foi migrado. Clique em 'Primeiro acesso' para configurar seu email.",
        });
        setLoading(false);
        return;
      }

      // 3. Login Supabase Auth
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: emailAuth,
        password: senha,
      });
      if (signErr) {
        setFeedback({ type: "error", text: "Senha incorreta. Tente novamente ou redefina sua senha." });
        setLoading(false);
        return;
      }

      // 4. Montar user no contexto
      ctxLogin({
        id:         profile.id,
        usuario_id: profile.usuario_id,
        nome:       profile.nome,
        nivel:      profile.nivel,
        setor:      profile.setor,
        ativo:      profile.ativo,
        login:      profile.login,
        email:      data.user.email,
      });

      // 5. Redirecionar
      const nivel = String(profile.nivel || "").trim();
      const dest  = NIVEIS_PORTAL.has(nivel) ? "/inove" : "/inove";
      navigate(dest, { replace: true });
    } catch {
      setFeedback({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  // ── CADASTRO (Primeiro acesso / novo usuário) ─────────────
  async function handleCadastro(e) {
    e.preventDefault();
    setFeedback(null);

    if (!nome.trim() || !loginInput.trim() || !email.trim() || !senha || !setor) {
      return setFeedback({ type: "error", text: "Preencha todos os campos." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return setFeedback({ type: "error", text: "Email inválido." });
    }
    if (senha.length < 8 || !/[A-Z]/.test(senha) || !/\d/.test(senha) || !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(senha)) {
      return setFeedback({ type: "error", text: "A senha não atende aos requisitos de segurança." });
    }

    setLoading(true);
    try {
      // Verificar se o login existe no profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, nome, ativo, login")
        .ilike("login", loginInput.trim())
        .single();

      if (!profile) {
        setFeedback({ type: "error", text: "Login não encontrado. Verifique com o administrador." });
        setLoading(false);
        return;
      }
      if (!profile.ativo) {
        setFeedback({ type: "error", text: "Conta inativa. Fale com o administrador." });
        setLoading(false);
        return;
      }

      // Verificar se email já existe no Auth
      const { data: existing } = await supabase
        .from("auth_emails_view")
        .select("email")
        .eq("id", profile.id)
        .single();

      if (existing?.email && !existing.email.endsWith("@inove.local")) {
        setFeedback({ type: "error", text: "Esse login já possui acesso configurado. Use 'Entrar' ou redefina sua senha." });
        setLoading(false);
        return;
      }

      // Criar conta no Supabase Auth
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          data: { nome: profile.nome, login: profile.login },
          emailRedirectTo: window.location.origin + "/login",
        },
      });

      if (signUpErr) {
        setFeedback({ type: "error", text: "Erro ao criar acesso: " + signUpErr.message });
        setLoading(false);
        return;
      }

      setFeedback({
        type: "success",
        text: "Acesso criado! Verifique seu email " + email + " para confirmar e depois faça login.",
      });
      resetForm();
      setIsCadastro(false);
    } catch {
      setFeedback({ type: "error", text: "Erro inesperado. Tente novamente." });
    } finally {
      setLoading(false);
    }
  }

  // ── REDEFINIR SENHA ───────────────────────────────────────
  async function enviarParaFarol(e) {
    e.preventDefault();
    setFeedback(null);
    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      return setFeedback({ type: "error", text: "Digite um email válido." });
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: window.location.origin + "/redefinir-senha",
      });
      if (error) throw error;
      setFeedback({
        type: "success",
        text: "Email de redefinição enviado para " + resetEmail + ". Verifique sua caixa de entrada.",
      });
      setResetEmail("");
    } catch {
      setFeedback({ type: "error", text: "Não foi possível enviar o email. Verifique o endereço informado." });
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // UI
  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-800 px-4 py-10">

      {/* Logo */}
      <img src={logoInova} alt="Inove Quatai" className="h-16 mb-8 object-contain drop-shadow-lg" />

      <div className="w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">

        {/* ── Tabs Entrar / Primeiro acesso ── */}
        {!showReset && (
          <div className="flex mb-6 rounded-lg overflow-hidden border border-white/10">
            <button
              type="button"
              onClick={() => { setIsCadastro(false); resetForm(); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${!isCadastro ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setIsCadastro(true); resetForm(); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${isCadastro ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              Primeiro acesso
            </button>
          </div>
        )}

        {/* ── Feedback ── */}
        {feedback && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${feedback.type === "error" ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-green-500/20 text-green-300 border border-green-500/30"}`}>
            {feedback.type === "error" ? <X size={16} className="mt-0.5 shrink-0" /> : <Check size={16} className="mt-0.5 shrink-0" />}
            {feedback.text}
          </div>
        )}

        {/* ══════════════════════════════════════
            FORMULÁRIO — ENTRAR
        ══════════════════════════════════════ */}
        {!isCadastro && !showReset && (
          <form onSubmit={handleEntrar} className="space-y-4">
            <h2 className="text-white font-semibold text-lg mb-2">Bem-vindo ao Inove</h2>
            <p className="text-slate-400 text-sm mb-4">
              Use seu <strong className="text-slate-200">login</strong> e <strong className="text-slate-200">senha</strong> para acessar o sistema.
            </p>

            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Seu login"
                value={loginInput}
                onChange={e => setLoginInput(e.target.value)}
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
              />
            </div>

            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={mostrarSenha ? "text" : "password"}
                placeholder="Senha"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
              >
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setShowReset(true); setFeedback(null); }}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                Esqueci minha senha
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>
        )}

        {/* ══════════════════════════════════════
            FORMULÁRIO — PRIMEIRO ACESSO / CADASTRO
        ══════════════════════════════════════ */}
        {isCadastro && !showReset && (
          <form onSubmit={handleCadastro} className="space-y-4">
            <h2 className="text-white font-semibold text-lg mb-2">Configure seu acesso</h2>
            <p className="text-slate-400 text-sm mb-4">
              Informe seus dados para ativar o acesso seguro ao sistema Inove.
            </p>

            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Seu nome completo"
                value={nome}
                onChange={e => setNome(e.target.value)}
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
              />
            </div>

            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Seu login (cadastrado pelo admin)"
                value={loginInput}
                onChange={e => setLoginInput(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
              />
            </div>

            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="Seu email corporativo"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
              />
            </div>

            <select
              value={setor}
              onChange={e => setSetor(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition text-sm appearance-none"
            >
              <option value="" className="bg-slate-800">Selecione seu setor</option>
              {SETORES.map(s => (
                <option key={s} value={s} className="bg-slate-800">{s}</option>
              ))}
            </select>

            <div>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="Criar senha segura"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-10 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {senha && <PasswordCheck senha={senha} />}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {loading ? "Configurando..." : "Ativar acesso"}
            </button>
          </form>
        )}

        {/* ══════════════════════════════════════
            REDEFINIR SENHA
        ══════════════════════════════════════ */}
        {showReset && (
          <form onSubmit={enviarParaFarol} className="space-y-4">
            <h2 className="text-white font-semibold text-lg mb-2">Redefinir senha</h2>
            <p className="text-slate-400 text-sm mb-4">
              Informe o email cadastrado. Vamos enviar um link para você criar uma nova senha.
            </p>

            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                placeholder="Seu email cadastrado"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-lg pl-9 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              {loading ? "Enviando..." : "Enviar link de redefinição"}
            </button>

            <button
              type="button"
              onClick={() => { setShowReset(false); setFeedback(null); setResetEmail(""); }}
              className="w-full text-slate-400 hover:text-white text-sm py-2 transition"
            >
              ← Voltar para o login
            </button>
          </form>
        )}

      </div>

      <p className="text-slate-600 text-xs mt-6">
        Inove Quatai © {new Date().getFullYear()} — Acesso restrito a colaboradores autorizados
      </p>
    </div>
  );
}
