import { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { FaClipboardList, FaTools, FaSignOutAlt, FaLock } from "react-icons/fa";

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

// Detecta se a pessoa tem qualquer indicio de acesso a um modulo PCM
function hasMobileFallback(user) {
  try {
    const nivel = String(user?.nivel || "").toLowerCase();
    if (["manutencao", "manutenção", "gestor", "administrador", "admin"].some((n) => nivel.includes(n))) {
      return true;
    }
    const paginas = Array.isArray(user?.paginas_liberadas) ? user.paginas_liberadas : [];
    if (paginas.some((p) => String(p).startsWith("pcm_"))) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export default function MobileHome() {
  const { user, logout } = useContext(AuthContext) || {};
  let profileMap = {};
  let accessLoading = false;
  try {
    const acc = useAccessGovernance();
    profileMap = acc?.profileMap || {};
    accessLoading = !!acc?.loading;
  } catch {
    /* ignore: provider missing */
  }

  const liberacoes = useMemo(() => {
    return MOBILE_MODULES.map((m) => {
      let liberado = false;
      try {
        liberado = canUserAccessPageKey(user, m.key, profileMap);
      } catch {
        liberado = false;
      }
      return { ...m, liberado };
    });
  }, [user, profileMap]);

  const fallback = useMemo(() => hasMobileFallback(user), [user]);
  const algumLiberado = liberacoes.some((m) => m.liberado);
  const usarFallback = !algumLiberado && fallback;

  const nivelLabel = user?.nivel || "(sem nivel)";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-6">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">INOVE Quatai</div>
            <h1 className="text-2xl font-black text-slate-900">Ola, {user?.nome || user?.login || "Operador"}</h1>
            <p className="text-sm text-slate-500">
              Nivel: <strong className="text-slate-700">{nivelLabel}</strong>
              {accessLoading ? " · carregando permissoes..." : ""}
            </p>
          </div>
          {logout ? (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <FaSignOutAlt /> Sair
            </button>
          ) : null}
        </header>

        <p className="text-sm text-slate-500">Escolha um modulo para comecar.</p>

        <div className="grid grid-cols-1 gap-4">
          {liberacoes.map((m) => {
            const ativo = m.liberado || usarFallback;
            if (ativo) {
              return (
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
              );
            }
            return (
              <div
                key={m.key}
                className="group relative overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-6 text-slate-500"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl bg-slate-100 p-4 text-3xl text-slate-400">{m.icon}</div>
                  <div className="flex-1">
                    <div className="text-lg font-black text-slate-700">{m.title}</div>
                    <div className="mt-1 text-sm">{m.description}</div>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                      <FaLock /> Sem permissao para este nivel
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!algumLiberado && !usarFallback ? (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong className="block text-sm">Sem permissoes para os modulos do app.</strong>
            Peca ao gestor para liberar <em>Troca de pneus</em> ou <em>Controle de fichas</em> no nivel <strong>{nivelLabel}</strong>.
          </div>
        ) : null}

        {usarFallback ? (
          <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-[11px] text-blue-800">
            Modo permissivo: seu nivel ({nivelLabel}) costuma usar PCM, entao liberamos os modulos no app. Se algo nao abrir, peca ao gestor para revisar as paginas do nivel.
          </div>
        ) : null}
      </div>
    </div>
  );
}
