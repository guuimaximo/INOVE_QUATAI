import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import logoInova from "../assets/logoInovaQuatai.png";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login: ctxLogin } = useAuth();

  const [step, setStep] = useState("login_input");
  const [loginInput, setLoginInput] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function handleVerificarLogin(e) {
    e.preventDefault();
    setErro("");
    if (!loginInput.trim()) return setErro("Digite seu login.");
    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, nome, nivel, ativo, login")
        .ilike("login", loginInput.trim())
        .single();
      if (error || !profile) {
        setErro("Login não encontrado. Verifique e tente novamente.");
        setLoading(false);
        return;
      }
      if (!profile.ativo) {
        setErro("Usuário inativo. Entre em contato com o administrador.");
        setLoading(false);
        return;
      }
      const { data: authUser } = await supabase
        .from("auth_emails_view")
        .select("email")
        .eq("id", profile.id)
        .single();
      const temEmail = authUser?.email && !authUser.email.endsWith("@inove.local");
      if (!temEmail) {
        setStep("email_needed");
      } else {
        setEmail(authUser.email);
        setStep("email_input");
      }
    } catch {
      setErro("Erro ao verificar login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setErro("");
    if (!senha) return setErro("Digite sua senha.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) {
        setErro(error.message.includes("Invalid login credentials") ? "Email ou senha incorretos." : error.message);
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (!profile?.ativo) {
        await supabase.auth.signOut();
        setErro("Usuário inativo. Entre em contato com o administrador.");
        setLoading(false);
        return;
      }
      ctxLogin({
        id: profile.id,
        usuario_id: profile.usuario_id,
        nome: profile.nome,
        nivel: profile.nivel,
        setor: profile.setor,
        ativo: profile.ativo,
        login: profile.login,
        email: data.user.email,
      });
      navigate("/home");
    } catch {
      setErro("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastrarEmail(e) {
    e.preventDefault();
    setErro("");
    if (!novoEmail.trim() || !novoEmail.includes("@")) return setErro("Digite um email válido.");
    if (!senha || senha.length < 6) return setErro("A senha deve ter pelo menos 6 caracteres.");
    setLoading(true);
    try {
      setSucesso("Email registrado! Entre em contato com o administrador para ativação.");
      setEmail(novoEmail);
      setStep("email_input");
    } catch {
      setErro("Erro ao cadastrar email. Contate o administrador.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEsqueciSenha(e) {
    e.preventDefault();
    setErro("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/redefinir-senha",
      });
      if (error) throw error;
      setSucesso("Email de redefinição enviado para " + email + ". Verifique sua caixa de entrada.");
    } catch {
      setErro("Erro ao enviar email. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src={logoInova} alt="Inove" className="h-16 object-contain" />
        </div>
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8 shadow-2xl">

          {step === "login_input" && (
            <>
              <h2 className="text-white text-xl font-semibold mb-1">Bem-vindo</h2>
              <p className="text-slate-400 text-sm mb-6">Digite seu login para continuar</p>
              <form onSubmit={handleVerificarLogin} className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-1 block">Login</label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value)}
                    placeholder="Seu login"
                    autoFocus
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                {erro && <p className="text-red-400 text-sm">{erro}</p>}
                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                  {loading ? "Verificando..." : "Continuar"}
                </button>
              </form>
            </>
          )}

          {step === "email_needed" && (
            <>
              <h2 className="text-white text-xl font-semibold mb-1">Cadastre seu email</h2>
              <p className="text-slate-400 text-sm mb-6">Para acessar com segurança, informe seu email e crie uma senha.</p>
              <form onSubmit={handleCadastrarEmail} className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-1 block">Seu email</label>
                  <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)} placeholder="seu@email.com" autoFocus className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="text-slate-300 text-sm mb-1 block">Criar senha</label>
                  <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                {erro && <p className="text-red-400 text-sm">{erro}</p>}
                {sucesso && <p className="text-green-400 text-sm">{sucesso}</p>}
                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                  {loading ? "Salvando..." : "Cadastrar e Entrar"}
                </button>
                <button type="button" onClick={() => { setStep("login_input"); setErro(""); }} className="w-full text-slate-400 hover:text-white text-sm py-2 transition">← Voltar</button>
              </form>
            </>
          )}

          {step === "email_input" && (
            <>
              <h2 className="text-white text-xl font-semibold mb-1">Digite sua senha</h2>
              <p className="text-slate-400 text-sm mb-1">Entrando como</p>
              <p className="text-blue-400 text-sm font-medium mb-6 truncate">{email}</p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-slate-300 text-sm mb-1 block">Senha</label>
                  <input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Sua senha" autoFocus className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                {erro && <p className="text-red-400 text-sm">{erro}</p>}
                {sucesso && <p className="text-green-400 text-sm">{sucesso}</p>}
                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                  {loading ? "Entrando..." : "Entrar"}
                </button>
                <div className="flex justify-between text-sm pt-1">
                  <button type="button" onClick={() => { setStep("login_input"); setErro(""); setSenha(""); }} className="text-slate-400 hover:text-white transition">← Trocar login</button>
                  <button type="button" onClick={() => { setStep("forgot"); setErro(""); }} className="text-blue-400 hover:text-blue-300 transition">Esqueci a senha</button>
                </div>
              </form>
            </>
          )}

          {step === "forgot" && (
            <>
              <h2 className="text-white text-xl font-semibold mb-1">Redefinir senha</h2>
              <p className="text-slate-400 text-sm mb-6">Enviaremos um link para: <span className="text-blue-400 font-medium block truncate mt-1">{email}</span></p>
              <form onSubmit={handleEsqueciSenha} className="space-y-4">
                {erro && <p className="text-red-400 text-sm">{erro}</p>}
                {sucesso && <p className="text-green-400 text-sm">{sucesso}</p>}
                {!sucesso && (
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
                    {loading ? "Enviando..." : "Enviar email de redefinição"}
                  </button>
                )}
                <button type="button" onClick={() => { setStep("email_input"); setErro(""); setSucesso(""); }} className="w-full text-slate-400 hover:text-white text-sm py-2 transition">← Voltar</button>
              </form>
            </>
          )}

        </div>
        <p className="text-center text-slate-600 text-xs mt-6">Inove Quatai © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
