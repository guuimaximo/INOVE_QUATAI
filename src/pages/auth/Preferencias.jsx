import { useNavigate } from "react-router-dom";
import { Palette, Check, UserCog, ChevronRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";

export default function Preferencias() {
  const navigate = useNavigate();
  const { themeKey, setThemeKey, themes } = useTheme();
  const { user } = useAuth();

  const card = "bg-white rounded-2xl border border-slate-200 shadow-sm";

  return (
    <div className="min-h-full bg-slate-100 p-4 lg:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-slate-900">Preferências</h1>
          <p className="text-sm text-slate-500">Personalize sua conta e a aparência do sistema.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/meu-perfil")}
          className={`${card} mb-4 flex w-full items-center gap-3 p-5 text-left transition hover:border-blue-300`}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <UserCog size={20} />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-slate-900">Meu perfil</span>
            <span className="block text-xs text-slate-500">Nome, apelido, e-mail, foto e senha</span>
          </span>
          <ChevronRight size={18} className="text-slate-400" />
        </button>

        <div className={`${card} p-5`}>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-blue-700">
            <Palette size={16} /> Cor do sistema
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Escolha a cor principal (menu e destaques). Aplica na hora e fica salva neste aparelho.
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {themes.map((t) => {
              const selected = t.key === themeKey;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setThemeKey(t.key)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    selected ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: t.sidebar }}
                  >
                    {selected ? <Check size={18} /> : null}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          {user?.nome ? `Sessão de ${user.nome.split(" ")[0]}` : ""}
        </p>
      </div>
    </div>
  );
}
