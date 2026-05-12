import { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  FaCarCrash,
  FaClipboardCheck,
  FaClipboardList,
  FaCog,
  FaGasPump,
  FaHome,
  FaMapMarkedAlt,
  FaMicrochip,
  FaSignOutAlt,
  FaTools,
  FaWarehouse,
} from "react-icons/fa";

import Sidebar from "./Sidebar";
import { AuthContext } from "../context/AuthContext";
import { useAccessGovernance } from "../context/AccessContext";
import { getMobileNavItems } from "../utils/mobileNavigation";

function getPageTitle(pathname) {
  if (pathname === "/" || pathname === "/inove") return "Inicio";
  if (pathname.startsWith("/painel")) return "Painel";
  if (pathname.startsWith("/inicio-rapido")) return "Inicio";
  if (pathname.startsWith("/estoque-diesel")) return "Estoque de Diesel";
  if (pathname.startsWith("/desempenho")) return "Diesel";
  if (pathname.startsWith("/embarcados")) return "Embarcados";
  if (pathname.startsWith("/pcm-troca-pneus")) return "Troca de pneus";
  if (pathname.startsWith("/pcm")) return "PCM";
  if (pathname.startsWith("/central") || pathname.startsWith("/tratativas")) return "Tratativas";
  if (pathname.startsWith("/sos") || pathname.startsWith("/km-rodado")) return "Intervencoes";
  if (pathname.startsWith("/checklists")) return "Checklists";
  if (pathname.startsWith("/avarias") || pathname.startsWith("/cobrancas")) return "Avarias";
  if (pathname.startsWith("/funcionarios") || pathname.startsWith("/organograma-manutencao")) return "Pessoas";
  if (pathname.startsWith("/usuarios") || pathname.startsWith("/niveis-acesso")) return "Configuracoes";
  return "Inove";
}

function getIconForNav(key) {
  const normalizedKey = String(key || "").toLowerCase();
  if (normalizedKey.includes("estoque")) return FaWarehouse;
  if (normalizedKey.includes("diesel")) return FaGasPump;

  switch (key) {
    case "pcm":
      return FaClipboardList;
    case "troca":
      return FaClipboardList;
    case "auditoria":
      return FaClipboardCheck;
    case "estoque":
      return FaWarehouse;
    case "tratativas":
      return FaClipboardList;
    case "avarias":
    case "cobrancas":
    case "reparos":
      return FaCarCrash;
    case "sos":
      return FaTools;
    case "diesel":
      return FaGasPump;
    case "embarcados":
      return FaMicrochip;
    case "km":
      return FaMapMarkedAlt;
    default:
      return FaHome;
  }
}

function MobileBottomNav({ items, onOpenMenu, currentPath }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
      <div className={`grid gap-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)] ${onOpenMenu ? "grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-1"}`}>
        {items.map((item) => {
          const Icon = getIconForNav(item.key);
          const isActive = currentPath === item.path;

          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 text-[10px] font-medium transition ${
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="mb-1 text-base" />
              <span className="text-center leading-tight">{item.label}</span>
            </NavLink>
          );
        })}

        {onOpenMenu ? (
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex min-h-[56px] flex-col items-center justify-center rounded-2xl px-2 py-1.5 text-[10px] font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <FaCog className="mb-1 text-base" />
            <span className="text-center leading-tight">Menu</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { profileMap } = useAccessGovernance();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isNativeShell = Capacitor.isNativePlatform();
  const isLockedMobileModule = isNativeShell;

  const pageTitle = getPageTitle(location.pathname);
  const mobileNavItems = useMemo(
    () =>
      isLockedMobileModule
        ? [
            { key: "troca", label: "Troca", path: "/pcm-troca-pneus?aba=troca" },
            { key: "auditoria", label: "Auditoria", path: "/pcm-troca-pneus?aba=auditoria" },
            { key: "estoque", label: "Estoque", path: "/pcm-troca-pneus?aba=estoque" },
          ]
        : getMobileNavItems(user, profileMap).slice(0, 3),
    [isLockedMobileModule, profileMap, user]
  );

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
              Inove mobile
            </p>
            <p className="truncate text-base font-semibold text-slate-900">{pageTitle}</p>
          </div>

          {isLockedMobileModule ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/atualizar-perfil")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Configuracoes"
              >
                <FaCog className="text-base" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Sair"
              >
                <FaSignOutAlt className="text-base" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMobileSidebarOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
              aria-label={mobileSidebarOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileSidebarOpen}
            >
              {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-73px)] lg:min-h-screen">
        <div
          className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity duration-200 lg:hidden ${
            mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />

        <div
          className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] transform overflow-hidden rounded-r-[28px] bg-blue-700 transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-none ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 pb-20 md:px-6 md:py-6 lg:pb-6">
            <Outlet />
          </main>
        </div>
      </div>

      <MobileBottomNav
        items={mobileNavItems}
        currentPath={`${location.pathname}${location.search}`}
        onOpenMenu={isLockedMobileModule ? undefined : () => setMobileSidebarOpen(true)}
      />
    </div>
  );
}
