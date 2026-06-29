import { useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ChevronLeft, ChevronRight, Search, ChevronDown, LogOut, User as UserIcon, Palette } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import {
  FaBarcode,
  FaCalendarAlt,
  FaCalendarDay,
  FaCarCrash,
  FaBoxes,
  FaClipboardCheck,
  FaClipboardList,
  FaCog,
  FaExchangeAlt,
  FaExclamationTriangle,
  FaGasPump,
  FaHome,
  FaMapMarkedAlt,
  FaMicrochip,
  FaOilCan,
  FaSignOutAlt,
  FaThLarge,
  FaTools,
  FaWarehouse,
} from "react-icons/fa";

import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";
import { useMobileTabBadges } from "../context/MobileTabBadgesContext";
import { AuthContext } from "../context/AuthContext";
import { useAccessGovernance } from "../context/AccessContext";
import { canUserSeeFarol } from "../utils/access";
import { getMobileNavItems } from "../utils/mobileNavigation";

const FAROL_URL = "https://faroldemetas.onrender.com/?from=inove";

function getPageTitle(pathname) {
  if (pathname === "/" || pathname === "/inove") return "Inicio";
  if (pathname.startsWith("/painel")) return "Painel";
  if (pathname.startsWith("/inicio-rapido")) return "Inicio";
  if (pathname.startsWith("/estoque-diesel")) return "Estoque de Diesel";
  if (pathname.startsWith("/suprimentos/contagem")) return "Contagem";
  if (pathname.startsWith("/desempenho")) return "Diesel";
  if (pathname.startsWith("/embarcados")) return "Embarcados";
  if (pathname.startsWith("/pcm-controle-pneus")) return "Controle de pneus";
  if (pathname.startsWith("/pcm-troca-pneus")) return "Troca de pneus";
  if (pathname.startsWith("/pcm")) return "PCM";
  if (pathname.startsWith("/central") || pathname.startsWith("/tratativas")) return "Tratativas";
  if (pathname.startsWith("/sac")) return "SAC";
  if (pathname.startsWith("/sos") || pathname.startsWith("/km-rodado")) return "Intervencoes";
  if (pathname.startsWith("/checklists")) return "Checklists";
  if (pathname.startsWith("/acidentes")) return "Acidentes";
  if (pathname.startsWith("/avarias") || pathname.startsWith("/cobrancas")) return "Avarias";
  if (pathname.startsWith("/funcionarios")) return "Funcionários";
  if (pathname.startsWith("/ferias")) return "Ferias";
  if (pathname.startsWith("/organograma")) return "Organograma";
  if (pathname.startsWith("/usuarios") || pathname.startsWith("/niveis-acesso")) return "Configuracoes";
  return "Inove";
}

function getIconForNav(key) {
  // Mapeamento explicito por chave (vem antes do match por substring)
  switch (key) {
    case "contagem":
      return FaBarcode;
    case "diaria":
      return FaCalendarDay;
    case "semanal":
      return FaCalendarAlt;
    case "lubrificantes":
      return FaOilCan;
    case "menu":
      return FaThLarge;
    case "pcm":
    case "troca":
      return FaClipboardList;
    case "auditoria":
      return FaClipboardCheck;
    case "estoque":
      return FaWarehouse;
    case "conserto":
      return FaTools;
    case "riscado":
      return FaExclamationTriangle;
    case "tratativas":
    case "sac":
      return FaClipboardList;
    case "avarias":
    case "acidentes":
    case "cobrancas":
    case "reparos":
      return FaCarCrash;
    case "sos":
      return FaTools;
    case "diesel":
      return FaGasPump;
    case "embarcados":
      return FaMicrochip;
    case "embarcados_mov":
      return FaExchangeAlt;
    case "km":
      return FaMapMarkedAlt;
    default:
      break;
  }

  const normalizedKey = String(key || "").toLowerCase();
  if (normalizedKey.includes("estoque")) return FaWarehouse;
  if (normalizedKey.includes("contagem")) return FaBoxes;
  if (normalizedKey.includes("diesel")) return FaGasPump;
  return FaHome;
}

function MobileBottomNav({ items, onOpenMenu, currentPath }) {
  const totalColumns = items.length + (onOpenMenu ? 1 : 0);
  if (totalColumns === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-2 pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur lg:hidden">
      <div
        className="grid gap-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.35rem)]"
        style={{ gridTemplateColumns: `repeat(${Math.max(totalColumns, 1)}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = getIconForNav(item.key);
          const isActive = currentPath === item.path;
          const badge = Number(item.badge || 0);

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
              <span className="relative mb-1 inline-flex">
                <Icon className="text-base" />
                {badge > 0 ? (
                  <span className="absolute -right-2.5 -top-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </span>
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
  const { badges } = useMobileTabBadges();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => {
    try {
      return localStorage.getItem("inove_sidebar_open") !== "false";
    } catch {
      return true;
    }
  });
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [farolTab, setFarolTab] = useState("inove"); // "inove" | "farol"

  useEffect(() => {
    try {
      localStorage.setItem("inove_sidebar_open", desktopSidebarOpen ? "true" : "false");
    } catch {
      // sem storage: estado vive so na sessao
    }
  }, [desktopSidebarOpen]);
  const [farolMounted, setFarolMounted] = useState(false);
  const podeVerFarol = useMemo(() => canUserSeeFarol(user, profileMap), [user, profileMap]);
  useEffect(() => {
    if (farolTab === "farol" && !farolMounted) setFarolMounted(true);
  }, [farolTab, farolMounted]);

  // Permite que outros componentes (ex.: botão "Ir para Farol" na sidebar) e
  // o próprio Farol embarcado peçam pra trocar de aba.
  useEffect(() => {
    if (!podeVerFarol) return;
    const onSwitchToFarol = () => {
      setFarolMounted(true);
      setFarolTab("farol");
      setMobileSidebarOpen(false);
    };
    const onSwitchToInove = () => setFarolTab("inove");
    const onMessage = (ev) => {
      const data = ev?.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "farol:switch-to-inove") setFarolTab("inove");
      if (data.type === "inove:switch-to-farol") {
        setFarolMounted(true);
        setFarolTab("farol");
      }
    };
    window.addEventListener("inove:switch-to-farol", onSwitchToFarol);
    window.addEventListener("inove:switch-to-inove", onSwitchToInove);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("inove:switch-to-farol", onSwitchToFarol);
      window.removeEventListener("inove:switch-to-inove", onSwitchToInove);
      window.removeEventListener("message", onMessage);
    };
  }, [podeVerFarol]);
  const isNativeShell = Capacitor.isNativePlatform();
  const isInTrocaPneus = location.pathname === "/pcm-troca-pneus";
  const isInControleFichas = location.pathname === "/pcm-controle-fichas";
  const isInEmbarcados = location.pathname.startsWith("/embarcados");
  const isInContagem = location.pathname.startsWith("/suprimentos/contagem");
  const isLockedMobileModule =
    isNativeShell && (isInTrocaPneus || isInControleFichas || isInEmbarcados || isInContagem);

  const pageTitle = getPageTitle(location.pathname);
  const mobileNavItems = useMemo(() => {
    if (isNativeShell) {
      if (isInTrocaPneus) {
        return [
          { key: "troca", label: "Troca", path: "/pcm-troca-pneus?aba=troca", badge: badges.troca },
          { key: "auditoria", label: "Auditoria", path: "/pcm-troca-pneus?aba=auditoria", badge: badges.auditoria },
          { key: "estoque", label: "Estoque", path: "/pcm-troca-pneus?aba=estoque", badge: badges.estoque },
          { key: "conserto", label: "Conserto", path: "/pcm-troca-pneus?aba=consertos", badge: badges.consertos },
          { key: "riscado", label: "Riscado", path: "/pcm-troca-pneus?aba=riscados", badge: badges.riscados },
        ];
      }
      if (isInControleFichas) {
        return [
          { key: "lancamento", label: "Lancamento", path: "/pcm-controle-fichas?aba=lancamento", badge: badges.lancamento },
          { key: "supervisor", label: "Supervisor", path: "/pcm-controle-fichas?aba=supervisor", badge: badges.supervisor },
          { key: "pcm", label: "PCM", path: "/pcm-controle-fichas?aba=pcm", badge: badges.pcm },
        ];
      }
      if (isInEmbarcados) {
        return [
          { key: "embarcados", label: "Central", path: "/embarcados-central" },
          { key: "embarcados_mov", label: "Movimentacoes", path: "/embarcados-movimentacoes" },
          { key: "reparos", label: "Reparos", path: "/embarcados-reparos" },
        ];
      }
      if (isInContagem) {
        return [
          { key: "contagem", label: "Contagem", path: "/suprimentos/contagem?aba=contagem" },
          { key: "diaria", label: "Diaria", path: "/suprimentos/contagem?aba=diaria" },
          { key: "semanal", label: "Semanal", path: "/suprimentos/contagem?aba=semanal" },
          { key: "lubrificantes", label: "Lubrificantes", path: "/suprimentos/contagem?aba=lubrificantes" },
          { key: "menu", label: "Menu", path: "/" },
        ];
      }
      return [];
    }
    return getMobileNavItems(user, profileMap).slice(0, 3);
  }, [isNativeShell, isInTrocaPneus, isInControleFichas, isInEmbarcados, isInContagem, profileMap, user, badges]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const userInitials = (user?.nome || "U")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const onFarolTab = podeVerFarol && !isNativeShell && farolTab === "farol";
  return (
    <div className={`bg-slate-50 min-h-screen ${onFarolTab ? "overflow-hidden h-screen" : ""}`}>
      <div
        className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center justify-between px-4 py-2.5">
          <button
            type="button"
            onClick={() => navigate(isNativeShell ? "/" : "/inove")}
            className="min-w-0 text-left"
            aria-label="Menu inicial"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
              Inove mobile
            </p>
            <p className="truncate text-[13px] font-extrabold uppercase tracking-[0.16em] text-slate-900">
              {pageTitle}
            </p>
          </button>

          {isNativeShell ? null : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("inove:open-search"))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label="Buscar tela"
              >
                <Search size={20} />
              </button>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((current) => !current)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm"
                aria-label={mobileSidebarOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={mobileSidebarOpen}
              >
                {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {!isNativeShell && (
        <div
          className={`${onFarolTab ? "fixed top-0 left-0 right-0" : "sticky top-0"} z-40 hidden h-[49px] items-center gap-2 border-b border-slate-200 bg-slate-100/90 px-3 backdrop-blur lg:flex`}
        >
          <button
            type="button"
            onClick={() => setDesktopSidebarOpen((current) => !current)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900"
            aria-label={desktopSidebarOpen ? "Recolher menu" : "Expandir menu"}
            title="Menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 pr-1">
            <div style={{ backgroundColor: "var(--inove-accent, #2563eb)" }} className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white shadow-sm">IN</div>
            {!podeVerFarol && <span className="text-[15px] font-semibold tracking-tight text-slate-800">Inove</span>}
          </div>

          {podeVerFarol && (
            <div className="ml-1 flex items-end gap-1.5 self-stretch">
              <button
                type="button"
                onClick={() => setFarolTab("inove")}
                className={`flex h-[40px] items-center gap-2 rounded-t-xl px-4 text-sm font-medium transition-all ${
                  farolTab === "inove"
                    ? "border border-b-0 border-slate-200 bg-white text-slate-900 shadow-[0_-3px_8px_rgba(15,23,42,0.06)]"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                }`}
              >
                <FaThLarge style={farolTab === "inove" ? { color: "var(--inove-accent, #2563eb)" } : undefined} className={farolTab === "inove" ? "" : "text-slate-400"} />
                Inove
              </button>
              <button
                type="button"
                onClick={() => setFarolTab("farol")}
                className={`flex h-[40px] items-center gap-2 rounded-t-xl px-4 text-sm font-medium transition-all ${
                  farolTab === "farol"
                    ? "border border-b-0 border-slate-200 bg-white text-emerald-700 shadow-[0_-3px_8px_rgba(15,23,42,0.06)]"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-800"
                }`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-black ${farolTab === "farol" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                  FT
                </span>
                Farol Tático
              </button>
            </div>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("inove:open-search"))}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
          >
            <Search size={16} /> <span className="text-slate-500">Buscar...</span>
            <span className="ml-2 rounded border border-slate-200 bg-slate-50 px-1.5 text-[11px] text-slate-400">Ctrl K</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl px-1.5 py-1 transition hover:bg-white"
              aria-label="Menu do usuário"
            >
              {user?.avatar_url ? (
                /^https?:\/\//.test(user.avatar_url) ? (
                  <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-lg">{user.avatar_url}</span>
                )
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">{userInitials}</span>
              )}
              <ChevronDown size={16} className="text-slate-400" />
            </button>

            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{user?.nome?.split(" ")[0] || "Usuário"}</p>
                    <p className="text-xs text-slate-400">{user?.nivel || ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); navigate("/meu-perfil"); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserIcon size={16} className="text-slate-400" /> Meu perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); navigate("/preferencias"); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Palette size={16} className="text-slate-400" /> Preferências
                  </button>
                  <button
                    type="button"
                    onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut size={16} /> Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className={`flex ${onFarolTab ? "flex-1 min-h-0" : "min-h-[calc(100vh-73px)] lg:min-h-screen"}`}>
        {isNativeShell || farolTab === "farol" ? null : (
          <>
            <div
              className={`fixed inset-0 z-40 bg-slate-950/40 transition-opacity duration-200 lg:hidden ${
                mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={() => setMobileSidebarOpen(false)}
              aria-hidden="true"
            />

            <div
              style={{ backgroundColor: "var(--inove-sidebar, #1d4ed8)" }}
              className={`fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] transform overflow-hidden rounded-r-[28px] transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0 lg:rounded-none ${
                mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
              } ${desktopSidebarOpen ? "" : "lg:hidden"}`}
            >
              <Sidebar />
            </div>

            {/* Alça de abrir/fechar o sidebar (somente desktop) — bem visível */}
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen((current) => !current)}
              className="hidden lg:flex fixed top-1/2 -translate-y-1/2 z-50 h-16 w-7 items-center justify-center rounded-r-xl text-white shadow-lg ring-1 ring-black/10 transition hover:brightness-110"
              style={{ left: desktopSidebarOpen ? "288px" : "0px", backgroundColor: "var(--inove-accent, #2563eb)" }}
              aria-label={desktopSidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
              title={desktopSidebarOpen ? "Fechar menu" : "Abrir menu"}
            >
              {desktopSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <main
            className={`flex-1 overflow-x-hidden overflow-y-auto px-3 py-3 pb-20 md:px-6 md:py-6 lg:pb-6 ${
              farolTab === "farol" ? "hidden" : ""
            }`}
          >
            <Outlet />
          </main>

        </div>
      </div>

      {/* Iframe Farol — posicionado fixo pra ignorar qualquer container e
          ocupar 100% da viewport abaixo das abas, sem espaço branco. */}
      {podeVerFarol && farolMounted && (
        <iframe
          src={FAROL_URL}
          title="Farol Tático"
          className={`fixed left-0 right-0 bottom-0 border-0 bg-white ${farolTab === "farol" ? "block" : "hidden"}`}
          style={{ top: "49px", width: "100vw", height: "calc(100vh - 49px)" }}
          allow="display-capture; microphone; camera; clipboard-read; clipboard-write; autoplay; fullscreen"
          allowFullScreen
        />
      )}

      <MobileBottomNav
        items={mobileNavItems}
        currentPath={`${location.pathname}${location.search}`}
        onOpenMenu={
          // Se ja existe um item Menu na lista (ex.: Contagem), nao
          // duplicar o botao automatico de Menu.
          mobileNavItems.some((item) => item.key === "menu")
            ? undefined
            : isNativeShell
              ? () => navigate("/")
              : isLockedMobileModule
                ? undefined
                : () => setMobileSidebarOpen(true)
        }
      />

      <CommandPalette />
    </div>
  );
}
