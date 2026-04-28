import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, User, Briefcase, LogIn, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";
import { isPlaceholderEmail, isValidEmail } from "../../utils/authBridge";

const SETORES = [
  "Manutencao",
  "Recursos humanos",
  "Departamento Pessoal",
  "SESMT",
  "Operacao",
  "Ouvidoria",
  "Financeiro",
];

export default function AtualizarPerfil() {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [setor, setSetor] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setNome(user?.nome || "");
    setLogin(user?.login || "");
    setEmail(user?.email || "");
    setSetor(user?.setor || "");
  }, [user]);

  const reasonsText = useMemo(() => {
    const reasons = user?.profile_review_reasons || [];
    if (!reasons.length) return "Seu perfil precisa ser conferido antes de entrar no sistema.";

    if (reasons.includes("email")) {
      return "Precisamos corrigir seu e-mail para concluir a migracao do login e liberar o acesso normal.";
    }

    return "Encontramos dados incompletos ou desatualizados no seu perfil. Revise e confirme abaixo para continuar.";
  }, [user?.profile_review_reasons]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    const payload = {
      p_nome: String(nome || "").trim(),
      p_login: String(login || "").trim(),
      p_setor: String(setor || "").trim(),
      p_email: String(email || "").trim().toLowerCase(),
    };

    if (!payload.p_nome || !payload.p_login || !payload.p_setor || !payload.p_email) {
      setFeedback({ type: "error", text: "Preencha nome, apelido, e-mail e setor para continuar." });
      return;
    }

    if (!isValidEmail(payload.p_email)) {
      setFeedback({ type: "error", text: "Informe um e-mail valido para concluir a atualizacao." });
      return;
    }

    setLoading(true);

    const { error: syncError } = await supabase.rpc("sync_profile_after_review", payload);

    if (syncError) {
      setLoading(false);
      setFeedback({
        type: "error",
        text: syncError.message || "Nao foi possivel atualizar o perfil. Verifique a migration do Supabase.",
      });
      return;
    }

    const authPayload = {
      data: {
        nome: payload.p_nome,
        login: payload.p_login,
        setor: payload.p_setor,
      },
    };

    const currentEmail = String(user?.email || "").trim().toLowerCase();
    if (payload.p_email !== currentEmail) {
      authPayload.email = payload.p_email;
    }

    const { error: authError } = await supabase.auth.updateUser(authPayload);

    if (authError) {
      setLoading(false);
      setFeedback({
        type: "error",
        text: authError.message || "Os dados base foram salvos, mas falhou a atualizacao do Auth.",
      });
      return;
    }

    const updatedUser = await refreshUser();
    setLoading(false);

    if (updatedUser?.requires_profile_review) {
      const emailStillPending =
        updatedUser.profile_review_reasons?.includes("email") || isPlaceholderEmail(updatedUser?.email || "");

      setFeedback({
        type: "error",
        text: emailStillPending
          ? "Os dados foram salvos, mas o novo e-mail ainda precisa ser confirmado no Auth para liberar seu acesso."
          : "O perfil ainda ficou pendente de revisao. Verifique os dados salvos no banco.",
      });
      return;
    }

    setFeedback({ type: "success", text: "Perfil atualizado com sucesso. Redirecionando..." });
    window.setTimeout(() => navigate("/inove", { replace: true }), 900);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-xl p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Atualize seu perfil</h1>
          <p className="text-slate-500 mt-2">{reasonsText}</p>
        </div>

        {feedback && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm ${
              feedback.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="relative">
            <LogIn className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Apelido"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <input
              type="email"
              placeholder="E-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <div className="relative">
            <Briefcase className="absolute left-3 top-3.5 text-slate-400" size={18} />
            <select
              value={setor}
              onChange={(event) => setSetor(event.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            >
              <option value="">Selecione seu setor</option>
              {SETORES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-70"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar e continuar
            </button>

            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
