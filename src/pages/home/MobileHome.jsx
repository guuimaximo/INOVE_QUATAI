import { useContext, useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import { FaClipboardList, FaTools, FaSignOutAlt } from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPageKey } from "../../utils/access";

const MOBILE_MODULES = [
  {
    key: "pcm_troca_pneus",
    title: "Troca de pneus",
    description: "Audite, troque, gerencie estoque e envie para conserto.",
    path: "/pcm-troca-pneus",
    icon: <FaTools />,
    gradient: "from-blue-600 to-blue-800",
  },
  {
    key: "pcm_controle_fichas",
    title: "Controle de fichas",
    description: "Entregue fichas para o supervisor e acompanhe ate o Transnet.",
    path: "/pcm-controle-fichas",
    icon: <FaClipboardList />,
    gradient: "from-amber-500 to-amber-700",
  },
];

export default function MobileHome() {
  const { user, logout } = useContext(AuthContext) || {};
  const { profileMap } = useAccessGovernance();

  const liberados = useMemo(
    () => MOBILE_MODULES.filter((m) => canUserAccessPageKey(user, m.key, profileMap)),
    [user, profileMap]
  );

  if (liberados.length === 1) {
    return <Navigate to={liberados[0].path} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">INOVE Quatai</div>
          <h1 className="text-2xl font-black text-slate-900">Ola, {user?.nome || user?.login || "Operador"}</h1>
          <p className="text-sm text-slate-500">Escolha um modulo para comecar.</p>
        </header>

        {liberados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <div className="text-base font-bold text-slate-800">Sem modulos liberados</div>
            <p className="mt-2 text-sm text-slate-500">
              Voce ainda nao tem permissao para usar nenhum modulo no app. Procure o gestor para liberar o acesso.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {liberados.map((m) => (
              <Link
                key={m.key}
                to={m.path}
                className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${m.gradient} px-5 py-6 text-white shadow-lg transition-transform active:scale-[0.98]`}
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-white/15 p-4 text-3xl">{m.icon}</div>
                  <div className="flex-1">
                    <div className="text-lg font-black">{m.title}</div>
                    <div className="mt-1 text-sm text-white/85">{m.description}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {logout ? (
          <button
            type="button"
            onClick={logout}
            className="mx-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FaSignOutAlt /> Sair
          </button>
        ) : null}
      </div>
    </div>
  );
}
