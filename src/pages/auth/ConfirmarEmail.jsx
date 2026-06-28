import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail } from "../../utils/authBridge";

const AZUL = "#0057b8";

export default function ConfirmarEmail() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    const limpo = email.trim().toLowerCase();
    if (!isValidEmail(limpo) || limpo.endsWith("@inove.local")) {
      setFeedback({ type: "error", text: "Informe um e-mail real e valido (ex.: nome@empresa.com)." });
      return;
    }

    setLoading(true);
    try {
      // 1) salva o e-mail real na hora (libera o acesso)
      const { data: res, error: rpcErr } = await supabase.rpc("definir_email_real", { p_email: limpo });
      if (rpcErr) throw rpcErr;
      if (res && res.ok === false) {
        setFeedback({ type: "error", text: res.erro || "Nao foi possivel salvar o e-mail." });
        setLoading(false);
        return;
      }

      // 2) dispara a confirmacao no Auth (link no e-mail) — em paralelo, nao bloqueia
      try {
        await supabase.auth.updateUser({ email: limpo });
      } catch (e) {
        console.warn("Falha ao disparar confirmacao de e-mail:", e);
      }

      // 3) atualiza o usuario e entra
      await refreshUser();
      navigate("/", { replace: true });
    } catch (e) {
      setFeedback({ type: "error", text: e?.message || "Erro ao salvar o e-mail." });
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
        <div className="text-center mb-6">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: AZUL }}
          >
            <Mail size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Confirme seu e-mail</h1>
          <p className="mt-2 text-sm text-slate-500">
            Para continuar, cadastre seu <b>e-mail real</b>. Ele é necessário para você
            recuperar a senha sozinho quando precisar.
          </p>
        </div>

        {feedback && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
              className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-3 text-sm outline-none transition-all focus:border-[#0057b8] focus:ring-4 focus:ring-[#0057b8]/10"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-70"
            style={{ backgroundColor: AZUL }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
            Salvar e continuar
          </button>
        </form>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
          Vamos enviar um link de confirmação para esse e-mail. Você já pode usar o sistema;
          confirme o link quando puder para liberar a recuperação de senha.
        </div>

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800"
        >
          <LogOut size={16} /> Sair
        </button>
      </div>
    </div>
  );
}
