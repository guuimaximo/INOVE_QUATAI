import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
// src/pages/Login.jsx (PROJETO INOVE)
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabase";
import logoInova from "../assets/logoInovaQuatai.png";
import { useAuth } from "../context/AuthContext";
import {
  User, Lock, LogIn, UserPlus, Eye, EyeOff,
  Briefcase, Mail, Check, X, Loader2, ChevronDown
} from "lucide-react";

const NIVEIS_PORTAL = new Set(["Gestor", "Administrador"]);
const SETORES = [
  "Manutencao",
  "Recursos humanos",
  "Departamento Pessoal",
  "SESMT",
  "Operacao",
  "Manutenção",
  "Recursos humanos",
  "Departamento Pessoal",
  "SESMT",
  "Operação",
  "Ouvidoria",
  "Financeiro",
];

  return message || "Nao foi possivel concluir a operacao.";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: doLogin } = useAuth();

  const [isCadastro, setIsCadastro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  // Estados do Formulário
  const [loginInput, setLoginInput] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");

  const [passwordMetrics, setPasswordMetrics] = useState({
    score: 0, hasUpper: false, hasNumber: false, hasSpecial: false, minChar: false
  });

  const redirectParam = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const raw = sp.get("redirect");
    return raw ? decodeURIComponent(raw) : null;
  }, [location.search]);

  const nextPathState = location.state?.from?.pathname || null;

  function decideDefaultNext(nivel) {
    if (NIVEIS_PORTAL.has(nivel)) return "/portal";
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
  // =================================================================
  // FUNÇÃO ATUALIZADA: REDIRECIONAMENTO LIMPO
  // =================================================================
  // Não envia mais 'userData' para evitar confusão de cache.
  // Apenas manda o usuário para a tela de login do Farol.
  const enviarParaFarol = (urlDestino) => {
    console.log("🚀 Redirecionando para Login Manual no Farol...");

    // 1. Define a origem base (Domínio do Farol)
    let origin;
    try {
        origin = new URL(urlDestino).origin;
    } catch {
        // Fallback de segurança se o link estiver quebrado
        origin = "https://faroldemetas.onrender.com";
    }

    // 2. Redireciona para a raiz do Farol.
    // Lá, o LandingFarol vai limpar o cache e pedir login novamente.
    window.location.href = origin;
  };

  // Preenche o login se já houver um salvo no navegador
  useEffect(() => {
    if (!redirectParam) return;

    const storedLogin = localStorage.getItem("inove_login");
    if (storedLogin && !loginInput) {
      setLoginInput(storedLogin); 
    }
  }, [redirectParam]);

  // Monitor de Senha
  useEffect(() => {
    if (!isCadastro) return;
    const s = senha;
    const metrics = {
      hasUpper: /[A-Z]/.test(s),
      hasNumber: /[0-9]/.test(s),
      hasSpecial: /[!@#$%^&*]/.test(s),
      minChar: s.length >= 8
    };
    setPasswordMetrics({ ...metrics, score: Object.values(metrics).filter(Boolean).length });
  }, [senha, isCadastro]);

  // --- LOGIN MANUAL ---
  async function handleEntrar(e) {
    e.preventDefault();
    const inputTrim = loginInput.trim();
    const senhaTrim = senha.trim();

    if (!identifier || !currentPassword) {
      pushFeedback("error", "Informe seu usuario/e-mail e senha.");
    if (!inputTrim || !senhaTrim) {
      alert("Informe seu usuário/e-mail e senha.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("usuarios_aprovadores")
      .select("*")
      .or(`login.eq.${inputTrim},email.eq.${inputTrim}`)
      .eq("senha", senhaTrim)
      .eq("ativo", true)
      .maybeSingle();

    setLoading(false);

      if (!account.ativo) {
        pushFeedback("error", "Sua conta esta inativa. Fale com o administrador.");
        return;
      }

      const nivel = String(account.nivel || "").trim();
      const statusCadastro = String(account.status_cadastro || "").trim();

      if (nivel === "Pendente" || statusCadastro === "Pendente") {
        pushFeedback("error", "Seu cadastro ainda esta em analise pelo administrador.");
        return;
      }

      if (!account.auth_email) {
        setShowEmailFix(true);
        setCorrecaoEmail(account.legacy_email || "");
        pushFeedback(
          "error",
          "Seu cadastro foi localizado, mas o usuario Auth ainda nao esta vinculado corretamente. Regularize o e-mail de acesso ou finalize a migracao no Supabase."
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
          "Seu acesso entrou usando um e-mail provisorio no Supabase. Use a opcao 'Corrigir e-mail de acesso' para trocar pelo e-mail correto antes de depender de recuperacao de senha."
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
        pushFeedback("error", "Conta nao encontrada ou inativa.");
        return;
      }

      if (!account.auth_email) {
        setShowEmailFix(true);
        pushFeedback(
          "error",
          "Seu usuario ainda nao tem um e-mail de acesso valido no Supabase. Corrija o e-mail antes de usar recuperacao de senha."
        );
        return;
      }

      if (!isValidEmail(account.auth_email) || isPlaceholderEmail(account.auth_email)) {
        setShowEmailFix(true);
        setCorrecaoEmail(account.legacy_email || "");
        pushFeedback(
          "error",
          "Sua conta ainda usa um e-mail provisorio. Corrija o e-mail de acesso primeiro e depois refaca a recuperacao de senha."
        );
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(account.auth_email, {
        redirectTo: getAbsoluteUrl("/atualizar-senha"),
      });

      if (error) {
        pushFeedback("error", error.message || "Nao foi possivel enviar o reset de senha.");
        return;
      }

      pushFeedback(
        "success",
        `Enviamos a redefinicao de senha para ${account.auth_email}. Abra o link do e-mail para cadastrar a nova senha.`
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
      pushFeedback("error", "Informe um e-mail corporativo valido para o novo acesso.");
    if (error) {
      alert("Erro de conexão. Tente novamente.");
      return;
    }

    if (!data) {
      alert("Credenciais incorretas ou conta inativa.");
      return;
    }

    const nivel = String(data.nivel || "").trim();

    if (nivel === "Pendente") {
      alert("Seu cadastro ainda está em análise pelo administrador.");
      return;
    }

    doLogin(data);

    try {
      const account = await lookupAccount(identifier);

      if (!account) {
        pushFeedback("error", "Conta nao encontrada para esse login/e-mail.");
        return;
      }

      if (!account.auth_email) {
        pushFeedback(
          "error",
          "Este cadastro ainda nao possui um usuario Auth vinculado. O administrador precisa concluir a migracao desse usuario no Supabase."
        );
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: account.auth_email,
        password: currentPassword,
      });

      if (signInError) {
        pushFeedback("error", "Nao foi possivel validar sua senha atual para corrigir o e-mail de acesso.");
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
        "Solicitacao de troca de e-mail enviada. Se o projeto estiver com 'Secure email change' ativo no Supabase, desative essa opcao ou conclua a confirmacao tambem no e-mail antigo."
      );
    } catch (error) {
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
      localStorage.setItem("inove_login", data.login);
      localStorage.setItem("inove_nivel", nivel);
      localStorage.setItem("inove_nome", data.nome || "");
    } catch {}

    const isGestorAdm = NIVEIS_PORTAL.has(nivel);

    // ✅ LÓGICA DE REDIRECT ATUALIZADA
    // Se veio do Farol, autenticamos aqui só para validar, mas
    // mandamos ele de volta para logar lá e criar a sessão correta.
    if (redirectParam && isGestorAdm) {
      enviarParaFarol(redirectParam);
      return;
    }

    // Fluxo normal (Navegação dentro do Inove)
    navigate(nextPathState || decideDefaultNext(nivel), { replace: true });
  }

  // --- CADASTRO ---
  async function handleCadastro(e) {
    e.preventDefault();
    const nomeTrim = nome.trim();
    const loginTrim = loginInput.trim();
    const senhaTrim = senha.trim();
    const emailTrim = email.trim();

    if (!nomeTrim || !loginTrim || !senhaTrim || !setor || !emailTrim) {
      pushFeedback("error", "Preencha todos os campos obrigatorios.");
      return;
    }

    if (!isValidEmail(emailTrim)) {
      pushFeedback("error", "Insira um e-mail valido.");
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    if (!EMAIL_REGEX.test(emailTrim)) {
      alert("Insira um e-mail válido.");
      return;
    }

    if (passwordMetrics.score < 3) {
      alert("Senha muito fraca.");
      return;
    }

    setLoading(true);

    const { data: existingUser, error: checkError } = await supabase
      .from("usuarios_aprovadores")
      .select("id")
      .or(`login.eq.${loginTrim},email.eq.${emailTrim}`)
      .maybeSingle();

      if (existingUser) {
        pushFeedback("error", "Este usuario ou e-mail ja estao cadastrados.");
        return;
      }
    if (checkError) {
      setLoading(false);
      alert("Erro ao verificar dados.");
      return;
    }

    if (existingUser) {
      setLoading(false);
      alert("Este Usuário ou E-mail já estão cadastrados.");
      return;
    }

    const { error } = await supabase.from("usuarios_aprovadores").insert([
      {
        nome: nomeTrim,
        login: loginTrim,
        senha: senhaTrim,
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
        pushFeedback("error", authError.message || "Nao foi possivel criar o acesso no Supabase Auth.");
        return;
        setor: setor,
        ativo: false,
        nivel: "Pendente",
        criado_em: new Date().toISOString()
      },
    ]);

    setLoading(false);

    if (error) {
      if (error.message.includes('column "setor"')) {
        alert("Erro técnico: Coluna 'setor' ausente no banco.");
      } else {
        alert("Erro ao cadastrar: " + error.message);
      }
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
        pushFeedback("error", insertError.message || "Erro ao registrar sua solicitacao de acesso.");
        return;
      }

      await supabase.auth.signOut();
      pushFeedback(
        "success",
        "Cadastro solicitado com sucesso. Se o Supabase exigir confirmacao de e-mail, valide a mensagem recebida antes do primeiro login."
      );
      setIsCadastro(false);
      resetForm(false);
    } catch (error) {
      pushFeedback("error", getFriendlyError(error));
    } finally {
      setLoading(false);
    }
    alert("Cadastro solicitado! Aguarde a aprovação.");
    setIsCadastro(false);
    resetForm();
  }

  function resetForm() {
    setNome("");
    setLoginInput("");
    setSenha("");
    setEmail("");
    setSetor("");
    setPasswordMetrics({ score: 0 });
  }

  const PasswordCheck = ({ label, met }) => (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600 font-medium" : "text-slate-400"}`}>
      {met ? <Check size={12} strokeWidth={3} /> : <X size={12} />}
      <span>{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* --- LADO ESQUERDO: Branding (Desktop) --- */}
      <div className="hidden lg:flex lg:w-5/12 bg-blue-900 relative overflow-hidden flex-col items-center justify-center text-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 to-blue-950 opacity-90 z-0" />
        <div className="relative z-10 flex flex-col items-center">
          <img
            src={logoInova}
            alt="Logo Portal Inove"
            className="w-48 mb-8 drop-shadow-xl"
          />
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">PORTAL INOVE</h2>

          <p className="text-blue-100 max-w-sm text-lg leading-relaxed text-justify">
            O papel da lideranca no Grupo CSC e motivar e capacitar pessoas, entendendo a individualidade de cada um,
            com disciplina e comprometimento, gerando resiliencia e coragem para influenciar, quebrar barreiras,
            melhorar processos e entregar resultados com foco na seguranca, na satisfacao do cliente e na otimizacao de
            custos.
            “O papel da liderança no Grupo CSC é motivar e capacitar pessoas, entendendo a individualidade de cada um, com disciplina e comprometimento, gerando resiliência e coragem para influenciar, quebrar barreiras, melhorar processos e entregar resultados com foco na segurança, na satisfação do cliente e na otimização de custos”
          </p>
        </div>

        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>

      {/* --- LADO DIREITO: Formulário --- */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-6 lg:p-12 overflow-y-auto">
        <div className="w-full max-w-md space-y-8">
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

            {redirectParam && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-700 font-medium">
                Conectando ao Farol Tático... (faça login para continuar)
              </div>
            )}

            <p className="mt-2 text-slate-500">
              {isCadastro
                ? "Preencha todos os dados abaixo para solicitar acesso."
                : "Entre com suas credenciais para continuar."}
            </p>
          </div>

          <form onSubmit={isCadastro ? handleCadastro : handleEntrar} className="space-y-5">
            {/* Campos de Login */}
            {!isCadastro && (
              <>
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type="text"
                    placeholder="Usuario ou e-mail"
                    placeholder="Usuário ou E-mail"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                  />
                </div>

                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input
                    type={mostrarSenha ? "text" : "password"}
                    placeholder="Senha"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
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

            {/* Campos de Cadastro */}
            {isCadastro && (
              <div className="space-y-4">
                <div className="relative group">
                  <User className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input type="text" placeholder="Nome Completo *" value={nome} onChange={e => setNome(e.target.value)} className="w-full pl-10 py-3 bg-white border rounded-xl" />
                </div>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input type="email" placeholder="Email Corporativo *" value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-10 py-3 bg-white border rounded-xl" />
                </div>
                <div className="relative group">
                  <Briefcase className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <select value={setor} onChange={e => setSetor(e.target.value)} className="w-full pl-10 py-3 bg-white border rounded-xl appearance-none">
                    <option value="">Selecione seu Setor *</option>
                    {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
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
                  <input type="text" placeholder="Usuário (Login) *" value={loginInput} onChange={e => setLoginInput(e.target.value)} className="w-full pl-10 py-3 bg-white border rounded-xl" />
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 text-slate-400" size={20} />
                  <input type="password" placeholder="Senha *" value={senha} onChange={e => setSenha(e.target.value)} className="w-full pl-10 py-3 bg-white border rounded-xl" />
                </div>

                {senha.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex gap-1 h-1.5 mb-2">
                      {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`flex-1 rounded-full ${passwordMetrics.score >= s ? "bg-green-500" : "bg-slate-200"}`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PasswordCheck label="8+ caracteres" met={passwordMetrics.minChar} />
                      <PasswordCheck label="Maiuscula" met={passwordMetrics.hasUpper} />
                      <PasswordCheck label="Numero" met={passwordMetrics.hasNumber} />
                      <PasswordCheck label="Simbolo" met={passwordMetrics.hasSpecial} />
                      <PasswordCheck label="8+ Car" met={passwordMetrics.minChar} />
                      <PasswordCheck label="Maiúscula" met={passwordMetrics.hasUpper} />
                      <PasswordCheck label="Número" met={passwordMetrics.hasNumber} />
                      <PasswordCheck label="Símbolo" met={passwordMetrics.hasSpecial} />
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
              {loading ? <Loader2 className="animate-spin" size={22} /> : (isCadastro ? "Solicitar Cadastro" : "Entrar no Sistema")}
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
                  placeholder="Usuario ou e-mail"
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
                Enviar redefinicao
              </button>
            </form>
          )}

          {showEmailFix && !isCadastro && (
            <form onSubmit={handleCorrigirEmail} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="font-semibold text-slate-900">Corrigir e-mail de acesso</h2>
              <p className="text-sm text-slate-500">
                Use sua senha atual para trocar o e-mail provisorio do Supabase pelo e-mail correto de trabalho.
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
              {isCadastro ? "Ja possui cadastro?" : "Nao tem uma conta?"}{" "}
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
          <div className="mt-8 text-center">
            <p className="text-slate-600">
              {isCadastro ? "Já possui cadastro?" : "Não tem uma conta?"}{" "}
              <button onClick={() => { setIsCadastro(!isCadastro); resetForm(); }} className="text-blue-600 font-bold hover:underline">
                {isCadastro ? "Fazer Login" : "Cadastre-se aqui"}
              </button>
            </p>
          </div>

          <div className="text-center mt-6">
          <div className="text-center mt-8">
            <p className="text-xs text-slate-400">© {new Date().getFullYear()} PORTAL INOVE</p>
          </div>
        </div>
      </div>
    </div>
  );
}
