import { useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import { FaBoxes, FaClipboardList, FaTools, FaSignOutAlt, FaMicrochip } from "react-icons/fa";

import { AuthContext } from "../../context/AuthContext";
import { useAccessGovernance } from "../../context/AccessContext";
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

export default function MobileHome() {
  const { user, logout } = useContext(AuthContext) || {};
  let accessLoading = false;
  try {
    const acc = useAccessGovernance();
    accessLoading = !!acc?.loading;
  } catch {
    /* ignore: provider missing */
  }

  const nivelNorm = normalizeAccessText(user?.nivel);
  const isAdmin = nivelNorm === "administrador" || nivelNorm === "admin";

  const liberacoes = useMemo(() => {
    return MOBILE_MODULES.map((m) => {
      // No mobile a regra e simples: o admin libera no toggle do modal.
      // Administrador ve tudo automaticamente.
      const recursoMobile = m.appResourceKey ? canUseAppResource(user, m.appResourceKey) : false;
      const liberado = isAdmin || recursoMobile;
      return { ...m, recursoMobile, liberado };
    });
  }, [user, isAdmin]);

  const algumLiberado = liberacoes.some((m) => m.liberado);
  const fallbackAtivo = liberacoes.some((m) => m.fallbackLiberado && !m.permissaoPerfil);

  const nivelLabel = user?.nivel || "(sem nivel)";

  // Pega primeiro nome para nao ficar gigante no celular.
  const fullName = user?.nome || user?.login || "Operador";
  const firstName = String(fullName).split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-3 py-3">
      <div className="mx-auto max-w-md space-y-3">
        <header className="rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
          <h1 className="text-base font-extrabold text-slate-900">
            Olá, {firstName}
          </h1>
          <p className="text-[11px] text-slate-500">
            Nível: <strong className="text-slate-700">{nivelLabel}</strong>
            {accessLoading ? " · carregando..." : ""}
          </p>
        </header>

        <p className="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
          Escolha um modulo
        </p>

        <div className="grid grid-cols-1 gap-2.5">
          {liberacoes.filter((m) => m.liberado).map((m) => (
            <Link
              key={m.key}
              to={m.path}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${m.gradient} px-3 py-3 text-white shadow active:scale-[0.98] transition-transform`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-lg">
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black leading-tight">{m.title}</div>
                  <div className="mt-0.5 text-[11px] text-white/85 line-clamp-2 leading-snug">
                    {m.description}
                  </div>
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

        {logout ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={logout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-sm transition active:scale-[0.99]"
            >
              <FaSignOutAlt /> Sair do INOVE
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
