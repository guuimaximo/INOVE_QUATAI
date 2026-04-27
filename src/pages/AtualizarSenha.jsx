import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "../supabase";

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,}$/;

export default function AtualizarSenha() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const rules = useMemo(
    () => [
      { label: "8 caracteres ou mais", ok: password.length >= 8 },
      { label: "Uma letra maiuscula", ok: /[A-Z]/.test(password) },
      { label: "Um numero", ok: /\d/.test(password) },
      {
        label: "Um simbolo",
        ok: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password),
      },
    ],
    [password]
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;
      setHasRecoverySession(!!session?.user);
      setReady(true);
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setHasRecoverySession(!!session?.user);
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (!hasRecoverySession) {
      setFeedback({ type: "error", text: "Abra novamente o link de redefinicao enviado pelo e-mail." });
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setFeedback({
        type: "error",
        text: "A nova senha precisa ter no minimo 8 caracteres, com maiuscula, numero e simbolo.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ type: "error", text: "A confirmacao da senha nao confere." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setLoading(false);
      setFeedback({ type: "error", text: error.message || "Nao foi possivel atualizar a senha." });
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    setFeedback({
      type: "success",
      text: "Senha atualizada com sucesso. Faca login novamente com a nova senha.",
    });

    window.setTimeout(() => navigate("/login", { replace: true }), 1500);
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600">
        Preparando recuperacao de senha...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Definir nova senha</h1>
          <p className="text-sm text-slate-500 mt-2">
            Use uma senha forte para concluir sua recuperacao de acesso.
          </p>
        </div>

        {!hasRecoverySession ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              O link de recuperacao nao esta ativo nesta sessao. Solicite um novo e-mail de redefinicao.
            </div>
            <Link
              to="/login"
              className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-white font-semibold hover:bg-blue-700"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="Nova senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                autoComplete="new-password"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                autoComplete="new-password"
              />
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              {rules.map((rule) => (
                <div key={rule.label} className={rule.ok ? "text-green-600" : "text-slate-500"}>
                  {rule.ok ? "OK" : "-"} {rule.label}
                </div>
              ))}
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

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
