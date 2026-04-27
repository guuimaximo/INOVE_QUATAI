import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, User, Briefcase, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase";
import { useAuth } from "../../context/AuthContext";

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
  const [setor, setSetor] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setNome(user?.nome || "");
    setLogin(user?.login || "");
    setSetor(user?.setor || "");
  }, [user]);

  const reasonsText = useMemo(() => {
    const reasons = user?.profile_review_reasons || [];
    if (!reasons.length) return "Seu perfil precisa ser conferido antes de entrar no sistema.";
    return "Encontramos dados incompletos ou desatualizados no seu perfil. Revise e confirme abaixo para continuar.";
  }, [user?.profile_review_reasons]);

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    const payload = {
      p_nome: String(nome || "").trim(),
      p_login: String(login || "").trim(),
      p_setor: String(setor || "").trim(),
    };

    if (!payload.p_nome || !payload.p_login || !payload.p_setor) {
      setFeedback({ type: "error", text: "Preencha nome, login e setor para continuar." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.rpc("sync_profile_after_review", payload);

    if (error) {
      setLoading(false);
      setFeedback({
        type: "error",
        text: error.message || "Nao foi possivel atualizar o perfil. Verifique a migration do Supabase.",
      });
      return;
    }

    const updatedUser = await refreshUser();
    setLoading(false);

    if (updatedUser?.requires_profile_review) {
      setFeedback({
        type: "error",
        text: "O perfil ainda ficou pendente de revisao. Verifique os dados salvos no banco.",
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
              placeholder="Login"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
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
