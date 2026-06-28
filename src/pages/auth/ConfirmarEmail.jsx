import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, ShieldCheck, LogOut, MailCheck, RefreshCw } from "lucide-react";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail } from "../../utils/authBridge";

const AZUL = "#0057b8";

export default function ConfirmarEmail() {
  const navigate = useNavigate();
  const { refreshUser, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [checando, setChecando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleEnviar(event) {
    event.preventDefault();
    setFeedback(null);

    const limpo = email.trim().toLowerCase();
    if (!isValidEmail(limpo) || limpo.endsWith("@inove.local")) {
      setFeedback({ type: "error", text: "Informe um e-mail real e valido (ex.: nome@empresa.com)." });
      return;
    }

    setLoading(true);
    try {
      // 1) e-mail nao pode repetir
      const { data: disponivel, error: chkErr } = await supabase.rpc("email_disponivel", { p_email: limpo });
      if (chkErr) throw chkErr;
      if (disponivel === false) {
        setFeedback({ type: "error", text: "Esse e-mail ja esta sendo usado por outro usuario." });
        setLoading(false);
        return;
      }

      // 2) dispara a confirmacao (o e-mail so passa a valer DEPOIS do clique)
      const { error: upErr } = await supabase.auth.updateUser({ email: limpo });
      if (upErr) {
        const msg = String(upErr.message || "");
        if (/already|registered|exists/i.test(msg)) {
          setFeedback({ type: "error", text: "Esse e-mail ja esta sendo usado por outro usuario." });
        } else {
          setFeedback({ type: "error", text: "Nao foi possivel enviar a confirmacao: " + msg });
        }
        setLoading(false);
        return;
      }

      setEnviado(true);
    } catch (e) {
      setFeedback({ type: "error", text: e?.message || "Erro ao enviar a confirmacao." });
    } finally {
      setLoading(false);
    }
  }

  async function handleJaConfirmei() {
    setChecando(true);
    setFeedback(null);
    try {
      const updated = await refreshUser();
      if (updated && !updated.precisa_email_real) {
        navigate("/", { replace: true });
      } else {
        setFeedback({ type: "warn", text: "Ainda nao identificamos a confirmacao. Abra o link no seu e-mail e tente de novo." });
      }
    } finally {
      setChecando(false);
    }
  }

  const fieldCls =
    "w-full rounded-xl border border-slate-300 pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-[#0057b8] focus:ring-4 focus:ring-[#0057b8]/10";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        {!enviado ? (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white" style={{ backgroundColor: AZUL }}>
                <Mail size={26} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Confirme seu e-mail</h1>
              <p className="mt-2 text-sm text-slate-500">
                Para acessar o sistema, cadastre seu <b>e-mail real</b> e confirme pelo link que
                vamos enviar. Ele garante a recuperacao da sua senha.
              </p>
            </div>

            {feedback && (
              <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${feedback.type === "warn" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                {feedback.text}
              </div>
            )}

            <form onSubmit={handleEnviar} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className={fieldCls}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-70"
                style={{ backgroundColor: AZUL }}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                Enviar link de confirmacao
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
                <MailCheck size={26} />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Confirme no seu e-mail</h1>
              <p className="mt-2 text-sm text-slate-500">
                Enviamos um link para <b>{email.trim().toLowerCase()}</b>. Abra o e-mail e clique no
                link para confirmar. Depois, volte aqui e clique em "Ja confirmei".
              </p>
            </div>

            {feedback && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {feedback.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleJaConfirmei}
              disabled={checando}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-70"
              style={{ backgroundColor: AZUL }}
            >
              {checando ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Ja confirmei — entrar
            </button>

            <button
              type="button"
              onClick={() => { setEnviado(false); setFeedback(null); }}
              className="mt-3 w-full text-sm font-semibold text-slate-500 hover:text-slate-800"
            >
              Usar outro e-mail
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-400 hover:text-slate-700"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}
