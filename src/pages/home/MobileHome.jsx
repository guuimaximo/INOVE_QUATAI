import { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { FaBoxes, FaClipboardList, FaTools, FaSignOutAlt, FaMicrochip } from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
import { canUserAccessPageKey } from "../../utils/access";
import { canUseAppResource } from "../../utils/appResources";

const MOBILE_MODULES = [
  {
    key: "pcm_troca_pneus",
    appResourceKey: "app.pneus.abrir",
    title: "Troca de pneus",
    description: "Audite, troque, gerencie estoque e envie para conserto.",
    path: "/pcm-troca-pneus",
    icon: <FaTools />,
    gradient: "from-blue-600 to-blue-800",
  },
  {
    key: "pcm_controle_fichas",
    appResourceKey: "app.fichas.abrir",
    title: "Controle de fichas",
    description: "Entregue fichas para o supervisor e acompanhe ate o Transnet.",
    path: "/pcm-controle-fichas",
    icon: <FaClipboardList />,
    gradient: "from-amber-500 to-amber-700",
  },
  {
    key: "embarcados_central",
    appResourceKey: "app.embarcados.abrir",
    title: "Embarcados",
    description: "Central, movimentacoes e reparos dos equipamentos embarcados.",
    path: "/embarcados-central",
    icon: <FaMicrochip />,
    gradient: "from-slate-700 to-slate-900",
  },
  {
    key: "suprimentos_contagem",
    appResourceKey: "app.contagem.iniciar",
    title: "Contagem",
    description: "Conte itens, confira lotes e acompanhe apontamentos.",
    path: "/suprimentos/contagem",
    icon: <FaBoxes />,
    gradient: "from-emerald-600 to-teal-800",
  },
];

function normalizeAccessText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function userPages(user) {
  return Array.isArray(user?.paginas_liberadas) ? user.paginas_liberadas.map((p) => String(p)) : [];
}

function hasModuleFallback(user, moduleKey) {
  try {
    const nivel = normalizeAccessText(user?.nivel);
    const paginas = userPages(user);
    const isGestao = ["gestor", "administrador", "admin"].some((n) => nivel.includes(n));

    if (isGestao) {
      return true;
    }

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
      let permissaoPerfil = false;
      try {
        permissaoPerfil = canUserAccessPageKey(user, m.key, profileMap);
      } catch {
        permissaoPerfil = false;
      }
      const fallbackLiberado = hasModuleFallback(user, m.key);
      const recursoMobile = m.appResourceKey ? canUseAppResource(user, m.appResourceKey) : false;
      // O modulo aparece quando o usuario tem permissao na pagina (web/perfil)
      // OU quando o admin liberou o recurso mobile especifico para ele.
      const liberado = permissaoPerfil || fallbackLiberado || recursoMobile;
      return { ...m, permissaoPerfil, fallbackLiberado, recursoMobile, liberado };
    });
  }, [user, profileMap]);

  const algumLiberado = liberacoes.some((m) => m.liberado);
  const fallbackAtivo = liberacoes.some((m) => m.fallbackLiberado && !m.permissaoPerfil);

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
          {liberacoes.filter((m) => m.liberado).map((m) => (
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

        {!algumLiberado ? (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong className="block text-sm">Sem permissoes para os modulos do app.</strong>
            Peca ao gestor para liberar <em>Troca de pneus</em>, <em>Controle de fichas</em>, <em>Embarcados</em> ou <em>Contagem</em> no nivel <strong>{nivelLabel}</strong>.
          </div>
        ) : null}

        {fallbackAtivo ? (
          <div className="rounded-2xl border border-dashed border-blue-300 bg-blue-50 px-4 py-3 text-[11px] text-blue-800">
            Modo permissivo: liberamos os modulos compativeis com seu nivel ({nivelLabel}) no app. Se algo nao abrir, peca ao gestor para revisar as paginas do nivel.
          </div>
        ) : null}
      </div>
    </div>
  );
}
